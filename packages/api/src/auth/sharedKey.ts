import { AITTCO_SHARED_KEY_NAME, usesAittcoSharedKey } from 'librechat-data-provider';

export { AITTCO_SHARED_KEY_NAME };

export function getAittcoKeyName(endpoint: string): string {
  return usesAittcoSharedKey(endpoint) ? AITTCO_SHARED_KEY_NAME : endpoint;
}
