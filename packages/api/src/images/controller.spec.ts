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
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createRequest(body: unknown = requestBody, user: unknown = { id: 'user-1' }) {
  return { body, user } as unknown as Request;
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
    await controller({ body: requestBody, user: undefined } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IMAGE_AUTH_REQUIRED',
      message: 'Authentication required',
    });
    expect(getUserKey).not.toHaveBeenCalled();
  });

  it('loads the shared AITTCO key and uses the configured API URL', async () => {
    process.env.AITTCO_API_URL = 'https://proxy.example.test/';
    const res = createResponse();
    await controller(createRequest(), res);
    expect(getUserKey).toHaveBeenCalledWith({ userId: 'user-1', name: IMAGE_GENERATION_KEY_NAME });
    expect(mockedGenerateImages).toHaveBeenCalledWith(
      { apiKey: 'aittco-secret', baseUrl: 'https://proxy.example.test' },
      requestBody,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
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
