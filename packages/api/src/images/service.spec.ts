import { generateImages } from './service';
import { generateWithGemini } from './gemini';
import { generateWithOpenAI } from './openai';

jest.mock('./gemini');
jest.mock('./openai');
const mockedGemini = generateWithGemini as jest.MockedFunction<typeof generateWithGemini>;
const mockedOpenAI = generateWithOpenAI as jest.MockedFunction<typeof generateWithOpenAI>;

const request = {
  model: 'gemini-3-pro-image-preview' as const,
  prompt: 'cat',
  size: '1:1' as const,
  resolution: '1K' as const,
  count: 3 as const,
};

describe('image generation service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs one request per requested image and aggregates partial failures', async () => {
    mockedGemini.mockResolvedValueOnce({
      images: [
        { data: 'a', mimeType: 'image/png', index: 0 },
        { data: 'extra', mimeType: 'image/png', index: 1 },
      ],
      requestedCount: 1,
      successCount: 1,
      failedCount: 0,
      model: request.model,
      requestId: 'r1',
    });
    mockedGemini.mockRejectedValueOnce(new Error('upstream'));
    mockedGemini.mockResolvedValueOnce({
      images: [{ data: 'c', mimeType: 'image/png', index: 0 }],
      requestedCount: 1,
      successCount: 1,
      failedCount: 0,
      model: request.model,
      requestId: 'r3',
    });
    const result = await generateImages({ apiKey: 'k', baseUrl: 'https://example.com' }, request);
    expect(mockedGemini).toHaveBeenCalledTimes(3);
    expect(result.images).toHaveLength(2);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it('dispatches OpenAI models to the OpenAI adapter', async () => {
    mockedOpenAI.mockResolvedValue({
      images: [{ data: 'a', mimeType: 'image/png', index: 0 }],
      requestedCount: 1,
      successCount: 1,
      failedCount: 0,
      model: 'gpt-image-2',
      requestId: 'o1',
    });
    const result = await generateImages(
      { apiKey: 'k', baseUrl: 'https://example.com' },
      { ...request, model: 'gpt-image-2' },
    );
    expect(mockedOpenAI).toHaveBeenCalledTimes(3);
    expect(mockedGemini).not.toHaveBeenCalled();
    expect(result.successCount).toBe(3);
  });

  it('propagates the first upstream error when every image request fails', async () => {
    const upstreamError = Object.assign(new Error('rate limited'), {
      response: { status: 429 },
    });
    mockedGemini.mockRejectedValue(upstreamError);
    await expect(
      generateImages({ apiKey: 'k', baseUrl: 'https://example.com' }, request),
    ).rejects.toBe(upstreamError);
  });
});
