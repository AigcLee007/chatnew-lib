import type { IMAGE_ASPECT_RATIOS, IMAGE_MODELS, IMAGE_RESOLUTIONS } from './constants';

export type ImageModel = (typeof IMAGE_MODELS)[number];
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];
export type ImageCount = 1 | 2 | 3 | 4;

export interface ReferenceImage {
  data: string;
  mimeType: string;
}

export interface ImageGenerationRequest {
  model: ImageModel;
  prompt: string;
  images?: ReferenceImage[];
  size: ImageAspectRatio;
  resolution: ImageResolution;
  count: ImageCount;
}

export interface ImageResult {
  data: string;
  mimeType: string;
  index: number;
}

export interface ImageGenerationResponse {
  images: ImageResult[];
  requestedCount: ImageCount;
  successCount: number;
  failedCount: number;
  model: ImageModel;
  requestId: string;
  errors?: string[];
}
