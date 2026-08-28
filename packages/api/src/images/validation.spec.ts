import { validateImageGenerationRequest } from './validation';

const valid = () => ({
  model: 'gpt-image-2' as const,
  prompt: 'a cat',
  size: '1:1' as const,
  resolution: '1K' as const,
  count: 1 as const,
});

describe('image generation validation', () => {
  it('accepts a valid request', () => {
    expect(validateImageGenerationRequest(valid())).toEqual({ valid: true, errors: [] });
  });

  it('rejects unsupported values and prompt/count limits', () => {
    const result = validateImageGenerationRequest({ ...valid(), model: 'other', size: '2:1', prompt: 'x'.repeat(8001), count: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining(['model', 'size', 'prompt', 'count']));
  });

  it('rejects oversized and excessive reference images', () => {
    const result = validateImageGenerationRequest({
      ...valid(),
      images: [...Array.from({ length: 6 }, () => ({ data: 'x', mimeType: 'image/png' })), { data: 'x'.repeat(10 * 1024 * 1024 + 1), mimeType: 'image/png' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining(['images', 'images[6]']));
  });
});
