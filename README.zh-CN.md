# 小驴快门（Lv QuickGate）

[English](./README.md)

[![Version](https://img.shields.io/badge/version-0.5.7-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**小驴快门**是[思源笔记](https://b3log.org/siyuan)的**小驴生态联动中枢 + 外部网关**：Quicker、手机快捷指令、CLI、PowerShell、HA 脚本以及小驴系插件，共用同一套公开契约（23 个 op）——

- `commands.*` — 发现/搜索/执行任意已装插件的命令面板条目（默认确认门控 + 审计）
- `checkin.*` / `contacts.*` — 向小驴打卡（API v5）、小驴人脉（bridge v1）的公开桥做结构化透传
- `registry.list` / `diagnostics.report` / `config.discover` — 小驴生态七插件清单（成熟度×实装版本）、脱敏诊断、日记笔记本自动发现
- `events.list` / `events.pull` — 白名单事件流（打卡记录/删除已自动物化；删除标记以 `:deleted` 幂等后缀与原行共存）
- `workflow.plan` / `workflow.execute` — 受控编排（≤8 步、白名单 op、总确认 30s、失败停止不回滚）
- `template.new` / `doc.open` / `daily.status` / `editor.context` / `setting.open` — 模板建文档、受控导航、编辑器上下文
- `plugin.api` — 原始桥方法透传（默认关 + 允许名单 + manifest 驱动窗口桥映射）

**双通道**：NDJSON 桥（默认主路径，异步）+ **内核同步路由**（v0.5.0 实验性，`POST /plugin/private/siyuan-quickgate/exec` 同步处理内核可处理的 op 子集，无需前端窗口在线）。

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

[`tools/`](./tools) 内置两个零依赖客户端（node CLI：`ping/send/run/events/exec`；PowerShell：`-Exec` 直呼内核路由）；Quicker 子程序走同一信封。

## 安全

- 桥**默认关闭**；`commands.run` 弹思源确认框（30 秒超时=拒绝），全部执行入审计。
- `plugin.api` 原始透传默认关闭且有允许名单（窗口桥映射来自生态清单，非硬编码）。
- 中枢只消费公开注册能力与公开桥方法，**不读取任何插件的私有存储**。
- 事件流为 append-only，删除以标记行表达（消费方按幂等键配对）；高频心跳事件（analytics-updated）被明确排除在物化外（D-0011）。

## 状态与路线

- **v0.1.0** 桥核心 + 适配器 + 设置页 + 单测 → **v0.2.0** 生态中枢（manifest/registry/diagnostics）→ **v0.3.0** 可靠性收尾（template.new/15s 上限/设备名/诊断包）→ **v0.4.x** events/workflow 实现 + 打卡宿主事件桥接 → **v0.5.x** 内核同步通道（实验性）、事件订阅通道修正（window CustomEvent）、可观测性统计、生态清单按远端 main 校准、event-deleted 物化。
- 真机验证（M0 spike ①~⑪）进度见 [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)，路线见 [docs/ROADMAP.md](./docs/ROADMAP.md)，决策记录见 [docs/DECISIONS.md](./docs/DECISIONS.md)（D-0001~D-0011）。

## 开发

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm test    # vitest（无需内核）
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # 软链进工作空间联调
```

许可证：[MIT](./LICENSE) · 作者：[@ai68298100](https://github.com/ai68298100)
