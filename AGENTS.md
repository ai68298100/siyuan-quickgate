# AGENTS.md — Lv QuickGate（小驴快门）维护者与 AI 助手指南

> 本文件是 AI 编码助手（Claude Code/Cursor 等）与本仓库新维护者的入口。改代码前先读完。

## 这个仓库是什么

思源笔记插件：**小驴生态联动中枢 + 外部网关**。外部客户端（Quicker/快捷指令/CLI/AI 助手）经三通道调用 26 个 op 的公开契约。设计文档与总账本在本仓库 `design/` 目录（2026-10-05 起由原独立仓库 quicksrer 动作 subtree 并入，非代码）。

## 常用命令

```bash
corepack pnpm install
corepack pnpm check        # tsc + svelte-check（提交前必跑）
corepack pnpm accept       # 验收门：单测(210) + MCP 协议冒烟(7)——无内核可跑
corepack pnpm build        # dist/ + package.zip
corepack pnpm build:mcp    # dist-mcp/（MCP 独立分发物）
corepack pnpm verify:restart  # 真机九类数据（需思源运行+桥开启；SIYUAN_LOG 可选）
corepack pnpm verify:bg       # 后台真机走查 7 项（含「前端 bundle 判别」——部署 index.js 后必须完全退出重启思源再跑）
# CI 容器化内核侧验收（GitHub Actions 手动触发；ubuntu+siyuan docker，无需本机）
gh workflow run ci-e2e-experiment.yml && gh run watch
```

## 冒烟/e2e 内核防呆与隔离靶场（R287 · 用户约定）

本机内核常被多个插件项目和真实数据共用。触内核的自动化分两类：

| 类别 | 判定 | 约束 |
|---|---|---|
| 只读走查 | 不调写 API、不改 petal 存储 | 可在在用工作区随时跑、可并发 |
| 写型冒烟/e2e | 改 petal 存储 / 部署插件文件 / 建删笔记本 | **禁止直打在用工作区或与他人共用的内核** |

危害：其他插件的事件监听把测试写入当真实事件反应；浏览器载体以 Web Lock 认领桥消费与真实前台互斥；部署式重写 index.js 触发 push_reload（Electron 前台即 bug#15 死桥序列）；同步开启的工作区被反复搅动。

**本仓库脚本分类**：

| 脚本 | 类别 | 防呆 |
|---|---|---|
| `e2e/e2e.mjs` | 写型（写桥载体） | resolveTarget + 清残留 + guardScratch + 靶场自动重置桥载体 |
| `e2e/hot-reload-probe.mjs` | 写型（putFile 重写 index.js，最强形态） | 必须靶场，共享内核拒跑 |
| `e2e/visual-walkthrough.mjs` | 走查（含写副作用） | 暗色翻转仅靶场/显式豁免；共享内核提示桥认领 |

**三层防护**（共享件 `scripts/lib/smoke-kernel.mjs`，改自小驴考试 fa57d6a）：
1. 目标参数化：argv > `SIYUAN_BASE_URL` > `SIYUAN_URL`（旧）+ `SIYUAN_TOKEN`；缺 token 即退出，绝不内置默认 token/工作区。
2. 靶场防呆：启动 lsNotebooks，存在任何非 `siyuan-quickgate-smoke-` 前缀的笔记本 → 拒跑并给指引；`SIYUAN_E2E_ALLOW_SHARED=1` 显式豁免。
3. 残留清扫：按前缀注册表只删自己的临时库；新冒烟脚本临时笔记本一律用 `siyuan-quickgate-smoke-*`。
4. AI 外发默认关：向已配置模型真实发请求的检查步默认跳过，`SIYUAN_E2E_AI=1` 显式启用（`skipUnlessAi()`）。
5. 退出码语义不因防呆改变：e2e.mjs 环境未就绪=2、失败=1。

**运行约定**：
- 写型一律打隔离靶场：`node scripts/smoke-range.mjs start [--with-frontend]`——独立 workspace（`tmp/smoke-range-ws`）起第二内核，端口 6807 起自动顺延，实例内只装快门；`--with-frontend` 加 headless Chromium 载体（桥类用例 U1~U10 需要；纯 serve 只有 U11 可测）。
- 每个插件项目用自己的靶场 workspace，不跨项目共用；同一内核实例上的写型冒烟串行执行、不并发（清扫按前缀互认，混跑有互删风险）；只读走查可随时并发。
- 靶场 token 与主工作区不同，`start` 完成后直接打印（等价于该实例 设置→关于）。
- 收摊 `stop`；靶场 workspace 留在 tmp/（gitignore），删目录即重置。


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
| 修改环境参数（端口/路径）后 | **全仓 grep 本仓库两端**（源码根 + `design/`），tools/e2e/docs 各有默认值 |
| 测试里硬编码日期 × 真实 Date.now() = 定时炸弹 | 一律固定时钟 `now: () => 固定值` |
| 并行会话可能活跃于共享文件（README/TODO） | 改前 `git status/diff` 核对归属；只追加不重构 |
| SiYuan 容器化：v3.7.0+ 必须传 `serve` 子命令（缺=打印帮助 exit 0）；Docker 首启 `Conf.Bazaar.Trust` 默认 false → 内核插件禁用（预置 conf 补 `bazaar:{trust:true}`）；容器无 node（conf 解析 docker exec cat+宿主处理）；认证失败触发 429 限速（跨 restart 持久，等冷却或重建容器） | 见 .github/workflows/ci-e2e-experiment.yml（十轮诊断全记录） |
| SiYuan 容器化：v3.7.0+ 必须传 `serve` 子命令（缺=打印帮助 exit 0）；Docker 容器首启 `Conf.Bazaar.Trust` 默认 false → 内核插件禁用（预置 conf 补 `"bazaar":{"trust":true}`）；容器无 node（conf 解析用 docker exec cat+宿主处理）；认证失败会触发 429 限速（跨 restart 持久，等冷却或重建容器） | 见 .github/workflows/ci-e2e-experiment.yml（十轮诊断全记录） |

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
- 上游：`design/` 目录（TODO 662 项账本 + docs/01~30，同仓维护；历史设计提交见合并提交 f84f71b 第二父分支）
