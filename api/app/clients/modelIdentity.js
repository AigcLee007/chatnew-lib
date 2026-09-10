const KNOWN_MODEL_DISPLAY_NAMES = {
  'gpt-6-astra': 'GPT-6 Astra',
  'grok-4.6': 'Grok 4.6',
};

const IDENTITY_QUESTIONS = new Set([
  '你是什么模型',
  '你是哪个模型',
  '你是谁',
  '当前模型是什么',
  '请介绍你的模型身份',
  'what model are you',
  'which model are you',
  'what are you',
  'who are you',
  'what ai are you',
  'what llm are you',
]);

function normalizeQuestion(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[?？。！!]+$/u, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isModelIdentityQuestion(message) {
  return IDENTITY_QUESTIONS.has(normalizeQuestion(message));
}

function normalizeProviderName(value) {
  const provider = String(value ?? '').trim();
  const key = provider.toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'openai' || key === 'azureopenai') return 'OpenAI';
  if (key === 'anthropic') return 'Anthropic';
  if (key === 'google' || key === 'vertex' || key === 'vertexai') return 'Google';
  if (key === 'xai') return 'xAI';
  return provider;
}

function resolveModelIdentity({ model, modelLabel, endpoint, provider, modelDisplayLabel } = {}) {
  const modelId = typeof model === 'string' ? model.trim() : '';
  if (!modelId) return null;

  const providerSource = modelDisplayLabel || endpoint || provider;
  const normalizedProvider = normalizeProviderName(providerSource);
  if (!normalizedProvider || ['agents', 'custom'].includes(normalizedProvider.toLowerCase())) {
    return null;
  }

  return {
    provider: normalizedProvider,
    model:
      (typeof modelLabel === 'string' && modelLabel.trim()) ||
      KNOWN_MODEL_DISPLAY_NAMES[modelId] ||
      modelId,
  };
}

function getModelIdentityResponse({ message, ...identityOptions } = {}) {
  if (!isModelIdentityQuestion(message)) return null;
  const identity = resolveModelIdentity(identityOptions);
  if (!identity) return null;
  return {
    ...identity,
    text: `我是由 ${identity.provider} 训练的大型语言模型 \`${identity.model}\`。有什么我可以帮您的吗？`,
  };
}

module.exports = {
  getModelIdentityResponse,
  isModelIdentityQuestion,
  normalizeProviderName,
  resolveModelIdentity,
};
