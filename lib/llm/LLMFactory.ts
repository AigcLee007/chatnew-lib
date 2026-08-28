/**
 * LLM Factory - Factory pattern for selecting providers based on model ID
 */

import { ILLMProvider } from './types';
import { AnthropicProvider, GeminiNativeProvider, GeminiProvider, GrokProvider, OpenAIProvider } from './providers';

// ============================================================================
// Provider Registry
// ============================================================================

/** Singleton instances of providers */
const providers: ILLMProvider[] = [
  new GeminiNativeProvider(),  // 优先匹配 -v 后缀模型
  new GeminiProvider(),
  new AnthropicProvider(),
  new GrokProvider(),
  new OpenAIProvider(),
];

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the appropriate provider for a given model ID.
 * Uses Strategy Pattern to select the correct implementation.
 * 
 * @param modelId - The model identifier (e.g., 'gemini-3-pro-preview', 'gpt-5.2-all')
 * @returns The provider that supports this model
 * @throws Error if no provider supports the model
 */
export function getProvider(modelId: string): ILLMProvider {
  const provider = providers.find((p) => p.supportsModel(modelId));
  
  if (!provider) {
    // Default to GeminiProvider for unknown models (most compatible with OpenAI format)
    console.warn(`No specific provider found for model "${modelId}", using Gemini provider`);
    return providers.find((p) => p.name === 'Gemini') || providers[1]; // GeminiProvider
  }
  
  return provider;
}

/**
 * Register a new provider.
 * Useful for extending with custom providers.
 * 
 * @param provider - The provider instance to register
 */
export function registerProvider(provider: ILLMProvider): void {
  // Add to beginning so custom providers take precedence
  providers.unshift(provider);
}

/**
 * Get all registered providers.
 * 
 * @returns Array of all registered providers
 */
export function getAllProviders(): ILLMProvider[] {
  return [...providers];
}

// ============================================================================
// Default Export
// ============================================================================

export const LLMFactory = {
  getProvider,
  registerProvider,
  getAllProviders,
};
