export type Role = 'user' | 'assistant' | 'system';

export type ModelId = 
  | 'gemini-3.1-pro-preview' 
  | 'gemini-3.1-flash-preview' 
  | 'gpt-5.4'
  | 'gpt-5.3-codex'
  | 'gemini-2.5-flash-image';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  content: string; // Base64 or extracted text
  preview?: string; // Base64 for images
  tokenCount?: number;
  included?: boolean; // 控制文件是否包含在当前上下文中
}

// [新增] 提示词接口定义
export interface Prompt {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  model?: ModelId;
  thinkingContent?: string; // 大模型思考过程
}

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  model: ModelId;
  preview: string;
}

export interface AppSettings {
  apiKey: string;
  defaultModel: ModelId;
  userSystemPrompt: string; 
}

export interface ChatState {
  currentSessionId: string | null;
  isSidebarOpen: boolean;
  isLoading: boolean;
  attachments: Attachment[];
  input: string;
}

// [新增] 公告通知接口定义
export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  active: boolean;
  pinned: boolean;
}

export interface NoticeListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Notice[];
}
