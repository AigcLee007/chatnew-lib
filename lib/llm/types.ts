/**
 * LLM Provider Types and Interfaces
 * Strategy Pattern for decoupling model implementations
 */

import { Message, Attachment, GptImage2Params, ImageGenerationResult, ModelId } from '../../types';

// ============================================================================
// Usage Statistics
// ============================================================================

/** Usage statistics from API response */
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============================================================================
// Chat Options
// ============================================================================

/** Options for streaming chat completion */
export interface ChatOptions {
  apiKey: string;
  model: ModelId;
  messages: Message[];
  attachments: Attachment[];
  userSystemPrompt: string;
  signal: AbortSignal;
  onChunk: (chunk: string, isThinking?: boolean) => void;
  onComplete: (usage?: UsageStats) => void;
  onError: (err: Error) => void;
  isWebSearchEnabled?: boolean;
}

/** Options for image generation */
export interface ImageGenerationOptions {
  apiKey: string;
  prompt: string;
  model?: string;
  attachments?: Attachment[];
  params?: GptImage2Params;
  signal?: AbortSignal;
}

// ============================================================================
// Provider Interface (Strategy Pattern)
// ============================================================================

/**
 * Interface for LLM providers.
 * Each provider (Gemini, OpenAI, etc.) implements this interface.
 */
export interface ILLMProvider {
  /** Provider name for identification */
  readonly name: string;
  
  /** Check if this provider supports the given model */
  supportsModel(modelId: string): boolean;
  
  /** Stream chat completion */
  streamChat(options: ChatOptions): Promise<void>;
  
  /** Generate image (optional - not all providers support this) */
  generateImage?(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

// ============================================================================
// API Message Types (shared across providers)
// ============================================================================

/** Text content part for multimodal messages */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** Image URL content part for multimodal messages */
export interface ImageUrlContentPart {
  type: 'image_url';
  image_url: { url: string };
}

/** Union type for all content parts */
export type ContentPart = TextContentPart | ImageUrlContentPart;

/** API message with string or multimodal content */
export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

// ============================================================================
// Stream Response Types
// ============================================================================

/** Stream chunk delta */
export interface StreamDelta {
  content?: string;
  reasoning_content?: string;
}

/** Stream chunk choice */
export interface StreamChoice {
  delta?: StreamDelta;
}

/** Stream chunk response */
export interface StreamChunkResponse {
  choices?: StreamChoice[];
  usage?: UsageStats;
}

export interface ResponseInputTextPart {
  type: 'input_text';
  text: string;
}

export interface ResponseInputImagePart {
  type: 'input_image';
  image_url: string;
}

export type ResponseInputContentPart = ResponseInputTextPart | ResponseInputImagePart;

export interface ResponseInputMessage {
  role: 'user' | 'assistant';
  content: string | ResponseInputContentPart[];
}

export interface ResponsesRequestBody {
  model: string;
  instructions: string;
  input: ResponseInputMessage[];
  stream: true;
  max_output_tokens: number;
}

export interface ResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface ResponsesStreamEvent {
  type?: string;
  delta?: string;
  message?: string;
  error?: { message?: string };
  response?: {
    usage?: ResponsesUsage;
    error?: { message?: string };
    incomplete_details?: { reason?: string };
  };
  usage?: ResponsesUsage;
}

/** Chat completion request body */
export interface ChatCompletionRequestBody {
  model: string;
  messages: ApiMessage[];
  stream: boolean;
  stream_options: { include_usage: boolean };
  temperature?: number;
  max_tokens?: number;
}
