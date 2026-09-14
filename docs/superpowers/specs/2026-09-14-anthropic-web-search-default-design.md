# Anthropic web search default behavior

## Goal

Keep Claude's native web search default consistent with the other first-party model
endpoints. Users should not need a model-parameter button to access search; an
explicit `web_search: false` remains available for callers that want to disable it.

## Design

The Anthropic endpoint initializer injects `web_search: true` unless the request
contains an explicit value. The downstream configuration logic remains the single
source of truth for explicit `web_search` values supplied through model parameters,
endpoint `addParams`/`defaultParams`, or tool drop parameters.

This keeps native Anthropic search available by default, while preserving an
explicit opt-out. No changes are required for Google, OpenAI-compatible, or xAI
endpoints.

## Verification

Run the focused Anthropic endpoint tests (or an equivalent typecheck/test command available in the workspace) and inspect the resulting configuration for both default and explicitly enabled search cases.
