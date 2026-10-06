#!/usr/bin/env node
/**
 * 快门隔离靶场（R287 · 写型冒烟/e2e 专用）：
 * 独立 workspace 起第二个思源内核实例（端口 6807 起自动顺延），实例内只装快门，
 * 与在用工作区/共享内核完全隔离。写型脚本（e2e/e2e.mjs、e2e/hot-reload-probe.mjs）
 * 一律打靶场，不打在用工作区（smoke-kernel guardScratch 会拒跑共享内核）。
 *
 *   node scripts/smoke-range.mjs start [--with-frontend] [--port 6807]
 *   node scripts/smoke-range.mjs stop | status
 *
 * - --with-frontend：额外起一个 headless Chromium 载体（加载靶场 Web 应用，使快门
 *   前端/桥在靶场内运行，U1~U10 才可跑；纯 serve 内核只有 U11 内核路由可测）。
 * - 靶场 token 与主工作区不同：start 完成后直接打印（原生 serve 无 UI，从靶场
 *   conf.json 读出；等价于该实例 设置→关于 的 token）。
 * - 首启自动补 bazaar.trust=true（AGENTS 已知坑：缺它内核插件被禁，U11 404）并重启一次。
 * - 清理：stop 退出内核与载体；靶场工作区留在 tmp/smoke-range-ws 供复用，可整目录删除。
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, "tmp");
const WS = path.join(TMP, "smoke-range-ws");
const STATE = path.join(TMP, "smoke-range.json");
const KERNEL_LOG = path.join(TMP, "smoke-range-kernel.log");
const FRONTEND_STOP = path.join(TMP, "smoke-range-frontend.stop");
const FRONTEND_READY = path.join(TMP, "smoke-range-frontend.ready");
const PLUGIN = "siyuan-quickgate";
const KERNEL_EXE = process.env.SIYUAN_KERNEL_EXE || "D:\\biji\\SiYuan\\resources\\kernel\\siyuan.exe";

const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf-8")) : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function versionOk(base) {
    try {
        const res = await fetch(`${base}/api/system/version`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!res.ok) return false;
        const j = await res.json();
        return j?.code === 0;
    } catch { return false; }
}

/** 连接式端口探测：连得上=被占（含并发探测竞态最小化），连不上=空闲 */
function portFree(p) {
    return new Promise((resolve) => {
        const s = net.connect(p, "127.0.0.1");
        s.once("connect", () => { s.destroy(); resolve(false); });
        s.once("error", () => { s.destroy(); resolve(true); });
    });
}

async function freePortFrom(start) {
    for (let p = start; p < start + 20; p++) {
        if (await portFree(p)) return p;
    }
    throw new Error(`6807~${start + 19} 均被占用`);
}

function readToken(wsPath) {
    const confPath = path.join(wsPath, "conf", "conf.json");
    if (!fs.existsSync(confPath)) return "";
    try {
        const conf = JSON.parse(fs.readFileSync(confPath, "utf-8"));
        return conf?.api?.token ?? "";
    } catch { return ""; }
}

function deployPlugin(wsPath) {
    const dist = path.join(ROOT, "dist");
    if (!fs.existsSync(path.join(dist, "index.js"))) {
        console.error("✗ dist/index.js 不存在——先 corepack pnpm build 再起靶场");
        process.exit(1);
    }
    const target = path.join(wsPath, "data", "plugins", PLUGIN);
    fs.cpSync(dist, target, { recursive: true });
    console.log(`  已部署快门 → ${target}`);
}

/** 靶场预置开桥（normalizeSettings 容忍部分字段；产品默认关桥，不预置则 U1~U10 全跳） */
function seedBridgeSettings(wsPath) {
    const dir = path.join(wsPath, "data", "storage", "petal", PLUGIN);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "bridge-settings.json"), JSON.stringify({
        schemaVersion: 1,
        bridgeEnabled: true,
        broadcastEnabled: true,
    }), "utf-8");
    console.log("  已预置桥开启（bridge-settings.json）");
}

function spawnKernel(port) {
    fs.mkdirSync(WS, { recursive: true });
    const out = fs.openSync(KERNEL_LOG, "a");
    const child = spawn(KERNEL_EXE, ["serve", "--workspace", WS, "--port", String(port)], {
        detached: true, stdio: ["ignore", out, out],
    });
    child.unref();
    return child.pid;
}

async function waitReady(base, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await versionOk(base)) return true;
        await sleep(500);
    }
    return false;
}

/** 补 bazaar.trust（已知坑：缺它内核插件被禁）。纯文件补丁——调用方必须先强杀内核，
 * 优雅退出会把内存 conf 写回、覆盖本补丁（首启实测踩过）。 */
function patchTrustIfNeeded() {
    const confPath = path.join(WS, "conf", "conf.json");
    if (!fs.existsSync(confPath)) return false;
    const conf = JSON.parse(fs.readFileSync(confPath, "utf-8"));
    if (conf?.bazaar?.trust === true) return false;
    conf.bazaar = { ...(conf.bazaar ?? {}), trust: true };
    fs.writeFileSync(confPath, JSON.stringify(conf, null, "\t"), "utf-8");
    console.log("  已补 bazaar.trust=true（AGENTS 已知坑）");
    return true;
}

function resolvePlaywright() {
    for (const dir of [process.env.QG_PLAYWRIGHT_PATH && path.resolve(ROOT, process.env.QG_PLAYWRIGHT_PATH), path.join(ROOT, "node_modules", "playwright"), path.resolve(ROOT, "../siyuan-checkin/node_modules/playwright")].filter(Boolean)) {
        try { return createRequire(import.meta.url)(dir); } catch { /* 下一个 */ }
    }
    throw new Error("找不到 playwright 模块（可用 QG_PLAYWRIGHT_PATH 指定）");
}

/** 前端载体：headless Chromium 挂着靶场 Web 应用，使快门前端/桥在靶场内运行（内部长驻命令） */
async function runFrontendHold(base) {
    const { chromium } = resolvePlaywright();
    // 隐藏页定时器节流会把桥轮询拖到分钟级（实测伪装成"桥死"）——禁用三类后台节流
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            "--disable-features=IntensiveWakeUpThrottling",
        ],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on("console", (m) => {
        if (/quickgate/i.test(m.text())) console.log(`[frontend] ${m.text().slice(0, 160)}`);
    });
    await page.goto(`${base}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.siyuan?.ws?.app && document.querySelector(".layout__center")), { timeout: 60000, polling: 500 });
    await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins?.length ?? 0) > 0, { timeout: 30000, polling: 500 });
    fs.writeFileSync(FRONTEND_READY, new Date().toISOString(), "utf-8");
    console.log("[frontend] 靶场前端载体就绪（快门已加载，桥可被认领）");
    while (!fs.existsSync(FRONTEND_STOP)) {
        await sleep(2000);
        if (!(await versionOk(base))) break; // 内核退出即跟随退出
    }
    await browser.close().catch(() => {});
    fs.rmSync(FRONTEND_READY, { force: true });
    console.log("[frontend] 载体退出");
}

/** 启用登记（思源以 data/storage/petal/petals.json 为准，缺条目=未启用；内核插件启动时读取） */
function seedPetalEnabled(wsPath) {
    const petalDir = path.join(wsPath, "data", "storage", "petal");
    fs.mkdirSync(petalDir, { recursive: true });
    const confPath = path.join(petalDir, "petals.json");
    let list = [];
    if (fs.existsSync(confPath)) {
        try { list = JSON.parse(fs.readFileSync(confPath, "utf-8")); } catch { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    if (!list.some((p) => p?.name === PLUGIN)) list.push({ name: PLUGIN, enabled: true });
    else list = list.map((p) => (p?.name === PLUGIN ? { ...p, enabled: true } : p));
    fs.writeFileSync(confPath, JSON.stringify(list, null, "\t"), "utf-8");
    console.log("  已登记快门启用态（petals.json）");
}

/** 靶场笔记本清理（尽力而为）：思源会在空库时自动补建样板「My Notebook」且删后立刻重建
 * （活跃前端会话实测），样板名已在中性注册表（smoke-kernel SAMPLE_NOTEBOOK_NAMES）豁免；
 * 这里只清扫非样板遗留，不与自动补建硬刚。只对启动器自有的 tmp/smoke-range-ws 执行。 */
async function sweepRangeNotebooks(base, token) {
    const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json", Connection: "close" };
    const res = await fetch(`${base}/api/notebook/lsNotebooks`, { method: "POST", headers, body: "{}" });
    const list = (await res.json())?.data?.notebooks ?? [];
    for (const n of list) {
        if (n.name === "My Notebook" || n.name === "思源笔记") continue; // 思源样板，删了会重建
        const r = await fetch(`${base}/api/notebook/removeNotebook`, {
            method: "POST", headers, body: JSON.stringify({ notebook: n.id }),
        });
        console.log(`  清扫靶场遗留笔记本：${n.name} ${r.ok ? "✓" : "✗"}`);
    }
}

async function cmdStart(args) {
    if (readState()) {
        console.error("✗ 靶场已在运行（tmp/smoke-range.json 存在）——先 stop 或 status 查看");
        process.exit(1);
    }
    if (!fs.existsSync(KERNEL_EXE)) {
        console.error(`✗ 找不到内核可执行文件：${KERNEL_EXE}（可用 SIYUAN_KERNEL_EXE 覆盖）`);
        process.exit(1);
    }
    const withFrontend = args.includes("--with-frontend");
    const portIdx = args.indexOf("--port");
    const port = portIdx >= 0 ? Number(args[portIdx + 1]) : await freePortFrom(6807);
    const base = `http://127.0.0.1:${port}`;

    fs.mkdirSync(TMP, { recursive: true });
    fs.rmSync(FRONTEND_READY, { force: true });
    fs.rmSync(FRONTEND_STOP, { force: true });
    console.log(`== 快门隔离靶场 ==\n  workspace: ${WS}\n  端口: ${port}`);

    // 首启：生成 conf/token → 强杀（不落盘）→ 补 trust + 部署 + 登记启用 → 重启内核装载
    let pid = spawnKernel(port);
    if (!(await waitReady(base))) {
        console.error(`✗ 内核 30s 未就绪——日志：${KERNEL_LOG}`);
        process.exit(1);
    }
    let token = readToken(WS);
    try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" }); } catch { /* 已退出 */ }
    await sleep(2000);
    patchTrustIfNeeded();
    deployPlugin(WS);
    seedBridgeSettings(WS);
    seedPetalEnabled(WS);
    pid = spawnKernel(port);
    if (!(await waitReady(base))) {
        console.error(`✗ 重启后内核未就绪——日志：${KERNEL_LOG}`);
        process.exit(1);
    }
    token = readToken(WS);
    fs.writeFileSync(STATE, JSON.stringify({ pid, port, base, ws: WS, token, startedAt: new Date().toISOString() }, null, 2), "utf-8");

    if (withFrontend) {
        const fe = spawn(process.execPath, [path.join(ROOT, "scripts", "smoke-range.mjs"), "frontend", base], {
            detached: true, stdio: "ignore", env: { ...process.env },
        });
        fe.unref();
        const state = readState();
        state.frontendPid = fe.pid;
        fs.writeFileSync(STATE, JSON.stringify(state, null, 2), "utf-8");
        process.stdout.write("  等待前端载体就绪");
        for (let i = 0; i < 60 && !fs.existsSync(FRONTEND_READY); i++) {
            await sleep(1000);
            process.stdout.write(".");
        }
        console.log(fs.existsSync(FRONTEND_READY) ? " ✓" : " ✗（60s 未就绪，看上方 [frontend] 日志）");
        if (!fs.existsSync(FRONTEND_READY)) process.exit(1);
        // 思源样板「My Notebook」会自动重建（中性，guard 豁免）；这里只清非样板遗留
        await sweepRangeNotebooks(base, token);
    }

    console.log([
        "",
        `✓ 靶场就绪：${base}`,
        `  token: ${token || "(conf.json 尚未生成 token——稍后重试 status)"}`,
        "  跑写型套件：",
        `    SIYUAN_BASE_URL=${base} SIYUAN_TOKEN=<上面的 token> node e2e/e2e.mjs`,
        "  收摊：node scripts/smoke-range.mjs stop",
    ].join("\n"));
}

async function cmdStop() {
    const state = readState();
    if (!state) { console.log("靶场未在运行"); return; }
    fs.writeFileSync(FRONTEND_STOP, new Date().toISOString(), "utf-8");
    await fetch(`${state.base}/api/system/exit`, {
        method: "POST",
        headers: { Authorization: `Token ${state.token ?? ""}`, "Content-Type": "application/json" },
        body: "{}",
    }).catch(() => {});
    await sleep(3000);
    for (const pid of [state.frontendPid, state.pid].filter(Boolean)) {
        try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" }); } catch { /* 已退出 */ }
    }
    fs.rmSync(STATE, { force: true });
    fs.rmSync(FRONTEND_STOP, { force: true });
    fs.rmSync(FRONTEND_READY, { force: true });
    console.log(`✓ 靶场已停止（工作区保留在 ${WS}，可整目录删除重置）`);
}

async function cmdStatus() {
    const state = readState();
    if (!state) { console.log("靶场未在运行"); return; }
    const ok = await versionOk(state.base);
    console.log(`靶场 ${state.base} ${ok ? "运行中" : "无响应"}（workspace: ${state.ws}，前端载体: ${state.frontendPid ? "有" : "无"}）`);
    const token = readToken(state.ws);
    if (ok && token) console.log(`  token: ${token}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "start") await cmdStart(args);
else if (cmd === "frontend") await runFrontendHold(args[0] ?? "http://127.0.0.1:6807");
else if (cmd === "stop") await cmdStop();
else if (cmd === "status") await cmdStatus();
else {
    console.log("用法：node scripts/smoke-range.mjs start [--with-frontend] [--port 6807] | stop | status | frontend <base>");
    process.exit(cmd ? 1 : 0);
}
