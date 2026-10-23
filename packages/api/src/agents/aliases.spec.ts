import { Tools } from 'librechat-data-provider';
import { BashExecutionToolDefinition, ReadFileToolDefinition } from '@librechat/agents';
import type { ToolCallRequest } from '@librechat/agents';
import {
  CLAUDE_ALIAS_TOOL_NAMES,
  getClaudeAliasRuntimeName,
  isClaudeAliasToolName,
  resolveToolCallAlias,
  resolveToolCallAliases,
} from './aliases';
import { CREATE_FILE_TOOL_NAME, EDIT_FILE_TOOL_NAME } from './tools';

const call = (name: string, args: Record<string, unknown> = {}): ToolCallRequest => ({
  id: `call_${name}`,
  name,
  args,
});

const available = (...names: string[]): Set<string> => new Set(names);

describe('Claude tool aliases', () => {
  it('maps every Claude spelling onto its runtime tool', () => {
    expect(getClaudeAliasRuntimeName('Write')).toBe(CREATE_FILE_TOOL_NAME);
    expect(getClaudeAliasRuntimeName('Read')).toBe(ReadFileToolDefinition.name);
    expect(getClaudeAliasRuntimeName('Edit')).toBe(EDIT_FILE_TOOL_NAME);
    expect(getClaudeAliasRuntimeName('Bash')).toBe(BashExecutionToolDefinition.name);
    expect(getClaudeAliasRuntimeName('WebSearch')).toBe(Tools.web_search);
  });

  it('leaves runtime names alone', () => {
    expect(getClaudeAliasRuntimeName(CREATE_FILE_TOOL_NAME)).toBeUndefined();
    expect(isClaudeAliasToolName('create_file')).toBe(false);
  });

  it('exposes the alias names for eager-execution exclusion', () => {
    expect(CLAUDE_ALIAS_TOOL_NAMES).toEqual(
      expect.arrayContaining(['Write', 'Read', 'Edit', 'Bash']),
    );
  });
});

describe('resolveToolCallAlias', () => {
  it('renames a Write call and translates file_path onto path', () => {
    const resolved = resolveToolCallAlias(
      call('Write', { file_path: '/tmp/a.html', content: '<h1/>' }),
      available(CREATE_FILE_TOOL_NAME),
    );

    expect(resolved.name).toBe(CREATE_FILE_TOOL_NAME);
    expect(resolved.args).toEqual({ path: '/tmp/a.html', content: '<h1/>' });
    expect(resolved.id).toBe('call_Write');
  });

  it('translates Edit string fields and the edits array', () => {
    const resolved = resolveToolCallAlias(
      call('Edit', {
        file_path: '/tmp/a.txt',
        old_string: 'a',
        new_string: 'b',
        edits: [{ old_string: 'c', new_string: 'd' }],
      }),
      available(EDIT_FILE_TOOL_NAME),
    );

    expect(resolved.args).toEqual({
      path: '/tmp/a.txt',
      old_text: 'a',
      new_text: 'b',
      edits: [{ old_text: 'c', new_text: 'd' }],
    });
  });

  it('renames Bash without touching its shared command field', () => {
    const resolved = resolveToolCallAlias(
      call('Bash', { command: 'ls -la' }),
      available(BashExecutionToolDefinition.name),
    );

    expect(resolved.name).toBe(BashExecutionToolDefinition.name);
    expect(resolved.args).toEqual({ command: 'ls -la' });
  });

  it('keeps the original name when the runtime tool did not load', () => {
    const original = call('Write', { file_path: '/tmp/a.html', content: '' });
    expect(resolveToolCallAlias(original, available('web_search'))).toBe(original);
  });

  it('never rewrites a runtime call', () => {
    const original = call(CREATE_FILE_TOOL_NAME, { path: '/tmp/a.html' });
    expect(resolveToolCallAlias(original, available(CREATE_FILE_TOOL_NAME))).toBe(original);
  });
});

describe('resolveToolCallAliases', () => {
  it('returns the input array untouched when no call is aliased', () => {
    const calls = [call(CREATE_FILE_TOOL_NAME, { path: '/a' }), call('Read', { path: '/b' })];
    const resolved = resolveToolCallAliases(calls, available(CREATE_FILE_TOOL_NAME));

    expect(resolved).toEqual(calls);
  });

  it('rewrites only the aliased entries of a mixed batch', () => {
    const calls = [
      call('Write', { file_path: '/a', content: 'x' }),
      call('web_search', { query: 'q' }),
    ];
    const resolved = resolveToolCallAliases(calls, available(CREATE_FILE_TOOL_NAME, 'web_search'));

    expect(resolved[0].name).toBe(CREATE_FILE_TOOL_NAME);
    expect(resolved[1]).toBe(calls[1]);
  });
});
