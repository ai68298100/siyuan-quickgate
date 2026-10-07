# 快门当前状态（自动快照）

> 由 `node scripts/current-status.mjs` 生成于 2026-10-07 20:33。再跑即刷新；不手改本文件。

## 版本与构建

| 项 | 值 |
|---|---|
| 分支 / HEAD | `main` / `bf3853b` |
| 源码版本 | `0.8.5` |
| 最新 tag | `v0.8.5` |
| 远端 release tag（本地探测） | `v0.8.5` |
| dist/index.js | 存在（构建于 2026-10-07 12:31） |
| 工作区未提交项 | 0 个（git status --short） |

## 质量门（快照时点声明，权威以最近一次运行输出为准）

| 门 | 状态 |
|---|---|
| tsc --noEmit | ✓（生成时点通过） |
| vitest（tests/） | 以最近一次 `pnpm test` 输出为准（快照不硬编码数量） |
| check 链（含数字门禁） | ✓（生成时点通过） |

## 通道与入口

| 通道 | 说明 |
|---|---|
| 命令面板 | Ctrl+Alt+P 或 命令「小驴快门：命令面板」 |
| NDJSON 桥 | `data/storage/petal/siyuan-quickgate/bridge/commands.ndjson`（默认关） |
| 内核路由 | `POST /plugin/private/siyuan-quickgate/exec`（随 petal 启用） |
| MCP stdio | `node src/mcp/main.ts`（27 tools，默认 14 只读） |
| 设置面板 | 设置 → 集市 → 已下载 → 小驴快门 → 齿轮 |

## 文档

- 使用：[docs/GETTING-STARTED.md](./GETTING-STARTED.md) · [FAQ](./FAQ.md)
- 契约：[docs/api.md](./api.md) · [docs/contracts/](./contracts/)
- 变更：[CHANGELOG.md](https://github.com/ai68298100/siyuan-quickgate/blob/main/CHANGELOG.md) · [PROGRESS](./PROGRESS.md)
