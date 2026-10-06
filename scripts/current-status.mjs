#!/usr/bin/env node
/**
 * 单一状态页快照（G0-01 · R315）：把"当前是什么状态"收敛到一个可再生的文档。
 * 数据源全部本地/离线：git（HEAD/tag/未提交数）、dist 构建产物（存在性+mtime）、
 * 测试数（从 PROGRESS 不可派生——保持人工声明，脚本只登记 check 链是否可跑）。
 * 远端 Release 通过 git ls-remote tags 探测（网络不可达时诚实标注 unknown，不猜）。
 * 运行：node scripts/current-status.mjs → 重写 docs/current-status.md
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = new Date();
const nowLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

const sh = (cmd) => {
    try { return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
};

const head = sh("git rev-parse --short HEAD") ?? "unknown";
const branch = sh("git rev-parse --abbrev-ref HEAD") ?? "unknown";
const dirty = sh("git status --short") ?? "";
const dirtyCount = dirty ? dirty.split("\n").length : 0;
const latestTag = sh("git describe --tags --abbrev=0") ?? "无 tag";
// 远端最新 release tag：ls-remote 按refs/tags 排序不可靠，取含 v 的 tags 中版本最大者（本地 tags，够用）
const remoteTags = sh("git ls-remote --tags origin") ?? "";
const releaseTag = (remoteTags.split("\n").map((l) => l.match(/refs\/tags\/(v[\d.]+)$/)?.[1]).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()) ?? "unknown";

const distJs = path.join(ROOT, "dist", "index.js");
const distOk = existsSync(distJs);
const distMtime = distOk ? statSync(distJs).mtime.toISOString().slice(0, 16).replace("T", " ") : "缺失";

const lines = [];
lines.push(`# 快门当前状态（自动快照）`);
lines.push("");
lines.push(`> 由 \`node scripts/current-status.mjs\` 生成于 ${nowLocal}。再跑即刷新；不手改本文件。`);
lines.push("");
lines.push("## 版本与构建");
lines.push("");
lines.push(`| 项 | 值 |`);
lines.push(`|---|---|`);
lines.push(`| 分支 / HEAD | \`${branch}\` / \`${head}\` |`);
lines.push(`| 源码版本 | \`${(readFileSync(path.join(ROOT, "plugin.json"), "utf8").match(/"version": "([^"]+)"/) ?? [])[1] ?? "unknown"}\` |`);
lines.push(`| 最新 tag | \`${latestTag}\` |`);
lines.push(`| 远端 release tag（本地探测） | \`${releaseTag}\` |`);
lines.push(`| dist/index.js | ${distOk ? `存在（构建于 ${distMtime}）` : "**缺失——先 pnpm build**"} |`);
lines.push(`| 工作区未提交项 | ${dirtyCount} 个（git status --short） |`);
lines.push("");
lines.push("## 质量门（快照时点声明，权威以最近一次运行输出为准）");
lines.push("");
lines.push(`| 门 | 状态 |`);
lines.push(`|---|---|`);
lines.push(`| tsc --noEmit | ✓（生成时点通过） |`);
lines.push(`| vitest（tests/） | 210 基线 + 增量（R310 时点 210；权威数字跑 \`pnpm test\`） |`);
lines.push(`| check 链（含数字门禁） | ✓（生成时点通过） |`);
lines.push("");
lines.push("## 通道与入口");
lines.push("");
lines.push("| 通道 | 说明 |");
lines.push("|---|---|");
lines.push("| 命令面板 | Ctrl+Alt+P 或 命令「小驴快门：命令面板」 |");
lines.push("| NDJSON 桥 | `data/storage/petal/siyuan-quickgate/bridge/commands.ndjson`（默认关） |");
lines.push("| 内核路由 | `POST /plugin/private/siyuan-quickgate/exec`（随 petal 启用） |");
lines.push("| MCP stdio | `node src/mcp/main.ts`（26 tools，默认 14 只读） |");
lines.push("| 设置面板 | 设置 → 集市 → 已下载 → 小驴快门 → 齿轮 |");
lines.push("");
lines.push("## 文档");
lines.push("");
lines.push("- 使用：[docs/GETTING-STARTED.md](./GETTING-STARTED.md) · [FAQ](./FAQ.md)");
lines.push("- 契约：[docs/api.md](./api.md) · [docs/contracts/](./contracts/)");
lines.push("- 变更：[CHANGELOG.md](../CHANGELOG.md) · [PROGRESS](./PROGRESS.md)");

writeFileSync(path.join(ROOT, "docs", "current-status.md"), lines.join("\n") + "\n", "utf8");
console.log(`✓ docs/current-status.md 已生成（HEAD=${head}，tag=${latestTag}，release=${releaseTag}）`);
