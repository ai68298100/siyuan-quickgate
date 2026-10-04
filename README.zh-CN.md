# 小驴快门（Lv QuickGate）

[English](./README.md)

[![Version](https://img.shields.io/badge/version-0.7.3-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**小驴快门**是[思源笔记](https://b3log.org/siyuan)的**小驴生态联动中枢 + 外部网关**：Quicker、手机快捷指令、CLI、PowerShell、AI 助手、HA 脚本以及小驴系插件，共用同一套公开契约（26 个 op）——

- `commands.*` — 发现/搜索/执行任意已装插件的命令面板条目（默认确认门控 + 审计）
- `checkin.*` / `contacts.*` — 向小驴打卡（API v5）、小驴人脉（bridge v1）的公开桥做结构化透传
- `registry.list` / `diagnostics.report` / `config.discover` — 小驴生态七插件清单（成熟度×实装版本）、脱敏诊断、日记笔记本自动发现
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

> **集市状态：暂缓上架**。当前唯一分发渠道是 GitHub Release：下载 `package.zip` → 思源「设置 → 集市 → 下载页 → 右上角菜单 → 导入安装包」。

## 手动安装

1. 从[最新 Release](https://github.com/ai68298100/siyuan-quickgate/releases/latest) 下载 `package.zip`。
2. 思源 → 设置 → 集市 → 下载页 → 右上角菜单 → **导入安装包**。
3. 启用插件，打开设置，将**外部命令桥**打开（产品默认关闭）。

## 协议

每插件一组 NDJSON 文件，位于 `data/storage/petal/<插件>/bridge/`：

```
commands.ndjson   # 客户端 → 插件，每行一个 JSON 信封
results.ndjson    # 插件 → 客户端，最近 200 条回执滚动窗口
events.ndjson     # 公开宿主事件流（快门代打卡物化：记录/删除标记）
```

信封：`{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}`；回执按 `id` 对应，`status ∈ recorded|duplicate|rejected|failed|unsupported|expired`。完整契约见 [docs/api.md](./docs/api.md)，机器可读版 [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json)（op 面由 `src/ops.ts` 单一来源 + 一致性测试强制对齐）。

[`tools/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/tools) 内置两个零依赖客户端（node CLI：`ping/send/run/events/exec/fast`；PowerShell：`-Exec` 直呼内核路由、`-Fast` 走广播）；Quicker 子程序走同一信封。

### 面向 AI 助手：MCP

[`src/mcp/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/src/mcp) 把 26 个 op 经 stdio 暴露为 MCP tools——AI 客户端可以直接执行思源命令、记打卡、记人脉互动、跑受控工作流，这是任何内置 MCP server 都没有覆盖的能力面（差异化论证见项目文档 docs/10 §3.14）。

- **默认只暴露 14 个只读工具**；写工具在设置 `LV_MCP_WRITE=1` 前不进列表（直接调用会被诚实拒绝）

### 思源内置 Agent 集成（自动，零配置）

思源 ≥3.8.6 下，插件经 `siyuan.agent.registerCapability` 向**内置 AI Agent** 原生注册三个能力：`quickgate_ping`（健康探针）、`quickgate_discover`（日记笔记本+收集箱发现）、`quickgate_capture`（一句话追加今日日记）——Agent 侧可见为 `plugin__siyuan-quickgate__*` 工具并带效果声明，无需任何配置。也可把 Agent 的外部 MCP 设置指向本仓库的 MCP stdio 服务获得全部 26 工具面（详见 docs/10-生态调研-R4.md）。
- `plugin.api` / `workflow.execute` 额外标注 `destructiveHint`
- 快门侧防线全部共用：确认门控、黑名单、审计日志、plugin.api 允许名单

```json
{ "mcpServers": { "lv-quickgate": {
    "command": "node",
    "args": ["<仓库路径>/src/mcp/main.ts"],
    "env": { "SIYUAN_TOKEN": "<token>" }
} } }
```

## 安全

- 桥**默认关闭**；`commands.run` 弹思源确认框（30 秒超时=拒绝），全部执行入审计。
- `plugin.api` 原始透传默认关闭且有允许名单（窗口桥映射来自生态清单，非硬编码）。
- 中枢只消费公开注册能力与公开桥方法，**不读取任何插件的私有存储**。
- 事件流为 append-only，删除以标记行表达（消费方按幂等键配对）；高频心跳事件（analytics-updated）被明确排除在物化外（D-0011）。

## 状态与路线

- **v0.1.0** 桥核心 + 适配器 + 设置页 + 单测 → **v0.2.0** 生态中枢（manifest/registry/diagnostics）→ **v0.3.0** 可靠性收尾（template.new/15s 上限/设备名/诊断包）→ **v0.4.x** events/workflow 实现 + 打卡宿主事件桥接 → **v0.5.x** 内核同步通道（实验性）、事件订阅通道修正（window CustomEvent）、可观测性统计、生态清单按远端 main 校准、event-deleted 物化 → **v0.6.x** 已部署真机（3.8.5）并启用：config.discover 真机校准（dailyNoteSavePath 驼峰+非默认模板优先）、v1.5 广播快路径（SSE 毫秒级命令通道，默认关，双通道预留语义防重放）、前端假设 bundle 静态核实（editor.context docId 修复、registry customHotkey 生效键）→ **v0.7.x** 面向 AI 助手的 MCP stdio 服务器（23 op 即 tools，默认 13 只读，订阅断连自愈）、内核同步路由 3.8.6 真机全线打通（bug#9 kernels 字段修复）、验收入口收敛（npm run accept / verify:restart）。 → **v0.7.3** R69/R70 池清账（八处正确性修复+版本/发布双门禁）、真机验收 10/10 全绿（⑪事件物化闭环/v1.5 快路径 146ms）、bug#11/12/13（压缩逃逸/202 错误信封/动态 import 渲染进程炸）、事件治理收紧（白名单 8→2）
- 真机验证（M0 spike ①~⑪）进度见 [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)（内核侧+①②⑦ 已坐实），路线见 [docs/ROADMAP.md](./docs/ROADMAP.md)，决策记录见 [docs/DECISIONS.md](./docs/DECISIONS.md)（D-0001~D-0015）。

## 开发

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm accept  # 验收门：单测(155) + MCP 协议冒烟(7)
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # 软链进工作空间联调
```

部署并重启思源后，跑 `npm run verify:restart`（可加 `SIYUAN_LOG=<工作空间>/temp/siyuan.log` 附产日志增长读数）——一次产出完整验收数据：桥端到端延迟、内核路由 op、事件物化计数、广播存活、v1.5 快路径延迟、MCP 内核路由、内核日志增长。

许可证：[MIT](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) · 作者：[@ai68298100](https://github.com/ai68298100)
