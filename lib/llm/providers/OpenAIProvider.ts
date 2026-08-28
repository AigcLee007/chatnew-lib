/**
 * OpenAI Provider - Implementation for OpenAI-compatible models (GPT, etc.)
 */

import {
  ChatOptions,
  ImageGenerationOptions,
  UsageStats,
  ApiMessage,
  ResponseInputMessage,
  ResponsesRequestBody,
  ResponsesStreamEvent,
  ResponsesUsage,
} from '../types';
import { BaseProvider } from './BaseProvider';
import { fetchWithRetry, validateApiKey, API_BASE } from '../utils';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';

  supportsModel(modelId: string): boolean {
    return modelId.includes('gpt');
  }

  async generateImage(options: ImageGenerationOptions) {
    const { apiKey, prompt, model = 'gpt-image-2', attachments = [], params, signal } = options;

    validateApiKey(apiKey);

    const response = await fetch('/api/image/generate-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        apiKey,
        model,
        prompt,
        attachments,
        size: params?.size ?? 'auto',
        aspectRatio: params?.aspectRatio ?? 'auto',
        quality: params?.quality ?? 'auto',
        outputFormat: params?.outputFormat ?? 'png',
        outputCompression: params?.outputCompression ?? null,
        moderation: params?.moderation ?? 'auto',
        n: 1,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `图片生成请求失败 (${response.status})`);
    }

    if (!Array.isArray(data?.images) || data.images.length === 0) {
      throw new Error('生图接口返回异常，未找到图片数据。');
    }

    return {
      images: data.images,
      revisedPrompt: data.revisedPrompt,
      size: data.size,
      aspectRatio: data.aspectRatio,
    };
  }

  async streamChat(options: ChatOptions): Promise<void> {
    const {
      apiKey,
      model,
      messages,
      userSystemPrompt,
      signal,
      onChunk,
      onComplete,
      onError,
    } = options;

    try {
      validateApiKey(apiKey);

      const systemContext = this.buildSystemContext(userSystemPrompt, model);
      const apiMessages = this.buildApiMessages(messages, systemContext);

      const body: ResponsesRequestBody = {
        model,
        instructions: this.buildResponsesInstructions(apiMessages),
        input: this.buildResponsesInput(apiMessages),
        stream: true,
        max_output_tokens: 8192,
      };

      const response = await this.sendRequest(apiKey, body, signal);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) throw new Error('No response body');

      await this.processStream(response.body, onChunk, onComplete);
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name === 'AbortError') {
        onChunk('\n\n**[已停止]**');
        onComplete();
        return;
      }
      onError(error as Error);
    }
  }

  private async sendRequest(
    apiKey: string,
    body: ResponsesRequestBody,
    signal?: AbortSignal,
    retries = 2
  ): Promise<Response> {
    return fetchWithRetry(
      `${API_BASE}/responses`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      },
      retries
    );
  }

  private buildResponsesInput(apiMessages: ApiMessage[]): ResponseInputMessage[] {
    return apiMessages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: Array.isArray(message.content)
          ? message.content.map((part) =>
              part.type === 'text'
                ? { type: 'input_text' as const, text: part.text }
                : { type: 'input_image' as const, image_url: part.image_url.url }
            )
          : message.content,
      }));
  }

  private buildResponsesInstructions(apiMessages: ApiMessage[]): string {
    return apiMessages
      .filter((message) => message.role === 'system')
      .map((message) =>
        Array.isArray(message.content)
          ? message.content
              .filter((part) => part.type === 'text')
              .map((part) => part.text)
              .join('\n')
          : message.content
      )
      .filter(Boolean)
      .join('\n\n');
  }

  private toUsageStats(usage?: ResponsesUsage): UsageStats | undefined {
    if (!usage) return undefined;
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: usage.total_tokens ?? promptTokens + completionTokens,
    };
  }

  private processEvent(
    event: ResponsesStreamEvent,
    onChunk: (chunk: string, isThinking?: boolean) => void
  ): UsageStats | undefined {
    if (event.type === 'response.output_text.delta' && event.delta) {
      onChunk(event.delta, false);
    }

    if (
      (event.type === 'response.reasoning_text.delta' ||
        event.type === 'response.reasoning_summary_text.delta') &&
      event.delta
    ) {
      onChunk(event.delta, true);
    }

    if (event.type === 'error' || event.type === 'response.failed') {
      throw new Error(
        event.message || event.error?.message || event.response?.error?.message || 'Responses API request failed'
      );
    }

    if (event.type === 'response.incomplete') {
      throw new Error(
        event.response?.incomplete_details?.reason || 'Responses API returned an incomplete response'
      );
    }

    return this.toUsageStats(event.response?.usage || event.usage);
  }

  private async processStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string, isThinking?: boolean) => void,
    onComplete: (usage?: UsageStats) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let finalUsage: UsageStats | undefined;
    let buffer = '';

    while (true) {
      let value: Uint8Array | undefined;
      let done = false;
      try {
        ({ value, done } = await reader.read());
      } catch (readError: unknown) {
        const error = readError as Error & { name?: string };
        if (error.name === 'AbortError') throw readError;
        onChunk('\n\n**[网络中断]**');
        throw readError;
      }

      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const dataStr = line.replace(/^data:\s*/, '').trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const usage = this.processEvent(JSON.parse(dataStr), onChunk);
          if (usage) finalUsage = usage;
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }

    // Flush tail chunk in case stream doesn't end with '\n'.
    const tail = buffer.trim();
    if (tail.startsWith('data: ')) {
      const dataStr = tail.replace('data: ', '').trim();
      if (dataStr && dataStr !== '[DONE]') {
        try {
          const usage = this.processEvent(JSON.parse(dataStr), onChunk);
          if (usage) finalUsage = usage;
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      }
    }

    onComplete(finalUsage);
  }
}
