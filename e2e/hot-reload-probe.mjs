#!/usr/bin/env node
/**
 * bug#15 前端实例语义探针（Playwright 即 DevTools——原【需前端 DevTools】阻塞项的 e2e 替代）：
 * 复现 R238 序列「部署 index.js → push_reload/dataChanges → 观察插件实例与桥循环」，
 * 全程记录 console 与实例身份/轮询活性，产出 output/hot-reload-probe/<ts>/report.json。
 * 【写型脚本·最强形态】会 putFile 重写 /plugins/siyuan-quickgate/index.js（部署式触发
 * push_reload）——按 R287 约定必须打隔离靶场；打在用内核等于对真实插件做现场部署
 * （Electron 前台即触发 bug#15 死桥）。guardScratch 拒跑共享内核。
 *
 *   node e2e/hot-reload-probe.mjs [<base-url> <token>]
 *   SIYUAN_BASE_URL=http://127.0.0.1:6807 SIYUAN_TOKEN=xxx QG_AUTH_CODE=... node e2e/hot-reload-probe.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { resolveTarget, makeApi, sweepOrphans, guardScratch } from "../scripts/lib/smoke-kernel.mjs";

const { base: url, token } = resolveTarget({ baseArg: process.argv[2], tokenArg: process.argv[3] });
const authCode = process.env.QG_AUTH_CODE || "";
const PLUGIN = "siyuan-quickgate";
const outDir = path.resolve("output/hot-reload-probe", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outDir, { recursive: true });

function resolvePlaywright() {
    for (const dir of [process.env.QG_PLAYWRIGHT_PATH && path.resolve(process.env.QG_PLAYWRIGHT_PATH), path.resolve("../siyuan-checkin/node_modules/playwright")].filter(Boolean)) {
        try { return createRequire(import.meta.url)(dir); } catch { /* 下一个 */ }
    }
    throw new Error("找不到 playwright 模块");
}

const consoleLog = [];
async function sample(page, tag) {
    return await page.evaluate((name) => {
        const p = window.siyuan?.ws?.app?.plugins?.find((x) => x.name === name);
        if (!p) return { present: false };
        return {
            present: true,
            identity: p.__probeMarker ?? null,
            pollerRunning: p.poller?.isRunning ?? null,
            hasActiveService: Boolean(p.activeService),
            lastActivityAt: p.activeService?.stats?.lastActivityAt ?? null,
            tornDown: p.tornDown ?? null,
        };
    }, PLUGIN).then((s) => ({ tag, at: new Date().toISOString(), ...s }));
}

(async () => {
    const { chromium } = resolvePlaywright();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (authCode) {
        const res = await context.request.post(`${url}/api/system/loginAuth`, { data: { authCode }, headers: { Authorization: `Token ${token}` } });
        if (!res.ok()) { console.error("loginAuth 失败"); process.exit(2); }
    }
    const page = await context.newPage();
    page.on("console", (m) => {
        const t = m.text();
        if (/quickgate|桥|自愈|push_reload|reload/i.test(t)) consoleLog.push({ at: new Date().toISOString(), kind: m.type(), text: t.slice(0, 300) });
    });

    await page.goto(`${url}/stage/build/desktop/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.siyuan?.ws?.app && document.querySelector(".layout__center")), { timeout: 60000, polling: 500 });
    await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins?.length ?? 0) > 0, { timeout: 30000, polling: 500 });

    // R287 防呆（写型·部署式重写 index.js）：共享内核拒跑；靶场清残留
    const api = makeApi(url, token);
    await sweepOrphans(api);
    await guardScratch(api, { base: url });

    const before = await sample(page, "before");
    await page.evaluate((name) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === name);
        p.__probeMarker = `M-${Date.now()}`;
    }, PLUGIN);
    const marked = await sample(page, "marked");

    // 触发部署式数据变更：重写 index.js（同字节内容，与 R238 序列一致）
    const localIndex = fs.readFileSync(path.resolve("dist/index.js"), "utf-8");
    const form = new FormData();
    form.append("path", `/plugins/${PLUGIN}/index.js`);
    form.append("isDir", "false");
    form.append("modTime", String(Math.floor(Date.now() / 1000)));
    form.append("file", new Blob([localIndex], { type: "application/octet-stream" }), "file");
    const put = await context.request.post(`${url}/api/file/putFile`, { headers: { Authorization: `Token ${token}` }, multipart: form });
    const deployTriggered = put.ok();

    const samples = [{ ...(await sample(page, "t+0s")) }];
    for (let i = 1; i <= 7; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        samples.push({ ...(await sample(page, `t+${i * 3}s`)) });
    }

    const report = {
        generatedAt: new Date().toISOString(),
        deployTriggered,
        before, marked,
        samples,
        console: consoleLog,
        conclusion: {
            instanceRecreated: samples.some((s) => s.identity === null && marked.identity !== null),
            bridgeSurvived: samples.slice(-1)[0]?.pollerRunning === true,
        },
    };
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
})();
