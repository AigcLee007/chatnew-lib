import type { TModelSpec } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import type { TranslationKeys } from '~/hooks/useLocalize';

type CatalogLocalize = (key: TranslationKeys) => string;

export type CatalogGroup = 'GEMINI' | 'OPENAI' | 'GROK' | 'ANTHROPIC' | string;

export type CatalogEntry = {
  key: string;
  group: CatalogGroup;
  endpoint?: Endpoint;
  model?: string;
  spec?: TModelSpec;
  name: string;
  description?: string;
};

const MODEL_INFO: Record<string, { name: string; description: string; group: CatalogGroup }> = {
  'gemini-3.5-flash-preview': {
    name: 'Gemini 3.5 Flash',
    description: '响应快速、延迟低，适合日常对话与内容生成。',
    group: 'GEMINI',
  },
  'gemini-3.7-flash': {
    name: 'Gemini 3.7 Flash',
    description: '响应快速、延迟低，适合日常对话与内容生成。',
    group: 'GEMINI',
  },
  'gemini-3.1-pro-preview': {
    name: 'Gemini 3.1 Pro',
    description: '擅长复杂分析与长文档理解，适合需要深入推理的任务。',
    group: 'GEMINI',
  },
  'gpt-5.6-sol': {
    name: 'GPT-5.6 Sol',
    description: '旗舰级推理与编程能力，适合高要求的技术工作。',
    group: 'OPENAI',
  },
  'gpt-5.6-terra': {
    name: 'GPT-5.6 Terra',
    description: '兼顾质量与效率，适合内容生产和业务分析。',
    group: 'OPENAI',
  },
  'gpt-5.5': {
    name: 'GPT-5.5',
    description: '具备强大的推理、写作与编程能力，适合复杂任务。',
    group: 'OPENAI',
  },
  'gpt-5.4': {
    name: 'GPT-5.4',
    description: '通用能力全面，适合推理、编程和写作。',
    group: 'OPENAI',
  },
  'grok-4.6': {
    name: 'Grok 4.6',
    description: '适合分析、日常对话和通用任务处理。',
    group: 'GROK',
  },
  'grok-4.5': {
    name: 'Grok 4.5',
    description: '适合日常推理、写作与灵活的对话任务。',
    group: 'GROK',
  },
  'claude-opus-4-8': {
    name: 'Claude Opus 4.8',
    description: '擅长细致分析、长文本处理与复杂推理。',
    group: 'ANTHROPIC',
  },
  'claude-sonnet-5': {
    name: 'Claude Sonnet 5',
    description: '平衡写作、分析与编程能力，适合日常专业工作。',
    group: 'ANTHROPIC',
  },
};

const GROUP_ALIASES: Record<string, CatalogGroup> = {
  google: 'GEMINI',
  gemini: 'GEMINI',
  openai: 'OPENAI',
  'azure openai': 'OPENAI',
  anthropic: 'ANTHROPIC',
  grok: 'GROK',
  xai: 'GROK',
};

function groupForEndpoint(endpoint: Endpoint): CatalogGroup {
  return (
    GROUP_ALIASES[endpoint.label.toLowerCase()] ??
    GROUP_ALIASES[endpoint.value.toLowerCase()] ??
    endpoint.label.toUpperCase()
  );
}

const GROUP_DESCRIPTIONS: Record<string, string> = {
  GEMINI: '适合快速对话、内容生成与多模态任务。',
  OPENAI: '适合推理、编程、写作与通用问答。',
  ANTHROPIC: '适合长文本分析、写作与复杂推理。',
  GROK: '适合实时信息分析、推理与日常对话。',
};

function descriptionForGroup(group: CatalogGroup) {
  return GROUP_DESCRIPTIONS[group] ?? '适合通用对话、写作与任务处理。';
}

function groupForModel(model?: string) {
  const value = model?.toLowerCase() ?? '';
  if (/claude|anthropic/.test(value)) return 'ANTHROPIC';
  if (/gemini|gemma|google/.test(value)) return 'GEMINI';
  if (/gpt|openai|o[1-9](?:-|$)/.test(value)) return 'OPENAI';
  if (/grok|xai/.test(value)) return 'GROK';
  return null;
}

function localizeDescription(description: string, localize?: CatalogLocalize) {
  if (!localize) {
    return description;
  }
  const key = Object.entries(DESCRIPTION_TRANSLATIONS).find(
    ([, value]) => value.zh === description,
  )?.[0];
  return key ? localize(key as TranslationKeys) : description;
}

const DESCRIPTION_TRANSLATIONS: Record<string, { zh: string }> = {
  com_model_desc_gemini_flash: { zh: '响应快速、延迟低，适合日常对话与内容生成。' },
  com_model_desc_gemini_pro: { zh: '擅长复杂分析与长文档理解，适合需要深入推理的任务。' },
  com_model_desc_openai_sol: { zh: '旗舰级推理与编程能力，适合高要求的技术工作。' },
  com_model_desc_openai_terra: { zh: '兼顾质量与效率，适合内容生产和业务分析。' },
  com_model_desc_openai_55: { zh: '具备强大的推理、写作与编程能力，适合复杂任务。' },
  com_model_desc_openai_54: { zh: '通用能力全面，适合推理、编程和写作。' },
  com_model_desc_grok_46: { zh: '适合分析、日常对话和通用任务处理。' },
  com_model_desc_grok_45: { zh: '适合日常推理、写作与灵活的对话任务。' },
  com_model_desc_claude_opus: { zh: '擅长细致分析、长文本处理与复杂推理。' },
  com_model_desc_claude_sonnet: { zh: '平衡写作、分析与编程能力，适合日常专业工作。' },
};

export function modelDisplayInfo(
  model: string,
  endpoint: Endpoint,
): {
  name: string;
  description?: string;
  group: CatalogGroup;
} {
  const known = MODEL_INFO[model.toLowerCase()];
  if (known) {
    return known;
  }

  return {
    name: model,
    description: descriptionForGroup(groupForEndpoint(endpoint)),
    group: groupForEndpoint(endpoint),
  };
}

export function buildModelCatalog(
  endpoints: Endpoint[],
  modelSpecs: TModelSpec[],
  localize?: CatalogLocalize,
): CatalogEntry[] {
  const endpointByValue = new Map(endpoints.map((endpoint) => [endpoint.value, endpoint]));
  const entries: CatalogEntry[] = [];

  endpoints.forEach((endpoint) => {
    if (!endpoint.models || endpoint.models.length === 0) {
      return;
    }
    endpoint.models.forEach(({ name: model }) => {
      const info = modelDisplayInfo(model, endpoint);
      entries.push({
        key: `model:${endpoint.value}:${model}`,
        group: info.group,
        endpoint,
        model,
        name: info.name,
        description: localizeDescription(
          info.description ?? descriptionForGroup(info.group),
          localize,
        ),
      });
    });
  });

  modelSpecs.forEach((spec) => {
    const endpointValue = spec.preset.endpoint ?? spec.group ?? '';
    const endpoint = endpointByValue.get(endpointValue);
    const group =
      (endpoint ? groupForEndpoint(endpoint) : null) ??
      groupForModel(spec.preset.model ?? undefined) ??
      spec.group?.toUpperCase() ??
      'CUSTOM';
    entries.push({
      key: `spec:${spec.name}`,
      group,
      endpoint,
      spec,
      name: spec.label || spec.name,
      description: localizeDescription(
        typeof spec.description === 'string' && spec.description.trim().length > 0
          ? spec.description
          : descriptionForGroup(group),
        localize,
      ),
    });
  });

  return entries;
}

export function filterModelCatalog(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return entries;
  }
  return entries.filter((entry) =>
    [entry.name, entry.model, entry.description, entry.group].some((value) =>
      value?.toLowerCase().includes(term),
    ),
  );
}

export function groupModelCatalog(entries: CatalogEntry[]): Map<CatalogGroup, CatalogEntry[]> {
  const groups = new Map<CatalogGroup, CatalogEntry[]>();
  entries.forEach((entry) => {
    const group = groups.get(entry.group);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.group, [entry]);
    }
  });
  return groups;
}
