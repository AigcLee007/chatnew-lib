# Tools menu help implementation plan

> Execute sequentially in this task using test-driven-development and verification-before-completion.

**Goal:** Explain all five composer tools with actionable help, keep the Skills label, and hide web search from composer entry points.

**Architecture:** Compose the existing shared HoverCard primitives in a feature-owned help component. Preserve Ariakit menu events and refs. Use localized structured paragraphs, not HTML strings. Keep the server and stored search settings unchanged.

**Stack:** React, TypeScript, Ariakit, shared Radix HoverCard, Jest/Testing Library.

## Verified corrections to the design

- Personal upload accepts a single file named SKILL.md, not a directory or archive.
- Type `$` at the beginning of the input, then choose a result; a raw `$name` message is not a supported invocation.
- Skills is the composer label; use a dedicated localization key to avoid renaming unrelated management screens.
- Use a separate help button for touch/keyboard activation so reading help never toggles a tool. Keep hover on the row.
- Artifacts has a right-hand submenu; position its help on the left and preserve the submenu controls.
- Hide the pinned/active WebSearch badge too, so a saved pin cannot expose the hidden entry.

## Task 1 — Regression coverage

Files: `client/src/components/Chat/Input/__tests__/ToolsDropdown.spec.tsx`.

- [ ] Render the actual dropdown and help primitives with only app providers replaced by deterministic fixtures.
- [ ] Assert no web-search entry even when capability and permission are enabled.
- [ ] Assert each help card shows purpose, benefits, ordered usage and example; Skills mentions `$`, list selection and single SKILL.md upload.
- [ ] Assert hover/focus/help-button behavior, Escape, and preserving toggle/pin/submenu events.
- [ ] Run `npm exec -- jest src/components/Chat/Input/__tests__/ToolsDropdown.spec.tsx --runInBand --coverage=false` from client; confirm missing-feature failures.

## Task 2 — Help and copy

Files: new `ToolHelp.tsx`; modify `ToolsDropdown.tsx`, `ArtifactsSubMenu.tsx`, `Skills.tsx`, `BadgeRow.tsx`; add English and Simplified Chinese translation keys (Chinese explicitly requested by the user).

- [ ] Build ToolHelp with shared HoverCard/Trigger/Portal/Content, 300ms opening, 150ms closing, viewport-constrained width and height, and semantic theme roles.
- [ ] Forward menu row props/ref; help button stops click propagation; Escape dismisses help first.
- [ ] Add localized title, definition, benefit, numbered instructions and example for each tool. Skills includes management/upload instructions and lists actual invocation constraints.
- [ ] Wrap four menu rows; integrate Artifacts help without intercepting submenu access.
- [ ] Remove web-search menu-only code and the composer WebSearch badge mount; do not alter backend capability or stored preferences.
- [ ] Re-run the targeted tests and fix implementation until green.

## Task 3 — Verification

- [ ] Run existing SkillsCommand, UploadSkillDialog, appearance token and new dropdown tests.
- [ ] Run targeted ESLint/Prettier checks and `npm run typecheck` in client; record pre-existing failures separately.
- [ ] Build frontend if local dependencies support it; visually inspect hover, card transfer, keyboard and narrow viewport if a runnable app is available.
- [ ] Review diff against spec, update verified design details, and report exact checks and any limitations. Do not deploy or push.
