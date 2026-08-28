import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../../lib/llm/providers/OpenAIProvider';
import type { ChatOptions } from '../../../lib/llm/types';
import type { Message, ModelId } from '../../../types';

const encoder = new TextEncoder();

const createSseResponse = (events: unknown[]): Response => {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
};

const createOptions = (overrides: Partial<ChatOptions> = {}): ChatOptions => {
  const messages: Message[] = [
    {
      id: 'system-1',
      sessionId: 'session-1',
      role: 'system',
      content: 'Keep the session constraint.',
      timestamp: 0,
    },
    {
      id: 'user-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'Analyze this image',
      timestamp: 1,
      attachments: [
        {
          id: 'image-1',
          name: 'diagram.png',
          type: 'image',
          content: 'data:image/png;base64,AAAA',
        },
      ],
    },
  ];

  return {
    apiKey: 'sk-test-key',
    model: 'gpt-5.6-sol' as ModelId,
    messages,
    attachments: [],
    userSystemPrompt: 'Be precise.',
    signal: new AbortController().signal,
    onChunk: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
};

describe('OpenAIProvider Responses API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends GPT chat models to /v1/responses with Responses input content', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([{ type: 'response.completed', response: { usage: {} } }])
    );
    const options = createOptions();

    await new OpenAIProvider().streamChat(options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));

    expect(url).toBe('https://api.aittco.com/v1/responses');
    expect(body).toMatchObject({
      model: 'gpt-5.6-sol',
      stream: true,
      max_output_tokens: 8192,
    });
    expect(body).not.toHaveProperty('messages');
    expect(body.instructions).toContain('Be precise.');
    expect(body.instructions).toContain('Keep the session constraint.');
    expect(body.input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Analyze this image' },
          { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
        ],
      },
    ]);
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('streams text and reasoning deltas and reports Responses usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        { type: 'response.reasoning_text.delta', delta: 'Reasoning' },
        { type: 'response.reasoning_summary_text.delta', delta: ' summary' },
        { type: 'response.output_text.delta', delta: 'Answer' },
        {
          type: 'response.completed',
          response: {
            usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
          },
        },
      ])
    );
    const options = createOptions();

    await new OpenAIProvider().streamChat(options);

    expect(options.onChunk).toHaveBeenNthCalledWith(1, 'Reasoning', true);
    expect(options.onChunk).toHaveBeenNthCalledWith(2, ' summary', true);
    expect(options.onChunk).toHaveBeenNthCalledWith(3, 'Answer', false);
    expect(options.onComplete).toHaveBeenCalledWith({
      prompt_tokens: 12,
      completion_tokens: 8,
      total_tokens: 20,
    });
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('surfaces a Responses failure event through onError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        {
          type: 'response.failed',
          response: { error: { message: 'Upstream response failed' } },
        },
      ])
    );
    const options = createOptions();

    await new OpenAIProvider().streamChat(options);

    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Upstream response failed' }));
    expect(options.onChunk).not.toHaveBeenCalled();
    expect(options.onComplete).not.toHaveBeenCalled();
  });

  it('forwards an abort signal when generating an image', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ images: ['data:image/png;base64,AAAA'] }), { status: 200 })
    );
    const controller = new AbortController();

    await new OpenAIProvider().generateImage({
      apiKey: 'sk-test-key',
      prompt: 'A small cat',
      model: 'gpt-image-2',
      signal: controller.signal,
    } as any);

    const [, request] = fetchMock.mock.calls[0];
    expect(request?.signal).toBe(controller.signal);
  });
});
