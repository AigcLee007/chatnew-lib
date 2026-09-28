# 模型目录更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `claude-opus-5-5`、`gpt-6-luna`、`gpt-6-sol` 接入现有默认模型和自定义 OpenAI 列表，并让模型选择器按现有供应商分组与显示格式呈现，同时移除 `gemini-3.5-flash-preview`/默认 `gemini-3.5-flash`。

**Architecture:** 保持后端模型 ID 原样传递。共享默认模型由 `packages/data-provider/src/config.ts` 统一提供；当前部署的自定义 OpenAI 列表由 `librechat.yaml` 提供；前端 `catalog.ts` 仅把端点返回的模型映射为可读名称、描述和供应商分组。

**Tech Stack:** TypeScript, React client catalog utilities, Jest, YAML configuration.

---

### Task 1: 更新共享默认模型和自定义 OpenAI 列表

**Files:**
- Modify: `packages/data-provider/src/config.spec.ts:671-676`
- Modify: `packages/data-provider/src/config.ts:2234-2352`
- Modify: `librechat.yaml:70-80`

- [x] **Step 1: Write the failing configuration test**

Extend the existing `shared default models` test in `packages/data-provider/src/config.spec.ts` so it asserts the new IDs and removal:

```ts
it('keeps the requested model catalog in shared defaults', () => {
  expect(defaultModels[EModelEndpoint.openAI]).toEqual(
    expect.arrayContaining(['gpt-6-sol', 'gpt-6-luna']),
  );
  expect(defaultModels[EModelEndpoint.anthropic]).toContain('claude-opus-5-5');
  expect(defaultModels[EModelEndpoint.google]).not.toContain('gemini-3.5-flash');
});
```

- [x] **Step 2: Run the test to verify it fails**

Run from `D:\chat-libre\LibreChat`:

```powershell
npm --prefix packages/data-provider run test:ci -- --runInBand src/config.spec.ts
```

Expected: FAIL because the new IDs are not in the shared arrays and Google defaults still include `gemini-3.5-flash`.

- [x] **Step 3: Implement the minimal configuration change**

In `packages/data-provider/src/config.ts`:

- Add `gpt-6-sol` and `gpt-6-luna` at the front of `sharedOpenAIModels`, preserving the existing newest-first ordering.
- Add `claude-opus-5-5` immediately before `claude-opus-5` in `sharedAnthropicModels`.
- Remove only the `gemini-3.5-flash` entry from `defaultModels[EModelEndpoint.google]`; retain `gemini-3.5-flash-lite` and all token/runtime mappings.

In `librechat.yaml`, add `gpt-6-sol` and `gpt-6-luna` to the current `endpoints.custom` entry named `OpenAI`, immediately before the existing `gpt-6-astra` entry.

- [x] **Step 4: Run the configuration test to verify it passes**

Run:

```powershell
npm --prefix packages/data-provider run test:ci -- --runInBand src/config.spec.ts
```

Expected: PASS.

- [x] **Step 5: Validate the YAML list and commit**

Run:

```powershell
node -e "const fs=require('fs'),yaml=require('js-yaml'); const c=yaml.load(fs.readFileSync('librechat.yaml','utf8')); const m=c.endpoints.custom.find(x=>x.name==='OpenAI').models.default; if(!m.includes('gpt-6-sol')||!m.includes('gpt-6-luna')) throw new Error('new OpenAI models missing'); if(m.includes('gemini-3.5-flash')) throw new Error('retired Gemini model still configured'); console.log(m)"
```

Expected: the printed list contains `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-5.6-sol`, and `gpt-5.6-terra`, with no Gemini model.

```powershell
git add packages/data-provider/src/config.ts packages/data-provider/src/config.spec.ts librechat.yaml
git commit -m "feat: update shared model defaults"
```

### Task 2: Update model catalog metadata and catalog tests

**Files:**
- Modify: `client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts:65-90,118-150,190-207`
- Modify: `client/src/components/Chat/Menus/Endpoints/catalog.ts:24-75`

- [x] **Step 1: Write the failing catalog assertions**

Add a retired-model test beside the existing retired `gpt-5.4` test, then add a readable-label test beside the existing Claude/OpenAI metadata test:

```ts
it('does not expose the retired Gemini 3.5 Flash preview model', () => {
  const endpoint: Endpoint = {
    value: 'google',
    label: 'Google',
    hasModels: true,
    icon: null,
    models: [{ name: 'gemini-3.5-flash-preview' }, { name: 'gemini-3.8-flash' }],
  };

  expect(buildModelCatalog([endpoint], [], localizeZh).map((entry) => entry.model)).toEqual([
    'gemini-3.8-flash',
  ]);
});
```

Add this metadata test beside the existing readable-label test:

```ts
it.each([
  ['gpt-6-sol', 'GPT-6 Sol', 'OPENAI'],
  ['gpt-6-luna', 'GPT-6 Luna', 'OPENAI'],
  ['claude-opus-5-5', 'Claude Opus 5.5', 'ANTHROPIC'],
])('uses catalog metadata for %s', (model, name, group) => {
  const endpoint: Endpoint = {
    value: group === 'ANTHROPIC' ? 'anthropic' : 'openAI',
    label: group === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI',
    hasModels: true,
    icon: null,
    models: [{ name: model }],
  };

  const [entry] = buildModelCatalog([endpoint], [], localizeZh);
  expect(entry).toMatchObject({ model, name, group });
  expect(entry.description).toBeTruthy();
});
```

- [x] **Step 2: Run the focused client test to verify it fails**

Run from `D:\chat-libre\LibreChat`:

```powershell
npm --prefix client run test:ci -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
```

Expected: FAIL because the retired Gemini preview model is not filtered yet and the new IDs currently use fallback names.

- [x] **Step 3: Implement the catalog metadata**

In `client/src/components/Chat/Menus/Endpoints/catalog.ts`:

- Add `gpt-6-sol` and `gpt-6-luna` to `MODEL_INFO` under `OPENAI`.
- Add `claude-opus-5-5` under `ANTHROPIC`.
- Use the existing localized description values `旗舰级推理与编程能力，适合高要求的技术工作。` for `gpt-6-sol`, `兼顾质量与效率，适合内容生产和业务分析。` for `gpt-6-luna`, and `擅长细致分析、长文本处理与复杂推理。` for `claude-opus-5-5`, so English localization continues to resolve through the current translation keys.
- Add `gemini-3.5-flash-preview` to `RETIRED_MODEL_IDS` and remove its explicit `MODEL_INFO` entry; leave generic Gemini fallback behavior intact for other explicitly configured unknown models.

Update the test fixtures and expected model arrays so they reflect the removed preview model and the new metadata.

- [x] **Step 4: Run the focused client test to verify it passes**

Run:

```powershell
npm --prefix client run test:ci -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
```

Expected: PASS with all catalog grouping, localization, filtering, and fallback tests green.

- [x] **Step 5: Commit the catalog change**

```powershell
git add client/src/components/Chat/Menus/Endpoints/catalog.ts client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
git commit -m "feat: add requested models to catalog"
```

### Task 3: Run final verification

**Files:**
- No new files; verify the files changed in Tasks 1-2.

- [x] **Step 1: Run both focused test suites**

```powershell
npm --prefix packages/data-provider run test:ci -- --runInBand src/config.spec.ts
npm --prefix client run test:ci -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
```

Expected: both commands exit 0.

- [x] **Step 2: Run client type checking**

```powershell
npm --prefix client run typecheck
```

Expected: TypeScript exits 0 with no diagnostics.

- [x] **Step 3: Review the final diff and status**

```powershell
git diff HEAD~2..HEAD --check
git status --short
```

Expected: no whitespace errors; only the intended model configuration/catalog commits are present alongside any pre-existing unrelated untracked files.

