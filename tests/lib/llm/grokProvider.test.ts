import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrokProvider } from '../../../lib/llm/providers/GrokProvider';
import type { ChatOptions } from '../../../lib/llm/types';
import type { ModelId } from '../../../types';

const createOptions = (): ChatOptions => ({
  apiKey: 'sk-test-key',
  model: 'grok-4.6' as ModelId,
  messages: [
    { id: 'user-1', sessionId: 'session-1', role: 'user', content: 'Hello Grok', timestamp: 0 },
  ],
  attachments: [],
  userSystemPrompt: '',
  signal: new AbortController().signal,
  onChunk: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
});

describe('GrokProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends Grok requests through Chat Completions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );
    const options = createOptions();

    await new GrokProvider().streamChat(options);

    const [url, request] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(url).toBe('https://api.aittco.com/v1/chat/completions');
    expect(body).toMatchObject({
      model: 'grok-4.6',
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 32768,
    });
    expect(body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'Hello Grok' }),
    ]));
    expect(options.onError).not.toHaveBeenCalled();
  });
});
