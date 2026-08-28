/**
 * API Client Facade
 * 
 * This file serves as a facade to maintain backward compatibility
 * while delegating to the new Strategy Pattern-based LLM providers.
 * 
 * DO NOT DELETE - preserves imports in App.tsx and other components.
 */

import { ModelId, Message, Attachment, GptImage2Params, ImageGenerationResult } from '../types';
import { LLMFactory, UsageStats, fetchWithRetry } from './llm';

// Re-export types for backward compatibility
export type { UsageStats } from './llm';

// Re-export fetchWithRetry for testing
export { fetchWithRetry } from './llm';

export interface BalanceResult {
  total: number;
  used: number;
  remain: number;
  loading: boolean;
  error: string | null;
}

const BALANCE_API_BASE = 'https://api.aittco.com';

export async function checkBalance(apiKey: string): Promise<BalanceResult> {
  const key = apiKey.trim();
  if (!key) {
    return {
      total: 0,
      used: 0,
      remain: 0,
      loading: false,
      error: 'API Key 不能为空',
    };
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const today = new Date().toISOString().slice(0, 10);

  const readJson = async (path: string) => {
    const resp = await fetch(`${BALANCE_API_BASE}${path}`, { method: 'GET', headers });
    const text = await resp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      const message = data?.error?.message || data?.message || `请求失败 (HTTP ${resp.status})`;
      throw new Error(`${message} (HTTP ${resp.status})`);
    }

    return data;
  };

  try {
    const [subscription, usage] = await Promise.all([
      readJson('/v1/dashboard/billing/subscription'),
      readJson(`/v1/dashboard/billing/usage?start_date=2023-01-01&end_date=${today}`),
    ]);

    const total = Number(subscription?.hard_limit_usd || 0);
    const used = Number(usage?.total_usage || 0) / 100;
    const remain = Math.max(0, total - used);

    return {
      total: Number.isFinite(total) ? total : 0,
      used: Number.isFinite(used) ? used : 0,
      remain: Number.isFinite(remain) ? remain : 0,
      loading: false,
      error: null,
    };
  } catch (error) {
    return {
      total: 0,
      used: 0,
      remain: 0,
      loading: false,
      error: error instanceof Error ? error.message : '额度查询失败',
    };
  }
}

// ============================================================================
// Facade Functions (maintain original signatures)
// ============================================================================

/**
 * Generate image using the appropriate provider.
 * Facade that delegates to GeminiProvider.
 * 
 * @param apiKey - API key for authentication
 * @param prompt - Text prompt for image generation
 * @param model - Model ID (default: 'gpt-image-2')
 * @param attachments - Optional attachments for image-to-image
 * @returns Base64 encoded image data
 */
export async function generateImage(
  apiKey: string,
  prompt: string,
  model: string = 'gpt-image-2',
  attachments: Attachment[] = [],
  params?: GptImage2Params,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const provider = LLMFactory.getProvider(model);
  
  if (!provider.generateImage) {
    throw new Error(`Provider "${provider.name}" does not support image generation`);
  }
  
  return provider.generateImage({
    apiKey,
    prompt,
    model,
    attachments,
    params,
    signal,
  });
}

/**
 * Stream chat completion using the appropriate provider.
 * Facade that delegates to the correct provider based on model ID.
 * 
 * @param apiKey - API key for authentication
 * @param model - Model ID to use
 * @param messages - Conversation messages
 * @param attachments - File attachments
 * @param userSystemPrompt - Custom system prompt
 * @param signal - AbortSignal for cancellation
 * @param onChunk - Callback for each streamed chunk
 * @param onComplete - Callback when streaming completes
 * @param onError - Callback for errors
 * @param isWebSearchEnabled - Whether web search is enabled
 */
export async function streamChatCompletion(
  apiKey: string,
  model: ModelId,
  messages: Message[],
  attachments: Attachment[],
  userSystemPrompt: string,
  signal: AbortSignal,
  onChunk: (chunk: string, isThinking?: boolean) => void,
  onComplete: (usage?: UsageStats) => void,
  onError: (err: Error) => void,
  isWebSearchEnabled: boolean = false
): Promise<void> {
  const provider = LLMFactory.getProvider(model);
  
  return provider.streamChat({
    apiKey,
    model,
    messages,
    attachments,
    userSystemPrompt,
    signal,
    onChunk,
    onComplete,
    onError,
    isWebSearchEnabled,
  });
}
