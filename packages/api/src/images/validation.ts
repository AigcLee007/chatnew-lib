import { IMAGE_ASPECT_RATIOS, IMAGE_MODELS, IMAGE_RESOLUTIONS, MAX_IMAGE_COUNT, MAX_REFERENCE_IMAGES } from 'librechat-data-provider';
import type { ImageGenerationRequest } from 'librechat-data-provider';

export interface ImageValidationError {
  field: string;
  message: string;
}

export type ImageValidationResult = { valid: true; errors: [] } | { valid: false; errors: ImageValidationError[] };

const MAX_PROMPT_LENGTH = 8000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function imageBytes(data: string): number {
  if (data.startsWith('data:')) {
    const encoded = data.slice(data.indexOf(',') + 1).replace(/\s/g, '');
    return Math.floor((encoded.length * 3) / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  }
  return isValidBase64(data) ? Buffer.from(data, 'base64').length : Buffer.byteLength(data, 'utf8');
}

function isValidBase64(data: string): boolean {
  return data.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data);
}

export function validateImageGenerationRequest(input: Partial<ImageGenerationRequest>): ImageValidationResult {
  const errors: ImageValidationError[] = [];
  if (!IMAGE_MODELS.includes(input.model as (typeof IMAGE_MODELS)[number])) errors.push({ field: 'model', message: 'Unsupported image model' });
  if (typeof input.prompt !== 'string' || input.prompt.length > MAX_PROMPT_LENGTH) errors.push({ field: 'prompt', message: 'Prompt must be at most 8000 characters' });
  if (!IMAGE_ASPECT_RATIOS.includes(input.size as (typeof IMAGE_ASPECT_RATIOS)[number])) errors.push({ field: 'size', message: 'Unsupported aspect ratio' });
  if (!IMAGE_RESOLUTIONS.includes(input.resolution as (typeof IMAGE_RESOLUTIONS)[number])) errors.push({ field: 'resolution', message: 'Unsupported resolution' });
  if (!Number.isInteger(input.count) || (input.count as number) < 1 || (input.count as number) > MAX_IMAGE_COUNT) errors.push({ field: 'count', message: 'Count must be between 1 and 4' });
  if (input.images && input.images.length > MAX_REFERENCE_IMAGES) errors.push({ field: 'images', message: 'At most 5 reference images are allowed' });
  input.images?.forEach((image, index) => {
    const field = `images[${index}]`;
    if (!ALLOWED_MIME_TYPES.has(image.mimeType)) errors.push({ field: `${field}.mimeType`, message: 'Only PNG, JPEG, and WebP images are supported' });
    if (image.data.startsWith('data:')) {
      const match = image.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match || !ALLOWED_MIME_TYPES.has(match[1]) || match[1] !== image.mimeType || !isValidBase64(match[2])) errors.push({ field: `${field}.data`, message: 'Image data must be a valid matching base64 data URL' });
    } else if (!isValidBase64(image.data)) {
      errors.push({ field: `${field}.data`, message: 'Image data must be valid base64' });
    }
    if (imageBytes(image.data) > MAX_IMAGE_BYTES) errors.push({ field: `images[${index}]`, message: 'Each reference image must be at most 10 MB' });
  });
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

export function assertValidImageGenerationRequest(input: Partial<ImageGenerationRequest>): asserts input is ImageGenerationRequest {
  const result = validateImageGenerationRequest(input);
  if (!result.valid) throw new ImageValidationException(result.errors);
}

export class ImageValidationException extends Error {
  public readonly errors: ImageValidationError[];

  constructor(errors: ImageValidationError[]) {
    super('Invalid image generation request');
    this.name = 'ImageValidationException';
    this.errors = errors;
  }
}
