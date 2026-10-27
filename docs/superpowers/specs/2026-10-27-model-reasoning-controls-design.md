# Model-Aware Reasoning Controls Design

## Goal

Add model-aware reasoning controls to the chat composer and make the existing
parameter settings honor the active model's supported reasoning parameters.
Support the provider families for which upstream LibreChat resolves reasoning
capabilities: Google, Anthropic, OpenAI, Azure OpenAI, Bedrock, OpenRouter, and
custom endpoints whose provider or parameter definitions declare support.
Saved Agents use the provider and model resolved from the selected Agent.

The control applies to the next submitted message only. Existing model and
conversation parameter settings remain available in their current settings
surfaces and continue to define defaults for later messages.

## Provider Capability Resolution

Use one shared resolver to determine the reasoning setting for a target from its
endpoint, model, model parameter definitions, endpoint reasoning format, model
spec restrictions, and provider-reported capabilities where applicable. The
resolver returns a single supported setting definition, including its accepted
values or numeric range, or no setting when reasoning control is unavailable.

- Google models expose `thinkingBudget` or `thinkingLevel` according to the
  specific model family and supported API contract.
- Anthropic and Bedrock Anthropic models expose adaptive `effort` or a supported
  manual thinking budget according to the model family.
- OpenAI models expose `reasoning_effort` only for reasoning-capable model
  families. Azure OpenAI deployment names are opaque, so this control requires
  an explicit resolved parameter definition.
- Bedrock models whose provider contract supports reasoning effort, including
  Moonshot and Z.AI, expose the matching effort setting.
- OpenRouter exposes `reasoning_effort` from the selected model's capabilities
  fetched from its configured model catalog. Unsupported or mandatory reasoning
  levels are removed from the available choices.
- Custom endpoints use explicit reasoning parameter definitions, an explicit
  reasoning format, or a recognized provider identity. Endpoint declarations
  and `dropParams` remain authoritative; a parameter removed before dispatch is
  never advertised.

The resolver must not infer support for an opaque custom model name. An endpoint
configured with `reasoningFormat: disabled`, or a model spec that blocks the
resolved setting, has no composer control. Unsupported reasoning fields are
also hidden or disabled in the existing advanced parameter surfaces for that
model; unrelated sampling and generation parameters remain unchanged.

## User Interaction

Add a compact reasoning control beside the chat composer actions. It appears
only after endpoint configuration and model resolution establish support. Enum
settings use the setting's localized choices; numeric thinking budgets use the
configured bounds and an auto option when supported.

All new visible labels, descriptions, loading states, and validation errors use
the existing localization system. The control remains keyboard accessible and
fits the narrow composer layout without obscuring file, audio, or send actions.

The selected value is a one-message override. It is bound to the current
conversation pane and target model, included in the submitted message payload,
and consumed by that submission. Switching provider, model, Agent, or pane
clears an override that no longer belongs to the active target. A failed or
resumed submission keeps its original submitted value; the next new message
starts from the conversation's configured default.

When model capabilities are loading, the composer does not offer generic values
that may be rejected by the provider. A transient capability lookup failure
hides the control for that request. Existing conversation settings are not
rewritten by capability discovery.

## Request and Validation Flow

The client resolves the active endpoint and model, renders the corresponding
control, and attaches a typed reasoning override to the next message. Shared
request schemas validate its shape. Before provider dispatch, the server resolves
the same setting from trusted endpoint, Agent, model spec, and provider
capability data, then verifies that the override key and value are supported.
Invalid or unsupported overrides receive a stable client error and are not
forwarded to the provider.

OpenRouter capability lookup runs server-side against the configured endpoint,
uses its configured credentials, enforces same-origin pagination and bounded
timeouts/page counts, and caches successful and failed reads with separate TTLs.
It must not forward user-scoped headers, expose credentials to the client, or
allow a catalog-provided next-page URL to redirect requests to another host.
If a model is absent from the provider catalog, no capability is inferred from
its name. A configured administrator parameter definition remains authoritative.

Provider adapters retain their native parameter formats. The override changes
only the selected reasoning field and does not alter conversation history,
sampling defaults, endpoint selection, model IDs, or billing behavior.

## Error Handling and Compatibility

- No model, unsupported model, disabled reasoning format, or model-spec lock:
  omit the composer control and reject any forged override server-side.
- OpenRouter catalog timeout, invalid response, or authentication failure:
  hide the control, preserve normal chat behavior, and do not send an unverified
  effort value.
- Invalid override key or value: return a stable validation error without
  forwarding the request.
- Existing conversations without a one-message override continue to use their
  saved settings and provider defaults.
- Assistants API is outside this feature because its provider-managed thread
  request path does not use this reasoning override contract.

## Testing and Acceptance

- Unit tests cover provider/model resolution, supported setting values, model
  family boundaries, explicit custom definitions, `dropParams`, disabled
  formats, and model-spec restrictions.
- UI tests cover supported and unsupported models, enum and numeric controls,
  target changes, pane isolation, submission consumption, localization keys,
  keyboard access, and retained settings during capability loading or failure.
- Request and server tests cover valid overrides, forged keys/values, unsupported
  targets, Agent resolution, and provider-native serialization.
- OpenRouter tests cover pagination, timeout and failure caching, per-model
  effort filtering, mandatory reasoning, omitted metadata, and same-origin
  enforcement.
- Parameter settings tests confirm unsupported reasoning fields are filtered
  without changing unrelated parameter visibility or saved values.
- AITTCO deployment smoke tests verify the configured Google and Anthropic
  model IDs against the real gateway before production enablement. These live
  calls are not part of default CI.

## Scope Boundaries

- Do not add or remove model IDs, change model defaults, pricing, quota behavior,
  or enable currently disabled endpoints.
- Do not add provider-specific reasoning controls when the upstream contract or
  administrator configuration does not establish support.
- Do not change existing provider protocols or apply a one-message override to
  unrelated saved conversation settings.
- Port the required capability resolution and validation behavior into this
  repository's current module boundaries; do not merge unrelated upstream
  refactors.
