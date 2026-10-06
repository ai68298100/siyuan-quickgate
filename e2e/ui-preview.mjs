#!/usr/bin/env node
/**
 * UI 打磨预览截图（只读走查，无写副作用；暗色翻转仅限隔离靶场调用）：
 *  - 现状：设置面板六页 + 四中心 + 命令面板（亮色），状态/队列两页补暗色；
 *  - 原型：design/ui-prototype/mvp1.html 四屏元素截图；
 * 产出：output/ui-preview/<时间戳>/*.png，供「原型 vs 现状」逐项比对。
 *
 *   node e2e/ui-preview.mjs [base-url] [token]
 *   SIYUAN_BASE_URL=http://127.0.0.1:6807 SIYUAN_TOKEN=xxx node e2e/ui-preview.mjs
 *   QG_PLAYWRIGHT_PATH=<playwright 模块目录>  # 默认依次尝试本仓依赖与兄弟仓 checkin
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { resolveTarget } from "../scripts/lib/smoke-kernel.mjs";

const { base: url, token } = resolveTarget({ baseArg: process.argv[2], tokenArg: process.argv[3] });
const PLUGIN = "siyuan-quickgate";
const outRoot = path.resolve("output/ui-preview", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outRoot, { recursive: true });

function resolvePlaywright() {
    const candidates = [
        process.env.QG_PLAYWRIGHT_PATH && path.resolve(process.env.QG_PLAYWRIGHT_PATH),
        path.resolve("node_modules/playwright"),
        path.resolve("../siyuan-checkin/node_modules/playwright"),
    ].filter(Boolean);
    for (const dir of candidates) {
        try { return createRequire(import.meta.url)(dir); } catch { /* 下一个候选 */ }
    }
    throw new Error(`找不到 playwright 模块（候选：${candidates.join("、")}）`);
}

const { chromium } = resolvePlaywright();
let browser;
const shots = [];

async function shotEl(page, selector, name) {
    const el = page.locator(selector).first();
    const file = path.join(outRoot, `${name}.png`);
    await el.screenshot({ path: file });
    shots.push(path.basename(file));
    console.log(`  ✓ ${name}`);
}
async function shotPage(page, name) {
    const file = path.join(outRoot, `${name}.png`);
    await page.screenshot({ path: file });
    shots.push(path.basename(file));
    console.log(`  ✓ ${name}`);
}

async function waitBoot(page, timeoutMs = 60000) {
    await page.goto(`${url}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
        const w = window;
        return Boolean(w.siyuan?.ws?.app && document.querySelector(".layout__center"));
    }, { timeout: timeoutMs, polling: 500 });
}

/** 关掉当前所有插件对话框（Esc ×2 + 关闭按钮兜底），等待 DOM 清空 */
async function closeDialogs(page) {
    for (let i = 0; i < 3; i++) {
        const left = await page.evaluate(() => document.querySelectorAll(
            "#qg-settings, #qg-results, #qg-notify, #qg-recovery, #qg-palette").length);
        if (!left) return;
        await page.evaluate(() => {
            document.querySelectorAll(".b3-dialog__close").forEach((b) => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(350);
    }
    const left = await page.evaluate(() => document.querySelectorAll(
        "#qg-settings, #qg-results, #qg-notify, #qg-recovery, #qg-palette").length);
    if (left) throw new Error(`对话框未能关闭（残留 ${left}）`);
}

async function withSettingsPage(page, pageId, name) {
    await closeDialogs(page);
    await page.evaluate(([plug, pg]) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        p.openSettingPanel(pg);
    }, [PLUGIN, pageId]);
    await page.waitForSelector("#qg-settings", { timeout: 8000 });
    await page.waitForTimeout(450); // 页面入场动画 + 异步数据渲染
    await shotEl(page, "#qg-settings", name);
}

async function withCenter(page, methodName, sel, name, extra) {
    await closeDialogs(page);
    await page.evaluate(([plug, m]) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        p[m]();
    }, [PLUGIN, methodName]);
    await page.waitForSelector(sel, { timeout: 8000 });
    await page.waitForTimeout(450);
    if (extra) await extra(page);
    await shotEl(page, sel, name);
}

const setMode = async (mode) => {
    const res = await fetch(`${url}/api/system/setAppearanceMode`, {
        method: "POST", headers: { Authorization: `Token ${token}` },
        body: JSON.stringify({ mode }),
    });
    return res.ok;
};

try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
    const page = await context.newPage();

    // ── 原型四屏（file://，亮色）──
    const protoPath = path.resolve("design/ui-prototype/mvp1.html");
    await page.goto(`file:///${protoPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await shotEl(page, "#f-home .dialog", "proto-1-home");
    await shotEl(page, "#f-first .dialog", "proto-2-first");
    await shotEl(page, "#f-settings .dialog", "proto-3-settings");
    await shotEl(page, "#f-queue .dialog", "proto-4-queue");

    // ── 现状（亮色）──
    await waitBoot(page);
    await shotPage(page, "now-desktop");

    await withSettingsPage(page, "status", "now-set-status");
    await withSettingsPage(page, "connection", "now-set-connection");
    await withSettingsPage(page, "security", "now-set-security");
    await withSettingsPage(page, "queue", "now-set-queue");
    await withSettingsPage(page, "diagnostics", "now-set-diagnostics");
    await withSettingsPage(page, "about", "now-set-about");

    // 首跑向导（仅本次会话内存态模拟，不落盘）
    await closeDialogs(page);
    await page.evaluate((plug) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        p.store.firstRun = true;
        p.openSettingPanel("status");
    }, PLUGIN);
    await page.waitForSelector("#qg-settings", { timeout: 8000 });
    await page.waitForTimeout(450);
    await shotEl(page, "#qg-settings", "now-set-firstrun");
    await page.evaluate((plug) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === plug);
        p.store.firstRun = false;
    }, PLUGIN);

    await withCenter(page, "openResultsCenter", "#qg-results", "now-results");
    await withCenter(page, "openNotificationCenter", "#qg-notify", "now-notify");
    await withCenter(page, "openRecoveryCenter", "#qg-recovery", "now-recovery");
    await withCenter(page, "openCommandPalette", "#qg-palette", "now-palette", async (pg) => {
        await pg.keyboard.type("doc");
        await pg.waitForTimeout(500);
    });
    await withCenter(page, "openCommandPalette", "#qg-palette", "now-palette-empty", async (pg) => {
        await pg.keyboard.type("zzzz 不存在");
        await pg.waitForTimeout(500);
    });
    await context.close();

    // ── 现状（暗色：状态 + 队列）──
    if (await setMode(1)) {
        try {
            const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
            const dpage = await dctx.newPage();
            await waitBoot(dpage);
            await withSettingsPage(dpage, "status", "now-dark-set-status");
            await withSettingsPage(dpage, "queue", "now-dark-set-queue");
            await dctx.close();
        } finally {
            await setMode(0);
        }
    }

    fs.writeFileSync(path.join(outRoot, "index.json"), JSON.stringify({ url, shots }, null, 2));
    console.log(`\n✓ ${shots.length} 张截图 → ${outRoot}`);
} finally {
    if (browser) await browser.close();
}
