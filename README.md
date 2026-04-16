# 🎾 AI 网球教练

一个让学员在无教练陪同时也能获得专业动作分析的平台。上传视频或图片，AI 教练逐帧分析你的击球姿势，并与职业球员技术进行比对。

## 功能概览

- **动作分析** — 上传视频，选择时间段和帧率，AI 逐帧分析备拍、转体、击球点、随挥等细节
- **图片对话** — 上传多张截图，直接发给教练分析
- **视频对比** — 上传两段视频（如改进前后），AI 对比分析进步点
- **职业球员对比** — 选择费德勒、纳达尔、德约科维奇等球员，AI 结合其技术特点给出对比建议
- **风格推荐** — 描述你的打法，AI 推荐最相似的职业球员供你参考学习
- **自由对话** — 随时向 AI 教练提问网球技术、器材推荐等问题

## 快速开始

### 前提条件

- Node.js 18+
- pnpm 8+
- [ffmpeg](https://ffmpeg.org/download.html) （系统级安装）

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 安装与启动

```bash
# 1. 克隆项目
git clone https://github.com/sherlockfeng/video-tennis-coach.git
cd video-tennis-coach

# 2. 配置环境变量
cp .env.example .env
```

编辑 `.env`，选择 AI 提供商并填入对应 API Key：

```env
# 选择 claude 或 openai
AI_PROVIDER=claude

CLAUDE_API_KEY=your_key_here
CLAUDE_MODEL=claude-opus-4-5

# 或
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o
```

```bash
# 3. 安装依赖
pnpm install

# 4. 启动开发服务器
pnpm dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)

## 项目结构

```
video-tennis-coach/
├── packages/
│   ├── web/       # 前端 React + Vite
│   └── agent/     # 后端 Express API
├── CLAUDE.md      # AI 开发工作手册（架构 + 规则）
├── TODO.md        # 功能待办列表
└── .env.example   # 环境变量模板
```

## API 接口

| 接口 | 说明 |
|------|------|
| `POST /api/chat` | 文字对话 |
| `POST /api/chat/image` | 图片对话（multipart，最多10张）|
| `POST /api/analyze` | 视频帧提取 + 分析（multipart）|
| `POST /api/compare` | 两段视频对比 或 与职业球员对比 |
| `GET /api/health` | 服务健康检查 |

## 开发

```bash
pnpm test        # 后端单元测试（Vitest）
pnpm test:e2e    # 前端 E2E 测试（Playwright）
pnpm build       # 构建所有包
```

开发规则详见 [CLAUDE.md](./CLAUDE.md)。

## 路线图

详见 [TODO.md](./TODO.md)。

## 技术栈

**前端**：React 18 · Vite 5 · TypeScript · Tailwind CSS · Axios · Playwright

**后端**：Express 4 · TypeScript · fluent-ffmpeg · Multer · Vitest

**AI**：Anthropic Claude API / OpenAI API（可配置切换）
