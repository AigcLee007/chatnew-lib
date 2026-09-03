# Gemini 3.8 Flash Default Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `gemini-3.8-flash` to the curated Gemini catalog and make it the soft default for new users.

**Architecture:** The server's native Google endpoint reads its model allowlist from `.env`; the client receives the allowed list and resolves labels from `catalog.ts`. `librechat.yaml` supplies the soft-default preset, which applies only before a user has selected a model.

**Tech Stack:** LibreChat YAML and dotenv configuration, TypeScript, Jest.

---

### Task 1: Cover the catalog display entry

**Files:**
- Modify: `client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts`
- Modify: `client/src/components/Chat/Menus/Endpoints/catalog.ts`

- [ ] **Step 1: Write the failing test**

Add `gemini-3.8-flash` to the Google endpoint fixture and assert its readable label and unchanged model ID:

```ts
expect(entries[2]).toMatchObject({
  group: 'GEMINI',
  model: 'gemini-3.8-flash',
  name: 'Gemini 3.8 Flash',
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm --prefix client test -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts`

Expected: the assertion fails because the catalog has no `gemini-3.8-flash` display entry.

- [ ] **Step 3: Add the minimal catalog entry**

Add this record next to the existing Gemini Flash entries:

```ts
'gemini-3.8-flash': {
  name: 'Gemini 3.8 Flash',
  description: '响应快速、延迟低，适合日常对话与内容生成。',
  group: 'GEMINI',
},
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm --prefix client test -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts`

Expected: the focused Jest suite passes.

### Task 2: Update the runtime allowlist and soft default

**Files:**
- Modify: `.env:17`
- Modify: `librechat.yaml:24-29`

- [ ] **Step 1: Update the Google model allowlist**

Replace the allowlist with:

```dotenv
GOOGLE_MODELS=gemini-3.5-flash-preview,gemini-3.7-flash,gemini-3.8-flash,gemini-3.1-pro-preview
```

- [ ] **Step 2: Update the soft-default model spec**

Replace the default spec values with:

```yaml
- name: gemini-3-8-flash-default
  label: Gemini 3.8 Flash
  softDefault: true
  preset:
    endpoint: google
    model: gemini-3.8-flash
```

- [ ] **Step 3: Validate the configuration values**

Run:

```powershell
$envLine = (Get-Content .env | Where-Object { $_ -like 'GOOGLE_MODELS=*' })
$yaml = Get-Content -Raw librechat.yaml
if ($envLine -notmatch '(^|,)gemini-3.8-flash(,|$)' -or $yaml -notmatch 'model: gemini-3.8-flash') { throw 'Gemini 3.8 Flash is not configured consistently.' }
```

Expected: exit code 0.

- [ ] **Step 4: Review the final diff**

Run: `git diff -- .env librechat.yaml client/src/components/Chat/Menus/Endpoints/catalog.ts client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts`

Expected: only the new model, its menu label, and the new-user soft-default change are present.
