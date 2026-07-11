# OpenAI GPT-5.6 Models Design

## Goal

Add `gpt-5.6-sol` and `gpt-5.6-terra` to the application's selectable OpenAI models.

## Behavior

- `gpt-5.6-sol` appears first in the OpenAI model group.
- `gpt-5.6-terra` appears second in the OpenAI model group.
- Existing OpenAI models retain their current relative order after the two new models.
- Both models use the existing OpenAI-compatible chat completions provider and endpoint.
- The default model remains unchanged.

## Implementation

- Extend the `ModelId` union with both model IDs.
- Add both menu entries before the existing OpenAI entries in `ChatInterface`.
- Add a focused source-level test that verifies both IDs are supported and ordered first in the OpenAI group.

## Out Of Scope

- Changing API endpoints, credentials, default model, or other provider behavior.
- Refactoring the model list into a new configuration abstraction.
