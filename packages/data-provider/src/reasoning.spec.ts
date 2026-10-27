import type { SettingDefinition } from './generate';
import {
  filterReasoningSettings,
  isSupportedReasoningOverride,
  resolveReasoningSetting,
} from './reasoning';
import { EModelEndpoint, ReasoningParameterFormat } from './schemas';

const setting = (key: string): SettingDefinition => ({
  key,
  label: key,
  type: 'enum',
  options: ['low', 'medium', 'high'],
  component: 'slider',
});

describe('resolveReasoningSetting', () => {
  it.each(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-luna'])(
    'exposes reasoning effort for deployed OpenAI model %s',
    (model) => {
      expect(
        resolveReasoningSetting({
          endpoint: EModelEndpoint.openAI,
          model,
          settings: [setting('reasoning_effort')],
        })?.key,
      ).toBe('reasoning_effort');
    },
  );

  it.each([
    'claude-opus-5-5',
    'claude-sonnet-5-5-thinking',
    'claude-opus-4-7',
    'anthropic/claude-sonnet-5.5',
  ])('uses effort levels instead of a numeric thinking budget for %s', (model) => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.anthropic,
        model,
        settings: [
          setting('effort'),
          { ...setting('thinkingBudget'), type: 'number', options: undefined },
        ],
      })?.key,
    ).toBe('effort');
  });

  it('recognizes the configured OpenAI-compatible endpoint identity', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.custom,
        provider: 'OpenAI',
        model: 'gpt-6.1-sol',
        settings: [setting('reasoning_effort')],
      })?.key,
    ).toBe('reasoning_effort');
  });

  it.each([
    ['grok-4.7', ['', 'low', 'medium', 'high', 'xhigh']],
    ['grok-4.6', ['', 'low', 'medium', 'high', 'xhigh']],
    ['grok-4.5', ['', 'low', 'medium', 'high']],
    ['grok-3-mini', ['', 'low', 'high']],
  ])('offers only supported Grok effort levels for %s', (model, options) => {
    const resolved = resolveReasoningSetting({
      endpoint: EModelEndpoint.custom,
      endpointName: 'xAI',
      model: model as string,
      settings: [
        {
          ...setting('reasoning_effort'),
          options: ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
        },
      ],
    });
    expect(resolved?.options).toEqual(options);
  });

  it('resolves the deployed custom OpenAI endpoint without a provider declaration', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.custom,
        endpointName: 'OpenAI',
        model: 'gpt-6-astra',
        settings: [setting('reasoning_effort')],
      })?.key,
    ).toBe('reasoning_effort');
  });

  it.each(['OpenAI', 'xAI'])(
    'recognizes %s after config normalizes defaultParamsEndpoint to custom',
    (endpointName) => {
      expect(
        resolveReasoningSetting({
          endpoint: EModelEndpoint.custom,
          endpointName,
          provider: EModelEndpoint.custom,
          model: endpointName === 'OpenAI' ? 'gpt-6.1-sol' : 'grok-4.7',
          settings: [setting('reasoning_effort')],
        })?.key,
      ).toBe('reasoning_effort');
    },
  );

  it('does not offer unsupported minimal thinking for Gemini Argon', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.google,
        model: 'gemini-4-argon-high',
        settings: [
          { ...setting('thinkingLevel'), options: ['', 'minimal', 'low', 'medium', 'high'] },
        ],
      })?.options,
    ).toEqual(['', 'low', 'medium', 'high']);
  });

  it('retains extended Claude 5.5 effort levels but removes xhigh for Claude 4.6', () => {
    const settings = [
      { ...setting('effort'), options: ['', 'low', 'medium', 'high', 'xhigh', 'max'] },
    ];
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.anthropic,
        model: 'claude-opus-5-5',
        settings,
      })?.options,
    ).toEqual(settings[0].options);
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.anthropic,
        model: 'claude-sonnet-4-6',
        settings,
      })?.options,
    ).toEqual(['', 'low', 'medium', 'high', 'max']);
  });

  it('does not offer none or minimal for GPT-6 Astra and Sol', () => {
    const settings = [
      {
        ...setting('reasoning_effort'),
        options: ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      },
    ];
    expect(
      resolveReasoningSetting({ endpoint: EModelEndpoint.openAI, model: 'gpt-6-astra', settings })
        ?.options,
    ).toEqual(['', 'low', 'medium', 'high', 'xhigh', 'max']);
    expect(
      resolveReasoningSetting({ endpoint: EModelEndpoint.openAI, model: 'gpt-6-luna', settings })
        ?.options,
    ).toEqual(['', 'none', 'low', 'medium', 'high', 'xhigh', 'max']);
  });

  it('uses explicit custom endpoint parameter definitions for opaque models', () => {
    const explicit = setting('reasoning_effort');
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.custom,
        model: 'my-private-deployment',
        parameterDefinitions: [explicit],
        reasoningFormat: ReasoningParameterFormat.reasoningEffort,
      }),
    ).toBe(explicit);
  });

  it('does not infer reasoning support for opaque Azure deployments', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.azureOpenAI,
        model: 'reasoning-prod-deployment',
      }),
    ).toBeUndefined();
  });

  it('does not infer reasoning support for opaque custom model names', () => {
    expect(
      resolveReasoningSetting({ endpoint: EModelEndpoint.custom, model: 'o3-compatible' }),
    ).toBeUndefined();
  });

  it('prefers thinkingLevel for Gemini 3 and thinkingBudget for Gemini 2.5', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.google,
        model: 'gemini-3.1-pro',
        settings: [setting('thinkingLevel')],
      })?.key,
    ).toBe('thinkingLevel');
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.google,
        model: 'gemini-2.5-pro',
        settings: [setting('thinkingBudget')],
      })?.key,
    ).toBe('thinkingBudget');
  });

  it('resolves adaptive effort for Claude 4.6+', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.anthropic,
        model: 'claude-sonnet-4-6',
        settings: [setting('effort')],
      })?.key,
    ).toBe('effort');
  });

  it('uses the declared provider for an opaque custom endpoint model', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.custom,
        provider: EModelEndpoint.anthropic,
        model: 'claude-sonnet-4-6',
        settings: [setting('effort')],
      })?.key,
    ).toBe('effort');
  });

  it('resolves reasoning effort only for OpenAI reasoning model families', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        settings: [setting('reasoning_effort')],
      })?.key,
    ).toBe('reasoning_effort');
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.openAI,
        model: 'gpt-4.1',
        settings: [setting('reasoning_effort')],
      }),
    ).toBeUndefined();
  });

  it('allows parameter definitions to establish Bedrock model support', () => {
    const explicit = setting('reasoning_effort');
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.bedrock,
        model: 'moonshotai.kimi-k2.5',
        parameterDefinitions: [explicit],
      }),
    ).toBe(explicit);
  });

  it('honors disabled reasoning formats and dropped parameters', () => {
    const params = [setting('reasoning_effort')];
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        settings: [setting('reasoning_effort')],
        parameterDefinitions: params,
        reasoningFormat: ReasoningParameterFormat.disabled,
      }),
    ).toBeUndefined();
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        settings: [setting('reasoning_effort')],
        parameterDefinitions: params,
        dropParams: ['reasoning_effort'],
      }),
    ).toBeUndefined();
  });

  it('does not expose a setting restricted by the active model spec', () => {
    expect(
      resolveReasoningSetting({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        settings: [setting('reasoning_effort')],
        blockedParameters: ['reasoning_effort'],
      }),
    ).toBeUndefined();
  });

  it('filters unsupported reasoning settings while retaining unrelated settings', () => {
    const settings = [setting('reasoning_effort'), setting('temperature')];
    expect(
      filterReasoningSettings(settings, {
        endpoint: EModelEndpoint.openAI,
        model: 'gpt-4.1',
      }).map(({ key }) => key),
    ).toEqual(['temperature']);
  });

  it('keeps model-specific effort options in the parameter panel', () => {
    const settings = [
      {
        ...setting('reasoning_effort'),
        options: ['', 'none', 'low', 'medium', 'high', 'xhigh', 'max'],
      },
    ];
    expect(
      filterReasoningSettings(settings, {
        endpoint: EModelEndpoint.custom,
        endpointName: 'xAI',
        model: 'grok-4.7',
      })[0].options,
    ).toEqual(['', 'low', 'medium', 'high', 'xhigh']);
  });

  it.each(['dropParams', 'blockedParameters'] as const)(
    'honors %s when thinking is disabled by policy',
    (restriction) => {
      expect(
        resolveReasoningSetting({
          endpoint: EModelEndpoint.anthropic,
          model: 'claude-opus-5-5',
          settings: [setting('effort')],
          [restriction]: ['thinking'],
        }),
      ).toBeUndefined();
    },
  );

  it('filters catalog values and removes auto when reasoning is mandatory', () => {
    const result = resolveReasoningSetting({
      endpoint: EModelEndpoint.custom,
      model: 'vendor/reasoning-model',
      settings: [
        {
          ...setting('reasoning_effort'),
          options: ['', 'none', 'low', 'medium', 'high'],
        },
      ],
      catalogCapability: { values: ['low', 'high'], required: true },
    });
    expect(result?.options).toEqual(['low', 'high']);
  });

  it('accepts only values allowed by the resolved model setting', () => {
    const target = {
      endpoint: EModelEndpoint.openAI,
      model: 'o3-mini',
      settings: [{ ...setting('reasoning_effort'), options: ['low', 'high'] }],
    };
    expect(isSupportedReasoningOverride(target, { key: 'reasoning_effort', value: 'high' })).toBe(
      true,
    );
    expect(isSupportedReasoningOverride(target, { key: 'reasoning_effort', value: 'max' })).toBe(
      false,
    );
    expect(isSupportedReasoningOverride(target, { key: 'temperature', value: 0 })).toBe(false);
  });

  it('enforces numeric reasoning budget bounds', () => {
    const target = {
      endpoint: EModelEndpoint.google,
      model: 'gemini-2.5-pro',
      settings: [
        {
          ...setting('thinkingBudget'),
          type: 'number' as const,
          range: { min: 0, max: 32768, step: 1024 },
          options: undefined,
        },
      ],
    };
    expect(isSupportedReasoningOverride(target, { key: 'thinkingBudget', value: 4096 })).toBe(true);
    expect(isSupportedReasoningOverride(target, { key: 'thinkingBudget', value: 40000 })).toBe(
      false,
    );
  });
});
