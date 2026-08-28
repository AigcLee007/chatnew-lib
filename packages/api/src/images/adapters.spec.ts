import axios from 'axios';
import { generateWithGemini } from './gemini';
import { generateWithOpenAI, parseImageResponse } from './openai';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('image adapters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds Gemini generateContent image request with inline reference parts', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        responseId: 'g-1',
        candidates: [
          { content: { parts: [{ inlineData: { data: 'abc', mimeType: 'image/png' } }] } },
        ],
      },
    });
    const result = await generateWithGemini(
      { apiKey: 'key', baseUrl: 'https://api.example.com' },
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
      expect.objectContaining({ headers: expect.objectContaining({ 'x-goog-api-key': 'key' }) }),
    );
    expect(result.images[0]).toEqual({ data: 'abc', mimeType: 'image/png', index: 0 });
  });

  it('uses OpenAI generations without references and edits multipart with references', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 'o-1', data: [{ b64_json: 'abc' }] } });
    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com' },
      { model: 'gpt-image-2', prompt: 'cat', size: '1:1', resolution: '1K', count: 1 },
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/v1/images/generations'),
      expect.objectContaining({ model: 'gpt-image-2', n: 1, size: '1024x1024' }),
      expect.anything(),
    );
    mockedAxios.post.mockResolvedValue({ data: { id: 'o-2', data: [{ url: 'https://img' }] } });
    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com' },
      {
        model: 'gpt-image-2',
        prompt: 'edit',
        images: [{ data: 'abc', mimeType: 'image/png' }],
        size: '1:1',
        resolution: '1K',
        count: 1,
      },
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/v1/images/edits'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
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
