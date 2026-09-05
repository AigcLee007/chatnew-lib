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
  id?: string | number | null;
  type?: number | string;
  created_at?: number | string | null;
  model_name?: string;
  model?: string;
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

type RequestUser = {
  id?: string;
  _id?: string | { toString(): string };
};

function createRequest(
  options: { userId?: string; query?: Record<string, string>; user?: RequestUser } = {},
): Request {
  return Object.assign(new EventEmitter(), {
    user: options.user ?? { id: options.userId ?? USER_ID },
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

function expectUsageRequest(
  get: jest.Mock,
  callIndex: number,
  path: string,
  baseUrl = AITTCO_BASE_URL,
): void {
  const [url, options] = get.mock.calls[callIndex] as [
    string,
    { headers?: Record<string, string>; timeout?: number } | undefined,
  ];
  expect(url).toBe(`${baseUrl}${path}`);
  expect(options?.headers?.Authorization).toBe(`Bearer ${TEST_KEY}`);
  expect(options?.timeout).toBe(10_000);
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
    expect(res.body).toEqual({
      source: 'newapi',
      items: [
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
      ],
      limited: true,
    });
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

    expect(res.body).toEqual({
      source: 'newapi',
      items: [
        {
          id: 'partial',
          createdAt: new Date(1_700_003_600 * 1000).toISOString(),
          model: null,
          quota: null,
          promptTokens: 0,
          completionTokens: 0,
        },
      ],
      limited: true,
    });
  });

  it('drops invalid rows, accepts string type 2, uses the model alias, and preserves numeric or null ids', async () => {
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [
          usageRecord({
            id: 'invalid-timestamp',
            created_at: 'not-a-unix-timestamp',
          }),
          null,
          'invalid record',
          usageRecord({
            id: 42,
            type: '2',
            created_at: 1_700_003_600,
            model_name: undefined,
            model: 'alias-model',
          }),
          usageRecord({
            id: null,
            created_at: 1_700_000_000,
          }),
        ],
      },
    });
    const { controller } = createFixture({ get });
    const res = createResponse();

    await controller.handle(createRequest(), res);

    expect(res.body).toEqual({
      source: 'newapi',
      items: [
        {
          id: 42,
          createdAt: new Date(1_700_003_600 * 1000).toISOString(),
          model: 'alias-model',
          quota: 0.25,
          promptTokens: 12,
          completionTokens: 7,
        },
        {
          id: null,
          createdAt: new Date(1_700_000_000 * 1000).toISOString(),
          model: 'gpt-5',
          quota: 0.25,
          promptTokens: 12,
          completionTokens: 7,
        },
      ],
      limited: true,
    });
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
    expect(res.body).toEqual({
      source: 'newapi',
      items: [
        {
          id: expect.any(String),
          createdAt: expect.any(String),
          model: 'gpt-5',
          quota: 0.25,
          promptTokens: 12,
          completionTokens: 7,
        },
      ],
      limited: true,
    });
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
    expect(res.body).toEqual({ source: 'newapi', items: [], limited: true });
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

    const response = res.body as {
      source: string;
      items: Array<Record<string, unknown>>;
      limited: boolean;
    };
    expect(response).toEqual(
      expect.objectContaining({ source: 'newapi', limited: true, items: expect.any(Array) }),
    );
    const record = response.items[0];
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

  it('falls back to req.user._id when req.user.id is absent', async () => {
    const getUserKey = jest.fn().mockResolvedValue(TEST_KEY);
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true, data: [usageRecord({ id: 'legacy-user-record' })] },
    });
    const { controller } = createFixture({ getUserKey, get });
    const res = createResponse();

    await controller.handle(
      createRequest({ user: { _id: { toString: () => 'legacy-user' } } }),
      res,
    );

    expect(getUserKey).toHaveBeenCalledWith({
      userId: 'legacy-user',
      name: AITTCO_SHARED_KEY_NAME,
    });
    expect(res.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'legacy-user-record' })],
      limited: true,
    });
  });

  it('uses the configured AITTCO_API_URL while retaining the usage path and request timeout', async () => {
    const previousBaseUrl = process.env.AITTCO_API_URL;
    process.env.AITTCO_API_URL = 'https://proxy.example.test/';
    try {
      const get = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'configured-base' })] },
      });
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expectUsageRequest(get, 0, USAGE_PATH, 'https://proxy.example.test');
      expect(res.body).toEqual({
        source: 'newapi',
        items: [expect.objectContaining({ id: 'configured-base' })],
        limited: true,
      });
    } finally {
      if (previousBaseUrl === undefined) delete process.env.AITTCO_API_URL;
      else process.env.AITTCO_API_URL = previousBaseUrl;
    }
  });

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
      expect(res.body).toEqual({
        source: 'newapi',
        items: [expect.objectContaining({ id: 'fallback', model: 'gpt-5' })],
        limited: true,
      });
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

  it.each([429, 500])(
    'maps generic upstream status %s to a stable unavailable response without trailing-slash fallback',
    async (status) => {
      const get = jest.fn().mockRejectedValueOnce(upstreamError(status, 'raw generic error body'));
      const { controller } = createFixture({ get });
      const res = createResponse();

      await controller.handle(createRequest(), res);

      expect(get).toHaveBeenCalledTimes(1);
      expectUsageRequest(get, 0, USAGE_PATH);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body).toEqual({
        error: 'UPSTREAM_USAGE_UNAVAILABLE',
        message: ERROR_MESSAGES.unavailable,
      });
      expect(JSON.stringify(res.body)).not.toContain('raw generic error body');
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

  it('caches each user for 60 seconds, supports refresh=1, and clearCache() invalidates every user', async () => {
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
        data: { success: true, data: [usageRecord({ id: 'expired' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'refreshed' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'after-clear-user-1' })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: [usageRecord({ id: 'after-clear-user-2' })] },
      });
    let currentNow = NOW;
    const now = jest.fn(() => currentNow);
    const { controller } = createFixture({ get, now });

    const firstResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), firstResponse);
    expect(firstResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'first' })],
      limited: true,
    });

    currentNow = NOW + 59_999;
    const cachedResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), cachedResponse);
    expect(cachedResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'first' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(1);

    const secondUserResponse = createResponse();
    await controller.handle(createRequest({ userId: 'user-2' }), secondUserResponse);
    expect(secondUserResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'second-user' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(2);

    currentNow = NOW + 60_001;
    const expiredResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), expiredResponse);
    expect(expiredResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'expired' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(3);

    currentNow = NOW + 60_002;
    const refreshedResponse = createResponse();
    await controller.handle(
      createRequest({ userId: USER_ID, query: { refresh: '1' } }),
      refreshedResponse,
    );
    expect(refreshedResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'refreshed' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(4);

    controller.clearCache();
    currentNow = NOW + 60_003;
    const afterClearUserOneResponse = createResponse();
    await controller.handle(createRequest({ userId: USER_ID }), afterClearUserOneResponse);
    expect(afterClearUserOneResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'after-clear-user-1' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(5);

    const afterClearUserTwoResponse = createResponse();
    await controller.handle(createRequest({ userId: 'user-2' }), afterClearUserTwoResponse);
    expect(afterClearUserTwoResponse.body).toEqual({
      source: 'newapi',
      items: [expect.objectContaining({ id: 'after-clear-user-2' })],
      limited: true,
    });
    expect(get).toHaveBeenCalledTimes(6);
    expect(now).toHaveBeenCalled();
  });
});
