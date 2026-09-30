import type { TModelSpec } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import type { TranslationKeys } from '~/hooks/useLocalize';

type CatalogLocalize = (key: TranslationKeys) => string;

const RETIRED_MODEL_IDS = new Set(['gpt-5.4', 'gemini-3.5-flash-preview']);

function isRetiredModel(model?: string) {
  return model != null && RETIRED_MODEL_IDS.has(model.toLowerCase());
}

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
  'gemini-3.8-flash': {
    name: 'Gemini 3.8 Flash',
    description: '响应快速、延迟低，适合日常对话与内容生成。',
    group: 'GEMINI',
  },
  'gemini-3.1-pro-preview': {
    name: 'Gemini 3.1 Pro',
    description: '擅长复杂分析与长文档理解，适合需要深入推理的任务。',
    group: 'GEMINI',
  },
  'gpt-6-astra': {
    name: 'GPT-6 Astra',
    description:
      'GPT最新绝对旗舰，适用于科学前沿计算、复杂逆向工程/全栈架构改造、自主桌面工作流执行、深度跨领域学术研究、严苛法规业务分析，按Tokens计费。',
    group: 'OPENAI',
  },
  'gpt-6.1-sol': {
    name: 'GPT-6.1 Sol',
    description: 'GPT最新旗舰模型，接近 Astra 表现的生产级 Agent 默认模型，按Tokens计费。',
    group: 'OPENAI',
  },
  'gpt-6-sol': {
    name: 'GPT-6 Sol',
    description:
      'GPT第六代主力生产力模型，适用于日常主力代码生成与重构、PR 审查、Devin/Codex 类自动化 Agent、复杂流程编排、多步骤数据分析管道，按Tokens计费。',
    group: 'OPENAI',
  },
  'gpt-6-luna': {
    name: 'GPT-6 Luna',
    description: '极致成本效益与高并发吞吐。特价按次：0.2/次。',
    group: 'OPENAI',
  },
  'gpt-5.6-sol': {
    name: 'GPT-5.6 Sol',
    description: 'GPT第五代主力生产力模型，特价按次：0.3/次。',
    group: 'OPENAI',
  },
  'gpt-5.6-terra': {
    name: 'GPT-5.6 Terra',
    description: '特价按次：0.2/次。',
    group: 'OPENAI',
  },
  'grok-4.7': {
    name: 'Grok 4.7',
    description:
      '旗舰主力。在复杂工程重构、跨文件代码排错、数学逻辑推导与自检（Self-Verification）上表现突出，擅长长时间执行任务，按次计费：0.25/次。',
    group: 'GROK',
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
  'claude-opus-5.5-high': {
    name: 'Claude Opus 5.5 High',
    description:
      'Anthropic Opus 系列最新旗舰，面向复杂推理、软件工程与长时程智能体任务，思考模式默认开启，按Tokens计费。',
    group: 'ANTHROPIC',
  },
  'claude-fable-5-1-high': {
    name: 'Claude Fable 5.1 High',
    description:
      '最强的Mythos 级模型。在更长、更复杂的任务上超越 Opus 系列，可持续自主工作的时间创 Claude 纪录，软件工程、科研与视觉表现卓越，按Tokens计费。',
    group: 'ANTHROPIC',
  },
  'claude-opus-5-5': {
    name: 'Claude Opus 5.5',
    description: '价低线路的claude-opus-5.5，如果报错请切换claude-opus-5.5-high，按Tokens计费。',
    group: 'ANTHROPIC',
  },
  'claude-fable-5-1': {
    name: 'Claude Fable 5.1',
    description: '价低线路的claude-fable-5-1，如果报错请切换claude-fable-5-1-high，按Tokens计费。',
    group: 'ANTHROPIC',
  },
  'claude-opus-5': {
    name: 'Claude Opus 5',
    description: 'Anthropic Opus 系列上一代旗舰，按次计费0.4/次。',
    group: 'ANTHROPIC',
  },
  'claude-sonnet-5': {
    name: 'Claude Sonnet 5',
    description:
      '迄今最具智能体能力的 Sonnet。能制定计划、驱动浏览器与终端等工具并自主完成多步任务，性价比高，按次计费0.28/次。',
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
  com_model_desc_openai_astra: {
    zh: 'GPT最新绝对旗舰，适用于科学前沿计算、复杂逆向工程/全栈架构改造、自主桌面工作流执行、深度跨领域学术研究、严苛法规业务分析，按Tokens计费。',
  },
  com_model_desc_openai_6_sol: {
    zh: 'GPT第六代主力生产力模型，适用于日常主力代码生成与重构、PR 审查、Devin/Codex 类自动化 Agent、复杂流程编排、多步骤数据分析管道，按Tokens计费。',
  },
  com_model_desc_openai_61_sol: {
    zh: 'GPT最新旗舰模型，接近 Astra 表现的生产级 Agent 默认模型，按Tokens计费。',
  },
  com_model_desc_openai_6_luna: { zh: '极致成本效益与高并发吞吐。特价按次：0.2/次。' },
  com_model_desc_openai_56_sol: { zh: 'GPT第五代主力生产力模型，特价按次：0.3/次。' },
  com_model_desc_openai_56_terra: { zh: '特价按次：0.2/次。' },
  com_model_desc_openai_sol: { zh: '旗舰级推理与编程能力，适合高要求的技术工作。' },
  com_model_desc_openai_terra: { zh: '兼顾质量与效率，适合内容生产和业务分析。' },
  com_model_desc_openai_55: { zh: '具备强大的推理、写作与编程能力，适合复杂任务。' },
  com_model_desc_grok_47: {
    zh: '旗舰主力。在复杂工程重构、跨文件代码排错、数学逻辑推导与自检（Self-Verification）上表现突出，擅长长时间执行任务，按次计费：0.25/次。',
  },
  com_model_desc_grok_46: { zh: '适合分析、日常对话和通用任务处理。' },
  com_model_desc_grok_45: { zh: '适合日常推理、写作与灵活的对话任务。' },
  com_model_desc_claude_opus_55_high: {
    zh: 'Anthropic Opus 系列最新旗舰，面向复杂推理、软件工程与长时程智能体任务，思考模式默认开启，按Tokens计费。',
  },
  com_model_desc_claude_fable_51_high: {
    zh: '最强的Mythos 级模型。在更长、更复杂的任务上超越 Opus 系列，可持续自主工作的时间创 Claude 纪录，软件工程、科研与视觉表现卓越，按Tokens计费。',
  },
  com_model_desc_claude_opus_55: {
    zh: '价低线路的claude-opus-5.5，如果报错请切换claude-opus-5.5-high，按Tokens计费。',
  },
  com_model_desc_claude_fable_51: {
    zh: '价低线路的claude-fable-5-1，如果报错请切换claude-fable-5-1-high，按Tokens计费。',
  },
  com_model_desc_claude_opus_5: { zh: 'Anthropic Opus 系列上一代旗舰，按次计费0.4/次。' },
  com_model_desc_claude_sonnet_5: {
    zh: '迄今最具智能体能力的 Sonnet。能制定计划、驱动浏览器与终端等工具并自主完成多步任务，性价比高，按次计费0.28/次。',
  },
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
      if (isRetiredModel(model)) {
        return;
      }
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
    if (isRetiredModel(spec.preset.model ?? undefined)) {
      return;
    }
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
