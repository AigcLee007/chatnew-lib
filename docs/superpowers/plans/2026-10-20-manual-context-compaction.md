# Manual Context Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users compact a supported local conversation into a summary and continue on its existing branch while preserving the original transcript and billing the summary call once.

**Architecture:** Submit a `compact` marker through the existing chat request and resumable stream. The server anchors the summarize-only run on the persisted branch leaf, persists a summary response without creating a user turn, and uses that summary as the next model-context boundary. The client exposes this operation from the context-usage popover only when server capability, conversation type, history, and submission state allow it.

**Tech Stack:** React, TypeScript, Jotai/Recoil chat state, `packages/data-provider`, Express chat controllers, `BaseClient`, `@librechat/agents`, Jest.

---

## File Map

- `packages/data-provider/src/types.ts`, `createPayload.ts`, and `config.ts`: share the compact request marker and startup capability; payload must not send regenerate semantics to the server for a compact turn.
- `packages/data-provider/specs/createPayload.spec.ts`: assert compact serialization and normal payload compatibility.
- `api/server/controllers/agents/request.js` and its controller tests: validate compact requests, use the existing branch leaf as an anchor, and pass the internal mode to the client without making a user message.
- `api/app/clients/BaseClient.js` and `api/app/clients/specs/BaseClient.test.js`: resolve/validate the anchor, skip saving it as a new user row, preserve the existing transcript, and persist the summary response.
- `api/server/controllers/agents/client.js` and its tests: invoke the SDK summarize-only path, suppress user-turn side effects, and retain summary context metadata.
- `api/package.json`, `packages/api/package.json`, and `package-lock.json`: upgrade the Agent SDK to the first version used by upstream manual compaction.
- `api/server/routes/config.js`, `packages/data-provider/src/config.ts`, and route tests: advertise compaction only when summarization is enabled.
- `client/src/common/types.ts`, `client/src/hooks/Chat/useChatFunctions.ts`, and chat hook tests: create an internal compact submission that does not drain staged files, quotes, or skills and does not render a user bubble.
- `client/src/hooks/Chat/useCompactConversation.ts` and its tests: derive eligibility from the selected conversation branch and submit compact requests.
- `client/src/components/Chat/Input/TokenUsage/index.tsx`, a focused `CompactAction` component, and component tests: expose compacting state and action in the existing usage popover.
- `packages/data-provider/src/config.ts`, `client/src/components/Messages/Content/Error.tsx` (or the current typed error owner), and English locale resources: represent and localize rejected/skipped compaction outcomes.
- `api/server/controllers/agents/__tests__/usageEvents.integration.spec.js` and context usage tests: prove the summarize call is charged once and old message tokens are replaced by the summary baseline.

## Task 1: Define the Request Contract

**Files:**
- Modify: `packages/data-provider/src/types.ts`
- Modify: `packages/data-provider/src/createPayload.ts`
- Create: `packages/data-provider/specs/createPayload.spec.ts`

- [ ] Add a failing payload test: a `TSubmission` with `compact: true` emits `compact: true`, keeps its conversation and anchor IDs, and omits `isRegenerate`; a normal submission emits no compact field and preserves current regenerate behavior.
- [ ] Run `cd packages/data-provider && npx jest specs/createPayload.spec.ts --runInBand`; confirm the compact case fails because the contract does not yet carry the flag.
- [ ] Add optional `compact` to submission and payload types, destructure it in `createPayload`, emit it only when true, and emit `isRegenerate` only for non-compact submissions.
- [ ] Re-run the focused test and `cd packages/data-provider && npx tsc --noEmit`.

## Task 2: Add Server-Side Compaction Semantics

**Files:**
- Modify: `api/server/controllers/agents/request.js`
- Modify: `api/server/controllers/agents/__tests__/request.partialDisconnect.spec.js` or a focused `request.compaction.spec.js`
- Modify: `api/app/clients/BaseClient.js`
- Modify: `api/app/clients/specs/BaseClient.test.js`

- [ ] Add failing controller tests for disabled summarization, a missing conversation/anchor, and a compact request that must not be combined with edit, continue, or regenerate.
- [ ] Run `cd api && npx jest server/controllers/agents/__tests__/request.compaction.spec.js --runInBand`; confirm the new validations are absent.
- [ ] Add the compact-request validation and project the validated persisted branch leaf as the internal anchor; pass `isCompaction` through the normal client call.
- [ ] Add failing `BaseClient` tests proving the anchor is not inserted or saved as a fresh user message, the response is parented directly to the anchor, and a missing or already-compacted leaf is rejected.
- [ ] Run `cd api && npx jest app/clients/specs/BaseClient.test.js --runInBand`; confirm the anchor behavior fails before implementation.
- [ ] Implement compaction anchor resolution and the no-user-save path while keeping ordinary, edited, and regenerated turns unchanged.
- [ ] Re-run both focused suites and the existing Agent request resume/partial-disconnect suites.

## Task 3: Enable Summarize-Only Agent Runs and Accounting

**Files:**
- Modify: `api/package.json`
- Modify: `packages/api/package.json`
- Modify: `package-lock.json`
- Modify: `api/server/controllers/agents/client.js`
- Modify: `api/server/controllers/agents/client.test.js`
- Modify: `api/server/controllers/agents/__tests__/usageEvents.integration.spec.js`

- [ ] Add a failing AgentClient test proving a compact request creates a summarize-only run and does not execute the normal final-response model call.
- [ ] Upgrade both declared `@librechat/agents` dependencies to `^3.8.1` and update the lockfile without changing unrelated dependency versions.
- [ ] Run the focused AgentClient test; confirm the new run option is not supplied before the implementation.
- [ ] Pass `summarizeOnly` only for compact requests on the initial run; keep resume construction on its existing path.
- [ ] Add an accounting assertion that summary usage reaches `recordCollectedUsage` once with the summary model/provider and does not enter response usage twice.
- [ ] Run the AgentClient and usage-event integration suites; verify normal runs retain the existing response and billing behavior.

## Task 4: Advertise Capability and Typed Outcomes

**Files:**
- Modify: `api/server/routes/config.js`
- Modify: `api/server/routes/__tests__/config.spec.js`
- Modify: `packages/data-provider/src/config.ts`
- Modify: `client/src/components/Messages/Content/Error.tsx` and its focused tests
- Modify: `client/src/locales/en/translation.json`

- [ ] Add a failing startup-config test: `compactionEnabled` is true when summarization is enabled/unspecified and false when explicitly disabled.
- [ ] Add typed errors for compaction skipped and compaction failed; add tests that map those errors to stable localized UI copy.
- [ ] Run the config and message error component tests and confirm the expected capability/error cases fail.
- [ ] Implement the server capability flag, shared error types, and localized client handling; keep provider secrets and summarization model details out of startup config.
- [ ] Re-run both focused suites and data-provider typecheck.

## Task 5: Submit Compaction Through the Chat Pipeline

**Files:**
- Modify: `client/src/common/types.ts`
- Modify: `client/src/hooks/Chat/useChatFunctions.ts`
- Modify: `client/src/hooks/Chat/__tests__/useChatFunctions.regenerate.spec.tsx`
- Create: `client/src/hooks/Chat/useCompactConversation.ts`
- Create: `client/src/hooks/Chat/__tests__/useCompactConversation.spec.tsx`

- [ ] Add a failing chat submission test proving compact mode uses the leaf ID as anchor, creates no user bubble, and leaves staged files, quotes, and skill selections untouched.
- [ ] Run `cd client && npx jest src/hooks/Chat/__tests__/useChatFunctions.regenerate.spec.tsx --runInBand`; confirm the compact submission contract is missing.
- [ ] Add compact to the chat submission options and build the compact submission through the existing request/stream pipeline with an empty internal user-message slot, a response placeholder under the leaf, and `compact: true`.
- [ ] Add hook tests for eligibility: only an existing persisted local conversation with a real, uncompacted leaf and an idle generation can compact; Assistants, new conversations, missing leaf, and already-compacted leaf cannot.
- [ ] Implement `useCompactConversation` and clear its in-flight marker when the request settles or when the view mounts after completion.
- [ ] Re-run the chat submission and compact-hook suites.

## Task 6: Add the Context Usage Action

**Files:**
- Create: `client/src/components/Chat/Input/TokenUsage/CompactAction.tsx`
- Modify: `client/src/components/Chat/Input/TokenUsage/index.tsx`
- Create or modify: `client/src/components/Chat/Input/TokenUsage/CompactAction.spec.tsx`
- Modify: `client/src/locales/en/translation.json`

- [ ] Add a failing component test that the action appears only when the startup capability is enabled and the current endpoint is supported, and that it disables while compacting or submitting.
- [ ] Run the focused TokenUsage test and confirm the action is absent.
- [ ] Add the compact action to the existing context usage popover, using existing client primitives, localized text, and accessible busy/disabled states.
- [ ] Re-run the focused component tests and client typecheck.

## Task 7: End-to-End Regression Checks

**Files:**
- Modify: `api/server/controllers/agents/__tests__/usageEvents.integration.spec.js`
- Modify: relevant client context usage tests
- Modify: tests from Tasks 2–6 as needed

- [ ] Add an integration test where a compacted conversation is reloaded and the next request context contains the summary plus later messages while excluding earlier raw messages.
- [ ] Add a security test that an anchor belonging to another user is rejected and no message is persisted.
- [ ] Add a failure/abort test proving the original history stays intact and retry is possible after the failed run settles.
- [ ] Run focused suites for payloads, BaseClient, AgentClient, request resume/partial disconnect, usage events, context usage UI, and chat submission.
- [ ] Run `npm run build:data-provider`, `cd client && npm run typecheck`, and `cd packages/api && npx tsc --noEmit`.
- [ ] Review the final diff and ensure only this feature and the approved design/plan documents are included; preserve all pre-existing untracked files.
