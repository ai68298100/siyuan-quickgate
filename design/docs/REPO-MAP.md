# REPO-MAP — 仓库地图（R260 · 合并后单仓格局）

> 目的：单一仓库内的**权威文件索引**与运维事实表。
> 格局变更（2026-10-04）：原设计仓库已 subtree 并入本仓库 `design/` 子目录（保留全部历史）——**设计+账本与源码同仓维护**，两仓库分工表述作废。
> 维护：版本/tag/结构/部署语义变化时更新本表；本表与事实冲突时以事实为准并回改本表。

## 1. 仓库与版本

| 项 | 值 |
|---|---|
| 仓库 | GitHub: ai68298100/siyuan-quickgate（main 直推，个人项目） |
| 当前版本 | **v0.8.8**（GitHub prerelease；plugin.json/package.json/PLUGIN_VERSION 三处门禁一致；集市暂不推送） |
| CI 门 | tsc + 254 单测 + MCP smoke 6/6 + build + check:release（泄漏/链接/资产）+ check:manifest |
| 设计/账本路径 | `design/`（TODO.md 总账本 · docs/01~30 · quicker-actions/ · templates/ · scripts/ · snapshot/） |
| 账本快照命令 | `cd design && node scripts/todo-snapshot.mjs --write` |

## 2. 运维事实表（R260 刷新）

| 项 | 值 | 备注 |
|---|---|---|
| 内核 | 思源 3.8.6；多空间时真实端口非 6806（e2e-bg 自动发现，当前 14643） | Token 在 `%APPDATA%\siyuan\env` |
| 部署目标 | `<工作区>/data/plugins/siyuan-quickgate/` | 工作区如 `D:\小飞驴的SIYUAN` |
| **部署纪律（bug#15）** | **kernel.js 可热生效；index.js（前端）部署后必须完全退出思源（托盘退出）再重启**——push_reload+Electron 模块缓存使新前端代码在重启前不生效，且会杀死运行中的桥轮询 | 详细语义见 docs/13 发布节奏节 |
| 部署后验证 | `npm run verify:bg`（7 项含「前端 bundle 判别」应 pass） | 判别式=favorites.list recorded |
| petal 启用状态 | `<工作区>/data/storage/petal/petals.json`（SetPetalEnabled 持久化） | 全新工作区默认禁用+bazaar 不信任（R4 §7） |

## 3. 权威文档映射（域 → 权威文件）

| 域 | 权威文件（均在合并仓库内） |
|---|---|
| 桥协议 | design/docs/02-小驴桥协议-v1.md ↔ src/services/envelope.ts · queue.ts · results.ts |
| op 契约（27 op 单一事实源=src/ops.ts） | docs/api.md · docs/contracts/quickgate-api-v1.json · src/mcp/tools.ts（一致性测试强制） |
| 生态清单（manifest v2） | src/assets/ecosystem-manifests.json ↔ design/docs/contracts/ecosystem-manifest-contract.md · ecosystem-manifest.schema.json · design/scripts/validate-ecosystem-manifest.mjs |
| 动作蓝图与参考件 | design/docs/03-动作蓝图.md ↔ design/quicker-actions/reference/*.cs（27 件，csc 门） |
| 超级面板 | design/docs/05-超级面板方案.md ↔ design/templates/superpanel-menu.json · reference/SY-路由.cs |
| 安全门 | design/docs/contracts/safety-gate-contract.md · result-contract.md · capability-registry-contract.md · ecosystem-manifest-contract.md（C9） |
| 上游调研 | design/docs/10-生态调研-R1~R5（R2 MCP 规范 · R3 上游速记 · R4 内置 Agent · R5 v3.8.7-alpha） |
| 发布 | CHANGELOG.md · design/docs/13-版本与发布策略.md（含部署纪律）· docs/GETTING-STARTED.md |
| 账本 | design/TODO.md（总账本）+ design/snapshot/（todo-snapshot.mjs 产出） |

## 4. 版本历史锚点

- v0.8.8（2026-10-07）：桥启停串行化、迟到 Web Lock 释放、事件物化代次失效和设置页无障碍命名——CHANGELOG v0.8.8 节详
- v0.8.7（2026-10-07）：命令面板截断列表键盘执行偏移修复、构建动态导入清理——CHANGELOG v0.8.7 节详
- v0.8.6（2026-10-07）：poller 停机等待、热重载补偿启动、卸载审计/统计收尾与异常链收敛——CHANGELOG v0.8.6 节详
- v0.8.5（2026-10-07）：SSE EOF 尾帧保留、可读连接计数、命令面板空态无障碍——CHANGELOG v0.8.5 节详
- v0.7.4（2026-10-05）：R231~R258 聚合——template.new 路径穿越安全修复 + 收藏全链 + 内置 Agent 原生三能力 + 幂等注册表/桥认领/并发追加缓解 + manifest v2——CHANGELOG v0.7.4 节详
- v0.7.3（2026-10-04）：R69/R70 池清账八处修复+真机 10/10+bug#11/12/13+事件治理收紧——CHANGELOG 详
- v0.7.2：bug#10 广播断连自愈；v0.7.1：bug#9 kernels 字段；v0.7.0：MCP stdio 三通道

## 5. 已知偏差登记

- 设计文档中「两仓库分工」「设计仓库/实现仓库」表述：历史文档（docs/01~09 等）按原样保留，读时自动映射为 `design/` 前缀；本表为准入对照。
- reference 参考件 27 件（R242 手册速查表为权威对照）；「19 件」等旧数字作废。
- docs/13 「三线分记」标题沿袭旧格局（现同仓，三线仍各自演进，语义不变）。
