# Skills Discovery And Personal Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Skills understandable in the chat composer and provide a discoverable, private personal `SKILL.md` upload workflow.

**Architecture:** Reuse the existing Skills summary/detail queries, import mutation, permissions, and `/skills` routes. Add presentation metadata and source affordances to the `$` popover, make the existing upload dialog single-file-only for student-facing use, and organize the management sidebar into system and personal views while enforcing privacy on the API.

**Tech Stack:** React, TypeScript, Recoil, TanStack Query, React Hook Form, Express, Mongoose/data-schemas, Jest, existing LibreChat UI primitives and i18n.

---

## File Map

- Modify `client/src/components/Chat/Input/SkillsCommand.tsx`: show source/usefulness metadata, open details, and expose the personal upload action.
- Modify or create `client/src/components/Chat/Input/SkillQuickDetail.tsx`: lightweight read-first detail view used from the composer without duplicating edit logic.
- Modify `client/src/components/Skills/dialogs/UploadSkillDialog.tsx`: accept only a file named `SKILL.md`, show frontmatter preview/errors, and support caller-specific success behavior.
- Modify `client/src/components/Skills/sidebar/SkillsSidePanel.tsx` and `client/src/components/Skills/lists/SkillList.tsx`: add system/personal grouping and the management-page upload entry.
- Modify `client/src/components/Skills/display/SkillDetail.tsx`: expose student-oriented “when to use / inputs / outputs / example” metadata from frontmatter.
- Modify `client/src/data-provider/Skills/mutations.ts` and `client/src/data-provider/Skills/queries.ts`: preserve/update list and detail caches after import and support detail navigation from the composer.
- Modify `client/src/locales/en/translation.json` and `client/src/locales/zh-Hans/translation.json`: add all new labels, source names, upload requirements, preview fields, and errors.
- Modify `packages/api/src/skills/import.ts`: enforce `mode=personal-single` for student imports while preserving the existing archive path when that mode is absent.
- Modify `packages/api/src/skills/handlers.ts` and the specific data-schemas methods used by list/detail/edit/delete to guarantee owner-scoped personal Skill behavior.
- Add focused tests beside each changed component and API module; do not add `.superpowers/` files to Git.

## Task 1: Lock Down Personal Import and Privacy Contracts

**Files:**
- Modify: `packages/api/src/skills/import.ts`
- Modify: `packages/api/src/skills/handlers.ts`
- Test: `packages/api/src/skills/__tests__/import.test.ts`
- Test: `packages/api/src/skills/__tests__/privacy.test.ts`

- [ ] **Step 1: Write failing import tests.** Add cases proving that `mode=personal-single` rejects `custom.md` with status `400`, accepts `SKILL.md` and `skill.md` by case-insensitive basename comparison, rejects `.zip`/`.skill`, and preserves the existing no-mode archive path.
- [ ] **Step 2: Write failing privacy tests.** Create `packages/api/src/skills/__tests__/privacy.test.ts` with cases proving user A cannot list, fetch, edit, or delete user B’s private inline Skill, while the owner can perform those operations and deployment Skills remain readable but non-editable.
- [ ] **Step 3: Run the focused API tests and verify the new cases fail for the expected contract mismatch.** Run `npm run test:packages:api -- --runInBand src/skills/__tests__/import.test.ts` and the privacy test path. Expected: the filename/archive case fails before implementation; existing permission failures must be distinguished from setup errors.
- [ ] **Step 4: Implement the smallest server change.** When `req.body.mode` is `personal-single`, require `path.basename(file.originalname).toLowerCase() === 'skill.md'`, return a structured `400` issue for any other file, and never enter the archive branch. When mode is absent, preserve existing `.md`/`.zip`/`.skill` behavior. Reuse existing ownership grants and resource permission checks.
- [ ] **Step 5: Run the focused API tests again.** Expected: all new import/privacy cases pass and existing skill import tests remain green.
- [ ] **Step 6: Commit the server contract.** Use `git add packages/api/src/skills packages/data-schemas...` for only touched files and commit `fix: scope personal skill imports and access`.

## Task 2: Add User-Facing Skill Metadata and Detail Contract

**Files:**
- Modify: `packages/data-provider/src/types/skills.ts` only if typed metadata fields are missing
- Modify: `client/src/components/Skills/display/SkillDetail.tsx`
- Create: `client/src/components/Chat/Input/SkillQuickDetail.tsx`
- Test: `client/src/components/Skills/display/__tests__/SkillDetail.spec.tsx`
- Test: `client/src/components/Chat/Input/__tests__/SkillQuickDetail.spec.tsx`

- [ ] **Step 1: Write failing renderer tests.** Cover frontmatter keys `when-to-use`, `inputs`, `outputs`, and `example`; verify labels are localized and absent keys do not render empty sections. Cover source labels for `deployment` and owner-authored `inline` Skills.
- [ ] **Step 2: Run the focused client tests to verify they fail.** Run `npm run test:ci -- --runInBand src/components/Skills/display/__tests__/SkillDetail.spec.tsx src/components/Chat/Input/__tests__/SkillQuickDetail.spec.tsx` from `client`; if dependencies are unavailable, record the exact prerequisite failure and use typecheck/build as the next verification gate.
- [ ] **Step 3: Implement a shared metadata projection.** Parse the existing frontmatter utility output into a small typed view model; render only known student-facing fields and a collapsible full Markdown section. Keep `SkillDetail` as the canonical full-page renderer and make `SkillQuickDetail` a read-only wrapper with `Use this skill` and `Open full details` actions.
- [ ] **Step 4: Run the focused tests and typecheck.** Expected: metadata fields, source labels, empty-state behavior, and actions pass without changing existing Markdown rendering.
- [ ] **Step 5: Commit the metadata/detail contract.** Commit `feat: explain skill purpose and usage`.

## Task 3: Improve `$` Composer Discovery and Personal Upload Entry

**Files:**
- Modify: `client/src/components/Chat/Input/SkillsCommand.tsx`
- Modify: `client/src/components/Chat/Input/ChatForm.tsx` only if callback plumbing is required
- Modify: `client/src/components/Skills/dialogs/UploadSkillDialog.tsx`
- Modify: `client/src/components/Skills/utils/parseSkillMd.ts` only for preview validation gaps
- Test: `client/src/components/Chat/Input/__tests__/SkillsCommand.spec.tsx`
- Test: `client/src/components/Skills/dialogs/__tests__/UploadSkillDialog.spec.tsx`

- [ ] **Step 1: Write failing composer tests.** Verify each row exposes a purpose description and source label, the detail action opens `SkillQuickDetail`, and the upload action is absent when `SKILLS.CREATE` is false.
- [ ] **Step 2: Write failing upload tests.** Verify `custom.md`, `.zip`, and `.skill` are rejected before mutation; `SKILL.md` is accepted; malformed frontmatter shows a field-level error; successful import calls the existing mutation and invokes the caller callback.
- [ ] **Step 3: Run the focused client tests and verify the new cases fail.** Use the client Jest command with the exact test paths; do not modify production code until the new assertions fail for behavior rather than parser/setup errors.
- [ ] **Step 4: Implement the composer affordances.** Add a source badge, an icon-only details control with tooltip, and a bottom `Upload my SKILL.md` command. Reuse the existing `handleSelect` pending-manual-skills flow; do not insert `$skill-name` into the textarea. Mount the shared upload dialog with a success callback that adds the imported ID/name to the current conversation.
- [ ] **Step 5: Implement single-file upload UX.** Change `accept` to `.md`, require `file.name.toLowerCase() === 'skill.md'`, append `mode=personal-single` to `FormData`, reject all other names client-side, show frontmatter preview before submit when parsing succeeds, and preserve the dialog on errors. Keep server size limits authoritative.
- [ ] **Step 6: Run the focused tests and verify the query cache.** Confirm the import mutation updates detail/list caches and the composer can immediately select the returned personal Skill.
- [ ] **Step 7: Commit the composer/upload flow.** Commit `feat: add skill discovery and personal upload entry`.

## Task 4: Add System/Personal Sections to the Skills Manager

**Files:**
- Modify: `client/src/components/Skills/sidebar/SkillsSidePanel.tsx`
- Modify: `client/src/components/Skills/lists/SkillList.tsx`
- Modify: `client/src/components/Skills/lists/SkillListItem.tsx` if row actions/source badges belong there
- Modify: `client/src/components/Skills/buttons/CreateSkillMenu.tsx` only to clarify upload wording
- Test: `client/src/components/Skills/sidebar/__tests__/SkillsSidePanel.spec.tsx`
- Test: `client/src/components/Skills/layouts/__tests__/SkillsView.spec.tsx`

- [ ] **Step 1: Write failing grouping tests.** Verify deployment/system Skills appear under `System Skills`, owner-authored Skills under `My Skills`, and an owner’s row has edit/delete actions while deployment rows are read-only.
- [ ] **Step 2: Write failing permission tests.** Verify the upload/create menu is hidden when `SKILLS.CREATE` is unavailable and that the manager does not imply client-side visibility is a security boundary.
- [ ] **Step 3: Run the focused tests and verify the expected failures.** Use the client Jest paths; separate existing fixture failures from the new assertions.
- [ ] **Step 4: Implement grouping and management entry.** Partition the already-fetched summaries by `source`/`author`, preserve search and cursor pagination, add explicit section headings, and keep the existing `CreateSkillMenu` as the shared write/upload control. Do not add share/public controls for personal Skills.
- [ ] **Step 5: Run tests and a client typecheck.** Expected: grouping, permissions, navigation, and existing sidebar behavior pass.
- [ ] **Step 6: Commit the manager changes.** Commit `feat: organize system and personal skills`.

## Task 5: Localization, Responsive States, and Accessibility

**Files:**
- Modify: `client/src/locales/en/translation.json`
- Modify: `client/src/locales/zh-Hans/translation.json`
- Modify: changed Skill components from Tasks 2-4
- Test: component tests for labels, disabled/loading state, and keyboard access

- [ ] **Step 1: Add translation keys.** Add keys for source labels, purpose/input/output/example headings, detail actions, personal upload, exact-file requirements, frontmatter errors, import success/failure, and private ownership wording in both locales.
- [ ] **Step 2: Write/extend accessibility tests.** Assert every icon-only control has an accessible name/tooltip, upload has a keyboard-triggerable file input, loading disables duplicate submission, and dialogs expose a title/description.
- [ ] **Step 3: Implement responsive styling.** Keep the composer popover bounded on mobile, make detail/upload dialogs near-full-height on small screens, prevent long Skill names/descriptions from shifting rows, and retain the existing virtualized list dimensions.
- [ ] **Step 4: Run translation validation, component tests, and client typecheck.** Expected: no missing translation keys, no type errors, and no accessibility assertion failures.
- [ ] **Step 5: Commit the UX polish.** Commit `feat: localize and harden skill UX`.

## Task 6: End-to-End Verification and Deployment Handoff

**Files:**
- Modify: none unless verification reveals a regression
- Test: existing Playwright client flow or add a focused Skills flow under `e2e/`

- [ ] **Step 1: Run the complete relevant verification suite.** Run API skill tests, client Skill/component tests, client typecheck, and the production client build. Record exit codes and failure counts.
- [ ] **Step 2: Run the browser acceptance flow.** With a user having Skills use/create permissions: open `$`, inspect purpose/source, open details, use a system Skill, upload a local `SKILL.md`, use it immediately, refresh, and confirm it remains in `My Skills`.
- [ ] **Step 3: Verify privacy with a second user.** Confirm the second account cannot list, fetch, edit, delete, or invoke the first account’s personal Skill.
- [ ] **Step 4: Verify the no-create role.** Confirm a user without `SKILLS.CREATE` sees no upload entry in either the composer or manager.
- [ ] **Step 5: Build and deploy using the project’s existing commands.** Push only the feature commits to `chatnew/main`; on the server run `git pull --ff-only origin main`, rebuild `client api`, restart those services, and inspect logs.
- [ ] **Step 6: Final smoke test.** Verify `/api/skills` returns `200` through the authenticated application request, the `$` popover renders, and no new auth or permission errors appear in browser Network/console logs.

## Self-Review Checklist

- [ ] Every approved design section maps to at least one task.
- [ ] Personal visibility is enforced server-side, not only by client grouping.
- [ ] Upload is single-file-only in the student UI and does not remove required internal archive support without an explicit server decision.
- [ ] Existing pending manual Skill selection behavior remains unchanged.
- [ ] No task relies on unresolved placeholder text.
- [ ] Each implementation task starts with a failing test and ends with a focused verification command.
