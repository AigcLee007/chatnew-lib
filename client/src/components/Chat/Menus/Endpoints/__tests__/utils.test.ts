import type { useLocalize } from '~/hooks';
import type { Endpoint } from '~/common';
import type { TModelSpec } from 'librechat-data-provider';
import zh from '~/locales/zh-Hans/translation.json';
import en from '~/locales/en/translation.json';
import { filterItems } from '../utils';
import { buildModelCatalog, filterModelCatalog, groupModelCatalog } from '../catalog';

const localizeZh = (key: keyof typeof en) => zh[key] ?? en[key];
const localizeEn = (key: keyof typeof en) => en[key];

const agentsEndpoint: Endpoint = {
  value: 'agents',
  label: 'My Agents',
  hasModels: true,
  icon: null,
  showMarketplace: true,
  searchAliases: ['agent marketplace', 'marketplace'],
};

const disabledAgentsEndpoint: Endpoint = {
  value: 'agents',
  label: 'My Agents',
  hasModels: false,
  icon: null,
};

describe('model selector utilities', () => {
  it('builds grouped display rows without changing model IDs', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [
        { name: 'gemini-3.5-flash-preview' },
        { name: 'gemini-3.7-flash' },
        { name: 'gemini-3.8-flash' },
        { name: 'custom-model' },
      ],
    };
    const entries = buildModelCatalog([endpoint], [], localizeZh);
    expect(entries.map((entry) => entry.model)).toEqual([
      'gemini-3.5-flash-preview',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'custom-model',
    ]);
    expect(entries[0]).toMatchObject({ group: 'GEMINI', name: 'Gemini 3.5 Flash' });
    expect(entries[1]).toMatchObject({
      group: 'GEMINI',
      model: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
    });
    expect(entries[2]).toMatchObject({
      group: 'GEMINI',
      model: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
    });
    expect(entries[0].description).toContain('快速');
    expect(entries[1].description).toContain('快速');
    expect(entries[2].description).toContain('快速');
    expect(groupModelCatalog(entries).get('GEMINI')).toHaveLength(4);
  });

  it('provides a Chinese fallback description for unknown provider models', () => {
    const endpoint: Endpoint = {
      value: 'anthropic',
      label: 'Anthropic',
      hasModels: true,
      icon: null,
      models: [{ name: 'new-claude-model' }],
    };

    const [entry] = buildModelCatalog([endpoint], [], localizeZh);
    expect(entry.description).toBe('适合长文本分析、写作与复杂推理。');
  });

  it('uses human-readable labels for configured Claude model IDs', () => {
    const endpoint: Endpoint = {
      value: 'anthropic',
      label: 'Anthropic',
      hasModels: true,
      icon: null,
      models: [{ name: 'claude-opus-5' }],
    };

    const [entry] = buildModelCatalog([endpoint], [], localizeZh);
    expect(entry).toMatchObject({
      model: 'claude-opus-5',
      name: 'Claude Opus 5',
      group: 'ANTHROPIC',
    });
  });

  it.each([
    ['openAI', 'OpenAI', 'gpt-6-astra', 'GPT-6 Astra', 'OPENAI'],
    ['anthropic', 'Anthropic', 'claude-fable-5-1', 'Claude Fable 5.1', 'ANTHROPIC'],
  ])(
    'uses a readable label for %s model %s',
    (value, label, model, name, group) => {
      const endpoint: Endpoint = {
        value,
        label,
        hasModels: true,
        icon: null,
        models: [{ name: model }],
      };

      const [entry] = buildModelCatalog([endpoint], [], localizeZh);
      expect(entry).toMatchObject({ model, name, group });
      expect(entry.description).toBeTruthy();
    },
  );

  it('provides a Chinese fallback description for model specs without one', () => {
    const [entry] = buildModelCatalog(
      [],
      [
        {
          name: 'custom-spec',
          label: 'Custom Spec',
          group: 'custom',
          preset: {},
        } as TModelSpec,
      ],
      localizeZh,
    );

    expect(entry.description).toBe('适合通用对话、写作与任务处理。');
  });

  it('searches descriptions and keeps unknown models', () => {
    const endpoint: Endpoint = {
      value: 'openAI',
      label: 'OpenAI',
      hasModels: true,
      icon: null,
      models: [{ name: 'future-model' }],
    };
    const entries = buildModelCatalog([endpoint], [], localizeZh);
    expect(filterModelCatalog(entries, 'future')).toHaveLength(1);
    expect(filterModelCatalog(entries, 'missing')).toEqual([]);
  });

  it('localizes descriptions and searches the displayed Chinese text', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-3.5-flash-preview' }],
    };
    expect(buildModelCatalog([endpoint], [], localizeEn)[0].description).toContain('low latency');
    expect(filterModelCatalog(buildModelCatalog([endpoint], [], localizeZh), '延迟')).toHaveLength(
      1,
    );
  });

  it('uses the underlying model for fallback without overwriting configured descriptions', () => {
    const entries = buildModelCatalog(
      [],
      [
        {
          name: 'empty',
          group: 'My models',
          preset: { endpoint: 'gateway', model: 'claude-opus-5' },
          description: '  ',
        },
        { name: 'custom', preset: { endpoint: 'google' }, description: '管理员填写的说明' },
      ] as TModelSpec[],
      localizeZh,
    );
    expect(entries[0].description).toBe('适合长文本分析、写作与复杂推理。');
    expect(entries[1].description).toBe('管理员填写的说明');
  });

  it('matches endpoint search aliases', () => {
    const results = filterItems([agentsEndpoint], 'marketplace', undefined, undefined);
    expect(results).toEqual([agentsEndpoint]);
  });

  it('matches localized Marketplace labels', () => {
    const localize = ((key: string) => {
      if (key === 'com_agents_marketplace') {
        return 'Tienda de Agentes';
      }
      if (key === 'com_ui_marketplace') {
        return 'Tienda';
      }
      return key;
    }) as ReturnType<typeof useLocalize>;

    const results = filterItems([agentsEndpoint], 'tienda', undefined, undefined, localize);
    expect(results).toEqual([agentsEndpoint]);
  });

  it('does not match agents when there are no selectable agent options', () => {
    const results = filterItems([disabledAgentsEndpoint], 'my agents', undefined, undefined);
    expect(results).toEqual([]);
  });
});
