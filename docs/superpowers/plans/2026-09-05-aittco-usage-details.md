# AittcoChat New API 使用明细实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each task is deliberately small and follows test-first development.

## 目标

在右上角现有 AITTCO 额度入口中增加“使用明细”。用户打开明细后，可以看到共享 Key 最近由 New API 返回的消费记录，包括本地时间、模型、输入 Token、输出 Token 和 New API 内部扣除额度。共享 Key 只由服务端读取，浏览器只接收归一化后的非敏感字段。

## 架构与边界

- New API 请求固定为 `{AITTCO_API_URL}/api/log/token`，必要时尝试尾斜杠版本；请求头只在服务端设置 `Authorization: Bearer <decrypted shared key>`。
- 新后端逻辑放在 `packages/api/src/aittco/usage.ts`，通过依赖注入测试上游 HTTP；`api/server/routes/keys.js` 只创建 controller、挂载 JWT 路由并清理缓存。
- 后端只保留 `type=2` 消费日志，输出 `{ source, items, limited }`；不透传内容、IP、请求头、完整 Key 或其他上游字段，也不把 New API 的内部 quota 强行换算成美元。
- 明细按用户服务端缓存最多 60 秒，`?refresh=true` 绕过缓存；共享 Key 更新、删除或删除全部 Key 时，同时清理额度和明细缓存。
- 共享类型、endpoint、data-service 和 query key 放在 `packages/data-provider`；客户端通过 `client/src/data-provider/Misc/queries.ts` 使用 React Query。
- `QuotaSummary` 改为使用现有 query hooks、`@librechat/client` 的 Button/Dialog/Table primitive 和 `useLocalize`。所有新增可见文案只添加到 `client/src/locales/en/translation.json`。

## Task 1: 先锁定 AITTCO usage controller 契约

**Files:**

- Create: `packages/api/src/aittco/usage.spec.ts`

### Step 1: 写失败测试

创建依赖注入的 controller 测试夹具，使用假的 Express `Request`/`Response`、假的 `getUserKey` 和假的上游 `get` 函数，不访问真实 AITTCO。测试至少覆盖：

- 解析 New API `{ success: true, data: [...] }`，只保留 `type: 2`，按 `created_at` 倒序，并把 Unix 秒转换为 ISO `createdAt`；
- 归一化 `model_name`、`quota`、`prompt_tokens`、`completion_tokens`，缺失模型/quota 变为 `null`，缺失 Token 变为 `0`；
- 支持直接数组以及 `data.items`/`data.logs` 兼容包装；无法识别的主体返回稳定的空列表，不让请求崩溃；
- 响应只包含 `id`、`createdAt`、`model`、`quota`、`promptTokens`、`completionTokens`，断言序列化响应不包含 `content`、IP、Authorization 或测试 Key；
- 共享 Key 缺失、返回 `user_provided` 时返回 404 `AITTCO_USAGE_KEY_NOT_CONFIGURED`，并断言没有发起上游请求；
- 首个路径 404/405 时尝试尾斜杠；两个路径都不支持时返回 502 `UPSTREAM_USAGE_UNAVAILABLE`；401/403 映射到稳定鉴权错误，超时/网络错误映射到稳定 502 错误；
- 同一用户在 TTL 内命中缓存，`refresh=true` 绕过缓存；调用返回的 `clearCache(userId)` 后下一次请求重新读取上游。

测试夹具应通过 `now` 注入固定时间，避免依赖系统时钟；断言错误只检查稳定的 `error` code 和通用 `message`，不检查上游原始正文。

### Step 2: 运行测试确认当前失败

```powershell
cd packages/api
npm exec jest -- --runInBand src/aittco/usage.spec.ts
```

Expected: FAIL，因为 `src/aittco/usage.ts` 和导出尚不存在。若先出现 Jest 配置或测试夹具错误，先修正测试本身，再写生产实现。

### Step 3: 提交失败规格

```powershell
git add packages/api/src/aittco/usage.spec.ts
git commit -m "test: specify AITTCO usage controller"
```

## Task 2: 实现并导出 usage controller

**Files:**

- Create: `packages/api/src/aittco/usage.ts`
- Modify: `packages/api/src/index.ts`

### Step 1: 实现最小通过版本

实现 `createAittcoUsageController({ getUserKey, get?, now? })`，返回 `{ handle, clearCache }`：

- 使用显式 JSON union/type guard 解析上游响应，避免 `any` 和无边界的类型断言；支持数组、`data`、`items`、`logs` 包装；
- 将 `type` 统一按数字/字符串比较为 `2`，逐条解析时间和数值；单条异常记录跳过，合法记录继续返回；
- 仅把 `model_name`/`model`、`quota`（以及代理明确使用的 quota 别名）、`prompt_tokens`、`completion_tokens` 映射到共享类型；不新增或透传金额字段，UI 统一显示“扣除额度”；
- 以 `AITTCO_API_URL`（默认 `https://api.aittco.com`）为 base URL，固定 10 秒上游超时，按 `/api/log/token`、`/api/log/token/` 顺序请求；
- 从 `req.user.id`（兼容 `_id` 字符串化）取得用户，只读取 `aittco_shared`；缺失或 `user_provided` 返回 404；
- 将上游 HTTP 状态/网络错误转换为稳定错误码：不支持、鉴权失败、其他上游失败；不把原始响应或 Key 写入日志或响应；
- 缓存值按用户隔离，TTL 不超过 60 秒；`refresh=true|1` 跳过缓存后覆盖缓存；`clearCache` 支持单用户和全部清理；
- 成功响应严格返回 `{ source: 'newapi', items, limited: true }`，其中 `limited` 明确表示受上游最近记录上限影响。

在 `packages/api/src/index.ts` 增加 `export * from './aittco/usage';`，保持 `api` 通过 `@librechat/api` 消费编译产物。

### Step 2: 运行 controller 测试

```powershell
cd packages/api
npm exec jest -- --runInBand src/aittco/usage.spec.ts
```

Expected: PASS，且覆盖测试中的解析、错误映射、缓存和清理行为。

### Step 3: 提交 controller 实现

```powershell
git add packages/api/src/aittco/usage.ts packages/api/src/index.ts
git commit -m "feat: add AITTCO New API usage controller"
```

## Task 3: 接入 keys 路由并保证 Key 变更失效

**Files:**

- Modify: `api/server/routes/keys.js`
- Modify: `api/server/routes/__tests__/keys.spec.js`

### Step 1: 先补路由失败测试

在现有 Keys Routes suite 中增加：

- `GET /api/keys/aittco/usage` 成功返回归一化 New API envelope，非消费记录被过滤且响应不包含共享 Key；
- 缺少共享 Key 返回 404 稳定错误，未调用 axios；
- 两次普通请求命中 controller 缓存，`?refresh=true` 触发第二次上游请求；
- 共享 Key `PUT`、单个共享 Key `DELETE` 和 `DELETE ?all=true` 后，下一次 quota/usage 请求不会继续使用旧缓存。

为避免跨测试共享模块缓存，使用不同的 `requestUserId`；axios mock 只返回脱敏 fixture。先运行现有路由测试，确认新增断言在路由尚未挂载时失败。

### Step 2: 修改薄路由

在 `keys.js` 顶部从 `@librechat/api` 引入 `createAittcoUsageController`，用现有 `getUserKey` 创建 controller，并挂载：

```js
router.get('/aittco/usage', requireJwtAuth, aittcoUsageController.handle);
```

抽取 `clearQuotaCache(userId)`/`clearAittcoCaches(userId)` 小 helper。共享 Key 更新成功后、删除指定共享 Key 后、删除全部 Key 后，同时清理既有 `quotaCache` 和 controller 明细缓存；其他 provider Key 的行为保持不变。不要把解析、上游请求或业务错误处理重新放回 JS 路由。

### Step 3: 构建 package 后运行路由测试

`api` 测试解析 `@librechat/api` 的 dist，因此先构建新导出：

```powershell
npm run build:api
cd api
npm exec jest -- --runInBand server/routes/__tests__/keys.spec.js
```

Expected: PASS，原有 quota、PUT、DELETE、GET 测试也必须保持通过。

### Step 4: 提交路由接入

```powershell
git add api/server/routes/keys.js api/server/routes/__tests__/keys.spec.js
git commit -m "feat: expose AITTCO usage details route"
```

## Task 4: 接通 shared data-provider 与 React Query

**Files:**

- Modify: `packages/data-provider/src/types/queries.ts`
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/data-service.ts`
- Modify: `packages/data-provider/src/keys.ts`
- Modify: `packages/data-provider/src/react-query/react-query-service.ts`
- Modify: `client/src/data-provider/Misc/queries.ts`
- Modify: `packages/data-provider/src/aittco.spec.ts`

### Step 1: 先补 shared contract 测试

扩展 `aittco.spec.ts`，mock `./request` 后断言：

- `aittcoQuota()` 生成 `/api/keys/aittco/quota`；
- `aittcoUsage()` 生成 `/api/keys/aittco/usage`，传入 refresh 时只追加受控的 `?refresh=true`；
- `getAittcoQuota()` 和 `getAittcoUsage({ refresh: true })` 调用对应 endpoint，并把响应类型保持为归一化契约。

先运行该文件，确认新函数/类型不存在导致失败。

### Step 2: 实现 shared contract

在 `types/queries.ts` 增加：

- `TAittcoQuotaResponse`：`total`、`used`、`remaining`、`percentage` 均为 `number | null`；
- `TAittcoUsageItem`：`id: string | number | null`、ISO `createdAt`、`model: string | null`、`quota: number | null`、`promptTokens`、`completionTokens`；
- `TAittcoUsageResponse`：`source: 'newapi'`、`items`、`limited: boolean`。

在 `api-endpoints.ts`、`data-service.ts` 增加 quota/usage 函数，在 `QueryKeys` 增加 `aittcoQuota`、`aittcoUsage`。保持动态 URL 使用现有 endpoint helper，不把 Key 或上游 URL暴露给客户端。

在 `react-query-service.ts` 的共享 Key 更新、单 Key 撤销和全部撤销成功回调中，按影响范围 invalidate `QueryKeys.aittcoQuota`/`QueryKeys.aittcoUsage`，使前端缓存和后端缓存一起失效。

在 `client/src/data-provider/Misc/queries.ts` 增加 `useGetAittcoQuotaQuery` 与 `useGetAittcoUsageQuery`：

- 都遵守 `store.queriesEnabled` 和传入的 `enabled`；
- quota 在菜单打开时懒加载；
- usage 接受一个递增 `refreshKey`，将它放进 query key，并在 `refreshKey > 0` 时请求 `?refresh=true`，这样每次手动刷新都绕过服务端缓存；
- usage 查询关闭 window-focus 自动刷新，保留显式刷新入口的可预测行为。

### Step 3: 运行 shared tests

```powershell
cd packages/data-provider
npm exec jest -- --runInBand src/aittco.spec.ts
```

Expected: PASS。随后构建 data-provider，确保客户端可解析新类型和 endpoint：

```powershell
npm run build:data-provider
```

### Step 4: 提交 data-provider 接入

```powershell
git add packages/data-provider/src/types/queries.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/keys.ts packages/data-provider/src/react-query/react-query-service.ts client/src/data-provider/Misc/queries.ts packages/data-provider/src/aittco.spec.ts
git commit -m "feat: add AITTCO usage data provider queries"
```

## Task 5: 改造右上角入口并完成本地化 UI

**Files:**

- Modify: `client/src/components/Nav/QuotaSummary.tsx`
- Create: `client/src/components/Nav/QuotaSummary.spec.tsx`
- Modify: `client/src/locales/en/translation.json`

### Step 1: 写组件失败测试

使用 `test/layout-test-utils`，mock `~/data-provider` 的两个新 query hook 和 `useLocalize`，覆盖：

- 点击紧凑入口后显示额度摘要；点击“Usage details”打开命名 Dialog，显示时间、模型、输入 Token、输出 Token、扣除额度表头及 fixture 记录；
- 记录按服务端 ISO 值用浏览器本地格式显示，缺失模型/quota 显示 `-`，Token 数字正常显示；响应包含 `limited` 时显示上游最近记录限制提示；
- loading、空列表、Key 未配置、上游不支持和通用失败状态各显示对应本地化提示；fixture 中的共享 Key 不出现在 DOM；
- 点击明细刷新按钮后递增 usage query 的 `refreshKey`，并保持对话框打开；
- 在紧凑布局下表格包在可横向滚动的容器中，已有额度按钮仍可访问。

先运行：

```powershell
cd client
npm exec jest -- --runInBand src/components/Nav/QuotaSummary.spec.tsx
```

Expected: FAIL，因为当前组件只有直接 fetch 的额度摘要，没有明细入口、query hook 或本地化文案。

### Step 2: 增加英文 locale keys

在 `client/src/locales/en/translation.json` 的 API Key/refresh 附近加入这些英文 keys：`com_ui_aittco_quota`、`com_ui_aittco_quota_title`、`com_ui_aittco_quota_total`、`com_ui_aittco_quota_used`、`com_ui_aittco_quota_remaining`、`com_ui_aittco_quota_percentage`、`com_ui_aittco_usage_details`、`com_ui_aittco_usage_title`、`com_ui_aittco_usage_time`、`com_ui_aittco_usage_model`、`com_ui_aittco_usage_input_tokens`、`com_ui_aittco_usage_output_tokens`、`com_ui_aittco_usage_quota`、`com_ui_aittco_usage_refresh`、`com_ui_aittco_usage_loading`、`com_ui_aittco_usage_empty`、`com_ui_aittco_usage_key_not_configured`、`com_ui_aittco_usage_unavailable`、`com_ui_aittco_usage_auth_failed`、`com_ui_aittco_usage_error`、`com_ui_aittco_usage_limited`。组件内不保留新的硬编码可见文本；其他语言文件不直接修改。

### Step 3: 实现 `QuotaSummary`

- 移除直接 `fetch`、本地 quota/error 请求状态，改用 `useGetAittcoQuotaQuery({ enabled: open })`；保留现有 Ariakit 菜单和 compact/non-compact 两种入口。
- 在额度 popover 中增加语义化的明细按钮，打开 `OGDialog`；Dialog 内使用 `OGDialogHeader`、`OGDialogTitle`、`Button`、`Table`/`TableHead`/`TableCell` 等共享 primitive。
- 明细打开时启用 `useGetAittcoUsageQuery(refreshKey, { enabled: detailsOpen })`；刷新按钮递增 key，loading 时禁用并显示已有 refresh icon 的忙碌状态。
- 将 API 错误 code 映射为本地化提示，不显示 axios 原始 message；`AITTCO_USAGE_KEY_NOT_CONFIGURED`、`UPSTREAM_USAGE_UNAVAILABLE`、鉴权/其他错误分别落到稳定的 UI 状态。
- 使用 `new Date(item.createdAt).toLocaleString()` 或等价 Intl API 按浏览器本地时区显示；不在客户端重新计算 quota 或美元金额。
- 保持 `aria-label`、Dialog 标题、按钮 tooltip/title 完整；表格使用固定最小宽度并放入 `overflow-x-auto` 容器，移动端不遮挡 Header 其他控件。

### Step 4: 运行组件测试

```powershell
cd client
npm exec jest -- --runInBand src/components/Nav/QuotaSummary.spec.tsx
```

Expected: PASS，且现有 `ApiKeyButton`、Header 相关测试不受影响。

### Step 5: 提交 UI

```powershell
git add client/src/components/Nav/QuotaSummary.tsx client/src/components/Nav/QuotaSummary.spec.tsx client/src/locales/en/translation.json
git commit -m "feat: show AITTCO usage details in quota menu"
```

## Task 6: 集成验证与交付前检查

### Step 1: 运行定向测试和类型检查

按依赖顺序执行：

```powershell
npm run build:data-provider
npm run build:api
cd packages/api
npm exec jest -- --runInBand src/aittco/usage.spec.ts
cd ../../api
npm exec jest -- --runInBand server/routes/__tests__/keys.spec.js
cd ../packages/data-provider
npm exec jest -- --runInBand src/aittco.spec.ts
cd ../../client
npm exec jest -- --runInBand src/components/Nav/QuotaSummary.spec.tsx
npm run typecheck
```

### Step 2: 运行构建级验证

```powershell
cd D:/chat-libre/LibreChat
npm run build:api
npm run build:data-provider
cd client
npm run build:ci
```

若构建触发已有 workspace 缓存问题，记录具体失败命令和诊断，不把未验证的状态称为完成。

### Step 3: 静态安全与差异检查

```powershell
cd D:/chat-libre/LibreChat
git diff --check
git status --short
```

人工检查响应 fixture 和实现中都没有完整 API Key、Authorization header、请求内容、IP 或上游原始错误；检查 `QuotaSummary` 的所有新增用户可见文字都来自 `useLocalize`。不修改当前工作区中与本功能无关的 `.playwright-cli/`、`.superpowers/` 和 `skill/thesis-defense-coach/` 未跟踪目录。

### Step 4: 可选发布前手工确认

使用脱敏测试 Key 在实际 AITTCO 代理环境请求一次 `/api/log/token`，确认代理返回的字段仍为 `created_at`、`model_name`、`quota`、`prompt_tokens`、`completion_tokens`、`type`。手工验证只记录字段形状和 HTTP 状态，不把 Key 或原始日志写入仓库、截图或测试输出。
