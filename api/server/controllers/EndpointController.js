const { getEndpointsConfig } = require('~/server/services/Config');
const { getReasoningCapability } = require('~/server/services/Endpoints/reasoning');

async function endpointController(req, res) {
  const endpointsConfig = await getEndpointsConfig(req);
  res.send(JSON.stringify(endpointsConfig));
}

module.exports = endpointController;
module.exports.getReasoningCapability = async function reasoningCapabilityController(req, res) {
  const endpointsConfig = await getEndpointsConfig(req);
  const capability = await getReasoningCapability({
    endpointsConfig,
    configuredEndpoints: req.config?.endpoints?.custom,
    endpoint: req.query.endpoint,
    model: req.query.model,
  });
  res.send(capability ?? null);
};
