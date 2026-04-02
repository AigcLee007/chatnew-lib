/**
 * GeminiNative Provider - Implementation for Google Gemini Native API
 * Uses Google's generativelanguage API directly for Gemini-specific features
 * Supports native web search via googleSearch tool
 */

import { ChatOptions, UsageStats } from '../types';
import { BaseProvider } from './BaseProvider';
import { validateApiKey } from '../utils';

// ============================================================================
// Gemini Native API Types
// ============================================================================

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiTool {
  googleSearch?: Record<string, never>;
}

interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  tools?: GeminiTool[];
}

interface GeminiStreamPart {
  text?: string;
  thought?: string;
}

interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
  webSearchQueries?: string[];
}

interface GeminiStreamCandidate {
  content?: {
    parts?: GeminiStreamPart[];
  };
  groundingMetadata?: GeminiGroundingMetadata;
}

interface GeminiStreamResponse {
  candidates?: GeminiStreamCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// ============================================================================
// GeminiNative Provider Implementation
// ============================================================================

export class GeminiNativeProvider extends BaseProvider {
  readonly name = 'GeminiNative';

  /**
   * Check if this provider supports the given model
   * Supports Gemini models using native Gemini API
   */
  supportsModel(modelId: string): boolean {
    return [
      'gemini-3.1-pro-preview', 
      'gemini-3.1-flash-preview'
    ].includes(modelId);
  }

  /**
   * Stream chat completion using Google's native Gemini API
   */
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
      isWebSearchEnabled,
    } = options;

    try {
      validateApiKey(apiKey);

      // --- 模型 ID 映射 ---
      let apiModel = model as string;
      if (model === 'gemini-3.1-flash-preview' as any) {
        apiModel = 'gemini-3.1-flash-lite-preview';
      }
      // 0. 清洗历史消息，确保以 user 结尾
      // ========================================================================
      let validMessages = [...messages];
      while (validMessages.length > 0 && validMessages[validMessages.length - 1].role !== 'user') {
        validMessages.pop();
      }

      // ========================================================================
      // 1. 提取 System Prompt
      // ========================================================================
      const systemMessages = validMessages.filter(m => m.role === 'system');
      const systemFromMessages = systemMessages.map(m => m.content).join('\n\n');
      const systemContext = this.buildSystemContext(userSystemPrompt, model);
      const fullSystemPrompt = [systemContext, systemFromMessages].filter(Boolean).join('\n\n');

      // ========================================================================
      // 2. 过滤出对话历史 (User & Assistant)
      // ========================================================================
      let conversationMessages = validMessages.filter(m => m.role !== 'system');

      // ========================================================================
      // 3. 将 System Prompt 注入到第一条 User 消息中
      // ========================================================================
      if (fullSystemPrompt && conversationMessages.length > 0) {
        const firstMsg = conversationMessages[0];
        if (firstMsg.role === 'user') {
          conversationMessages[0] = {
            ...firstMsg,
            content: `[System Instructions]\n${fullSystemPrompt}\n\n[User Request]\n${firstMsg.content}`
          };
        } else {
          conversationMessages.unshift({
            id: 'system-inject',
            sessionId: firstMsg.sessionId,
            role: 'user',
            content: `[System Instructions]\n${fullSystemPrompt}`,
            timestamp: Date.now()
          });
        }
      } else if (fullSystemPrompt) {
        conversationMessages = [{
          id: 'system-only',
          sessionId: '',
          role: 'user',
          content: fullSystemPrompt,
          timestamp: Date.now()
        }];
      }

      // ========================================================================
      // 4. 转换为 Gemini 格式
      // ========================================================================
      const contents: GeminiContent[] = conversationMessages
        .map(msg => {
          const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';
          const parts: GeminiPart[] = [];

          let textContent = msg.content || '';

          // Handle text attachments
          const textAttachments =
            msg.attachments?.filter((a) => a.type !== 'image' && a.included !== false) || [];
          textAttachments.forEach((att) => {
            if (att.content) {
              textContent += `\n---\nFILE: ${att.name}\nCONTENT:\n${att.content}\n---`;
            }
          });

          if (!textContent.trim() && role === 'model') {
            textContent = '[Previous response]';
          }

          if (textContent.trim()) {
            parts.push({ text: textContent });
          }

          // Handle image attachments (only for user messages)
          if (msg.role === 'user') {
            const imageAttachments =
              msg.attachments?.filter((a) => a.type === 'image' && a.included !== false) || [];
            imageAttachments.forEach((att) => {
              if (att.content && att.content.includes('base64,')) {
                const base64Data = att.content.split('base64,')[1];
                parts.push({
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Data,
                  },
                });
              }
            });
          }

          return { role, parts };
        })
        .filter(c => c.parts.length > 0);
      
      // ========================================================================
      // 5. 验证消息
      // ========================================================================
      if (contents.length === 0) {
        throw new Error('No valid messages to send');
      }
      
      if (contents[0].role !== 'user') {
        // First content is not user, this may cause 400 error
      }
      
      for (let i = 1; i < contents.length; i++) {
        if (contents[i].role === contents[i - 1].role) {
          // Consecutive same-role messages detected
        }
      }

      // Build generation config
      const generationConfig: GeminiGenerationConfig = {
        temperature: 0.7,
        maxOutputTokens: 24576,  // 约 24K tokens
      };

      // Build request body
      const requestBody: GeminiRequestBody = {
        contents,
        generationConfig,
      };

      // Add web search tool if enabled
      if (isWebSearchEnabled) {
        requestBody.tools = [{ googleSearch: {} }];
      }

      // Enable thinking for gemini-3.1-pro-preview
      const isProModel = model === ('gemini-3.1-pro-preview' as any);
      if (isProModel) {
        // Pro 模型启用思考模式
        (requestBody as any).generationConfig = {
          ...generationConfig,
          maxOutputTokens: 24576,  // 约 24K tokens
          thinking_config: {
            thinking_budget: 8192
          }
        };
      }

      // Build URL
      const url = `https://api.aittco.com/v1beta/models/${apiModel}:streamGenerateContent?key=${apiKey}&alt=sse`;



      // Send request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 请求失败: ${response.status} - ${errorText.slice(0, 500)}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process SSE stream
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

  /**
   * Process SSE streaming response from Gemini API
   */
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
    let groundingSources: Array<{ title: string; uri: string }> = [];

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
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const json: GeminiStreamResponse = JSON.parse(dataStr);

              // Extract grounding metadata (web search results)
              const groundingMetadata = json.candidates?.[0]?.groundingMetadata;
              if (groundingMetadata?.groundingChunks) {
                for (const chunk of groundingMetadata.groundingChunks) {
                  if (chunk.web?.uri && chunk.web?.title) {
                    const exists = groundingSources.some(s => s.uri === chunk.web?.uri);
                    if (!exists) {
                      groundingSources.push({
                        title: chunk.web.title,
                        uri: chunk.web.uri
                      });
                    }
                  }
                }
              }

              // Extract text and thinking from parts
              const parts = json.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                // Handle thinking content
                if (part.thought) {
                  onChunk(part.thought, true);
                }
                // Handle regular text
                if (part.text) {
                  onChunk(part.text, false);
                }
              }

              // Extract usage metadata
              if (json.usageMetadata) {
                finalUsage = {
                  prompt_tokens: json.usageMetadata.promptTokenCount || 0,
                  completion_tokens: json.usageMetadata.candidatesTokenCount || 0,
                  total_tokens: json.usageMetadata.totalTokenCount || 0,
                };
              }
            } catch {
              /* Ignore parse errors */
            }
          }
        }
      } catch (readError: unknown) {
        const error = readError as Error & { name?: string };
        if (error.name === 'AbortError') throw readError;
        onChunk('\n\n**[网络中断]**', false);
        throw readError;
      }
    }

    // 如果有搜索来源，在回复末尾添加引用
    if (groundingSources.length > 0) {
      let sourcesText = '\n\n---\n**📚 参考来源：**\n';
      groundingSources.forEach((source, index) => {
        sourcesText += `${index + 1}. [${source.title}](${source.uri})\n`;
      });
      onChunk(sourcesText, false);
    }

    onComplete(finalUsage);
  }
}
