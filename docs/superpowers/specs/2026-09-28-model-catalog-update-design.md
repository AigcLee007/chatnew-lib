# 模型目录更新设计

## 目标

在现有模型选择器的供应商分组和列表显示格式下，增加 `claude-opus-5-5`、`gpt-6-luna`、`gpt-6-sol`，并移除当前目录中的 `gemini-3.5-flash-preview`，同时让默认模型配置与前端目录保持一致。

## 范围

- OpenAI：把 `gpt-6-luna`、`gpt-6-sol` 加入共享默认模型，并加入当前 `librechat.yaml` 的自定义 OpenAI 默认列表。
- Anthropic：把 `claude-opus-5-5` 加入共享默认模型。
- 前端模型目录：为三个新模型提供可读名称、中文说明和供应商分组；继续保留原始模型 ID 用于选择和请求。
- Google：从共享默认模型中移除 `gemini-3.5-flash`，从前端目录元数据和相关目录测试中移除 `gemini-3.5-flash-preview`。
- 测试：覆盖新模型的默认配置、目录显示和分组，以及旧模型不再出现在默认/目录列表中。

不修改 token 上下文、计费映射或用户显式配置模型的运行时支持；这些映射仍可服务于已有会话或显式端点配置。

## 方案与数据流

模型实际可选项继续由 `packages/data-provider/src/config.ts` 的共享默认值和 `librechat.yaml` 自定义端点提供。前端 `client/src/components/Chat/Menus/Endpoints/catalog.ts` 只负责把端点返回的模型映射到统一的 `OPENAI`、`ANTHROPIC`、`GEMINI` 分组、可读名称和两行描述。模型 ID 不做改写，因此选择器提交的仍是后端配置中的精确值。

变更顺序为：先用测试固定新增/移除模型的期望，再修改共享默认列表和 YAML 列表，最后更新目录元数据与目录测试。现有未知模型的通用 fallback 行为保持不变。

## 显示规范

- `gpt-6-sol` 显示为 `GPT-6 Sol`，归入 `OPENAI`，沿用旗舰级推理与编程描述。
- `gpt-6-luna` 显示为 `GPT-6 Luna`，归入 `OPENAI`，使用兼顾速度与质量的通用描述。
- `claude-opus-5-5` 显示为 `Claude Opus 5.5`，归入 `ANTHROPIC`，沿用 Claude Opus 的分析、长文本和复杂推理描述。
- `gemini-3.5-flash-preview` 不再有显式目录元数据，也不再出现在对应目录测试样例中。

## 验证

- 运行前端目录工具测试，确认新模型名称、分组、描述和旧模型过滤结果。
- 运行 data-provider 配置测试，确认共享默认列表的新增和移除。
- 运行相关 TypeScript 检查或项目既有的客户端测试命令，确认类型和导入无误。

