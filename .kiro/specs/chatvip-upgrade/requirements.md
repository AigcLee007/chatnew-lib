# Requirements Document

## Introduction

ChatVIP 升级计划，包含三个核心功能：Gemini 原生协议支持、联网搜索功能、以及 PPTX 文件解析支持。该升级旨在增强 LLM 聊天应用的能力，支持更多模型协议、实时网络搜索和更丰富的文件格式。

## Glossary

- **Chat_System**: 整体聊天应用系统
- **File_Processor**: 文件处理模块，负责解析上传的文件并提取文本内容
- **LLM_Provider**: 大语言模型提供者接口，负责与不同 AI 服务通信
- **GeminiNative_Provider**: 使用 Google 原生 API 协议的 Gemini 提供者
- **OpenAI_Provider**: 使用 OpenAI 兼容协议的提供者
- **Store**: Zustand 状态管理存储
- **Web_Search**: 联网搜索功能，允许 LLM 访问实时网络信息
- **PPTX**: Microsoft PowerPoint 演示文稿格式

## Requirements

### Requirement 1: PPTX 文件解析

**User Story:** As a user, I want to upload PPTX files, so that I can use presentation content as context for AI conversations.

#### Acceptance Criteria

1. WHEN a user uploads a .pptx file, THE File_Processor SHALL extract text content from all slides
2. WHEN a user uploads a .ppt file, THE File_Processor SHALL attempt to process it using the same PPTX logic
3. WHEN extracting slide content, THE File_Processor SHALL preserve slide order (slide1, slide2, etc.)
4. WHEN a slide contains only images without text, THE File_Processor SHALL return a descriptive message indicating no text was extracted
5. IF the PPTX file is corrupted or invalid, THEN THE File_Processor SHALL throw an error with a descriptive message

### Requirement 2: 联网搜索状态管理

**User Story:** As a user, I want to toggle web search functionality, so that I can control whether the AI has access to real-time internet information.

#### Acceptance Criteria

1. THE Store SHALL maintain an isWebSearchEnabled boolean state (default: false)
2. WHEN toggleWebSearch is called, THE Store SHALL toggle the isWebSearchEnabled state
3. THE Chat_System SHALL persist the web search state across the session

### Requirement 3: Gemini 原生协议 Provider

**User Story:** As a developer, I want to use Google's native Gemini API protocol, so that I can access Gemini-specific features like native web search.

#### Acceptance Criteria

1. THE GeminiNative_Provider SHALL support models with "-v" suffix (gemini-3-pro-preview-v, gemini-3-flash-preview-v)
2. WHEN streaming chat, THE GeminiNative_Provider SHALL use the Google generativelanguage API endpoint
3. WHEN isWebSearchEnabled is true, THE GeminiNative_Provider SHALL include googleSearch tool in the request
4. THE GeminiNative_Provider SHALL convert messages to Gemini's contents format (role: 'user' | 'model', parts: [{ text }])
5. THE GeminiNative_Provider SHALL handle SSE streaming responses from the Gemini API
6. IF the API returns an error, THEN THE GeminiNative_Provider SHALL call the onError callback with a descriptive error

### Requirement 4: OpenAI Provider 联网支持

**User Story:** As a developer, I want the OpenAI provider to support web search, so that compatible models can also access real-time information.

#### Acceptance Criteria

1. WHEN isWebSearchEnabled is true, THE OpenAI_Provider SHALL include a google_search tool definition in the request body
2. THE OpenAI_Provider SHALL accept isWebSearchEnabled as an optional parameter in ChatOptions

### Requirement 5: LLM Factory 路由更新

**User Story:** As a developer, I want the LLM factory to correctly route requests to the appropriate provider, so that each model uses its optimal protocol.

#### Acceptance Criteria

1. THE LLMFactory SHALL route "-v" suffix models to GeminiNative_Provider
2. THE LLMFactory SHALL route other Gemini models to the existing GeminiProvider (OpenAI compatible)
3. THE LLMFactory SHALL register GeminiNative_Provider before GeminiProvider to ensure correct precedence

### Requirement 6: UI 联网搜索开关

**User Story:** As a user, I want a visible toggle button for web search, so that I can easily enable or disable the feature.

#### Acceptance Criteria

1. THE ChatInterface SHALL display a Globe icon button in place of the Terminal (快捷指令) button
2. WHEN the web search is enabled, THE button SHALL display with blue highlight styling
3. WHEN the button is clicked, THE Chat_System SHALL toggle the isWebSearchEnabled state
4. WHEN sending a message, THE Chat_System SHALL pass the isWebSearchEnabled state to the LLM provider

### Requirement 7: API Client 集成

**User Story:** As a developer, I want the API client to pass web search state to providers, so that the feature works end-to-end.

#### Acceptance Criteria

1. THE streamChatCompletion function SHALL accept isWebSearchEnabled as a parameter
2. WHEN calling provider.streamChat, THE API_Client SHALL pass isWebSearchEnabled in the options
3. THE ChatOptions interface SHALL include an optional isWebSearchEnabled field
