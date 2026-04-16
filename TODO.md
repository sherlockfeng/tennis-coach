# TODO

> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 已完成

---

## 产品 TODO

> 由产品 agent（资深网球教练身份）维护。设计完成后，将对应任务拆解到研发 TODO 和测试 TODO。

- [x] 文字对话 + 图片上传分析
- [x] 视频帧提取 + 动作分析
- [x] 两段视频对比（改进前后）
- [x] 与职业球员对比 + 相似风格推荐
- [ ] 拍摄指引：什么角度、距离最适合分析？做成上传前的引导提示
- [ ] 练习日记：每次分析后自动生成日记条目，学员可回顾
- [ ] 用户账号：登录后日记和历史记录与账号绑定
- [ ] 进步追踪：同一动作类型的历史对比时间轴
- [ ] 教练端：教练查看绑定学员记录、添加批注
- [ ] 评分机制评估：是否对动作打分（暂缓，见 PRODUCT.md 设计决策）

---

## 研发 TODO

> 由研发 agent 维护。改代码前先认领此处任务，完成后标记。

- [x] pnpm workspace monorepo 基础结构
- [x] React + Vite 前端，Tailwind 暗色主题
- [x] Express + ffmpeg 后端，帧提取服务
- [x] Claude / OpenAI 可配置切换
- [x] 视频面板三模式（单段分析 / 两段对比 / 职业对比）
- [x] 图片多张上传（最多 10 张）
- [x] 视频时长自动读取（onLoadedMetadata）
- [x] 对话历史跨请求保持
- [ ] 视频上传进度条（大文件上传时无反馈）
- [ ] 后端队列：大文件处理异步化，WebSocket 推送进度
- [ ] 用户账号系统（JWT，注册/登录/Profile）
- [ ] 练习日记数据库（PostgreSQL 或 SQLite）
- [ ] API 限流（防止滥用）
- [ ] 环境变量 zod schema 校验（替换手动 validateConfig）
- [ ] 结构化日志（替换 console.log）
- [ ] 移动端响应式布局优化

---

## 测试 TODO

> 由测试 agent 维护。写对抗性测试为主，主动发现问题。详细方案见 `docs/TESTING.md`。

- [x] 后端 config 校验单元测试
- [x] 后端 systemPrompt 内容完整性测试
- [x] 后端 /chat 路由正常 + 异常响应测试
- [x] 前端 E2E：布局渲染、消息发送、视频面板开关、新对话重置
- [ ] 后端 /analyze：损坏视频文件的错误处理
- [ ] 后端 /analyze：startSec >= endSec 非法参数
- [ ] 后端 /analyze：视频时长 0 秒或极短
- [ ] 后端 /compare：缺少 videoA 时 400 响应
- [ ] 后端 /compare：recommendStyle + playerName 同时传时的处理
- [ ] 后端 /chat/image：超过 10 张图片时的处理
- [ ] 后端 /chat/image：非图片文件伪装为图片上传
- [ ] 前端 E2E：视频对比模式 Tab 切换
- [ ] 前端 E2E：职业球员选择 + 提交
- [ ] 前端 E2E：API 超时时错误提示展示
- [ ] 前端 E2E：loading 期间按钮禁用，防止重复提交
