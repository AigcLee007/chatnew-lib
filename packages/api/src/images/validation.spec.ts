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
    const result = validateImageGenerationRequest({
      ...valid(),
      model: 'other',
      size: '2:1',
      prompt: 'x'.repeat(8001),
      count: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['model', 'size', 'prompt', 'count']),
    );
  });

  it('requires supported image mime types and valid base64 payloads', () => {
    const result = validateImageGenerationRequest({
      ...valid(),
      images: [{ data: 'data:image/gif;base64,YWJj', mimeType: 'image/gif' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['images[0].mimeType', 'images[0].data']),
    );
    expect(
      validateImageGenerationRequest({
        ...valid(),
        images: [{ data: 'YWJj', mimeType: 'image/png' }],
      }).valid,
    ).toBe(true);
  });

  it('returns structured errors for malformed image collections', () => {
    const result = validateImageGenerationRequest({ ...valid(), images: 'not-an-array' as never });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('images');
    const itemResult = validateImageGenerationRequest({
      ...valid(),
      images: [null, { data: 42, mimeType: true }] as never,
    });
    expect(itemResult.valid).toBe(false);
    expect(itemResult.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['images[0]', 'images[1].data', 'images[1].mimeType']),
    );
  });

  it('rejects oversized and excessive reference images', () => {
    const result = validateImageGenerationRequest({
      ...valid(),
      images: [
        ...Array.from({ length: 6 }, () => ({ data: 'x', mimeType: 'image/png' })),
        { data: 'x'.repeat(10 * 1024 * 1024 + 1), mimeType: 'image/png' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['images', 'images[6]']),
    );
  });
});
