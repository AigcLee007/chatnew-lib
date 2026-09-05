const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('configured title model routing', () => {
  it('routes custom OpenAI titles through Gemini 3.8 Flash on Google', () => {
    const configPath = path.resolve(__dirname, '../../../../librechat.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const endpoint = config.endpoints.custom.find(({ name }) => name === 'OpenAI');

    expect(endpoint).toMatchObject({
      titleConvo: true,
      titleModel: 'gemini-3.8-flash',
      titleEndpoint: 'google',
    });
  });

  it('configures all new conversation titles to use simplified Chinese', () => {
    const configPath = path.resolve(__dirname, '../../../../librechat.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const titleConfig = config.endpoints.all;

    expect(titleConfig).toMatchObject({
      titleConvo: true,
      titleModel: 'gemini-3.8-flash',
      titleEndpoint: 'google',
      titleMethod: 'completion',
    });
    expect(titleConfig.titlePrompt).toContain('简体中文');
    expect(titleConfig.titlePrompt).toContain('只输出标题');
    expect(titleConfig.titlePrompt).toContain('{convo}');
  });
});
