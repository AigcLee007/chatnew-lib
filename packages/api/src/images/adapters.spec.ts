import axios from 'axios';
import { generateWithGemini } from './gemini';
import { generateWithOpenAI, parseImageResponse } from './openai';
import { OPENAI_IMAGE_MODELS } from './fixtures';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('image adapters', () => {
  beforeEach(() => jest.clearAllMocks());

  const openAISize = '1024x1024';

  it('builds Gemini generateContent image request with inline reference parts', async () => {
    const abortController = new AbortController();
    mockedAxios.post.mockResolvedValue({
      data: {
        responseId: 'g-1',
        candidates: [
          { content: { parts: [{ inlineData: { data: 'abc', mimeType: 'image/png' } }] } },
        ],
      },
    });
    const result = await generateWithGemini(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      {
        model: 'gemini-3-pro-image-preview',
        prompt: 'cat',
        images: [{ data: 'ref', mimeType: 'image/jpeg' }],
        size: '16:9',
        resolution: '2K',
        count: 1,
      },
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/v1beta/models/gemini-3-pro-image-preview:generateContent'),
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'key' }),
        signal: abortController.signal,
      }),
    );
    expect(result.images[0]).toEqual({ data: 'abc', mimeType: 'image/png', index: 0 });
  });

  it.each(OPENAI_IMAGE_MODELS)('builds a generation request for %s', async (model) => {
    const abortController = new AbortController();
    mockedAxios.post.mockResolvedValue({ data: { id: 'o-1', data: [{ b64_json: 'abc' }] } });
    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      { model, prompt: 'cat', size: '1:1', resolution: '1K', count: 1 },
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/generations',
      expect.objectContaining({ model, n: 1, size: openAISize }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer key' },
        signal: abortController.signal,
      }),
    );
  });

  it.each(OPENAI_IMAGE_MODELS)('builds an edit request for %s', async (model) => {
    const abortController = new AbortController();
    mockedAxios.post.mockResolvedValue({ data: { id: 'o-2', data: [{ url: 'https://img' }] } });
    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      {
        model,
        prompt: 'edit',
        images: [{ data: 'YWJj', mimeType: 'image/png' }],
        size: '1:1',
        resolution: '1K',
        count: 1,
      },
    );
    const body = mockedAxios.post.mock.calls[0][1] as { getBuffer: () => Buffer };
    const payload = body.getBuffer().toString('utf8');
    expect(payload).toContain('name="prompt"');
    expect(payload).toContain('edit');
    expect(payload).toContain('name="model"');
    expect(payload).toContain(model);
    expect(payload).toMatch(/name="n"[\s\S]*?\b1\b/);
    expect(payload).toContain('name="size"');
    expect(payload).toContain(openAISize);
    expect(payload).toContain('name="image"');
    expect(payload).toContain('filename="reference-0.png"');
    expect(payload).toContain('abc');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/edits',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
        signal: abortController.signal,
      }),
    );
  });

  it('parses supported image response forms', () => {
    expect(parseImageResponse({ data: [{ b64_json: 'a' }] }).images[0].data).toBe('a');
    expect(parseImageResponse({ data: [{ url: 'u' }] }).images[0].data).toBe('u');
    expect(
      parseImageResponse({
        candidates: [
          { content: { parts: [{ inlineData: { data: 'i', mimeType: 'image/webp' } }] } },
        ],
      }).images[0].mimeType,
    ).toBe('image/webp');
  });
});
