# 独立生图页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 LibreChat 中交付一个通过 AITTCO 用户密钥生成和编辑图片的独立页面，支持三个模型、8 种画幅、最多 5 张参考图，以及 1–4 次并行单图调用。

**Architecture:** 新后端 TypeScript 服务负责白名单、输入校验、Gemini/OpenAI 协议适配和并行任务聚合；`/api` 仅提供薄路由。前端新增独立路由和页面，使用共享主题组件，结果与元数据分别保存到 IndexedDB/localStorage。

**Tech Stack:** React + React Router + TypeScript、LibreChat `packages/api`、`packages/data-provider`、Express 薄路由、Jest、浏览器 IndexedDB。

---

### Task 1: 建立共享图片生成契约与常量

**Files:**
- Create: `packages/data-provider/src/images/types.ts`
- Create: `packages/data-provider/src/images/constants.ts`
- Modify: `packages/data-provider/src/index.ts`
- Test: `packages/data-provider/src/images/types.spec.ts`

- [ ] **Step 1: Write the failing test**

  覆盖三个模型白名单、8 种画幅、分辨率、数量 1–4 和最多 5 张参考图的类型/常量约束。

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test --workspace packages/data-provider -- images/types.spec.ts`
  Expected: FAIL because the image-generation types and constants do not exist.

- [ ] **Step 3: Write minimal implementation**

  定义 `ImageGenerationRequest`、`ImageGenerationResponse`、`ImageResult`、`ReferenceImage`、`ImageModel`、`ImageAspectRatio` 和 `ImageResolution`；导出 `IMAGE_MODELS`、`IMAGE_ASPECT_RATIOS`、`IMAGE_RESOLUTIONS`、`MAX_REFERENCE_IMAGES=5`、`MAX_IMAGE_COUNT=4`。

- [ ] **Step 4: Run test to verify it passes**

  Run: `npm test --workspace packages/data-provider -- images/types.spec.ts`
  Expected: PASS。

- [ ] **Step 5: Commit**

  `git add packages/data-provider/src/images packages/data-provider/src/index.ts && git commit -m "feat: add image generation contracts"`

### Task 2: 实现后端校验与 Gemini/OpenAI 适配器

**Files:**
- Create: `packages/api/src/images/validation.ts`
- Create: `packages/api/src/images/gemini.ts`
- Create: `packages/api/src/images/openai.ts`
- Create: `packages/api/src/images/service.ts`
- Test: `packages/api/src/images/validation.spec.ts`
- Test: `packages/api/src/images/adapters.spec.ts`

- [ ] **Step 1: Write failing tests**

  测试模型白名单、8 种画幅、提示词 8,000 字符、单图 10 MB、5 张参考图、数量 1–4；测试 Gemini `generateContent` 请求、OpenAI generations/edits 请求，以及 `b64_json`、URL、inlineData 等响应解析。

- [ ] **Step 2: Run tests to verify they fail**

  Run: `npm test --workspace packages/api -- images/validation.spec.ts images/adapters.spec.ts`
  Expected: FAIL because adapters and service are absent。

- [ ] **Step 3: Write minimal implementation**

  `validation.ts` 返回结构化校验错误；两个适配器只接收已解析的用户 Key、AITTCO base URL 和标准请求。Gemini 以 `parts`/`inlineData` 传最多 5 张图并设置 `responseModalities: ["IMAGE"]`；OpenAI 无参考图走 `/v1/images/generations`，有参考图走 `/v1/images/edits` multipart。统一输出 `ImageResult`。

- [ ] **Step 4: Implement parallel aggregation**

  `service.ts` 将数量 N 拆成 N 个 `count=1` 子请求，使用 `Promise.allSettled` 并行执行，最多 4 个；返回成功/失败计数和 requestId，不因单个失败丢弃其它结果。

- [ ] **Step 5: Run tests to verify they pass**

  Run: `npm test --workspace packages/api -- images/validation.spec.ts images/adapters.spec.ts`
  Expected: PASS。

- [ ] **Step 6: Commit**

  `git add packages/api/src/images && git commit -m "feat: add image generation adapters"`

### Task 3: 接入用户密钥并暴露 API 路由

**Files:**
- Create: `packages/api/src/images/controller.ts`
- Modify: `api/server/routes/keys.js` (仅复用现有 key 名称/读取模式，不重复存储)
- Modify: `api/server/index.js` 或现有 API 路由注册文件
- Test: `packages/api/src/images/controller.spec.ts`

- [ ] **Step 1: Write failing controller tests**

  覆盖未登录、无 AITTCO Key、非法模型、非法图片输入、成功响应、部分成功和上游 429/超时映射。

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test --workspace packages/api -- images/controller.spec.ts`
  Expected: FAIL because controller/route are absent。

- [ ] **Step 3: Implement controller and thin route**

  从现有用户密钥模型读取 `aittco_shared`，默认 base URL 为 `AITTCO_API_URL` 或 `https://api.aittco.com`；不接受客户端 baseURL 或 API Key。将 `POST /api/images/generate` 挂载到已认证 API 路由，设置请求体上限并把服务错误转为稳定错误码。

- [ ] **Step 4: Run tests and lint**

  Run: `npm test --workspace packages/api -- images/controller.spec.ts` and `npm run lint --workspace packages/api`。
  Expected: PASS and no lint errors。

- [ ] **Step 5: Commit**

  `git add packages/api/src/images api/server && git commit -m "feat: expose image generation endpoint"`

### Task 4: 创建独立页面、路由和输入交互

**Files:**
- Create: `client/src/routes/ImageGeneration.tsx`
- Create: `client/src/components/ImageGeneration/ImageGenerationPage.tsx`
- Create: `client/src/components/ImageGeneration/ImageInput.tsx`
- Create: `client/src/components/ImageGeneration/ImageResults.tsx`
- Create: `client/src/components/ImageGeneration/imageGeneration.css`（仅在共享主题无法表达布局时使用）
- Modify: `client/src/routes/index.tsx`
- Modify: `client/src/components/UnifiedSidebar/UnifiedSidebar.tsx`
- Test: `client/src/components/ImageGeneration/__tests__/ImageGenerationPage.spec.tsx`

- [ ] **Step 1: Write failing UI tests**

  测试路由渲染、三个模型、8 种画幅、1K/2K/4K、数量 1–4、最多 5 张上传、拖拽排序、超限阻止、生成中禁用和错误提示。

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test --workspace client -- ImageGenerationPage.spec.tsx`
  Expected: FAIL because page and route are absent。

- [ ] **Step 3: Implement page and route**

  复用现有按钮、选择器、卡片、主题 token 和布局组件；调用共享类型常量；支持点击/拖拽/剪贴板图片、缩略图删除和顺序调整；提交时把图片转为校验后的 data URL。

- [ ] **Step 4: Implement result actions**

  每张图提供下载、复制、删除、继续编辑；继续编辑将结果放入参考图、保留模型和参数、清空提示词。

- [ ] **Step 5: Run tests and typecheck**

  Run: `npm test --workspace client -- ImageGenerationPage.spec.tsx` and `npm run typecheck --workspace client`。
  Expected: PASS and no TypeScript errors。

- [ ] **Step 6: Commit**

  `git add client/src/routes client/src/components/ImageGeneration client/src/components/UnifiedSidebar/UnifiedSidebar.tsx && git commit -m "feat: add standalone image generation page"`

### Task 5: 增加 IndexedDB 本地历史

**Files:**
- Create: `client/src/utils/imageGenerationHistory.ts`
- Modify: `client/src/components/ImageGeneration/ImageGenerationPage.tsx`
- Test: `client/src/utils/__tests__/imageGenerationHistory.spec.ts`

- [ ] **Step 1: Write failing storage tests**

  覆盖保存 Blob 与元数据、最近 20 条读取、加载更多、删除、清空、刷新恢复和无 IndexedDB 时的可理解降级。

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test --workspace client -- imageGenerationHistory.spec.ts`
  Expected: FAIL because the storage module is absent。

- [ ] **Step 3: Implement storage module**

  IndexedDB 保存图片 Blob；localStorage 保存 id、时间、模型、提示词摘要、参数和 blob key。禁止保存 API Key；读取时生成 object URL，删除时释放 URL。

- [ ] **Step 4: Integrate history UI**

  结果成功后写入历史；页面加载恢复最近 20 条；历史卡片支持查看、继续编辑、下载、删除和清空。

- [ ] **Step 5: Run tests**

  Run: `npm test --workspace client -- imageGenerationHistory.spec.ts ImageGenerationPage.spec.tsx`
  Expected: PASS。

- [ ] **Step 6: Commit**

  `git add client/src/utils/imageGenerationHistory.ts client/src/components/ImageGeneration && git commit -m "feat: persist local image generation history"`

### Task 6: AITTCO 契约测试、文档与发布验证

**Files:**
- Modify: `LibreChat/.env.example`
- Modify: `LibreChat/AITTCO-DEPLOYMENT.md`
- Create: `packages/api/src/images/contract.spec.ts`（通过环境变量启用真实测试）

- [ ] **Step 1: 添加配置文档**

  记录 `AITTCO_API_URL`、`AITTCO_IMAGE_TIMEOUT_MS`、`AITTCO_IMAGE_MAX_INPUT_BYTES`、`AITTCO_IMAGE_MAX_REFERENCES`、`AITTCO_IMAGE_MAX_COUNT`，以及用户需在设置中配置 `aittco_shared` Key。

- [ ] **Step 2: 添加真实契约测试**

  在显式设置 `AITTCO_CONTRACT_TEST=true` 且存在测试 Key 时，分别验证三个模型的文生图、参考图编辑、8 种画幅、响应图片解析、429 和超时；默认 CI 跳过真实网络调用。

- [ ] **Step 3: Run repository verification**

  Run: `npm run build:data-provider`, `npm run typecheck`, `npm test --workspace packages/api -- images`, `npm test --workspace client -- ImageGeneration`。
  Expected: all commands pass。

- [ ] **Step 4: Commit**

  `git add .env.example AITTCO-DEPLOYMENT.md packages/api/src/images/contract.spec.ts && git commit -m "docs: document image generation deployment"`

