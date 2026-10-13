# Gemini 4 Argon Implementation Plan

**Goal:** Expose `gemini-4-argon` through the existing Gemini catalog and native Google endpoint with the documented context window.

**Architecture:** Extend the shared model list and deployment environment allowlists. Reuse existing localized Gemini descriptions and Google client behavior. Add the explicit context mapping to prevent fallback to the legacy Gemini window.

**Tech Stack:** TypeScript, React, Jest, dotenv, npm.

- [x] Extend `packages/data-provider/src/config.spec.ts` to require Argon in Google defaults, add `client/src/components/Chat/Menus/Endpoints/__tests__/catalog.spec.ts` to check the catalog label, ID, group and search, and extend `packages/api/src/utils/tokens.spec.ts` to verify the 1,048,576-token context for native and shared endpoint aliases.
- [x] Run each test from its workspace with `npx jest --runInBand --coverage=false --runTestsByPath <test-file>` and confirm failure for the missing model metadata and context entry.
- [x] Add `'gemini-4-argon'` to `defaultModels[EModelEndpoint.google]` in `packages/data-provider/src/config.ts`, add the matching `MODEL_INFO` row to the client catalog, and add `'gemini-4-argon': 1048576` to `googleModels` in `packages/api/src/utils/tokens.ts`.
- [x] Prepend `gemini-4-argon,` to Google model lists in `.env.example`, `.env.aittco.example` and local `.env`; document the allowlist requirement in `AITTCO-DEPLOYMENT.md`.
- [x] Re-run changed suites and `src/endpoints/models.spec.ts` plus `src/endpoints/google/llm.spec.ts` in `packages/api`. Verify environment lists with dotenv parsing, run ESLint/Prettier on changed files, build data-provider, API and client, then review the final diff.

## Validation evidence

- Shared configuration: 153 tests passed.
- API context, Google configuration and model discovery: 206 tests passed.
- Focused catalog: 1 test passed, including Chinese/English descriptions and search.
- ESLint, Prettier and environment-list checks passed.
- Data-provider and API production builds passed; compiled module assertions passed.
- Read-only code review found no actionable issue.
- Initial parallel frontend build encountered native memory exhaustion; the single-process retry with a 2 GiB Node heap and two worker threads passed, including production minification, PWA generation and post-build asset copying.
