/**
 * OpenAI Provider - Implementation for OpenAI-compatible models (GPT, etc.)
 * Standard OpenAI API format with system messages and temperature
 */

import {
  ChatOptions,
  UsageStats,
  ChatCompletionRequestBody,
  StreamChunkResponse,
} from '../types';
import { BaseProvider } from './BaseProvider';
import { fetchWithRetry, validateApiKey, API_BASE } from '../utils';

// ============================================================================
// OpenAI Provider Implementation
// ============================================================================

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';

  supportsModel(modelId: string): boolean {
    return modelId.includes('gpt');
  }

  /**
   * Stream chat completion with standard OpenAI format
   */
  async streamChat(options: ChatOptions): Promise<void> {
    const {
      apiKey,
      model,
      messages,
      attachments,
      userSystemPrompt,
      signal,
      onChunk,
      onComplete,
      onError,
      isWebSearchEnabled,
    } = options;

    try {
      validateApiKey(apiKey);

      // Build messages - buildApiMessages now handles ALL attachment types
      const systemContext = this.buildSystemContext(userSystemPrompt, model);
      const apiMessages = this.buildApiMessages(messages, systemContext);

      // Build request body with temperature (OpenAI supports it)
      // 提高输出限制到 16384，减少截断问题（GPT 模型限制通常较低）
      const requestBody: ChatCompletionRequestBody = {
        model: model,
        messages: apiMessages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.7,
        max_tokens: 16384,
      };

      // Note: Web search for OpenAI-compatible models via Aittco is not supported via tools
      // The tools parameter may cause the API to not respond

      // Send request
      const response = await fetchWithRetry(
        `${API_BASE}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      if (!response.body) throw new Error('No response body');

      // Stream response
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

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Process streaming response
   */
  private async processStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string) => void,
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
              if (text || reasoning) onChunk(reasoning + text);
            } catch {
              /* Ignore parse errors */
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

    onComplete(finalUsage);
  }
}
