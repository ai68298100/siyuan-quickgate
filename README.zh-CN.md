# 小驴快门（Lv QuickGate）

[English](./README.md)

[![Version](https://img.shields.io/badge/version-0.4.0-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**小驴快门**是[思源笔记](https://b3log.org/siyuan)的**小驴生态联动中枢 + 外部网关**：Quicker、手机快捷指令、CLI、PowerShell、HA 脚本以及小驴系插件，共用同一套公开契约——

- `commands.*` — 发现/搜索/执行任意已装插件的命令面板条目（默认确认门控 + 审计）
- `checkin.*` / `contacts.*` — 向小驴打卡（API v5）、小驴人脉（bridge v1）的公开桥做结构化透传
- `editor.context` / `daily.status` / `doc.open` — 编辑器与工作区快照、受控导航
- `bridge.ping` — 能力协商（`{protocol, plugin, version, pollMs, bridgeEnabled}`）

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
```

信封：`{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}`；回执按 `id` 对应，`status ∈ recorded|duplicate|rejected|failed|unsupported|expired`。完整契约见 [docs/api.md](./docs/api.md)，机器可读版 [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json)。

[`tools/`](./tools) 内置两个零依赖客户端：node CLI 与 PowerShell 脚本；Quicker 子程序走同一信封。

## 安全

- 桥**默认关闭**；`commands.run` 弹思源确认框（30 秒超时=拒绝），全部执行入审计。
- `plugin.api` 原始透传默认关闭且有允许名单。
- 中枢只消费公开注册能力与公开桥方法，**不读取任何插件的私有存储**。

## 状态与路线

v0.1.0 = 桥核心 + 适配器 + 设置页 + 单测（队列竞态、TTL、幂等持久化、单飞轮询全覆盖）。内核真机验证（M0 spike）进度见 [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)，路线见 [docs/ROADMAP.md](./docs/ROADMAP.md)。

## 开发

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm test    # vitest（无需内核）
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # 软链进工作空间联调
```

许可证：[MIT](./LICENSE) · 作者：[@ai68298100](https://github.com/ai68298100)
