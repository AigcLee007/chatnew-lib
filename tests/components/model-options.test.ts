import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('OpenAI model options', () => {
  it('defines GPT-5.6 Sol and Terra as supported model IDs', () => {
    const modelTypes = readSource('types.ts');

    expect(modelTypes).toContain("| 'gpt-5.6-sol'");
    expect(modelTypes).toContain("| 'gpt-5.6-terra'");
  });

  it('orders Sol and Terra as the first two OpenAI menu models', () => {
    const chatInterface = readSource('components/ChatInterface.tsx');
    const solIndex = chatInterface.indexOf("id: 'gpt-5.6-sol'");
    const terraIndex = chatInterface.indexOf("id: 'gpt-5.6-terra'");
    const existingOpenAIIndex = chatInterface.indexOf("id: 'gpt-5.5'");

    expect(solIndex).toBeGreaterThan(-1);
    expect(terraIndex).toBeGreaterThan(solIndex);
    expect(existingOpenAIIndex).toBeGreaterThan(terraIndex);
  });

  it('shows the configured GPT model descriptions', () => {
    const chatInterface = readSource('components/ChatInterface.tsx');

    expect(chatInterface).toContain(
      'GPT-5.6 Sol：最新旗舰级推理与编码模型，适合复杂问题分析、代码生成、系统架构设计和高难度任务处理。'
    );
    expect(chatInterface).toContain(
      'GPT-5.6 Terra：智能与成本更均衡的模型，适合大多数生产环境应用、内容生成、文档处理和业务分析。'
    );
    expect(chatInterface).toContain(
      'GPT-5.5：OpenAI 上一代旗舰模型，适合高难度推理、复杂分析、长文写作与代码任务。'
    );
  });
});

describe('Gemini and Anthropic model options', () => {
  it('replaces Gemini 3.1 Flash with Gemini 3.5 Flash across active model configuration', () => {
    const modelTypes = readSource('types.ts');
    const chatInterface = readSource('components/ChatInterface.tsx');
    const settings = readSource('store/slices/createSettingsSlice.ts');
    const settingsModal = readSource('components/SettingsModal.tsx');
    const provider = readSource('lib/llm/providers/GeminiNativeProvider.ts');

    expect(modelTypes).toContain("| 'gemini-3.5-flash-preview'");
    expect(modelTypes).not.toContain("| 'gemini-3.1-flash-preview'");
    expect(chatInterface).toContain("id: 'gemini-3.5-flash-preview'");
    expect(settings).toContain("storedModel === 'gemini-3.1-flash-preview'");
    expect(settings).toContain("'gemini-3.5-flash-preview'");
    expect(settingsModal).toContain(": importedModel || 'gemini-3.5-flash-preview';");
    expect(provider).toContain("'gemini-3.5-flash-preview'");
    expect(provider).not.toContain('gemini-3.1-flash-lite-preview');
  });

  it('orders Anthropic models as Opus 5, Sonnet 5, Opus 4.8, then Opus 4.7', () => {
    const modelTypes = readSource('types.ts');
    const chatInterface = readSource('components/ChatInterface.tsx');

    expect(modelTypes).toContain("| 'claude-opus-5'");
    expect(modelTypes).toContain("| 'claude-sonnet-5'");
    expect(modelTypes).not.toContain("| 'claude-opus-4-6'");

    const ids = [
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
    ];
    const positions = ids.map((id) => chatInterface.indexOf(`id: '${id}'`));

    positions.forEach((position) => expect(position).toBeGreaterThan(-1));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(chatInterface).not.toContain("id: 'claude-opus-4-6'");
  });
});

describe('Grok model options', () => {
  it('shows Grok 4.6 then Grok 4.5 in the dedicated Grok group', () => {
    const modelTypes = readSource('types.ts');
    const chatInterface = readSource('components/ChatInterface.tsx');

    expect(modelTypes).toContain("| 'grok-4.6'");
    expect(modelTypes).toContain("| 'grok-4.5'");
    expect(chatInterface).toContain("type ModelProvider = 'GEMINI' | 'OPENAI' | 'GROK' | 'ANTHROPIC'");

    const grok46Index = chatInterface.indexOf("id: 'grok-4.6'");
    const grok45Index = chatInterface.indexOf("id: 'grok-4.5'");
    expect(grok46Index).toBeGreaterThan(-1);
    expect(grok45Index).toBeGreaterThan(grok46Index);
    expect(chatInterface).toContain("['GEMINI', 'OPENAI', 'GROK', 'ANTHROPIC'] as const");
  });

  it('uses the Grok brand asset instead of a generic icon', () => {
    const chatInterface = readSource('components/ChatInterface.tsx');
    const messageBubble = readSource('components/MessageBubble.tsx');

    expect(chatInterface).toContain('GrokLogo');
    expect(messageBubble).toContain('GrokLogo');
    expect(readSource('components/GrokLogo.tsx')).toContain('<svg');
  });
});
