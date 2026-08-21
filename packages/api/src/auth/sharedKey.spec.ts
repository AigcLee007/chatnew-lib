import { AITTCO_SHARED_KEY_NAME, getAittcoKeyName } from './sharedKey';

describe('getAittcoKeyName', () => {
  it('returns the shared key name for native and configured custom endpoints', () => {
    expect(getAittcoKeyName('google')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('anthropic')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('openAI')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('OpenAI')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('xAI')).toBe(AITTCO_SHARED_KEY_NAME);
  });

  it('preserves unrelated endpoint names', () => {
    expect(getAittcoKeyName('bedrock')).toBe('bedrock');
  });
});
