import type { TReasoningOverride } from './schemas';
import type { SettingDefinition } from './generate';
import {
  EModelEndpoint,
  Providers,
  ReasoningEffort,
  ReasoningParameterFormat,
  reasoningOverrideSchema,
} from './schemas';

export type ReasoningCatalogCapability = {
  values?: string[];
  required?: boolean;
};

export type ReasoningTarget = {
  endpoint: string;
  model: string;
  provider?: string;
  parameterDefinitions?: SettingDefinition[];
  settings?: SettingDefinition[];
  reasoningFormat?: ReasoningParameterFormat | string;
  dropParams?: string[];
  blockedParameters?: string[];
  catalogCapability?: ReasoningCatalogCapability;
};

const reasoningKeys = ['reasoning_effort', 'effort', 'thinkingLevel', 'thinkingBudget'];

function inferReasoningKey({ endpoint, model, provider }: ReasoningTarget): string | undefined {
  const modelId = model.toLowerCase().replace(/^models\//, '');
  const effectiveEndpoint = provider ?? endpoint;

  if (effectiveEndpoint === EModelEndpoint.google || effectiveEndpoint === 'vertexai') {
    if (/^(gemini-3|gemini-4|gemma-4)(?:[.-]|$)/.test(modelId)) {
      return 'thinkingLevel';
    }
    if (/^gemini-2\.5(?:[.-]|$)/.test(modelId)) {
      return 'thinkingBudget';
    }
    return undefined;
  }

  if (effectiveEndpoint === EModelEndpoint.anthropic) {
    if (/^claude-(?:opus|sonnet|haiku)-4[-.][6-9](?:[.-]|$)/.test(modelId)) {
      return 'effort';
    }
    if (/^claude-(?:3[.-]7|(?:opus|sonnet|haiku)-[4-9])(?:[.-]|$)/.test(modelId)) {
      return 'thinkingBudget';
    }
    return undefined;
  }

  if (effectiveEndpoint === EModelEndpoint.openAI) {
    if (/^(?:o[134](?:[.-]|$)|gpt-5(?:[.-]|$))/.test(modelId)) {
      return 'reasoning_effort';
    }
    return undefined;
  }

  if (
    effectiveEndpoint === Providers.OPENROUTER ||
    effectiveEndpoint.toLowerCase() === 'openrouter'
  ) {
    return undefined;
  }

  if (effectiveEndpoint === EModelEndpoint.bedrock) {
    if (/^(?:moonshot|moonshotai|zai)\./.test(modelId)) {
      return 'reasoning_effort';
    }
    if (/^anthropic\.claude-(?:opus|sonnet|haiku)-4[-.][6-9](?:[.-]|$)/.test(modelId)) {
      return 'effort';
    }
    if (/^anthropic\.claude-(?:3[.-]7|(?:opus|sonnet|haiku)-[4-9])(?:[.-]|$)/.test(modelId)) {
      return 'thinkingBudget';
    }
  }

  return undefined;
}

function isReasoningDefinition(setting: SettingDefinition): boolean {
  return reasoningKeys.includes(setting.key);
}

/** Resolves the one reasoning control the active model can safely accept. */
export function resolveReasoningSetting(target: ReasoningTarget): SettingDefinition | undefined {
  const {
    model,
    parameterDefinitions = [],
    settings,
    reasoningFormat,
    dropParams = [],
    blockedParameters = [],
    catalogCapability,
  } = target;
  if (!model || reasoningFormat === ReasoningParameterFormat.disabled) {
    return undefined;
  }

  const explicitDefinitions = parameterDefinitions.filter(isReasoningDefinition);
  const inferredKey = catalogCapability ? 'reasoning_effort' : inferReasoningKey(target);
  const availableSettings = settings ?? [];
  let setting = explicitDefinitions.find((definition) => definition.key === inferredKey);

  if (!setting && explicitDefinitions.length > 0 && inferredKey == null) {
    const formatKey =
      reasoningFormat === ReasoningParameterFormat.reasoningEffort ? 'reasoning_effort' : undefined;
    const explicitKey = formatKey ?? explicitDefinitions[0]?.key;
    const canUseExplicitKey =
      target.endpoint === EModelEndpoint.azureOpenAI ||
      target.endpoint === EModelEndpoint.custom ||
      target.provider != null;
    setting = canUseExplicitKey
      ? explicitDefinitions.find((definition) => definition.key === explicitKey)
      : undefined;
  }

  if (!setting && inferredKey) {
    setting = availableSettings.find((definition) => definition.key === inferredKey);
  }

  if (!setting) {
    return undefined;
  }
  if (dropParams.includes(setting.key) || blockedParameters.includes(setting.key)) {
    return undefined;
  }

  if (catalogCapability) {
    if (setting.key !== 'reasoning_effort' || catalogCapability.values?.length === 0) {
      return undefined;
    }
    if (catalogCapability.values) {
      const supportedValues = new Set(catalogCapability.values);
      const options = (setting.options ?? []).filter(
        (option) => option === ReasoningEffort.unset || supportedValues.has(option),
      );
      if (catalogCapability.required) {
        const withoutAuto = options.filter(
          (option) => option !== ReasoningEffort.unset && option !== ReasoningEffort.none,
        );
        return withoutAuto.length > 0 ? { ...setting, options: withoutAuto } : undefined;
      }
      return options.length > 0 ? { ...setting, options } : undefined;
    }
  }

  return setting;
}

export function isSupportedReasoningOverride(
  target: ReasoningTarget,
  override: TReasoningOverride,
): boolean {
  const parsed = reasoningOverrideSchema.safeParse(override);
  if (!parsed.success) {
    return false;
  }

  const setting = resolveReasoningSetting(target);
  if (!setting || setting.key !== parsed.data.key) {
    return false;
  }

  if (setting.type === 'enum') {
    return (
      typeof parsed.data.value === 'string' && (setting.options ?? []).includes(parsed.data.value)
    );
  }
  if (setting.type !== 'number' || typeof parsed.data.value !== 'number') {
    return false;
  }

  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    step,
  } = setting.range ?? {};
  if (parsed.data.value < min || parsed.data.value > max) {
    return false;
  }
  if (step === undefined || !Number.isFinite(min)) {
    return true;
  }
  const steps = (parsed.data.value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-8;
}

const reasoningParameterKeys = new Set([
  'reasoning_effort',
  'reasoning_summary',
  'reasoning_mode',
  'reasoning_context',
  'effort',
  'thinking',
  'thinkingBudget',
  'thinkingLevel',
  'thinkingDisplay',
]);

export function filterReasoningSettings(
  settings: SettingDefinition[],
  target: ReasoningTarget,
): SettingDefinition[] {
  const active = resolveReasoningSetting({ ...target, settings });
  return settings.filter(
    (setting) => !reasoningParameterKeys.has(setting.key) || setting.key === active?.key,
  );
}
