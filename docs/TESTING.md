# 测试方案文档

## 测试 TODO 在哪里

`TODO.md` → `## 测试 TODO` 区块。每次写完新功能，先去那里认领或新增测试任务，再开始写测试。

---

## 测试原则

**测试由独立 subagent 编写**，不由实现功能的同一 agent 负责。测试 subagent 的目标是"找出问题"，而不是"证明功能正确"。

每次新增功能后，测试 subagent 必须覆盖：
1. 正常路径（happy path）
2. 边界情况（boundary）
3. 对抗性测试（adversarial）——主动构造异常输入，让功能出错

---

## 测试分层

### 后端单元测试（Vitest）

**文件位置**：`packages/agent/src/__tests__/`

**运行方式**：
```bash
pnpm --filter @tennis-coach/agent test        # 单次运行
pnpm --filter @tennis-coach/agent test:watch  # 监听模式
```

**现有测试文件**：

| 文件 | 覆盖范围 |
|------|----------|
| `config.test.ts` | 环境变量校验、缺 key 时抛错 |
| `systemPrompt.test.ts` | Prompt 内容完整性（球员知识、器材建议等） |
| `routes.test.ts` | API 路由正常/异常响应，mock AI 和 ffmpeg |

**新增测试文件命名规范**：`<模块名>.test.ts`，放在同一目录。

---

### 前端 E2E 测试（Playwright）

**文件位置**：`packages/web/e2e/`

**运行方式**：
```bash
pnpm --filter @tennis-coach/web test:e2e       # headless
pnpm --filter @tennis-coach/web test:e2e:ui    # 可视化调试
```

**现有测试文件**：`app.spec.ts`

所有网络请求用 `page.route()` mock，不依赖真实后端。

---

## 如何设计测试 Case

### 对抗性测试清单（写新功能时必须对照）

**输入层**
- 空文件 / 0 字节文件
- 超出大小限制的文件（视频 >500MB，图片 >20MB）
- 错误文件类型（如把 `.txt` 改名为 `.mp4` 上传）
- 损坏的视频文件（ffmpeg 无法解析）
- 视频时长为 0 或极短（<1 秒）
- startSec >= endSec 的非法时间范围
- fps 为 0 或负数

**API 层**
- 缺少必填字段（如不传 `messages`）
- `messages` 为空数组
- history 字段为非法 JSON
- 同时上传超过限制数量的文件
- 请求体过大（超出 express json 限制）

**AI Provider 层**
- API Key 无效（401 错误）
- API 超时（模拟 30s+ 无响应）
- API 返回空内容
- 网络断开

**前端层**
- 发送按钮在 loading 时被连续点击
- 上传视频后立即切换模式
- 大量消息历史时的滚动性能
- 网络错误时的错误提示展示

### Case 编写模板

```typescript
describe('功能模块名', () => {
  describe('正常路径', () => {
    it('描述预期行为', async () => { ... })
  })

  describe('边界情况', () => {
    it('空输入时返回 400', async () => { ... })
    it('最大合法输入时正常处理', async () => { ... })
  })

  describe('对抗性测试', () => {
    it('损坏文件时返回有意义的错误信息', async () => { ... })
    it('API 超时时前端显示错误提示', async () => { ... })
  })
})
```
