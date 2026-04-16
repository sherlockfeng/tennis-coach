# 架构文档

## 研发 TODO 在哪里

`TODO.md` → `## 研发 TODO` 区块。改代码前先去那里认领任务或新增条目。

---

## 项目结构

```
video-tennis-coach/
├── CLAUDE.md                  ← 导航入口（必读）
├── docs/
│   ├── ARCHITECTURE.md        ← 本文件，架构说明
│   ├── PRODUCT.md             ← 产品设计文档
│   └── TESTING.md             ← 测试方案文档
├── TODO.md                    ← 所有待办（含研发/测试/产品三个区块）
├── README.md                  ← 面向用户的说明
├── .env.example               ← 环境变量模板
├── package.json               ← pnpm workspace 根配置
├── pnpm-workspace.yaml
└── packages/
    ├── web/                   ← 前端
    └── agent/                 ← 后端
```

---

## 前端（packages/web）

**技术栈**：React 18 · Vite 5 · TypeScript strict · Tailwind CSS · Axios · Playwright

**核心文件**：`packages/web/src/App.tsx`（单文件，含所有状态和组件）

**关键状态**：
```typescript
messages       // 界面展示的消息列表（含 frames/images 等展示字段）
apiHistory     // 发给后端的对话历史（仅 role + content，不含 base64）
panelMode      // 视频面板模式：'analyze' | 'compare' | 'pro'
videoA/B       // 视频文件和预览 URL
settingsA/B    // 帧提取配置 { startSec, endSec, fps, videoDuration }
pendingImages  // 待发送图片队列 { file, b64 }[]
```

**视频时长自动读取**：上传视频后，隐藏的 `<video>` 触发 `onLoadedMetadata`，将 `videoDuration` 更新为实际时长，`endSec` 自动设为视频全长。

**API 代理**：Vite dev server 将 `/api/*` 代理到 `localhost:3001`，生产环境需自行配置 nginx/反向代理。

---

## 后端（packages/agent）

**技术栈**：Express 4 · TypeScript ESM · fluent-ffmpeg · Multer · Vitest

**核心文件**：
```
src/
├── index.ts              ← Express 入口，export app 供测试引用
├── config.ts             ← 读取 .env，validateConfig() 启动时校验
├── providers/
│   ├── systemPrompt.ts   ← 网球教练 System Prompt（改动需产品评审）
│   ├── claude.ts         ← Anthropic SDK 封装
│   └── openai.ts         ← OpenAI SDK 封装
├── services/
│   ├── aiProvider.ts     ← 统一分发入口，根据 config.provider 选择
│   └── frameExtractor.ts ← ffmpeg 帧提取，返回 base64[]，最多 50 帧
└── routes/
    └── analyze.ts        ← 所有路由（见下方 API 表）
```

**AI 切换**：修改 `.env` 中的 `AI_PROVIDER`（`claude` 或 `openai`），无需改代码。

---

## API 接口

| 方法 | 路径 | 说明 | 文件上传字段 |
|------|------|------|------------|
| GET | `/api/health` | 服务健康检查 | — |
| POST | `/api/chat` | 纯文字对话 | — |
| POST | `/api/chat/image` | 图片对话（最多 10 张） | `images[]` |
| POST | `/api/analyze` | 视频帧提取 + 分析 | `video` |
| GET | `/api/compare/players` | 获取职业球员列表 | — |
| POST | `/api/compare` | 两段视频对比 或 职业球员对比 | `videoA`, `videoB`（可选） |

**`/api/compare` 三种模式**（通过请求字段区分）：
- `videoA` + `videoB` → 两段视频对比
- `videoA` + `playerName` → 与指定球员对比
- `videoA` + `recommendStyle=true` → 推荐相似风格球员

---

## 本地开发

```bash
# 前提：系统已安装 ffmpeg
cp .env.example .env   # 填入 API Key
pnpm install
pnpm dev               # 前端 :5173，后端 :3001 同时启动
```
