# Implementation Plan: ChatVIP Upgrade

## Overview

按照依赖顺序实现 ChatVIP 升级功能：先安装依赖，然后从底层（类型、Store）到上层（Provider、UI）逐步实现。

## Tasks

- [x] 1. 安装依赖并更新类型定义
  - [x] 1.1 安装 jszip 依赖
    - 执行 `npm install jszip`
    - _Requirements: 1.1_
  - [x] 1.2 更新 ChatOptions 接口添加 isWebSearchEnabled 字段
    - 修改 `lib/llm/types.ts`
    - 添加 `isWebSearchEnabled?: boolean;` 到 ChatOptions
    - _Requirements: 4.2, 7.3_

- [x] 2. 实现 Store 状态管理
  - [x] 2.1 添加联网搜索状态到 ChatSlice
    - 修改 `store/slices/createChatSlice.ts`
    - 添加 `isWebSearchEnabled: boolean` 状态（默认 false）
    - 添加 `toggleWebSearch` action
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 编写 toggleWebSearch 属性测试
    - **Property 2: Web Search State Toggle**
    - **Validates: Requirements 2.2**

- [x] 3. 实现 PPTX 文件解析
  - [x] 3.1 添加 processPptx 函数
    - 修改 `lib/file-processor.ts`
    - 导入 JSZip
    - 实现 processPptx 函数解析幻灯片 XML
    - 在 processFile 中添加 .pptx/.ppt 分支
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 编写 PPTX 解析属性测试
    - **Property 1: PPTX Slide Order Preservation**
    - **Validates: Requirements 1.1, 1.3**

- [x] 4. Checkpoint - 确保基础功能测试通过
  - 运行现有测试确保没有破坏
  - 如有问题请询问用户

- [x] 5. 实现 GeminiNativeProvider
  - [x] 5.1 创建 GeminiNativeProvider 类
    - 新建 `lib/llm/providers/GeminiNativeProvider.ts`
    - 实现 supportsModel 匹配 -v 后缀模型
    - 实现 convertToGeminiFormat 消息转换
    - 实现 streamChat 使用 Google 原生 API
    - 处理 SSE 流响应
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ]* 5.2 编写 GeminiNative 模型匹配属性测试
    - **Property 3: GeminiNative Model Matching**
    - **Validates: Requirements 3.1**
  - [ ]* 5.3 编写消息格式转换属性测试
    - **Property 4: Gemini Message Format Conversion**
    - **Validates: Requirements 3.4**
  - [ ]* 5.4 编写联网工具包含属性测试
    - **Property 5: Web Search Tool Inclusion (GeminiNative)**
    - **Validates: Requirements 3.3**

- [x] 6. 更新 OpenAI Provider 支持联网
  - [x] 6.1 修改 OpenAIProvider 添加联网工具
    - 修改 `lib/llm/providers/OpenAIProvider.ts`
    - 在 streamChat 中检查 isWebSearchEnabled
    - 添加 google_search 工具定义到 requestBody
    - _Requirements: 4.1_
  - [ ]* 6.2 编写 OpenAI 联网工具属性测试
    - **Property 6: Web Search Tool Inclusion (OpenAI)**
    - **Validates: Requirements 4.1**

- [x] 7. 更新 LLM Factory 路由
  - [x] 7.1 注册 GeminiNativeProvider
    - 修改 `lib/llm/LLMFactory.ts`
    - 导入 GeminiNativeProvider
    - 将其添加到 providers 数组首位
    - 导出 GeminiNativeProvider
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 更新 providers/index.ts 导出
    - 修改 `lib/llm/providers/index.ts`
    - 导出 GeminiNativeProvider
    - _Requirements: 5.1_
  - [ ]* 7.3 编写 LLM Factory 路由属性测试
    - **Property 7: LLM Factory Routing**
    - **Validates: Requirements 5.1, 5.2**

- [x] 8. 更新 API Client
  - [x] 8.1 修改 streamChatCompletion 函数签名
    - 修改 `lib/api-client.ts`
    - 添加 isWebSearchEnabled 参数
    - 传递给 provider.streamChat
    - _Requirements: 7.1, 7.2_

- [x] 9. Checkpoint - 确保 LLM 层测试通过
  - 运行所有测试确保 Provider 和 Factory 正常工作
  - 如有问题请询问用户

- [x] 10. 更新 ChatInterface UI
  - [x] 10.1 替换快捷指令按钮为联网搜索开关
    - 修改 `components/ChatInterface.tsx`
    - 导入 Globe 图标
    - 从 Store 获取 isWebSearchEnabled 和 toggleWebSearch
    - 替换 Terminal 按钮为 Globe 按钮
    - 添加激活状态样式（蓝色高亮）
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 10.2 更新 handleSend 传递联网状态
    - 在调用 startStream 时传递 isWebSearchEnabled
    - _Requirements: 6.4_

- [x] 11. 更新 useLLMStream Hook
  - [x] 11.1 修改 startStream 接受联网状态
    - 修改 `hooks/useLLMStream.ts`
    - 添加 isWebSearchEnabled 参数
    - 传递给 streamChatCompletion
    - _Requirements: 7.2_

- [x] 12. Final Checkpoint - 完整功能测试
  - 运行所有测试确保功能正常
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求以便追溯
- Checkpoint 任务用于增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
