# CLAUDE.md

每次开始工作前，根据任务类型读对应文档：

| 任务类型 | 必读文档 |
|----------|----------|
| 写测试 / 补测试 | `docs/TESTING.md` |
| 产品设计 / 需求评审 | `docs/PRODUCT.md` |
| 写代码 / 改架构 | `docs/ARCHITECTURE.md` |
| 查待办 | `TODO.md` |

## 唯一规则

**任何改动，先改文档，再改代码。**

- 改功能逻辑 → 先更新 `docs/ARCHITECTURE.md` 的相关描述
- 改产品设计 → 先更新 `docs/PRODUCT.md`，再同步 `TODO.md`
- 新增测试策略 → 先更新 `docs/TESTING.md`
