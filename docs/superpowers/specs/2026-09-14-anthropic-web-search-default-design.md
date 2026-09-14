# Anthropic web search default behavior

## Goal

Prevent Claude from invoking web search for ordinary prompts (including creative coding requests) unless the caller explicitly enables the search capability.

## Design

The Anthropic endpoint initializer must not inject `web_search: true` into every request. The existing downstream configuration logic remains the single source of truth for explicit `web_search` values supplied through model parameters, endpoint `addParams`/`defaultParams`, or tool drop parameters.

This keeps native Anthropic search available when deliberately enabled while making the default request tool-free. No changes are required for Google, OpenAI-compatible, or xAI endpoints.

## Verification

Run the focused Anthropic endpoint tests (or an equivalent typecheck/test command available in the workspace) and inspect the resulting configuration for both default and explicitly enabled search cases.
