const { createOpenRouterReasoningCatalog, resolveConfigSecret } = require('@librechat/api');
const { Providers } = require('librechat-data-provider');

const catalog = createOpenRouterReasoningCatalog();

async function getReasoningCapability({ endpointsConfig, configuredEndpoints, endpoint, model }) {
  if (typeof endpoint !== 'string' || typeof model !== 'string' || model.length === 0) {
    return undefined;
  }
  const config = endpointsConfig?.[endpoint];
  if (
    !config ||
    (config.customParams?.defaultParamsEndpoint?.toLowerCase() !== Providers.OPENROUTER &&
      endpoint.toLowerCase() !== Providers.OPENROUTER)
  ) {
    return undefined;
  }
  const configured = Array.isArray(configuredEndpoints)
    ? configuredEndpoints.find((item) => item.name === endpoint)
    : undefined;
  const baseURL = resolveConfigSecret(configured?.baseURL);
  const apiKey = resolveConfigSecret(configured?.apiKey);
  if (typeof baseURL !== 'string' || typeof apiKey !== 'string' || apiKey.length === 0) {
    return undefined;
  }
  return catalog.get({ endpoint: baseURL, apiKey, model });
}

module.exports = { getReasoningCapability };
