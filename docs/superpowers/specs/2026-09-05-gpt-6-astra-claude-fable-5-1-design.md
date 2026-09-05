# GPT-6 Astra and Claude Fable 5.1 Model Design

## Goal

Expose the exact model IDs `gpt-6-astra` and `claude-fable-5-1` in the existing
LibreChat deployment and model selector without changing the current Gemini 3.8
Flash default or introducing new provider endpoints.

## Existing routing

- `gpt-6-astra` uses the configured custom endpoint named `OpenAI` in
  `librechat.yaml`, with base URL `https://api.aittco.com/v1`. This is the
  OpenAI-compatible endpoint and uses the provider's normal chat-completions
  request path.
- `claude-fable-5-1` uses the native Anthropic endpoint with
  `ANTHROPIC_REVERSE_PROXY=https://api.aittco.com`. The Anthropic client sends
  Messages API requests to `/v1/messages`.
- Both endpoints continue to use user-provided credentials. No shared API key,
  new reverse proxy, Bedrock profile, Vertex configuration, or endpoint name is
  added.

## Design

1. Add `gpt-6-astra` to the configured custom OpenAI model list in
   `librechat.yaml`.
2. Add `claude-fable-5-1` to `ANTHROPIC_MODELS` in `.env.aittco.example` and to
   the shared Anthropic defaults in `packages/data-provider/src/config.ts`.
3. Add `gpt-6-astra` to the shared OpenAI defaults and
   `claude-fable-5-1` to the shared Anthropic defaults so fallback model
   discovery and agent provider configuration stay consistent with the curated
   deployment.
4. Add human-readable catalog records in
   `client/src/components/Chat/Menus/Endpoints/catalog.ts`:
   `GPT-6 Astra` in the `OPENAI` group and `Claude Fable 5.1` in the
   `ANTHROPIC` group, with concise Chinese descriptions matching the existing
   catalog style.
5. Do not invent GPT-6 Astra context or output limits. Its requests retain the
   existing generic OpenAI token behavior until the gateway publishes verified
   limits. `claude-fable-5-1` intentionally inherits the existing
   `claude-fable-5` token-map match for the current 1M context/128K output
   handling.
6. Keep the `gemini-3-8-flash-default` soft-default model spec unchanged.

## Alternatives considered

- **Recommended: use the existing provider-specific endpoints.** This is the
  smallest change and preserves native Anthropic handling, current key storage,
  and provider-specific request transforms.
- Route both models through the OpenAI-compatible gateway. This would require
  the gateway to translate Anthropic Messages requests and would lose the
  native Anthropic path, so it is not selected.
- Create separate custom endpoints for each model. This duplicates endpoint
  configuration and key management without adding capability, so it is not
  selected.

## Validation

- Add focused catalog tests asserting both display labels, groups, descriptions,
  and unchanged model IDs.
- Add focused default-model tests asserting the exact IDs are present in the
  shared OpenAI and Anthropic fallback lists.
- Add token regression coverage for Claude Fable 5.1's inherited Fable 5
  matching and explicitly verify that adding GPT-6 Astra does not claim an
  unverified hardcoded limit.
- Parse/check the YAML and dotenv example values, then run the focused client,
  data-provider, and API test suites relevant to the changed files.
