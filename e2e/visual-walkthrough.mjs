#!/usr/bin/env node
/**
 * 独立浏览器视觉走查（M2 · P2「独立 Playwright+Chromium」批）：
 * 用系统级 Chromium（playwright 缓存）加载思源 Web 应用（browser-desktop / browser-mobile
 * 前台），替代 IAB webview（R270 已证不可用）与 Electron 真机窗口走查的自动化子集。
 * 【走查类·含写副作用】主体只读；两处副作用按 R287 约定门控：
 *   ①暗色主题翻转（setAppearanceMode，改工作区外观配置）——仅隔离靶场或
 *     SIYUAN_E2E_ALLOW_SHARED=1 时执行，共享内核默认跳过；
 *   ②浏览器会话会认领桥（Web Lock）消费桥命令——共享内核上运行前会明确提示。
 *
 *   node e2e/visual-walkthrough.mjs [<base-url> <token>]
 *   SIYUAN_BASE_URL=http://127.0.0.1:6807 SIYUAN_TOKEN=xxx node e2e/visual-walkthrough.mjs
 *   QG_PLAYWRIGHT_PATH=<playwright 模块目录>  # 默认依次尝试本仓依赖与兄弟仓 checkin
 *   QG_AUTH_CODE=<访问鉴权码>                 # 工作区设置锁屏密码时必填
 *
 * 硬门（不通过即退出码 1）：Web 应用可启动、快门插件已加载、openSetting 入口修复生效、
 * 设置面板可打开。软项（截图/主题/触控/控制台审计）只记录不判死。
 * 产出：output/visual-walkthrough/<时间戳>/（report.json + 截图）
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { resolveTarget, makeApi, sweepOrphans, isScratchName, isSampleName } from "../scripts/lib/smoke-kernel.mjs";

const { base: url, token } = resolveTarget({ baseArg: process.argv[2], tokenArg: process.argv[3] });
const authCode = process.env.QG_AUTH_CODE || ""; // 工作区设置了访问鉴权码时必填（浏览器锁屏）
const PLUGIN = "siyuan-quickgate";
const outRoot = path.resolve("output/visual-walkthrough", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outRoot, { recursive: true });

function resolvePlaywright() {
    const candidates = [
        process.env.QG_PLAYWRIGHT_PATH && path.resolve(process.env.QG_PLAYWRIGHT_PATH),
        path.resolve("node_modules/playwright"),
        path.resolve("../siyuan-checkin/node_modules/playwright"),
    ].filter(Boolean);
    for (const dir of candidates) {
        try {
            return createRequire(import.meta.url)(dir);
        } catch { /* 下一个候选 */ }
    }
    throw new Error(`找不到 playwright 模块（候选：${candidates.join("、")}）`);
}

const results = [];
const soft = [];
const consoleIssues = [];
let shotSeq = 0;
async function shot(page, name) {
    const file = path.join(outRoot, `${String(++shotSeq).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return path.basename(file);
}
function hard(id, pass, detail) { results.push({ id, pass, detail }); }
function note(id, detail) { soft.push({ id, detail }); }

/** 等待思源 Web 应用完成 boot：window.siyuan 就绪且中心布局出现 */
async function waitBoot(page, timeoutMs = 60000) {
    await page.goto(`${url}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
        const w = window;
        return Boolean(w.siyuan?.ws?.app && document.querySelector(".layout__center"));
    }, { timeout: timeoutMs, polling: 500 });
}

/** 工作区锁屏登录（loginAuth 建会话 Cookie，与页面共享 Cookie 罐） */
async function loginAuth(context) {
    if (!authCode) return false;
    const res = await context.request.post(`${url}/api/system/loginAuth`, {
        data: { authCode },
        headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok()) return false;
    const body = await res.json().catch(() => null);
    return body?.code === 0;
}

async function pagePlugins(page) {
    return page.evaluate(() => window.siyuan.ws.app.plugins.map((p) => p.name));
}

async function openSettingsViaPlugin(page) {
    return page.evaluate((name) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === name);
        if (!p) return { ok: false, reason: "plugin not found" };
        p.openSetting();
        return { ok: true };
    }, PLUGIN);
}

async function walkDesktop(browser) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
    const page = await context.newPage();
    if (authCode) {
        const ok = await loginAuth(context);
        hard("auth-login", ok, ok ? "锁屏会话建立" : "loginAuth 失败（QG_AUTH_CODE 未提供或不正确）");
        if (!ok) { await context.close(); return; }
    }    page.on("pageerror", (e) => consoleIssues.push({ kind: "pageerror", text: String(e).slice(0, 500) }));
    page.on("console", (m) => {
        if (m.type() === "error") consoleIssues.push({ kind: "console.error", text: m.text().slice(0, 500) });
    });
    page.on("requestfailed", (r) => {
        if (!r.url().includes("favicon")) consoleIssues.push({ kind: "requestfailed", text: `${r.failure()?.errorText} ${r.url()}`.slice(0, 300) });
    });

    // 1) boot
    try {
        await waitBoot(page);
        hard("desktop-boot", true, "window.siyuan + layout__center 就绪");
        note("desktop-boot-shot", await shot(page, "desktop-boot-light"));
    } catch (e) {
        hard("desktop-boot", false, `boot 失败：${String(e).slice(0, 300)}`);
        note("desktop-boot-fail-shot", await shot(page, "desktop-boot-FAIL").catch(() => "n/a"));
        await context.close();
        return;
    }

    // 2) 插件加载（browser-desktop 前台）
    const plugins = await pagePlugins(page);
    hard("plugin-loaded-desktop", plugins.includes(PLUGIN), `plugins=${JSON.stringify(plugins)}`);

    // 3) 入口修复：openSetting 覆写被思源 hasPluginSetting 识别（齿轮显示的同一判据）
    const override = await page.evaluate((name) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === name);
        if (!p) return { present: false };
        const proto = Object.getPrototypeOf(p);
        const baseProto = Object.getPrototypeOf(proto);
        return {
            present: true,
            overridden: typeof p.openSetting === "function" && proto.openSetting !== baseProto?.openSetting,
            hasSettingProp: Boolean(p.setting),
            bundleTag: null,
        };
    }, PLUGIN);
    hard("opensetting-override", override.present && (override.overridden || override.hasSettingProp),
        `openSetting 覆写=${override.overridden} setting=${override.hasSettingProp}`);

    // 4) 设置面板可打开（用户实际入口）
    const opened = await openSettingsViaPlugin(page);
    let dialogSeen = false;
    if (opened.ok) {
        try {
            await page.waitForSelector("#qg-settings", { timeout: 5000 });
            dialogSeen = true;
        } catch { /* 面板未渲染 */ }
    }
    hard("settings-dialog-opens", dialogSeen, dialogSeen ? "#qg-settings 渲染" : `openSetting 调用=${JSON.stringify(opened)} 但未渲染`);
    if (dialogSeen) note("settings-dialog-light-shot", await shot(page, "settings-dialog-light"));
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);

    // 5) 顶栏插件菜单（第二个入口）
    const menuBtn = await page.$("#barPlugins");
    if (menuBtn) {
        await menuBtn.click();
        await page.waitForTimeout(600);
        const menuHasQg = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".b3-menu .b3-menu__label"))
                .some((el) => /快门|QuickGate/i.test(el.textContent || "")));
        note("topbar-plugin-menu", menuHasQg ? "菜单含快门设置项" : "菜单未发现快门项（记录）");
        note("topbar-menu-shot", await shot(page, "topbar-plugin-menu"));
        await page.keyboard.press("Escape").catch(() => {});
    } else {
        note("topbar-plugin-menu", "未找到 #barPlugins（前台差异，记录）");
    }
    await context.close();
}

async function walkDark(browser) {
    // 切暗色 → boot → 截图 → 切回亮色
    const setMode = async (mode) => {
        const res = await fetch(`${url}/api/system/setAppearanceMode`, {
            method: "POST",
            headers: { Authorization: `Token ${token}` },
            body: JSON.stringify({ mode }),
        });
        return res.ok;
    };
    if (!await setMode(1)) { note("dark-theme", "setAppearanceMode(1) 失败（跳过暗色走查）"); return; }
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN", colorScheme: "dark" });
        if (authCode) await loginAuth(context);
        const page = await context.newPage();
        await waitBoot(page);
        note("dark-boot-shot", await shot(page, "desktop-boot-dark"));
        const opened = await openSettingsViaPlugin(page);
        if (opened.ok) {
            try {
                await page.waitForSelector("#qg-settings", { timeout: 5000 });
                note("dark-settings-shot", await shot(page, "settings-dialog-dark"));
            } catch { note("dark-settings-shot", "暗色下面板未渲染（记录）"); }
        }
        await context.close();
        note("dark-theme", "暗色 boot + 截图完成");
    } catch (e) {
        note("dark-theme", `暗色走查异常：${String(e).slice(0, 200)}`);
    } finally {
        await setMode(0);
    }
}

async function walkMobile(browser) {
    // 浏览器模拟仅作结构检查（G4-01 口径：真机矩阵仍需 Android 设备）
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
        locale: "zh-CN",
    });
    const page = await context.newPage();
    try {
        if (authCode) await loginAuth(context);
        await page.goto(`${url}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
        // mobile boot 的 loadPlugins 在 getConf 回调内，晚于 ws.app 出现——等插件装载而非仅等 app
        await page.waitForFunction(() => Boolean(window.siyuan?.ws?.app), { timeout: 60000, polling: 500 });
        await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins?.length ?? 0) > 0, { timeout: 30000, polling: 500 }).catch(() => {});
        const frontend = await page.evaluate(() => {
            const p = window.siyuan.ws.app.plugins.find((x) => x.name === "siyuan-quickgate");
            return { loaded: Boolean(p), isMobile: p ? Boolean(p.isMobile) : null };
        });
        hard("plugin-loaded-mobile", frontend.loaded, `快门在 mobile 前台加载=${frontend.loaded}`);
        note("mobile-boot-shot", await shot(page, "mobile-boot"));
        const opened = await openSettingsViaPlugin(page);
        let layout = null;
        if (opened.ok) {
            try {
                await page.waitForSelector("#qg-settings", { timeout: 5000 });
                layout = await page.evaluate(() => {
                    const root = document.querySelector("#qg-settings");
                    const dialog = root?.closest(".b3-dialog");
                    const switchEl = root?.querySelector('input[type="checkbox"].b3-switch');
                    const rect = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
                    const oversize = root ? root.scrollWidth > root.clientWidth + 2 : null;
                    return {
                        dialogW: dialog ? Math.round(dialog.getBoundingClientRect().width) : null,
                        viewportW: window.innerWidth,
                        switchRect: rect(switchEl),
                        horizontalOverflow: oversize,
                    };
                });
                note("mobile-settings-shot", await shot(page, "mobile-settings"));
            } catch { note("mobile-settings-structure", "mobile 面板未渲染（记录）"); }
        }
        if (layout) {
            note("mobile-settings-structure", JSON.stringify(layout));
            if (layout.horizontalOverflow) note("mobile-overflow-warn", "设置面板横向溢出（G4-02 关注项，记录待修）");
        }
    } catch (e) {
        note("mobile-walk", `mobile 走查异常：${String(e).slice(0, 300)}`);
        note("mobile-fail-shot", await shot(page, "mobile-FAIL").catch(() => "n/a"));
    }
    await context.close();
}

(async () => {
    let browser;
    try {
        const { chromium } = resolvePlaywright();
        browser = await chromium.launch({ headless: true });
    } catch (e) {
        console.error(`浏览器启动失败：${e.message}`);
        process.exit(2);
    }
    // R287 写副作用门控：探目标内核笔记本前缀——共享内核默认跳过暗色翻转（setAppearanceMode
    // 会改工作区外观），并提示浏览器会话可能认领桥消费；隔离靶场全量跑
    let darkAllowed = false;
    try {
        const api = makeApi(url, token);
        const r = await api("/api/notebook/lsNotebooks", {});
        const foreign = (r.data?.notebooks ?? []).filter((n) => !isScratchName(n.name) && !isSampleName(n.name));
        if (foreign.length === 0) {
            darkAllowed = true;
            await sweepOrphans(api);
        } else if (process.env.SIYUAN_E2E_ALLOW_SHARED === "1") {
            darkAllowed = true;
            console.log(`  ⚠ SIYUAN_E2E_ALLOW_SHARED=1：共享内核上执行暗色主题翻转（跑完复原）`);
        } else {
            console.log("  (共享内核：跳过暗色主题翻转——会改工作区外观配置；隔离靶场或 SIYUAN_E2E_ALLOW_SHARED=1 可全量)");
            console.log("  ⚠ 若快门桥已开启，本浏览器会话会以 Web Lock 认领桥消费——与真实前台互斥，共享内核上注意");
        }
    } catch { /* 探测失败按共享保守处理 */ }

    try {
        await walkDesktop(browser);
        if (darkAllowed) {
            await walkDark(browser);
        } else {
            note("dark-theme", "跳过（共享内核防外观配置写入）");
        }
        await walkMobile(browser);
    } finally {
        await browser.close();
    }

    const report = {
        generatedAt: new Date().toISOString(),
        kernelUrl: url,
        plugin: PLUGIN,
        hard: results,
        soft: soft,
        consoleIssues: consoleIssues.slice(0, 50),
        consoleIssueCount: consoleIssues.length,
        evidenceDir: outRoot,
    };
    fs.writeFileSync(path.join(outRoot, "report.json"), JSON.stringify(report, null, 2), "utf-8");
    console.log(JSON.stringify(report, null, 2));
    process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
