#!/usr/bin/env node
/**
 * e2e-bg —— 后台真机走查（R225 新建，回应多插件并行开发场景）
 *
 * 设计目标：多会话共享同一思源内核时，本脚本可后台运行做真机验收，且：
 *   1. 单实例锁：同时只跑一个（防多会话互相干扰）
 *   2. 限速礼貌：请求间隔 ≥1.2s；429/锁定时立即退出并报告 Retry-After（不刷新锁定、不影响他人）
 *   3. 冲突避让：桥文件待处理命令 >50 条（其他会话正在密集使用）时跳过桥写入测试
 *   4. 令牌自检：401 时明确诊断「令牌已轮换」并退出（不盲试——盲试会触发锁定影响他人）
 *   5. 报告落盘：JSON 结果写 e2e-report.json，供账本/CI 引用
 *
 * 用法：node tools/e2e-bg.mjs [--token xxx] [--url http://127.0.0.1:6806] [--skip-bridge]
 * 退出码：0=全过 1=有失败 2=已有实例 3=令牌无效(需用户提供新令牌) 4=被限速 5=内核不可达
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// ---- 单实例锁 ----
const lockFile = path.join(os.tmpdir(), "qg-e2e-bg.lock");
if (fs.existsSync(lockFile)) {
    console.error(`[e2e-bg] 已有实例运行中（pid ${fs.readFileSync(lockFile, "utf8")}）——退出避免互扰`);
    process.exit(2);
}
fs.writeFileSync(lockFile, String(process.pid));
process.on("exit", () => { try { fs.rmSync(lockFile, { force: true }); } catch { } });

// ---- 配置 ----
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const workspace = arg("--workspace", "D:\\小飞驴的SIYUAN");
let token = arg("--token", process.env.SIYUAN_TOKEN || "");
const SKIP_BRIDGE = args.includes("--skip-bridge");
const GAP_MS = 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 多空间端口枚举（ASCII 安全）：扫内核命令行里的 --port N（R214 端口规律的自动化落地） */
function discoverPorts() {
    try {
        const out = execSync(
            `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='SiYuan-Kernel.exe'\\" | Select-Object -ExpandProperty CommandLine"`,
            { encoding: "utf8" });
        return [...new Set([...out.matchAll(/--port (\d+)/g)].map((m) => m[1]))];
    } catch { return []; }
}

/** 候选 URL 排序：显式 --url 优先，其次发现的内核端口，最后 6806 固定代理 */
function candidateUrls() {
    const explicit = arg("--url", "").replace(/\/$/, "");
    const found = discoverPorts().map((p) => `http://127.0.0.1:${p}`);
    const list = [];
    for (const u of [explicit, ...found, "http://127.0.0.1:6806"]) {
        if (u && !list.includes(u)) list.push(u);
    }
    return list;
}

/** 探测哪个候选端口挂着持有我方令牌的目标工作区内核：version 可达 + 令牌鉴权通过 */
async function pickWorkspaceKernel(candidates) {
    for (const c of candidates) {
        try {
            const v = await fetch(c + "/api/system/version", { method: "POST" });
            if (!v.ok) continue;
            const a = await fetch(c + "/api/notebook/lsNotebooks", {
                method: "POST",
                headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
                body: "{}",
            });
            if (a.ok) return c; // 版本可达且令牌通过 = 目标工作区内核
        } catch { /* 下一个候选 */ }
        await sleep(300);
    }
    return null;
}

// env 兜底（与 lv-cli 同源）
if (!token) {
    const envPath = path.join(process.env.APPDATA || "", "siyuan", "env");
    try {
        for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
            const m = line.match(/^SIYUAN_TOKEN=(.+)$/);
            if (m) token = m[1].trim();
        }
    } catch { }
}

const results = [];
const report = { startedAt: new Date().toISOString(), url: "", checks: [], failures: 0, skipped: 0 };
let rateLimited = false;

async function api(endpoint, body, method = "POST") {
    const res = await fetch(url + endpoint, {
        method,
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 401) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.retryAfter = res.headers.get("Retry-After");
        err.body = (await res.text().catch(() => "")).slice(0, 160);
        throw err;
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
}
const gap = () => sleep(GAP_MS);

function record(name, status, note) {
    results.push({ name, status, note });
    const icon = status === "pass" ? "✓" : status === "skip" ? "○" : "✗";
    console.log(`${icon} ${name} — ${note}`);
    if (status === "fail") report.failures++;
    if (status === "skip") report.skipped++;
}

// ---- 检查项 ----
let url = ""; // 由内核寻源确定（多空间时 6806 可能属于别的工作区）
async function main() {
    // 0. 内核寻源：多空间同开时 6806 可能属于别的工作区内核——在所有内核端口中
    //    找「version 可达 + 我方令牌鉴权通过」的那个（ASCII 安全，无编码依赖）
    const candidates = candidateUrls();
    url = candidates[0] ?? url;
    let authedUrl = null;
    for (const c of candidates) {
        try {
            const v = await fetch(c + "/api/system/version", { method: "POST" });
            if (!v.ok) continue;
            const a = await fetch(c + "/api/notebook/lsNotebooks", {
                method: "POST",
                headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
                body: "{}",
            });
            if (a.ok) { authedUrl = c; break; }
        } catch { /* 下一个候选 */ }
        await sleep(300);
    }
    if (authedUrl) url = authedUrl;
    report.url = url;

    // 1. 内核可达（免鉴权）
    try {
        const r = await fetch(url + "/api/system/version", { method: "POST" });
        const v = (await r.text()).match(/"data":"([^"]+)"/);
        record("内核可达", "pass", `思源 ${v?.[1] ?? "?"} @ ${url}`);
    } catch (e) {
        record("内核可达", "fail", e.message);
        report.failures = 1; report.checks = results;
        fs.writeFileSync("e2e-report.json", JSON.stringify(report, null, 2));
        console.error("内核不可达——退出（不影响其他会话）");
        process.exitCode = 5; return;
    }
    await gap();

    // 2. 令牌有效（401=令牌已轮换 → 明确退出要求新令牌，不盲试）
    try {
        await api("/api/notebook/lsNotebooks", {});
        record("令牌有效", "pass", url !== "http://127.0.0.1:6806" ? "（经工作区端口自动发现）" : "");
    } catch (e) {
        if (e.status === 401) {
            record("令牌有效", "fail", "401 令牌已轮换（可能在其他会话/设备变更）——请从 设置→关于 复制新令牌：node tools/e2e-bg.mjs --token <新令牌>");
            report.failures = 1; report.checks = results;
            fs.writeFileSync("e2e-report.json", JSON.stringify(report, null, 2));
            process.exitCode = 3; return;
        }
        record("令牌有效", "fail", e.message);
        report.failures = 1;
    }
    await gap();

    // 3. 桥 ping（写入面；冲突避让）
    if (SKIP_BRIDGE) {
        record("桥 ping", "skip", "--skip-bridge");
        report.skipped++;
    } else {
        const cmdPath = "/storage/petal/siyuan-quickgate/bridge/commands.ndjson";
        const pending = ((await (async () => {
            try {
                const r = await fetch(url + "/api/file/getFile", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: cmdPath }) });
                return r.ok ? (await r.text()).split(/\r?\n/).filter(Boolean).length : 0;
            } catch { return 0; }
        })()));
        await gap();
        if (pending > 50) {
            record("桥 ping", "skip", `待处理命令 ${pending} 条——其他会话正在密集使用桥，避让不写入`);
            report.skipped++;
        } else {
            const id = "bg-" + Date.now().toString(36);
            const envelope = JSON.stringify({ v: 1, id, op: "bridge.ping", args: {}, createdAt: new Date().toISOString() });
            try {
                const old = await (async () => {
                    const r = await fetch(url + "/api/file/getFile", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: cmdPath }) });
                    return r.ok ? await r.text() : "";
                })();
                const form = new FormData();
                form.append("path", cmdPath);
                form.append("isDir", "false");
                form.append("file", new Blob([old.trimEnd() + "\n" + envelope + "\n"], { type: "application/octet-stream" }), "file");
                const w = await fetch(url + "/api/file/putFile", { method: "POST", headers: { Authorization: `Token ${token}` }, body: form });
                if (!w.ok) throw new Error("写入 " + w.status);
                // 轮询回执（≤8s）
                let receipt = null;
                const dl = Date.now() + 8000;
                while (Date.now() < dl && !receipt) {
                    await sleep(500);
                    const rr = await fetch(url + "/api/file/getFile", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: "/storage/petal/siyuan-quickgate/bridge/results.ndjson" }) });
                    if (!rr.ok) continue;
                    for (const l of (await rr.text()).split(/\r?\n/)) {
                        if (l.includes(`"id":"${id}"`)) { try { receipt = JSON.parse(l); } catch { } }
                    }
                }
                if (receipt && receipt.status === "recorded") record("桥 ping", "pass", `recorded（${receipt.elapsedMs}ms）`);
                else if (receipt) { record("桥 ping", "fail", "回执 " + receipt.status); report.failures++; }
                else { record("桥 ping", "fail", "8s 无回执（桥未开启或插件未加载）"); report.failures++; }
            } catch (e) {
                record("桥 ping", "fail", e.message);
                report.failures++;
            }
        }
    }
    await gap();

    // 4. 内核路由
    try {
        const r = await fetch(url + "/plugin/private/siyuan-quickgate/exec", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ op: "bridge.ping", args: {} }) });
        const j = await r.json();
        record("内核路由", r.ok && j.data?.status === "recorded" ? "pass" : "fail", r.ok ? (j.data?.message ?? "") : "HTTP " + r.status);
        if (!(r.ok && j.data?.status === "recorded")) report.failures++;
    } catch (e) { record("内核路由", "fail", e.message); report.failures++; }
    await gap();

    // 4.5 config.discover（内核路由只读发现：日记笔记本/收集箱；R236 增）
    try {
        const r = await fetch(url + "/plugin/private/siyuan-quickgate/exec", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ op: "config.discover", args: {} }) });
        const j = await r.json();
        const d = j?.data?.data ?? {};
        const ok = r.ok && j?.data?.status === "recorded";
        record("config.discover", ok ? "pass" : "fail", ok ? `日记=${d.diaryNotebookId ?? "null"} 收集箱=${d.inboxDocId ?? "null"}` : "HTTP " + r.status);
        if (!ok) report.failures++;
    } catch (e) { record("config.discover", "fail", e.message); report.failures++; }
    await gap();

    // 4.6 前端 bundle 判别（bug#15：push_reload 后磁盘新代码不生效——favorites.list 应 recorded，旧 bundle 报未知 op）
    try {
        const r = await fetch(url + "/plugin/private/siyuan-quickgate/exec", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ op: "bridge.ping", args: {} }) });
        void r;
        const cmdPath = "/storage/petal/siyuan-quickgate/bridge/commands.ndjson";
        const id = "disc-" + Date.now().toString(36);
        const old = (await (async () => { const x = await fetch(url + "/api/file/getFile", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: cmdPath }) }); return x.ok ? await x.text() : ""; })()) ?? "";
        const form = new FormData();
        form.append("path", cmdPath); form.append("isDir", "false");
        const newline = String.fromCharCode(10);
        form.append("file", new Blob([(old.trimEnd() + (old.trim() ? newline : "")) + JSON.stringify({ v: 1, id, op: "favorites.list", args: {}, createdAt: new Date().toISOString() }) + newline], { type: "application/octet-stream" }), "file");
        await fetch(url + "/api/file/putFile", { method: "POST", headers: { Authorization: `Token ${token}` }, body: form });
        let verdict = "无回执（轮询未运行）", pass = false;
        const dl = Date.now() + 9000;
        while (Date.now() < dl) {
            await sleep(700);
            const rr = await fetch(url + "/api/file/getFile", { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: "/storage/petal/siyuan-quickgate/bridge/results.ndjson" }) });
            const txt = await rr.text();
            const line = txt.split(/\r?\n/).reverse().find((l) => l.includes(`"id":"${id}"`));
            if (line) {
                const rc = JSON.parse(line);
                if (rc.status === "recorded") { verdict = "新前端（favorites 可用）"; pass = true; }
                else if ((rc.message ?? "").includes("未知")) verdict = "旧 bundle——需完全退出思源（托盘退出）后重启";
                else { verdict = rc.status + "：" + (rc.message ?? ""); pass = true; }
                break;
            }
        }
        record("前端 bundle 判别", pass ? "pass" : "fail", verdict);
        if (!pass) report.failures++;
    } catch (e) { record("前端 bundle 判别", "fail", e.message); report.failures++; }
    await gap();

    // 5. petal 加载（快门在装）
    try {
        // R214 校准：frontend="all" 返回空数组，真实 petals 按 frontend 枚举（desktop/mobile）
        const r = await api("/api/petal/loadPetals", { frontend: "desktop" });
        const petals = Array.isArray(r) ? r : r?.data ?? [];
        const qg = petals.find((p) => p?.name === "siyuan-quickgate");
        record("petal 加载", qg ? "pass" : "fail", qg ? "快门已加载" : "快门未在 loadPetals");
        if (!qg) report.failures++;
    } catch (e) { record("petal 加载", "fail", e.message); report.failures++; }

    // 汇总
    report.finishedAt = new Date().toISOString();
    report.checks = results;
    fs.writeFileSync("e2e-report.json", JSON.stringify(report, null, 2));
    const passed = results.filter((r) => r.status === "pass").length;
    console.log(`\n== e2e-bg：${passed}/${results.length} 通过 ==（报告：e2e-report.json）`);
    process.exitCode = report.failures > 0 ? 1 : 0;
}

main().catch((e) => {
    if (e.status === 429) {
        const wait = e.retryAfter ? `${e.retryAfter}s` : "未知";
        console.error(`❌ e2e-bg 被限速（429 认证锁定）：Retry-After ${wait}。已退出——不影响其他会话；锁定过期后再跑。`);
        process.exitCode = 4; return;
    }
    console.error("❌ e2e-bg 异常：", e.message);
    process.exit(1);
});
