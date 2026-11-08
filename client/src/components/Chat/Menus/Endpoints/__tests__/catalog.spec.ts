import type { Endpoint } from '~/common';
import zh from '~/locales/zh-Hans/translation.json';
import en from '~/locales/en/translation.json';
import { buildModelCatalog, filterModelCatalog, groupModelCatalog } from '../catalog';

describe('Gemini 4 Carbon catalog', () => {
  it('keeps the call ID and shows the Chinese introduction and promotional price', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-4-carbon' }],
    };
    const entries = buildModelCatalog([endpoint], [], (key: keyof typeof en) => zh[key] ?? en[key]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      endpoint,
      model: 'gemini-4-carbon',
      name: 'Gemini 4 Carbon',
      group: 'GEMINI',
      description:
        '谷歌最新旗舰，擅长复杂工程、长周期 Agent 任务与安全审计，支持百万级上下文与多模态理解。特惠体验价，0.3/次。',
    });
    expect(filterModelCatalog(entries, 'Carbon')).toEqual(entries);
    expect(filterModelCatalog(entries, '特惠体验价')).toEqual(entries);
    expect(groupModelCatalog(entries).get('GEMINI')).toEqual(entries);
    expect(buildModelCatalog([endpoint], [], (key) => en[key])[0].description).toContain(
      '0.3/request',
    );
  });
});

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
