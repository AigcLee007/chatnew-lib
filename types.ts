export type Role = 'user' | 'assistant' | 'system';

export type ModelId =
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.5-flash-preview'
  | 'gpt-5.6-sol'
  | 'gpt-5.6-terra'
  | 'gpt-5.4'
  | 'gpt-5.5'
  | 'gpt-image-2'
  | 'grok-4.6'
  | 'grok-4.5'
  | 'claude-opus-5'
  | 'claude-sonnet-5'
  | 'claude-opus-4-7'
  | 'claude-opus-4-8';

export type WorkMode = 'chat' | 'research' | 'planning' | 'uiux';

export interface AttachmentChunk {
  id: string;
  index: number;
  title: string;
  content: string;
  tokenCount: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  content: string; // Base64, extracted text, or a compact document overview.
  preview?: string; // Base64 for images.
  tokenCount?: number;
  fullTokenCount?: number;
  documentId?: string;
  chunkCount?: number;
  chunks?: AttachmentChunk[];
  included?: boolean;
}

export interface DocumentStore {
  id: string;
  name: string;
  type: string;
  overview: string;
  tokenCount: number;
  fullTokenCount: number;
  chunkCount: number;
  createdAt: number;
}

export interface DocumentChunk extends AttachmentChunk {
  documentId: string;
}

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
  thinkingContent?: string;
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

export interface ResearchPlanStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'done';
}

export interface ResearchPlan {
  id: string;
  sessionId: string;
  title: string;
  goal: string;
  steps: ResearchPlanStep[];
  findings: string[];
  updatedAt: number;
}

export interface ConversationMemory {
  id: string;
  sessionId: string;
  summary: string;
  compressedUntil: number;
  sourceMessageCount: number;
  tokenCount: number;
  updatedAt: number;
}

export type GptImage2Quality = 'auto' | 'low' | 'medium' | 'high';
export type GptImage2OutputFormat = 'png' | 'jpeg' | 'webp';
export type GptImage2Moderation = 'auto' | 'low';

export interface GptImage2Params {
  size: 'auto' | '1k' | '2k' | '4k';
  aspectRatio: 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';
  quality: GptImage2Quality;
  outputFormat: GptImage2OutputFormat;
  outputCompression: number | null;
  moderation: GptImage2Moderation;
  n: number;
}

export interface ImageGenerationResult {
  images: string[];
  revisedPrompt?: string;
  size?: string;
  aspectRatio?: string;
}
