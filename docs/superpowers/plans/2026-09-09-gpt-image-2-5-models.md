# GPT Image 2.5 Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` to the standalone `/image-generation` page while preserving the existing `gpt-image-2` API, adapter, authentication, and image controls.

**Architecture:** Extend the shared `IMAGE_MODELS` tuple, which already drives the TypeScript model union, backend whitelist, and frontend selector. Keep the existing non-Gemini routing rule so both new IDs use the OpenAI-compatible generations/edits adapter; add focused regression coverage and result-card labels without introducing a new endpoint or model adapter.

**Tech Stack:** TypeScript, React, LibreChat `packages/data-provider`, `packages/api`, client Jest/Testing Library, existing AITTCO OpenAI-compatible image gateway.

---

### Task 1: Extend the shared image model contract

**Files:**
- Modify: `packages/data-provider/src/images/constants.ts:1-5`
- Modify: `packages/data-provider/src/images/types.spec.ts:20-28`

- [ ] **Step 1: Add the failing contract assertions**

Replace the three-model expectation in `packages/data-provider/src/images/types.spec.ts` with the exact five-model list and add a type/runtime assertion for both new IDs:

```ts
expect(IMAGE_MODELS).toEqual([
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
]);

it.each(['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)(
  'accepts %s as an image request model',
  (model) => {
    const request: ImageGenerationRequest = {
      model,
      prompt: 'A rainy futuristic city',
      size: '16:9',
      resolution: '2K',
      count: 1,
    };

    expect(request.model).toBe(model);
  },
);
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
cd D:\chat-libre\LibreChat\packages\data-provider
npx jest src/images/types.spec.ts --runInBand --coverage=false
```

Expected: FAIL because `IMAGE_MODELS` still contains only the original three values and the new string literals are not yet members of `ImageModel`.

- [ ] **Step 3: Add the two model IDs to the shared constant**

Change `packages/data-provider/src/images/constants.ts` to:

```ts
export const IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
] as const;
```

Do not change `IMAGE_ASPECT_RATIOS`, `IMAGE_RESOLUTIONS`, `MAX_REFERENCE_IMAGES`, or `MAX_IMAGE_COUNT`.

- [ ] **Step 4: Run the contract test and verify it passes**

Run:

```powershell
cd D:\chat-libre\LibreChat\packages\data-provider
npx jest src/images/types.spec.ts --runInBand --coverage=false
```

Expected: PASS with the existing aspect-ratio, resolution, reference-image, and count assertions unchanged.

- [ ] **Step 5: Commit the shared contract change**

```powershell
cd D:\chat-libre\LibreChat
git add packages/data-provider/src/images/constants.ts packages/data-provider/src/images/types.spec.ts
git commit -m "feat: add gpt image 2.5 models"
```

### Task 2: Add backend validation and OpenAI routing regression coverage

**Files:**
- Modify: `packages/api/src/images/validation.spec.ts:3-13,15-27`
- Modify: `packages/api/src/images/adapters.spec.ts:40-78`
- Modify: `packages/api/src/images/service.spec.ts:42-69`
- Modify: `packages/api/src/images/contract.spec.ts:13-17`

- [ ] **Step 1: Parameterize whitelist and adapter tests for all OpenAI image IDs**

In `validation.spec.ts`, add this test after the existing valid-request test:

```ts
it.each(['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)(
  'accepts supported OpenAI image model %s',
  (model) => {
    expect(validateImageGenerationRequest({ ...valid(), model })).toEqual({
      valid: true,
      errors: [],
    });
  },
);
```

In `adapters.spec.ts`, change the existing OpenAI generation/edit test into a parameterized test over the same three IDs. Use the loop value in every request and assertion, while preserving these expectations:

```ts
it.each(['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)(
  'sends %s unchanged for generations and edits',
  async (model) => {
    const abortController = new AbortController();
    mockedAxios.post.mockResolvedValue({ data: { id: 'o-1', data: [{ b64_json: 'abc' }] } });

    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      { model, prompt: 'cat', size: '1:1', resolution: '1K', count: 1 },
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/v1/images/generations'),
      expect.objectContaining({ model, n: 1, size: '1024x1024' }),
      expect.objectContaining({ signal: abortController.signal }),
    );

    mockedAxios.post.mockResolvedValue({ data: { id: 'o-2', data: [{ url: 'https://img' }] } });
    await generateWithOpenAI(
      { apiKey: 'key', baseUrl: 'https://api.example.com', signal: abortController.signal },
      {
        model,
        prompt: 'edit',
        images: [{ data: 'abc', mimeType: 'image/png' }],
        size: '1:1',
        resolution: '1K',
        count: 1,
      },
    );

    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      expect.stringContaining('/v1/images/edits'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
        signal: abortController.signal,
      }),
    );
  },
);
```

In `service.spec.ts`, parameterize the existing OpenAI dispatch assertion:

```ts
it.each(['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)(
  'dispatches %s to the OpenAI adapter',
  async (model) => {
    mockedOpenAI.mockResolvedValue({
      images: [{ data: 'a', mimeType: 'image/png', index: 0 }],
      requestedCount: 1,
      successCount: 1,
      failedCount: 0,
      model,
      requestId: 'o1',
    });

    const result = await generateImages(
      { apiKey: 'k', baseUrl: 'https://example.com' },
      { ...request, model },
    );

    expect(mockedOpenAI).toHaveBeenCalledTimes(3);
    expect(mockedGemini).not.toHaveBeenCalled();
    expect(result.successCount).toBe(3);
  },
);
```

In `contract.spec.ts`, change `expect(IMAGE_MODELS).toHaveLength(3)` to `expect(IMAGE_MODELS).toHaveLength(5)` and assert the two exact IDs are included:

```ts
expect(IMAGE_MODELS).toEqual([
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
]);
```

- [ ] **Step 2: Run the backend image tests**

Run:

```powershell
cd D:\chat-libre\LibreChat\packages\api
npx jest src/images/validation.spec.ts src/images/adapters.spec.ts src/images/service.spec.ts src/images/contract.spec.ts --runInBand --coverage=false
```

Expected: PASS. The backend production files should require no changes because validation reads the shared tuple and service routing already sends every non-Gemini model to the OpenAI adapter.

- [ ] **Step 3: Verify no model-specific backend branch was introduced**

Run:

```powershell
cd D:\chat-libre\LibreChat
rg -n "gpt-image-2\.5|IMAGE_MODELS|startsWith\('gemini-'\)" packages/api/src/images packages/data-provider/src/images
```

Expected: the new IDs appear in shared constants and tests only; `service.ts` still contains the single existing `startsWith('gemini-')` routing rule, and `openai.ts` has no new model-specific condition.

- [ ] **Step 4: Commit backend regression coverage**

```powershell
cd D:\chat-libre\LibreChat
git add packages/api/src/images/validation.spec.ts packages/api/src/images/adapters.spec.ts packages/api/src/images/service.spec.ts packages/api/src/images/contract.spec.ts
git commit -m "test: cover gpt image 2.5 routing"
```

### Task 3: Add frontend labels and selector/request coverage

**Files:**
- Modify: `client/src/components/ImageGeneration/ImageResults.tsx:13-17`
- Modify: `client/src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx:94-178`

- [ ] **Step 1: Add failing frontend assertions**

Update the existing control-count assertion from `3 + 8 + 3 + 4` to `5 + 8 + 3 + 4`, and add exact option assertions:

```ts
expect(screen.getAllByRole('option')).toHaveLength(5 + 8 + 3 + 4);
expect(screen.getByRole('option', { name: 'gpt-image-2.5-sunburst' })).toBeInTheDocument();
expect(screen.getByRole('option', { name: 'gpt-image-2.5-flare' })).toBeInTheDocument();
```

Add this request-passthrough test after the existing submit test:

```ts
it.each(['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)(
  'submits the exact selected model ID %s',
  async (model) => {
    const user = userEvent.setup();
    const fetchSpy = jest.fn().mockImplementation(() => createResponse(generatedResponse()));
    setFetchMock(fetchSpy);
    renderPage();

    await user.selectOptions(screen.getAllByRole('combobox')[0], model);
    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({ model });
  },
);
```

Add this parameterized result-label test after the existing model/timestamp card test:

```ts
it.each([
  ['gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst'],
  ['gpt-image-2.5-flare', 'GPT Image 2.5 Flare'],
] as const)('renders the display label for %s', async (model, label) => {
  const user = userEvent.setup();
  setFetchMock(
    jest.fn().mockImplementation(() =>
      createResponse({ ...generatedResponse(), model }),
    ),
  );
  renderPage();

  await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
  await user.click(screen.getByRole('button', { name: /^generate$/i }));

  expect(await screen.findByText(label)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused client test and verify the label assertion fails**

Run:

```powershell
cd D:\chat-libre\LibreChat\client
npx jest src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx --runInBand --coverage=false
```

Expected: the option-count and selector assertions pass from the shared model list, while the new human-readable result-label assertion fails because the two label-map entries do not exist yet.

- [ ] **Step 3: Add the two result-card display labels**

Extend `modelLabels` in `client/src/components/ImageGeneration/ImageResults.tsx`:

```ts
const modelLabels: Record<string, string> = {
  'gemini-3-pro-image-preview': 'Gemini Pro Image',
  'gemini-3.1-flash-image-preview': 'Gemini Flash Image',
  'gpt-image-2': 'GPT Image 2',
  'gpt-image-2.5-sunburst': 'GPT Image 2.5 Sunburst',
  'gpt-image-2.5-flare': 'GPT Image 2.5 Flare',
};
```

Do not change the existing controls, upload limits, history behavior, preview behavior, or API path.

- [ ] **Step 4: Run the focused client test and typecheck**

Run:

```powershell
cd D:\chat-libre\LibreChat\client
npx jest src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx --runInBand --coverage=false
npm run typecheck
```

Expected: all `ImageGenerationPage` tests pass and the client typecheck exits with code 0.

- [ ] **Step 5: Commit frontend support**

```powershell
cd D:\chat-libre\LibreChat
git add client/src/components/ImageGeneration/ImageResults.tsx client/src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx
git commit -m "feat: expose gpt image 2.5 labels"
```

### Task 4: Update deployment documentation and run provider smoke checks

**Files:**
- Modify: `AITTCO-DEPLOYMENT.md:35-42`

- [ ] **Step 1: Update the documented model list**

Change the standalone image-generation model sentence to name all five supported models:

```md
The five available models are
`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, `gpt-image-2`,
`gpt-image-2.5-sunburst`, and `gpt-image-2.5-flare`.
```

Keep the existing statements about `aittco_shared`, eight aspect ratios, three resolutions, five reference images, and 1-4 parallel single-image calls.

- [ ] **Step 2: Check the documentation diff**

Run:

```powershell
cd D:\chat-libre\LibreChat
git diff --check -- AITTCO-DEPLOYMENT.md
rg -n "five available models|gpt-image-2\.5-sunburst|gpt-image-2\.5-flare" AITTCO-DEPLOYMENT.md
```

Expected: no whitespace errors and one documented occurrence of each new model ID.

- [ ] **Step 3: Run the authenticated gateway smoke test**

Use an authorized disposable key through the existing page configuration. Set `aittco_shared` for the test user, open `/image-generation`, and execute this matrix for both new models:

| Case | Settings | Expected result |
|---|---|---|
| Text-to-image | `1:1`, `1K`, count `1`, no references | One generated image; upstream model is the exact selected ID |
| Reference edit | `16:9`, `2K`, count `1`, one PNG/JPEG/WebP reference | One edited image; request uses `/v1/images/edits` |
| Parallel count | `1:1`, `1K`, count `2` | Two successful images or a stable partial-failure response; no fallback model |
| Unsupported provider model | Disable one model at the gateway or use a controlled provider rejection | Existing stable upstream error is shown; request is not retried as `gpt-image-2` |

Capture the upstream request in the gateway test environment and verify that the only model-field difference from `gpt-image-2` is the selected model ID. Confirm that the current OpenAI wire shape is accepted; do not add a `resolution` field unless this smoke test proves the gateway requires it.

- [ ] **Step 4: Commit documentation**

```powershell
cd D:\chat-libre\LibreChat
git add AITTCO-DEPLOYMENT.md
git commit -m "docs: document gpt image 2.5 models"
```

### Task 5: Run full package verification and prepare release

**Files:**
- Verify: `packages/data-provider/src/images/constants.ts`
- Verify: `packages/api/src/images/*.spec.ts`
- Verify: `client/src/components/ImageGeneration`
- Verify: `AITTCO-DEPLOYMENT.md`

- [ ] **Step 1: Run focused data-provider, backend, and client tests**

```powershell
cd D:\chat-libre\LibreChat\packages\data-provider
npx jest src/images/types.spec.ts --runInBand --coverage=false

cd ..\api
npx jest src/images/validation.spec.ts src/images/adapters.spec.ts src/images/service.spec.ts src/images/contract.spec.ts --runInBand --coverage=false

cd ..\..\client
npx jest src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx --runInBand --coverage=false
```

Expected: all commands exit with code 0 and report no failed tests.

- [ ] **Step 2: Build all generated package artifacts and the client**

```powershell
cd D:\chat-libre\LibreChat
npm run build:data-provider
npm run build:data-schemas
npm run build:api
npm run build:client-package
cd client
npm run build
cd ..
```

Expected: each command exits with code 0; the generated data-provider and API artifacts contain the expanded model union without changing the API route.

- [ ] **Step 3: Run repository hygiene checks**

```powershell
cd D:\chat-libre\LibreChat
git diff --check
git status --short
```

Expected: `git diff --check` exits with code 0. Only the intended commits are present; pre-existing untracked `.playwright-cli/`, `.superpowers/`, and `skill/thesis-defense-coach/` entries remain untouched.

- [ ] **Step 4: Record the release operation**

For the local source deployment, rebuild and restart the API/client services after merging the commits. For the production checkout described in `AGENTS.md`, run exactly:

```bash
cd /opt/chatnew-lib
git pull --ff-only origin main
docker compose -f deploy-compose.yml config --quiet
docker compose -f deploy-compose.yml build --pull api client
docker compose -f deploy-compose.yml up -d api client
docker compose -f deploy-compose.yml ps
```

Expected: the `api` and `client` services show `Up`, use the local `api-build` and `nginx-client` build entries, and `/image-generation` exposes both new models.
