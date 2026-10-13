# Gemini 4 Argon 接入设计

## 目标

在现有 Gemini 模型选择器中提供 `gemini-4-argon`，显示为 `Gemini 4 Argon`，使用现有原生 Google/AITTCO 请求链路。

## 实现范围

- 将模型加入共享 Google 默认列表、`.env.example`、`.env.aittco.example` 和本地 `.env` 的 `GOOGLE_MODELS`。
- 为前端目录添加可读名称和 GEMINI 分组，复用已有 Gemini 推理说明及其翻译。
- 将后端上下文映射设为官方文档公布的 1,048,576 token，覆盖 Google 及共享代理路径和模型别名。
- 在部署说明中记录环境白名单覆盖默认列表的行为。

## 方案选择

扩展现有原生 Google 路由即可完成任务，无需引入新的自定义接口或模型专用请求参数。单独修改前端名称不能让服务端提供模型；单独修改共享默认列表也不能覆盖当前环境白名单，因此同步修改这两处配置。

## 验证

运行现有模型目录、共享配置、上下文映射和 Google 配置测试。校验环境配置、格式与构建。真实网关调用需要有权使用该模型的用户 API key，本次不使用用户凭据发送计费请求。

## 来源

- https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
- https://cloud.google.com/blog/products/ai-machine-learning/gemini-4-argon-available-on-google-cloud
