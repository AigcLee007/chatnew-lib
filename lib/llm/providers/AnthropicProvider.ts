/**
 * Anthropic Provider - Implementation for Claude Messages API routes.
 */

import { Message } from '../../../types';
import { ChatOptions, UsageStats } from '../types';
import { API_BASE, fetchWithRetry, validateApiKey } from '../utils';
import { BaseProvider } from './BaseProvider';

type AnthropicTextPart = { type: 'text'; text: string };
type AnthropicImagePart = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};
type AnthropicContentPart = AnthropicTextPart | AnthropicImagePart;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentPart[];
}

interface AnthropicStreamEvent {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
  };
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export class AnthropicProvider extends BaseProvider {
  readonly name = 'Anthropic';

  supportsModel(modelId: string): boolean {
    return modelId.includes('claude');
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

      const system = this.buildSystemContext(userSystemPrompt, model);
      const body = {
        model,
        system,
        messages: this.buildAnthropicMessages(messages),
        stream: true,
        max_tokens: 8192,
        temperature: 0.7,
      };

      const response = await fetchWithRetry(
        `${API_BASE}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal,
        },
        1
      );

      if (!response.body) throw new Error('No response body');
      await this.processAnthropicStream(response.body, onChunk, onComplete);
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

  private buildAnthropicMessages(messages: Message[]): AnthropicMessage[] {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        const textAttachments =
          message.attachments?.filter((att) => att.type !== 'image' && att.included !== false) || [];
        const imageAttachments =
          message.attachments?.filter((att) => att.type === 'image' && att.included !== false) || [];

        let text = message.content || '';
        textAttachments.forEach((att) => {
          if (att.content) {
            text += `\n---\nFILE: ${att.name}\nCONTENT:\n${att.content}\n---`;
          }
        });

        if (message.role === 'user' && imageAttachments.length > 0) {
          const content: AnthropicContentPart[] = [{ type: 'text', text: text || ' ' }];
          imageAttachments.forEach((att) => {
            const parsed = this.parseDataImage(att.content);
            if (!parsed) return;
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: parsed.mimeType,
                data: parsed.base64,
              },
            });
          });
          return { role: 'user', content };
        }

        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: text || ' ',
        };
      });
  }

  private parseDataImage(value: string): { mimeType: string; base64: string } | null {
    const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mimeType: match[1],
      base64: match[2].replace(/\s+/g, ''),
    };
  }

  private async processAnthropicStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string, isThinking?: boolean) => void,
    onComplete: (usage?: UsageStats) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalUsage: UsageStats | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (!dataStr || dataStr === '[DONE]') continue;

        let json: AnthropicStreamEvent;
        try {
          json = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (json.error?.message) throw new Error(json.error.message);

        const inputTokens = json.message?.usage?.input_tokens ?? json.usage?.input_tokens;
        const outputTokens = json.message?.usage?.output_tokens ?? json.usage?.output_tokens;
        if (inputTokens !== undefined || outputTokens !== undefined) {
          finalUsage = {
            prompt_tokens: inputTokens || 0,
            completion_tokens: outputTokens || 0,
            total_tokens: (inputTokens || 0) + (outputTokens || 0),
          };
        }

        const text = json.delta?.text || '';
        const thinking = json.delta?.thinking || '';
        if (thinking) onChunk(thinking, true);
        if (text) onChunk(text, false);
      }
    }

    onComplete(finalUsage);
  }
}
