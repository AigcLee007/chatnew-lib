const {
  getModelIdentityResponse,
  isModelIdentityQuestion,
  resolveModelIdentity,
} = require('./modelIdentity');

describe('model identity questions', () => {
  test.each(['你是什么模型', '你是哪个模型？', '你是谁。', '当前模型是什么', '请介绍你的模型身份'])(
    '%s is recognized',
    (message) => {
      expect(isModelIdentityQuestion(message)).toBe(true);
    },
  );

  test.each(['what model are you?', 'Which model are you', 'who are you?', 'what AI are you'])(
    '%s is recognized',
    (message) => {
      expect(isModelIdentityQuestion(message)).toBe(true);
    },
  );

  test.each([
    '你是谁吗，能做什么？',
    '你是什么模型，可以做什么',
    'who are you and what can you do?',
  ])('%s is recognized as a combined identity question', (message) => {
    expect(isModelIdentityQuestion(message)).toBe(true);
  });

  test.each([
    '这个模型有什么能力',
    '请比较 GPT-6 Astra 和 Claude',
    '用 GPT 写一段代码',
    '普通消息里提到 what model are you but does not ask it',
    'what can you do',
  ])('%s is not recognized', (message) => {
    expect(isModelIdentityQuestion(message)).toBe(false);
  });
});

describe('model identity response', () => {
  test('uses OpenAI and the display name for gpt-6-astra', () => {
    expect(
      getModelIdentityResponse({
        message: '你是什么模型',
        model: 'gpt-6-astra',
        endpoint: 'OpenAI',
        modelDisplayLabel: 'OpenAI',
      }),
    ).toEqual({
      provider: 'OpenAI',
      model: 'GPT-6 Astra',
      text: '我是由 OpenAI 训练的大型语言模型 `GPT-6 Astra`。有什么我可以帮您的吗？',
    });
  });

  test('uses Anthropic and preserves the configured claude model id', () => {
    expect(
      getModelIdentityResponse({
        message: 'which model are you?',
        model: 'claude-fable-5-1',
        endpoint: 'anthropic',
      }),
    ).toEqual({
      provider: 'Anthropic',
      model: 'claude-fable-5-1',
      text: '我是由 Anthropic 训练的大型语言模型 `claude-fable-5-1`。有什么我可以帮您的吗？',
    });
  });

  test('uses xAI and a readable known name for grok-4.6', () => {
    expect(
      getModelIdentityResponse({
        message: '你是什么模型？',
        model: 'grok-4.6',
        endpoint: 'xAI',
      }),
    ).toEqual({
      provider: 'xAI',
      model: 'Grok 4.6',
      text: '我是由 xAI 训练的大型语言模型 `Grok 4.6`。有什么我可以帮您的吗？',
    });
  });

  test('answers identity and capabilities for a combined question', () => {
    expect(
      getModelIdentityResponse({
        message: '你是谁吗，能做什么？',
        model: 'gpt-6-astra',
        endpoint: 'OpenAI',
      }),
    ).toEqual({
      provider: 'OpenAI',
      model: 'GPT-6 Astra',
      text: '我是由 OpenAI 训练的大型语言模型 `GPT-6 Astra`。我可以帮助您回答问题、分析和总结内容、编写和调试代码、翻译文本，以及生成各种内容。有什么我可以帮您的吗？',
    });
  });

  test('uses an unknown custom endpoint label without guessing its vendor', () => {
    expect(resolveModelIdentity({ model: 'custom-model', endpoint: 'My Gateway' })).toEqual({
      provider: 'My Gateway',
      model: 'custom-model',
    });
  });

  test('returns null when model or provider cannot be resolved', () => {
    expect(getModelIdentityResponse({ message: '你是谁', model: 'custom-model' })).toBeNull();
    expect(getModelIdentityResponse({ message: '你是谁', endpoint: 'OpenAI' })).toBeNull();
  });
});
