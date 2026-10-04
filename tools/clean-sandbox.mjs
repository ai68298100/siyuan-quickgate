#!/usr/bin/env node
/**
 * clean-sandbox —— 干净沙箱内核验证（实验态 · R257）
 *
 * 动机：bug#15 使前端新代码在完全重启前不生效；本工具用思源 `SiYuan-Kernel.exe serve --workspace <临时>`
 * 起独立内核做全新工作区的内核侧验证（与用户实例零接触）。
 *
 * 现状（实验态，未达稳定）：阶段一（首跑生成 conf）✓ 稳定；阶段二（打 bazaar 信任开关后重启）**挂起**——
 * 现象=数据库重初始化后内核静默（无日志无监听），无插件/有插件均复现（机制级，与快门代码无关）；
 * 已排除：旗标名（--workspace 非 --wd）、petals.json 形状、我们的代码（--no-plugin 同现）、TLS（显式关闭仍复现）。
 * 已获得的确凿知识（见 docs/10-生态调研-R4.md §7）：全新工作区默认 pets 禁用+bazaar 不信任，需 conf 打开；
 * 首跑持久化会开本地 TLS；petal 启用状态存 data/storage/petal/petals.json。
 * 续做线索：无头内核的数据库重初始化阻塞（或与 filelock/交互式初始化有关）；备选=改用 docker 容器版。
 *
 * 用法：node tools/clean-sandbox.mjs [--keep] [--no-plugin]   # --keep 保留沙箱目录供检查
 * 退出码：0=全过 1=有失败
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import http from "node:http";
import https from "node:https";

const REPO = process.cwd();
const DIST = path.join(REPO, "dist");
const PLUGIN = "siyuan-quickgate";
const KEEP = process.argv.includes("--keep");
const NO_PLUGIN = process.argv.includes("--no-plugin"); // 判别实验：信任开关开但不装插件——区分机制卡/我们卡
const PORT = 14711;
const ws = path.join(os.tmpdir(), `qg-sandbox-${Date.now()}`);

const results = [];
const record = (name, pass, note = "") => {
    results.push({ name, pass, note });
    console.log(`${pass ? "✓" : "✗"} ${name}${note ? " — " + note : ""}`);
};

// ---- 0. 定位内核可执行文件 ----
let kernelExe = "";
try {
    const live = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'SiYuan-Kernel.exe' } | Select-Object -First 1).CommandLine"`, { encoding: "utf8" });
    const m = String(live).match(/(.+SiYuan-Kernel\.exe)/);
    if (m) kernelExe = m[1].replace(/"/g, "");
} catch { /* 找不到就从运行中内核推断失败 */ }
if (!kernelExe) {
    const guess = "D:\\biji\\SiYuan\\resources\\kernel\\SiYuan-Kernel.exe";
    if (fs.existsSync(guess)) kernelExe = guess;
}
if (!kernelExe) {
    console.error("未找到 SiYuan-Kernel.exe（无运行中内核且默认路径不存在）");
    process.exit(1);
}

// ---- 1. 组装沙箱工作区 ----
const pluginDir = path.join(ws, "data", "plugins", PLUGIN);
fs.mkdirSync(path.join(ws, "data", "storage", "petal", PLUGIN), { recursive: true });
fs.mkdirSync(pluginDir, { recursive: true });
if (!NO_PLUGIN) fs.cpSync(DIST, pluginDir, { recursive: true });
// petals.json：从用户工作区抄 quickgate 条目（保持真实字段形状），缺省则合成
try {
    const livePetals = JSON.parse(fs.readFileSync("D:\\小飞驴的SIYUAN\\data\\storage\\petal\\petals.json", "utf8"));
    const qg = livePetals.find((p) => p.name === PLUGIN);
    fs.writeFileSync(path.join(ws, "data", "storage", "petal", "petals.json"),
        JSON.stringify(qg ? [{ ...qg, enabled: true }] : [{ name: PLUGIN, version: "0.7.3", displayName: "小驴快门", enabled: true, incompatible: false, disabledInPublish: false, disallowInstall: false }], null, "\t"));
} catch {
    fs.writeFileSync(path.join(ws, "data", "storage", "petal", "petals.json"),
        JSON.stringify([{ name: PLUGIN, version: "0.7.3", displayName: "小驴快门", enabled: true }], null, "\t"));
}
console.log(`沙箱工作区：${ws}`);

// ---- 2. 起内核（--workspace 挂沙箱；--wd 留默认=安装资源目录，appearance/langs 才能解析）----
const proc = spawn(kernelExe, ["serve", "--workspace", ws, "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"], detached: false });
let stdout = "";
proc.stdout.on("data", (d) => { stdout += d; });
proc.stderr.on("data", (d) => { stdout += d; });
const cleanup = () => { try { proc.kill(); } catch { } if (!KEEP) { try { fs.rmSync(ws, { recursive: true, force: true }); } catch { } } else console.log(`（--keep：沙箱保留于 ${ws}）`); };
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let baseUrl = `http://127.0.0.1:${PORT}`;
// 第二段启动可能强制本地 HTTPS（自签）——http/https 自适应，自签证书容错
const req = (url, { method = "POST", headers = {}, body } = {}) =>
    new Promise((resolve, reject) => {
        const u = new URL(url);
        const payload = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
        const r = (u.protocol === "https:" ? https : http).request(u, {
            method,
            headers: { ...headers, ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}) },
            rejectUnauthorized: false,
        }, (res) => {
            let t = "";
            res.on("data", (c) => { t += c; });
            res.on("end", () => resolve({ status: res.statusCode, text: t }));
        });
        r.on("error", reject);
        if (payload !== null) r.write(payload);
        r.end();
    });
const probeReady = async () => {
    for (const scheme of ["http", "https"]) {
        try {
            const r = await req(`${scheme}://127.0.0.1:${PORT}/api/system/version`, { body: {} });
            if (r.status === 200) { baseUrl = `${scheme}://127.0.0.1:${PORT}`; return true; }
        } catch { /* 下一个 scheme */ }
    }
    return false;
};
const waitReady = async (maxIter = 80) => {
    for (let i = 0; i < maxIter; i++) {
        await sleep(500);
        if (await probeReady()) return true;
    }
    return false;
};

// ---- 3. 两段启动：首跑生成 conf → 打开 bazaar 信任/插件开关（IsPetalsEnabled 要求）→ 重启验证 ----
let token = "";
const readToken = () => {
    try {
        return JSON.parse(fs.readFileSync(path.join(ws, "conf", "conf.json"), "utf8"))?.api?.token ?? "";
    } catch { return ""; }
};

// 阶段 1：首跑（生成 conf/工作区结构）
let up = await waitReady();
record("内核就绪（首跑）", up, up ? baseUrl : "20s 内未就绪");
if (up) {
    try {
        const confPath = path.join(ws, "conf", "conf.json");
        const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
        conf.bazaar = { ...(conf.bazaar ?? {}), trust: true, petalDisabled: false };
        conf.system = { ...(conf.system ?? {}), networkServeTLS: false }; // 首跑持久化会开本地 TLS——探针走 HTTP，显式关掉
        fs.writeFileSync(confPath, JSON.stringify(conf, null, 2));
        record("bazaar 信任/插件开关", true, "trust=true, petalDisabled=false");
    } catch (e) { record("bazaar 信任/插件开关", false, e.message); }
}
proc.kill();
try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" }); } catch { /* 已退出 */ }
await sleep(3000);

// 阶段 2：重启（petal 生效）并跑检查（二启含数据库重建+首装索引，耐心 180s）
up = await waitReady(360);
record("内核就绪（重启后）", up);
if (!up) console.error(`[内核输出尾] ${stdout.slice(-600).replace(/\n/g, " | ")}`);
if (up) {
    token = readToken();
    record("conf 持久化 + api.token", !!token, token ? "" : "conf.json 无 api.token");

    const api = async (endpoint, body) => {
        const r = await req(baseUrl + endpoint, { headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: body ?? {} });
        return { status: r.status, text: r.text };
    };

    // 4. petal 加载（kernel.js 在全新工作区被内核执行）
    let qgLoaded = false;
    try {
        const r = await api("/api/petal/loadPetals", { frontend: "desktop" });
        const petals = JSON.parse(r.text)?.data ?? [];
        qgLoaded = petals.some((p) => p?.name === PLUGIN);
    } catch { }
    record("petal 加载（全新工作区首跑）", qgLoaded);

    // 5. 私有路由 ping
    try {
        const r = await api(`/plugin/private/${PLUGIN}/exec`, { op: "bridge.ping", args: {} });
        const j = JSON.parse(r.text);
        record("私有路由 bridge.ping", r.status === 200 && j?.data?.status === "recorded", j?.data?.message ?? `HTTP ${r.status}`);
    } catch (e) { record("私有路由 bridge.ping", false, e.message); }

    // 6. config.discover（空工作区：诚实空结果而非崩溃——首跑空存储路径验证）
    try {
        const r = await api(`/plugin/private/${PLUGIN}/exec`, { op: "config.discover", args: {} });
        const j = JSON.parse(r.text);
        const d = j?.data?.data ?? {};
        record("config.discover（空工作区）", r.status === 200 && j?.data?.status === "recorded",
            `日记=${d.diaryNotebookId ?? "null"}（空工作区应为 null）· notes=${(d.notes ?? []).length} 条`);
    } catch (e) { record("config.discover（空工作区）", false, e.message); }

    // 7. Agent 能力注册（内核日志）
    await sleep(1500);
    const registered = stdout.includes("内置 Agent 能力已注册");
    record("Agent 能力注册（日志）", registered, registered ? "ping/discover/capture" : "日志未见注册行");
}

// ---- 汇总与清理 ----
const failed = results.filter((r) => !r.pass).length;
console.log(`\n== clean-sandbox：${results.length - failed}/${results.length} 通过 ==${KEEP ? "（沙箱保留）" : ""}`);
fs.writeFileSync(path.join(REPO, "e2e-sandbox-report.json"), JSON.stringify({ at: new Date().toISOString(), ws, results }, null, 2));
cleanup();
process.exit(failed > 0 ? 1 : 0);
