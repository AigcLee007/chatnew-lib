import type { TReasoningOverride } from './schemas';
import type { SettingDefinition } from './generate';
import {
  EModelEndpoint,
  Providers,
  ReasoningEffort,
  ReasoningParameterFormat,
  reasoningOverrideSchema,
} from './schemas';
import { supportsAdaptiveThinking } from './bedrock';

export type ReasoningCatalogCapability = {
  values?: string[];
  required?: boolean;
};

export type ReasoningTarget = {
  endpoint: string;
  endpointName?: string;
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

export function isThinkingParameter(key: string | number): boolean {
  return key === 'effort' || key === 'thinkingLevel' || key === 'thinkingBudget';
}

function getReasoningProvider({ endpoint, endpointName, provider }: ReasoningTarget): string {
  const declaredProvider = provider?.toLowerCase();
  if (declaredProvider && declaredProvider !== EModelEndpoint.custom) {
    return declaredProvider;
  }
  return (endpoint === EModelEndpoint.custom ? (endpointName ?? endpoint) : endpoint).toLowerCase();
}

function inferReasoningKey(target: ReasoningTarget): string | undefined {
  const modelId = target.model.toLowerCase().replace(/^models\//, '');
  const effectiveEndpoint = getReasoningProvider(target);

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
    if (supportsAdaptiveThinking(modelId)) {
      return 'effort';
    }
    if (/^claude-(?:3[.-]7|(?:opus|sonnet|haiku)-[4-9])(?:[.-]|$)/.test(modelId)) {
      return 'thinkingBudget';
    }
    return undefined;
  }

  if (effectiveEndpoint === EModelEndpoint.openAI.toLowerCase()) {
    if (/^(?:o[134](?:[.-]|$)|gpt-[56](?:[.-]|$))/.test(modelId) && !/-chat(?:-|$)/.test(modelId)) {
      return 'reasoning_effort';
    }
    return undefined;
  }

  if (effectiveEndpoint === 'xai') {
    return /^grok-(?:3-mini|4[.-][567])(?:[.-]|$)/.test(modelId) ? 'reasoning_effort' : undefined;
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
    if (supportsAdaptiveThinking(modelId)) {
      return 'effort';
    }
    if (/^anthropic\.claude-(?:3[.-]7|(?:opus|sonnet|haiku)-[4-9])(?:[.-]|$)/.test(modelId)) {
      return 'thinkingBudget';
    }
  }

  return undefined;
}

function restrictReasoningOptions(
  setting: SettingDefinition,
  target: ReasoningTarget,
): SettingDefinition {
  if (setting.type !== 'enum') {
    return setting;
  }
  const model = target.model.toLowerCase().replace(/^models\//, '');
  const provider = getReasoningProvider(target);
  let supported: string[] | undefined;
  if (provider === EModelEndpoint.openAI.toLowerCase() && /^gpt-6(?:[.-]|$)/.test(model)) {
    supported = /-luna(?:-|$)/.test(model)
      ? ['none', 'low', 'medium', 'high', 'xhigh', 'max']
      : ['low', 'medium', 'high', 'xhigh', 'max'];
  } else if (provider === 'xai') {
    supported = ['low', 'medium', 'high'];
    if (/^grok-3-mini(?:-|$)/.test(model)) {
      supported = ['low', 'high'];
    } else if (/^grok-4[.-][67](?:[.-]|$)/.test(model)) {
      supported.push('xhigh');
    }
  } else if (setting.key === 'effort' && /claude-(?:sonnet|opus)-4[-.]6(?:[.-]|$)/.test(model)) {
    supported = ['low', 'medium', 'high', 'max'];
  } else if (setting.key === 'thinkingLevel') {
    if (/^gemini-3-pro(?:-|$)/.test(model)) {
      supported = ['low', 'high'];
    } else if (/^gemini-(?:4|3[.-]8|3[.-]1-pro)(?:[.-]|$)/.test(model)) {
      supported = ['low', 'medium', 'high'];
    }
  }
  if (!supported) {
    return setting;
  }
  return {
    ...setting,
    options: setting.options?.filter((value) => value === '' || supported.includes(value)),
  };
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
  if (
    dropParams.includes(setting.key) ||
    blockedParameters.includes(setting.key) ||
    (isThinkingParameter(setting.key) &&
      (dropParams.includes('thinking') || blockedParameters.includes('thinking')))
  ) {
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

  return restrictReasoningOptions(setting, target);
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
  return settings.flatMap((setting) => {
    if (setting.key === active?.key) {
      return [active];
    }
    return reasoningParameterKeys.has(setting.key) ? [] : [setting];
  });
}
