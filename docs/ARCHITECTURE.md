# 架构文档

## 研发 TODO 在哪里

`TODO.md` → `## 研发 TODO` 区块。改代码前先去那里认领任务或新增条目。

---

## 项目结构

```
tennis-coach/
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

## 认证系统

**技术选型**：PostgreSQL（`pg` node-postgres）+ JWT（`jsonwebtoken`）+ 密码哈希（`bcryptjs`）

**连接方式**：通过 `DATABASE_URL` 环境变量（标准 PostgreSQL 连接字符串），使用连接池（`pg.Pool`）。

**新增文件**：
```
packages/agent/src/
├── db.ts                        ← pg Pool 初始化，initDb() 建表（users/sessions/messages/technique_profile）
├── middleware/
│   ├── authMiddleware.ts        ← JWT 验证中间件（强制）
│   └── extractUser.ts          ← JWT 提取（可选，不强制登录）
├── services/
│   ├── storage.ts              ← Supabase Storage 上传帧图片
│   ├── sessionSaver.ts         ← 创建/更新 session、保存 message
│   └── techniqueExtractor.ts  ← AI 提取技术标签，upsert technique_profile
└── routes/
    ├── auth.ts                 ← 注册/登录/Profile/Token CRUD
    ├── sessions.ts             ← 会话列表/详情/删除
    └── profile.ts              ← 技术档案读取
```

**数据库完整表结构**：
```sql
-- 用户会话（每次对话/分析为一个 session）
CREATE TABLE sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'chat',  -- 'chat'|'analyze'|'compare'
  title      TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 会话内消息
CREATE TABLE messages (
  id         SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  frame_urls TEXT[] NOT NULL DEFAULT '{}',  -- Supabase Storage 公开 URL
  created_at BIGINT NOT NULL
);

-- 用户技术档案（自动累积）
CREATE TABLE technique_profile (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  strengths  TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  style_tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at BIGINT NOT NULL
);
```

**Supabase Storage**：
- Bucket 名：`tennis-frames`（需设为 Public）
- 路径格式：`{userId}/{sessionId}/{frameIndex}.jpg`
- 环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- 未配置时自动跳过，不影响其他功能

**数据库表**：
```sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key       TEXT NOT NULL DEFAULT '',
  api_provider  TEXT NOT NULL DEFAULT 'claude',
  created_at    BIGINT NOT NULL
)
```

**JWT**：
- 签发后有效期 30 天
- Payload: `{ userId, email }`
- 客户端存 `localStorage`，请求头带 `Authorization: Bearer <token>`

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
| POST | `/api/auth/register` | 注册（email + password） | — |
| POST | `/api/auth/login` | 登录，返回 JWT | — |
| GET | `/api/auth/me` | 获取当前用户信息（需 JWT） | — |
| PUT | `/api/auth/api-token` | 更新/保存个人 API Token（需 JWT） | — |

**`/api/compare` 三种模式**（通过请求字段区分）：
- `videoA` + `videoB` → 两段视频对比
- `videoA` + `playerName` → 与指定球员对比
- `videoA` + `recommendStyle=true` → 推荐相似风格球员

---

## 多语言（i18n）

**文件**：`packages/web/src/i18n.ts`

- 支持语言：`zh`（中文）、`en`（英文）
- 检测顺序：localStorage `tc_lang` → `navigator.language` → 默认 `zh`
- 导出 `type Lang`、`TRANSLATIONS`、`detectLang()`
- 在 App.tsx 中用 `const t = TRANSLATIONS[lang]` 按 key 取文字
- HistorySidebar 接收 `lang: Lang` prop

**AI 对话语言强制**：
- 前端通过 `X-Language` header 传递语言（`zh` 或 `en`）
- 后端 `resolveChat()` 读取并传入 `ChatOptions.language`
- `buildSystemPrompt(coachStyle, language)` 追加强制语言指令：
  - `en`：`"You MUST respond in English only."`
  - `zh`：`"请始终用中文回复。"`



```bash
# 前提：系统已安装 ffmpeg
cp .env.example .env   # 填入 API Key
pnpm install
pnpm dev               # 前端 :5173，后端 :3001 同时启动
```
