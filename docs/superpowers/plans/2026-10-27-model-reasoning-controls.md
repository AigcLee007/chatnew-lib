# Model-Aware Reasoning Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a model-aware, one-message reasoning override for supported providers and validate it against trusted server-side capability data.

**Architecture:** Keep capability definitions and typed payload contracts in `packages/data-provider`. Add target resolution and request validation in `packages/api`, with the existing JavaScript API middleware remaining a thin adapter. The composer reads the active conversation target and stores an override scoped to its pane; existing conversation settings remain defaults and are filtered only when unsupported.

**Tech Stack:** TypeScript, Zod, React, Recoil, React Query, Jest, existing LibreChat UI primitives and localization.

---

## File Map

- `packages/data-provider/src/reasoning.ts`: pure provider/model capability resolver and override validation helpers.
- `packages/data-provider/src/types.ts`, `schemas.ts`, `createPayload.ts`, `index.ts`: typed message override contract and schema/export plumbing.
- `packages/data-provider/src/parameterSettings.ts`: filter unsupported reasoning definitions while preserving unrelated settings.
- `packages/data-provider/src/reasoning.spec.ts`, `parameterSettings.spec.ts`, `schemas.spec.ts`: shared behavior tests.
- `packages/api/src/endpoints/`: trusted target resolution and provider dispatch validation, with focused tests.
- `api/server/routes/endpoints.js`, `api/server/middleware/buildEndpointOption.js`: thin route/middleware integration only where required by current route structure.
- `client/src/common/types.ts`, `client/src/hooks/Chat/useChatFunctions.ts`: carry target-scoped override through submit and replay flows.
- `client/src/components/Chat/Input/`: accessible composer control, one-submit consumption, target/pane clearing.
- `client/src/components/SidePanel/Parameters/Panel.tsx`: apply the shared supported-parameter filtering.
- `client/src/locales/en/translation.json`: localized control labels and choices.

## Task 1: Shared capability resolver

**Files:**
- Create: `packages/data-provider/src/reasoning.ts`
- Create: `packages/data-provider/src/reasoning.spec.ts`
- Modify: `packages/data-provider/src/index.ts`

- [ ] Write tests for explicit parameter definitions, disabled reasoning format, dropped parameters, Google Gemini family differences, Anthropic adaptive effort, OpenAI reasoning model boundaries, Azure opaque deployments, Bedrock effort families, and spec restrictions.
- [ ] Run `cd packages/data-provider && npx jest src/reasoning.spec.ts --runInBand`; confirm failures are due to the missing resolver.
- [ ] Implement a pure resolver returning one setting definition or `undefined`, using existing `SettingDefinition`, endpoint enums, provider formats, and model-spec preset restrictions.
- [ ] Re-run the focused tests and existing `parameterSettings.spec.ts`.

## Task 2: Typed one-message payload and parameter filtering

**Files:**
- Modify: `packages/data-provider/src/types.ts`
- Modify: `packages/data-provider/src/schemas.ts`
- Modify: `packages/data-provider/src/createPayload.ts`
- Modify: `packages/data-provider/src/parameterSettings.ts`
- Modify: `packages/data-provider/src/parameterSettings.spec.ts`, `schemas.spec.ts`

- [ ] Add a strict reasoning override object `{ key, value }` to submission/payload schemas, accepting only string enum values or finite numeric values.
- [ ] Add tests proving valid shapes parse, invalid shapes fail, payload creation preserves an override, and filtering removes only unsupported reasoning fields without mutating saved values.
- [ ] Run the corresponding data-provider Jest tests and verify red before implementation.
- [ ] Implement type/schema/payload plumbing and call the shared filter from model-aware parameter preparation.
- [ ] Run tests and build `packages/data-provider`.

## Task 3: Trusted server validation and OpenRouter capabilities

**Files:**
- Create: `packages/api/src/endpoints/reasoning.ts`
- Create: `packages/api/src/endpoints/reasoning.spec.ts`
- Modify: `packages/api/src/endpoints/index.ts` or the existing endpoint dispatch owner identified during implementation.
- Modify: `api/server/routes/endpoints.js` only to expose safe capability data if required.

- [ ] Test valid overrides, unknown keys/values, unsupported targets, Agent-resolved provider/model, model-spec locks, and provider-native parameter mapping.
- [ ] Test OpenRouter catalog pagination staying on configured origin, page/time bounds, mandatory/unsupported effort filtering, missing model behavior, and independent success/failure caching.
- [ ] Run focused package API Jest tests and confirm red.
- [ ] Implement validation before provider dispatch; return a stable client error and never forward forged overrides.
- [ ] Implement server-only OpenRouter catalog retrieval using configured credentials, bounded same-origin pagination and separate success/failure TTLs; expose only sanitized capability data needed by the composer.
- [ ] Run focused tests and package API build.

## Task 4: Composer control and submission lifecycle

**Files:**
- Modify: `client/src/common/types.ts`
- Modify: `client/src/hooks/Chat/useChatFunctions.ts`
- Modify: `client/src/components/Chat/Input/ChatForm.tsx`
- Create: `client/src/components/Chat/Input/ReasoningControl.tsx`
- Create: `client/src/components/Chat/Input/__tests__/ReasoningControl.spec.tsx`
- Modify: `client/src/locales/en/translation.json`

- [ ] Test enum and numeric controls, keyboard operation, absent/loading/failed capability states, target changes, pane isolation, and single-submit consumption.
- [ ] Run the focused client tests and confirm the new behavior fails first.
- [ ] Implement a compact localized control beside composer actions; bind selection to pane plus endpoint/model/Agent/spec, include it in the submitted `TSubmission`, and consume it only after starting a new submission.
- [ ] Preserve submitted values on failed/resumed submissions; clear stale draft overrides on target changes and ensure regenerate/edited submissions carry their original value only when replaying the same message.
- [ ] Run focused client tests and typecheck/build.

## Task 5: Integration verification

**Files:**
- Modify only files required by failures found in Tasks 1-4.

- [ ] Run all data-provider, package API, and affected client tests.
- [ ] Run relevant workspace builds and lint on touched files.
- [ ] Review the full diff for endpoint coverage, localization, dropParams/spec authority, and absence of credential exposure.
- [ ] Record the real AITTCO Google/Anthropic gateway smoke-test commands and expected checks in the plan/report; do not run live generation without configured credentials.

## Spec coverage review

- Shared provider/model rules, explicit custom declarations, `dropParams`, disabled format, and model-spec restriction: Tasks 1 and 2.
- Composer visibility, localization, keyboard access, numeric/enum selection, pane and target scoping, and submission lifecycle: Task 4.
- Trusted server validation, Agent resolution, OpenRouter origin and cache safety, and provider-native serialization: Task 3.
- Existing advanced parameter visibility and saved-value preservation: Task 2.
- Assistants API exclusion, live gateway smoke test outside CI, and no model/default/billing changes: Task 5.

## Placeholder and consistency review

- No TODO/TBD placeholders are used. Each task names concrete files, observable behaviors, test commands, and implementation boundaries.
- The override uses the same `{ key, value }` shape in schemas, resolver validation, client submission, and provider dispatch.
- `TSubmission` carries the override into `createPayload`; server target resolution must ignore client-provided capability claims.
