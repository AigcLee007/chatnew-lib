import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../../lib/llm/utils';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return response on successful request', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      statusText: 'OK',
    });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await fetchWithRetry('https://api.test.com', {});

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately on 401 error without retry', async () => {
    const mockResponse = new Response('Unauthorized', {
      status: 401,
      statusText: 'Unauthorized',
    });
    mockFetch.mockResolvedValueOnce(mockResponse);

    await expect(fetchWithRetry('https://api.test.com', {})).rejects.toThrow(
      'API Key 无效或未授权 (401)',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
  });

  it('should throw immediately on 403 error without retry', async () => {
    const mockResponse = new Response('Forbidden', {
      status: 403,
      statusText: 'Forbidden',
    });
    mockFetch.mockResolvedValueOnce(mockResponse);

    await expect(fetchWithRetry('https://api.test.com', {})).rejects.toThrow(
      'API Key 没有权限访问此模型 (403)',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately on 404 error without retry', async () => {
    const mockResponse = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    });
    mockFetch.mockResolvedValueOnce(mockResponse);

    await expect(fetchWithRetry('https://api.test.com', {})).rejects.toThrow(
      '所选模型不存在或 API 端点错误 (404)',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately on 429 error without retry', async () => {
    const mockResponse = new Response('Too Many Requests', {
      status: 429,
      statusText: 'Too Many Requests',
    });
    mockFetch.mockResolvedValueOnce(mockResponse);

    await expect(fetchWithRetry('https://api.test.com', {})).rejects.toThrow(
      '账户余额不足或已达速率限制 (429)',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 500 server error', async () => {
    const error500Response = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
    const successResponse = new Response(JSON.stringify({ data: 'success' }), {
      status: 200,
      statusText: 'OK',
    });

    mockFetch.mockResolvedValueOnce(error500Response).mockResolvedValueOnce(successResponse);

    // Start the fetch
    const fetchPromise = fetchWithRetry('https://api.test.com', {}, 2, 100);

    // Fast-forward through the delay
    await vi.advanceTimersByTimeAsync(150);

    const result = await fetchPromise;

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 503 server error', async () => {
    const error503Response = new Response('Service Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    const successResponse = new Response(JSON.stringify({ data: 'success' }), {
      status: 200,
      statusText: 'OK',
    });

    mockFetch.mockResolvedValueOnce(error503Response).mockResolvedValueOnce(successResponse);

    const fetchPromise = fetchWithRetry('https://api.test.com', {}, 2, 100);
    await vi.advanceTimersByTimeAsync(150);

    const result = await fetchPromise;

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries and throw on persistent 500 errors', async () => {
    const createError500Response = () =>
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

    mockFetch
      .mockResolvedValueOnce(createError500Response())
      .mockResolvedValueOnce(createError500Response())
      .mockResolvedValueOnce(createError500Response());

    // Use a try-catch pattern to properly handle the rejection
    let caughtError: Error | null = null;

    const fetchPromise = fetchWithRetry('https://api.test.com', {}, 2, 100);

    // Attach error handler immediately to prevent unhandled rejection
    fetchPromise.catch((err) => {
      caughtError = err;
    });

    // Advance through all retry delays (100ms + 150ms = 250ms, add buffer)
    await vi.advanceTimersByTimeAsync(300);

    // Wait for the promise to settle
    await vi.runAllTimersAsync();

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('服务器内部错误: 500');
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should pass through AbortError without retry', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(fetchWithRetry('https://api.test.com', {})).rejects.toThrow('Aborted');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const networkError = new Error('Network error');
    const successResponse = new Response(JSON.stringify({ data: 'success' }), {
      status: 200,
      statusText: 'OK',
    });

    mockFetch.mockRejectedValueOnce(networkError).mockResolvedValueOnce(successResponse);

    const fetchPromise = fetchWithRetry('https://api.test.com', {}, 2, 100);
    await vi.advanceTimersByTimeAsync(150);

    const result = await fetchPromise;

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff for delays', async () => {
    const error500Response = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
    const successResponse = new Response(JSON.stringify({ data: 'success' }), {
      status: 200,
      statusText: 'OK',
    });

    mockFetch
      .mockResolvedValueOnce(error500Response)
      .mockResolvedValueOnce(error500Response)
      .mockResolvedValueOnce(successResponse);

    const fetchPromise = fetchWithRetry('https://api.test.com', {}, 3, 100);

    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second retry after 150ms (100 * 1.5)
    await vi.advanceTimersByTimeAsync(150);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const result = await fetchPromise;
    expect(result.status).toBe(200);
  });
});

// ============================================================================
// LLM Factory Tests
// ============================================================================

describe('LLMFactory', () => {
  it('should return GeminiNativeProvider for gemini-3 models', async () => {
    const { LLMFactory } = await import('../../lib/llm');
    
    // GeminiNativeProvider has priority for gemini-3-* models
    const provider = LLMFactory.getProvider('gemini-3-pro-preview');
    expect(provider.name).toBe('GeminiNative');
    expect(provider.supportsModel('gemini-3-pro-preview')).toBe(true);
  });

  it('should return GeminiProvider for gemini-2.5 image model', async () => {
    const { LLMFactory } = await import('../../lib/llm');
    
    // GeminiProvider handles image generation models
    const provider = LLMFactory.getProvider('gemini-2.5-flash-image');
    expect(provider.name).toBe('Gemini');
    expect(provider.supportsModel('gemini-2.5-flash-image')).toBe(true);
  });

  it('should return OpenAIProvider for gpt models', async () => {
    const { LLMFactory } = await import('../../lib/llm');
    
    const provider = LLMFactory.getProvider('gpt-5.2-all');
    expect(provider.name).toBe('OpenAI');
    expect(provider.supportsModel('gpt-5.2-all')).toBe(true);
  });

  it('should return GrokProvider for grok models', async () => {
    const { LLMFactory } = await import('../../lib/llm');

    const provider = LLMFactory.getProvider('grok-4.6');
    expect(provider.name).toBe('Grok');
    expect(provider.supportsModel('grok-4.6')).toBe(true);
  });

  it('should return GeminiProvider as default for unknown models', async () => {
    const { LLMFactory } = await import('../../lib/llm');
    
    const provider = LLMFactory.getProvider('unknown-model');
    expect(provider.name).toBe('Gemini'); // Default fallback
  });
});

// ============================================================================
// Provider Tests
// ============================================================================

describe('GeminiProvider', () => {
  it('should support gemini models', async () => {
    const { GeminiProvider } = await import('../../lib/llm');
    
    const provider = new GeminiProvider();
    expect(provider.supportsModel('gemini-3-pro-preview')).toBe(true);
    expect(provider.supportsModel('gemini-2.5-flash-image')).toBe(true);
    expect(provider.supportsModel('gpt-4')).toBe(false);
  });

  it('should have generateImage method', async () => {
    const { GeminiProvider } = await import('../../lib/llm');
    
    const provider = new GeminiProvider();
    expect(provider.generateImage).toBeDefined();
  });
});

describe('OpenAIProvider', () => {
  it('should support gpt models', async () => {
    const { OpenAIProvider } = await import('../../lib/llm');
    
    const provider = new OpenAIProvider();
    expect(provider.supportsModel('gpt-5.2-all')).toBe(true);
    expect(provider.supportsModel('gpt-5.2-thinking')).toBe(true);
    expect(provider.supportsModel('gemini-3-pro')).toBe(false);
  });

  it('should not have generateImage method', async () => {
    const { OpenAIProvider } = await import('../../lib/llm');
    
    const provider = new OpenAIProvider();
    expect(provider.generateImage).toBeUndefined();
  });
});
