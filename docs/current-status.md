# 快门当前状态（自动快照）

> 由 `node scripts/current-status.mjs` 生成于 2026-10-06 07:45。再跑即刷新；不手改本文件。

## 版本与构建

| 项 | 值 |
|---|---|
| 分支 / HEAD | `main` / `4f0d47d` |
| 源码版本 | `0.7.5` |
| 最新 tag | `v0.7.5` |
| 远端 release tag（本地探测） | `v0.7.5` |
| dist/index.js | 存在（构建于 2026-10-05 23:32） |
| 工作区未提交项 | 58 个（git status --short） |

## 质量门（快照时点声明，权威以最近一次运行输出为准）

| 门 | 状态 |
|---|---|
| tsc --noEmit | ✓（生成时点通过） |
| vitest（tests/） | 210 基线 + 增量（R310 时点 210；权威数字跑 `pnpm test`） |
| check 链（含数字门禁） | ✓（生成时点通过） |

## 通道与入口

| 通道 | 说明 |
|---|---|
| 命令面板 | Ctrl+Alt+P 或 命令「小驴快门：命令面板」 |
| NDJSON 桥 | `data/storage/petal/siyuan-quickgate/bridge/commands.ndjson`（默认关） |
| 内核路由 | `POST /plugin/private/siyuan-quickgate/exec`（随 petal 启用） |
| MCP stdio | `node src/mcp/main.ts`（26 tools，默认 14 只读） |
| 设置面板 | 设置 → 集市 → 已下载 → 小驴快门 → 齿轮 |

## 文档

- 使用：[docs/GETTING-STARTED.md](./GETTING-STARTED.md) · [FAQ](./FAQ.md)
- 契约：[docs/api.md](./api.md) · [docs/contracts/](./contracts/)
- 变更：[CHANGELOG.md](../CHANGELOG.md) · [PROGRESS](./PROGRESS.md)
