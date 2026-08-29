import type { Request, Response } from 'express';
import type { ImageGenerationRequest } from 'librechat-data-provider';
import { generateImages } from './service';

export const IMAGE_GENERATION_KEY_NAME = 'aittco_shared';
export const DEFAULT_AITTCO_API_URL = 'https://api.aittco.com';
export const DEFAULT_IMAGE_MAX_INPUT_BYTES = 60 * 1024 * 1024;

type GetUserKey = (params: { userId: string; name: string }) => Promise<unknown>;

export interface ImageGenerationControllerDeps {
  getUserKey: GetUserKey;
  generateImages?: typeof generateImages;
}

type ImageRequest = Request & {
  user?: { id?: string; _id?: { toString(): string } | string };
};

function responseError(
  res: Response,
  status: number,
  error: string,
  message: string,
  details?: unknown,
): Response {
  return res.status(status).json({ error, message, ...(details ? { details } : {}) });
}

function userIdFromRequest(req: ImageRequest): string | undefined {
  const id = req.user?.id ?? req.user?._id;
  if (typeof id === 'string') return id.trim() || undefined;
  return id?.toString?.().trim() || undefined;
}

function apiBaseUrl(): string {
  const configured = process.env.AITTCO_API_URL?.trim();
  return (configured || DEFAULT_AITTCO_API_URL).replace(/\/$/, '');
}

function timeoutMs(): number | undefined {
  const value = Number(process.env.AITTCO_IMAGE_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function maxInputBytes(): number {
  const value = Number(process.env.AITTCO_IMAGE_MAX_INPUT_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_IMAGE_MAX_INPUT_BYTES;
}

function bodySize(body: unknown): number {
  if (body == null) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function hasClientCredentials(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const input = body as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(input, 'apiKey') ||
    Object.prototype.hasOwnProperty.call(input, 'baseURL') ||
    Object.prototype.hasOwnProperty.call(input, 'baseUrl')
  );
}

function isMissingKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === 'object' ? String((error as { code?: unknown }).code ?? '') : '';
  return /no[_ ]user[_ ]key|not configured|not found|NO_USER_KEY/i.test(`${message} ${code}`);
}

function isValidationError(error: unknown): error is { errors?: unknown } {
  return error instanceof Error
    ? error.name === 'ImageValidationException'
    : Boolean(
        error &&
          typeof error === 'object' &&
          (error as { name?: unknown }).name === 'ImageValidationException',
      );
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown; message?: unknown };
  return (
    candidate.code === 'ECONNABORTED' ||
    candidate.code === 'ETIMEDOUT' ||
    candidate.name === 'TimeoutError' ||
    /timeout/i.test(String(candidate.message ?? ''))
  );
}

function upstreamStatus(error: unknown): number | undefined {
  if (typeof error === 'number') return error;
  if (!error || typeof error !== 'object') return undefined;
  const status =
    (error as { response?: { status?: unknown }; status?: unknown }).response?.status ??
    (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export function createImageGenerationController(deps: ImageGenerationControllerDeps) {
  const runGeneration = deps.generateImages ?? generateImages;

  return async function imageGenerationController(req: Request, res: Response): Promise<Response> {
    const typedReq = req as ImageRequest;
    const userId = userIdFromRequest(typedReq);
    if (!userId) return responseError(res, 401, 'IMAGE_AUTH_REQUIRED', 'Authentication required');

    if (hasClientCredentials(req.body)) {
      return responseError(
        res,
        400,
        'IMAGE_INVALID_REQUEST',
        'Client API key and base URL are not accepted',
      );
    }

    if (bodySize(req.body) > maxInputBytes()) {
      return responseError(res, 413, 'IMAGE_TOO_LARGE', 'Image generation request is too large');
    }

    let apiKey: string | undefined;
    try {
      const stored = await deps.getUserKey({ userId, name: IMAGE_GENERATION_KEY_NAME });
      if (typeof stored === 'string' && stored.trim() && stored.trim() !== 'user_provided')
        apiKey = stored.trim();
    } catch (error) {
      if (!isMissingKeyError(error)) {
        return responseError(res, 500, 'IMAGE_KEY_LOOKUP_FAILED', 'Unable to read AITTCO API key');
      }
    }
    if (!apiKey) {
      return responseError(
        res,
        404,
        'IMAGE_KEY_NOT_CONFIGURED',
        'AITTCO API key is not configured',
      );
    }

    try {
      const body = (req.body ?? {}) as ImageGenerationRequest;
      const config = {
        apiKey,
        baseUrl: apiBaseUrl(),
        ...(timeoutMs() ? { timeoutMs: timeoutMs() } : {}),
      };
      const result = await runGeneration(config, body);
      if (result.successCount === 0 && result.requestedCount > 0) {
        return responseError(res, 502, 'IMAGE_UPSTREAM_ERROR', 'AITTCO image generation failed');
      }
      if (result.failedCount > 0) {
        return res.status(200).json({
          ...result,
          error: 'IMAGE_PARTIAL_FAILURE',
          message: 'Some images could not be generated',
        });
      }
      return res.status(200).json(result);
    } catch (error) {
      if (isValidationError(error)) {
        return responseError(
          res,
          400,
          'IMAGE_INVALID_REQUEST',
          'Invalid image generation request',
          error.errors,
        );
      }
      if (isTimeoutError(error)) {
        return responseError(res, 504, 'IMAGE_TIMEOUT', 'Image generation timed out');
      }
      const status = upstreamStatus(error);
      if (status === 401) {
        return responseError(res, 401, 'IMAGE_INVALID_API_KEY', 'AITTCO API key was rejected');
      }
      if (status === 403) {
        return responseError(
          res,
          403,
          'IMAGE_MODEL_OR_CONTENT_REJECTED',
          'AITTCO rejected the model or content',
        );
      }
      if (status === 413) {
        return responseError(res, 413, 'IMAGE_TOO_LARGE', 'Image generation request is too large');
      }
      if (status === 429) {
        return responseError(
          res,
          429,
          'IMAGE_RATE_LIMITED',
          'AITTCO is rate limiting image generation',
        );
      }
      return responseError(res, 502, 'IMAGE_UPSTREAM_ERROR', 'AITTCO image generation failed');
    }
  };
}
