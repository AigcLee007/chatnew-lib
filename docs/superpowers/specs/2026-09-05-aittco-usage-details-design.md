# AittcoChat New API 使用明细设计

## 背景与目标

右上角目前可以查询 AITTCO 共享 API Key 的额度汇总，但无法查看每次调用的时间、模型和扣费。共享 Key 实际由 AITTCO 转发到 New API，因此优先读取 New API 的真实调用日志，不在 LibreChat 本地重新估算账单。

目标是让已登录用户在现有额度入口中查看该共享 Key 的最近消费记录，同时保证 API Key 始终只在服务端可见。

## 上游契约

New API 提供 `GET /api/log/token`。该接口使用 `Authorization: Bearer <API_KEY>`，通过只读 Token 鉴权，并返回该 Key 的最近日志数组。消费日志包含：

- `created_at`：Unix 秒时间戳；
- `model_name`：请求模型；
- `quota`：New API 实例扣除的内部额度单位；
- `prompt_tokens`、`completion_tokens`：输入和输出 Token 数；
- `type`：日志类型，其中 `2` 表示消费。

当前接口最多返回 New API 配置的最近记录数（主线默认 1000），不提供基于 API Key 的分页参数。`GET /api/usage/token/` 只提供累计额度，不能替代明细。需要网页登录态的 `/api/log/self` 不纳入方案，因为 AittcoChat 只保存用户 API Key，不保存 New API 控制台会话。

AITTCO 代理可能运行旧版或定制版 New API。服务端首先请求 `/api/log/token`，必要时再尝试带尾斜杠的同一路径；404/405 视为“上游未提供明细”，其他错误按上游请求失败处理。

## 系统架构

数据流如下：

```text
浏览器
  -> GET /api/keys/aittco/usage（LibreChat JWT）
  -> 读取当前用户加密 Key 文档的 aittco_shared
  -> GET {AITTCO_API_URL}/api/log/token（Bearer 共享 Key）
  -> 过滤 type=2 并归一化字段
  -> 浏览器只收到非敏感明细
```

新增的明细路由与现有 `/api/keys/aittco/quota` 使用相同 JWT 保护、AITTCO 地址配置和 Key 读取边界。请求失败、缺少 Key、上游不支持和空日志分别返回稳定的状态/错误信息，不能把上游原始响应或授权头透传给前端。

## 服务端接口

新增 `GET /api/keys/aittco/usage`，成功响应统一为：

```json
{
  "source": "newapi",
  "items": [
    {
      "id": 123,
      "createdAt": "2026-09-05T08:30:00.000Z",
      "model": "gpt-5.5",
      "quota": 1250,
      "promptTokens": 800,
      "completionTokens": 320
    }
  ],
  "limited": true
}
```

字段约定：

- `createdAt` 始终为 ISO 字符串；无法解析的时间记录丢弃；
- `model`、Token 数和 `quota` 缺失时使用 `null` 或 `0`，不阻断其他记录；
- 只保留 `type=2` 的消费记录，并按时间倒序排列；
- `limited` 表示结果可能受上游最近记录上限影响；由于上游 API Key 接口不返回可用总数，不能声称已经获取全部历史；
- 不把 `content`、IP、请求头、完整 Key 或其他不必要的上游字段返回。

New API 的 `quota` 是其内部扣费单位，不强行换算美元。只有当上游记录明确提供金额字段时才额外返回金额；当前主线日志契约不保证该字段，因此首版界面明确显示“扣除额度”。

明细响应按用户缓存较短时间（不超过 60 秒），手动刷新绕过缓存。更新或删除共享 Key 时清除该用户的额度和明细缓存，避免旧 Key 的数据继续显示。

## 前端体验

沿用右上角现有额度入口：

1. 打开“额度查询”后保留汇总信息；
2. 增加“使用明细”入口，打开同一上下文中的明细面板/对话框；
3. 表格列为时间、模型、输入 Token、输出 Token、扣除额度；
4. 提供刷新按钮和明确的加载、空数据、上游不支持、Key 未配置、请求失败状态；
5. 时间按浏览器本地时区格式化，原始数据仍由服务端统一为 ISO 时间；
6. 移动端使用可横向滚动的紧凑表格，不影响右上角其他按钮；
7. 所有新增可见文案走现有 `useLocalize` 和英文 locale key，组件使用语义主题样式和已有 UI primitive。

React Query 负责接口请求和缓存，查询 Key、API endpoint、data-service 类型与现有 data-provider 约定一致。组件只消费归一化类型，不解析 New API 原始响应。

## 错误与兼容

- LibreChat JWT 无效：沿用现有认证中间件返回 401；
- 共享 Key 不存在：返回 404，并在界面提示先配置 Key；
- New API 返回 404/405：返回可识别的 `UPSTREAM_USAGE_UNAVAILABLE`，汇总额度功能不受影响；
- New API 返回 401/403：返回上游鉴权失败，不显示原始错误正文；
- 超时或网络错误：返回 502，保留汇总查询的既有行为；
- 响应结构不是数组或没有有效消费记录：返回成功的空列表或稳定的上游格式错误，不让 UI 崩溃；
- 解析单条记录失败只跳过该条，不影响其他合法记录。

## 测试策略

服务端测试覆盖：

- 成功解析 New API 日志并过滤非消费类型；
- 时间、模型、Token 和 quota 字段归一化；
- 404/405 的不支持状态、401/403 鉴权失败、超时错误映射；
- 缺少 Key 时不发起上游请求；
- 响应中不包含共享 Key；
- 缓存命中、刷新和 Key 更新后的缓存失效。

前端测试覆盖：

- 打开明细入口并显示表头和记录；
- 加载、空列表、未配置、上游不支持和失败状态；
- 手动刷新触发重新请求；
- 不显示 API Key，时间和数值按约定渲染；
- 移动端表格容器保持可用且不遮挡现有头部控件。

真实 AITTCO/New API 契约调用不进入默认 CI；发布前使用脱敏测试 Key 手工验证一次 `/api/log/token` 路径和实际字段，确认代理没有改写响应语义。

## 范围外

- 不保存或复制 New API 日志到 LibreChat 数据库；
- 不实现 New API 控制台登录、跨用户查询、管理员日志和 CSV 导出；
- 不根据本地 Token 重新计算费用；
- 不承诺超过上游最近记录上限的完整历史。
