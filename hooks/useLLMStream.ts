/**
 * useLLMStream Hook
 * 职责：处理与 LLM 的流式通信、Token 统计和中止控制
 */

import { useState, useRef, useCallback } from 'react';
import { streamChatCompletion, generateImage, UsageStats } from '../lib/api-client';
import { saveMessage } from '../lib/db';
import { Message, ModelId, Attachment } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface StreamParams {
  apiKey: string;
  model: ModelId;
  messages: Message[];
  attachments: Attachment[];
  userSystemPrompt: string;
  sessionId: string;
  existingMsgId?: string; // 用于重新生成时复用已有消息 ID
  isWebSearchEnabled?: boolean; // 联网搜索开关
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
  resetUsage: () => void; // 🛡️ 新增：重置 Token 统计
}

export function useLLMStream(): UseLLMStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ prompt: number; completion: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🛡️ 重置 Token 统计（用于新建/切换会话时清空幽灵数据）
  const resetUsage = useCallback(() => {
    setLastUsage(null);
  }, []);

  // 停止流式生成
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  // 开始流式对话
  const startStream = useCallback(async (params: StreamParams) => {
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

    // 只有新消息才通知创建
    if (!existingMsgId) {
      onMessageCreated?.(botMsg);
    }

    let fullResponse = '';
    let fullThinking = '';
    
    // 流式输出缓冲机制 - 让输出更丝滑
    let pendingUpdate = false;
    const flushUpdate = () => {
      if (pendingUpdate) {
        onMessageUpdate?.(botMsgId, fullResponse, fullThinking || undefined);
        pendingUpdate = false;
      }
    };
    
    // 使用 requestAnimationFrame 节流更新，约 60fps
    const scheduleUpdate = () => {
      if (!pendingUpdate) {
        pendingUpdate = true;
        requestAnimationFrame(flushUpdate);
      }
    };

    await streamChatCompletion(
      apiKey,
      model,
      messages,
      attachments,
      userSystemPrompt,
      abortController.signal,
      // onChunk - 使用缓冲机制
      (chunk, isThinking) => {
        if (isThinking) {
          fullThinking += chunk;
        } else {
          fullResponse += chunk;
        }
        scheduleUpdate();
      },
      // onComplete
      (usage?: UsageStats) => {
        // 确保最后的内容被刷新
        flushUpdate();
        
        setIsStreaming(false);
        abortControllerRef.current = null;
        if (usage) {
          setLastUsage({
            prompt: usage.prompt_tokens || 0,
            completion: usage.completion_tokens || 0,
          });
        }
        const finalMsg: Message = { 
          ...botMsg, 
          content: fullResponse,
          ...(fullThinking && { thinkingContent: fullThinking }),
        };
        saveMessage(finalMsg);
        onComplete?.(finalMsg);
      },
      // onError
      (err: Error) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        if (err.name !== 'AbortError') {
          const errorMsg = `\n\n> ⚠️ **生成失败**: ${err.message || '未知错误'}`;
          onError?.(botMsgId, fullResponse + errorMsg);
        }
      },
      isWebSearchEnabled || false
    );
  }, []);

  // 开始图片生成
  const startImageGeneration = useCallback(async (params: ImageGenerateParams) => {
    const {
      apiKey,
      model,
      prompt,
      attachments,
      sessionId,
      existingMsgId,
      onMessageCreated,
      onComplete,
      onError,
    } = params;

    setIsStreaming(true);

    const botMsgId = existingMsgId || uuidv4();
    const botMsg: Message = {
      id: botMsgId,
      sessionId,
      role: 'assistant',
      content: '🎨 正在调用 Gemini 2.5 绘图...',
      timestamp: Date.now(),
      model,
    };

    if (!existingMsgId) {
      onMessageCreated?.(botMsg);
    }

    try {
      const b64Image = await generateImage(apiKey, prompt, model, attachments);

      const finalContent = `已为您生成图片：\n> ${prompt}`;
      const imageAttachment: Attachment = {
        id: uuidv4(),
        name: `generated-${Date.now()}.png`,
        type: 'image',
        content: `data:image/png;base64,${b64Image}`,
        included: true,
      };

      const finalMsg: Message = {
        ...botMsg,
        content: finalContent,
        attachments: [imageAttachment],
      };

      await saveMessage(finalMsg);
      onComplete?.(finalMsg);
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg = `\n\n> ⚠️ **生图失败**: ${error.message}`;
      onError?.(botMsgId, botMsg.content + errorMsg);
    } finally {
      setIsStreaming(false);
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
