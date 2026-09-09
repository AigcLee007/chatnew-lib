# GPT Image 2.5 Sunburst and Flare Model Design

## Goal

Add `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` to the existing
standalone `/image-generation` page. Both models must use the same request
contract, reference-image flow, response parsing, and AITTCO authentication as
the existing `gpt-image-2` model.

This change is limited to the standalone image-generation page. It does not
change the Agent `image_gen_oai` tool, chat model menus, user-key storage, or
the image-generation API route.

## Existing baseline

The current image-generation feature has one shared model list in
`packages/data-provider/src/images/constants.ts`. The same list drives the
TypeScript `ImageModel` union, backend request validation, and the frontend
model selector.

The backend image service uses the model prefix only to choose an adapter:

- Models beginning with `gemini-` use the Gemini adapter.
- All other whitelisted image models use the OpenAI-compatible adapter.

The OpenAI adapter sends a request without references to
`/v1/images/generations`. A request with references is sent as multipart form
data to `/v1/images/edits`. The model ID is passed through unchanged, the
request uses one upstream image per call, and the service handles the page's
1-4 image count by running single-image calls in parallel.

The page obtains the AITTCO credential through the existing `aittco_shared`
user key. No credential or endpoint changes are required.

## Design

### Shared model contract

Extend `IMAGE_MODELS` to this exact ordered list:

```ts
[
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
]
```

The existing `ImageModel` union automatically includes the two new IDs. The
existing aspect-ratio, resolution, reference-image, count, and response types
remain unchanged.

### Request and routing behavior

The browser continues to call:

```http
POST /api/images/generate
```

The request body remains:

```json
{
  "model": "gpt-image-2.5-sunburst",
  "prompt": "A futuristic city at night",
  "images": [],
  "size": "16:9",
  "resolution": "2K",
  "count": 1
}
```

For either new model, the backend must produce the same upstream request shape
as it currently produces for `gpt-image-2`, with only the `model` value
different. No new adapter or model-specific branch is introduced.

The backend continues to reject models outside the shared whitelist. This
makes the shared list the single source of truth for both frontend exposure and
server-side authorization.

### Frontend display

The model selector will receive the two new options automatically from
`IMAGE_MODELS`. The generated-result model label map will add these display
names:

- `gpt-image-2.5-sunburst` -> `GPT Image 2.5 Sunburst`
- `gpt-image-2.5-flare` -> `GPT Image 2.5 Flare`

All existing controls remain unchanged: eight aspect ratios, `1K`/`2K`/`4K`,
up to five reference images, and 1-4 generated images.

### Provider prerequisite

Before production rollout, the AITTCO gateway must accept both exact model IDs
on the existing OpenAI-compatible image endpoints:

- `/v1/images/generations` for text-to-image requests.
- `/v1/images/edits` for requests with reference images.

The gateway must preserve the current bearer-key authentication and return one
of the response forms already parsed by the adapter (`b64_json`, URL, or the
existing compatible image fields).

The current OpenAI adapter accepts `resolution` in the application contract
but does not add it to the OpenAI wire payload. This design intentionally keeps
the new models byte-for-byte compatible with the existing `gpt-image-2`
request shape. The release smoke test must therefore confirm that the gateway
accepts the current wire shape. Adding a newly serialized `resolution` field is
outside this model-alias change and requires a separate contract decision.

## Files and responsibilities

### Shared contract

- Modify `packages/data-provider/src/images/constants.ts` to add the two model
  IDs.
- Modify `packages/data-provider/src/images/types.spec.ts` to assert the five
  supported models and compile a request using each new ID.

### Backend validation and adapter behavior

- Modify `packages/api/src/images/validation.spec.ts` to verify both new IDs
  pass whitelist validation and an unknown ID remains rejected.
- Modify `packages/api/src/images/adapters.spec.ts` to verify both new IDs are
  sent unchanged for generations and edits, with the existing size mapping,
  `n=1`, authorization, and multipart reference-image behavior.
- Modify `packages/api/src/images/service.spec.ts` to verify both new IDs use
  the OpenAI adapter and retain parallel count aggregation.
- Modify `packages/api/src/images/contract.spec.ts` to assert the five-model
  contract. Keep real gateway calls opt-in through the existing contract-test
  environment guard.

No production changes are required in `packages/api/src/images/service.ts`,
`packages/api/src/images/openai.ts`, `packages/api/src/images/controller.ts`,
or `api/server/routes/images.js` unless the gateway contract test proves that
the provider requires a wire-format difference.

### Frontend and documentation

- Modify `client/src/components/ImageGeneration/ImageResults.tsx` to add the
  two human-readable model labels.
- Extend the existing image-generation page test to assert both model options
  appear in the selector and that selecting each model produces the expected
  request model ID.
- Modify `AITTCO-DEPLOYMENT.md` to document five available image models.

Do not modify the Agent image-generation model setting in `.env.example`,
because that is a separate tool and is outside this feature's scope.

## Error handling

No new error codes are needed. Existing behavior applies unchanged:

- An unknown model is rejected as `IMAGE_INVALID_REQUEST`.
- A gateway 401 maps to `IMAGE_INVALID_API_KEY`.
- A gateway 403 maps to `IMAGE_MODEL_OR_CONTENT_REJECTED`.
- A gateway 429 maps to `IMAGE_RATE_LIMITED`.
- Other upstream failures map to `IMAGE_UPSTREAM_ERROR`.
- A count greater than one continues to allow partial results when some
  parallel single-image calls succeed.

If the gateway does not recognize either new model, the request must fail with
the existing stable upstream error response rather than silently falling back
to `gpt-image-2`.

## Verification

### Focused automated tests

Run the following from `D:\chat-libre\LibreChat` after implementation:

```powershell
cd packages/data-provider
npx jest src/images/types.spec.ts --runInBand --coverage=false

cd ..\api
npx jest src/images/validation.spec.ts src/images/adapters.spec.ts src/images/service.spec.ts src/images/contract.spec.ts --runInBand --coverage=false

cd ..\..\client
npx jest src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx --runInBand --coverage=false
```

Then run the relevant package build and repository checks:

```powershell
cd D:\chat-libre\LibreChat
npm run build:data-provider
npm run build:api
npm run build:client-package
cd client
npm run build
cd ..
git diff --check
```

### Gateway smoke test

With an explicitly authorized disposable AITTCO key, test both model IDs for:

1. Text-to-image at `1:1`, `1K`, count `1`.
2. Reference-image editing at `16:9`, `2K`, count `1`.
3. Count `2` to verify the existing parallel single-image behavior.
4. A provider failure to confirm the stable existing error mapping.

The smoke test must inspect the upstream request and confirm that the model ID
is exact and that no fallback or alias substitution occurs.

## Alternatives considered

- **Recommended: extend the shared whitelist and reuse the OpenAI adapter.**
  This is the smallest change, preserves the existing API and credential
  flow, and exactly matches the stated model compatibility.
- Add a capability/configuration object for every image model. This would be
  useful if the new models had different ratios, parameters, or endpoints, but
  adds unnecessary abstraction while their contract is explicitly identical.
- Add a dynamic model-discovery endpoint. This would avoid rebuilding the
  frontend for future aliases but introduces deployment configuration, caching,
  and authorization behavior that this change does not require.

## Acceptance criteria

- The standalone page lists both exact model IDs and allows selecting them.
- Requests with either new model ID pass server validation.
- The backend sends the exact selected ID to the existing OpenAI-compatible
  image endpoint.
- Text-to-image and reference-image editing both work through the existing
  route and response parser.
- Existing models and existing image-generation behavior remain unchanged.
- Agent image-generation tools and chat model menus remain unchanged.
- Focused tests, package builds, and `git diff --check` pass.
- AITTCO gateway smoke tests succeed for both new model IDs.
