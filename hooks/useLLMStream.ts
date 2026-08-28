/**
 * useLLMStream Hook
 * Responsibilities:
 * - Stream chat responses
 * - Track usage stats
 * - Support stop/abort
 * - Dynamic fallback: retry once with smaller context budget on timeout/5xx
 */

import { useState, useRef, useCallback } from 'react';
import { streamChatCompletion, generateImage, UsageStats } from '../lib/api-client';
import { saveMessage } from '../lib/db';
import { Message, ModelId, Attachment, GptImage2Params } from '../types';
import { countTokens } from '../lib/token';
import { v4 as uuidv4 } from 'uuid';

export interface StreamParams {
  apiKey: string;
  model: ModelId;
  messages: Message[];
  attachments: Attachment[];
  userSystemPrompt: string;
  sessionId: string;
  existingMsgId?: string;
  isWebSearchEnabled?: boolean;
  onMessageCreated?: (msg: Message) => void;
  onMessageUpdate?: (msgId: string, content: string, thinkingContent?: string) => void;
  onComplete?: (msg: Message) => void;
  onError?: (msgId: string, errorContent: string) => void;
}
export interface ImageGenerateParams {
  apiKey: string;
  model: ModelId;
  prompt: string;
  attachments: Attachment[];
  params?: GptImage2Params;
  sessionId: string;
  existingMsgId?: string;
  onMessageCreated?: (msg: Message) => void;
  onComplete?: (msg: Message) => void;
  onError?: (msgId: string, errorContent: string) => void;
}

export interface UseLLMStreamReturn {
  isStreaming: boolean;
  lastUsage: { prompt: number; completion: number } | null;
  startStream: (params: StreamParams) => Promise<void>;
  startImageGeneration: (params: ImageGenerateParams) => Promise<void>;
  stopStream: () => void;
  resetUsage: () => void;
}

interface AttemptResult {
  completed: boolean;
  usage?: UsageStats;
  error: Error | null;
}

export function useLLMStream(): UseLLMStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ prompt: number; completion: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetUsage = useCallback(() => {
    setLastUsage(null);
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const estimateMessageTokens = useCallback((msg: Message): number => {
    const contentTokens = countTokens(msg.content || '');
    const attachmentTokens =
      msg.attachments?.reduce((sum, att) => {
        if (att.type === 'image' || att.included === false) return sum;
        if (typeof att.tokenCount === 'number' && att.tokenCount > 0) return sum + att.tokenCount;
        return sum + countTokens(att.content || '');
      }, 0) || 0;
    return contentTokens + attachmentTokens;
  }, []);

  const trimMessagesByRatio = useCallback(
    (allMessages: Message[], model: ModelId, ratio: number): Message[] => {
      const GPT_CONTEXT_LIMIT = 1_050_000;
      const GEMINI_CONTEXT_LIMIT = 1_000_000;
      const CLAUDE_CONTEXT_LIMIT = 200_000;
      const contextLimit = model.includes('claude')
        ? CLAUDE_CONTEXT_LIMIT
        : model.includes('gpt')
        ? GPT_CONTEXT_LIMIT
        : GEMINI_CONTEXT_LIMIT;
      const tokenBudget = Math.floor(contextLimit * ratio);

      let used = 0;
      const selected: Message[] = [];
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        const tokens = estimateMessageTokens(msg);
        const isNewest = i === allMessages.length - 1;
        if (!isNewest && used + tokens > tokenBudget) continue;
        selected.push(msg);
        used += tokens;
        if (used >= tokenBudget) break;
      }

      return selected.reverse();
    },
    [estimateMessageTokens]
  );

  const isRetryableStreamError = useCallback((err: Error): boolean => {
    if (!err || err.name === 'AbortError') return false;
    const msg = (err.message || '').toLowerCase();
    if (!msg) return false;

    const timeoutLike =
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('etimedout') ||
      msg.includes('failed to fetch') ||
      msg.includes('network');

    const server5xxLike = /\b5\d{2}\b/.test(msg) || msg.includes('服务器内部错误');
    return timeoutLike || server5xxLike;
  }, []);

  const toFriendlyError = useCallback((err: Error): string => {
    const message = (err.message || '未知错误').trim();
    if (message.toLowerCase() === 'failed to fetch') {
      return '网络连接失败（Failed to fetch）。可能是网络不稳定、代理/防火墙拦截、上游服务短时不可达，或线上 Nginx 对流式接口启用了缓冲。';
    }
    return message;
  }, []);

  const startStream = useCallback(
    async (params: StreamParams) => {
      const {
        apiKey,
        model,
        messages,
        attachments,
        userSystemPrompt,
        sessionId,
        existingMsgId,
        isWebSearchEnabled,
        onMessageCreated,
        onMessageUpdate,
        onComplete,
        onError,
      } = params;

      setIsStreaming(true);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const botMsgId = existingMsgId || uuidv4();
      const botMsg: Message = {
        id: botMsgId,
        sessionId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model,
      };

      if (!existingMsgId) {
        onMessageCreated?.(botMsg);
      }

      let fullResponse = '';
      let fullThinking = '';

      const runAttempt = async (attemptMessages: Message[], attemptLabel: string): Promise<AttemptResult> => {
        let completed = false;
        let usage: UsageStats | undefined;
        let streamError: Error | null = null;

        await streamChatCompletion(
          apiKey,
          model,
          attemptMessages,
          attachments,
          userSystemPrompt,
          abortController.signal,
          (chunk, isThinking) => {
            if (isThinking) {
              fullThinking += chunk;
            } else {
              fullResponse += chunk;
            }
            onMessageUpdate?.(botMsgId, fullResponse, fullThinking || undefined);
          },
          (u?: UsageStats) => {
            completed = true;
            usage = u;
          },
          (err: Error) => {
            streamError = err;
            console.warn(`[LLM ${attemptLabel}] stream failed:`, err?.message || err);
          },
          isWebSearchEnabled || false
        );

        return { completed, usage, error: streamError };
      };

      try {
        // Attempt 1: normal flow (caller already uses 75% context budget).
        const first = await runAttempt(messages, 'attempt-1');

        if (first.completed) {
          if (first.usage) {
            setLastUsage({
              prompt: first.usage.prompt_tokens || 0,
              completion: first.usage.completion_tokens || 0,
            });
          }
          const finalMsg: Message = {
            ...botMsg,
            content: fullResponse,
            ...(fullThinking && { thinkingContent: fullThinking }),
          };
          await saveMessage(finalMsg);
          onComplete?.(finalMsg);
          return;
        }

        // Attempt 2: dynamic downgrade to 60% budget if timeout or 5xx.
        if (first.error && isRetryableStreamError(first.error)) {
          const downgradedMessages = trimMessagesByRatio(messages, model, 0.6);
          console.warn(
            `[Context Downgrade] retrying once with 60% budget for ${model}: ${messages.length} -> ${downgradedMessages.length} messages`
          );

          fullResponse = '';
          fullThinking = '';
          onMessageUpdate?.(botMsgId, '', undefined);

          const second = await runAttempt(downgradedMessages, 'attempt-2');
          if (second.completed) {
            if (second.usage) {
              setLastUsage({
                prompt: second.usage.prompt_tokens || 0,
                completion: second.usage.completion_tokens || 0,
              });
            }
            const finalMsg: Message = {
              ...botMsg,
              content: fullResponse,
              ...(fullThinking && { thinkingContent: fullThinking }),
            };
            await saveMessage(finalMsg);
            onComplete?.(finalMsg);
            return;
          }

          const fallbackError = second.error || first.error;
          if (fallbackError && fallbackError.name !== 'AbortError') {
            const errorMsg = `\n\n> **生成失败**: ${toFriendlyError(fallbackError)}`;
            onError?.(botMsgId, fullResponse + errorMsg);
          }
          return;
        }

        // Non-retryable error.
        if (first.error && first.error.name !== 'AbortError') {
          const errorMsg = `\n\n> **生成失败**: ${toFriendlyError(first.error)}`;
          onError?.(botMsgId, fullResponse + errorMsg);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isRetryableStreamError, toFriendlyError, trimMessagesByRatio]
  );

  const startImageGeneration = useCallback(async (params: ImageGenerateParams) => {
    const {
      apiKey,
      model,
      prompt,
      attachments,
      params: imageParams,
      sessionId,
      existingMsgId,
      onMessageCreated,
      onComplete,
      onError,
    } = params;

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const botMsgId = existingMsgId || uuidv4();
    const botMsg: Message = {
      id: botMsgId,
      sessionId,
      role: 'assistant',
      content: model === 'gpt-image-2' ? '正在调用 GPT-Image-2 生图...' : '正在调用图像模型...',
      timestamp: Date.now(),
      model,
    };

    if (!existingMsgId) {
      onMessageCreated?.(botMsg);
    }

    try {
      const imageResult = await generateImage(apiKey, prompt, model, attachments, imageParams, controller.signal);
      const outputImages = (imageResult.images || []).map((image, index) => {
        const imageContent = image.startsWith('data:image') || image.startsWith('http')
          ? image
          : `data:image/png;base64,${image}`;
        const extension = imageParams?.outputFormat === 'jpeg' ? 'jpg' : imageParams?.outputFormat || 'png';
        return {
          id: uuidv4(),
          name: `generated-${Date.now()}-${index + 1}.${extension}`,
          type: 'image',
          content: imageContent,
          included: true,
        } satisfies Attachment;
      });
      const finalContent = `已为您生成 ${outputImages.length} 张图片：\n> ${prompt}`;

      const finalMsg: Message = {
        ...botMsg,
        content: finalContent,
        attachments: outputImages,
      };

      await saveMessage(finalMsg);
      onComplete?.(finalMsg);
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg = error.name === 'AbortError'
        ? '\n\n**[已停止]**'
        : `\n\n> **生图失败**: ${error.message}`;
      onError?.(botMsgId, botMsg.content + errorMsg);
    } finally {
      setIsStreaming(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  return {
    isStreaming,
    lastUsage,
    startStream,
    startImageGeneration,
    stopStream,
    resetUsage,
  };
}
