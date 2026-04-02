# 🤖 Aittco AI Chat Workbench

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/Lee-bo-del/chatvip-ai-chat?style=social)](https://github.com/Lee-bo-del/chatvip-ai-chat/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Lee-bo-del/chatvip-ai-chat?style=social)](https://github.com/Lee-bo-del/chatvip-ai-chat/network/members)
[![GitHub issues](https://img.shields.io/github/issues/Lee-bo-del/chatvip-ai-chat)](https://github.com/Lee-bo-del/chatvip-ai-chat/issues)
[![License](https://img.shields.io/github/license/Lee-bo-del/chatvip-ai-chat)](https://github.com/Lee-bo-del/chatvip-ai-chat/blob/main/LICENSE)

**一个现代化的 AI 对话工作台，支持多模型切换、文件处理、实时流式输出**

[English](#english) | [中文](#chinese)

</div>

---

## <a id="chinese"></a>🌟 功能特性

### 🎯 核心功能
- **多模型支持** - 无缝切换 Google Gemini 和 OpenAI GPT 系列模型
- **智能对话** - 支持上下文记忆的多轮对话
- **文件处理** - 支持图片、PDF、Word、Excel 等多种文件格式
- **实时流式输出** - 60fps 丝滑的打字机效果
- **思考过程可视化** - Gemini 3.0 思考模式支持
- **联网搜索** - 实时获取最新信息（Gemini 原生模型）

### 🎨 用户体验
- **Google 风格 UI** - 简洁优雅的界面设计
- **动态模型图标** - 根据选择的模型自动切换 Logo
- **响应式设计** - 完美适配桌面端和移动端
- **深色/浅色主题** - 自动跟随系统或手动切换
- **会话管理** - 按时间分组的对话历史

### 📤 导出功能
- **Markdown 导出** - 导出对话记录为 Markdown 文件
- **Word 导出** - 一键生成 Word 文档
- **PPT 导出** - 自动生成演示文稿
- **语音朗读** - 支持中文语音播报

### 🔗 集成功能
- **Deep Research** - 快速访问深度研究工具
- **图片生成** - Gemini 2.5 Flash Image 绘图支持
- **代码高亮** - 支持 50+ 编程语言语法高亮
- **Mermaid 图表** - 实时渲染流程图、时序图等

---

## 🚀 快速开始

### 前置要求
- Node.js 18+ 
- npm 或 yarn
- Aittco API Key（支持 Gemini 和 GPT）

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/Lee-bo-del/chatvip-ai-chat.git
cd chatvip-ai-chat
```

2. **安装依赖**
```bash
npm install
```

3. **配置 API Key**

创建 `.env.local` 文件：
```env
GEMINI_API_KEY=sk-your-api-key-here
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
打开浏览器访问 `http://localhost:3000`

---

## 📦 构建部署

### 本地构建
```bash
npm run build
```
构建产物在 `dist` 目录

### 部署到服务器

#### 方式一：静态文件部署
1. 构建项目：`npm run build`
2. 将 `dist` 文件夹上传到服务器
3. 配置 Nginx：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### 方式二：宝塔面板部署
1. 构建项目并打包：`npm run build`
2. 上传 `dist` 文件夹到网站根目录
3. 在宝塔面板配置 Nginx 伪静态规则

---

## 🛠️ 技术栈

### 前端框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **TailwindCSS** - 样式框架

### 状态管理
- **Zustand** - 轻量级状态管理
- **Dexie.js** - IndexedDB 封装

### UI 组件
- **Lucide React** - 图标库
- **React Markdown** - Markdown 渲染
- **React Syntax Highlighter** - 代码高亮
- **Mermaid** - 图表渲染

### 文件处理
- **PDF.js** - PDF 解析
- **Mammoth.js** - Word 文档处理
- **XLSX** - Excel 处理
- **Tesseract.js** - OCR 文字识别

### 测试
- **Vitest** - 单元测试框架
- **43 个测试用例** - 覆盖核心功能

---

## 📱 支持的模型

### Google Gemini 系列
- `gemini-3-pro-preview` - 最强推理能力（思考模式）
- `gemini-3-flash-preview` - 快速响应
- `gemini-3-pro-preview-v` - 按用量计费版本
- `gemini-3-flash-preview-v` - 按用量计费版本
- `gemini-2.5-flash-image` - 图片生成

### OpenAI GPT 系列
- `gpt-5.2-all` - 全能模型
- `gpt-5.2-thinking` - 深度思考模型

---

## 🎯 使用场景

- **日常对话** - 智能助手，回答各类问题
- **文档处理** - 分析 PDF、Word、Excel 文件
- **代码辅助** - 代码生成、调试、优化
- **内容创作** - 文章写作、PPT 生成
- **学习研究** - 联网搜索，获取最新信息
- **图片生成** - AI 绘图创作

---

## 📸 界面预览

### 首页
- Google 风格的简洁设计
- 动态模型图标（Gemini 星形 / GPT 花瓣）
- 渐变色欢迎语

### 对话界面
- 实时流式输出
- 思考过程可视化
- 代码高亮和图表渲染

### 侧边栏
- 按时间分组的会话历史
- 搜索功能
- Deep Research 快速入口

---

## 🔧 配置说明

### API 配置
在设置面板中配置：
- API Key（必填）
- 默认模型
- 自定义系统提示词
- 联网搜索开关

### 主题配置
- 自动跟随系统
- 手动切换深色/浅色模式

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 📄 开源协议

本项目采用 MIT 协议开源 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- [Google Gemini](https://ai.google.dev/) - 强大的 AI 模型
- [OpenAI](https://openai.com/) - GPT 系列模型
- [Aittco](https://aittco.com/) - API 代理服务
- 所有开源项目的贡献者

---

## 📞 联系方式

- GitHub: [@Lee-bo-del](https://github.com/Lee-bo-del)
- Email: lb20060807@126.com
- 项目地址: [https://github.com/Lee-bo-del/chatvip-ai-chat](https://github.com/Lee-bo-del/chatvip-ai-chat)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by Lee-bo-del

</div>

---

## <a id="english"></a>🌟 Features

### 🎯 Core Features
- **Multi-Model Support** - Seamlessly switch between Google Gemini and OpenAI GPT models
- **Smart Conversations** - Multi-turn dialogues with context memory
- **File Processing** - Support for images, PDF, Word, Excel, and more
- **Real-time Streaming** - Smooth 60fps typewriter effect
- **Thinking Process Visualization** - Gemini 3.0 thinking mode support
- **Web Search** - Real-time access to latest information (Gemini native models)

### 🎨 User Experience
- **Google-style UI** - Clean and elegant interface design
- **Dynamic Model Icons** - Auto-switch logos based on selected model
- **Responsive Design** - Perfect for desktop and mobile
- **Dark/Light Theme** - Auto-follow system or manual toggle
- **Session Management** - Time-grouped conversation history

### 📤 Export Features
- **Markdown Export** - Export conversations as Markdown files
- **Word Export** - One-click Word document generation
- **PPT Export** - Auto-generate presentations
- **Text-to-Speech** - Chinese voice playback support

### 🔗 Integrations
- **Deep Research** - Quick access to deep research tools
- **Image Generation** - Gemini 2.5 Flash Image drawing support
- **Code Highlighting** - 50+ programming languages syntax highlighting
- **Mermaid Diagrams** - Real-time rendering of flowcharts, sequence diagrams, etc.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Aittco API Key (supports Gemini and GPT)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Lee-bo-del/chatvip-ai-chat.git
cd chatvip-ai-chat
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure API Key**

Create `.env.local` file:
```env
GEMINI_API_KEY=sk-your-api-key-here
```

4. **Start development server**
```bash
npm run dev
```

5. **Access the app**
Open browser and visit `http://localhost:3000`

---

## 📦 Build & Deploy

### Local Build
```bash
npm run build
```
Build output in `dist` directory

### Deploy to Server

#### Method 1: Static File Deployment
1. Build project: `npm run build`
2. Upload `dist` folder to server
3. Configure Nginx:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### Method 2: BT Panel Deployment
1. Build and package: `npm run build`
2. Upload `dist` folder to website root
3. Configure Nginx rewrite rules in BT panel

---

## 🛠️ Tech Stack

### Frontend Framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling framework

### State Management
- **Zustand** - Lightweight state management
- **Dexie.js** - IndexedDB wrapper

### UI Components
- **Lucide React** - Icon library
- **React Markdown** - Markdown rendering
- **React Syntax Highlighter** - Code highlighting
- **Mermaid** - Diagram rendering

### File Processing
- **PDF.js** - PDF parsing
- **Mammoth.js** - Word document processing
- **XLSX** - Excel processing
- **Tesseract.js** - OCR text recognition

### Testing
- **Vitest** - Unit testing framework
- **43 test cases** - Core functionality coverage

---

## 📱 Supported Models

### Google Gemini Series
- `gemini-3-pro-preview` - Strongest reasoning (thinking mode)
- `gemini-3-flash-preview` - Fast response
- `gemini-3-pro-preview-v` - Usage-based billing
- `gemini-3-flash-preview-v` - Usage-based billing
- `gemini-2.5-flash-image` - Image generation

### OpenAI GPT Series
- `gpt-5.2-all` - All-purpose model
- `gpt-5.2-thinking` - Deep thinking model

---

## 🎯 Use Cases

- **Daily Conversations** - Smart assistant for various questions
- **Document Processing** - Analyze PDF, Word, Excel files
- **Code Assistance** - Code generation, debugging, optimization
- **Content Creation** - Article writing, PPT generation
- **Learning & Research** - Web search for latest information
- **Image Generation** - AI drawing creation

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add some AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Submit Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) - Powerful AI models
- [OpenAI](https://openai.com/) - GPT series models
- [Aittco](https://aittco.com/) - API proxy service
- All open source contributors

---

## 📞 Contact

- GitHub: [@Lee-bo-del](https://github.com/Lee-bo-del)
- Email: lb20060807@126.com
- Project: [https://github.com/Lee-bo-del/chatvip-ai-chat](https://github.com/Lee-bo-del/chatvip-ai-chat)

---

<div align="center">

**If this project helps you, please give it a ⭐️ Star!**

Made with ❤️ by Lee-bo-del

</div>
