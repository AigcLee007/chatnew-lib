import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

import { createAittcoUsageController } from './usage';

const AITTCO_SHARED_KEY_NAME = 'aittco_shared';
const AITTCO_BASE_URL = 'https://api.aittco.com';
const USAGE_PATH = '/api/log/token';
const USAGE_PATH_WITH_TRAILING_SLASH = '/api/log/token/';
const TEST_KEY = 'aittco-test-key';
const USER_ID = 'user-1';
const NOW = 1_700_000_000_000;

const ERROR_MESSAGES = {
  keyNotConfigured: 'AITTCO usage API key is not configured',
  authFailed: 'AITTCO usage API key was rejected',
  unavailable: 'AITTCO usage service is unavailable',
} as const;

type RawUsageRecord = {
  id?: string;
  type?: number;
  created_at?: number;
  model_name?: string;
  quota?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  content?: string;
  ip?: string;
  Authorization?: string;
  [key: string]: unknown;
};

type MockResponse = Response & {
  body: unknown;
  statusCode: number;
  status: jest.Mock;
  json: jest.Mock;
  writableEnded: boolean;
  destroyed: boolean;
};

function createResponse(): MockResponse {
  const res = Object.assign(new EventEmitter(), {
    body: undefined,
    statusCode: 200,
    status: jest.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    writableEnded: false,
    destroyed: false,
  });
  return res as unknown as MockResponse;
}

function createRequest(options: { userId?: string; query?: Record<string, string> } = {}): Request {
  return Object.assign(new EventEmitter(), {
    user: { id: options.userId ?? USER_ID },
    query: options.query ?? {},
    body: {},
    aborted: false,
  }) as unknown as Request;
}

function usageRecord(overrides: RawUsageRecord = {}): RawUsageRecord {
  return {
    id: 'usage-1',
    type: 2,
    created_at: 1_700_003_600,
    model_name: 'gpt-5',
    quota: 0.25,
    prompt_tokens: 12,
    completion_tokens: 7,
    ...overrides,
  };
}

function upstreamError(
  status: number,
  rawBody = 'raw upstream body',
): Error & {
  response: { status: number; data: unknown };
} {
  return Object.assign(new Error(`upstream status ${status}`), {
    response: { status, data: { message: rawBody } },
  });
}

function createFixture(
  options: {
    get?: jest.Mock;
    getUserKey?: jest.Mock;
    now?: jest.Mock;
  } = {},
) {
  const getUserKey = options.getUserKey ?? jest.fn().mockResolvedValue(TEST_KEY);
  const get =
    options.get ??
    jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true, data: [] },
    });
  const now = options.now ?? jest.fn().mockReturnValue(NOW);
  const controller = createAittcoUsageController({ getUserKey, get, now });
  return { controller, get, getUserKey, now };
}

function expectUsageRequest(get: jest.Mock, callIndex: number, path: string): void {
  const [url, options] = get.mock.calls[callIndex] as [
    string,
    { headers?: Record<string, string> } | undefined,
  ];
  expect(url).toBe(`${AITTCO_BASE_URL}${path}`);
  expect(options?.headers?.Authorization).toBe(`Bearer ${TEST_KEY}`);
}

describe('AITTCO usage controller', () => {
  it('filters type 2 records, sorts by created_at descending, and normalizes the New API envelope', async () => {
    const newer = usageRecord({
      id: 'newer',
      created_at: 1_700_003_600,
      model_name: 'gpt-5.2',
      quota: 0.42,
      prompt_tokens: 40,
      completion_tokens: 9,
    });
    const older = usageRecord({
      id: 'older',
      created_at: 1_700_000_000,
      model_name: 'gpt-4.1',
      quota: 0.1,
      prompt_tokens: 20,
      completion_tokens: 4,
    });
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [{ ...older, type: 2 }, { ...newer, type: 1 }, newer],
      },
    });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await controller.handle(createRequest(), res);

    expectUsageRequest(get, 0, USAGE_PATH);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual([
      {
        id: 'newer',
        createdAt: new Date(1_700_003_600 * 1000).toISOString(),
        model: 'gpt-5.2',
        quota: 0.42,
        promptTokens: 40,
        completionTokens: 9,
      },
      {
        id: 'older',
        createdAt: new Date(1_700_000_000 * 1000).toISOString(),
        model: 'gpt-4.1',
        quota: 0.1,
        promptTokens: 20,
        completionTokens: 4,
      },
    ]);
  });

  it('normalizes missing model and quota to null and missing token counts to zero', async () => {
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [
          usageRecord({
            id: 'partial',
            model_name: undefined,
            quota: undefined,
            prompt_tokens: undefined,
            completion_tokens: undefined,
          }),
        ],
      },
    });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await controller.handle(createRequest(), res);

    expect(res.body).toEqual([
      {
        id: 'partial',
        createdAt: new Date(1_700_003_600 * 1000).toISOString(),
        model: null,
        quota: null,
        promptTokens: 0,
        completionTokens: 0,
      },
    ]);
  });

  it.each([
    ['a direct array', [usageRecord({ id: 'direct' })]],
    ['a data.items wrapper', { data: { items: [usageRecord({ id: 'items' })] } }],
    ['a data.logs wrapper', { data: { logs: [usageRecord({ id: 'logs' })] } }],
  ])('accepts %s from the upstream response', async (_description, data) => {
    const get = jest.fn().mockResolvedValue({ status: 200, data });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await controller.handle(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual([
      {
        id: expect.any(String),
        createdAt: expect.any(String),
        model: 'gpt-5',
        quota: 0.25,
        promptTokens: 12,
        completionTokens: 7,
      },
    ]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an object without records', {}],
    ['a non-array New API data field', { success: true, data: {} }],
    ['a non-array items field', { data: { items: {} } }],
    ['a non-array logs field', { data: { logs: 'not a list' } }],
    ['a failed New API envelope', { success: false, data: [usageRecord()] }],
    ['a scalar body', 'malformed body'],
  ])('returns a stable empty list for %s without crashing', async (_description, data) => {
    const get = jest.fn().mockResolvedValue({ status: 200, data });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await expect(controller.handle(createRequest(), res)).resolves.toBeDefined();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual([]);
  });

  it('returns only the public usage fields and never serializes upstream sensitive values', async () => {
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [
          usageRecord({
            content: 'prompt content must not be returned',
            ip: '192.0.2.15',
            Authorization: 'Bearer leaked-upstream-token',
            apiKey: TEST_KEY,
            headers: { Authorization: TEST_KEY },
          }),
        ],
      },
    });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await controller.handle(createRequest(), res);

    const record = (res.body as Array<Record<string, unknown>>)[0];
    expect(Object.keys(record).sort()).toEqual(
      ['id', 'createdAt', 'model', 'quota', 'promptTokens', 'completionTokens'].sort(),
    );
    expect(record).not.toHaveProperty('content');
    expect(record).not.toHaveProperty('ip');
    expect(record).not.toHaveProperty('Authorization');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/content|192\.0\.2\.15|authorization/i);
    expect(serialized).not.toContain(TEST_KEY);
  });

  it.each([undefined, null, '', '   ', 'user_provided'])(
    'returns 404 AITTCO_USAGE_KEY_NOT_CONFIGURED for a %p shared key without an upstream call',
    async (key) => {
      const getUserKey = jest.fn().mockResolvedValue(key);
      const get = jest.fn();
      const { controller } = createFixture({ getUserKey, get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(getUserKey).toHaveBeenCalledWith({ userId: USER_ID, name: AITTCO_SHARED_KEY_NAME });
      expect(get).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body).toEqual({
        error: 'AITTCO_USAGE_KEY_NOT_CONFIGURED',
        message: ERROR_MESSAGES.keyNotConfigured,
      });
    },
  );

  it.each([404, 405])(
    'falls back from the non-trailing usage path when upstream returns %s',
    async (status) => {
      const get = jest
        .fn()
        .mockRejectedValueOnce(upstreamError(status, 'raw unsupported-path body'))
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, data: [usageRecord({ id: 'fallback' })] },
        });
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(get).toHaveBeenCalledTimes(2);
      expectUsageRequest(get, 0, USAGE_PATH);
      expectUsageRequest(get, 1, USAGE_PATH_WITH_TRAILING_SLASH);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual([expect.objectContaining({ id: 'fallback', model: 'gpt-5' })]);
    },
  );

  it.each([
    [404, 404],
    [404, 405],
    [405, 404],
    [405, 405],
  ])(
    'returns 502 UPSTREAM_USAGE_UNAVAILABLE when both usage paths are unsupported (%s then %s)',
    async (firstStatus, secondStatus) => {
      const get = jest
        .fn()
        .mockRejectedValueOnce(upstreamError(firstStatus, 'raw first unsupported body'))
        .mockRejectedValueOnce(upstreamError(secondStatus, 'raw second unsupported body'));
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(get).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body).toEqual({
        error: 'UPSTREAM_USAGE_UNAVAILABLE',
        message: ERROR_MESSAGES.unavailable,
      });
      expect(JSON.stringify(res.body)).not.toContain('raw ');
    },
  );

  it.each([401, 403])(
    'maps upstream %s to a stable usage auth error without exposing upstream details',
    async (status) => {
      const get = jest.fn().mockRejectedValueOnce(upstreamError(status, 'raw auth body'));
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(get).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.body).toEqual({
        error: 'AITTCO_USAGE_AUTH_FAILED',
        message: ERROR_MESSAGES.authFailed,
      });
      expect(JSON.stringify(res.body)).not.toContain('raw auth body');
    },
  );

  it.each([
    ['a timeout', Object.assign(new Error('socket timed out'), { code: 'ECONNABORTED' })],
    ['a network failure', Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })],
  ])(
    'maps %s to a stable 502 usage error without exposing the raw error',
    async (_description, error) => {
      const get = jest.fn().mockRejectedValueOnce(error);
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(get).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body).toEqual({
        error: 'UPSTREAM_USAGE_UNAVAILABLE',
        message: ERROR_MESSAGES.unavailable,
      });
      expect(JSON.stringify(res.body)).not.toContain(error.message);
    },
  );

  it('caches each user within the TTL, bypasses cache for refresh=true, and clearCache invalidates one user', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'first' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'second-user' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'refreshed' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'after-clear' })] },
      });
    const now = jest.fn().mockReturnValue(NOW);
    const { controller } = createFixture({ get, now });

    const firstResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), firstResponse);
    expect(firstResponse.body).toEqual([expect.objectContaining({ id: 'first' })]);

    const cachedResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), cachedResponse);
    expect(cachedResponse.body).toEqual([expect.objectContaining({ id: 'first' })]);
    expect(get).toHaveBeenCalledTimes(1);

    const secondUserResponse = createResponse();
    await controller.handle(createRequest({ userId: 'user-2' }), secondUserResponse);
    expect(secondUserResponse.body).toEqual([expect.objectContaining({ id: 'second-user' })]);
    expect(get).toHaveBeenCalledTimes(2);

    const refreshedResponse = createResponse();
    await controller.handle(
      createRequest({ userId: USER_ID, query: { refresh: 'true' } }),
      refreshedResponse,
    );
    expect(refreshedResponse.body).toEqual([expect.objectContaining({ id: 'refreshed' })]);
    expect(get).toHaveBeenCalledTimes(3);

    controller.clearCache(USER_ID);
    const afterClearResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), afterClearResponse);
    expect(afterClearResponse.body).toEqual([expect.objectContaining({ id: 'after-clear' })]);
    expect(get).toHaveBeenCalledTimes(4);
    expect(now).toHaveBeenCalled();
  });
});
