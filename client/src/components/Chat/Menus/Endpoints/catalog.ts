import type { TModelSpec } from 'librechat-data-provider';
import type { Endpoint } from '~/common';

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
    description: 'Fast responses with low latency for everyday conversations.',
    group: 'GEMINI',
  },
  'gemini-3.1-pro-preview': {
    name: 'Gemini 3.1 Pro',
    description: 'Stronger reasoning for complex analysis and long documents.',
    group: 'GEMINI',
  },
  'gpt-5.6-sol': {
    name: 'GPT-5.6 Sol',
    description: 'Flagship reasoning and coding for demanding technical work.',
    group: 'OPENAI',
  },
  'gpt-5.6-terra': {
    name: 'GPT-5.6 Terra',
    description: 'A balanced choice for production content and business analysis.',
    group: 'OPENAI',
  },
  'gpt-5.5': {
    name: 'GPT-5.5',
    description: 'High-capability reasoning, writing and coding for complex tasks.',
    group: 'OPENAI',
  },
  'gpt-5.4': {
    name: 'GPT-5.4',
    description: 'A capable general-purpose model for reasoning, code and writing.',
    group: 'OPENAI',
  },
  'grok-4.6': {
    name: 'Grok 4.6',
    description: 'A general-purpose model for analysis and conversational work.',
    group: 'GROK',
  },
  'grok-4.5': {
    name: 'Grok 4.5',
    description: 'A flexible model for everyday reasoning and writing.',
    group: 'GROK',
  },
  'claude-opus-4-8': {
    name: 'Claude Opus 4.8',
    description: 'Advanced reasoning for nuanced analysis and long-form work.',
    group: 'ANTHROPIC',
  },
  'claude-sonnet-5': {
    name: 'Claude Sonnet 5',
    description: 'A balanced model for writing, analysis and coding.',
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
    group: groupForEndpoint(endpoint),
  };
}

export function buildModelCatalog(endpoints: Endpoint[], modelSpecs: TModelSpec[]): CatalogEntry[] {
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
        description: info.description,
      });
    });
  });

  modelSpecs.forEach((spec) => {
    const endpointValue = spec.preset.endpoint ?? spec.group ?? '';
    const endpoint = endpointByValue.get(endpointValue);
    const group = spec.group?.toUpperCase() || (endpoint ? groupForEndpoint(endpoint) : 'CUSTOM');
    entries.push({
      key: `spec:${spec.name}`,
      group,
      endpoint,
      spec,
      name: spec.label || spec.name,
      description: typeof spec.description === 'string' ? spec.description : undefined,
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
