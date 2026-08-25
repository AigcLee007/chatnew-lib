# 首页 API Key 修改入口设计

## 背景

项目首次通过 `/setup-key` 保存 AittcoChat 的共享 API Key（存储名为 `aittco_shared`）。保存后首页没有再次修改入口，用户无法替换失效或更换的 Key。

## 目标

在首页 Header 右上角增加 API Key 管理按钮，让已登录用户可以随时输入并替换共享 API Key，同时保持首次配置流程不变。

## 方案

在现有 `client/src/components/Chat/Header.tsx` 的右侧操作区挂载独立的 API Key 按钮组件。组件负责按钮、Tooltip、弹窗和表单状态，复用现有的 `useUserKeyQuery` 与 `useUpdateUserKeysMutation`，不新增后端接口。

弹窗读取 `aittco_shared` 的过期状态，仅显示“已配置”或“未配置”，不读取或回显真实 API Key。用户输入的新 Key 在提交前去除首尾空白，并调用已有更新接口：

```ts
{ name: 'aittco_shared', value: trimmedKey, expiresAt: '' }
```

现有 mutation 已负责失效用户 Key、模型和 Token 配置相关缓存，因此保存后首页会使用新配置。首次未配置用户仍由 `Root` 导航到 `/setup-key`，新增入口不会绕过该路由守卫。

## 交互

1. Header 右上角显示钥匙图标按钮，提供本地化 Tooltip 与 `aria-label`。
2. 点击按钮打开 API Key 弹窗，输入框默认使用 `password` 类型。
3. 当前状态只显示“已配置/未配置”，真实 Key 永不回显。
4. 输入为空或仅包含空白时，保存按钮禁用，不发起请求。
5. 保存期间禁用输入和按钮，防止重复提交。
6. 保存成功后关闭弹窗并显示成功 Toast。
7. 保存失败时保留弹窗和输入内容，并显示错误 Toast，方便重试。

## 组件边界

- `ApiKeyButton`：首页入口、弹窗开关和表单交互。
- `Header`：只负责在右上角操作区挂载入口，不承载 Key 业务逻辑。
- `useUserKeyQuery` / `useUpdateUserKeysMutation`：继续作为 Key 状态读取和更新的唯一数据通道。
- `/setup-key`：保持首次配置页面和现有导航守卫，不与修改弹窗合并。

## 安全与错误处理

- 不向 UI 返回、不在 DOM 中显示、不在 Toast 中打印旧 Key。
- 提交只发送 trim 后的新 Key。
- 空输入在客户端拦截。
- 更新失败时保留用户输入并允许再次提交。
- 复用现有本地化错误和成功提示机制。

## 测试

为新组件增加定向测试，覆盖：

- Header 入口可渲染并可打开弹窗。
- 已配置状态不泄露真实 Key。
- 输入新 Key 后调用正确的更新参数。
- 空输入不会提交。
- 更新失败时弹窗保持打开。

同时运行相关 ESLint、TypeScript 类型检查、定向测试和客户端构建。

## 非目标

- 不修改 Provider Key 管理功能。
- 不新增 API 路由或数据库字段。
- 不增加旧 Key 的查看、复制或导出能力。
- 不改变首次 `/setup-key` 配置流程。
