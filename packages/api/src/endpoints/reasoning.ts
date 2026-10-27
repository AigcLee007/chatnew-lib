import { createHash } from 'crypto';
import {
  getSettingsKeys,
  isSupportedReasoningOverride,
  paramSettings,
  reasoningOverrideSchema,
} from 'librechat-data-provider';
import type {
  ReasoningCatalogCapability,
  SettingDefinition,
  TReasoningOverride,
} from 'librechat-data-provider';

export type ReasoningOverrideValidationInput = {
  endpoint: string;
  model: string;
  override: unknown;
  provider?: string;
  defaultParamsEndpoint?: string;
  parameterDefinitions?: SettingDefinition[];
  reasoningFormat?: string;
  dropParams?: string[];
  blockedParameters?: string[];
  catalogCapability?: ReasoningCatalogCapability;
};

export type ReasoningOverrideValidation =
  | { valid: true; override: TReasoningOverride }
  | { valid: false; error: 'invalid_shape' | 'unsupported_target' | 'unsupported_value' };

export type OpenRouterReasoningCatalogOptions = {
  fetcher?: typeof fetch;
  now?: () => number;
  successTtlMs?: number;
  failureTtlMs?: number;
  timeoutMs?: number;
  maxPages?: number;
};

export type OpenRouterCatalogRequest = {
  endpoint: string;
  apiKey: string;
  model: string;
};

type CatalogEntry = {
  id?: string;
  reasoning_effort?: unknown;
  reasoning_required?: boolean;
};
type CatalogPage = { data?: CatalogEntry[]; next_page?: string | null };

const effortValues = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

function parseCatalogUrl(endpoint: string): URL {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('OpenRouter catalog URL is invalid');
  }
  return url;
}

export function createOpenRouterReasoningCatalog(options: OpenRouterReasoningCatalogOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const successTtlMs = options.successTtlMs ?? 5 * 60_000;
  const failureTtlMs = options.failureTtlMs ?? 15_000;
  const timeoutMs = options.timeoutMs ?? 3_000;
  const maxPages = options.maxPages ?? 5;
  const cache = new Map<
    string,
    { expiresAt: number; entries?: Map<string, ReasoningCatalogCapability> }
  >();

  async function loadCatalog({ endpoint, apiKey }: OpenRouterCatalogRequest) {
    const base = parseCatalogUrl(endpoint);
    const origin = base.origin;
    const initial = new URL('models', base.href.endsWith('/') ? base : `${base.href}/`);
    const entries = new Map<string, ReasoningCatalogCapability>();
    let next: URL | undefined = initial;
    for (let page = 0; next && page < maxPages; page++) {
      if (next.origin !== origin) {
        throw new Error('OpenRouter catalog pagination changed origin');
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetcher(next, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          redirect: 'error',
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error(`OpenRouter catalog returned ${response.status}`);
      }
      const body = (await response.json()) as CatalogPage;
      if (!Array.isArray(body.data)) {
        throw new Error('OpenRouter catalog response is invalid');
      }
      for (const model of body.data) {
        if (typeof model.id !== 'string' || !Array.isArray(model.reasoning_effort)) {
          continue;
        }
        const values = model.reasoning_effort.filter(
          (value): value is string => typeof value === 'string' && effortValues.has(value),
        );
        if (values.length > 0) {
          entries.set(model.id, {
            values,
            required: model.reasoning_required === true,
          });
        }
      }
      if (typeof body.next_page !== 'string' || body.next_page.length === 0) {
        next = undefined;
      } else {
        const candidate = new URL(body.next_page, next);
        if (candidate.origin !== origin) {
          throw new Error('OpenRouter catalog pagination changed origin');
        }
        next = candidate;
      }
    }
    return entries;
  }

  return {
    async get(input: OpenRouterCatalogRequest): Promise<ReasoningCatalogCapability | undefined> {
      let origin: string;
      try {
        origin = parseCatalogUrl(input.endpoint).origin;
      } catch {
        return undefined;
      }
      const credentialId = createHash('sha256').update(input.apiKey).digest('hex');
      const cacheKey = `${origin}:${input.endpoint}:${credentialId}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > now() && cached.entries == null) {
        return undefined;
      }
      let entries = cached && cached.expiresAt > now() ? cached.entries : undefined;
      if (!entries) {
        try {
          entries = await loadCatalog(input);
          cache.set(cacheKey, { expiresAt: now() + successTtlMs, entries });
        } catch {
          cache.set(cacheKey, { expiresAt: now() + failureTtlMs });
          return undefined;
        }
      }
      return entries.get(input.model);
    },
  };
}

export function validateReasoningOverride(
  input: ReasoningOverrideValidationInput,
): ReasoningOverrideValidation {
  const parsedOverride = reasoningOverrideSchema.safeParse(input.override);
  if (!parsedOverride.success) {
    return { valid: false, error: 'invalid_shape' };
  }

  const paramsEndpoint = input.defaultParamsEndpoint ?? input.endpoint;
  const [combinedKey, endpointKey] = getSettingsKeys(paramsEndpoint, input.model);
  const target = {
    endpoint: input.endpoint,
    model: input.model,
    provider: input.provider,
    settings: paramSettings[combinedKey] ?? paramSettings[endpointKey] ?? [],
    parameterDefinitions: input.parameterDefinitions,
    reasoningFormat: input.reasoningFormat,
    dropParams: input.dropParams,
    blockedParameters: input.blockedParameters,
    catalogCapability: input.catalogCapability,
  };

  if (!isSupportedReasoningOverride(target, parsedOverride.data)) {
    return { valid: false, error: 'unsupported_value' };
  }

  return { valid: true, override: parsedOverride.data };
}
