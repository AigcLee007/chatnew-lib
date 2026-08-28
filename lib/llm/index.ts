/**
 * LLM Module - Strategy Pattern for LLM providers
 * 
 * This module provides a clean abstraction for different LLM providers.
 * 
 * Usage:
 * ```typescript
 * import { LLMFactory } from './lib/llm';
 * 
 * const provider = LLMFactory.getProvider('gemini-3-pro-preview');
 * await provider.streamChat({ ... });
 * ```
 */

// Types
export type {
  ILLMProvider,
  ChatOptions,
  ImageGenerationOptions,
  UsageStats,
  ApiMessage,
  ContentPart,
  TextContentPart,
  ImageUrlContentPart,
} from './types';

// Factory
export { LLMFactory, getProvider, registerProvider, getAllProviders } from './LLMFactory';

// Providers (for direct use or extension)
export { AnthropicProvider, BaseProvider, GeminiProvider, GrokProvider, OpenAIProvider } from './providers';

// Utilities (for testing and extension)
export { fetchWithRetry, validateApiKey, API_BASE, CORE_SYSTEM_IDENTITY } from './utils';
