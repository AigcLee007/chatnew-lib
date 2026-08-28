# 独立生图页面设计

## 目标与范围

在 LibreChat 中增加独立的 `/image-generation` 生图页面。页面使用用户输入的 AITTCO API Key，通过 `https://api.aittco.com` 调用三个固定图片模型：

- `gemini-3-pro-image-preview`
- `gemini-3.1-flash-image-preview`
- `gpt-image-2`

第一版支持文生图、参考图、图片编辑和连续编辑；不接入账户积分、服务端生成历史或聊天消息持久化。生成历史仅保存在当前浏览器。

## 方案选择

采用“复用 LibreChat 现有 OpenAI 图片能力并扩展独立页面”的方案。后端统一代理请求并复用现有用户密钥读取、文件处理和图片渲染能力；Gemini 与 OpenAI 协议差异封装在适配器中。避免直接移植 `shumo` 的积分、任务日志和账户系统，也避免前端直连导致密钥暴露和跨域问题。

## 架构与数据流

前端新增 `/image-generation` 页面，后端新增 `POST /api/images/generate`。前端提交模型、提示词、参考图、画幅、分辨率和数量；后端读取用户 AITTCO Key，校验白名单和输入限制，选择适配器调用中转站，统一解析图片响应并返回结果。前端将结果存入 IndexedDB，元数据索引存入 localStorage。

新增后端 TypeScript 代码放在 `/packages/api`；共享请求/响应类型放在 `/packages/data-provider`；`/api` 仅保留薄 JS 路由包装。页面复用现有主题组件和样式系统。

## API 契约

请求：

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "一座雨夜中的未来城市，电影级光影",
  "images": [{ "data": "data:image/png;base64,...", "mimeType": "image/png" }],
  "size": "1:1",
  "resolution": "1K",
  "count": 4
}
```

返回：

```json
{
  "images": [{ "data": "data:image/png;base64,...", "mimeType": "image/png", "index": 0 }],
  "requestedCount": 4,
  "successCount": 3,
  "failedCount": 1,
  "model": "gemini-3-pro-image-preview",
  "requestId": "..."
}
```

## 模型适配

`ImageGenerationService` 根据白名单选择 `GeminiImageAdapter` 或 `OpenAIImageAdapter`。

Gemini 适配器使用 `generateContent`，将提示词和最多 5 张参考图转换成 `parts`/`inlineData`，并设置 `responseModalities: ["IMAGE"]` 与 `imageConfig`。需要通过 AITTCO 契约测试确认真实路径、鉴权头和响应字段。

GPT Image 2 无参考图调用 `/v1/images/generations`；有参考图调用 `/v1/images/edits` 的 multipart 请求。适配器兼容 `b64_json`、`url`、`image`、`image_url` 及 Gemini inlineData 等返回形式。

每个上游请求只生成一张图。页面数量可选 1–4；适配器为数量 N 并行发起 N 个单张请求，使用 `Promise.allSettled` 收集部分成功结果。单次最多并行 4 个任务；默认不自动重试，最多允许单子请求重试一次；支持尽力取消。

## 页面交互

桌面端采用参数输入/结果预览左右双栏，移动端上下排列。输入区包括多行提示词、模型、8 种画幅、1K/2K/4K 分辨率、1–4 张数量和参考图上传。支持点击、拖拽、粘贴上传；最多 5 张参考图，可预览、删除、清空和拖拽排序。第一张为主参考图，其余为辅助参考图。

每个结果支持下载、复制、删除和“继续编辑”。继续编辑会把结果加入参考图列表，保留模型/参数并清空提示词等待修改。生成中显示模型、数量和加载状态，禁止重复提交，并提供取消按钮。

## 校验、安全与错误

后端固定 AITTCO Base URL（默认 `AITTCO_API_URL=https://api.aittco.com`，允许部署环境覆盖），不接受前端任意 baseURL；密钥只从现有用户密钥存储读取，不写入 URL、请求体或本地历史。限制提示词 8,000 字符、单图 10 MB、最多 5 张参考图、数量最多 4。校验 MIME、data URL 和 base64。

统一处理无密钥、无效密钥、模型不可用、内容审核、图片过大、限流、超时和异常响应，并返回可理解的用户提示。日志只记录用户 ID、模型、参数摘要、数量、状态、耗时和 requestId，不记录密钥、图片 base64 或完整敏感提示词。

## 本地历史

IndexedDB 保存图片 Blob，localStorage 保存 id、时间、模型、提示词摘要、参数和 Blob key。默认加载最近 20 条，支持加载更多、查看、继续编辑、下载、删除和清空。刷新页面后可恢复，换浏览器或设备不共享。

## 测试与交付阶段

后端测试覆盖白名单、8 种画幅映射、5 张参考图限制、数量并行、部分成功、Gemini/OpenAI 请求组装、各种图片返回格式和错误转换。前端测试覆盖表单、上传、排序、数量、加载/取消、结果操作和 IndexedDB。

开发阶段对三个真实模型执行最小契约测试，确认 AITTCO 鉴权、路径、请求体、响应字段、画幅支持、参考图限制、超时和 429 行为。

实施分四阶段：后端适配与类型；独立页面；IndexedDB 历史与下载；完整契约测试、文档更新和发布验证。

## 自检结论

- 三个模型和 AITTCO 地址已固定且与范围一致。
- 单次上游请求固定一张；用户数量 1–4 通过并行单张请求实现。
- 参考图上限统一为 5 张；画幅统一为 8 种。
- 未引入积分、服务端历史和聊天会话等非目标复杂度。
- AITTCO 具体 Gemini 协议字段保留为契约测试确认项，不在实现前假设。
