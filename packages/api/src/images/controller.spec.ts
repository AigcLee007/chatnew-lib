import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import type { ImageGenerationRequest, ImageGenerationResponse } from 'librechat-data-provider';
import { generateImages } from './service';
import {
  createImageGenerationController,
  imageGenerationBodyErrorHandler,
  IMAGE_GENERATION_KEY_NAME,
} from './controller';

jest.mock('./service', () => ({ generateImages: jest.fn() }));

const mockedGenerateImages = generateImages as jest.MockedFunction<typeof generateImages>;

const requestBody: ImageGenerationRequest = {
  model: 'gpt-image-2',
  prompt: 'a cat',
  size: '1:1',
  resolution: '1K',
  count: 1,
};

function createResponse() {
  const res = Object.assign(new EventEmitter(), {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    writableEnded: false,
    destroyed: false,
  }) as unknown as Response;
  return res;
}

function createRequest(body: unknown = requestBody, user: unknown = { id: 'user-1' }) {
  return Object.assign(new EventEmitter(), { body, user, aborted: false }) as unknown as Request;
}

const result: ImageGenerationResponse = {
  images: [{ data: 'abc', mimeType: 'image/png', index: 0 }],
  requestedCount: 1,
  successCount: 1,
  failedCount: 0,
  model: requestBody.model,
  requestId: 'req-1',
};

describe('image generation controller', () => {
  const getUserKey = jest.fn();
  const controller = createImageGenerationController({ getUserKey });

  beforeEach(() => {
    jest.clearAllMocks();
    getUserKey.mockResolvedValue('aittco-secret');
    mockedGenerateImages.mockResolvedValue(result);
    delete process.env.AITTCO_API_URL;
  });

  it('requires an authenticated user', async () => {
    const res = createResponse();
    const req = Object.assign(new EventEmitter(), {
      body: requestBody,
      user: undefined,
      aborted: false,
    }) as unknown as Request;
    await controller(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_AUTH_REQUIRED',
      message: 'Authentication required',
    });
    expect(getUserKey).not.toHaveBeenCalled();
  });

  it('does not write an authentication error to an already closed response', async () => {
    const res = createResponse();
    Object.defineProperty(res, 'destroyed', { value: true });
    const req = Object.assign(new EventEmitter(), {
      body: requestBody,
      user: undefined,
      aborted: true,
    }) as unknown as Request;

    await controller(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('loads the shared AITTCO key and uses the configured API URL', async () => {
    process.env.AITTCO_API_URL = 'https://proxy.example.test/';
    const res = createResponse();
    await controller(createRequest(), res);
    expect(getUserKey).toHaveBeenCalledWith({ userId: 'user-1', name: IMAGE_GENERATION_KEY_NAME });
    expect(mockedGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'aittco-secret', baseUrl: 'https://proxy.example.test' }),
      requestBody,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('aborts image generation and does not write after the client disconnects', async () => {
    const req = createRequest();
    const res = createResponse();
    mockedGenerateImages.mockImplementationOnce(async (config) => {
      req.emit('aborted');
      expect(config.signal?.aborted).toBe(true);
      return result;
    });

    await controller(req, res);

    expect(mockedGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      requestBody,
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('maps an upstream axios cancellation to a stable cancellation response', async () => {
    mockedGenerateImages.mockRejectedValueOnce(
      Object.assign(new Error('request cancelled'), {
        code: 'ERR_CANCELED',
        name: 'CanceledError',
      }),
    );
    const res = createResponse();

    await controller(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(499);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_REQUEST_CANCELLED',
      message: 'Image generation request was cancelled',
    });
  });

  it('returns a stable error when the shared key is unavailable', async () => {
    getUserKey.mockResolvedValueOnce(undefined);
    const res = createResponse();
    await controller(createRequest(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_KEY_NOT_CONFIGURED',
      message: 'AITTCO API key is not configured',
    });
    expect(mockedGenerateImages).not.toHaveBeenCalled();
  });

  it('rejects client-supplied credentials before loading a key', async () => {
    const res = createResponse();
    await controller(
      createRequest({ ...requestBody, apiKey: 'client-secret', baseURL: 'https://evil.test' }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_INVALID_REQUEST',
      message: 'Client API key and base URL are not accepted',
    });
    expect(getUserKey).not.toHaveBeenCalled();
  });

  it('maps validation failures to a stable 400 response', async () => {
    const validationError = Object.assign(new Error('Invalid image generation request'), {
      name: 'ImageValidationException',
      errors: [{ field: 'model', message: 'Unsupported image model' }],
    });
    mockedGenerateImages.mockRejectedValueOnce(validationError);
    const res = createResponse();
    await controller(createRequest(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_INVALID_REQUEST',
      message: 'Invalid image generation request',
      details: validationError.errors,
    });
  });

  it('accepts a request larger than the global 3 MB parser limit', async () => {
    const res = createResponse();
    const largeRequest = {
      ...requestBody,
      images: [{ data: 'A'.repeat(3 * 1024 * 1024), mimeType: 'image/png' }],
    };
    await controller(createRequest(largeRequest), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockedGenerateImages).toHaveBeenCalled();
  });

  it('rejects payloads above the configured input limit', async () => {
    process.env.AITTCO_IMAGE_MAX_INPUT_BYTES = '100';
    const res = createResponse();
    await controller(createRequest({ ...requestBody, prompt: 'x'.repeat(200) }), res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_TOO_LARGE',
      message: 'Image generation request is too large',
    });
    delete process.env.AITTCO_IMAGE_MAX_INPUT_BYTES;
  });

  it('maps body-parser oversized payload errors to IMAGE_TOO_LARGE', () => {
    const res = createResponse();
    const next = jest.fn();
    imageGenerationBodyErrorHandler(
      Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413 }),
      {} as Request,
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_TOO_LARGE',
      message: 'Image generation request is too large',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413 })],
    [
      Object.assign(new SyntaxError('Unexpected token'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
    ],
  ])('does not write a parser error after the response closes', (error) => {
    const res = createResponse();
    Object.defineProperty(res, 'writableEnded', { value: true });
    const next = jest.fn();

    imageGenerationBodyErrorHandler(error, {} as Request, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('maps malformed JSON parser errors to a stable 400 response', () => {
    const res = createResponse();
    const next = jest.fn();
    imageGenerationBodyErrorHandler(
      Object.assign(new SyntaxError('Unexpected token'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
      {} as Request,
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_INVALID_REQUEST',
      message: 'Invalid image generation request',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns partial results with a stable partial error marker', async () => {
    mockedGenerateImages.mockResolvedValueOnce({ ...result, successCount: 1, failedCount: 1 });
    const res = createResponse();
    await controller(createRequest({ ...requestBody, count: 2 }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ...result,
      successCount: 1,
      failedCount: 1,
      error: 'IMAGE_PARTIAL_FAILURE',
      message: 'Some images could not be generated',
    });
  });

  it.each([
    ['a complete generation', result],
    ['a partial generation', { ...result, successCount: 1, failedCount: 1 }],
  ])('does not write %s after the response closes', async (_description, generationResult) => {
    mockedGenerateImages.mockResolvedValueOnce(generationResult);
    const res = createResponse();
    Object.defineProperty(res, 'writableEnded', { value: true });

    await controller(createRequest({ ...requestBody, count: generationResult.requestedCount }), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { status: 401 } }, 'IMAGE_INVALID_API_KEY', 401, 'AITTCO API key was rejected'],
    [
      { response: { status: 403 } },
      'IMAGE_MODEL_OR_CONTENT_REJECTED',
      403,
      'AITTCO rejected the model or content',
    ],
    [
      { response: { status: 413 } },
      'IMAGE_TOO_LARGE',
      413,
      'Image generation request is too large',
    ],
    [
      { response: { status: 429 } },
      'IMAGE_RATE_LIMITED',
      429,
      'AITTCO is rate limiting image generation',
    ],
    [{ code: 'ECONNABORTED' }, 'IMAGE_TIMEOUT', 504, 'Image generation timed out'],
    [{ response: { status: 500 } }, 'IMAGE_UPSTREAM_ERROR', 502, 'AITTCO image generation failed'],
  ])('maps upstream failures to stable responses', async (error, code, status, message) => {
    mockedGenerateImages.mockRejectedValueOnce(error);
    const res = createResponse();
    await controller(createRequest(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: code, message });
  });
});
