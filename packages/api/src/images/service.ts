import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationResult,
} from 'librechat-data-provider';
import { generateWithGemini } from './gemini';
import type { ImageAdapterConfig } from './gemini';
import { generateWithOpenAI } from './openai';
import { assertValidImageGenerationRequest } from './validation';

export async function generateImages(
  config: ImageAdapterConfig,
  request: ImageGenerationRequest,
): Promise<ImageGenerationResponse> {
  assertValidImageGenerationRequest(request);
  const tasks = Array.from({ length: request.count }, () => {
    const one = { ...request, count: 1 as const };
    return request.model.startsWith('gemini-')
      ? generateWithGemini(config, one)
      : generateWithOpenAI(config, one);
  });
  const settled = await Promise.allSettled(tasks);
  const images: ImageGenerationResult[] = [];
  let requestId = '';
  const failures: unknown[] = [];
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      images.push(
        ...result.value.images.slice(0, 1).map((image) => ({ ...image, index: images.length })),
      );
      requestId ||= result.value.requestId;
    } else {
      failures.push(result.reason);
    }
  });
  if (images.length === 0 && failures.length > 0) {
    throw failures[0];
  }
  const successCount = images.length;
  return {
    images,
    requestedCount: request.count,
    successCount,
    failedCount: request.count - successCount,
    model: request.model,
    requestId,
    ...(failures.length > 0
      ? {
          errors: failures.map((error) => {
            const status =
              error && typeof error === 'object' && 'response' in error
                ? (error as { response?: { status?: number } }).response?.status
                : undefined;
            const code =
              error && typeof error === 'object' && 'code' in error
                ? String((error as { code?: unknown }).code)
                : 'UPSTREAM_ERROR';
            return status ? `${code}:${status}` : code;
          }),
        }
      : {}),
  };
}

export const generateImage = (
  config: ImageAdapterConfig,
  request: ImageGenerationRequest,
): Promise<ImageGenerationResponse> => generateImages(config, request);
