import axios from 'axios';
import { generateImages } from './service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('image generation service cancellation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes one abort signal to every image request and settles them after cancellation', async () => {
    const abortController = new AbortController();
    const settled: number[] = [];
    const abortError = Object.assign(new Error('request cancelled'), { name: 'CanceledError' });
    mockedAxios.post.mockImplementation(
      (_url, _body, config) =>
        new Promise((_, reject) => {
          config?.signal?.addEventListener(
            'abort',
            () => {
              settled.push(settled.length);
              reject(abortError);
            },
            { once: true },
          );
        }),
    );

    const generation = generateImages(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      {
        model: 'gemini-3-pro-image-preview',
        prompt: 'cat',
        size: '1:1',
        resolution: '1K',
        count: 3,
      },
    );

    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    expect(mockedAxios.post.mock.calls.map(([, , config]) => config?.signal)).toEqual([
      abortController.signal,
      abortController.signal,
      abortController.signal,
    ]);

    abortController.abort();

    await expect(generation).rejects.toBe(abortError);
    expect(settled).toHaveLength(3);
  });
});
