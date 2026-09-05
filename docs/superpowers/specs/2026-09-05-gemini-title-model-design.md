# Gemini 3.8 Flash Title Model Design

## Goal

Use the new-user default model `gemini-3.8-flash` for automatic conversation titles.

## Design

The configured custom OpenAI endpoint keeps automatic title generation enabled, but
routes title requests to the existing native Google endpoint. Its title settings are:

```yaml
titleConvo: true
titleModel: gemini-3.8-flash
titleEndpoint: google
```

The main conversation model remains controlled by the user's selected model. This
change only affects the background title request for new conversations. The existing
Google model allowlist already contains `gemini-3.8-flash`.

## Validation

Add a focused configuration regression test that loads `librechat.yaml` and asserts the
OpenAI custom endpoint has the exact title model and Google title endpoint. Parse the
YAML after the change and run the focused test suite.
