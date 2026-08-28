import { describe, expect, test } from 'vitest';
import { appAssetUrl } from '../../lib/base-path';

describe('appAssetUrl', () => {
  test('places public assets under the production base path', () => {
    expect(appAssetUrl('/wechat.png', '/main/')).toBe('/main/wechat.png');
    expect(appAssetUrl('logo/claude-ai-icon.svg', '/main/')).toBe(
      '/main/logo/claude-ai-icon.svg',
    );
  });

  test('keeps development assets at the root path', () => {
    expect(appAssetUrl('/app-version.json', '/')).toBe('/app-version.json');
  });
});
