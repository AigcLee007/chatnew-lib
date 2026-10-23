import { Tools } from 'librechat-data-provider';
import { BashExecutionToolDefinition, ReadFileToolDefinition } from '@librechat/agents';
import type { ToolCallRequest } from '@librechat/agents';
import { CREATE_FILE_TOOL_NAME, EDIT_FILE_TOOL_NAME } from './tools';

/**
 * Upstream gateways (notably Claude Code wrappers behind an Anthropic-compatible
 * relay) can return `tool_use` blocks in Claude's own namespace even though the
 * request advertised LibreChat's runtime names. Those names are never registered
 * here, so the tool map lookup fails and the SDK reports
 * `Tool "Write" not found.` — which the model cannot recover from, because it
 * never learns the runtime spelling.
 *
 * Resolving at EXECUTION time keeps the schemas advertised to the model
 * unchanged while making the two namespaces interchangeable. Arg fields are
 * translated alongside the name: Claude's file tools take `file_path` /
 * `old_string` / `new_string`, the runtime takes `path` / `old_text` / `new_text`.
 * `bash_tool` and `web_search` already share Claude's `command` / `query`.
 */

interface ClaudeToolAlias {
  claudeName: string;
  runtimeName: string;
  /** Renames Claude argument fields onto their runtime equivalents. */
  toRuntimeInput?: (args: Record<string, unknown>) => Record<string, unknown>;
}

const FILE_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  file_path: 'path',
  old_string: 'old_text',
  new_string: 'new_text',
});

function renameFields(
  input: Record<string, unknown>,
  fields: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[fields[key] ?? key] = value;
  }
  return output;
}

function toRuntimeFileInput(args: Record<string, unknown>): Record<string, unknown> {
  const renamed = renameFields(args, FILE_FIELDS);
  if (Array.isArray(renamed.edits)) {
    renamed.edits = renamed.edits.map((edit) =>
      edit != null && typeof edit === 'object' && !Array.isArray(edit)
        ? renameFields(edit as Record<string, unknown>, FILE_FIELDS)
        : edit,
    );
  }
  return renamed;
}

export const CLAUDE_TOOL_ALIASES: readonly ClaudeToolAlias[] = Object.freeze([
  { claudeName: 'Write', runtimeName: CREATE_FILE_TOOL_NAME, toRuntimeInput: toRuntimeFileInput },
  {
    claudeName: 'Read',
    runtimeName: ReadFileToolDefinition.name,
    toRuntimeInput: toRuntimeFileInput,
  },
  { claudeName: 'Edit', runtimeName: EDIT_FILE_TOOL_NAME, toRuntimeInput: toRuntimeFileInput },
  { claudeName: 'Bash', runtimeName: BashExecutionToolDefinition.name },
  { claudeName: 'WebSearch', runtimeName: Tools.web_search },
]);

const ALIAS_BY_CLAUDE: ReadonlyMap<string, ClaudeToolAlias> = new Map(
  CLAUDE_TOOL_ALIASES.map((alias) => [alias.claudeName, alias]),
);

/** Claude spellings that must never be registered as tool names themselves. */
export const CLAUDE_ALIAS_TOOL_NAMES: readonly string[] = CLAUDE_TOOL_ALIASES.map(
  (alias) => alias.claudeName,
);

export function isClaudeAliasToolName(name: string): boolean {
  return ALIAS_BY_CLAUDE.has(name);
}

/**
 * Runtime tool a Claude-spelled call resolves to, or `undefined` when the name
 * is already a runtime tool. `loadTools` loads by exact name, so the executor
 * has to request the runtime names up front — resolving only after the load
 * would find nothing to bind.
 */
export function getClaudeAliasRuntimeName(name: string): string | undefined {
  return ALIAS_BY_CLAUDE.get(name)?.runtimeName;
}

/**
 * Resolves a tool call emitted in Claude's namespace onto the runtime tool of
 * the same intent.
 *
 * A call is rewritten only when the runtime tool is actually available; without
 * that guard an alias would mask a genuine "not enabled for this agent" case by
 * renaming the call before the lookup can report it. Everything else (id, step,
 * turn, session context) is preserved so completion events keep matching.
 */
export function resolveToolCallAlias(
  call: ToolCallRequest,
  availableToolNames: ReadonlySet<string>,
): ToolCallRequest {
  const alias = ALIAS_BY_CLAUDE.get(call.name);
  if (alias == null || !availableToolNames.has(alias.runtimeName)) {
    return call;
  }
  const args = alias.toRuntimeInput != null ? alias.toRuntimeInput(call.args ?? {}) : call.args;
  return { ...call, name: alias.runtimeName, args };
}

/**
 * Applies {@link resolveToolCallAlias} across a batch, returning the same array
 * when nothing changed so callers can skip downstream work on the common path.
 */
export function resolveToolCallAliases(
  calls: readonly ToolCallRequest[],
  availableToolNames: ReadonlySet<string>,
): ToolCallRequest[] {
  const resolved = calls.map((call) => resolveToolCallAlias(call, availableToolNames));
  return resolved.some((call, index) => call !== calls[index]) ? resolved : [...calls];
}
