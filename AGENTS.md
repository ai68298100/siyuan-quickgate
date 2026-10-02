# AGENTS.md — Lv QuickGate（小驴快门）维护者与 AI 助手指南

> 本文件是 AI 编码助手（Claude Code/Cursor 等）与本仓库新维护者的入口。改代码前先读完。

## 这个仓库是什么

思源笔记插件：**小驴生态联动中枢 + 外部网关**。外部客户端（Quicker/快捷指令/CLI/AI 助手）经三通道调用 23 个 op 的公开契约。姊妹仓库 `D:\AI\思源笔记插件开发\quicksrer 动作`（设计文档+Quicker 动作蓝图，非代码）。

## 常用命令

```bash
corepack pnpm install
corepack pnpm check        # tsc + svelte-check（提交前必跑）
corepack pnpm accept       # 验收门：单测(99) + MCP 协议冒烟(6)——无内核可跑
corepack pnpm build        # dist/ + package.zip
corepack pnpm build:mcp    # dist-mcp/（MCP 独立分发物）
corepack pnpm verify:restart  # 真机七类数据（需思源运行+桥开启；SIYUAN_LOG 可选）
```

## 发版流程（每版必经，缺一即回）

1. 版本四处 bump：plugin.json / package.json / src/index.ts `PLUGIN_VERSION` / 双语 README 徽章
2. `npm run accept` 全绿
3. `npm run build` → dist 自检版本 → 部署 `D:\小飞驴的SIYUAN\data\plugins\siyuan-quickgate\`
4. **CHANGELOG + docs/PROGRESS 同轮更新**（漏了就是下轮漂移）
5. release 后：验证 `releases/latest` 可解析（全 pre-release 会 404——已真机验收的版本应解除 pre-release）+ `git fetch --tags`
6. 验证七文档面：README×2 / CHANGELOG / PROGRESS / api.md+ROADMAP / WALKTHROUGH / 事实表

## 红线（违反即缺陷）

1. 外部面默认关闭（桥/广播/plugin.api 透传）
2. 不读取任何插件的私有存储
3. 无 Token 必须被 401/403 拒绝
4. 未知（timeout）不得改写为成功
5. 快门不自带模型服务、不复制业务私有库、不成为通用备份/清理工具

完整合同：docs/contracts/ 七份（result / capability-registry / reliability / safety-gate / intent-context / evidence-envelope / release-evidence）。

## 已知坑（踩过的，别再踩）

| 坑 | 解法 |
|---|---|
| CRLF 残留 `\r`：JS 正则 `$` 与 `.` 都不处理 | split 用 `/\r?\n/`；正则显式 `\r?` |
| pnpm 严格布局：间接依赖 bin 不提升（npx esbuild 失败） | 用 `.pnpm/esbuild@*/lib/main.js` 的 **JS API**；Windows 路径 ESM import 必须 `pathToFileURL` |
| ESM 无 `require` | try/catch 包装 require 会把 ReferenceError 吞成"目录不存在" |
| Git Bash PATH 间歇断裂（unix 工具消失） | `export PATH="/c/Program Files/Git/cmd:/c/Program Files/Git/usr/bin:/c/Program Files/nodejs:$PATH"` |
| Windows .ps1 含非 ASCII 必须 UTF-8 **with BOM**（否则 PS5.1 按 ANSI 误读） | 交付前 PSParser 语法验证 |
| 内核按 plugin.json **`kernels`** 字段决定是否加载 kernel.js（缺字段=路由 404，bug#9） | 已补 `["all"]`，别删 |
| 修改环境参数（端口/路径）后 | **全仓 grep 两个项目**（quickgate + quicksrer 动作），tools/e2e/docs 各有默认值 |
| 测试里硬编码日期 × 真实 Date.now() = 定时炸弹 | 一律固定时钟 `now: () => 固定值` |
| 并行会话可能活跃于共享文件（README/TODO） | 改前 `git status/diff` 核对归属；只追加不重构 |

## 证据纪律（R123-G0）

- 结论分级 E0 假设 → E1 外部资料 → E2 静态契约 → E3 自动化测试 → E4 真机 → E5 用户结果
- **前端 DOM/宿主 API 假设**：grep 本机安装编译产物 `D:\biji\SiYuan\resources\stage\build\app\*.js`（实际运行的代码，bundle 证据法，不必等 DevTools）
- 适配器/契约字段必须逐一对上游源码——文档写了 ≠ 上游接收
- 不立项也要出正式结论+触发条件（"沉默的备选项"会被重复评估）

## 关键文档

- docs/WALKTHROUGH.md — spike 实证记录（①~⑪ 状态与证据）
- docs/api.md — 23 op 契约面（用户可见）
- docs/DECISIONS.md — D-0001~D-0015 决策记录
- docs/ROADMAP.md — M0~M3 路线与门槛
- src/mcp/README.md — MCP 服务器（运行/配置/安全模型）
- 上游：设计文档项目 `D:\AI\思源笔记插件开发\quicksrer 动作`（TODO 662 项账本 + docs/01~30）
