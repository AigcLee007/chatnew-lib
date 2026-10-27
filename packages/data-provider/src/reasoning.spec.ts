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
