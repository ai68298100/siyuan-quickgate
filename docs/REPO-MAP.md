# REPO-MAP — 设计仓库 ↔ 实现仓库映射表（R69·账本）

> 目的：两仓库分工的权威索引。设计仓库（本仓库）=产品设计+规划+账本；实现仓库=源码+发布。
> 维护：实现仓库版本/tag/结构变化时更新本表「当前值」列。

## 仓库映射

| 项 | 值 |
|---|---|
| 实现仓库 | `D:\AI\Codex\siyuan-quickgate`（GitHub: ai68298100/siyuan-quickgate，main） |
| 当前版本 | v0.7.3（tag 已推；plugin.json/package.json/src 三处门禁一致） |
| 分支策略 | main 直推（个人项目）；CI 门=tsc+124 单测+smoke+check:release+check:version |
| 小驴快门 pluginId | `siyuan-quickgate` |
| 部署目标 | `<工作区>/data/plugins/siyuan-quickgate/`（工作区如 `D:\小飞驴的SIYUAN`） |
| 部署方式 | `cp -r dist/*` + petal 开关热加载（后台 API，免重启） |
| 内核 | 思源 3.8.6 @ 127.0.0.1:6806；Token 在 `%APPDATA%\siyuan\env` |

## 权威文档映射（设计条目 → 实现仓库权威文件）

| 设计域 | 本仓库文档 | 实现仓库权威文件 |
|---|---|---|
| 桥协议 | docs/02-小驴桥协议-v1.md | src/services/envelope.ts · queue.ts · results.ts · 一致性报告 docs/protocol-consistency-2026Q4.md |
| op 契约 | docs/api.md（镜像于实现仓库 docs/api.md） | src/services/bridge-service.ts · src/ops.ts |
| 动作蓝图 | docs/03-动作蓝图.md | quicker-actions/reference/*.cs（19 件，csc 门） |
| 超级面板 | docs/05-超级面板方案.md | reference/SY-路由.cs · templates/superpanel-menu.json |
| G2 样板 | docs/25 + docs/25-observation.md | reference/g2-capture.cs · fixtures/ |
| 契约七件 | docs/contracts/*.md | 各实现文件（result=six 态/capability=manifest/reliability=D-0012/safety=红线/intent=R98/evidence=信封/release=CI 门） |
| 治理 G5 | docs/30-扩展池治理-G5.md | scripts/todo-snapshot.mjs（验收 A/B） |
| 用户文档 | —（实现仓库侧） | GETTING-STARTED.md · FAQ.md · PRIVACY.md · ACTION-CARDS.md |

## 版本历史锚点

- v0.7.3（2026-10-04）：R69/R70 池清账八处修复+真机 10/10+bug#11/12/13+事件治理收紧——CHANGELOG 详
- v0.7.2：bug#10 广播断连自愈；v0.7.1：bug#9 kernels 字段；v0.7.0：MCP stdio 三通道
- 账本：done 1027+/1389（73.5%+）；本表由 R169·账本条目建立，随版本/tag 更新
