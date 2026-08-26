import type { ProviderBrand } from './ProviderBrandIcon';

const MODEL_BRANDS: Array<[RegExp, ProviderBrand]> = [
  [/claude|anthropic/, 'ANTHROPIC'],
  [/gemini|gemma|learnlm|palm|google/, 'GEMINI'],
  [/gpt|openai|o[1-9](?:-|$)/, 'OPENAI'],
  [/grok|xai/, 'GROK'],
];

const ENDPOINT_BRANDS: Array<[RegExp, ProviderBrand]> = [
  [/anthropic|claude/, 'ANTHROPIC'],
  [/google|gemini/, 'GEMINI'],
  [/openai|azureopenai/, 'OPENAI'],
  [/grok|xai/, 'GROK'],
];

export function getProviderBrand(
  model?: string | null,
  endpoint?: string | null,
): ProviderBrand | null {
  const endpointValue = endpoint?.toLowerCase() ?? '';
  if (/agent|assistant|bedrock|custom/.test(endpointValue)) {
    return null;
  }
  const modelValue = model?.toLowerCase() ?? '';
  return (
    MODEL_BRANDS.find(([pattern]) => pattern.test(modelValue))?.[1] ??
    ENDPOINT_BRANDS.find(([pattern]) => pattern.test(endpointValue))?.[1] ??
    null
  );
}
