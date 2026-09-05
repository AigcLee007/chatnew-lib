# Gemini 3.8 Flash Title Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route automatic titles for the configured OpenAI custom endpoint through Google Gemini 3.8 Flash.

**Architecture:** Keep title generation enabled on the existing custom OpenAI endpoint, but resolve its title credentials through the native Google endpoint and use `gemini-3.8-flash` as the title model. The selected conversation model and new-user soft default remain unchanged.

**Tech Stack:** LibreChat YAML, `js-yaml`, Node/Jest.

---

### Task 1: Lock the approved title routing in a regression test

**Files:**
- Create: `api/server/services/Config/librechatTitleConfig.spec.js`

- [x] **Step 1: Write the failing test**

Read the repository's real `librechat.yaml`, locate the custom endpoint named `OpenAI`, and assert its title settings:

```js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

it('routes custom OpenAI titles through Gemini 3.8 Flash on Google', () => {
  const configPath = path.resolve(__dirname, '../../../../librechat.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const endpoint = config.endpoints.custom.find(({ name }) => name === 'OpenAI');

  expect(endpoint).toMatchObject({
    titleConvo: true,
    titleModel: 'gemini-3.8-flash',
    titleEndpoint: 'google',
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm --prefix api test -- --runInBand server/services/Config/librechatTitleConfig.spec.js`

Expected: FAIL because the current OpenAI custom endpoint still has `titleModel: gpt-5.6-terra` and no `titleEndpoint: google`.

### Task 2: Apply and validate the configuration change

**Files:**
- Modify: `librechat.yaml:68-69`

- [x] **Step 1: Update the custom OpenAI endpoint**

Set:

```yaml
      titleConvo: true
      titleModel: gemini-3.8-flash
      titleEndpoint: google
```

- [x] **Step 2: Run the focused test and verify it passes**

Run: `npm --prefix api test -- --runInBand server/services/Config/librechatTitleConfig.spec.js`

Expected: PASS with one test passed.

- [x] **Step 3: Parse and inspect the final YAML**

Run:

```powershell
node -e "const fs=require('fs'); const yaml=require('js-yaml'); const c=yaml.load(fs.readFileSync('librechat.yaml','utf8')); const e=c.endpoints.custom.find(x=>x.name==='OpenAI'); if(e.titleModel!=='gemini-3.8-flash'||e.titleEndpoint!=='google') throw new Error('title routing mismatch'); console.log(JSON.stringify({titleConvo:e.titleConvo,titleModel:e.titleModel,titleEndpoint:e.titleEndpoint}));"
```

Expected: `{"titleConvo":true,"titleModel":"gemini-3.8-flash","titleEndpoint":"google"}`.

- [x] **Step 4: Check the diff for scope**

Run: `git diff --check -- librechat.yaml api/server/services/Config/librechatTitleConfig.spec.js`

Expected: no whitespace errors; only the approved title route and its regression test are changed.
