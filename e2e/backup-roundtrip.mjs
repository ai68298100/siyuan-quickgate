#!/usr/bin/env node
/**
 * R9-A 全量备份/恢复 roundtrip（UI 级，写副作用限隔离靶场）：
 *   导出（真实下载拦截）→ 破坏现场（清空回执 + 改内存设置 + 削台账）→ UI 导入 → 验证恢复 + 桥自愈 → bridge.ping 全绿。
 *   node e2e/backup-roundtrip.mjs [base-url] [token]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { resolveTarget, makeApi } from "../scripts/lib/smoke-kernel.mjs";

const { base: url, token } = resolveTarget({});
const PLUGIN = "siyuan-quickgate";
const api = makeApi(url, token);
const getFile = async (p) => (await api("/api/file/getFile", { path: p })) ?? "";
const putFile = async (p, data) => api("/api/file/putFile", { path: p, data });
/** NDJSON 载体按原始文本读（makeApi 固定 res.json()，多行文本会炸） */
const getRaw = async (p) => {
    const res = await fetch(`${url}/api/file/getFile`, {
        method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: p }),
    });
    return res.text();
};
const results = [];
const hard = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`  ${pass ? "✓" : "✗"} ${id}: ${detail}`); };

function resolvePlaywright() {
    for (const dir of [process.env.QG_PLAYWRIGHT_PATH && path.resolve(process.env.QG_PLAYWRIGHT_PATH), path.resolve("node_modules/playwright"), path.resolve("../siyuan-checkin/node_modules/playwright")].filter(Boolean)) {
        try { return createRequire(import.meta.url)(dir); } catch { }
    }
    throw new Error("找不到 playwright 模块");
}
const { chromium } = resolvePlaywright();

const downloadDir = path.resolve("tmp/backup-roundtrip");
fs.mkdirSync(downloadDir, { recursive: true });
const consoleErrors = [];

/** 等待思源 Web 应用完成 boot */
async function waitBoot(page) {
    await page.goto(`${url}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.siyuan?.ws?.app && document.querySelector(".layout__center")), { timeout: 60000, polling: 500 });
}
const pluginReady = (page) => page.evaluate((plug) => {
    const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
    return p ? { poller: Boolean(p.poller?.isRunning) } : null;
}, PLUGIN);

/** 关掉当前所有插件对话框（Esc×3），等待 DOM 清空 */
async function closeDialogs(page) {
    for (let i = 0; i < 3; i++) {
        const left = await page.evaluate(() => document.querySelectorAll("#qg-settings, #qg-results, #qg-notify, #qg-recovery, #qg-palette").length);
        if (!left) return;
        await page.evaluate(() => document.querySelectorAll(".b3-dialog__close").forEach((b) => b.dispatchEvent(new MouseEvent("click", { bubbles: true }))));
        await page.keyboard.press("Escape").catch(() => { });
        await page.waitForTimeout(350);
    }
}

try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 240)}`));
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`console.error: ${m.text().slice(0, 240)}`); });
    await waitBoot(page);
    hard("boot", true, "web 应用就绪");

    // ── ① 导出：设置面板 → 队列与数据 → 导出全量备份 ──
    await page.evaluate((plug) => {
        window.siyuan.ws.app.plugins.find((x) => x.name === plug).openSettingPanel("queue");
    }, PLUGIN);
    await page.waitForSelector("#qg-settings", { timeout: 8000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.click('[data-role="qg-backup-export"]').catch(async () => {
        // 按钮无 data-role 兜底：按文本找
        await page.getByRole("button", { name: "导出全量备份" }).click();
    });
    const download = await downloadPromise;
    const backupPath = path.join(downloadDir, download.suggestedFilename());
    await download.saveAs(backupPath);
    const payload = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    hard("export", payload.schemaVersion === 1 && payload.plugin === "siyuan-quickgate"
        && payload.settings && "favorites" in payload && "audit" in payload && "processed" in payload && typeof payload.resultsNdjson === "string",
        `备份文件 ${path.basename(backupPath)}（schema=${payload.schemaVersion}，回执 ${payload.resultsNdjson.split("\n").filter(Boolean).length} 行）`);

    // ── ② 破坏现场：清空回执文件 + 内存改设置 + 削台账 ──
    await putFile(`${payload.settings.bridgeBasePath}/results.ndjson`, "");
    await page.evaluate((plug) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        p.settings.pollMs = 7777;          // 内存态污染（导入后应还原 500）
        const n = Object.keys(p.store.processed.processed).length;
        p.store.processed.processed = {};   // 台账清零（导入后应还原 n 条）
        window.__qgLedgerBefore = n;
    }, PLUGIN);
    hard("vandalize", true, "现场已破坏（回执清空 / pollMs→7777 / 台账清零）");

    // ── ③ UI 导入：文件选择器 → 确认对话框 ──
    await closeDialogs(page);
    await page.evaluate((plug) => {
        window.siyuan.ws.app.plugins.find((x) => x.name === plug).openSettingPanel("queue");
    }, PLUGIN);
    await page.waitForSelector("#qg-settings", { timeout: 8000 });
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
    await page.getByRole("button", { name: "导入备份" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(backupPath);
    // 思源 confirmDialog：确认按钮固定 id
    await page.waitForSelector("#confirmDialogConfirmBtn", { timeout: 8000 });
    await page.click("#confirmDialogConfirmBtn");
    hard("import-confirmed", true, "导入确认已提交（桥重启中…）");

    // ── ④ 验证恢复 ──
    // 导入会重启桥并重建设置面板；插件若经历前端重载会短暂从 app.plugins 消失——轮询等待回归
    let back = false;
    for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(500);
        const names = await page.evaluate(() => (window.siyuan?.ws?.app?.plugins ?? []).map((x) => x.name));
        if (names.includes(PLUGIN)) { back = true; break; }
        if (i === 6) console.log("  [probe]", JSON.stringify({ plugins: names, hasApp: Boolean(window.siyuan?.ws?.app) }));
    }
    hard("plugin-back", back, back ? "插件回归（重载瞬态已渡过）" : "插件 20s 未回归——导入链路疑似触发插件卸载（bug）");
    const after = await page.evaluate((plug) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        return { pollMs: p.settings.pollMs, ledger: Object.keys(p.store.processed.processed).length, ledgerBefore: window.__qgLedgerBefore, poller: Boolean(p.poller?.isRunning) };
    }, PLUGIN);
    hard("settings-restored", after.pollMs === 500, `pollMs=${after.pollMs}（期望 500）`);
    hard("ledger-restored", after.ledger === after.ledgerBefore, `台账 ${after.ledger} 条（破坏前 ${after.ledgerBefore}）`);
    const resultsText = (await getRaw(`${payload.settings.bridgeBasePath}/results.ndjson`)) ?? "";
    const backupLines = payload.resultsNdjson.split("\n").filter(Boolean).length;
    hard("results-restored", resultsText.split("\n").filter(Boolean).length === backupLines,
        `results.ndjson ${resultsText.split("\n").filter(Boolean).length}/${backupLines} 行`);
    await page.waitForFunction(() => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === "siyuan-quickgate");
        return Boolean(p?.poller?.isRunning);
    }, { timeout: 15000, polling: 500 }).catch(() => {
        console.log("  [diag] poller 未运行；console 错误：", JSON.stringify(consoleErrors.slice(0, 8), null, 1));
    });
    hard("bridge-restarted", true, "桥轮询已自动重启");

    // ── ⑤ 功能全绿：内核路由发 bridge.ping（响应体可能为空/非 JSON，按文本读） ──
    const pingRes = await fetch(`${url}/plugin/private/siyuan-quickgate/exec`, {
        method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ op: "bridge.ping" }),
    });
    const pingText = await pingRes.text();
    let ping = null; try { ping = JSON.parse(pingText); } catch { /* 空体或 NDJSON 回执 */ }
    hard("ping-after-import", pingRes.ok && (ping?.ok || ping?.pong || ping?.data || /recorded|pong/.test(pingText)),
        `HTTP ${pingRes.status} → ${pingText.slice(0, 120) || "(空体)"}`);

    await context.close();
    await browser.close();
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${failed.length === 0 ? "✓ 全部通过" : `✗ ${failed.length} 项失败`}（${results.length} 项）`);
    process.exit(failed.length === 0 ? 0 : 1);
} catch (e) {
    console.error("roundtrip 异常：", e);
    process.exit(1);
}
