# GPT-6 Astra and Claude Fable 5.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make gpt-6-astra selectable through the configured OpenAI-compatible endpoint and claude-fable-5-1 selectable through the configured native Anthropic endpoint, with readable catalog entries and consistent fallback defaults.

**Architecture:** The curated deployment lists the OpenAI-compatible model in librechat.yaml and the native Anthropic models in the dotenv allowlist. Shared provider defaults cover installations without those curated overrides, while the client catalog maps exact IDs to labels and provider groups. No new endpoint, credential, or default-model behavior is introduced; Gemini 3.8 Flash remains the soft default.

**Tech Stack:** YAML, dotenv, TypeScript, Jest, Node.js configuration checks.

---

### Task 1: Cover and implement model selector catalog entries

**Files:**
- Modify: client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
- Modify: client/src/components/Chat/Menus/Endpoints/catalog.ts

- [ ] **Step 1: Write the failing catalog test**

Add this test beside the existing human-readable Claude model test. It uses the real buildModelCatalog function and asserts that both exact IDs retain their IDs while receiving provider-specific labels and groups:

~~~
  it.each([
    ['openAI', 'OpenAI', 'gpt-6-astra', 'GPT-6 Astra', 'OPENAI'],
    ['anthropic', 'Anthropic', 'claude-fable-5-1', 'Claude Fable 5.1', 'ANTHROPIC'],
  ])(
    'uses a readable label for %s model %s',
    (value, label, model, name, group) => {
      const endpoint: Endpoint = {
        value,
        label,
        hasModels: true,
        icon: null,
        models: [{ name: model }],
      };

      const [entry] = buildModelCatalog([endpoint], [], localizeZh);
      expect(entry).toMatchObject({ model, name, group });
      expect(entry.description).toBeTruthy();
    },
  );
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

~~~
npm --prefix client test -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
~~~

Expected: the new cases fail because the catalog currently returns the raw IDs instead of the requested labels.

- [ ] **Step 3: Add the minimal catalog records**

Insert these records in MODEL_INFO. Reuse existing translated description text so no new locale keys are needed:

~~~
  'gpt-6-astra': {
    name: 'GPT-6 Astra',
    description: '旗舰级推理与编程能力，适合高要求的技术工作。',
    group: 'OPENAI',
  },
  'claude-fable-5-1': {
    name: 'Claude Fable 5.1',
    description: '擅长细致分析、长文本处理与复杂推理。',
    group: 'ANTHROPIC',
  },
~~~

- [ ] **Step 4: Run the focused test and verify it passes**

Run the command from Step 2. Expected: the complete catalog utility suite passes, including existing Gemini, fallback, localization, and search cases.

- [ ] **Step 5: Commit the catalog change**

~~~
git add client/src/components/Chat/Menus/Endpoints/catalog.ts client/src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
git commit -m "feat: add new model selector labels"
~~~

### Task 2: Cover and implement shared provider model defaults

**Files:**
- Modify: packages/data-provider/src/config.spec.ts
- Modify: packages/data-provider/src/config.ts

- [ ] **Step 1: Write the failing default-list test**

Extend the import from ./config with defaultModels, then append:

~~~
describe('curated provider model defaults', () => {
  it('includes the OpenAI Astra and Anthropic Fable 5.1 IDs', () => {
    expect(defaultModels[EModelEndpoint.openAI]).toContain('gpt-6-astra');
    expect(defaultModels[EModelEndpoint.anthropic]).toContain('claude-fable-5-1');
  });
});
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

~~~
npm --prefix packages/data-provider test -- --runInBand src/config.spec.ts
~~~

Expected: the new test fails because neither exact ID is currently in the corresponding shared default array.

- [ ] **Step 3: Add both IDs to the shared defaults**

Add gpt-6-astra at the start of sharedOpenAIModels and claude-fable-5-1 immediately before claude-fable-5 in sharedAnthropicModels:

~~~
const sharedOpenAIModels = [
  'gpt-6-astra',
  'gpt-5.6',
  // existing entries remain unchanged
];

const sharedAnthropicModels = [
  'claude-fable-5-1',
  'claude-fable-5',
  // existing entries remain unchanged
];
~~~

- [ ] **Step 4: Run the focused test and verify it passes**

Run the command from Step 2. Expected: the focused data-provider suite passes.

- [ ] **Step 5: Commit the shared-default change**

~~~
git add packages/data-provider/src/config.ts packages/data-provider/src/config.spec.ts
git commit -m "feat: include Astra and Fable models in defaults"
~~~

### Task 3: Cover and implement exact Anthropic token matching

**Files:**
- Modify: packages/api/src/utils/tokens.spec.ts
- Modify: packages/api/src/utils/tokens.ts

- [ ] **Step 1: Write the failing token regression test**

Add this test after the existing GPT-5.6 tier tests:

~~~
describe('Claude Fable 5.1', () => {
  it('uses the verified Fable context and output limits', () => {
    expect(getModelMaxTokens('claude-fable-5-1', EModelEndpoint.anthropic)).toBe(1000000);
    expect(getModelMaxOutputTokens('claude-fable-5-1', EModelEndpoint.anthropic)).toBe(128000);
  });
});
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

~~~
npm --prefix packages/api test -- --runInBand src/utils/tokens.spec.ts
~~~

Expected: the new test fails because the exact claude-fable-5-1 key is not present in the Anthropic context/output maps.

- [ ] **Step 3: Add the verified Fable 5.1 map entries**

Add the exact key beside claude-fable-5 in both maps. Do not add a GPT-6 Astra capacity entry because the provider has not supplied a verified context or output limit:

~~~
const anthropicModels = {
  // existing entries remain unchanged
  'claude-fable-5': 1000000,
  'claude-fable-5-1': 1000000,
  'claude-mythos-5': 1000000,
};

const anthropicMaxOutputs = {
  // existing entries remain unchanged
  'claude-fable-5': 128000,
  'claude-fable-5-1': 128000,
  'claude-mythos-5': 128000,
};
~~~

- [ ] **Step 4: Run the focused test and verify it passes**

Run the command from Step 2. Expected: the token suite passes, including existing vendor-prefix and Claude-family matching cases.

- [ ] **Step 5: Commit the token-map change**

~~~
git add packages/api/src/utils/tokens.ts packages/api/src/utils/tokens.spec.ts
git commit -m "feat: configure Claude Fable 5.1 token limits"
~~~

### Task 4: Update the curated deployment configuration

**Files:**
- Modify: librechat.yaml:60-66
- Modify: .env.aittco.example:20-23

- [ ] **Step 1: Add GPT-6 Astra to the existing custom OpenAI list**

In the custom endpoint named OpenAI, add the exact ID to models.default while preserving fetch: false and the existing gateway URL:

~~~
      models:
        default:
          - gpt-6-astra
          - gpt-5.6-sol
          - gpt-5.6-terra
          - gpt-5.5
          - gpt-5.4
        fetch: false
~~~

- [ ] **Step 2: Add Claude Fable 5.1 to the tracked dotenv example**

Replace the example Anthropic allowlist with:

~~~
ANTHROPIC_MODELS=claude-opus-5,claude-sonnet-5,claude-opus-4-8,claude-fable-5-1
~~~

Keep ANTHROPIC_REVERSE_PROXY=https://api.aittco.com unchanged.

- [ ] **Step 3: Validate the tracked configuration values**

Run:

~~~
$yaml = Get-Content -Raw librechat.yaml
$envExample = Get-Content -Raw .env.aittco.example
if ($yaml -notmatch '(?m)^\s*- gpt-6-astra\s*$') { throw 'gpt-6-astra missing from librechat.yaml' }
if ($envExample -notmatch '(?m)^ANTHROPIC_MODELS=.*claude-fable-5-1') { throw 'claude-fable-5-1 missing from .env.aittco.example' }
if ($yaml -notmatch 'baseURL:\s*https://api\.aittco\.com/v1') { throw 'OpenAI gateway URL changed unexpectedly' }
if ($envExample -notmatch 'ANTHROPIC_REVERSE_PROXY=https://api\.aittco\.com') { throw 'Anthropic proxy URL changed unexpectedly' }
~~~

Expected: the command exits with code 0 and prints no error.

- [ ] **Step 4: Commit the curated deployment configuration**

~~~
git add librechat.yaml .env.aittco.example
git commit -m "feat: expose Astra and Fable models in deployment config"
~~~

### Task 5: Run focused verification and prepare the production update

**Files:**
- No additional source files; inspect all changes from Tasks 1-4.

- [ ] **Step 1: Validate YAML syntax and the final diff**

Run:

~~~
node -e "const fs=require('fs'),yaml=require('js-yaml'); const c=yaml.load(fs.readFileSync('librechat.yaml','utf8')); if(c.endpoints.custom[0].models.default.indexOf('gpt-6-astra')<0) throw new Error('missing gpt-6-astra'); console.log('librechat.yaml: valid')"
git diff HEAD~4..HEAD --check
git status --short --branch
~~~

Expected: YAML validation prints librechat.yaml: valid, git diff --check exits 0, and only the pre-existing untracked workspace directories remain outside the four feature commits.

- [ ] **Step 2: Run all focused suites together**

Run:

~~~
npm --prefix client test -- --runInBand src/components/Chat/Menus/Endpoints/__tests__/utils.test.ts
npm --prefix packages/data-provider test -- --runInBand src/config.spec.ts
npm --prefix packages/api test -- --runInBand src/utils/tokens.spec.ts
~~~

Expected: all three Jest commands exit 0 with zero failed tests.

- [ ] **Step 3: Verify the new IDs and interfaces in source**

Run:

~~~
rg -n "gpt-6-astra|claude-fable-5-1|api\.aittco\.com/v1|ANTHROPIC_REVERSE_PROXY" librechat.yaml .env.aittco.example packages/data-provider/src/config.ts packages/api/src/utils/tokens.ts client/src/components/Chat/Menus/Endpoints/catalog.ts
~~~

Expected: gpt-6-astra appears in the custom OpenAI list; claude-fable-5-1 appears in the Anthropic allowlist, defaults, token maps, and catalog; existing gateway URLs are unchanged.

- [ ] **Step 4: Provide the production .env update command**

The runtime .env is ignored and must not be committed. After pulling the feature commits on the server, update only the Anthropic allowlist and restart the API service:

~~~
cd /opt/chatnew-lib
git pull --ff-only origin main
sed -i 's/^ANTHROPIC_MODELS=.*/ANTHROPIC_MODELS=claude-opus-5,claude-sonnet-5,claude-opus-4-8,claude-fable-5-1/' .env
docker compose -f deploy-compose.yml config --quiet
docker compose -f deploy-compose.yml build --pull api
docker compose -f deploy-compose.yml up -d api
docker compose -f deploy-compose.yml ps
curl -I http://127.0.0.1:3080
~~~

The existing system Nginx remains in place; do not start the conflicting Docker client service on this host.

- [ ] **Step 5: Commit only source corrections required by verification**

If a focused test or config check requires a source correction, update the relevant task files, rerun the affected command, and commit with a narrowly scoped message. Do not commit .env, credentials, or unrelated untracked directories.
