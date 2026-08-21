import { AITTCO_SHARED_KEY_NAME, usesAittcoSharedKey } from './aittco';
import {
  AITTCO_SHARED_KEY_NAME as publicSharedKeyName,
  usesAittcoSharedKey as publicUsesAittcoSharedKey,
} from './index';

describe('Aittco shared key contract', () => {
  it('uses the dedicated key name', () => {
    expect(AITTCO_SHARED_KEY_NAME).toBe('aittco_shared');
  });

  it.each(['google', 'anthropic', 'openAI', 'OpenAI', 'xAI'])(
    'maps configured endpoint %s to the shared key',
    (endpoint) => {
      expect(usesAittcoSharedKey(endpoint)).toBe(true);
    },
  );

  it('does not map unrelated provider names', () => {
    expect(usesAittcoSharedKey('bedrock')).toBe(false);
    expect(usesAittcoSharedKey('custom-other')).toBe(false);
  });

  it('exports the shared key contract from the public entry point', () => {
    expect(publicSharedKeyName).toBe(AITTCO_SHARED_KEY_NAME);
    expect(publicUsesAittcoSharedKey('google')).toBe(true);
    expect(publicUsesAittcoSharedKey('bedrock')).toBe(false);
  });
});
