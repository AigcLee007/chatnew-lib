import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { db, createSession, saveMessage } from '../lib/db';
import { processFile } from '../lib/file-processor';
import { countTokens } from '../lib/token';
import { Message, ModelId } from '../types';
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
  Sparkles
} from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { NoticePopover } from './NoticePopover';

// 馃洝锔?鍏煎鎬т慨澶嶏細鍦?HTTP 鐜涓嬪洖閫€鍒?Math.random
const safeUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  const [modelQuery, setModelQuery] = useState('');

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendLockRef = useRef(false);

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
    const SAFETY_RATIO = 0.75;
    const TOKEN_BUDGET = model.includes('gpt')
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

    const contextMessages = buildContextWindow([...history, newUserMsg], store.defaultModel);

    await startStream({
      apiKey: store.apiKey,
      model: store.defaultModel,
      messages: contextMessages,
      attachments: newUserMsg.attachments || [],
      userSystemPrompt: store.userSystemPrompt,
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
    const contextMessages = buildContextWindow(history, regenModel);

    await startStream({
      apiKey: store.apiKey,
      model: regenModel,
      messages: contextMessages,
      attachments: lastUserMsg.attachments || [],
      userSystemPrompt: store.userSystemPrompt,
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
    const contextMessages = buildContextWindow(history, continueModel);

    await startStream({
      apiKey: store.apiKey,
      model: continueModel,
      messages: contextMessages,
      attachments: [],
      userSystemPrompt: store.userSystemPrompt,
      sessionId: targetMsg.sessionId,
      existingMsgId: msgId,
      isWebSearchEnabled: store.isWebSearchEnabled,
      onMessageUpdate: updateMessageContent,
      onError: (id, content) => updateMessageContent(id, content),
    });
  };


  const handleSend = async () => {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    try {
      const activeAttachments = store.attachments.filter(a => a.included !== false);
      if ((!store.input.trim() && activeAttachments.length === 0) || isStreaming) return;

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

      const userMsg: Message = {
        id: safeUuid(),
        sessionId,
        role: 'user',
        content: store.input,
        timestamp: Date.now(),
        attachments: [...activeAttachments]
      };

      if (isNewSession) {
        if (store.defaultModel === 'gemini-2.5-flash-image') {
          const botMsgId = safeUuid();
          const botMsg: Message = {
            id: botMsgId,
            sessionId,
            role: 'assistant',
            content: '正在调用 Gemini 2.5 绘图...',
            timestamp: Date.now() + 1,
            model: store.defaultModel
          };

          await saveMessage(userMsg);
          await saveMessage(botMsg);
          store.setSessionId(sessionId);

          store.setInput('');
          store.clearAttachments();
          resetTextareaHeight();

          await startImageGeneration({
            apiKey: store.apiKey,
            model: store.defaultModel,
            prompt: userMsg.content,
            attachments: userMsg.attachments || [],
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

        const contextMessages = buildContextWindow([...safeHistory, userMsg], store.defaultModel);

        await startStream({
          apiKey: store.apiKey,
          model: store.defaultModel,
          messages: contextMessages,
          attachments: userMsg.attachments || [],
          userSystemPrompt: store.userSystemPrompt,
          sessionId,
          existingMsgId: botMsgId,
          isWebSearchEnabled: store.isWebSearchEnabled,
          onMessageCreated: (msg) => {
            if (!isNewSession) setMessages(prev => [...prev, msg]);
          },
          onMessageUpdate: updateMessageContent,
          onError: (id, content) => updateMessageContent(id, content),
        });
      } else {
        await addMessage(userMsg);
        store.setInput('');
        store.clearAttachments();
        resetTextareaHeight();

        if (store.defaultModel === 'gemini-2.5-flash-image') {
          await startImageGeneration({
            apiKey: store.apiKey,
            model: store.defaultModel,
            prompt: userMsg.content,
            attachments: userMsg.attachments || [],
            sessionId,
            onMessageCreated: (msg) => setMessages(prev => [...prev, msg]),
            onComplete: (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)),
            onError: (id, content) => updateMessageContent(id, content),
          });
          return;
        }

        const safeHistory = isNewSession ? [] : messages;

        const contextMessages = buildContextWindow([...safeHistory, userMsg], store.defaultModel);

        await startStream({
          apiKey: store.apiKey,
          model: store.defaultModel,
          messages: contextMessages,
          attachments: userMsg.attachments || [],
          userSystemPrompt: store.userSystemPrompt,
          sessionId,
          isWebSearchEnabled: store.isWebSearchEnabled,
          onMessageCreated: (msg) => setMessages(prev => [...prev, msg]),
          onMessageUpdate: updateMessageContent,
          onError: (id, content) => updateMessageContent(id, content),
        });
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
    store.setModel(modelId);
    setShowModelMenu(false);
  };

  const ModelLogo: React.FC<{ provider: 'GEMINI' | 'OPENAI'; className?: string }> = ({ provider, className }) => {
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
    provider: 'GEMINI' | 'OPENAI';
  }> = [
    {
      id: 'gemini-3.1-flash-preview',
      name: 'Gemini-3.1-flash',
      desc: 'Gemini 3.1 Flash：主打速度与低延迟，适合日常高频对话。',
      provider: 'GEMINI',
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini-3.1-pro',
      desc: 'Gemini 3.1 Pro：推理更强，适合复杂分析与长文任务。',
      provider: 'GEMINI',
    },
    {
      id: 'gemini-2.5-flash-image',
      name: 'Nano banana（绘图）',
      desc: 'Gemini 2.5 Flash Image：图像理解与生图能力。',
      provider: 'GEMINI',
    },
    {
      id: 'gpt-5.4',
      name: 'Gpt-5.4',
      desc: 'GPT-5.4：新一代通用高性能模型，代码、推理、写作均衡。',
      provider: 'OPENAI',
    },
    {
      id: 'gpt-5.3-codex',
      name: 'Gpt-5.3-Codex',
      desc: 'GPT-5.3 Codex：偏向工程实现与代码生成。',
      provider: 'OPENAI',
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
  };

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
                  {(['GEMINI', 'OPENAI'] as const).map((provider) => (
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
          <a
            href="https://math.aittco.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3 rounded-xl border border-emerald-500/25 bg-card/90 backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            title="新版全能网站"
          >
            <Sparkles size={14} />
            <span>新版全能网站</span>
          </a>
          <NoticePopover />
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
        <div className="max-w-3xl mx-auto pointer-events-auto relative">

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
                  </div>
                );
              })}
            </div>
          )}

          {/* 杈撳叆妗嗕富瀹瑰櫒 */}
          <div className="relative flex items-end gap-1 md:gap-2 bg-muted md:bg-muted/40 md:backdrop-blur-xl border border-border/60 rounded-[20px] md:rounded-[24px] p-1.5 md:p-2 shadow-2xl shadow-black/10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-muted transition-all duration-300">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
            
            <button onClick={() => fileInputRef.current?.click()} disabled={store.isLoading} className={`p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors shrink-0 ${store.isLoading ? 'animate-pulse opacity-50 cursor-wait' : ''}`} title="上传文件">
              {store.isLoading ? <AlertCircle size={16} className="md:w-[18px] md:h-[18px] animate-spin" /> : <Paperclip size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2} />}
            </button>

            {/* 鑱旂綉鎸夐挳浠呭湪 Gemini 鍘熺敓妯″瀷鏃舵樉绀猴紙鎺掗櫎 nano-banana 鐢诲浘妯″瀷锛?*/}
            {(store.defaultModel === 'gemini-3.1-pro-preview' || 
              store.defaultModel === 'gemini-3.1-flash-preview') && (
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
                // 褰撳唴瀹硅娓呯┖鏃讹紝绔嬪嵆閲嶇疆楂樺害
                if (!e.target.value) {
                  const minHeight = window.innerWidth < 768 ? 40 : 44;
                  e.target.style.height = `${minHeight}px`;
                  e.target.style.overflowY = 'hidden';
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
              placeholder={store.isLoading ? "正在解析文件，请稍候..." : "在此输入内容...（可粘贴图片）"}
              className="flex-1 bg-transparent border-none resize-none max-h-[150px] md:max-h-[200px] min-h-[40px] md:min-h-[44px] py-2.5 md:py-3 text-[14px] focus:ring-0 focus:outline-none placeholder:text-muted-foreground/40 font-sans tracking-wide transition-[height] duration-150 ease-out"
              rows={1}
              style={{ height: '40px', overflowY: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                const minHeight = window.innerWidth < 768 ? 40 : 44;
                const maxHeight = window.innerWidth < 768 ? 150 : 200;
                
                // 如果内容为空，重置为最小高度
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
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  handleStop();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleStop();
                }}
                className="group p-1.5 md:p-2 rounded-full transition-all duration-300 ease-in-out shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 shadow-md bg-red-500 hover:bg-red-600 text-white hover:scale-110 active:scale-95 z-50 relative touch-manipulation cursor-pointer pointer-events-auto" 
                title="停止生成"
              >
                <SquareIcon size={12} className="md:w-[14px] md:h-[14px]" fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                disabled={(!store.input.trim() && store.attachments.filter(a => a.included !== false).length === 0) || store.isLoading} 
                className={`p-1.5 md:p-2 rounded-full transition-all duration-300 ease-out shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 z-50 relative touch-manipulation cursor-pointer pointer-events-auto ${(store.input.trim() || store.attachments.filter(a => a.included !== false).length > 0) ? 'bg-foreground text-background shadow-lg scale-100 hover:scale-110 active:scale-95 opacity-100' : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed scale-90 opacity-50'}`}
              >
                <Send size={16} className={`md:w-[18px] md:h-[18px] ${store.input.trim() ? "ml-0.5" : ""}`} />
              </button>
            )}
          </div>
          
          <div className="flex justify-start items-center mt-3 px-2">
            <div className="text-[10px] text-muted-foreground/50 font-mono flex items-center gap-2 transition-all">
              {store.input.trim() || store.attachments.filter(a => a.included !== false).length > 0 ? (
                <span className="text-[10px] font-mono text-muted-foreground/80 flex flex-wrap gap-y-1">
                  <span className={historyTokens > 1000 ? "text-red-500 font-bold" : ""}>
                    History: {historyTokens.toLocaleString()}
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
                </div>
              )}
              {store.userSystemPrompt && !store.input.trim() && store.attachments.filter(a => a.included !== false).length === 0 && (
                <span className="text-red-500 font-bold">系统预设已生效（约 {sysTokens.toLocaleString()} tokens）</span>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
