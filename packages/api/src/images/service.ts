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
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      images.push(
        ...result.value.images.slice(0, 1).map((image) => ({ ...image, index: images.length })),
      );
      requestId ||= result.value.requestId;
    }
  });
  const successCount = images.length;
  return {
    images,
    requestedCount: request.count,
    successCount,
    failedCount: request.count - successCount,
    model: request.model,
    requestId,
  };
}

export const generateImage = generateImages;
