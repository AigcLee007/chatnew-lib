import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { db } from '../lib/db';
import { checkBalance, BalanceResult } from '../lib/api-client';
import { appAssetUrl } from '../lib/base-path';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X,
  Key,
  Cpu,
  Eye,
  EyeOff,
  Search,
  Save,
  Trash2,
  Loader2,
  Download,
  Upload,
  Globe,
  Mail,
  Megaphone,
  Send,
  Terminal,
  Database,
  Sun,
  Moon,
  Bell,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ModelId } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'general' | 'prompts' | 'data' | 'admin';
const ADMIN_SK = 'sk-K9OJf52OughwT8vizrDKJpvMebzutpbKVXxxhYe8EZFF0nm7';

const MODEL_OPTIONS: { id: ModelId; label: string; desc: string }[] = [
  { id: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview', desc: '高质量推理与复杂任务' },
  { id: 'gemini-3.5-flash-preview', label: 'gemini-3.5-flash-preview', desc: '速度快，适合高频对话' },
  { id: 'gpt-5.5', label: 'GPT-5.5', desc: 'OpenAI 最新旗舰，适合高难度推理与复杂任务' },
  { id: 'gpt-5.4', label: 'Gpt-5.4', desc: '通用能力均衡' },
  { id: 'gpt-image-2', label: 'gpt-image-2', desc: 'OpenAI 生图模型' },
  { id: 'grok-4.6', label: 'Grok 4.6', desc: 'xAI 高性能推理模型，适合复杂分析与代码任务' },
  { id: 'grok-4.5', label: 'Grok 4.5', desc: 'xAI 通用模型，适合日常对话与业务分析' },
  { id: 'claude-opus-5', label: 'Claude Opus 5', desc: 'Anthropic 旗舰模型，适合深度推理与长任务分析' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', desc: '速度与能力兼顾，适合日常专业任务' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', desc: 'Anthropic Claude 高质量推理模型' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', desc: 'Anthropic Claude 高质量推理模型' },
];

const PROMPT_PRESETS = [
  {
    title: '代码专家',
    content: '你是一名资深全栈工程师，请帮我审查这段代码，指出潜在的性能问题、安全漏洞，并提供优化后的代码版本。',
  },
  {
    title: '文案润色',
    content: '请将以下文案润色成更自然、专业、有说服力的版本，保留原意并增强表达效果。',
  },
  {
    title: '英语翻译',
    content: '请把以下内容翻译成自然流畅的英文，并提供正式版与口语版两个版本。',
  },
  {
    title: '周报生成',
    content: '请根据以下素材整理一份结构清晰的工作周报，包含本周进展、问题风险、下周计划。',
  },
  {
    title: '海报设计',
    content: '请生成一份高质量海报提示词，包含主题、风格、配色、构图、文案位置、画幅比例。',
  },
  {
    title: '各种角色',
    content: '请先询问我角色类型与目标，再按角色语气与身份输出专业回答。',
  },
];

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    apiKey,
    setApiKey,
    defaultModel,
    setModel,
    userSystemPrompt,
    setUserSystemPrompt,
    theme,
    toggleTheme,
    isWebSearchEnabled,
    setWebSearchEnabled,
    publishNotice,
    adminNotices,
    adminTotal,
    adminPage,
    adminPageSize,
    adminSearch,
    isAdminLoading,
    setAdminPage,
    setAdminSearch,
    updateNotice,
    deleteNotice,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');
  const [checkError, setCheckError] = useState(false);
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  const [keyQuotaResult, setKeyQuotaResult] = useState<BalanceResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [isWechatPreviewOpen, setIsWechatPreviewOpen] = useState(false);

  const prompts = useLiveQuery(() => db.prompts.orderBy('createdAt').reverse().toArray(), []);

  const canUseWebSearch = useMemo(
    () => defaultModel === 'gemini-3.1-pro-preview' || defaultModel === 'gemini-3.5-flash-preview',
    [defaultModel]
  );

  useEffect(() => {
    if (activeTab === 'admin' && apiKey === ADMIN_SK) {
      setAdminPage(1);
    }
  }, [activeTab, apiKey, setAdminPage]);

  useEffect(() => {
    if (!saveStatus) return;
    const timer = setTimeout(() => setSaveStatus(''), 1800);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    if (!checkStatus) return;
    const timer = setTimeout(() => setCheckStatus(''), 2400);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  if (!isOpen) return null;

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return '--';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : String(value);
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber.toLocaleString();
    return String(value);
  };

  const formatMoney = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return '--';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return `$${n.toFixed(2)}`;
  };

  const quotaTotal = Number(keyQuotaResult?.total ?? NaN);
  let quotaUsed = Number(keyQuotaResult?.used ?? NaN);
  const quotaRemaining = Number(keyQuotaResult?.remain ?? NaN);
  if (Number.isNaN(quotaUsed) && !Number.isNaN(quotaTotal) && !Number.isNaN(quotaRemaining)) {
    quotaUsed = quotaTotal - quotaRemaining;
  }
  const hasQuotaNumbers = !Number.isNaN(quotaTotal) && !Number.isNaN(quotaRemaining) && !Number.isNaN(quotaUsed);
  const remainPercent = hasQuotaNumbers && quotaTotal > 0
    ? Math.max(0, Math.min(100, (quotaRemaining / quotaTotal) * 100))
    : null;

  const handleCheckApiKey = async () => {
    const key = apiKey.trim();
    if (!key) {
      setCheckError(true);
      setCheckStatus('请输入 API Key');
      setKeyQuotaResult(null);
      return;
    }
    if (!key.startsWith('sk-')) {
      setCheckError(true);
      setCheckStatus('Key 格式看起来不正确');
      setKeyQuotaResult(null);
      return;
    }

    setIsCheckingQuota(true);
    setCheckError(false);
    setCheckStatus('正在查询额度信息...');
    setKeyQuotaResult(null);

    try {
      const result = await checkBalance(key);
      if (result.error) {
        setCheckError(true);
        setCheckStatus(result.error);
        setKeyQuotaResult(null);
      } else {
        setCheckError(false);
        setKeyQuotaResult(result);
        if (key === ADMIN_SK) {
          setCheckStatus('管理员 Key 已启用，额度信息已更新');
        } else {
          setCheckStatus('额度查询成功');
        }
      }
    } catch (error) {
      setCheckError(true);
      setCheckStatus(error instanceof Error ? error.message : '查询失败，请稍后再试');
      setKeyQuotaResult(null);
    } finally {
      setIsCheckingQuota(false);
    }
  };

  const handleSaveSettings = () => {
    setSaveStatus('设置已保存');
  };

  const handleBuyCredits = () => {
    window.open('https://item.taobao.com/item.htm?id=975150888957', '_blank', 'noopener,noreferrer');
  };

  const handleExportData = async () => {
    const sessions = await db.sessions.toArray();
    const messages = await db.messages.toArray();
    const promptsData = await db.prompts.toArray();
    const conversationMemories = await db.conversationMemories.toArray();
    const settings = {
      apiKey,
      defaultModel,
      userSystemPrompt,
      theme,
      isWebSearchEnabled,
    };

    const data = { sessions, messages, prompts: promptsData, conversationMemories, settings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatvip-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.sessions) await db.sessions.bulkPut(data.sessions);
        if (data.messages) await db.messages.bulkPut(data.messages);
        if (data.prompts) await db.prompts.bulkPut(data.prompts);
        if (data.conversationMemories) await db.conversationMemories.bulkPut(data.conversationMemories);

        if (data.settings) {
          setApiKey(data.settings.apiKey || '');
          const importedModel = data.settings.defaultModel;
          const migratedModel = importedModel === 'gemini-3.1-flash-preview'
            ? 'gemini-3.5-flash-preview'
            : importedModel === 'gpt-5.2-all'
            ? 'gpt-5.4'
            : importedModel === 'gpt-5.2-thinking' || importedModel === 'gpt-5.3-codex'
            ? 'gpt-5.5'
            : importedModel || 'gemini-3.5-flash-preview';
          setModel(migratedModel as ModelId);
          setUserSystemPrompt(data.settings.userSystemPrompt || '');
          if (data.settings.theme && data.settings.theme !== theme) {
            toggleTheme();
          }
          if (typeof data.settings.isWebSearchEnabled === 'boolean') {
            setWebSearchEnabled(data.settings.isWebSearchEnabled);
          }
        }

        setImportStatus('导入成功，正在刷新页面...');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setImportStatus('导入失败，JSON 格式不正确');
      }
    };
    reader.readAsText(file);
  };

  const applyPreset = (title: string, content: string) => {
    setNewPromptTitle(title);
    setNewPromptContent(content);
  };

  const handleSavePrompt = async () => {
    const title = newPromptTitle.trim();
    const content = newPromptContent.trim();
    if (!title || !content) return;

    await db.prompts.add({
      id: uuidv4(),
      title,
      content,
      createdAt: Date.now(),
    });

    setNewPromptTitle('');
    setNewPromptContent('');
  };

  const handleDeletePrompt = async (id: string) => {
    await db.prompts.delete(id);
  };

  const handlePublish = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    setIsPublishing(true);
    try {
      await publishNotice(noticeTitle, noticeContent, isActive, isPinned);
      setNoticeTitle('');
      setNoticeContent('');
      setIsPinned(false);
      setIsActive(true);
      alert('公告发布成功');
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[860px] bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col h-[88vh] overflow-hidden">
        <div className="border-b border-border/50 bg-muted/30">
          <div className="flex justify-between items-center px-6 py-4">
            <h2 className="text-3xl md:text-4xl font-semibold">{activeTab === 'general' ? '全局设置' : 'AI Chat 设置'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-full text-muted-foreground transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="flex px-6 gap-7 overflow-x-auto">
            <button onClick={() => setActiveTab('general')} className={`pb-3 text-base font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'general' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Cpu size={18} />通用设置</button>
            <button onClick={() => setActiveTab('prompts')} className={`pb-3 text-base font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'prompts' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Terminal size={18} />提示词库</button>
            <button onClick={() => setActiveTab('data')} className={`pb-3 text-base font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'data' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Database size={18} />数据备份</button>
            {apiKey === ADMIN_SK && (
              <button onClick={() => setActiveTab('admin')} className={`pb-3 text-base font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'admin' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Megaphone size={18} />公告管理</button>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-background/50 custom-scrollbar">
          {activeTab === 'general' && (
            <div className="max-w-4xl space-y-5">
              <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <Key size={15} />
                API KEY (密钥)
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-muted border border-border rounded-2xl px-4 pr-12 py-3 text-base font-mono focus:ring-2 focus:ring-primary/20"
                    placeholder="请输入 sk- 开头的 API Key"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="md:w-[140px] py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 text-white text-lg font-semibold hover:opacity-95 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                >
                  <Save size={17} />
                  保存
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleCheckApiKey}
                  disabled={isCheckingQuota}
                  className="w-full py-3 rounded-2xl border border-border bg-muted hover:bg-accent text-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCheckingQuota ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                  {isCheckingQuota ? '查询中...' : '查询余额'}
                </button>
                <button
                  onClick={handleBuyCredits}
                  className={`w-full py-3 rounded-2xl border text-lg font-medium flex items-center justify-center gap-2 ${
                    theme === 'light'
                      ? 'border-amber-500 bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 text-amber-800'
                      : 'border-amber-600/50 bg-gradient-to-r from-amber-900/40 to-red-900/40 hover:from-amber-800/40 hover:to-red-800/40 text-amber-300'
                  }`}
                >
                  <Cpu size={17} />
                  购买额度
                </button>
              </div>

              {checkStatus && <div className={`text-sm ${checkError ? 'text-red-400' : 'text-emerald-400'}`}>{checkStatus}</div>}
              {saveStatus && <p className="text-sm text-primary">{saveStatus}</p>}

              {keyQuotaResult && (
                <div className="mt-2 p-3 rounded-2xl border border-border bg-muted/20">
                  <div className="grid grid-cols-3 divide-x divide-border/50">
                    <div className="px-4 py-2 text-center">
                      <div className="text-xs text-muted-foreground mb-1">总额度</div>
                      <div className="text-lg font-semibold">{formatMoney(keyQuotaResult.total ?? null)}</div>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <div className="text-xs text-muted-foreground mb-1">已使用</div>
                      <div className="text-lg font-semibold">{formatMoney(Number.isNaN(quotaUsed) ? null : quotaUsed)}</div>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <div className="text-xs text-muted-foreground mb-1">剩余</div>
                      <div className="text-lg font-semibold text-emerald-500">
                        {formatMoney(keyQuotaResult.remain ?? null)}
                        {remainPercent !== null && (
                          <span className="ml-1 text-sm text-muted-foreground">({remainPercent.toFixed(0)}%)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`rounded-2xl border px-4 py-4 leading-relaxed ${
                  theme === 'light'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                }`}
              >
                <span className="font-semibold">合规声明：</span>
                本站 API 仅限合规技术研发及学术测试使用。用户须严格遵守《生成式人工智能服务管理暂行办法》，严禁利用本平台接口生成或传播违法违规内容。本平台不对用户行为承担连带法律责任。
              </div>

              <div className="relative pt-4 pb-2 flex flex-col items-center">
                <div className="absolute w-44 h-44 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
                <button
                  onClick={() => setIsWechatPreviewOpen(true)}
                  className="relative w-36 h-36 rounded-2xl border border-border bg-card p-2 shadow-xl transition-transform hover:scale-[1.03] cursor-zoom-in"
                  title="点击放大二维码"
                >
                  <img src={appAssetUrl('wechat.png')} alt="微信二维码" className="w-full h-full object-cover rounded-xl" />
                </button>
                <div className="mt-3 text-sm text-muted-foreground">扫码联系技术支持</div>
                <div className="mt-1 text-xs text-muted-foreground/70">点击二维码可放大</div>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-5 bg-muted/20 border border-border rounded-2xl space-y-4">
                <div className="text-sm font-semibold text-muted-foreground">推荐预设</div>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      onClick={() => applyPreset(preset.title, preset.content)}
                      className="px-3 py-1.5 rounded-full bg-background border border-border hover:bg-accent text-sm"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>

                <input
                  value={newPromptTitle}
                  onChange={(e) => setNewPromptTitle(e.target.value)}
                  placeholder="提示词名称"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-lg"
                />
                <textarea
                  value={newPromptContent}
                  onChange={(e) => setNewPromptContent(e.target.value)}
                  placeholder="提示词内容"
                  className="w-full h-28 bg-background border border-border rounded-xl p-4 text-lg resize-none"
                />
                <button
                  onClick={handleSavePrompt}
                  disabled={!newPromptTitle.trim() || !newPromptContent.trim()}
                  className="w-full py-3 bg-foreground text-background rounded-xl text-lg font-semibold hover:opacity-90 disabled:opacity-40"
                >
                  保存到库
                </button>
              </div>

              <div className="space-y-3">
                <div className="text-2xl font-semibold">已保存 ({prompts?.length || 0})</div>
                <div className="space-y-2">
                  {prompts?.map((p) => (
                    <div key={p.id} className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.content}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => applyPreset(p.title, p.content)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent">
                          填充
                        </button>
                        <button onClick={() => handleDeletePrompt(p.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {prompts?.length === 0 && (
                    <div className="text-sm text-muted-foreground">还没有保存的提示词。</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8 max-w-4xl">
              <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                <div className="text-3xl font-semibold mb-3 flex items-center gap-3"><Bell size={24} className="text-blue-500" />数据备份与恢复</div>
                <p className="text-lg text-muted-foreground">
                  你的聊天记录保存在本地浏览器。建议定期导出 JSON 备份，避免清缓存导致数据丢失。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <button onClick={handleExportData} className="p-10 border border-border rounded-2xl hover:bg-muted transition-all flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Download size={28} className="text-primary" />
                  </div>
                  <span className="text-2xl font-semibold">导出全量备份 (JSON)</span>
                </button>

                <label className="p-10 border border-border rounded-2xl hover:bg-muted transition-all flex flex-col items-center gap-3 cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload size={28} className="text-primary" />
                  </div>
                  <span className="text-2xl font-semibold">恢复备份</span>
                  <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
                </label>
              </div>

              {importStatus && <div className="text-sm text-primary">{importStatus}</div>}
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 bg-muted/30 border border-border/50 rounded-xl mb-4 shrink-0 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold flex items-center gap-2"><Megaphone size={16} className="text-primary" /> 发布公告</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded border-border" />置顶</label>
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />启用</label>
                  </div>
                </div>
                <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="标题..." className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/10" />
                <textarea value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} placeholder="内容..." className="w-full h-20 bg-background border border-border/60 rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/10" />
                <button onClick={handlePublish} disabled={isPublishing || !noticeTitle.trim() || !noticeContent.trim()} className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">{isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}点击发布</button>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="relative mb-3 flex items-center gap-3 shrink-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="搜索管理..." className="flex-1 bg-muted/40 border border-border/40 rounded-lg pl-9 pr-4 py-2 text-xs outline-none" />
                </div>

                <div className="flex-1 overflow-y-auto border border-border/40 rounded-xl bg-background divide-y divide-border/20 shadow-inner">
                  {isAdminLoading ? (
                    <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin opacity-40" /></div>
                  ) : adminNotices.length === 0 ? (
                    <div className="p-12 text-center opacity-40 text-sm">暂无符合条件的公告</div>
                  ) : (
                    adminNotices.map((n) => (
                      <div key={n.id} className={`p-4 flex items-center gap-4 hover:bg-muted/30 transition-all group ${!n.active ? 'opacity-40' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {n.pinned && <span className="px-1 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">PIN</span>}
                            <h4 className="text-sm font-semibold truncate">{n.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{n.content}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => updateNotice(n.id, { pinned: !n.pinned })} className={`p-1.5 rounded-lg transition-all ${n.pinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}>
                            <Megaphone size={14} />
                          </button>
                          <button onClick={() => updateNotice(n.id, { active: !n.active })} className={`p-1.5 rounded-lg transition-all ${n.active ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}>
                            <Cpu size={14} />
                          </button>
                          <button onClick={() => { if (confirm('确认删除该公告？')) deleteNotice(n.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="py-3 flex justify-center items-center gap-4 shrink-0">
                  <button disabled={adminPage <= 1} onClick={() => setAdminPage(adminPage - 1)} className="px-3 py-1.5 border border-border/60 rounded-lg disabled:opacity-20 hover:bg-muted text-xs">上一页</button>
                  <span className="text-xs font-mono text-muted-foreground">{adminPage} / {Math.ceil(adminTotal / adminPageSize) || 1}</span>
                  <button disabled={adminPage * adminPageSize >= adminTotal} onClick={() => setAdminPage(adminPage + 1)} className="px-3 py-1.5 border border-border/60 rounded-lg disabled:opacity-20 hover:bg-muted text-xs">下一页</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isWechatPreviewOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsWechatPreviewOpen(false)}
        >
          <div
            className="relative bg-card border border-border rounded-2xl p-4 max-w-[92vw] max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsWechatPreviewOpen(false)}
              className="absolute top-2 right-2 p-2 rounded-full hover:bg-accent text-muted-foreground"
            >
              <X size={18} />
            </button>
            <img
              src={appAssetUrl('wechat.png')}
              alt="微信二维码放大预览"
              className="w-[360px] h-[360px] max-w-[78vw] max-h-[78vw] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};


