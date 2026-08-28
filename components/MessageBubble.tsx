import React, { useMemo, useState, useEffect, memo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { appAssetUrl } from '../lib/base-path';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  User, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  RefreshCw, 
  Eye, 
  Code2, 
  FileText, 
  Download, 
  Presentation, 
  Volume2, 
  StopCircle,
  Pencil, 
  Save,   
  X,
  Maximize2,
  Play,
  ChevronDown,
  Brain
} from 'lucide-react';
import { Message } from '../types';
import { ArtifactPreview } from './ArtifactPreview';
import { MermaidDiagram } from './MermaidDiagram';
import { exportToWord } from '../lib/word-exporter';
import { exportToPPT } from '../lib/ppt-exporter';
import { GrokLogo } from './GrokLogo';

interface Props {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onContinue?: (id: string) => void;
}

// ----------------------------------------------------------------------
// 1. 增强版代码块 (带语法高亮) - 提取为独立组件并 memo
// ----------------------------------------------------------------------

// 常见编程语言列表
const PROGRAMMING_LANGUAGES = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'c', 'cpp', 'c++',
  'csharp', 'cs', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r',
  'sql', 'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
  'markdown', 'md', 'bash', 'sh', 'shell', 'powershell', 'ps1', 'dockerfile',
  'makefile', 'cmake', 'gradle', 'maven', 'nginx', 'apache', 'lua', 'perl',
  'haskell', 'erlang', 'elixir', 'clojure', 'lisp', 'scheme', 'ocaml', 'fsharp',
  'dart', 'flutter', 'vue', 'react', 'jsx', 'tsx', 'svelte', 'angular',
  'graphql', 'protobuf', 'thrift', 'avro', 'toml', 'ini', 'conf', 'config',
  'diff', 'patch', 'git', 'vim', 'regex', 'asm', 'assembly', 'wasm',
  'mermaid', 'plantuml', 'latex', 'tex', 'bibtex', 'text', 'plain', 'plaintext'
]);

const CodeBlock = memo(({ language, value }: { language: string, value: string }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  const isDarkMode = typeof document !== 'undefined' 
    ? document.documentElement.classList.contains('dark') 
    : true;
  
  const langLower = language?.toLowerCase() || '';
  const isMermaid = langLower === 'mermaid';
  const canPreview = langLower === 'html' || langLower === 'svg';
  const lineCount = value.split('\n').length;
  const showLineNumbers = lineCount > 5;
  
  // 检测是否为非编程语言的短内容（可能是 AI 误用代码块）
  const isShortNonCode = !PROGRAMMING_LANGUAGES.has(langLower) && 
                         lineCount <= 3 && 
                         value.length < 100;

  const onCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isMermaid) {
    return <MermaidDiagram code={value} />;
  }
  
  // 对于非编程语言的短内容，使用简洁的内联样式
  if (isShortNonCode) {
    return (
      <span className={`inline-block px-2 py-1 rounded text-sm font-mono border ${
        isDarkMode 
          ? 'bg-muted/50 border-border text-foreground' 
          : 'bg-gray-100 border-gray-200 text-gray-800'
      }`}>
        {value}
      </span>
    );
  }

  const headerBg = isDarkMode ? 'bg-[#252526]' : 'bg-gray-100';
  const headerBorder = isDarkMode ? 'border-white/5' : 'border-gray-200';
  const langTextColor = isDarkMode ? 'text-zinc-400' : 'text-gray-500';
  const containerBg = isDarkMode ? 'bg-[#1e1e1e]' : 'bg-gray-50';
  const containerBorder = isDarkMode ? 'border-border/60' : 'border-gray-200';
  const buttonHoverBg = isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200';
  const buttonTextColor = isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-700';

  return (
    <div className={`relative group rounded-xl overflow-hidden my-5 border ${containerBorder} ${containerBg} shadow-lg shadow-black/5`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${headerBg} border-b ${headerBorder}`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] opacity-80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] opacity-80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F] opacity-80"></div>
          </div>
          <span className={`ml-2 text-[10px] font-mono ${langTextColor} uppercase tracking-wider select-none`}>{language || 'text'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all duration-200 ${
                showPreview 
                  ? 'bg-indigo-500/20 text-indigo-300' 
                  : `${buttonTextColor} ${buttonHoverBg}`
              }`}
              title="切换预览/代码"
            >
              {showPreview ? <Code2 size={12} /> : <Eye size={12} />}
              <span className="text-[10px] font-medium">{showPreview ? 'Code' : 'Preview'}</span>
            </button>
          )}
          
          <button 
            onClick={onCopy} 
            className={`flex items-center gap-1.5 ${buttonTextColor} transition-all duration-200 px-2 py-0.5 rounded ${buttonHoverBg} ${
              copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title="复制代码"
          >
            {copied ? <Check size={12} className="text-emerald-400"/> : <Copy size={12} />}
            <span className="text-[10px] font-medium">{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>
      
      {showPreview && canPreview ? (
        <ArtifactPreview code={value} language={language} />
      ) : (
        <div className="overflow-x-auto custom-scrollbar" style={{ minHeight: '60px' }}>
          <SyntaxHighlighter
            language={language || 'text'}
            style={isDarkMode ? vscDarkPlus : vs}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '13px',
              lineHeight: '1.6',
              background: 'transparent',
              borderRadius: 0,
              minHeight: '60px',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              }
            }}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// ----------------------------------------------------------------------
// 2. 静态 Markdown 组件配置 - 提取到组件外部避免重复创建
// ----------------------------------------------------------------------
const createMarkdownComponents = (isUser: boolean): Components => ({
  p: ({children}) => <p className={`${isUser ? 'mb-[18px] last:mb-0 leading-[1.9] !text-inherit' : 'text-foreground/95'}`}>{children}</p>,
  
  h1: ({children}) => <h1 className={`${isUser ? 'text-[1.55em] font-bold mt-7 mb-3 leading-[1.45] !text-inherit' : ''}`}>{children}</h1>,
  h2: ({children}) => <h2 className={`${isUser ? 'text-[1.35em] font-bold mt-6 mb-3 leading-[1.5] !text-inherit' : ''}`}>{children}</h2>,
  h3: ({children}) => <h3 className={`${isUser ? 'text-[1.15em] font-bold mt-5 mb-2 leading-[1.55] !text-inherit' : ''}`}>{children}</h3>,
  
  ul: ({children}) => <ul className={`${isUser ? 'list-disc pl-6 my-3 space-y-2 leading-[1.9]' : ''}`}>{children}</ul>,
  ol: ({children}) => <ol className={`${isUser ? 'list-decimal pl-6 my-3 space-y-2 leading-[1.9]' : ''}`}>{children}</ol>,
  li: ({children}) => <li className={`pl-1 ${isUser ? '!text-inherit' : ''}`}>{children}</li>,
  
  strong: ({children}) => <strong className={`font-bold ${isUser ? '!text-inherit' : ''}`}>{children}</strong>,

  blockquote: ({children}) => <blockquote className={`border-l-2 pl-4 py-2 ${isUser ? 'my-4' : ''} italic rounded-r-lg ${
    isUser 
      ? 'border-primary-foreground/50 bg-primary-foreground/10 !text-inherit opacity-90' 
      : 'border-primary/50 bg-muted/20 text-muted-foreground'
  }`}>{children}</blockquote>,
  
  a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className={`${isUser ? 'text-blue-300 dark:text-blue-600 hover:text-blue-200 dark:hover:text-blue-500' : 'text-blue-500 hover:text-blue-600'} hover:underline`}>{children}</a>,
  
  code: ({inline, className, children, ...props}: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
    ) : (
      <code className={`${className} px-1.5 py-0.5 rounded text-[0.85em] font-mono border ${
        isUser 
          ? 'bg-primary-foreground/20 border-primary-foreground/10 text-primary-foreground' 
          : 'bg-muted border-border text-accent-foreground'
      }`} {...props}>
        {children}
      </code>
    );
  }
});

// 缓存用户和助手的组件配置
const userMarkdownComponents = createMarkdownComponents(true);
const assistantMarkdownComponents = createMarkdownComponents(false);

// ----------------------------------------------------------------------
// 3. 思考过程折叠组件
// ----------------------------------------------------------------------
const ThinkingBlock = memo(({ content, isStreaming }: { content: string; isStreaming?: boolean }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  return (
    <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-500/10 transition-colors"
      >
        <Brain size={16} className={`text-purple-500 ${isStreaming ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
          {isStreaming ? '思考中...' : '思考过程'}
        </span>
        <ChevronDown 
          size={14} 
          className={`ml-auto text-purple-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-1 text-sm text-muted-foreground/80 whitespace-pre-wrap border-t border-purple-500/20">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 ml-0.5 align-middle bg-purple-500 animate-pulse"></span>
          )}
        </div>
      )}
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';

// ----------------------------------------------------------------------
// 4. 主消息气泡组件 - 使用 React.memo 和自定义比较函数
// ----------------------------------------------------------------------
const MessageBubbleInner: React.FC<Props> = ({ message, isStreaming, onRegenerate, onEdit, onContinue }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState<'none' | 'word' | 'ppt'>('none');
  const [isSpeaking, setIsSpeaking] = useState(false); 

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  // 使用缓存的组件配置
  const markdownComponents = isUser ? userMarkdownComponents : assistantMarkdownComponents;

  // 消息内容
  const bodyContent = message.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(bodyContent || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCleanTitle = () => {
    return bodyContent.slice(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '_') || "AI_Doc";
  };

  const handleExportWord = async () => {
    if (!bodyContent) return;
    setIsExporting('word');
    try {
      await exportToWord(bodyContent, `Aittco_${getCleanTitle()}`);
    } catch (e) {
      console.error("Export Word failed", e);
      alert("导出 Word 失败");
    } finally {
      setIsExporting('none');
    }
  };

  const handleExportPPT = async () => {
    if (!bodyContent) return;
    setIsExporting('ppt');
    try {
      await exportToPPT(bodyContent, `Aittco_PPT_${getCleanTitle()}`, 'business');
    } catch (e) {
      console.error("Export PPT failed", e);
      alert("导出 PPT 失败，请确保内容包含标题(#)以便分页");
    } finally {
      setIsExporting('none');
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    if (onEdit) {
      onEdit(message.id, editContent);
      setIsEditing(false);
    }
  };

  const toggleSpeech = () => {
    if (!window.speechSynthesis) {
      alert('您的浏览器不支持语音朗读功能');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToSpeak = bodyContent || message.content;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'zh-CN'; 
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.includes('zh') && !v.localService); 
      if (zhVoice) utterance.voice = zhVoice;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const containerClasses = isUser
    ? "bg-primary text-primary-foreground rounded-[20px] rounded-tr-sm shadow-md"
    : "bg-transparent pl-0"; 

  // 分离附件
  const imageAttachments = message.attachments?.filter(a => a.type === 'image') || [];
  const fileAttachments = message.attachments?.filter(a => a.type !== 'image') || [];

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 duration-500`}>
      <div className={`flex max-w-full ${isUser ? 'md:max-w-[85%] lg:max-w-[75%]' : 'md:max-w-[92%] lg:max-w-[86%]'} gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* 头像 */}
        <div className={`flex-shrink-0 mt-1 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border select-none ${
          isUser 
            ? 'bg-muted text-muted-foreground border-border/50' 
            : 'bg-background border-border/50'
        }`}>
          {isUser ? (
            <User size={16} />
          ) : message.model?.includes('gpt') ? (
            // OpenAI GPT Logo
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" 
                className="fill-foreground"
              />
            </svg>
          ) : message.model?.includes('claude') ? (
            <img
              src={appAssetUrl('logo/claude-ai-icon.svg')}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
            />
          ) : message.model?.includes('grok') ? (
            <GrokLogo className="w-5 h-5" size={20} />
          ) : (
            // Google Gemini Logo
            <svg className="w-5 h-5" viewBox="0 0 28 28" fill="none">
              <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#gemini-gradient-msg)"/>
              <defs>
                <linearGradient id="gemini-gradient-msg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
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

        <div className={`flex flex-col min-w-0 w-full ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`relative px-5 py-3.5 w-full transition-all ${containerClasses}`}>

            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[300px] animate-in fade-in duration-200">
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full bg-background/20 text-inherit border border-white/20 rounded-lg p-3 min-h-[100px] outline-none focus:ring-1 focus:ring-white/30 resize-y font-sans leading-relaxed ${isUser ? 'placeholder-white/50' : 'placeholder-muted-foreground'}`}
                  autoFocus
                  placeholder="修改您的指令..."
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => { setIsEditing(false); setEditContent(message.content); }} 
                    className="p-1.5 hover:bg-black/10 rounded-full transition-colors" 
                    title="取消"
                  >
                    <X size={14}/>
                  </button>
                  <button 
                    onClick={handleSaveEdit} 
                    className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors shadow-sm" 
                    title="保存并重新生成"
                  >
                    <Save size={14}/>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 图片附件预览 */}
                {imageAttachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {imageAttachments.map(att => (
                      <div key={att.id} className="relative group/img rounded-xl overflow-hidden border border-white/20 bg-black/5 shadow-sm max-w-[280px]">
                        <img 
                          src={att.content} 
                          alt={att.name}
                          className="w-full h-auto max-h-[300px] object-cover hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                          onClick={() => {
                            const overlay = document.createElement('div');
                            overlay.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200';
                            overlay.onclick = () => overlay.remove();
                            const img = document.createElement('img');
                            img.src = att.content;
                            img.className = 'max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200';
                            img.onclick = (e) => e.stopPropagation();
                            overlay.appendChild(img);
                            document.body.appendChild(overlay);
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            link.href = att.content;
                            link.download = att.name || 'image.png';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all duration-200 backdrop-blur-sm"
                          title="下载图片"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const overlay = document.createElement('div');
                            overlay.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200';
                            overlay.onclick = () => overlay.remove();
                            const img = document.createElement('img');
                            img.src = att.content;
                            img.className = 'max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200';
                            img.onclick = (e) => e.stopPropagation();
                            overlay.appendChild(img);
                            document.body.appendChild(overlay);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all duration-200 backdrop-blur-sm"
                          title="放大查看"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 普通文件附件 */}
                {fileAttachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {fileAttachments.map(att => (
                      <div key={att.id} className={`text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-default transition-colors border ${
                        isUser 
                          ? 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground/90' 
                          : 'bg-muted/60 border-border text-muted-foreground'
                      }`}>
                        <span>📄</span>
                        <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 思考过程显示 */}
                {message.thinkingContent && (
                  <ThinkingBlock 
                    content={message.thinkingContent} 
                    isStreaming={isStreaming && !message.content} 
                  />
                )}

                {/* 正文 Markdown 渲染 */}
                {bodyContent && (
                  <div className={`prose-aittco break-words ${isUser ? 'max-w-none !text-inherit' : 'max-w-[84ch] assistant-readable'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {bodyContent}
                    </ReactMarkdown>
                    
                    {isStreaming && !isUser && (
                      <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]"></span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>


          {/* 底部操作栏 */}
          <div className={`flex items-center gap-3 mt-1.5 ${isUser ? 'pr-1' : 'pl-1'}`}>
            <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
              {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>

            {isUser && !isEditing && onEdit && (
              <button 
                onClick={() => { setIsEditing(true); setEditContent(message.content); }} 
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all duration-200"
                title="编辑消息"
              >
                <Pencil size={12} />
              </button>
            )}

            {!isUser && !isStreaming && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <div className="w-px h-2.5 bg-border/60 mx-1"></div>
                
                <button 
                  onClick={handleCopy} 
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="复制内容"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                
                <button 
                  onClick={toggleSpeech} 
                  className={`p-1 hover:bg-muted rounded-md transition-colors ${isSpeaking ? 'text-primary animate-pulse bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                  title={isSpeaking ? "停止朗读" : "朗读"}
                >
                  {isSpeaking ? <StopCircle size={12} /> : <Volume2 size={12} />}
                </button>

                <button 
                  onClick={handleExportWord} 
                  disabled={isExporting !== 'none'}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="导出为 Word"
                >
                  {isExporting === 'word' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                </button>

                <button 
                  onClick={handleExportPPT} 
                  disabled={isExporting !== 'none'}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="导出为 PPT"
                >
                  {isExporting === 'ppt' ? <Loader2 size={12} className="animate-spin" /> : <Presentation size={12} />}
                </button>

                {onRegenerate && (
                  <button 
                    onClick={() => onRegenerate(message.id)} 
                    className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="重新生成"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}

                {onContinue && (
                  <button 
                    onClick={() => onContinue(message.id)} 
                    className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="继续生成"
                  >
                    <Play size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 自定义比较函数：只有关键属性变化时才重渲染
const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  // 流式传输状态变化时需要重渲染
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }
  
  // 消息内容变化时需要重渲染
  if (prevProps.message.content !== nextProps.message.content) {
    return false;
  }
  
  // 思考内容变化时需要重渲染
  if (prevProps.message.thinkingContent !== nextProps.message.thinkingContent) {
    return false;
  }
  
  // 时间戳变化时需要重渲染（消息被更新）
  if (prevProps.message.timestamp !== nextProps.message.timestamp) {
    return false;
  }
  
  // 附件变化时需要重渲染
  if (prevProps.message.attachments?.length !== nextProps.message.attachments?.length) {
    return false;
  }
  
  // 对于非流式传输的历史消息，不需要重渲染
  return true;
};

// 导出 memo 包裹的组件
export const MessageBubble = memo(MessageBubbleInner, arePropsEqual);
