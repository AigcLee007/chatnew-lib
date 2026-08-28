import { ChatCompletionRequestBody, ChatOptions, StreamChunkResponse, UsageStats } from '../types';
import { BaseProvider } from './BaseProvider';
import { API_BASE, fetchWithRetry, validateApiKey } from '../utils';

/** xAI Grok models use the OpenAI-compatible Chat Completions protocol. */
export class GrokProvider extends BaseProvider {
  readonly name = 'Grok';

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('grok-');
  }

  async streamChat(options: ChatOptions): Promise<void> {
    const { apiKey, model, messages, userSystemPrompt, signal, onChunk, onComplete, onError } = options;

    try {
      validateApiKey(apiKey);

      const requestBody: ChatCompletionRequestBody = {
        model,
        messages: this.buildApiMessages(messages, this.buildSystemContext(userSystemPrompt, model)),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 32768,
      };

      const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.body) throw new Error('No response body');
      await this.processStream(response.body, onChunk, onComplete);
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      if (err.name === 'AbortError') {
        onChunk('\n\n**[已停止]**');
        onComplete();
        return;
      }
      onError(err);
    }
  }

  private async processStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string, isThinking?: boolean) => void,
    onComplete: (usage?: UsageStats) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalUsage: UsageStats | undefined;

    const processData = (data: string) => {
      if (!data || data === '[DONE]') return;
      const chunk: StreamChunkResponse = JSON.parse(data);
      if (chunk.usage) finalUsage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.reasoning_content) onChunk(delta.reasoning_content, true);
      if (delta?.content) onChunk(delta.content, false);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        processData(line.replace(/^data:\s*/, '').trim());
      }
    }

    const tail = buffer.trim();
    if (tail.startsWith('data:')) processData(tail.replace(/^data:\s*/, '').trim());
    onComplete(finalUsage);
  }
}
