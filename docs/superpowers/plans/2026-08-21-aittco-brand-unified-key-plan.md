# AittcoChat Brand and Shared Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user-facing LibreChat branding with AittcoChat and enforce one encrypted, permanent per-user Aittco API key across the configured Google, Anthropic, OpenAI, and xAI models.

**Architecture:** Store the shared key under the dedicated `aittco_shared` name in the existing encrypted `Key` collection. A shared-key resolver maps the four configured provider families to that record at every endpoint initialization and model-list fetch boundary. The authenticated client uses a `/setup-key` route guard and a single settings form, while the existing provider-key storage remains available only for unrelated legacy integrations.

**Tech Stack:** React/TypeScript, React Router, React Query, Express route wrappers, `packages/api` TypeScript endpoint initializers, MongoDB/Mongoose key methods, Jest, Vite/PWA assets, LibreChat YAML and dotenv configuration.

---

### Task 1: Add the shared-key contract

**Files:**
- Create: `packages/data-provider/src/aittco.ts`
- Modify: `packages/data-provider/src/index.ts`
- Test: `packages/data-provider/src/aittco.spec.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import {
  AITTCO_SHARED_KEY_NAME,
  usesAittcoSharedKey,
} from './aittco';

describe('Aittco shared key contract', () => {
  it('uses the dedicated key name', () => {
    expect(AITTCO_SHARED_KEY_NAME).toBe('aittco_shared');
  });

  it.each(['google', 'anthropic', 'openAI', 'OpenAI', 'xAI'])(
    'maps configured endpoint %s to the shared key',
    (endpoint) => {
      expect(usesAittcoSharedKey(endpoint)).toBe(true);
    },
  );

  it('does not map unrelated provider names', () => {
    expect(usesAittcoSharedKey('bedrock')).toBe(false);
    expect(usesAittcoSharedKey('custom-other')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the contract is missing**

Run: `cd packages/data-provider && npx jest src/aittco.spec.ts --runInBand`

Expected: FAIL with a module/export-not-found error for `./aittco`.

- [ ] **Step 3: Implement the minimal shared-key contract**

```ts
import { EModelEndpoint } from './schemas';

export const AITTCO_SHARED_KEY_NAME = 'aittco_shared';

const AITTCO_CUSTOM_ENDPOINTS = new Set(['OpenAI', 'xAI']);

export function usesAittcoSharedKey(endpoint: string): boolean {
  return (
    endpoint === EModelEndpoint.google ||
    endpoint === EModelEndpoint.anthropic ||
    endpoint === EModelEndpoint.openAI ||
    AITTCO_CUSTOM_ENDPOINTS.has(endpoint)
  );
}
```

Export the constant and predicate from the package index so both the client and `packages/api` consume one source of truth.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd packages/data-provider && npx jest src/aittco.spec.ts --runInBand`

Expected: PASS with all contract cases green.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/data-provider/src/aittco.ts packages/data-provider/src/index.ts packages/data-provider/src/aittco.spec.ts
git commit -m "feat: define Aittco shared key contract"
```

### Task 2: Resolve the shared key in backend endpoint initialization

**Files:**
- Create: `packages/api/src/auth/sharedKey.ts`
- Test: `packages/api/src/auth/sharedKey.spec.ts`
- Modify: `packages/api/src/endpoints/config/models.ts`
- Modify: `packages/api/src/endpoints/google/initialize.ts`
- Modify: `packages/api/src/endpoints/anthropic/initialize.ts`
- Modify: `packages/api/src/endpoints/openai/initialize.ts`
- Modify: `packages/api/src/endpoints/custom/initialize.ts`
- Tests: the corresponding `initialize.spec.ts` and `config/models.spec.ts` files

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { AITTCO_SHARED_KEY_NAME, getAittcoKeyName } from './sharedKey';

describe('getAittcoKeyName', () => {
  it('returns the shared key name for native and configured custom endpoints', () => {
    expect(getAittcoKeyName('google')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('anthropic')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('openAI')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('OpenAI')).toBe(AITTCO_SHARED_KEY_NAME);
    expect(getAittcoKeyName('xAI')).toBe(AITTCO_SHARED_KEY_NAME);
  });

  it('preserves unrelated endpoint names', () => {
    expect(getAittcoKeyName('bedrock')).toBe('bedrock');
  });
});
```

- [ ] **Step 2: Run the resolver test and verify the expected failure**

Run: `cd packages/api && npx jest src/auth/sharedKey.spec.ts --runInBand`

Expected: FAIL because `sharedKey.ts` and `getAittcoKeyName` do not exist.

- [ ] **Step 3: Implement and use the resolver**

Implement `getAittcoKeyName(endpoint)` as a thin wrapper around the shared package predicate. Use the resolved name in every user-key read:

```ts
const keyName = getAittcoKeyName(endpoint);
userKey = await db.getUserKey({ userId: req.user?.id ?? '', name: keyName });
```

Apply the same mapping to plain-key reads in Google and Anthropic, JSON `{ apiKey, baseURL }` reads in OpenAI and custom initialization, and each custom endpoint lookup in `packages/api/src/endpoints/config/models.ts`. Preserve the configured AITTCO base URLs and native request formats. Keep Azure, Bedrock, Assistants, and unrelated custom endpoints on their existing key names.

- [ ] **Step 4: Add regression assertions at each endpoint boundary**

For Google, Anthropic, OpenAI, custom OpenAI, and custom xAI tests, inject a mock `db` and assert it receives `{ name: 'aittco_shared' }`. Add a model-config test with both `OpenAI` and `xAI` entries and assert both model fetches use the same shared-key record. Add a missing-key case asserting the existing `NO_USER_KEY` path is returned and `user_provided` is never passed as a real credential.

- [ ] **Step 5: Run all focused backend tests**

Run: `cd packages/api && npx jest src/auth/sharedKey.spec.ts src/endpoints/google/initialize.spec.ts src/endpoints/anthropic/initialize.spec.ts src/endpoints/openai/initialize.spec.ts src/endpoints/custom/initialize.spec.ts src/endpoints/config/models.spec.ts --runInBand`

Expected: PASS with no endpoint test using a provider-specific Aittco key name.

- [ ] **Step 6: Commit backend key resolution**

```bash
git add packages/api/src/auth packages/api/src/endpoints
git commit -m "feat: resolve configured models from shared Aittco key"
```

### Task 3: Harden the key API for the shared-key lifecycle

**Files:**
- Modify: `api/server/routes/keys.js`
- Test: `api/server/routes/__tests__/keys.spec.js`
- Modify: `packages/data-schemas/src/methods/key.ts`
- Test: `packages/data-schemas/src/methods/key.spec.ts` (or the existing key-method test file)

- [ ] **Step 1: Add failing route and method tests**

Cover these behaviors:

```js
it('rejects an empty shared key', async () => {
  await request(app)
    .put('/api/keys')
    .send({ name: 'aittco_shared', value: '   ', expiresAt: '' })
    .expect(400);
});

it('forces the shared key to be permanent', async () => {
  await request(app)
    .put('/api/keys')
    .send({ name: 'aittco_shared', value: 'gateway-key', expiresAt: '2030-01-01T00:00:00.000Z' })
    .expect(201);
  expect(updateUserKey).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'aittco_shared', value: 'gateway-key', expiresAt: null }),
  );
});
```

Also test that deleting `aittco_shared` only deletes the authenticated user’s record and that generic legacy names remain supported for unrelated integrations.

- [ ] **Step 2: Run the tests and verify they fail for current empty/expiry behavior**

Run: `cd api && npx jest server/routes/__tests__/keys.spec.js --runInBand`

Expected: FAIL because the route currently forwards blank values and caller-supplied expiration unchanged.

- [ ] **Step 3: Implement validation and permanent shared-key handling**

Trim the incoming value before storage. Return HTTP 400 for an empty trimmed value. When `name === AITTCO_SHARED_KEY_NAME`, ignore any supplied expiration and pass `expiresAt: null` to the existing encrypted key method. Keep the existing generic route behavior for non-shared key names.

- [ ] **Step 4: Run route and key-method tests**

Run: `cd api && npx jest server/routes/__tests__/keys.spec.js --runInBand`; then run the data-schemas key-method test command used by the workspace.

Expected: PASS, including encryption, permanent expiry, deletion, and user isolation assertions.

- [ ] **Step 5: Commit the lifecycle guard**

```bash
git add api/server/routes/keys.js api/server/routes/__tests__/keys.spec.js packages/data-schemas/src/methods/key.ts packages/data-schemas/src/methods/key.spec.ts
git commit -m "feat: enforce permanent Aittco shared key lifecycle"
```

### Task 4: Add client data-provider hooks for the shared key

**Files:**
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/react-query/react-query-service.ts`
- Modify: `packages/data-provider/src/keys.ts`
- Modify: `packages/data-provider/src/types.ts`
- Modify: `client/src/data-provider/index.ts`
- Create: `client/src/hooks/Input/useAittcoKey.ts`
- Test: `client/src/hooks/Input/__tests__/useAittcoKey.spec.tsx`

- [ ] **Step 1: Write the failing hook test**

Render the hook with a React Query test provider and verify that it queries `aittco_shared`, exposes `hasKey === false` for `{ expiresAt: null }`, and invalidates the same query after a successful save.

- [ ] **Step 2: Run the hook test and verify the expected failure**

Run: `cd client && npx jest src/hooks/Input/__tests__/useAittcoKey.spec.tsx --runInBand`

Expected: FAIL because the shared hook and query key do not exist.

- [ ] **Step 3: Implement the hook and mutation wiring**

Use the existing `/api/keys?name=...`, `PUT /api/keys`, and `DELETE /api/keys/:name` contracts with the shared constant. Add a dedicated React Query key (for example `[QueryKeys.aittcoSharedKey]`) instead of overloading endpoint-specific cache entries. Expose `hasKey`, `isLoading`, `saveKey`, and `revokeKey`; `saveKey` always sends `expiresAt: ''`.

- [ ] **Step 4: Run the hook test and verify it passes**

Run: `cd client && npx jest src/hooks/Input/__tests__/useAittcoKey.spec.tsx --runInBand`

Expected: PASS with save/revoke invalidating the shared-key query.

- [ ] **Step 5: Commit data-provider support**

```bash
git add packages/data-provider/src client/src/data-provider/index.ts client/src/hooks/Input/useAittcoKey.ts client/src/hooks/Input/__tests__/useAittcoKey.spec.tsx
git commit -m "feat: add client hooks for Aittco shared key"
```

### Task 5: Implement the authenticated setup page and route guard

**Files:**
- Create: `client/src/components/Auth/AittcoKeySetup.tsx`
- Create: `client/src/routes/AittcoKeyGate.tsx`
- Modify: `client/src/routes/index.tsx`
- Modify: `client/src/components/Auth/index.ts`
- Test: `client/src/components/Auth/__tests__/AittcoKeySetup.spec.tsx`
- Test: `client/src/routes/__tests__/AittcoKeyGate.spec.tsx`

- [ ] **Step 1: Write failing page and guard tests**

Test that the setup page renders one password/text key input and a save action, rejects whitespace-only input without calling the mutation, and navigates to `/c/new` after a successful save. Test the gate so a loading query renders no chat outlet, a missing key navigates to `/setup-key`, and an existing key renders the outlet.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `cd client && npx jest src/components/Auth/__tests__/AittcoKeySetup.spec.tsx src/routes/__tests__/AittcoKeyGate.spec.tsx --runInBand`

Expected: FAIL because the page, gate, and route entries are missing.

- [ ] **Step 3: Implement the dedicated page**

Use the shared `AuthLayout` styling primitives and the Aittco logo. The form submits `value.trim()`, shows a localized required-field error for empty input, calls `saveKey(value)`, and navigates to `/c/new` only after the mutation succeeds. Do not render or log the raw key after submit.

- [ ] **Step 4: Implement route placement and guard**

Add an authenticated `/setup-key` route outside the `Root` chat outlet. Wrap the existing Root route with `AittcoKeyGate`; preserve share, OAuth, login, registration, password-reset, and verification routes. The gate must use `replace: true` when navigating to setup-key and must not redirect while the key query is loading.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run: `cd client && npx jest src/components/Auth/__tests__/AittcoKeySetup.spec.tsx src/routes/__tests__/AittcoKeyGate.spec.tsx --runInBand`

Expected: PASS for loading, missing-key, present-key, validation, and save navigation states.

- [ ] **Step 6: Commit the onboarding flow**

```bash
git add client/src/components/Auth client/src/routes
git commit -m "feat: require Aittco key setup before chat"
```

### Task 6: Remove per-model key prompts from the configured Aittco experience

**Files:**
- Create or modify: `client/src/components/Nav/SettingsTabs/AittcoKey/`
- Modify: `client/src/components/Nav/Settings/registry.tsx`
- Modify: `client/src/components/Nav/Settings/context.tsx`
- Modify: `client/src/hooks/Input/useRequiresKey.ts`
- Modify: `client/src/hooks/Endpoint/useEndpoints.ts`
- Modify: `client/src/components/Chat/Menus/Endpoints/components/EndpointItem.tsx`
- Modify: `client/src/components/Chat/Menus/Endpoints/DialogManager.tsx`
- Tests: the affected settings, endpoint-item, and `useRequiresKey` tests

- [ ] **Step 1: Write failing UI behavior tests**

Assert that the settings registry exposes one Aittco key management entry rather than one row per user-provided provider; endpoint rows do not render provider-specific gear buttons for Google, Anthropic, OpenAI, or xAI; and `useRequiresKey` reports the shared-key state for any configured Aittco endpoint.

- [ ] **Step 2: Run the tests and verify the current per-provider behavior fails the new assertions**

Run the affected client Jest files with `--runInBand`.

Expected: FAIL because the current registry lists provider rows and endpoint rows open `SetKeyDialog` per endpoint.

- [ ] **Step 3: Implement the single-key settings surface**

Create an Aittco settings component that displays configured/not-configured status, supports replacement, and supports deletion. Reuse the same mutation and validation code as the setup page. Keep unrelated agent API keys and legacy integrations intact.

Change `useRequiresKey` to read the shared-key query instead of `useUserKey(endpoint)`. Change `useEndpoints`/`EndpointItem` so the four configured Aittco endpoints are not marked as independently configurable and no longer open `SetKeyDialog`. Leave non-Aittco endpoint behavior unchanged.

- [ ] **Step 4: Run UI tests and verify they pass**

Run: `cd client && npx jest src/components/Nav/Settings src/components/Chat/Menus/Endpoints src/hooks/Input --runInBand`

Expected: PASS, with one shared settings entry and no per-model Aittco key controls.

- [ ] **Step 5: Commit the UI consolidation**

```bash
git add client/src/components/Nav client/src/components/Chat/Menus/Endpoints client/src/hooks/Input client/src/hooks/Endpoint
git commit -m "feat: replace provider key prompts with one Aittco key"
```

### Task 7: Apply the AittcoChat brand and supplied logo

**Files:**
- Create: `client/public/assets/aittco-logo.png` from `C:\Users\LEEAIG~1\AppData\Local\Temp\codex-clipboard-8257110d-7a72-4afb-9b31-d2c06ab3b394.png`
- Modify: `client/index.html`
- Modify: `client/src/components/Auth/AuthLayout.tsx`
- Modify: `client/src/routes/Layouts/Startup.tsx`
- Modify: `client/src/utils/documentTitle.ts`
- Modify: `client/vite.config.ts`
- Modify: `.env.aittco.example`
- Modify: `.env.example`
- Test: title, AuthLayout, manifest, and config route tests

- [ ] **Step 1: Add failing branding assertions**

Assert that the startup fallback title and document-title utility return `AittcoChat`, AuthLayout references `/assets/aittco-logo.png`, the Vite manifest uses `AittcoChat`, and the AITTCO env example contains `APP_TITLE=AittcoChat` and `HELP_AND_FAQ_URL=https://chatvip.aittco.com`.

- [ ] **Step 2: Run the branding tests and verify current LibreChat defaults fail**

Run the focused client and API config tests.

Expected: FAIL on the current title, logo, manifest, and env defaults.

- [ ] **Step 3: Copy the supplied raster logo and update brand defaults**

Copy the supplied image to `client/public/assets/aittco-logo.png`. Use this image for the login/startup logo and the PWA icon source. Set `APP_TITLE`, startup fallbacks, HTML title/description, and manifest name to `AittcoChat`. Set the AITTCO environment examples to use the Aittco FAQ URL. Keep the deployment `.env` secret placeholders unchanged.

- [ ] **Step 4: Run branding tests and build the client**

Run the focused tests, then `npm run build` from the repository root.

Expected: PASS and a production build containing the supplied image without missing asset warnings.

- [ ] **Step 5: Commit branding changes**

```bash
git add client/public/assets/aittco-logo.png client/index.html client/src/components/Auth/AuthLayout.tsx client/src/routes/Layouts/Startup.tsx client/src/utils/documentTitle.ts client/vite.config.ts .env.aittco.example .env.example
git commit -m "feat: apply AittcoChat branding and logo"
```

### Task 8: Replace user-visible LibreChat copy and external links

**Files:**
- Modify: `client/src/components/Chat/Footer.tsx`
- Modify: `client/src/components/Nav/SettingsTabs/About/About.tsx`
- Modify: `client/src/components/Agents/Marketplace.tsx`
- Modify: `api/server/routes/config.js`
- Modify: `librechat.yaml`
- Modify: English localization entries in `client/src/locales/en/translation.json` when they are user-visible brand/help strings
- Tests: affected component and config route tests

- [ ] **Step 1: Inventory visible occurrences before editing**

Run:

```bash
rg -n --glob '!node_modules' --glob '!*.map' "LibreChat|https://(www\.)?librechat\.ai" client/src api/server librechat.yaml
```

Classify each match as user-visible or internal. Do not alter protocol headers, package names, database identifiers, comments, test fixtures that assert internal compatibility, or third-party image names.

- [ ] **Step 2: Add failing visible-brand regression assertions**

Assert that the default footer contains `AittcoChat` and `https://chatvip.aittco.com`, About diagnostics say `AittcoChat version`, the marketplace title uses `AittcoChat`, and startup config defaults expose the Aittco help URL.

- [ ] **Step 3: Implement the scoped copy/link replacement**

Set `customFooter` and help links in the AITTCO configuration, update source fallbacks so an unset environment cannot reintroduce LibreChat in the UI, and replace visible privacy/terms/welcome text in `librechat.yaml` with AittcoChat wording and the new host. Preserve URL paths when changing the host.

- [ ] **Step 4: Run regression tests and a residual search**

Run affected Jest tests and rerun the inventory command. Expected remaining `LibreChat` matches are internal identifiers, comments, upstream package metadata, or tests explicitly protecting those identifiers; no user-visible rendered text or `librechat.ai` href should remain.

- [ ] **Step 5: Commit copy and links**

```bash
git add client/src/components/Chat/Footer.tsx client/src/components/Nav/SettingsTabs/About/About.tsx client/src/components/Agents/Marketplace.tsx api/server/routes/config.js librechat.yaml client/src/locales/en/translation.json
git commit -m "feat: replace visible LibreChat branding and links"
```

### Task 9: Full verification and deployment handoff

**Files:**
- Modify: `AITTCO-DEPLOYMENT.md` with the final server update commands and shared-key behavior
- Test artifacts: no new production files

- [ ] **Step 1: Run all focused tests from Tasks 1-8**

Run the exact workspace commands from each task and record the pass counts. Fix failures before proceeding; do not weaken assertions.

- [ ] **Step 2: Run type checks, lint, and production build**

Run:

```bash
npm run build:data-provider
npm run build
```

Run the repository’s configured lint/typecheck commands if they are separate scripts in `package.json`. Expected: exit code 0 with no TypeScript or ESLint errors.

- [ ] **Step 3: Perform a browser smoke test**

Start the local stack and verify: registration/login -> `/setup-key` -> save non-empty key -> `/c/new`; refresh retains access; replacing/deleting the key returns to setup; each configured provider sends a request through `api.aittco.com`; the browser title and login logo show AittcoChat.

- [ ] **Step 4: Verify the existing-user rule**

Create a test user with only legacy endpoint key records, log in after the change, and verify the user still reaches `/setup-key`; no legacy key is copied into `aittco_shared`.

- [ ] **Step 5: Update deployment documentation**

Document the server commands for `/opt/chatnew-lib`: pull the merged branch, preserve `.env`, set `APP_TITLE=AittcoChat`, `HELP_AND_FAQ_URL=https://chatvip.aittco.com`, keep persistent JWT secrets, recreate only the API/client services as needed, and avoid `docker compose down -v`.

- [ ] **Step 6: Commit documentation and finish verification**

```bash
git add AITTCO-DEPLOYMENT.md
git commit -m "docs: document AittcoChat deployment update"
git status --short
```

Expected: all required changes are committed; only the intentionally ignored local preview directory remains outside the commit.

