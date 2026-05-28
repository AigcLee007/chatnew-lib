/**
 * OpenAI Provider - Implementation for OpenAI-compatible models (GPT, etc.)
 */

import {
  ChatOptions,
  ImageGenerationOptions,
  UsageStats,
  ChatCompletionRequestBody,
  StreamChunkResponse,
} from '../types';
import { BaseProvider } from './BaseProvider';
import { fetchWithRetry, validateApiKey, API_BASE } from '../utils';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';

  supportsModel(modelId: string): boolean {
    return modelId.includes('gpt');
  }

  async generateImage(options: ImageGenerationOptions) {
    const { apiKey, prompt, model = 'gpt-image-2', attachments = [], params } = options;

    validateApiKey(apiKey);

    const response = await fetch('/api/image/generate-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

      const primaryBody: ChatCompletionRequestBody = {
        model,
        messages: apiMessages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.7,
        // Keep conservative for compatibility across relay routes.
        max_tokens: 8192,
      };

      let response: Response;
      try {
        response = await this.sendRequest(apiKey, primaryBody, signal);
      } catch (primaryErr) {
        if (!this.shouldRetryWithCompatibilityPayload(primaryErr)) {
          throw primaryErr;
        }

        // Some keys/routes reject stream_options or max_tokens and return 5xx.
        const fallbackBody: ChatCompletionRequestBody = {
          model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
        };

        response = await this.sendRequest(apiKey, fallbackBody, signal, 1);
      }

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
    body: ChatCompletionRequestBody,
    signal?: AbortSignal,
    retries = 2
  ): Promise<Response> {
    return fetchWithRetry(
      `${API_BASE}/chat/completions`,
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

  private shouldRetryWithCompatibilityPayload(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg) return false;

    const isServerError = /\b5\d{2}\b/.test(msg);
    const mightBeCompatibilityIssue =
      msg.includes('stream_options') ||
      msg.includes('max_tokens') ||
      msg.includes('unsupported') ||
      msg.includes('invalid_request');

    return isServerError || mightBeCompatibilityIssue;
  }

  private async processStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string, isThinking?: boolean) => void,
    onComplete: (usage?: UsageStats) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let finalUsage: UsageStats | undefined;
    let buffer = '';

    while (!done) {
      try {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const json: StreamChunkResponse = JSON.parse(dataStr);

              if (json.usage) {
                finalUsage = {
                  prompt_tokens: json.usage.prompt_tokens || 0,
                  completion_tokens: json.usage.completion_tokens || 0,
                  total_tokens: json.usage.total_tokens || 0,
                };
              }

              const delta = json.choices?.[0]?.delta;
              const text = delta?.content || '';
              const reasoning = delta?.reasoning_content || '';
              if (reasoning) onChunk(reasoning, true);
              if (text) onChunk(text, false);
            } catch {
              // Ignore malformed chunk.
            }
          }
        }
      } catch (readError: unknown) {
        const error = readError as Error & { name?: string };
        if (error.name === 'AbortError') throw readError;
        onChunk('\n\n**[网络中断]**');
        throw readError;
      }
    }

    // Flush tail chunk in case stream doesn't end with '\n'.
    const tail = buffer.trim();
    if (tail.startsWith('data: ')) {
      const dataStr = tail.replace('data: ', '').trim();
      if (dataStr && dataStr !== '[DONE]') {
        try {
          const json: StreamChunkResponse = JSON.parse(dataStr);
          if (json.usage) {
            finalUsage = {
              prompt_tokens: json.usage.prompt_tokens || 0,
              completion_tokens: json.usage.completion_tokens || 0,
              total_tokens: json.usage.total_tokens || 0,
            };
          }
          const delta = json.choices?.[0]?.delta;
          const text = delta?.content || '';
          const reasoning = delta?.reasoning_content || '';
          if (reasoning) onChunk(reasoning, true);
          if (text) onChunk(text, false);
        } catch {
          // Ignore malformed tail chunk.
        }
      }
    }

    onComplete(finalUsage);
  }
}
