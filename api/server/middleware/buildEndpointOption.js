const {
  handleError,
  applyModelSpecPreset,
  findModelSpecByName,
  isModelSpecEndpointMatch,
  resolveModelSpecPromptPrefixVariables,
  validateReasoningOverride,
} = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  EndpointURLs,
  EModelEndpoint,
  isAssistantsEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
  getDefaultParamsEndpoint,
} = require('librechat-data-provider');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { getEndpointsConfig } = require('~/server/services/Config');
const agents = require('~/server/services/Endpoints/agents');
const { updateFilesUsage } = require('~/models');
const { getReasoningCapability } = require('~/server/services/Endpoints/reasoning');

const buildFunction = {
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

async function buildEndpointOption(req, res, next) {
  const { endpoint, endpointType } = req.body;
  const isAgents =
    isAgentsEndpoint(endpoint) || req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);

  let endpointsConfig;
  try {
    endpointsConfig = await getEndpointsConfig(req);
  } catch (error) {
    logger.error('Error fetching endpoints config in buildEndpointOption', error);
  }

  const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

  let parsedBody;
  try {
    parsedBody = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: req.body,
      defaultParamsEndpoint,
    });
  } catch (error) {
    logger.error(`Error parsing compact conversation for endpoint ${endpoint}`, error);
    logger.debug({
      'Error parsing compact conversation': { endpoint, endpointType, conversation: req.body },
    });
    return handleError(res, { text: 'Error parsing conversation' });
  }

  const appConfig = req.config;
  let appliedModelSpecPrivateFields = new Set();
  let resolvedModelSpec;
  if (appConfig.modelSpecs?.list?.length && appConfig.modelSpecs?.enforce) {
    /** @type {{ list: TModelSpec[] }}*/
    const { list } = appConfig.modelSpecs;
    const rawSpec = req.body.spec;
    const spec = parsedBody.spec ?? (typeof rawSpec === 'string' ? rawSpec : undefined);
    const rawChatProjectId = req.body.chatProjectId;
    const parsedBodyForModelSpec =
      parsedBody.chatProjectId === undefined &&
      (typeof rawChatProjectId === 'string' || rawChatProjectId === null)
        ? { ...parsedBody, chatProjectId: rawChatProjectId }
        : parsedBody;

    if (!spec) {
      return handleError(res, { text: 'No model spec selected' });
    }

    const currentModelSpec = findModelSpecByName({ list }, spec);
    if (!currentModelSpec) {
      return handleError(res, { text: 'Invalid model spec' });
    }
    resolvedModelSpec = currentModelSpec;

    if (!isModelSpecEndpointMatch(currentModelSpec, endpoint)) {
      return handleError(res, { text: 'Model spec mismatch' });
    }

    try {
      const result = applyModelSpecPreset({
        modelSpec: currentModelSpec,
        parsedBody: parsedBodyForModelSpec,
        endpoint,
        endpointType,
        defaultParamsEndpoint,
        includePresetDefaults: true,
      });
      parsedBody = result.parsedBody;
      appliedModelSpecPrivateFields = result.appliedPrivateFields;
    } catch (error) {
      logger.error(`Error parsing model spec for endpoint ${endpoint}`, error);
      return handleError(res, { text: 'Error parsing model spec' });
    }
  } else if (parsedBody.spec && appConfig.modelSpecs?.list) {
    const modelSpec = findModelSpecByName(appConfig.modelSpecs, parsedBody.spec);
    if (modelSpec) {
      resolvedModelSpec = modelSpec;
      if (!isModelSpecEndpointMatch(modelSpec, endpoint)) {
        return handleError(res, { text: 'Model spec mismatch' });
      }

      try {
        const result = applyModelSpecPreset({
          modelSpec,
          parsedBody,
          endpoint,
          endpointType,
          defaultParamsEndpoint,
        });
        parsedBody = result.parsedBody;
        appliedModelSpecPrivateFields = result.appliedPrivateFields;
      } catch (error) {
        logger.error(`Error parsing model spec for endpoint ${endpoint}`, error);
        return handleError(res, { text: 'Error parsing model spec' });
      }
    }
  }

  if (!isAgents && appliedModelSpecPrivateFields.has('promptPrefix')) {
    parsedBody = resolveModelSpecPromptPrefixVariables(
      parsedBody,
      req.user,
      req.body.clientTimestamp,
    );
  }

  try {
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    // TODO: use object params
    req.body = req.body || {}; // Express 5: ensure req.body exists
    const endpointOption = await builder(endpoint, parsedBody, endpointType);

    if (req.body.reasoningOverride != null) {
      if (isAssistantsEndpoint(endpoint)) {
        return res.status(400).json({ error: 'unsupported_reasoning_override' });
      }

      const loadedAgent = await endpointOption.agent;
      const providerName = loadedAgent?.provider ?? endpoint;
      const model =
        loadedAgent?.model_parameters?.model ?? loadedAgent?.model ?? parsedBody.model ?? '';
      const providerConfig = endpointsConfig?.[providerName] ?? {};
      const providerType = providerConfig.type ?? providerName;
      const customParams = providerConfig.customParams ?? {};
      const catalogCapability = await getReasoningCapability({
        endpointsConfig,
        configuredEndpoints: appConfig.endpoints?.custom,
        endpoint: providerName,
        model,
      });
      const blockedParameters =
        appConfig.modelSpecs?.enforce === true && resolvedModelSpec
          ? ['reasoning_effort', 'effort', 'thinkingLevel', 'thinkingBudget'].filter(
              (key) => resolvedModelSpec.preset?.[key] != null,
            )
          : [];
      const validation = validateReasoningOverride({
        endpoint: providerType,
        model,
        provider: providerConfig.provider,
        defaultParamsEndpoint:
          customParams.defaultParamsEndpoint ??
          getDefaultParamsEndpoint(endpointsConfig, providerName),
        parameterDefinitions: customParams.paramDefinitions,
        reasoningFormat: customParams.reasoningFormat,
        dropParams: providerConfig.dropParams,
        blockedParameters,
        catalogCapability,
        override: req.body.reasoningOverride,
      });
      if (!validation.valid) {
        return res.status(400).json({ error: 'unsupported_reasoning_override' });
      }

      endpointOption.model_parameters = {
        ...(endpointOption.model_parameters ?? {}),
        [validation.override.key]: validation.override.value,
      };
    }

    req.body.endpointOption = endpointOption;

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files, undefined, {
        user: req.user.id,
        tenantId: req.user.tenantId,
      });
    }

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
