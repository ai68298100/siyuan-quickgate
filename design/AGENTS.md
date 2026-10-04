# AGENTS.md — design/ 设计文档与产品规划（快门仓库内）

> 2026-10-05 起，原独立设计仓库（quicksrer 动作）已 subtree 并入快门仓库 `design/` 目录，两仓库合一。本目录 = 设计+规划+账本；仓库根 = 源码+发布。改动都在本仓库一个 git 历史里，无需双边同步。

## 目录结构（均相对 `design/`）

| 路径 | 内容 |
|---|---|
| `TODO.md` | 总账本（662+ 条目，含 21 个调研章节 §13~§21） |
| `docs/01~13` | 核心设计文档（调研/协议/蓝图/API/面板/合同/评审/发布） |
| `docs/14~22` | 产品调研系列（R80~R160 候选池，只调研与登记） |
| `docs/25~30` | 治理规格（G2 样板/G3 AI 路线/G4 作者链/G1 可靠观测/G6 发布证据/G5 扩展池） |
| `docs/contracts/` | 设计侧合同文档（result-contract 等；源码侧契约在根 `docs/contracts/`） |
| `docs/25-observation.md` | G2 样板用户观察表（直接填写） |
| `quicker-actions/` | Quicker 动作导出归档 + C# 参考实现六件 |
| `scripts/` | 账本快照工具 |
| `snapshot/` | 机器可读 TODO 快照（todo-snapshot.mjs 产出） |
| `templates/` | 超级面板菜单模板 |

## 常用命令

```bash
node design/scripts/todo-snapshot.mjs --write   # 刷新账本快照（R123 验收 A/B 内建）
```

## 关键约定

1. **同仓分工**：仓库根 = 源码+发布；`design/` = 设计+规划+账本。历史设计提交经第二父分支可溯（`git log --oneline f84f71b^2`）。
2. **TODO 条目格式**：`- [ ] 【Rxx-Gx-Px·主题·类型】内容；验收...`（八种历史格式谱系，快照工具已兼容）
3. **九文档面 checklist**：README×2 / CHANGELOG / PROGRESS / api.md+ROADMAP / WALKTHROUGH / 事实表 / AGENTS.md
4. **并行会话**：可能有多会话同时工作——改前 `git status/diff` 核对归属；对活跃共享文件只追加不重构
5. **证据等级**：E0 假设 → E1 外部资料 → E2 静态契约 → E3 自动化测试 → E4 真机 → E5 用户结果
6. **扩展池规则**：新增调研必须关闭旧问题或说明新增证据；研究并发 ≤2

## 红线（同 quickgate）

1. 外部面默认关闭
2. 不读取任何插件的私有存储
3. 无 Token 必须被 401/403 拒绝
4. 未知不得改写为成功
5. 快门不自带模型服务、不复制业务私有库

## 关键文档

- docs/25 — G2 首个纵向样板（**下一个要做的事**）
- docs/25-observation.md — 用户观察表（搭完样板后填写）
- docs/30 — 扩展池治理与退出规则（晋升/降级/WIP/复盘）
- docs/contracts/ — 七份 v0 合同（result/capability/reliability/safety/intent/evidence/release）
- 仓库根 AGENTS.md — 快门源码侧的维护者指南（构建/测试/发版流程在那里）
