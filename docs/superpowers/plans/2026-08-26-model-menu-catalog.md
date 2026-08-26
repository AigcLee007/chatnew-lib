# Model menu catalog implementation plan

**Goal:** Match the approved reference menu without changing available models or model selection behavior.

**Architecture:** A pure catalog builder creates grouped display rows from permission-filtered endpoints and modelSpecs. The existing CustomMenu gains an opt-in catalog presentation. Shared provider SVGs supply menu and trigger icons. Existing selection handlers remain authoritative.

**Tech:** React, TypeScript, Ariakit, Jest/Testing Library, existing Tailwind theme tokens.

## 1. Regression tests

- [ ] Add catalog cases to `Endpoints/__tests__/utils.test.ts`: keep original IDs, count actual options, group/sort providers, search descriptions, retain custom groups/unknown models, distinguish same IDs across endpoints.
- [ ] Add `Endpoints/__tests__/ModelSelector.spec.tsx` with real menu primitives: no configure-key button, direct model selection, query filtering, Escape, modelSpec and pin behavior.
- [ ] Run these before implementation and confirm missing-feature failures.

## 2. Implementation

- [ ] Add `Endpoints/catalog.ts` for typed display metadata/group building and selection keys.
- [ ] Add `Endpoints/components/ProviderIcon.tsx`, copy Claude SVG into public assets and preserve source attribution in an asset README. Use unique gradient IDs for inline Gemini SVG.
- [ ] Add `Endpoints/components/CatalogList.tsx` to render ordinary rows and specs; retain specialized Agent/Assistant menus.
- [ ] Add `presentation="catalog"` to CustomMenu without changing default nested menus. Use fixed search header, viewport constrained width, scroll list, semantic tokens.
- [ ] Update ModelSelector trigger and content, remove its DialogManager mount. Remove endpoint settings buttons. Preserve homepage API-key management.
- [ ] Add localized labels/descriptions in English and Simplified Chinese, as requested for this Chinese reference interface.

## 3. Verification

- [ ] `npx jest src/components/Chat/Menus/Endpoints --runInBand --coverage=false` from client.
- [ ] `npm run typecheck` from client; targeted ESLint from repository root.
- [ ] Browser-check actual components with a local fixture if backend is unavailable: search, selection, keyboard, dismiss, both themes, mobile and logo loading.
- [ ] Request independent code review while local validation proceeds; verify findings and fix confirmed issues.
- [ ] Update checklist, report precise evidence and remaining limits. No push, merge or deployment without a new request.
