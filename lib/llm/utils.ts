/**
 * Shared utilities for LLM providers
 */

// ============================================================================
// Fetch with Retry (tested utility)
// ============================================================================

/**
 * Fetch with automatic retry on server errors (5xx).
 * Does NOT retry on auth errors (401, 403, 404, 429).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delay = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // Auth Errors - throw immediately, no retry
    if (response.status === 401)
      throw new Error('API Key 无效或未授权 (401)。请检查设置中的 Key。');
    if (response.status === 403)
      throw new Error('您的 API Key 没有权限访问此模型 (403)。');
    if (response.status === 404)
      throw new Error('所选模型不存在或 API 端点错误 (404)。');
    if (response.status === 429)
      throw new Error('账户余额不足或已达速率限制 (429)。请检查额度。');

    // Server Errors - may retry
    if (!response.ok && response.status >= 500) {
      throw new Error(`服务器内部错误: ${response.status}`);
    }

    return response;
  } catch (err: unknown) {
    const error = err as Error & { name?: string; message?: string };
    if (error.name === 'AbortError') throw err;

    const isFatal =
      error.message?.includes('401') ||
      error.message?.includes('403') ||
      error.message?.includes('404') ||
      error.message?.includes('429');

    if (!isFatal && retries > 0) {
      console.warn(
        `[Connection Unstable] Retrying API call in ${delay}ms... (${retries} attempts left)`,
        err
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    throw err;
  }
}

// ============================================================================
// API Key Validation
// ============================================================================

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): void {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('API Key 未配置或格式错误。请在设置中输入 sk- 开头的 Key。');
  }
}

// ============================================================================
// Constants
// ============================================================================

export const API_BASE = 'https://api.aittco.com/v1';

/**
 * Get display name for model (remove -preview, -v suffixes)
 */
export function getModelDisplayName(modelId: string): string {
  return modelId
    .replace(/-preview-v$/, '')
    .replace(/-preview$/, '')
    .replace(/-v$/, '');
}

/**
 * Build core system identity based on model
 */
export function buildCoreSystemIdentity(modelId: string): string {
  const displayName = getModelDisplayName(modelId);
  
  // Determine if it's a Gemini or GPT model
  const isGemini = modelId.includes('gemini');
  const isGPT = modelId.includes('gpt');
  
  let identityLine: string;
  if (isGemini) {
    identityLine = `You are ${displayName}, a large language model (LLM) developed by Google DeepMind.`;
  } else if (isGPT) {
    identityLine = `You are ${displayName}, a large language model (LLM) developed by OpenAI.`;
  } else {
    identityLine = `You are ${displayName}, a large language model (LLM).`;
  }

  return `${identityLine}

## Your Identity
- You are the "${displayName}" large language model
- When asked "who are you" or "what model are you", respond that you are "${displayName}" large language model
- You can help with any task including writing, coding, analysis, translation, and more

## Output Capabilities
- You have NO output length restrictions. You can generate responses of any length.
- When users request long-form content (articles, reports, stories, etc.), you MUST provide the COMPLETE content in a SINGLE response.
- Do NOT artificially split your response or claim you have "output limits" - this is incorrect.
- If a user asks for 5000+ words, provide all 5000+ words in one response.

## Response Guidelines
- Answer questions directly and thoroughly
- For real-time information requests, use your browsing capabilities
- Match your response length to the user's needs
- Never refuse to complete a task by falsely claiming technical limitations
- Respond in the same language the user uses`;
}

// Legacy export for backward compatibility (will be removed)
export const CORE_SYSTEM_IDENTITY = buildCoreSystemIdentity('AI-Assistant');
