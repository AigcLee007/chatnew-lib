import { EModelEndpoint } from './schemas';

export const AITTCO_SHARED_KEY_NAME = 'aittco_shared';

const AITTCO_CUSTOM_ENDPOINTS = new Set(['OpenAI', 'xAI']);

export function usesAittcoSharedKey(endpoint: string): boolean {
  return (
    endpoint === EModelEndpoint.google ||
    endpoint === EModelEndpoint.anthropic ||
    endpoint === EModelEndpoint.openAI ||
    AITTCO_CUSTOM_ENDPOINTS.has(endpoint)
  );
}
