export const IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2',
] as const;

export const IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '5:4', '4:5', '21:9'] as const;

export const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;

export const MAX_REFERENCE_IMAGES = 5;
export const MAX_IMAGE_COUNT = 4;
