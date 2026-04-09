/**
 * Shared utilities for LLM providers
 */

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, any>;
  return (
    p?.error?.message ||
    p?.message ||
    p?.detail ||
    null
  );
}

async function buildResponseError(response: Response): Promise<Error> {
  const status = response.status;
  const statusText = response.statusText || 'Unknown';

  let bodyText = '';
  let detail = '';
  try {
    bodyText = await response.text();
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        detail = extractErrorMessage(parsed) || JSON.stringify(parsed).slice(0, 240);
      } catch {
        detail = bodyText.slice(0, 240);
      }
    }
  } catch {
    // ignore body parse failures
  }

  const suffix = detail ? ` - ${detail}` : '';

  if (status === 401) return new Error(`API Key 无效或未授权 (401)${suffix}`);
  if (status === 403) return new Error(`API Key 无权限访问该模型 (403)${suffix}`);
  if (status === 404) return new Error(`模型或接口不存在 (404)${suffix}`);
  if (status === 429) return new Error(`额度不足或触发限流 (429)${suffix}`);
  if (status >= 500) return new Error(`服务器内部错误: ${status}${suffix}`);

  return new Error(`请求失败: ${status} ${statusText}${suffix}`);
}

/**
 * Fetch with automatic retry on non-fatal failures.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delay = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const err = await buildResponseError(response);
      throw err;
    }

    return response;
  } catch (err: unknown) {
    const error = err as Error & { name?: string; message?: string };
    if (error.name === 'AbortError') throw err;

    const msg = error.message || '';
    const isFatal =
      msg.includes('(401)') ||
      msg.includes('(403)') ||
      msg.includes('(404)') ||
      msg.includes('(429)');

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

export function validateApiKey(apiKey: string): void {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('API Key 未配置或格式错误，请在设置中输入 sk- 开头的 Key。');
  }
}

export const API_BASE = 'https://api.aittco.com/v1';

export function getModelDisplayName(modelId: string): string {
  return modelId
    .replace(/-preview-v$/, '')
    .replace(/-preview$/, '')
    .replace(/-v$/, '');
}

export function buildCoreSystemIdentity(modelId: string): string {
  const displayName = getModelDisplayName(modelId);

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

export const CORE_SYSTEM_IDENTITY = buildCoreSystemIdentity('AI-Assistant');
