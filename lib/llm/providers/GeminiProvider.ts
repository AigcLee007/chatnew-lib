/**
 * Gemini Provider - Implementation for Google Gemini models
 * Handles Gemini-specific compatibility (no system role, no temperature)
 */

import { Attachment } from '../../../types';
import {
  ChatOptions,
  ImageGenerationOptions,
  UsageStats,
  ChatCompletionRequestBody,
  StreamChunkResponse,
} from '../types';
import { BaseProvider } from './BaseProvider';
import { fetchWithRetry, validateApiKey, API_BASE } from '../utils';

// ============================================================================
// Gemini-specific Types
// ============================================================================

interface GeminiInlineData {
  mime_type: string;
  data: string;
}

interface GeminiContentPart {
  text?: string;
  inline_data?: GeminiInlineData;
}

interface GeminiContent {
  parts: GeminiContentPart[];
}

interface GeminiImageConfig {
  aspectRatio: string;
}

interface GeminiGenerationConfig {
  responseModalities: string[];
  imageConfig: GeminiImageConfig;
}

interface GeminiImagePayload {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data: string;
        };
      }>;
    };
  }>;
}

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

export class GeminiProvider extends BaseProvider {
  readonly name = 'Gemini';

  supportsModel(modelId: string): boolean {
    return modelId.includes('gemini');
  }

  /**
   * Stream chat completion with Gemini compatibility
   */
  async streamChat(options: ChatOptions): Promise<void> {
    const {
      apiKey,
      model,
      messages,
      // Note: attachments are already handled by buildApiMessages in BaseProvider
      // Text files are concatenated to message content, images are added as content parts
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

      // ⚡️ [优化] 移除手动兼容，直接使用标准格式，由中转站处理协议转换
      // const finalMessages = this.applyGeminiCompatibility(apiMessages);
      const finalMessages = apiMessages;

      // --- 模型 ID 映射 ---
      const apiModel = model as string;

      // Build request body (no temperature for Gemini)
      // 提高输出限制到 32768，减少截断问题
      const requestBody: ChatCompletionRequestBody = {
        model: apiModel,
        messages: finalMessages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 32768,
      };

      // Note: Web search for OpenAI-compatible Gemini models is not supported via tools
      // Use GeminiNativeProvider (-v suffix models) for native web search support

      // 🕵️‍♂️【抓包调试 - 任务批次 1/3】打印发送给 API 的真实内容
      console.group('🔍 Gemini API Request Inspection');
      
      // 1. Total Body Length
      const fullJson = JSON.stringify(requestBody);
      console.log(`📦 Total Body Length: ${fullJson.length} chars`);
      
      // 2. Messages Count
      console.log(`📨 Messages Count: ${requestBody.messages.length}`);
      
      // 3. Messages Preview - 遍历每条消息，打印角色和内容前100字符
      console.group('📝 Messages Preview:');
      let duplicateContextCount = 0;
      const contextPattern = /\[System: Context from file/g;
      
      requestBody.messages.forEach((msg, index) => {
        const contentStr = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        const preview = contentStr.slice(0, 100);
        const contentLength = contentStr.length;
        
        console.log(`  [${index}] Role: ${msg.role} | Length: ${contentLength} | Preview: ${preview}${contentLength > 100 ? '...' : ''}`);
        
        // 特别检查：是否有重复的 [System: Context from file...] 文本
        const matches = contentStr.match(contextPattern);
        if (matches && matches.length > 0) {
          console.warn(`    ⚠️ 发现 ${matches.length} 处 "[System: Context from file...]" 文本`);
          duplicateContextCount += matches.length;
        }
      });
      console.groupEnd();
      
      // 4. 汇总检查结果
      if (duplicateContextCount > 1) {
        console.error(`🚨 警告：检测到 ${duplicateContextCount} 处重复的 "[System: Context from file...]" 文本！可能存在 Token 爆炸问题！`);
      }
      
      if (fullJson.length > 10000) {
        console.error('🚨 Payload 过大（>10000字符），怀疑包含未清除的历史记录或文件！');
      }
      
      console.groupEnd();

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
        onComplete(undefined, undefined);
        return;
      }
      onError(error as Error);
    }
  }

  /**
   * Generate image using Gemini's native API
   */
  async generateImage(options: ImageGenerationOptions) {
    const { apiKey, prompt, model = 'gemini-2.5-flash-image', attachments = [] } = options;

    try {
      validateApiKey(apiKey);

      // Build URL for Gemini v1beta endpoint
      const baseUrl = API_BASE.replace(/\/v1\/?$/, '');
      const targetUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Build payload
      const payload: GeminiImagePayload = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
          },
        },
      };

      // Handle image-to-image
      this.addImageAttachments(payload, attachments);

      const response = await fetchWithRetry(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`生图请求失败 (${response.status}): ${errText.slice(0, 100)}...`);
      }

      const data: GeminiImageResponse = await response.json();

      // Extract base64 image
      const b64Image = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64Image) {
        console.error('API Response:', data);
        throw new Error('API 返回的数据格式异常，未找到图片数据');
      }

      return {
        images: [`data:image/png;base64,${b64Image}`],
      };
    } catch (err: unknown) {
      console.error('Image Gen Error:', err);
      throw err;
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
                // 📉【监控 API 返回的 Usage 数据】证明 Token 数值来自 API 而非前端计算
                console.log('📉 API Response Usage:', json.usage);
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

    onComplete(finalUsage, undefined);
  }

  /**
   * Add image attachments to Gemini payload
   */
  private addImageAttachments(payload: GeminiImagePayload, attachments: Attachment[]): void {
    const inputImages = attachments.filter((a) => a.type === 'image');
    if (inputImages.length > 0) {
      inputImages.forEach((img) => {
        if (img.content && img.content.includes('base64,')) {
          const base64Data = img.content.split('base64,')[1];
          payload.contents[0].parts.push({
            inline_data: {
              mime_type: 'image/png',
              data: base64Data,
            },
          });
        }
      });
    }
  }
}
