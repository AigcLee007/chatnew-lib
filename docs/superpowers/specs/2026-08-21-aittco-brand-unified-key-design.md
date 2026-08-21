# AittcoChat 品牌与统一密钥设计

## 状态

已获用户确认，进入实施计划阶段前的设计记录。

## 目标

将用户可见品牌统一为 AittcoChat，使用用户提供的 Aittco Logo，并把 Google、Anthropic、OpenAI 和 xAI 的用户认证改为一个共享 API 密钥。用户登录后如果没有共享密钥，必须先完成一次配置；已有用户不迁移旧的供应商密钥，统一重新配置。

## 已确认约束

- 首次登录使用专门的 `/setup-key` 配置页，不使用聊天界面强制弹窗。
- 共享密钥永久有效，只有用户主动更换或删除时才失效。
- 已有用户全部重新输入共享密钥，不从旧供应商密钥自动迁移。
- 保存时只检查去除空白后的非空值，不在保存前调用网关验证。
- 没有共享密钥时，页面不能进入可用聊天状态，后端请求也不能绕过该限制。
- 品牌替换限于用户可见内容、标题、Logo、帮助入口、页脚和外链。
- 保留内部包名、数据库字段、协议头、源代码注释和第三方镜像名称，避免破坏升级和运行兼容性。
- `https://www.librechat.ai` 的用户可见链接改为 `https://chatvip.aittco.com`，保留原有路径部分。

## 方案

### 共享密钥存储

增加一个集中常量，例如 `aittco_shared`，作为 `Key` 集合中的专用记录名。继续使用 `packages/data-schemas/src/methods/key.ts` 的加密、解密、过期查询、更新和删除逻辑。共享密钥不写入 localStorage、前端构建产物或日志。

共享密钥的过期时间始终为空（永久有效）。更新接口允许用户覆盖现有记录；删除共享密钥后，用户下次进入应用会再次被引导到配置页。

### 后端密钥解析

增加统一的共享密钥解析边界，使所有四类供应商配置在读取用户认证时使用同一条记录。供应商仍使用各自原生协议和现有 AITTCO 网关路由，只替换认证值来源，不改变请求格式：

```text
browser -> /api/keys (aittco_shared) -> encrypted Key document
                                      -> shared plain API key
Google native   -> api.aittco.com + shared key
Anthropic native-> api.aittco.com + shared key
OpenAI custom   -> api.aittco.com/v1 + shared key
xAI custom      -> api.aittco.com/v1 + shared key
```

解析边界应被 endpoint 初始化、模型配置加载和 agent 请求复用，避免只修复聊天入口而遗漏标题生成、agent 或工具调用。不得让 `user_provided` 哨兵值作为真实认证值发出。

### 首次配置页与访问控制

新增受保护的 `/setup-key` 页面和共享密钥状态查询。登录后前端先查询 `aittco_shared` 的存在状态：

1. 查询到共享密钥，继续正常启动和进入聊天。
2. 查询不到共享密钥，重定向 `/setup-key`，不渲染聊天工作区。
3. 保存成功后使共享密钥查询失效并跳转 `/c/new`。
4. 共享密钥删除后清理相关查询缓存，再次触发 `/setup-key`。

配置页只允许输入一个 API 密钥，提交前 trim 并拒绝空值。保存失败显示可本地化错误，不泄露密钥内容。后端模型请求在缺少共享密钥时返回明确的认证配置错误，不能通过直接调用聊天 API 绕过前端引导。

### 品牌与 Logo

- 启动配置的 `appTitle` 默认值设为 `AittcoChat`。
- 登录页和需要品牌图像的启动区域使用用户提供的图二资源；同步更新 favicon、Apple touch icon 和 PWA manifest 的名称/图标引用，保留必要的尺寸变体。
- 用户可见的默认页脚、关于页诊断文案、帮助/FAQ 入口和相关页面标题使用 AittcoChat。
- 用户可见的 LibreChat 官网链接替换为 `https://chatvip.aittco.com`。
- 内部技术标识（例如 `X-LibreChat-Generation-Protocol`）不变。

## 预计改动边界

实现阶段优先修改以下边界，实际文件以代码搜索结果为准：

- `client/src/routes/`：新增 setup-key 路由和登录后访问守卫。
- `client/src/components/Auth/` 或新的 setup-key 组件目录：品牌 Logo 和配置表单。
- `client/src/hooks/Input/`、`client/src/data-provider/`、`packages/data-provider/src/`：共享密钥查询、保存、删除及缓存失效。
- `api/server/routes/keys.js` 与 `packages/data-schemas/src/methods/key.ts`：共享密钥名校验和接口复用。
- `api/server/services/Config/`、`api/server/services/Endpoints/`、`packages/api/src/`：统一密钥解析接入所有 endpoint 初始化路径。
- `client/public/`、`client/index.html`、`client/vite.config.ts`：Logo、favicon、标题和 PWA manifest。
- `librechat.yaml`、用户可见默认文案和帮助链接：AittcoChat 标题、页脚和外链。

不修改 `.env` 中的网关密钥配置，不把用户共享密钥设置成服务器级 API key；每个用户的密钥仍按用户隔离并加密保存。

## 错误处理与安全

- 空白密钥：前端阻止提交，后端也拒绝空值。
- 密钥不存在：前端跳转 setup-key，后端请求返回无用户密钥错误。
- 数据库/加密失败：保持当前错误边界，记录不含密钥的错误信息并向用户显示通用保存失败提示。
- 网关验证不在保存阶段执行；真实请求返回 401/403 时沿用模型请求错误展示，不自动删除用户密钥。
- 删除或替换密钥只影响当前用户，不影响其他用户或服务器环境变量。
- 所有涉及密钥的日志只记录是否存在、错误类型和 endpoint，不记录值或完整请求头。

## 测试策略

### 后端

- Key 方法测试：共享名称可以加密保存、永久查询、覆盖和删除；空值被拒绝。
- 解析测试：四类 endpoint 都读取同一共享记录；缺失共享记录返回预期的无密钥错误；`user_provided` 不会被当作真实 key。
- 路由测试：未认证拒绝、认证用户可查询状态/保存/删除；用户之间的记录隔离。

### 前端

- setup-key 页面：无密钥时显示，非空保存成功后跳转聊天，空值不提交。
- 路由守卫：存在密钥不拦截，无密钥不渲染聊天并重定向 setup-key。
- 缓存行为：保存、删除后共享密钥状态正确刷新。
- 品牌回归：启动标题、登录 Logo、页脚外链和 manifest 使用 AittcoChat 资源；内部协议头等技术标识保持不变。

### 验证

- 运行受影响 workspace 的 Jest 测试。
- 执行 TypeScript/ESLint 检查和生产构建。
- 使用一个新用户验证完整流程：注册 -> 登录 -> setup-key -> 四类 endpoint 各发送一次请求。
- 使用已有用户验证不会复用旧供应商密钥，首次登录仍进入 setup-key。

