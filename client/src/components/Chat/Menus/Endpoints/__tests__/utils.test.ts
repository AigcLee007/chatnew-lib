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
  it('does not expose the retired gpt-5.4 model', () => {
    const endpoint: Endpoint = {
      value: 'openAI',
      label: 'OpenAI',
      hasModels: true,
      icon: null,
      models: [{ name: 'gpt-5.4' }, { name: 'gpt-5.4-pro' }],
    };

    expect(buildModelCatalog([endpoint], [], localizeZh).map((entry) => entry.model)).toEqual([
      'gpt-5.4-pro',
    ]);
  });

  it('does not expose the retired Gemini 3.5 Flash preview model', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-3.5-flash-preview' }, { name: 'gemini-3.8-flash' }],
    };

    expect(buildModelCatalog([endpoint], [], localizeZh).map((entry) => entry.model)).toEqual([
      'gemini-3.8-flash',
    ]);
  });

  it('does not expose retired model specs', () => {
    const entries = buildModelCatalog(
      [],
      [
        {
          name: 'retired-gpt-5.4',
          label: 'GPT-5.4',
          preset: { model: 'gpt-5.4' },
        },
        {
          name: 'gpt-5.4-pro',
          label: 'GPT-5.4 Pro',
          preset: { model: 'gpt-5.4-pro' },
        },
      ] as TModelSpec[],
      localizeZh,
    );

    expect(entries.map((entry) => entry.spec?.preset.model)).toEqual(['gpt-5.4-pro']);
  });

  it('builds grouped display rows without changing model IDs', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-3.8-flash' }, { name: 'custom-model' }],
    };
    const entries = buildModelCatalog([endpoint], [], localizeZh);
    expect(entries.map((entry) => entry.model)).toEqual(['gemini-3.8-flash', 'custom-model']);
    expect(entries[0]).toMatchObject({
      group: 'GEMINI',
      model: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
    });
    expect(entries[0].description).toContain('快速');
    expect(groupModelCatalog(entries).get('GEMINI')).toHaveLength(2);
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
    [
      'openAI',
      'OpenAI',
      'gpt-6-astra',
      'GPT-6 Astra',
      'OPENAI',
      'GPT最新绝对旗舰，适用于科学前沿计算、复杂逆向工程/全栈架构改造、自主桌面工作流执行、深度跨领域学术研究、严苛法规业务分析，按Tokens计费。',
    ],
    [
      'anthropic',
      'Anthropic',
      'claude-fable-5-1',
      'Claude Fable 5.1',
      'ANTHROPIC',
      '价低线路的claude-fable-5-1，如果报错请切换claude-fable-5-1-high，按Tokens计费。',
    ],
    [
      'openAI',
      'OpenAI',
      'gpt-6.1-sol',
      'GPT-6.1 Sol',
      'OPENAI',
      'GPT最新旗舰模型，接近 Astra 表现的生产级 Agent 默认模型，按Tokens计费。',
    ],
    [
      'openAI',
      'OpenAI',
      'gpt-6-sol',
      'GPT-6 Sol',
      'OPENAI',
      'GPT第六代主力生产力模型，适用于日常主力代码生成与重构、PR 审查、Devin/Codex 类自动化 Agent、复杂流程编排、多步骤数据分析管道，按Tokens计费。',
    ],
    [
      'openAI',
      'OpenAI',
      'gpt-6-luna',
      'GPT-6 Luna',
      'OPENAI',
      '极致成本效益与高并发吞吐。特价按次：0.2/次。',
    ],
    [
      'anthropic',
      'Anthropic',
      'claude-opus-5-5',
      'Claude Opus 5.5',
      'ANTHROPIC',
      '价低线路的claude-opus-5.5，如果报错请切换claude-opus-5.5-high，按Tokens计费。',
    ],
  ])(
    'uses a readable label for %s model %s',
    (value, label, model, name, group, expectedDescription) => {
      const endpoint: Endpoint = {
        value,
        label,
        hasModels: true,
        icon: null,
        models: [{ name: model }],
      };

      const [entry] = buildModelCatalog([endpoint], [], localizeZh);
      expect(entry).toMatchObject({ model, name, group });
      expect(entry.description).toBe(expectedDescription);
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
      models: [{ name: 'gemini-3.8-flash' }],
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
