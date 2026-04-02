/**
 * useChatSession Hook
 * 职责：管理当前会话的消息列表和数据库交互
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '../types';
import { db, saveMessage } from '../lib/db';
import { useStore } from '../store';

export interface UseChatSessionReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (msg: Message) => Promise<void>;
  updateMessageContent: (id: string, content: string, thinkingContent?: string) => void;
  clearMessagesAfter: (msgId: string) => Promise<Message[]>;
  reloadMessages: () => Promise<void>;
  prevMessagesLengthRef: React.MutableRefObject<number>;
}

export function useChatSession(): UseChatSessionReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const prevMessagesLengthRef = useRef(0);
  const currentSessionId = useStore((state) => state.currentSessionId);

  // 从数据库加载消息
  const reloadMessages = useCallback(async () => {
    if (currentSessionId) {
      const msgs = await db.messages
        .where('sessionId')
        .equals(currentSessionId)
        .sortBy('timestamp');
      setMessages(msgs);
      prevMessagesLengthRef.current = msgs.length;
    } else {
      setMessages([]);
      prevMessagesLengthRef.current = 0;
    }
  }, [currentSessionId]);

  // 监听 sessionId 变化，自动加载消息
  useEffect(() => {
    reloadMessages();
  }, [reloadMessages]);

  // 添加消息（更新状态并持久化到数据库）
  const addMessage = useCallback(async (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
    await saveMessage(msg);
  }, []);

  // 更新消息内容（用于流式输出时更新 UI，不持久化）
  const updateMessageContent = useCallback((id: string, content: string, thinkingContent?: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content, ...(thinkingContent !== undefined && { thinkingContent }) } : m))
    );
  }, []);

  // 清除指定消息之后的所有消息（用于编辑重新生成）
  const clearMessagesAfter = useCallback(async (msgId: string): Promise<Message[]> => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return messages;

    const history = messages.slice(0, msgIndex);
    const msgsToDelete = messages.slice(msgIndex).map((m) => m.id);
    
    await db.messages.bulkDelete(msgsToDelete);
    setMessages(history);
    
    return history;
  }, [messages]);

  return {
    messages,
    setMessages,
    addMessage,
    updateMessageContent,
    clearMessagesAfter,
    reloadMessages,
    prevMessagesLengthRef,
  };
}
