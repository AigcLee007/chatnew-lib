import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_MODELS,
  IMAGE_RESOLUTIONS,
  MAX_IMAGE_COUNT,
  MAX_REFERENCE_IMAGES,
} from './constants';
import type {
  ImageAspectRatio,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModel,
  ImageResolution,
  ImageResult,
  ReferenceImage,
} from './types';
import type { ImageGenerationResult, ImageResult as RootImageResult } from '../index';

describe('image generation contract', () => {
  it('defines the supported models, aspect ratios, and resolutions', () => {
    expect(IMAGE_MODELS).toEqual([
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview',
      'gpt-image-2',
    ]);
    expect(IMAGE_ASPECT_RATIOS).toEqual(['1:1', '16:9', '9:16', '4:3', '3:4', '5:4', '4:5', '21:9']);
    expect(IMAGE_RESOLUTIONS).toEqual(['1K', '2K', '4K']);
    expect(MAX_IMAGE_COUNT).toBe(4);
    expect(MAX_REFERENCE_IMAGES).toBe(5);
  });

  it('exposes the shared request and response shapes', () => {
    const referenceImage: ReferenceImage = { data: 'data:image/png;base64,abc', mimeType: 'image/png' };
    const request: ImageGenerationRequest = {
      model: 'gpt-image-2',
      prompt: 'A rainy futuristic city',
      images: [referenceImage],
      size: '16:9',
      resolution: '2K',
      count: 4,
    };
    const result: ImageResult = { data: referenceImage.data, mimeType: referenceImage.mimeType, index: 0 };
    const response: ImageGenerationResponse = {
      images: [result],
      requestedCount: request.count,
      successCount: 1,
      failedCount: 3,
      model: request.model,
      requestId: 'request-1',
    };

    expect(response.images[0]).toEqual(result);
  });

  it('keeps contract unions limited to the supported values', () => {
    const model: ImageModel = IMAGE_MODELS[0];
    const aspectRatio: ImageAspectRatio = IMAGE_ASPECT_RATIOS[0];
    const resolution: ImageResolution = IMAGE_RESOLUTIONS[0];

    expect([model, aspectRatio, resolution]).toEqual(['gemini-3-pro-image-preview', '1:1', '1K']);
  });

  it('preserves the search result and exposes generated results at the entry point', () => {
    const searchResult: RootImageResult = { imageUrl: 'https://example.com/image.png' };
    const generatedResult: ImageGenerationResult = {
      data: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      index: 0,
    };

    expect(searchResult.imageUrl).toContain('example.com');
    expect(generatedResult.index).toBe(0);
  });
});
