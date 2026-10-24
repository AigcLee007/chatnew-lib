import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';
import { EModelEndpoint, ArtifactModes } from 'librechat-data-provider';
import { generateArtifactsPrompt, ARTIFACT_TOOL_PREFERENCE_NOTE } from './artifacts';

describe('generateArtifactsPrompt tool preference', () => {
  const endpoints = [
    EModelEndpoint.anthropic,
    EModelEndpoint.openAI,
    EModelEndpoint.google,
    'OpenAI',
  ];
  const modes = [ArtifactModes.DEFAULT, ArtifactModes.SHADCNUI];

  it.each(endpoints.flatMap((endpoint) => modes.map((mode) => [endpoint, mode] as const)))(
    'steers %s (%s) previewable output to artifacts instead of file tools',
    (endpoint, artifacts) => {
      const prompt = generateArtifactsPrompt({ endpoint, artifacts });

      expect(prompt).toContain(ARTIFACT_TOOL_PREFERENCE_NOTE);
      expect(prompt?.split(ARTIFACT_TOOL_PREFERENCE_NOTE)).toHaveLength(2);
    },
  );

  it('names the sandbox file tools and the explicit opt-in exception', () => {
    for (const tool of ['create_file', 'edit_file', 'read_file', 'bash_tool']) {
      expect(ARTIFACT_TOOL_PREFERENCE_NOTE).toContain(`\`${tool}\``);
    }
    expect(ARTIFACT_TOOL_PREFERENCE_NOTE).toContain('unless the user explicitly asks');
  });

  it('places the rule under usage notes, before the artifact format instructions', () => {
    const prompt = generateArtifactsPrompt({
      endpoint: EModelEndpoint.openAI,
      artifacts: ArtifactModes.DEFAULT,
    }) as string;

    const usageNotes = prompt.indexOf('# Usage notes');
    const rule = prompt.indexOf(ARTIFACT_TOOL_PREFERENCE_NOTE);
    const instructions = prompt.indexOf('## Artifact Instructions');

    expect(usageNotes).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(usageNotes);
    expect(instructions).toBeGreaterThan(rule);
  });

  it('adds nothing in custom mode', () => {
    expect(
      generateArtifactsPrompt({ endpoint: EModelEndpoint.openAI, artifacts: ArtifactModes.CUSTOM }),
    ).toBeNull();
  });
});

describe('deployment defaultPinnedTools', () => {
  it('does not pin execute_code by default', () => {
    const configPath = path.resolve(__dirname, '../../../../librechat.yaml');
    const config = load(fs.readFileSync(configPath, 'utf8')) as {
      interface?: { defaultPinnedTools?: string[] };
    };
    const pinned = config.interface?.defaultPinnedTools ?? [];

    expect(pinned).not.toContain('execute_code');
    expect(pinned).toEqual(expect.arrayContaining(['artifacts', 'file_search', 'skills']));
  });
});
