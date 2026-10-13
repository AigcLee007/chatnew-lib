import type { Endpoint } from '~/common';
import zh from '~/locales/zh-Hans/translation.json';
import en from '~/locales/en/translation.json';
import { buildModelCatalog, filterModelCatalog, groupModelCatalog } from '../catalog';

describe('Gemini 4 Argon catalog', () => {
  it('offers the Google route with a localized description and searchable display name', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-4-argon' }],
    };
    const entries = buildModelCatalog([endpoint], [], (key: keyof typeof en) => zh[key] ?? en[key]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      endpoint,
      model: 'gemini-4-argon',
      name: 'Gemini 4 Argon',
      group: 'GEMINI',
      description: zh.com_model_desc_gemini_pro,
    });
    expect(filterModelCatalog(entries, 'Argon')).toEqual(entries);
    expect(groupModelCatalog(entries).get('GEMINI')).toEqual(entries);
    expect(buildModelCatalog([endpoint], [], (key) => en[key])[0].description).toBe(
      en.com_model_desc_gemini_pro,
    );
  });
});
