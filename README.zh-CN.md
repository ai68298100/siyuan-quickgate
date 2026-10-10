<div align="center">

<img src="./icon.png" width="88" alt="小驴快门" />

# 小驴快门（Lv QuickGate）

**思源笔记的小驴生态联动中枢 + 外部网关** —— Quicker / 快捷指令 / CLI / AI 助手共用同一套公开契约（39 op）

[English](./README.md) · [上手指南](./docs/GETTING-STARTED.md) · [op 契约](./docs/api.md) · [AI 客户端矩阵](./docs/ai-clients.md) · [下载安装](https://github.com/ai68298100/siyuan-quickgate/releases)

[![CI](https://github.com/ai68298100/siyuan-quickgate/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai68298100/siyuan-quickgate/actions/workflows/ci.yml) [![Version](https://img.shields.io/badge/version-0.9.2-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

<img src="./preview.png" alt="分层设置面板 · 命令面板 · 四中心" width="820" />

</div>

Quicker、手机快捷指令、CLI、PowerShell、AI 助手、HA 脚本以及小驴系插件，共用同一套公开契约（39 个 op）——

- `commands.*` — 发现/搜索/执行任意已装插件的命令面板条目（默认确认门控 + 审计；搜索支持中英/拼音别名，如「打卡/daka/checkin」互达）
- `checkin.*` / `contacts.*` — 向小驴打卡（API v5）、小驴人脉（bridge v1）的公开桥做结构化透传
- `glean.*` / `home.*` / `exam.*` — 拾遗读库（列表/详情/五态改状态，写面受拾遗侧桥写开关门控）、管家提醒有界计数与快速备忘、考试脱敏统计与练习台入口
- `favorites.*` — 收藏与最近使用（命令面板体验：去重前移、隐私清除，载体独立于桥文件）
- `registry.list` / `diagnostics.report` / `config.discover` — 小驴生态插件清单（成熟度×实装版本）、脱敏诊断、日记笔记本+收集箱自动发现
- `events.list` / `events.pull` — 白名单事件流（打卡记录/删除已自动物化；删除标记以 `:deleted` 幂等后缀与原行共存）
- `workflow.plan` / `workflow.execute` — 受控编排（≤8 步、白名单 op、总确认 30s、失败停止不回滚）
- `template.new` / `doc.open` / `daily.status` / `editor.context` / `setting.open` — 模板建文档、受控导航、编辑器上下文
- `plugin.api` — 原始桥方法透传（默认关 + 允许名单 + manifest 驱动窗口桥映射）

**三通道**（同一信封、共用一份幂等台账）：

| 通道 | 延迟 | 覆盖 | 说明 |
|---|---|---|---|
| NDJSON 桥（默认主路径） | ~750ms @ 500ms 轮询 | 全部 op | 异步；文件位于 `data/storage/petal/<插件>/bridge/` |
| 内核同步路由（v0.5.0） | ~100ms | 内核可处理子集（7 op） | `POST /plugin/private/siyuan-quickgate/exec`；**外部命令桥关闭时也可用** |
| 广播快路径 v1.5（v0.6.0） | ~10–100ms | 全部前端 op | SSE 订阅 `qg-cmd` 频道；默认关；与 NDJSON 共用台账的预留语义防双执行 |

> **集市状态：暂缓上架**。当前唯一分发渠道是 GitHub Release（见下方安装）。

## 插件内 UI（思源侧）

观感对齐 [design/ui-prototype/mvp1.html](./design/ui-prototype/mvp1.html)（全部 `--b3-*` 令牌、亮暗随宿主主题，不硬编码颜色）：

- **分层设置面板**：状态概览（健康首页：通道卡片 / 运行 KPI / 下一步 / 最近回执）· 首跑向导（**七步可恢复状态机**：环境检查→选择能力→桥权限→连接探针→样例只读→可选样例写入→完成；wizard-state.json 续跑；样例写入可撤销）· 连接与通道 · 安全与权限 · 队列与数据（含**全量备份/恢复**与清空队列预览）· 诊断与生态 · 关于；顶部搜索条**跨分组过滤**设置项。
- **命令面板**（`Ctrl+Alt+P`）：搜索宿主命令（中英/拼音别名，收藏★/最近自动置顶）；「能力动作」二段式（先填参数后执行，写动作双档标注）；空结果兜底 = 一句话**快速捕获**到今日日记 / 收集箱。
- **通知中心 / 恢复中心 / 回执中心**：待关注事态聚合（一键跳转处理面）· unknown/失败/过期回执的人工处置（换新 id 重试 / 放弃并记录 / 批量）· `results.ndjson` 查询（状态/时间筛选、关键词、分页、导出 CSV/JSON）。
- **失联检测与接管**：他窗持有消费权时显示心跳状态；卡死嫌疑/高度失联可一键接管（台账防双执行）。

## 手动安装

1. 从 [Releases](https://github.com/ai68298100/siyuan-quickgate/releases) 下载 `package.zip`（带 prerelease 标记的为公开测试版；GitHub 会在资产详情显示 SHA-256 digest）。v0.9.0 起为正式版（非 prerelease），直接选择最新 release 即可。
2. 思源 → 设置 → 集市 → 下载页 → 右上角菜单 → **导入安装包**。
3. 启用插件，打开设置，将**外部命令桥**打开（产品默认关闭）。
4. **更新版本后需完全退出思源（托盘右键退出）再启动**——窗口重开不会刷新插件前端代码；可双击工作区的 `重启思源.bat`（仓库 `tools/restart-siyuan.bat`）一键完成。

## 协议

每插件一组 NDJSON 文件，位于 `data/storage/petal/<插件>/bridge/`：

```
commands.ndjson   # 客户端 → 插件，每行一个 JSON 信封
results.ndjson    # 插件 → 客户端，最近 200 条回执滚动窗口
events.ndjson     # 公开宿主事件流（快门代打卡物化：记录/删除标记）
```

信封：`{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}`；回执按 `id` 对应，`status ∈ recorded|duplicate|rejected|failed|unsupported|expired`。完整契约见 [docs/api.md](./docs/api.md)，机器可读版 [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json)（op 面由 `src/ops.ts` 单一来源 + 一致性测试强制对齐）。

[`tools/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/tools) 内置零依赖客户端（node CLI：`ping/send/run/events/exec/fast`；PowerShell：`-Exec` 直呼内核路由、`-Fast` 走广播）与 `restart-siyuan.bat`（部署后一键安全重启思源）；Quicker 子程序走同一信封。

### 面向 AI 助手：MCP

[`src/mcp/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/src/mcp) 把 39 个 op 经 stdio 暴露为 MCP tools——AI 客户端可以直接执行思源命令、记打卡、记人脉互动、跑受控工作流，并补充思源内置 MCP 未覆盖的小驴生态动作；协议与安全模型见 [MCP 指南](./src/mcp/README.md)。

- **默认只暴露 22 个只读工具**；写工具在设置 `LV_MCP_WRITE=1` 前不进列表（直接调用会被诚实拒绝）
- `plugin.api` / `workflow.execute` 额外标注 `destructiveHint`
- 快门侧防线全部共用：确认门控、黑名单、审计日志、plugin.api 允许名单

```json
{ "mcpServers": { "lv-quickgate": {
    "command": "node",
    "args": ["<仓库路径>/src/mcp/main.ts"],
    "env": { "SIYUAN_TOKEN": "<token>" }
} } }
```

### 思源内置 Agent 集成（自动，零配置）

思源 ≥3.8.6 下，插件经 `siyuan.agent.registerCapability` 向**内置 AI Agent** 原生注册三个能力：`quickgate_ping`（健康探针）、`quickgate_discover`（日记笔记本+收集箱发现）、`quickgate_capture`（一句话追加今日日记）——已实证进入 Agent 模型工具面（`/api/ai/lsCapabilities` 可见），无需任何配置。也可把 Agent 的外部 MCP 设置指向本仓库的 MCP stdio 服务获得全部 27 工具面——完整指南（含 ai.mcp.servers 字段级挂法与审批策略）：[docs/agent-integration.md](./docs/agent-integration.md)。

## 安全

- 桥**默认关闭**；`commands.run` 弹思源确认框（30 秒超时=拒绝），全部执行入审计。
- `plugin.api` 原始透传默认关闭且有允许名单（窗口桥映射来自生态清单，非硬编码）。
- 中枢只消费公开注册能力与公开桥方法，**不读取任何插件的私有存储**。
- 事件流为 append-only，删除以标记行表达（消费方按幂等键配对）；高频心跳事件（analytics-updated）被明确排除在物化外（D-0011）。

## 状态与路线

| 版本 | 里程碑 |
|---|---|
| v0.1~v0.3 | 桥核心 + 适配器 + 设置页 + 单测 → 生态中枢（manifest/registry/diagnostics）→ 可靠性收尾（template.new/15s 上限/设备名/诊断包） |
| v0.4~v0.6 | events/workflow + 打卡宿主事件桥接 → 内核同步通道（实验性）→ 真机部署（3.8.5）+ v1.5 广播快路径 + bundle 静态核实 |
| v0.7.0~0.7.3 | MCP stdio 服务器（AI 助手）+ 内核路由 3.8.6 真机打通（bug#9）+ 验收入口收敛 → 池清账八处正确性修复 + 版本/发布双门禁 + bug#11/12/13 |
| **v0.7.4** | **template.new 路径穿越安全修复**（三通道守卫）+ 收藏/最近使用全链 + **思源内置 Agent 原生三能力**（零配置）+ 并发正确性（幂等注册表/桥消费权认领/多写者竞态缓解）+ 契约 23→27 op + manifest v2（真机校准） |
| **v0.7.5** | 发布链补强：package.zip 解包断言（bug#9 回归门）+ Agent 集成指南 + 重启工具 + bug#17 登记（lifecycle 钩子噪音，功能零影响） |
| **v0.8.0** | **首跑七步可恢复状态机**（wizard-state.json 续跑、样例只读/写入可撤销）· **失联检测与接管**（heartbeat + Web Locks steal）· **workflow.cancel 取消通道**（每步开始前检查点，已完成步骤保留）· 天数保留 retentionDays（默认关）· 备份来源设备 + 收藏合并导入 · UI 对齐原型打磨 |
| **v0.8.1** | CI/发布可复现性加固 · MCP 冒烟计数改为跟随单一 op 清单 · Dependabot 与 GitHub Issue/PR 流程整理 · 中英文文档与安全策略更新 |
| **v0.8.2** | 入口、设置页、诊断包统一读取运行时版本源 · 容器 E2E 改为严格门禁，补齐健康探测、Token 脱敏与失败诊断资产 |
| **v0.8.3** | 诊断包加入会话健康快照 · 命令面板空态键盘安全 · combobox/listbox 无障碍关联 · E2E 启动就绪判定加固 |
| **v0.8.4** | SSE 帧/丢弃/错误指标与会话隔离健康快照 · 一键复制健康快照 · 空态动作键盘导航 · E2E 独立卷与清理 |
| **v0.8.5** | SSE 断流时保留无换行尾帧 · 仅统计可读连接 · 空态选项补齐读屏语义 |
| **v0.8.6** | 释放消费锁前等待进行中的桥 tick · 卸载和热重载时保留审计与运行统计 |
| **v0.8.7** | 修复命令超过 100 条时能力动作的键盘执行偏移 · 清除无效动态导入构建警告 |
| **v0.8.8** | 串行化桥启停过渡 · 释放接管超时后的迟到 Web Lock · 补齐设置页读屏控件名称 |
| **v0.9.0** | **UI 全面打磨**：设置面板/命令面板/四中心对齐原型（配色证据化求解 ≥4.5:1、窄屏与触屏适配、交互 e2e 13 项真机断言）· 修复捕获撤销误报失败 · 设置搜索命中高亮 · 全新图标与品牌视觉 |
| **v0.9.2** | **生态适配收尾 35→39 op**：小驴常用 window.xiaolvCommon v1 落地（上游 0.4.0 · ADR-0013 只读子集）并接入 common.search/get/recent/favorites（全部只读；manifest 8 款全 stable/design 双轨齐整） |
| **v0.9.1** | **生态适配扩展 27→35 op**：拾遗 siyuanGlean v1 / 管家 LvHome v1 / 考试 siyuanExam 接入（glean.*/home.*/exam.*）· manifest 校准（三家 design→stable + 补录 xiaolv-common，清单 8 款）· AI 客户端接入矩阵（docs/ai-clients.md）+ 工具 schema 导出器 |

真机验证（M0 spike ①~⑪）进度见 [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)，路线见 [docs/ROADMAP.md](./docs/ROADMAP.md)，决策记录见 [docs/DECISIONS.md](./docs/DECISIONS.md)（D-0001~D-0015）。

## 开发

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm accept  # 验收门：单测 + MCP 协议冒烟（协议层 6 项；真实 bridge.ping 另加 1 项环境检查）
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # 软链进工作空间联调
```

部署后重启思源（或双击 `tools/restart-siyuan.bat`），再跑：

- `corepack pnpm run verify:restart`（可加 `SIYUAN_LOG=<工作空间>/temp/siyuan.log`）——完整验收数据：桥端到端延迟、内核路由 op、事件物化计数、广播存活、v1.5 快路径延迟、MCP 内核路由、内核日志增长。
- `corepack pnpm run verify:bg` —— 后台走查 7 项（含「前端 bundle 判别」：部署 index.js 后必须完全退出重启，该项应 pass）。

许可证：[MIT](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) · 作者：[@ai68298100](https://github.com/ai68298100)
