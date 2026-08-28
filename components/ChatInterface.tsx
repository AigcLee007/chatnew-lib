import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  createSession,
  db,
  deleteResearchPlanBySession,
  getConversationMemoryBySession,
  getResearchPlanBySession,
  saveConversationMemory,
  saveMessage,
  saveResearchPlanRecord
} from '../lib/db';
import { parseAttachmentWithMinerU, prepareAttachmentForPromptAsync, processFile } from '../lib/file-processor';
import { advanceResearchPlan, buildModeSystemPrompt, createDefaultResearchPlan, shouldRegenerateDefaultResearchPlan } from '../lib/skill-prompts';
import {
  applyConversationMemoryWindow,
  buildMemorySystemPrompt,
  generateConversationMemory,
  shouldAllowManualMemory,
  shouldAutoUpdateMemory
} from '../lib/conversation-memory';
import { countTokens } from '../lib/token';
import { appAssetUrl } from '../lib/base-path';
import { Attachment, ConversationMemory, GptImage2Params, Message, ModelId, ResearchPlan, WorkMode } from '../types';
import { MessageBubble } from './MessageBubble';
import { ErrorBoundary } from './ErrorBoundary';
import { useChatSession, useLLMStream } from '../hooks';
import {
  Send,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileImage,
  Moon,
  Sun,
  Sidebar as SidebarIcon,
  ChevronUp,
  AlertCircle,
  Square as SquareIcon,
  CheckSquare,
  Globe,
  X,
  Search,
  ChevronDown,
  BookOpen,
  ClipboardList,
  Palette,
  MessageSquare,
  HelpCircle,
  Brain
} from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { NoticePopover } from './NoticePopover';
import { ContactPopover } from './ContactPopover';
import { GrokLogo } from './GrokLogo';

// 馃洝锔?鍏煎鎬т慨澶嶏細鍦?HTTP 鐜涓嬪洖閫€鍒?Math.random
const safeUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const isImageGenerationModel = (model: ModelId): boolean => model === 'gpt-image-2';
const GPT_IMAGE2_IMAGE_LIMIT = 16;
const DEFAULT_GPT_IMAGE2_PARAMS: GptImage2Params = {
  size: 'auto',
  aspectRatio: 'auto',
  quality: 'auto',
  outputFormat: 'png',
  outputCompression: null,
  moderation: 'auto',
  n: 1,
};

export const ChatInterface: React.FC = () => {
  const store = useStore();
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // --- 浣跨敤鑷畾涔?Hooks ---
  const {
    messages,
    setMessages,
    addMessage,
    updateMessageContent,
    clearMessagesAfter,
    prevMessagesLengthRef
  } = useChatSession();

  const {
    isStreaming,
    lastUsage,
    startStream,
    startImageGeneration,
    stopStream
  } = useLLMStream();

  // --- UI State ---
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeGuide, setShowModeGuide] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory | null>(null);
  const [isOrganizingMemory, setIsOrganizingMemory] = useState(false);
  const [gptImage2Params, setGptImage2Params] = useState<GptImage2Params>(DEFAULT_GPT_IMAGE2_PARAMS);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imagePromptRef = useRef<HTMLDivElement>(null);
  const modeGuideRef = useRef<HTMLDivElement>(null);
  const sendLockRef = useRef(false);

  const saveResearchPlan = async (plan: ResearchPlan | null) => {
    setResearchPlan(plan);
    if (!plan) return;
    await saveResearchPlanRecord(plan);
  };

  useEffect(() => {
    if (!store.currentSessionId) {
      setResearchPlan(null);
      setConversationMemory(null);
      return;
    }

    let cancelled = false;
    Promise.all([
      getResearchPlanBySession(store.currentSessionId),
      getConversationMemoryBySession(store.currentSessionId),
    ]).then(([plan, memory]) => {
        if (cancelled) return;
        if (plan && shouldRegenerateDefaultResearchPlan(plan, plan.goal)) {
          const migratedPlan = createDefaultResearchPlan(store.currentSessionId!, plan.goal || '计划任务');
          setResearchPlan(migratedPlan);
          saveResearchPlanRecord(migratedPlan);
        } else {
          setResearchPlan(plan || null);
        }
        setConversationMemory(memory || null);
      });
    return () => {
      cancelled = true;
    };
  }, [store.currentSessionId]);

  useEffect(() => {
    if (isImageGenerationModel(store.defaultModel)) {
      syncImagePromptDom(store.input);
      resetImagePromptHeight();
      return;
    }
    setGptImage2Params(DEFAULT_GPT_IMAGE2_PARAMS);
  }, [store.defaultModel]);

  useEffect(() => {
    if (!isImageGenerationModel(store.defaultModel)) return;
    syncImagePromptDom(store.input);
  }, [store.input, store.defaultModel]);

  const estimateMessageTokens = (msg: Message): number => {
    const contentTokens = countTokens(msg.content || '');
    const attachmentTokens =
      msg.attachments?.reduce((sum, att) => {
        if (att.type === 'image' || att.included === false) return sum;
        if (typeof att.tokenCount === 'number' && att.tokenCount > 0) return sum + att.tokenCount;
        return sum + countTokens(att.content || '');
      }, 0) || 0;
    return contentTokens + attachmentTokens;
  };

  const buildContextWindow = (allMessages: Message[], model: ModelId): Message[] => {
    // Use 75% of official context limits to reduce timeout risk while
    // preserving as much history as possible.
    const GPT_CONTEXT_LIMIT = 1_050_000;
    const GEMINI_CONTEXT_LIMIT = 1_000_000;
    const CLAUDE_CONTEXT_LIMIT = 200_000;
    const SAFETY_RATIO = 0.75;
    const TOKEN_BUDGET = model.includes('claude')
      ? Math.floor(CLAUDE_CONTEXT_LIMIT * SAFETY_RATIO)
      : model.includes('gpt')
      ? Math.floor(GPT_CONTEXT_LIMIT * SAFETY_RATIO)   // 787,500
      : Math.floor(GEMINI_CONTEXT_LIMIT * SAFETY_RATIO); // 750,000
    const MAX_MESSAGES = 80;
    const recent = allMessages.slice(-MAX_MESSAGES);

    let used = 0;
    const selected: Message[] = [];
    for (let i = recent.length - 1; i >= 0; i--) {
      const msg = recent[i];
      const t = estimateMessageTokens(msg);
      const isNewest = i === recent.length - 1;
      if (!isNewest && used + t > TOKEN_BUDGET) continue;
      selected.push(msg);
      used += t;
      if (used >= TOKEN_BUDGET) break;
    }

    return selected.reverse();
  };

  // Reset textarea height for both desktop and mobile layouts.
  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      const minHeight = window.innerWidth < 768 ? 40 : 44;
      textareaRef.current.style.height = `${minHeight}px`;
      textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const resetImagePromptHeight = () => {
    if (imagePromptRef.current) {
      imagePromptRef.current.style.height = '68px';
      imagePromptRef.current.style.overflowY = 'auto';
    }
  };

  const syncImagePromptDom = (value: string) => {
    if (!imagePromptRef.current) return;
    if (imagePromptRef.current.innerText !== value) {
      imagePromptRef.current.innerText = value;
    }
  };

  const updateGptImage2Param = <K extends keyof GptImage2Params>(key: K, value: GptImage2Params[K]) => {
    setGptImage2Params((prev) => ({ ...prev, [key]: value }));
  };

  // --- Token 浼扮畻 ---
  const activeAttachments = store.attachments.filter(a => a.included !== false);
  const fileTokens = activeAttachments.reduce((acc, att) => acc + (att.tokenCount || 0), 0);
  const sysTokens = countTokens(store.userSystemPrompt);
  const textTokens = countTokens(store.input);
  const inputTokens = textTokens + fileTokens;

  // 閫忚闀滐細璁＄畻鍘嗗彶璁板綍鐨?Token锛堢敤浜庤皟璇曞巻鍙叉硠婕忥級
  const historyTokens = messages.reduce((acc, m) => {
    const msgTokens = countTokens(m.content || '');
    const attachTokens = m.attachments?.reduce((ta, a) => ta + (a.tokenCount || 0), 0) || 0;
    return acc + msgTokens + attachTokens;
  }, 0);

  // --- UI Effects ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!modelMenuRef.current) return;
      if (!modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
      }
    };
    if (showModelMenu) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModelMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!modeGuideRef.current) return;
      if (!modeGuideRef.current.contains(event.target as Node)) {
        setShowModeGuide(false);
      }
    };
    if (showModeGuide) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModeGuide]);

  // 鏅鸿兘婊氬姩閫昏緫 - 绉诲姩绔櫧灞忎慨澶嶆牳蹇冿細浣跨敤 behavior: 'auto'
  useEffect(() => {
    const viewport = virtuosoRef.current;
    if (!viewport || messages.length === 0) return;

    if (messages.length > prevMessagesLengthRef.current) {
      requestAnimationFrame(() => {
        // 鏂版秷鎭敖閲忕敤 smooth锛屼絾鍦ㄧЩ鍔ㄧ鍙兘浼氭湁鎬ц兘闂锛屽鏋滆繕鍗″彲浠ュ叏鏀规垚 auto
        viewport.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' });
      });
      prevMessagesLengthRef.current = messages.length;
    } else if (isStreaming) {
      requestAnimationFrame(() => {
        // 娴佸紡杈撳嚭蹇呴』鐢?auto (鐬棿璺宠浆)锛岄槻姝㈢Щ鍔ㄧ娓叉煋闃熷垪闃诲瀵艰嚧鐧藉睆
        viewport.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'auto' });
      });
    }
  }, [messages, isStreaming, prevMessagesLengthRef]);

  // --- Handlers ---
  const handleStop = () => {
    stopStream();
  };

  const handleEditMessage = async (msgId: string, newContent: string) => {
    if (isStreaming) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const history = await clearMessagesAfter(msgId);
    const oldMsg = messages[msgIndex];

    const newUserMsg: Message = {
      ...oldMsg,
      content: newContent,
      timestamp: Date.now()
    };

    await addMessage(newUserMsg);

    const memoryPrompt = buildMemorySystemPrompt(conversationMemory);
    const modePrompt = buildModeSystemPrompt(store.workMode, researchPlan);
    const combinedSystemPrompt = [store.userSystemPrompt, modePrompt, memoryPrompt].filter(Boolean).join('\n\n');
    const contextMessages = buildContextWindow(
      applyConversationMemoryWindow([...history, newUserMsg], conversationMemory),
      store.defaultModel
    );

    await startStream({
      apiKey: store.apiKey,
      model: store.defaultModel,
      messages: contextMessages,
      attachments: newUserMsg.attachments || [],
      userSystemPrompt: combinedSystemPrompt,
      sessionId: newUserMsg.sessionId,
      isWebSearchEnabled: store.isWebSearchEnabled,
      onMessageCreated: (msg) => setMessages(prev => [...prev, msg]),
      onMessageUpdate: updateMessageContent,
      onError: (id, content) => updateMessageContent(id, content),
    });
  };

  const handleRegenerate = async (msgId: string) => {
    if (isStreaming) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'assistant') return;

    const history = messages.slice(0, msgIndex);
    const lastUserMsg = history[history.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    // 娓呯┖褰撳墠娑堟伅鍐呭
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: '' } : m));

    const regenModel = (targetMsg.model as ModelId) || store.defaultModel;
    const memoryPrompt = buildMemorySystemPrompt(conversationMemory);
    const modePrompt = buildModeSystemPrompt(store.workMode, researchPlan);
    const combinedSystemPrompt = [store.userSystemPrompt, modePrompt, memoryPrompt].filter(Boolean).join('\n\n');
    const contextMessages = buildContextWindow(applyConversationMemoryWindow(history, conversationMemory), regenModel);

    await startStream({
      apiKey: store.apiKey,
      model: regenModel,
      messages: contextMessages,
      attachments: lastUserMsg.attachments || [],
      userSystemPrompt: combinedSystemPrompt,
      sessionId: targetMsg.sessionId,
      existingMsgId: msgId,
      isWebSearchEnabled: store.isWebSearchEnabled,
      onMessageUpdate: updateMessageContent,
      onError: (id, content) => updateMessageContent(id, content),
    });
  };

  const handleContinue = async (msgId: string) => {
    if (isStreaming) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'assistant') return;

    const history = messages.slice(0, msgIndex + 1);

    // Clear current assistant message before continuing generation.
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: '' } : m));

    const continueModel = (targetMsg.model as ModelId) || store.defaultModel;
    const memoryPrompt = buildMemorySystemPrompt(conversationMemory);
    const modePrompt = buildModeSystemPrompt(store.workMode, researchPlan);
    const combinedSystemPrompt = [store.userSystemPrompt, modePrompt, memoryPrompt].filter(Boolean).join('\n\n');
    const contextMessages = buildContextWindow(applyConversationMemoryWindow(history, conversationMemory), continueModel);

    await startStream({
      apiKey: store.apiKey,
      model: continueModel,
      messages: contextMessages,
      attachments: [],
      userSystemPrompt: combinedSystemPrompt,
      sessionId: targetMsg.sessionId,
      existingMsgId: msgId,
      isWebSearchEnabled: store.isWebSearchEnabled,
      onMessageUpdate: updateMessageContent,
      onError: (id, content) => updateMessageContent(id, content),
    });
  };

  const prepareAttachmentsForModel = async (
    attachments: Attachment[],
    model: ModelId,
    query: string
  ): Promise<Attachment[]> => {
    const converted: Attachment[] = [];
    for (const att of attachments) {
      if (att.type === 'image' && model.includes('gpt')) {
        converted.push(await prepareAttachmentForPromptAsync(await parseAttachmentWithMinerU(att), query));
        continue;
      }

      converted.push(await prepareAttachmentForPromptAsync(att, query));
    }

    return converted;
  };

  const prepareMessagesForModel = async (
    sourceMessages: Message[],
    model: ModelId,
    query: string
  ): Promise<Message[]> => {
    if (isImageGenerationModel(model)) return sourceMessages;

    const prepared: Message[] = [];
    for (const msg of sourceMessages) {
      if (!msg.attachments?.length) {
        prepared.push(msg);
        continue;
      }

      prepared.push({
        ...msg,
        attachments: await prepareAttachmentsForModel(msg.attachments, model, query),
      });
    }

    return prepared;
  };

  const organizeConversationMemory = async (reason: 'manual' | 'auto' = 'manual'): Promise<ConversationMemory | null> => {
    if (!store.currentSessionId || isImageGenerationModel(store.defaultModel)) return conversationMemory;
    if (isOrganizingMemory) return conversationMemory;

    if (!store.apiKey || !store.apiKey.startsWith('sk-')) {
      if (reason === 'manual') alert('需要先配置有效的 API Key，才能整理记忆。');
      return conversationMemory;
    }

    if (!shouldAllowManualMemory(messages)) {
      if (reason === 'manual') alert('当前对话较短，暂时无需整理记忆。');
      return conversationMemory;
    }

    setIsOrganizingMemory(true);
    try {
      const memory = await generateConversationMemory({
        apiKey: store.apiKey,
        model: store.defaultModel,
        sessionId: store.currentSessionId,
        messages,
        previousMemory: conversationMemory,
      });
      await saveConversationMemory(memory);
      setConversationMemory(memory);
      if (reason === 'manual') {
        alert('已整理当前话题记忆，后续对话会优先保留这些关键信息。');
      }
      return memory;
    } catch (error: unknown) {
      const err = error as Error;
      if (reason === 'manual') {
        alert(`整理记忆失败\n${err.message || err}`);
      } else {
        console.warn('[Conversation Memory] auto organize failed:', err.message || err);
      }
      return conversationMemory;
    } finally {
      setIsOrganizingMemory(false);
    }
  };

  const maybeAutoOrganizeMemory = async (): Promise<ConversationMemory | null> => {
    if (isImageGenerationModel(store.defaultModel)) return conversationMemory;
    if (!shouldAutoUpdateMemory(messages, conversationMemory, historyTokens)) return conversationMemory;
    return organizeConversationMemory('auto');
  };

  const handleSend = async () => {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    try {
      const activeAttachments = store.attachments.filter(a => a.included !== false);
      if (isStreaming) return;
      if (isImageGenerationModel(store.defaultModel)) {
        if (!store.input.trim()) return;
      } else if (!store.input.trim() && activeAttachments.length === 0) {
        return;
      }

      if (!store.apiKey || !store.apiKey.startsWith('sk-')) {
        const shouldOpen = confirm("⚠️ 未配置有效的 API Key。\n\n需要先配置 Key 才能开始对话。是否立即前往设置？");
        if (shouldOpen) {
          // 移动端且侧边栏关闭时，先打开侧边栏再触发设置按钮。
          if (window.innerWidth < 768 && !store.isSidebarOpen) {
            store.toggleSidebar();
            // 给一点渲染时间后再点击
            setTimeout(() => {
              const settingsBtn = document.querySelector('[aria-label="settings-button"]') as HTMLButtonElement;
              if (settingsBtn) settingsBtn.click();
            }, 100);
          } else {
            const settingsBtn = document.querySelector('[aria-label="settings-button"]') as HTMLButtonElement;
            if (settingsBtn) settingsBtn.click();
          }
        }
        return;
      }

      const isNewSession = !store.currentSessionId;
      let sessionId = store.currentSessionId;

      if (isNewSession) {
        const title = store.input.slice(0, 30) || "新对话";
        sessionId = await createSession(title, store.defaultModel);
      }

      let planForPrompt = researchPlan;
      if (store.workMode === 'planning' && sessionId && (!planForPrompt || shouldRegenerateDefaultResearchPlan(planForPrompt, store.input))) {
        planForPrompt = createDefaultResearchPlan(sessionId, store.input || planForPrompt?.goal || '计划任务');
        await saveResearchPlan(planForPrompt);
      }

      const memoryForPrompt = await maybeAutoOrganizeMemory();
      const modePrompt = buildModeSystemPrompt(store.workMode, planForPrompt);
      const memoryPrompt = buildMemorySystemPrompt(memoryForPrompt);
      const combinedSystemPrompt = [store.userSystemPrompt, modePrompt, memoryPrompt].filter(Boolean).join('\n\n');

      const userMsg: Message = {
        id: safeUuid(),
        sessionId,
        role: 'user',
        content: store.input,
        timestamp: Date.now(),
        attachments: [...activeAttachments]
      };

      if (isNewSession) {
        if (isImageGenerationModel(store.defaultModel)) {
          const botMsgId = safeUuid();
          const botMsg: Message = {
            id: botMsgId,
            sessionId,
            role: 'assistant',
            content: store.defaultModel === 'gpt-image-2' ? '正在调用 GPT-Image-2 生图...' : '正在调用图像模型...',
            timestamp: Date.now() + 1,
            model: store.defaultModel
          };

          await saveMessage(userMsg);
          await saveMessage(botMsg);
          store.setSessionId(sessionId);

          store.setInput('');
          store.clearAttachments();
          resetTextareaHeight();
          syncImagePromptDom('');
          resetImagePromptHeight();

          await startImageGeneration({
            apiKey: store.apiKey,
            model: store.defaultModel,
            prompt: userMsg.content,
            attachments: userMsg.attachments || [],
            params: { ...gptImage2Params, n: 1 },
            sessionId,
            existingMsgId: botMsgId,
            onComplete: (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)),
            onError: (id, content) => updateMessageContent(id, content),
          });
          return;
        }

        const botMsgId = safeUuid();
        const botMsg: Message = {
          id: botMsgId,
          sessionId,
          role: 'assistant',
          content: '',
          timestamp: Date.now() + 1,
          model: store.defaultModel
        };

        await saveMessage(userMsg);
        await saveMessage(botMsg);
        store.setSessionId(sessionId);

        store.setInput('');
        store.clearAttachments();
        resetTextareaHeight();

        const safeHistory = isNewSession ? [] : messages;

        const memoryAwareHistory = applyConversationMemoryWindow([...safeHistory, userMsg], memoryForPrompt);
        const rawContextMessages = buildContextWindow(memoryAwareHistory, store.defaultModel);
        store.setLoading(true);
        const contextMessages = await prepareMessagesForModel(rawContextMessages, store.defaultModel, store.input);
        store.setLoading(false);

        await startStream({
          apiKey: store.apiKey,
          model: store.defaultModel,
          messages: contextMessages,
          attachments: contextMessages[contextMessages.length - 1]?.attachments || [],
          userSystemPrompt: combinedSystemPrompt,
          sessionId,
          existingMsgId: botMsgId,
          isWebSearchEnabled: store.isWebSearchEnabled,
          onMessageCreated: (msg) => {
            if (!isNewSession) setMessages(prev => [...prev, msg]);
          },
          onMessageUpdate: updateMessageContent,
          onError: (id, content) => updateMessageContent(id, content),
        });
        if (store.workMode === 'planning' && planForPrompt) {
          await saveResearchPlan(advanceResearchPlan(planForPrompt));
        }
      } else {
        await addMessage(userMsg);
        store.setInput('');
        store.clearAttachments();
        resetTextareaHeight();
        syncImagePromptDom('');
        resetImagePromptHeight();

        if (isImageGenerationModel(store.defaultModel)) {
          await startImageGeneration({
            apiKey: store.apiKey,
            model: store.defaultModel,
            prompt: userMsg.content,
            attachments: userMsg.attachments || [],
            params: { ...gptImage2Params, n: 1 },
            sessionId,
            onMessageCreated: (msg) => setMessages(prev => [...prev, msg]),
            onComplete: (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)),
            onError: (id, content) => updateMessageContent(id, content),
          });
          return;
        }

        const safeHistory = isNewSession ? [] : messages;

        const memoryAwareHistory = applyConversationMemoryWindow([...safeHistory, userMsg], memoryForPrompt);
        const rawContextMessages = buildContextWindow(memoryAwareHistory, store.defaultModel);
        store.setLoading(true);
        const contextMessages = await prepareMessagesForModel(rawContextMessages, store.defaultModel, store.input);
        store.setLoading(false);

        await startStream({
          apiKey: store.apiKey,
          model: store.defaultModel,
          messages: contextMessages,
          attachments: contextMessages[contextMessages.length - 1]?.attachments || [],
          userSystemPrompt: combinedSystemPrompt,
          sessionId,
          isWebSearchEnabled: store.isWebSearchEnabled,
          onMessageCreated: (msg) => setMessages(prev => [...prev, msg]),
          onMessageUpdate: updateMessageContent,
          onError: (id, content) => updateMessageContent(id, content),
        });
        if (store.workMode === 'planning' && planForPrompt) {
          await saveResearchPlan(advanceResearchPlan(planForPrompt));
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('发送失败:', err);
      alert(`发送出错\n${err.message || err}\n\n提示：如果你在使用无痕模式，请切换到普通模式，因为无痕模式可能会阻止保存历史记录。`);
      store.setLoading(false); // 纭繚 Loading 鐘舵€佽閲嶇疆
    } finally {
      sendLockRef.current = false;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      store.setLoading(true);
      for (const file of Array.from(e.target.files) as File[]) {
        try {
          if (isImageGenerationModel(store.defaultModel)) {
            if (!file.type.startsWith('image/')) {
              throw new Error('GPT-Image-2 仅支持上传图片作为参考图。');
            }
            if (store.attachments.length >= GPT_IMAGE2_IMAGE_LIMIT) {
              throw new Error(`最多只能添加 ${GPT_IMAGE2_IMAGE_LIMIT} 张参考图。`);
            }
          }
          const att = await processFile(file);
          store.addAttachment(att);
        } catch (err: unknown) {
          const error = err as Error;
          console.error(err);
          alert(`文件 "${file.name}" 解析失败:\n\n${error.message || '未知错误'}`);
        }
      }
      store.setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 澶勭悊绮樿创鍥剧墖
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // 闃绘榛樿绮樿创琛屼负
        const file = item.getAsFile();
        if (file) {
          store.setLoading(true);
          try {
            if (isImageGenerationModel(store.defaultModel) && store.attachments.length >= GPT_IMAGE2_IMAGE_LIMIT) {
              throw new Error(`最多只能添加 ${GPT_IMAGE2_IMAGE_LIMIT} 张参考图。`);
            }
            const att = await processFile(file);
            store.addAttachment(att);
          } catch (err: unknown) {
            const error = err as Error;
            console.error(err);
            alert(`图片粘贴失败:\n\n${error.message || '未知错误'}`);
          }
          store.setLoading(false);
        }
        break; // Only process the first pasted image.
      }
    }
  };

  const handleModelSelect = (e: React.MouseEvent, modelId: ModelId) => {
    e.stopPropagation();
    const switchingImageMode = isImageGenerationModel(modelId) !== isImageGenerationModel(store.defaultModel);
    store.setModel(modelId);
    if (switchingImageMode) {
      store.clearAttachments();
    }
    setShowModelMenu(false);
  };

  type ModelProvider = 'GEMINI' | 'OPENAI' | 'GROK' | 'ANTHROPIC';

  const ModelLogo: React.FC<{ provider: ModelProvider; className?: string }> = ({ provider, className }) => {
    if (provider === 'GEMINI') {
      return (
        <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path
            d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z"
            fill="url(#gemini-gradient-model-menu)"
          />
          <defs>
            <linearGradient id="gemini-gradient-model-menu" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4285F4" />
              <stop offset="0.5" stopColor="#A142F4" />
              <stop offset="1" stopColor="#EA4335" />
            </linearGradient>
          </defs>
        </svg>
      );
    }
    if (provider === 'ANTHROPIC') {
      return (
        <img src={appAssetUrl('logo/claude-ai-icon.svg')} alt="" className={className} aria-hidden="true" />
      );
    }
    if (provider === 'GROK') {
      return <GrokLogo className={className} size={16} />;
    }
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
          className="fill-current"
        />
      </svg>
    );
  };

  const modelOptions: Array<{
    id: ModelId;
    name: string;
    desc: string;
    provider: ModelProvider;
  }> = [
    {
      id: 'gemini-3.5-flash-preview',
      name: 'Gemini-3.5-flash',
      desc: 'Gemini 3.5 Flash：主打速度与低延迟，适合日常高频对话。',
      provider: 'GEMINI',
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini-3.1-pro',
      desc: 'Gemini 3.1 Pro：推理更强，适合复杂分析与长文任务。',
      provider: 'GEMINI',
    },
    {
      id: 'gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      desc: 'GPT-5.6 Sol：最新旗舰级推理与编码模型，适合复杂问题分析、代码生成、系统架构设计和高难度任务处理。',
      provider: 'OPENAI',
    },
    {
      id: 'gpt-5.6-terra',
      name: 'GPT-5.6 Terra',
      desc: 'GPT-5.6 Terra：智能与成本更均衡的模型，适合大多数生产环境应用、内容生成、文档处理和业务分析。',
      provider: 'OPENAI',
    },
    {
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      desc: 'GPT-5.5：OpenAI 上一代旗舰模型，适合高难度推理、复杂分析、长文写作与代码任务。',
      provider: 'OPENAI',
    },
    {
      id: 'gpt-5.4',
      name: 'Gpt-5.4',
      desc: 'GPT-5.4：新一代通用高性能模型，代码、推理、写作均衡。',
      provider: 'OPENAI',
    },
    {
      id: 'gpt-image-2',
      name: 'GPT-Image-2（生图）',
      desc: 'OpenAI GPT-Image-2：用于文本生成图片，默认 1:1 PNG 输出。',
      provider: 'OPENAI',
    },
    {
      id: 'grok-4.6',
      name: 'Grok 4.6',
      desc: 'Grok 4.6：xAI 高性能推理模型，适合复杂分析、代码与长任务。',
      provider: 'GROK',
    },
    {
      id: 'grok-4.5',
      name: 'Grok 4.5',
      desc: 'Grok 4.5：xAI 通用模型，适合日常对话、写作与业务分析。',
      provider: 'GROK',
    },
    {
      id: 'claude-opus-5',
      name: 'Claude Opus 5',
      desc: 'Claude Opus 5：Anthropic 旗舰模型，适合深度推理、复杂代码与长任务分析。',
      provider: 'ANTHROPIC',
    },
    {
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5',
      desc: 'Claude Sonnet 5：兼顾速度与能力，适合代码、写作与业务分析。',
      provider: 'ANTHROPIC',
    },
    {
      id: 'claude-opus-4-8',
      name: 'Claude Opus 4.8',
      desc: 'Claude Opus 4.8：高质量推理、科研阅读、复杂写作与长任务分析。',
      provider: 'ANTHROPIC',
    },
    {
      id: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      desc: 'Anthropic Claude Opus 4.7：高质量推理、写作与复杂分析。',
      provider: 'ANTHROPIC',
    },
  ];

  const currentModel = modelOptions.find((m) => m.id === store.defaultModel) || modelOptions[0];
  const filteredModels = modelOptions.filter((m) => {
    if (!modelQuery.trim()) return true;
    const q = modelQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
  });
  const groupedModels = {
    GEMINI: filteredModels.filter((m) => m.provider === 'GEMINI'),
    OPENAI: filteredModels.filter((m) => m.provider === 'OPENAI'),
    GROK: filteredModels.filter((m) => m.provider === 'GROK'),
    ANTHROPIC: filteredModels.filter((m) => m.provider === 'ANTHROPIC'),
  };
  const modeOptions: Array<{
    id: WorkMode;
    label: string;
    icon: React.ReactNode;
    title: string;
    when: string;
    example: string;
  }> = [
    {
      id: 'chat',
      label: '普通',
      icon: <MessageSquare size={13} />,
      title: '普通对话模式',
      when: '日常问答、翻译、写作、总结、代码解释。',
      example: '例：把这段话改得更正式。',
    },
    {
      id: 'research',
      label: '科研',
      icon: <BookOpen size={13} />,
      title: '科研论文分析模式',
      when: '读论文、看PDF、找创新点、方法、实验、局限。',
      example: '例：总结这篇论文的方法和不足。',
    },
    {
      id: 'planning',
      label: '计划',
      icon: <ClipboardList size={13} />,
      title: '长任务计划模式',
      when: '拆解课题、阅读计划、项目路线、阶段任务推进。',
      example: '例：给我做一个两周论文阅读计划。',
    },
    {
      id: 'uiux',
      label: 'UI/UX',
      icon: <Palette size={13} />,
      title: 'UI/UX 设计评审模式',
      when: '分析页面、交互流程、按钮文案、产品体验。',
      example: '例：帮我优化上传文件后的用户体验。',
    },
  ];
  const isImageMode = isImageGenerationModel(store.defaultModel);
  const memoryButtonDisabled =
    isStreaming ||
    isOrganizingMemory ||
    store.isLoading ||
    isImageMode ||
    !store.currentSessionId ||
    !shouldAllowManualMemory(messages);
  const memoryStatusText = conversationMemory
    ? `Memory: ${conversationMemory.tokenCount.toLocaleString()}`
    : messages.length >= 20
    ? 'Memory: 建议整理'
    : 'Memory: --';
  const imageAttachCount = store.attachments.filter((att) => att.type === 'image').length;
  const imageModeSendDisabled = !store.input.trim() || store.isLoading;
  const imageSizeOptions: Array<{ value: GptImage2Params['size']; label: string }> = [
    { value: 'auto', label: 'auto' },
    { value: '1k', label: '1K' },
    { value: '2k', label: '2K' },
    { value: '4k', label: '4K' },
  ];
  const imageRatioOptions: Array<{ value: GptImage2Params['aspectRatio']; label: string }> = [
    { value: 'auto', label: 'auto' },
    { value: '1:1', label: '1:1' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '3:2', label: '3:2' },
    { value: '2:3', label: '2:3' },
    { value: '21:9', label: '21:9' },
  ];

  // --- Render ---
  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-50">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="md:hidden">
            {!store.isSidebarOpen && (
              <button onClick={store.toggleSidebar} className="p-2 bg-background border border-border rounded-full text-foreground shadow-sm">
                <SidebarIcon size={18} />
              </button>
            )}
          </div>

          <div ref={modelMenuRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelMenu((prev) => !prev);
              }}
              className="h-10 px-4 rounded-xl border border-border/70 bg-card/95 backdrop-blur-md flex items-center gap-2 shadow-sm hover:bg-muted/70 transition-colors"
              title="选择模型"
            >
              <ModelLogo
                provider={currentModel.provider}
                className={`w-4 h-4 ${currentModel.provider === 'OPENAI' ? 'text-foreground' : ''}`}
              />
              <span className="text-sm font-semibold text-foreground">{currentModel.name}</span>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>

            {showModelMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-12 left-0 w-[320px] rounded-2xl border border-border/70 bg-popover/95 backdrop-blur-md shadow-2xl overflow-hidden"
              >
                <div className="p-3 border-b border-border/70">
                  <div className="h-10 rounded-xl border border-border/70 bg-muted/40 px-3 flex items-center gap-2">
                    <Search size={14} className="text-muted-foreground" />
                    <input
                      value={modelQuery}
                      onChange={(e) => setModelQuery(e.target.value)}
                      placeholder={`搜索 ${modelOptions.length} 个模型...`}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto p-2">
                  {(['GEMINI', 'OPENAI', 'GROK', 'ANTHROPIC'] as const).map((provider) => (
                    <div key={provider} className="mb-2 last:mb-0">
                      <div className="px-2 py-1 text-[10px] tracking-[0.18em] text-muted-foreground/80 font-semibold">
                        {provider}
                      </div>
                      <div className="space-y-1">
                        {groupedModels[provider].map((model) => (
                          <button
                            key={model.id}
                            onClick={(e) => handleModelSelect(e, model.id)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                              store.defaultModel === model.id
                                ? 'border-blue-400/50 bg-blue-500/10'
                                : 'border-transparent hover:border-border/60 hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <ModelLogo
                                provider={model.provider}
                                className={`mt-0.5 w-4 h-4 shrink-0 ${model.provider === 'OPENAI' ? 'text-foreground' : ''}`}
                              />
                              <div className="min-w-0">
                                <div className="text-[15px] font-semibold text-foreground leading-5">{model.name}</div>
                                <div className="text-xs text-muted-foreground leading-5 mt-0.5 line-clamp-2">{model.desc}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                        {groupedModels[provider].length === 0 && (
                          <div className="px-2 py-2 text-xs text-muted-foreground">无匹配模型</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto pointer-events-auto">
          <NoticePopover />
          <ContactPopover />
          <button
            onClick={store.toggleTheme}
            className="p-2.5 rounded-xl bg-card md:bg-card/50 md:backdrop-blur-xl border border-border/40 text-foreground hover:bg-muted/80 transition-all shadow-sm active:scale-95 group"
            title="切换主题"
          >
            {store.theme === 'dark' ? (
              <Moon size={18} className="fill-current text-indigo-400 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sun size={18} className="fill-current text-amber-500 group-hover:rotate-90 transition-transform" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col overflow-hidden z-0 relative min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
            {/* Google-style Hero Section */}
            <div className="text-center space-y-6 md:space-y-8 max-w-2xl">
              {/* Dynamic Model Icon */}
              <div className="mx-auto flex items-center justify-center">
                {store.defaultModel.includes('gpt') ? (
                  // OpenAI GPT Logo - 鑺辩摚褰㈢姸
                  <svg className="w-16 h-16 md:w-20 md:h-20" viewBox="0 0 24 24" fill="none">
                    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
                      className="fill-foreground"
                    />
                  </svg>
                ) : store.defaultModel.includes('grok') ? (
                  <GrokLogo className="w-16 h-16 md:w-20 md:h-20" size={80} />
                ) : store.defaultModel.includes('claude') ? (
                  <img
                    src={appAssetUrl('logo/claude-ai-icon.svg')}
                    alt=""
                    aria-hidden="true"
                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                  />
                ) : (
                  // Google Gemini Logo
                  <svg className="w-16 h-16 md:w-20 md:h-20" viewBox="0 0 28 28" fill="none">
                    <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#gemini-gradient-home)"/>
                    <defs>
                      <linearGradient id="gemini-gradient-home" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F44336"/>
                        <stop offset="0.25" stopColor="#FF9800"/>
                        <stop offset="0.5" stopColor="#4CAF50"/>
                        <stop offset="0.75" stopColor="#2196F3"/>
                        <stop offset="1" stopColor="#2196F3"/>
                      </linearGradient>
                    </defs>
                  </svg>
                )}
              </div>

              {/* Google-style Greeting */}
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-normal tracking-tight">
                  <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    你好，
                  </span>
                  <span className="text-foreground/80">有什么可以帮你？</span>
                </h1>
              </div>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%', minHeight: 0 }}
            data={messages}
            alignToBottom={true}
            followOutput={false}
            initialTopMostItemIndex={messages.length - 1}
            increaseViewportBy={200}
            components={{
              Header: () => <div className="h-20" />,
              Footer: () => <div className="h-64" />
            }}
            itemContent={(index, msg) => (
              <div className="max-w-3xl mx-auto px-4 md:px-0">
                {isStreaming && index === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground animate-pulse">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-medium">思考中...</span>
                  </div>
                )}
                <ErrorBoundary
                  fallback={
                    <div className="p-4 mb-8 border border-red-500/30 rounded-xl bg-red-500/5 text-red-500 text-sm">
                      <span className="mr-2">⚠️</span>
                      该消息渲染失败，可能包含无法解析的内容。
                    </div>
                  }
                >
                  <MessageBubble
                    message={msg}
                    isStreaming={isStreaming && index === messages.length - 1}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEditMessage}
                    onContinue={handleContinue}
                  />
                </ErrorBoundary>
              </div>
            )}
          />
        )}
      </div>

      {/* Input Area - 绉诲姩绔娇鐢ㄤ笉閫忔槑鑳屾櫙閬垮厤 GPU 娓叉煋闂 */}
      <div className="absolute bottom-0 left-0 right-0 p-2 md:p-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-background md:bg-gradient-to-t md:from-background md:via-background/90 md:to-transparent z-10 pointer-events-none transition-all duration-300">
        <div className={`${isImageMode ? 'max-w-[1120px]' : 'max-w-3xl'} mx-auto pointer-events-auto relative`}>
          {!isImageMode && (
          <div ref={modeGuideRef} className="relative mb-2 px-1">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pr-9">
              {modeOptions.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    store.setWorkMode(mode.id);
                    setShowModeGuide(false);
                  }}
                  className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                    store.workMode === mode.id
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  }`}
                  title={mode.title}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowModeGuide((prev) => !prev);
              }}
              className={`absolute right-1 top-0 h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                showModeGuide
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/60 bg-card/90 text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
              title="查看模式说明"
              aria-label="查看模式说明"
              aria-expanded={showModeGuide}
            >
              <HelpCircle size={15} />
            </button>

            {showModeGuide && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-10 left-0 right-0 z-30 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md shadow-2xl overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">模式怎么选</div>
                  <button
                    type="button"
                    onClick={() => setShowModeGuide(false)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    title="关闭"
                    aria-label="关闭模式说明"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 max-h-[52vh] overflow-y-auto custom-scrollbar">
                  {modeOptions.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        store.setWorkMode(mode.id);
                        setShowModeGuide(false);
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        store.workMode === mode.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/50 bg-card/70 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="text-primary">{mode.icon}</span>
                        <span>{mode.label}</span>
                      </div>
                      <div className="mt-1.5 text-xs leading-5 text-muted-foreground">{mode.when}</div>
                      <div className="mt-1 text-xs leading-5 text-foreground/80">{mode.example}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {!isImageMode && store.workMode === 'planning' && researchPlan && (
            <div className="mb-2 rounded-xl border border-border/60 bg-card/90 backdrop-blur-md p-3 shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList size={15} />
                  <span className="truncate">{researchPlan.title}</span>
                </div>
                <button
                  onClick={async () => {
                    await deleteResearchPlanBySession(researchPlan.sessionId);
                    setResearchPlan(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  重置
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {researchPlan.steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2 text-xs min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      step.status === 'done' ? 'bg-emerald-500' : step.status === 'active' ? 'bg-blue-500' : 'bg-muted-foreground/30'
                    }`} />
                    <span className={step.status === 'done' ? 'text-muted-foreground line-through truncate' : 'text-foreground/85 truncate'}>
                      {index + 1}. {step.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 闄勪欢灞曠ず鍒楄〃 */}
          {store.attachments.length > 0 && (
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2 px-1 custom-scrollbar">
              {store.attachments.map(att => {
                const isImage = att.type === 'image';
                const ext = att.name.split('.').pop()?.toLowerCase() || '';
                const getFileIcon = () => {
                  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet size={24} className="text-emerald-500" />;
                  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <FileImage size={24} className="text-purple-500" />;
                  return <FileText size={24} className="text-blue-500" />;
                };

                return (
                  <div key={att.id} className={`relative group w-16 h-16 rounded-lg overflow-hidden border shrink-0 transition-all ${att.included !== false ? 'border-primary/40 shadow-md' : 'border-border/50 opacity-50'}`}>
                    {isImage && att.content ? (
                      <img src={att.content} alt={att.name} className="w-16 h-16 object-cover rounded-lg border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/60">
                        {getFileIcon()}
                        <span className="text-[7px] text-muted-foreground font-bold uppercase tracking-wider">{ext}</span>
                      </div>
                    )}
                    <button onClick={() => store.toggleAttachmentInclusion(att.id)} className="absolute bottom-0.5 left-0.5 w-4 h-4 rounded bg-background/80 border border-border/50 flex items-center justify-center transition-all hover:scale-110" title="是否发送此文件">
                      {att.included !== false ? <CheckSquare size={10} className="text-primary" /> : <SquareIcon size={10} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => store.removeAttachment(att.id)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background/90 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm" title="移除附件">
                      <X size={8} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[6px] text-white truncate block font-medium">{att.name}</span>
                    </div>
                    {att.tokenCount && (
                      <div className="absolute top-0.5 left-0.5 text-[6px] font-mono text-white bg-black/50 px-0.5 py-0.5 rounded">
                        {att.tokenCount > 1000 ? `${(att.tokenCount/1000).toFixed(1)}k` : att.tokenCount}
                      </div>
                    )}
                    {(att.chunkCount || att.chunks?.length) && (
                      <div className="absolute top-0.5 right-0.5 text-[6px] font-mono text-white bg-blue-600/80 px-0.5 py-0.5 rounded" title={`已解析为 ${att.chunkCount || att.chunks?.length} 个片段`}>
                        {att.chunkCount || att.chunks?.length}段
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isImageMode ? (
            <div className="rounded-[28px] border border-border/70 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-xl p-3 md:p-4">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple accept="image/*" />
              <div
                ref={imagePromptRef}
                contentEditable={!store.isLoading && !isStreaming}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder="描述你想生成的图片，可上传参考图进行改图或风格控制..."
                className="min-h-[68px] max-h-[220px] overflow-y-auto rounded-[24px] border border-border/60 bg-background/90 px-5 py-4 text-[16px] leading-7 text-foreground outline-none transition placeholder:text-muted-foreground/40 empty:before:text-muted-foreground/40 empty:before:content-[attr(data-placeholder)] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                onInput={(e) => {
                  const target = e.currentTarget;
                  const normalizedText = target.innerText.replace(/\n{3,}/g, '\n\n').trimEnd();
                  if (!normalizedText) {
                    target.innerHTML = '';
                  }
                  store.setInput(normalizedText);
                  target.style.height = '68px';
                  target.style.height = `${Math.min(target.scrollHeight, 220)}px`;
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />

              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-300">
                <AlertCircle size={15} className="shrink-0" />
                <span>生图时间较长，通常需要 1-2 分钟，请耐心等待，生成中不要重复点击。</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[repeat(6,minmax(0,1fr))_120px]">
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">尺寸</span>
                  <select value={gptImage2Params.size} onChange={(e) => updateGptImage2Param('size', e.target.value as GptImage2Params['size'])} className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                    {imageSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">画幅</span>
                  <select value={gptImage2Params.aspectRatio} onChange={(e) => updateGptImage2Param('aspectRatio', e.target.value as GptImage2Params['aspectRatio'])} className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                    {imageRatioOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">质量</span>
                  <select value={gptImage2Params.quality} onChange={(e) => updateGptImage2Param('quality', e.target.value as GptImage2Params['quality'])} className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                    <option value="auto">auto</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">格式</span>
                  <select value={gptImage2Params.outputFormat} onChange={(e) => updateGptImage2Param('outputFormat', e.target.value as GptImage2Params['outputFormat'])} className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm uppercase outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">压缩率</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0-100"
                    value={gptImage2Params.outputCompression ?? ''}
                    disabled={gptImage2Params.outputFormat === 'png'}
                    onChange={(e) => updateGptImage2Param('outputCompression', e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground/50"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="px-2 text-xs font-medium text-muted-foreground">审核</span>
                  <select value={gptImage2Params.moderation} onChange={(e) => updateGptImage2Param('moderation', e.target.value as GptImage2Params['moderation'])} className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                    <option value="auto">auto</option>
                    <option value="low">low</option>
                  </select>
                </label>
                <div className="mt-auto flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={store.isLoading || imageAttachCount >= GPT_IMAGE2_IMAGE_LIMIT} className="h-11 w-14 rounded-2xl border border-border/70 bg-background text-muted-foreground transition hover:text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" title={`上传参考图（最多 ${GPT_IMAGE2_IMAGE_LIMIT} 张）`}>
                    {store.isLoading ? <AlertCircle size={18} className="mx-auto animate-spin" /> : <Paperclip size={18} className="mx-auto" strokeWidth={2} />}
                  </button>
                  {isStreaming ? (
                    <button onClick={handleStop} className="h-11 flex-1 rounded-2xl bg-red-500 text-white transition hover:bg-red-600" title="停止生成">
                      <SquareIcon size={14} className="mx-auto" fill="currentColor" />
                    </button>
                  ) : (
                    <button onClick={handleSend} disabled={imageModeSendDisabled} className={`h-11 flex-1 rounded-2xl transition ${imageModeSendDisabled ? 'bg-muted text-muted-foreground/50 cursor-not-allowed' : 'bg-foreground text-background hover:opacity-90'}`} title="生成图片">
                      <Send size={18} className="mx-auto" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex items-end gap-1 md:gap-2 bg-muted md:bg-muted/40 md:backdrop-blur-xl border border-border/60 rounded-[20px] md:rounded-[24px] p-1.5 md:p-2 shadow-2xl shadow-black/10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-muted transition-all duration-300">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />

              <button onClick={() => fileInputRef.current?.click()} disabled={store.isLoading} className={`p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors shrink-0 ${store.isLoading ? 'animate-pulse opacity-50 cursor-wait' : ''}`} title="上传文件">
                {store.isLoading ? <AlertCircle size={16} className="md:w-[18px] md:h-[18px] animate-spin" /> : <Paperclip size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2} />}
              </button>

              {(store.defaultModel === 'gemini-3.1-pro-preview' ||
                store.defaultModel === 'gemini-3.5-flash-preview') && (
                <button
                  onClick={(e) => { e.stopPropagation(); store.toggleWebSearch(); }}
                  className={`p-2 md:p-3 rounded-full transition-colors shrink-0 ${store.isWebSearchEnabled ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                  title={store.isWebSearchEnabled ? '已开启联网搜索' : '点击开启联网搜索'}
                >
                  <Globe size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
              )}

              <textarea
                ref={textareaRef}
                value={store.input}
                onChange={(e) => {
                  store.setInput(e.target.value);
                  if (!e.target.value) {
                    const minHeight = window.innerWidth < 768 ? 40 : 44;
                    e.target.style.height = `${minHeight}px`;
                    e.target.style.overflowY = 'hidden';
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onPaste={handlePaste}
                placeholder={store.isLoading ? "正在解析文件，请稍候..." : store.workMode === 'research' ? "询问论文创新点、方法、实验、局限..." : store.workMode === 'planning' ? "描述你的研究任务或继续推进计划..." : store.workMode === 'uiux' ? "描述页面、流程或需要评审的设计..." : "在此输入内容...（可粘贴图片）"}
                className="flex-1 bg-transparent border-none resize-none max-h-[150px] md:max-h-[200px] min-h-[40px] md:min-h-[44px] py-2.5 md:py-3 text-[14px] focus:ring-0 focus:outline-none placeholder:text-muted-foreground/40 font-sans tracking-wide transition-[height] duration-150 ease-out"
                rows={1}
                style={{ height: '40px', overflowY: 'hidden' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  const minHeight = window.innerWidth < 768 ? 40 : 44;
                  const maxHeight = window.innerWidth < 768 ? 150 : 200;
                  if (!target.value.trim()) {
                    target.style.height = `${minHeight}px`;
                    target.style.overflowY = 'hidden';
                    return;
                  }
                  target.style.height = 'auto';
                  const newHeight = Math.min(Math.max(target.scrollHeight, minHeight), maxHeight);
                  target.style.height = `${newHeight}px`;
                  target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
                }}
              />

              {isStreaming ? (
                <button onClick={handleStop} className="group p-1.5 md:p-2 rounded-full transition-all duration-300 ease-in-out shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 shadow-md bg-red-500 hover:bg-red-600 text-white hover:scale-110 active:scale-95 z-50 relative touch-manipulation cursor-pointer pointer-events-auto" title="停止生成">
                  <SquareIcon size={12} className="md:w-[14px] md:h-[14px]" fill="currentColor" />
                </button>
              ) : (
                <button onClick={handleSend} disabled={(!store.input.trim() && store.attachments.filter(a => a.included !== false).length === 0) || store.isLoading} className={`p-1.5 md:p-2 rounded-full transition-all duration-300 ease-out shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 z-50 relative touch-manipulation cursor-pointer pointer-events-auto ${(store.input.trim() || store.attachments.filter(a => a.included !== false).length > 0) ? 'bg-foreground text-background shadow-lg scale-100 hover:scale-110 active:scale-95 opacity-100' : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed scale-90 opacity-50'}`}>
                  <Send size={16} className={`md:w-[18px] md:h-[18px] ${store.input.trim() ? "ml-0.5" : ""}`} />
                </button>
              )}
            </div>
          )}

          <div className="flex justify-between items-center gap-3 mt-3 px-2">
            <div className="text-[10px] text-muted-foreground/50 font-mono flex items-center gap-2 transition-all">
              {isImageMode ? (
                <div className="flex flex-wrap items-center gap-3 text-[10px]">
                  <span>Model: <span className="text-foreground/80">GPT-Image-2</span></span>
                  <span className="w-px h-2.5 bg-border/50"></span>
                  <span>Refs: <span className="text-foreground/80">{imageAttachCount}/{GPT_IMAGE2_IMAGE_LIMIT}</span></span>
                  <span className="w-px h-2.5 bg-border/50"></span>
                  <span>Size: <span className="text-foreground/80">{gptImage2Params.size.toUpperCase()}</span></span>
                  <span className="w-px h-2.5 bg-border/50"></span>
                  <span>Ratio: <span className="text-foreground/80">{gptImage2Params.aspectRatio}</span></span>
                </div>
              ) : store.input.trim() || store.attachments.filter(a => a.included !== false).length > 0 ? (
                <span className="text-[10px] font-mono text-muted-foreground/80 flex flex-wrap gap-y-1">
                  <span className={historyTokens > 1000 ? "text-red-500 font-bold" : ""}>
                    History: {historyTokens.toLocaleString()}
                  </span>
                  <span className="mx-1">|</span>
                  <span className={conversationMemory ? "text-emerald-500 font-bold" : messages.length >= 20 ? "text-amber-500 font-bold" : ""}>
                    {memoryStatusText}
                  </span>
                  <span className="mx-1">+</span>
                  <span className="font-bold text-foreground">
                    Input: {inputTokens.toLocaleString()}
                  </span>
                  <span className="mx-1">=</span>
                  <span className="font-bold text-primary">
                    Total: {(historyTokens + inputTokens).toLocaleString()}
                  </span>
                  {sysTokens > 0 && (
                    <>
                      <span className="mx-1 text-muted-foreground/30">+</span>
                      <span title="系统预设" className="text-red-500 font-bold">
                        Sys: {sysTokens.toLocaleString()}
                      </span>
                    </>
                  )}
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  <span title="提问消耗（Prompt Tokens）">Input: <span className="text-foreground/70">{lastUsage ? lastUsage.prompt.toLocaleString() : '--'}</span></span>
                  <span className="w-px h-2.5 bg-border/50"></span>
                  <span title="回答消耗（Completion Tokens）">Output: <span className="text-foreground/70">{lastUsage ? lastUsage.completion.toLocaleString() : '--'}</span></span>
                  {!isImageMode && conversationMemory && (
                    <>
                      <span className="w-px h-2.5 bg-border/50"></span>
                      <span title="当前话题记忆" className="text-emerald-500">Memory: {conversationMemory.tokenCount.toLocaleString()}</span>
                    </>
                  )}
                </div>
              )}
              {!isImageMode && store.userSystemPrompt && !store.input.trim() && store.attachments.filter(a => a.included !== false).length === 0 && (
                <span className="text-red-500 font-bold">系统预设已生效（约 {sysTokens.toLocaleString()} tokens）</span>
              )}
            </div>

            {!isImageMode && (
              <button
                type="button"
                onClick={() => organizeConversationMemory('manual')}
                disabled={memoryButtonDisabled}
                className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                  conversationMemory
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={
                  !store.currentSessionId
                    ? '新建话题后可整理记忆'
                    : !shouldAllowManualMemory(messages)
                    ? '当前对话较短，暂时无需整理'
                    : conversationMemory
                    ? '重新整理当前话题记忆'
                    : '整理当前话题记忆'
                }
              >
                <Brain size={13} />
                <span>{isOrganizingMemory ? '整理中...' : conversationMemory ? '已整理' : '整理记忆'}</span>
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
