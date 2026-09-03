# Gemini 3.8 Flash Default Model Design

## Goal

Expose `gemini-3.8-flash` in the curated Gemini chat-model menu and use it as the soft default for newly created user selections.

## Design

The Gemini native endpoint remains routed through the existing AITTCO reverse proxy and continues to use user-provided API keys. Add `gemini-3.8-flash` to `GOOGLE_MODELS` so the server exposes it. Update the single `modelSpecs` soft-default preset to the same model. Existing users retain their saved model selection because the setting is a soft default.

Add the model to the client catalog with the existing Gemini Flash display description so the menu renders a readable label. A focused catalog unit test will assert the label and original model ID.

## Validation

Run the focused client catalog test and parse the YAML configuration. Check the environment allowlist and default preset for the exact `gemini-3.8-flash` identifier.
