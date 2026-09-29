# Simplified Chinese Locale Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace accidental Traditional Chinese and untranslated English in the Simplified Chinese locale while preserving interpolation and technical terms.

**Architecture:** Keep the existing i18n loading path unchanged. Update only the zh-Hans JSON values, add a focused locale regression test, and rely on the existing locale test/typecheck commands.

**Tech Stack:** JSON locale resources, Jest, TypeScript, i18next.

---

### Task 1: Establish locale regression coverage

**Files:**
- Modify: `client/src/locales/Translation.spec.ts`
- Test target: `client/src/locales/Translation.spec.ts`

- [ ] **Step 1: Add a failing assertion for the context labels**

Add a test that reads the zh-Hans resource and asserts the context labels use simplified terminology and contain no known accidental Traditional/English values.

- [ ] **Step 2: Run the focused test and confirm it fails against the current resource**

Run: `npm --prefix client test:ci -- --runInBand src/locales/Translation.spec.ts`

Expected: FAIL because current values include `脉络`, Traditional values, and `Totals`/`Subagents`.

### Task 2: Clean the zh-Hans resource

**Files:**
- Modify: `client/src/locales/zh-Hans/translation.json`

- [ ] **Step 1: Preserve keys and placeholders**

Use a script to load English and zh-Hans JSON, keep every key unchanged, and verify each `{{...}}` placeholder set is identical before writing.

- [ ] **Step 2: Convert accidental Traditional values to Simplified Chinese**

Translate the recently added Traditional entries while preserving product and technical names.

- [ ] **Step 3: Translate user-facing English entries**

Translate full-sentence UI labels and messages; keep brand names, model names, API names, and code identifiers in their original form.

- [ ] **Step 4: Normalize context terminology**

Set the context usage keys to `上下文` wording, including the accessibility label and snapshot text.

- [ ] **Step 5: Re-run the JSON and placeholder checks**

Run a Node script that parses the file, checks placeholder parity against English, and reports any remaining accidental Traditional or full-English UI values in the cleaned set.

### Task 3: Run verification

**Files:**
- No additional production files.

- [ ] **Step 1: Run the focused locale test**

Run: `npm --prefix client run test:ci -- --runInBand src/locales/Translation.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run: `npm --prefix client run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check` and `git diff --stat` from `LibreChat`; ensure only the intended locale and test files changed.
