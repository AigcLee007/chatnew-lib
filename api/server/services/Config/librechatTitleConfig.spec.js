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
});
