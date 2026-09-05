# Chinese Conversation Titles Design

## Goal

Generate simplified-Chinese titles for all new conversations, regardless of the
selected chat model or the language of the first user message.

## Root Cause

The title generator's default prompt detects the conversation language and asks the
model to title the conversation in that language. English first messages therefore
produce English titles. Existing conversation titles are persisted data and are not
regenerated when configuration changes.

## Design

Use the existing global `endpoints.all` title configuration so every endpoint follows
one title route:

```yaml
titleConvo: true
titleModel: gemini-3.8-flash
titleEndpoint: google
titleMethod: completion
```

The custom prompt explicitly requires a concise simplified-Chinese title, title-only
output, no punctuation or explanation, and preserves product names, model names, and
code identifiers when needed. The title request is routed through the existing Google
endpoint and does not change the model used for the main conversation.

## Scope and Behavior

- Applies to newly generated titles for all configured endpoints.
- Existing titles remain unchanged.
- Proper nouns, model names, and code identifiers may remain in their original form.
- No additional translation request is introduced.

## Validation

Add a focused regression test that loads the repository's real `librechat.yaml` and
asserts the global title route and Chinese prompt. Run the title service, AgentClient
title-routing, application configuration, and YAML parsing checks.
