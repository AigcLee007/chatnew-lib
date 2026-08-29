import axios from 'axios';
import FormData from 'form-data';
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationResult,
} from 'librechat-data-provider';
import type { ImageAdapterConfig } from './gemini';

export const OPENAI_IMAGE_SIZES: Record<ImageGenerationRequest['size'], string> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '4:3': '1536x1024',
  '3:4': '1024x1536',
  '5:4': '1536x1024',
  '4:5': '1024x1536',
  '21:9': '1536x1024',
};

interface OpenAIItem {
  b64_json?: string;
  url?: string;
  image?: string | { url?: string; data?: string; mimeType?: string };
  image_url?: string | { url?: string };
}

export function parseImageResponse(data: {
  id?: string;
  data?: OpenAIItem[];
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        image?: string;
        image_url?: string | { url?: string };
      }>;
    };
  }>;
}): ImageGenerationResponse {
  const images: ImageGenerationResult[] = [];
  (data.data ?? []).forEach((item, index) => {
    const objectImage = typeof item.image === 'object' ? item.image : undefined;
    const value =
      item.b64_json ??
      item.url ??
      (typeof item.image === 'string' ? item.image : (objectImage?.data ?? objectImage?.url)) ??
      (typeof item.image_url === 'string' ? item.image_url : item.image_url?.url);
    if (value)
      images.push({
        data: value,
        mimeType:
          objectImage?.mimeType ??
          (value.startsWith('data:image/')
            ? (value.match(/^data:([^;]+)/)?.[1] ?? 'image/png')
            : 'image/png'),
        index,
      });
  });
  (data.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .forEach((part) => {
      const inline = part.inlineData;
      const value =
        inline?.data ??
        part.image ??
        (typeof part.image_url === 'string' ? part.image_url : part.image_url?.url);
      if (value)
        images.push({
          data: value,
          mimeType: inline?.mimeType ?? 'image/png',
          index: images.length,
        });
    });
  return {
    images,
    requestedCount: 1,
    successCount: images.length ? 1 : 0,
    failedCount: images.length ? 0 : 1,
    model: '' as ImageGenerationResponse['model'],
    requestId: data.id ?? '',
  };
}

export function parseOpenAIImageResults(
  data: Parameters<typeof parseImageResponse>[0],
): ImageGenerationResult[] {
  return parseImageResponse(data).images;
}

export const parseOpenAIResponse: typeof parseOpenAIImageResults = parseOpenAIImageResults;

function toBuffer(data: string): Buffer {
  const match = data.match(/^data:[^,]+,(.*)$/s);
  return Buffer.from(match ? match[1] : data, match ? 'base64' : 'base64');
}

export async function generateWithOpenAI(
  config: ImageAdapterConfig,
  request: ImageGenerationRequest,
): Promise<ImageGenerationResponse> {
  const base = config.baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${config.apiKey}` };
  let response;
  if (!request.images?.length) {
    response = await axios.post(
      `${base}/v1/images/generations`,
      {
        model: request.model,
        prompt: request.prompt,
        n: 1,
        size: OPENAI_IMAGE_SIZES[request.size],
      },
      { headers, timeout: config.timeoutMs, signal: config.signal },
    );
  } else {
    const form = new FormData();
    form.append('model', request.model);
    form.append('prompt', request.prompt);
    form.append('n', '1');
    form.append('size', OPENAI_IMAGE_SIZES[request.size]);
    request.images.forEach((image, index) =>
      form.append(index === 0 ? 'image' : 'image[]', toBuffer(image.data), {
        filename: `reference-${index}.png`,
        contentType: image.mimeType,
      }),
    );
    response = await axios.post(`${base}/v1/images/edits`, form, {
      headers: { ...headers, ...form.getHeaders() },
      timeout: config.timeoutMs,
      signal: config.signal,
    });
  }
  const parsed = parseImageResponse(response.data);
  return { ...parsed, model: request.model, requestedCount: request.count };
}

export const generateOpenAIImage: typeof generateWithOpenAI = generateWithOpenAI;
