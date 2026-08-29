# Image Generation UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化独立生图页的中文体验、创作面板层级、图片预览与本地历史瀑布流。

**Architecture:** 保留现有生成和 IndexedDB 数据流，集中改造 `ImageGenerationPage`、`ImageInput`、`ImageResults`。图片卡片统一支持原比例显示、全屏预览和图片剪贴板复制；历史区通过 CSS columns 实现响应式瀑布流。

**Tech Stack:** React, TypeScript, Tailwind theme tokens, Jest, Testing Library, existing i18n JSON.

---

### Task 1: 中文本地化与操作区层级

**Files:**
- Modify: `client/src/components/ImageGeneration/ImageInput.tsx`
- Modify: `client/src/components/ImageGeneration/ImageGenerationPage.tsx`
- Modify: `client/src/locales/zh-Hans/translation.json`
- Test: `client/src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx`

- [ ] **Step 1: Write failing tests**

断言页面使用中文标题、字段和“生成张数”文案，并且生成数量说明显示单图并行语义。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest ImageGenerationPage.spec.tsx --runInBand --coverage=false`
Expected: FAIL because current labels use English/fallback keys.

- [ ] **Step 3: Implement minimal localization/layout changes**

Use `useLocalize` keys for every visible label, group model and reference controls before prompt, make the generate button label `生成图片`, and add a compact helper text for 1-4 parallel single-image calls.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest ImageGenerationPage.spec.tsx --runInBand --coverage=false` and `npm run typecheck`.
Expected: PASS and no diagnostics.

- [ ] **Step 5: Commit**

`git add client/src/components/ImageGeneration client/src/locales/zh-Hans/translation.json && git commit -m "feat: polish image generation controls"`

### Task 2: 结果与历史图片卡片及全屏预览

**Files:**
- Modify: `client/src/components/ImageGeneration/ImageResults.tsx`
- Modify: `client/src/components/ImageGeneration/ImageGenerationPage.tsx`
- Test: `client/src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx`

- [ ] **Step 1: Write failing tests**

覆盖结果图点击打开预览、Esc/关闭按钮退出、方向键切换，以及历史图复用同一预览行为。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest ImageGenerationPage.spec.tsx --runInBand --coverage=false`
Expected: FAIL on the new preview assertions.

- [ ] **Step 3: Implement preview and actions**

Use a fixed modal with theme tokens, preserve original aspect ratio with `object-contain`, add keyboard listeners with cleanup, and keep download/copy/continue-edit/delete actions available from cards.

- [ ] **Step 4: Run tests**

Run: `npx jest ImageGenerationPage.spec.tsx --runInBand --coverage=false`.
Expected: PASS.

- [ ] **Step 5: Commit**

`git add client/src/components/ImageGeneration && git commit -m "feat: add image preview modal"`

### Task 3: 历史瀑布流与最终验证

**Files:**
- Modify: `client/src/components/ImageGeneration/ImageGenerationPage.tsx`
- Modify: `client/src/components/ImageGeneration/ImageResults.tsx`
- Test: `client/src/utils/__tests__/imageGenerationHistory.spec.ts`

- [ ] **Step 1: Write failing layout assertion**

断言历史容器包含瀑布流布局类名，历史图片不再统一裁剪为正方形。

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest ImageGenerationPage.spec.tsx imageGenerationHistory.spec.ts --runInBand --coverage=false`.
Expected: FAIL on the new layout assertion.

- [ ] **Step 3: Implement waterfall layout**

Apply responsive CSS columns (`columns-1 sm:columns-2 lg:columns-4`) to history only, use `break-inside-avoid`, preserve image aspect ratio, and keep cards compact with hover actions.

- [ ] **Step 4: Run verification**

Run: `npx jest ImageGenerationPage.spec.tsx imageGenerationHistory.spec.ts --runInBand --coverage=false`, `npm run typecheck`, and `git diff --check`.
Expected: all tests pass, typecheck has no diagnostics, and diff check is clean.

- [ ] **Step 5: Commit**

`git add client/src/components/ImageGeneration && git commit -m "feat: add image history waterfall layout"`
