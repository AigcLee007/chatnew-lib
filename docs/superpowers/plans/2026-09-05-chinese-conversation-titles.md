# Chinese Conversation Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure every new conversation title to be concise simplified Chinese.

**Architecture:** Add one global `endpoints.all` title configuration. Route title calls
to the existing Google `gemini-3.8-flash` model and provide a Chinese-only completion
prompt. The selected model for the main conversation is unchanged.

**Tech Stack:** LibreChat YAML, `js-yaml`, Node/Jest.

---

### Task 1: Lock the global Chinese title contract in a regression test

**Files:**
- Modify: `api/server/services/Config/librechatTitleConfig.spec.js`

- [x] **Step 1: Add the failing assertion**

Load the real `librechat.yaml`, read `endpoints.all`, and assert the shared title
model, endpoint, completion method, and Chinese prompt markers.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm --prefix api test -- --runInBand server/services/Config/librechatTitleConfig.spec.js`

Expected: the new test fails because `endpoints.all` is not configured yet.

### Task 2: Add the global title configuration

**Files:**
- Modify: `librechat.yaml`

- [x] **Step 1: Add `endpoints.all` title settings**

Set `titleConvo: true`, `titleModel: gemini-3.8-flash`, `titleEndpoint: google`,
`titleMethod: completion`, and a prompt that requires only a concise simplified-Chinese
title with `{convo}` as the conversation placeholder.

- [x] **Step 2: Run the focused configuration test**

Run: `npm --prefix api test -- --runInBand server/services/Config/librechatTitleConfig.spec.js`

Expected: both configuration tests pass.

### Task 3: Verify runtime compatibility

- [x] **Step 1: Run title and route regression tests**

Run:

```bash
npm --prefix api test -- --runInBand server/services/Config/librechatTitleConfig.spec.js server/services/Endpoints/agents/title.test.js server/controllers/agents/client.test.js -t "titleEndpoint configuration|titleConvo method"
```

Expected: all selected tests pass.

- [x] **Step 2: Parse the final YAML and inspect the diff**

Run:

```bash
node -e "const fs=require('fs'); const yaml=require('js-yaml'); const c=yaml.load(fs.readFileSync('librechat.yaml','utf8')); const e=c.endpoints.all; if(e.titleModel!=='gemini-3.8-flash'||e.titleEndpoint!=='google'||!e.titlePrompt.includes('简体中文')) throw new Error('global Chinese title route mismatch'); console.log(JSON.stringify({titleConvo:e.titleConvo,titleModel:e.titleModel,titleEndpoint:e.titleEndpoint,titleMethod:e.titleMethod}));"
git diff --check
```

Expected: the parsed route is printed and no whitespace errors are reported.
