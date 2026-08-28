import axios from 'axios';
import type { ImageGenerationRequest, ImageGenerationResponse, ImageResult } from 'librechat-data-provider';

export interface ImageAdapterConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
}

interface GeminiPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

function parseGeminiResponse(data: { responseId?: string; candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }): ImageGenerationResponse {
  const images: ImageResult[] = (data.candidates ?? []).flatMap((candidate) => candidate.content?.parts ?? []).flatMap((part, index) => part.inlineData ? [{ data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png', index }] : []);
  return { images, requestedCount: 1, successCount: images.length ? 1 : 0, failedCount: images.length ? 0 : 1, model: '' as ImageGenerationResponse['model'], requestId: data.responseId ?? '' };
}

export async function generateWithGemini(config: ImageAdapterConfig, request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const parts: GeminiPart[] = [{ text: request.prompt }, ...(request.images ?? []).map((image) => ({ inlineData: { data: image.data.replace(/^data:[^,]+,/, ''), mimeType: image.mimeType } }))];
  const response = await axios.post(`${config.baseUrl.replace(/\/$/, '')}/v1beta/models/${request.model}:generateContent`, { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: request.size, imageSize: request.resolution } } }, { headers: { 'x-goog-api-key': config.apiKey, 'Content-Type': 'application/json' }, timeout: config.timeoutMs });
  const parsed = parseGeminiResponse(response.data);
  return { ...parsed, model: request.model, requestedCount: request.count };
}

export { parseGeminiResponse };
export const generateGeminiImage = generateWithGemini;
