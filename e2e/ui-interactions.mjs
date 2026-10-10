#!/usr/bin/env node
/**
 * UI 交互行为真机 e2e（写型：切桥 + 捕获写/删——仅限隔离靶场，guardScratch 拒共享内核）。
 * 验证近几轮 UI 交互改动在真实宿主的行为（此前仅有 stub 宿主证据）：
 *   I1 两段式 Esc：面板有词先清词并拦住宿主关闭，空词才关面板
 *   I2 面板键盘导航：ArrowDown 推进 active + aria-activedescendant 同步
 *   I3 设置搜索命中高亮：.qg-search-hit 渲染
 *   I4 「已自定义」边标实时刷新：切开关当次立现/消退，且无整页重渲染（同节点探针）
 *   I5 通道卡下钻：点状态卡 → 当前分组页切换
 *   I6 捕获全链：fallback 捕获 → 去向确认 → 成功卡（撤销写入含宿主确认框，soft 断言）
 *
 *   SIYUAN_BASE_URL=http://127.0.0.1:6807 SIYUAN_TOKEN=<靶场 token>
 *   【已知环境性瞬态（2026-10-11 双内核 3.8.7-alpha.6 实测）】I7/I8 可因「设置保存→petal 重载」
 *   瞬态失败：diag 显示 bridgeEnabled:false/pollerRunning:false（UI 行显示已开桥但实例读到旧值）。
 *   对照实验：改动前构建同靶场同序列复现同 diag——非代码回归，重跑或核对靶场 seed 即可。 \
 *   QG_PLAYWRIGHT_PATH=<playwright 模块目录> node e2e/ui-interactions.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { resolveTarget, makeApi, guardScratch } from "../scripts/lib/smoke-kernel.mjs";

const PLUGIN = "siyuan-quickgate";
const { base: url, token } = resolveTarget();
const api = makeApi(url, token);

function resolvePlaywright() {
    const candidates = [
        process.env.QG_PLAYWRIGHT_PATH && path.resolve(process.env.QG_PLAYWRIGHT_PATH),
        path.resolve("node_modules/playwright"),
    ].filter(Boolean);
    for (const dir of candidates) {
        try { return createRequire(import.meta.url)(dir); } catch { /* 下一个候选 */ }
    }
    throw new Error(`找不到 playwright 模块（候选：${candidates.join("、")}）`);
}

const results = [];
const hard = (name, ok, detail = "") => {
    results.push({ name, ok });
    console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const soft = (name, ok, detail = "") => {
    console.log(`${ok ? "✓" : "△"} ${name}${detail ? ` — ${detail}` : ""}（soft）`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** petal 写入（设置保存等）会触发思源前端插件重载瞬态（app.plugins 短暂清空数秒，backup-roundtrip 账本同坑）——
 *  写操作后必须等插件实例回归（且方法可用）再驱动 UI，否则调用落在已卸载实例上静默失效 */
async function waitPluginAlive(page, timeoutMs = 20000) {
    await page.waitForFunction((name) => {
        const p = window.siyuan?.ws?.app?.plugins?.find?.((x) => x.name === name);
        return Boolean(p && typeof p.openCommandPalette === "function" && typeof p.takeoverBridge === "function");
    }, PLUGIN, { timeout: timeoutMs, polling: 400 });
}

/** 重载瞬态会留下旧实例的孤儿对话框（DOM 残留、不可交互）——清掉，避免选择器命中死面板 */
async function cleanOrphanQgDialogs(page) {
    await page.evaluate(() => {
        document.querySelectorAll(".b3-dialog").forEach((d) => {
            if (d.querySelector("#qg-palette, #qg-capture, #qg-capture-done, #qg-settings")) d.remove();
        });
    });
}

const isolated = await guardScratch(api, { base: url });
if (!isolated) console.log("（共享内核豁免模式：捕获写入将落在真实日记——谨慎）");

const { chromium } = resolvePlaywright();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
const page = await context.newPage();

async function waitBoot() {
    await page.goto(`${url}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.siyuan?.ws?.app && document.querySelector(".layout__center")), { timeout: 60000, polling: 500 });
}
const callPlugin = (method) => page.evaluate((m) => {
    const p = window.siyuan.ws.app.plugins.find((x) => x.name === m.plugin);
    if (typeof p?.[m.method] !== "function") return { ok: false };
    p[m.method]();
    return { ok: true };
}, { plugin: PLUGIN, method });

try {
    await waitBoot();
    hard("boot", true);

    // ═══ I2 面板键盘导航（无写副作用，先做）═══
    await callPlugin("openCommandPalette");
    await page.waitForSelector("#qg-palette", { timeout: 5000 });
    await page.waitForTimeout(200); // 收敛渲染竞态（R293 探针兜底重渲染会重建行）
    await page.focus('#qg-palette [data-role="q"]');
    const firstActive = await page.evaluate(() => document.querySelector("#qg-palette-list .qg-palette-item.active")?.id ?? "");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    const secondActive = await page.evaluate(() => ({
        id: document.querySelector("#qg-palette-list .qg-palette-item.active")?.id ?? "",
        desc: document.querySelector('#qg-palette [data-role="q"]')?.getAttribute("aria-activedescendant") ?? "",
    }));
    hard("I2 键盘导航推进 + aria 同步",
        firstActive && secondActive.id && secondActive.id !== firstActive && secondActive.desc === secondActive.id,
        `${firstActive || "无"} → ${secondActive.id || "无"}`);

    // ═══ I1 两段式 Esc ═══
    await page.fill('#qg-palette [data-role="q"]', "桥自检");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const afterFirst = await page.evaluate(() => ({
        alive: document.contains(document.querySelector("#qg-palette")),
        value: document.querySelector('#qg-palette [data-role="q"]')?.value ?? null,
    }));
    hard("I1a 首段 Esc 清词且面板存活", afterFirst.alive && afterFirst.value === "",
        afterFirst.alive ? `输入值="${afterFirst.value}"` : "面板已被关闭（宿主 Esc 层次与假设不符）");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const paletteGone = await page.evaluate(() => !document.contains(document.querySelector("#qg-palette")));
    hard("I1b 二段 Esc 关闭面板", paletteGone);

    // ═══ I3 设置搜索命中高亮 ═══
    await callPlugin("openSetting");
    await page.waitForSelector("#qg-settings", { timeout: 5000 });
    await page.click('.qg-nav-item[data-page="connection"]');
    await page.fill('[data-role="qg-search"]', "桥");
    await page.waitForTimeout(450); // 防抖 150ms + 四页重建
    const hitCount = await page.evaluate(() => document.querySelectorAll(".qg-search-hit").length);
    // 连接页 label 含「桥」的行=2（外部命令桥/移动端桥）；广播快路径经 hint 命中——label 高亮 2 处即正确
    hard("I3 设置搜索命中高亮", hitCount === 2, `${hitCount} 个命中片段（label 含「桥」的行数）`);

    // ═══ I4 已自定义边标实时刷新（状态无关：先归一到开启，再三段断言；同节点探针证明无整页重渲染）═══
    await page.click('.qg-nav-item[data-page="connection"]');
    await page.waitForTimeout(250);
    const rowSel = '#qg-settings .qg-row:has-text("外部命令桥")';
    const switchSel = `${rowSel} input.b3-switch`;
    const rowState = () => page.evaluate(() => {
        const row = Array.from(document.querySelectorAll("#qg-settings .qg-row"))
            .find((r) => (r.querySelector(".label")?.textContent ?? "").includes("外部命令桥"));
        if (!row) return { found: false };
        return {
            found: true,
            modified: row.classList.contains("modified"),
            checked: row.querySelector("input.b3-switch").checked,
            probe: row.__qgProbe === 1,
        };
    });
    // 归一：若桥未开启先点开（外部状态——靶场载体/上次运行——可能改写设置文件，测试不依赖初态）
    const initial = await rowState();
    if (!initial.found) { hard("I4 定位外部命令桥行", false, "row 未找到"); }
    else {
        if (!initial.checked) {
            await page.click(switchSel);
            await page.waitForTimeout(900);
        }
        await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("#qg-settings .qg-row"))
                .find((r) => (r.querySelector(".label")?.textContent ?? "").includes("外部命令桥"));
            row.__qgProbe = 1; // 同节点探针：实时刷新不得整页重渲染
        });
        const atOn = await rowState();
        hard("I4a 开启态边标存在", atOn.modified && atOn.checked, initial.checked ? "初态即开启" : "初态关闭→已归一为开启");
        // 关桥
        await page.click(switchSel);
        await page.waitForTimeout(700); // 保存 + showMessage + 实时刷新 setTimeout(0)
        const afterOff = await rowState();
        hard("I4b 关桥后边标实时消退", afterOff.modified === false && afterOff.checked === false,
            afterOff.probe ? "同节点实时刷新 ✓" : "检测到整页重渲染（边标走了重建路径）");
        soft("I4b-s 同节点探针", afterOff.probe);
        // 恢复开桥（还原靶场预设态：桥开启）
        await page.click(switchSel);
        await page.waitForTimeout(900);
        const afterOn = await rowState();
        hard("I4c 开桥后边标实时复现（靶场初始态已还原）", afterOn.modified && afterOn.checked);
    }

    // ═══ I5 通道卡下钻 ═══
    await page.click('.qg-nav-item[data-page="status"]');
    await page.waitForTimeout(350);
    await page.click('.qg-stat-card[data-goto="connection"]');
    await page.waitForTimeout(300);
    const navLabel = await page.evaluate(() => document.querySelector('.qg-nav-item.active span:nth-of-type(2)')?.textContent
        ?? document.querySelector(".qg-nav-item.active")?.textContent ?? "");
    hard("I5 通道卡下钻切换分组页", navLabel.includes("连接与通道"), `当前分组="${navLabel.trim()}"`);

    // ═══ I6 捕获全链（写日记；撤销=soft）═══
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    await waitPluginAlive(page); // I4 的设置保存触发重载瞬态——等插件实例回归再开面板
    await callPlugin("openCommandPalette");
    await page.waitForSelector("#qg-palette", { timeout: 5000 });
    await page.fill('#qg-palette [data-role="q"]', "采购清单 压测捕获一条");
    await page.waitForTimeout(300);
    await page.click('[data-fb="capture"]');
    await page.waitForSelector("#qg-capture", { timeout: 5000 });
    await page.click('#qg-capture [data-target="daily"]');
    let doneOk = true;
    try { await page.waitForSelector("#qg-capture-done", { timeout: 8000 }); } catch { doneOk = false; }
    hard("I6a 捕获写入成功卡", doneOk);
    if (doneOk) {
        let undoOk = false;
        try {
            // 抓 deleteBlock 真实响应（内核不落日志）
            let delResp = null;
            const onResp = async (r) => {
                if (r.url().includes("/api/block/deleteBlock")) {
                    try { delResp = { status: r.status(), body: (await r.text()).slice(0, 300) }; } catch { /* ignore */ }
                }
            };
            page.on("response", onResp);
            await page.click("#qg-capture-done [data-cap-undo]");
            await page.waitForTimeout(600);
            // 宿主确认框按钮随载体语言变化（真机中文=确认，无头载体英文=Confirm）——
            // 点最上层确认框的主按钮（b3-button--primary），比文本匹配可靠
            const clicked = await page.evaluate(() => {
                const dialogs = Array.from(document.querySelectorAll(".b3-dialog__container")).filter((c) => c.offsetParent !== null);
                const top = dialogs[dialogs.length - 1];
                if (!top) return { clicked: null, buttons: [] };
                const buttons = Array.from(top.querySelectorAll("button"))
                    .map((b) => ({ text: (b.textContent ?? "").trim(), primary: b.classList.contains("b3-button--primary") }))
                    .filter((b) => b.text);
                const target = buttons.filter((b) => b.primary).pop()
                    ?? buttons.find((b) => /^(确认|确定|Confirm|OK)$/i.test(b.text));
                if (target) {
                    const el = Array.from(top.querySelectorAll("button"))
                        .find((b) => (b.textContent ?? "").trim() === target.text && b.classList.contains("b3-button--primary") === target.primary);
                    el?.click();
                }
                return { clicked: target?.text ?? null, buttons: buttons.map((b) => b.text) };
            });
            console.log("   确认框点击：", JSON.stringify(clicked));
            await page.waitForTimeout(2000);
            const diag = await page.evaluate(() => ({
                confirmStill: Array.from(document.querySelectorAll(".b3-dialog button"))
                    .filter((b) => b.offsetParent !== null && /^(Confirm|Cancel|确认|取消)$/i.test((b.textContent ?? "").trim())).length,
                undoText: document.querySelector("#qg-capture-done [data-cap-undo]")?.textContent ?? "(卡已不在)",
            }));
            console.log("   Confirm 点击 2s 后：", JSON.stringify(diag));
            console.log("   deleteBlock 响应：", JSON.stringify(delResp));
            page.off("response", onResp);
            undoOk = diag.undoText === "已撤销";
            if (!undoOk) {
                await page.waitForFunction(() => {
                    const b = document.querySelector("#qg-capture-done [data-cap-undo]");
                    return b && /已撤销|撤销失败/.test(b.textContent ?? "");
                }, undefined, { timeout: 6000, polling: 300 }).catch(() => {});
                undoOk = await page.evaluate(() => /已撤销/.test(document.querySelector("#qg-capture-done [data-cap-undo]")?.textContent ?? ""));
            }
        } catch (e) {
            console.log("   撤销链异常：", String(e).slice(0, 160));
        }
        soft("I6b 撤销写入经宿主确认框删除块", undoOk, undoOk ? "块已删除" : "未完成（诊断已打印——记录待人工核对）");
    }
    await page.keyboard.press("Escape").catch(() => {});

    // ═══ I7 能力动作二段式真机执行（daily.status 只读）═══
    // I4/I6 的 petal 写入触发插件重载瞬态——先等实例回归；派发需本页持有消费权：接管（steal，真机功能）
    await waitPluginAlive(page);
    await cleanOrphanQgDialogs(page);
    for (let t = 0; t < 3; t++) {
        var tk = await callPlugin("takeoverBridge");
        if (tk?.ok) break;
        await sleep(1500); // 载体重载回归后也会抢注——重试竞态
    }
    console.log(`   接管消费权：${JSON.stringify(tk)}（使脚本页可派发 op）`);
    if (!tk?.ok) console.log("   ⚠ 接管未成功（载体竞态）——I7 预期失败，仅记录");
    await callPlugin("openCommandPalette");
    await page.waitForSelector("#qg-palette", { timeout: 5000 });
    // 重载瞬态下 1.2s 重探可能重建列表——填词后校验过滤生效，未生效重填（带值诊断）
    let capVisible = false;
    for (let t = 0; t < 4 && !capVisible; t++) {
        await page.fill('#qg-palette [data-role="q"]', "今日日记状态");
        await page.waitForTimeout(450);
        capVisible = await page.evaluate(() => Boolean(document.querySelector('#qg-palette [data-cap="daily.status"]')));
        if (!capVisible) console.log(`   第 ${t + 1} 次填词后能力项未出现（input.value="${await page.evaluate(() => document.querySelector('#qg-palette [data-role="q"]')?.value ?? "")}"）——重填`);
    }
    const palCount = await page.evaluate(() => document.querySelectorAll('#qg-palette').length);
        if (palCount > 1) {
            console.log('   ⚠ 检测到', palCount, '个堆叠面板（重载瞬态复制）——保留最后一个');
            await page.evaluate(() => {
                const all = Array.from(document.querySelectorAll('#qg-palette'));
                all.slice(0, -1).forEach((d) => d.closest('.b3-dialog')?.remove());
            });
        }
    hard("I7-pre 能力项过滤渲染", capVisible);
    // 命中点诊断：元素在但点击超时的常见原因是遮挡/滚动容器——先取证
    const hitDiag = await page.evaluate(() => {
        const el = document.querySelector('#qg-palette [data-cap="daily.status"]');
        if (!el) return { exists: false };
        const r = el.getBoundingClientRect();
        const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
            exists: true,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            hitTarget: center ? `${center.tagName}.${String(center.className).slice(0, 60)}` : "none",
            inViewport: r.y >= 0 && r.y + r.height <= innerHeight,
        };
    });
    console.log("   命中点诊断：", JSON.stringify(hitDiag));
    try {
        await page.locator('#qg-palette [data-cap="daily.status"]').last().click({ timeout: 8000 });
    } catch (e) {
        console.log("   click 完整错误：", String(e).slice(0, 900));
        throw e;
    }
    await page.waitForSelector('[data-form="exec"]', { timeout: 5000 });
    await page.click('[data-form="exec"]');
    // 采样诊断：35s 内轮询完成/失败/确认门控三种终态（只读 op 若被确认门控=分类缺陷，点掉并记录）
    let gated = false;
    let finalMsg = "";
    for (let t = 0; t < 70; t++) {
        await page.waitForTimeout(500);
        const st = await page.evaluate(() => ({
            gone: !document.contains(document.querySelector("#qg-palette")),
            msg: document.querySelector('[data-form="msg"]')?.textContent ?? "",
            confirmVisible: Array.from(document.querySelectorAll(".b3-dialog button"))
                .some((b) => b.offsetParent !== null && /^(确认|确定|Confirm|OK)$/i.test((b.textContent ?? "").trim())
                    && !b.closest("#qg-palette")),
        }));
        if (st.confirmVisible && !gated) {
            gated = true;
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll(".b3-dialog button"))
                    .filter((b) => b.offsetParent !== null && /^(确认|确定|Confirm|OK)$/i.test((b.textContent ?? "").trim())
                        && !b.closest("#qg-palette"));
                btns[btns.length - 1]?.click();
            });
        }
        if (st.gone) { finalMsg = "completed"; break; }
        if (st.msg && st.msg !== "执行中……") { finalMsg = st.msg; break; }
        finalMsg = st.msg;
    }
    const i7gone = finalMsg === "completed";
    // 诊断：dispatchOp 挂起时页面实例的桥运行态
    const diagState = await page.evaluate((name) => {
        const p = window.siyuan.ws.app.plugins.find((x) => x.name === name);
        return {
            activeService: Boolean(p?.activeService),
            pollerRunning: Boolean(p?.poller?.isRunning),
            bridgeEnabled: p?.settings?.bridgeEnabled,
            confirmExec: p?.settings?.confirmExec,
        };
    }, PLUGIN);
    console.log("   I7 诊断（页面插件实例）:", JSON.stringify(diagState));
    hard("I7 二段式表单真机执行（daily.status）", i7gone,
        i7gone ? (gated ? "执行完成，但只读 op 出现了确认门控（分类缺陷，已点掉）" : "执行 recorded，面板销毁") : `终态 msg="${finalMsg.slice(0, 100)}"${gated ? "（出现过确认门控）" : ""} diag=${JSON.stringify(diagState)}`);
    soft("I7-s 只读 op 不应确认门控", !gated, gated ? "daily.status 被确认门控——检查 registry 写操作分类" : "无门控 ✓");

    // ═══ I8 inbox 路径捕获撤销（appendBlock id=R298/R299 实证可删）═══
    // 预置收集箱文档（discoverConfig 按约定名发现）
    await waitPluginAlive(page);
    await cleanOrphanQgDialogs(page);
    const nbList = (await api("/api/notebook/lsNotebooks", {})).data.notebooks;
    await api("/api/filetree/createDocWithMd", { notebook: nbList[0].id, path: "/收集箱", markdown: "" });
    await callPlugin("openCommandPalette");
    await page.waitForSelector("#qg-palette", { timeout: 5000 });
    await page.fill('#qg-palette [data-role="q"]', "压测 inbox 捕获一条");
    await page.waitForTimeout(300);
    await page.click('[data-fb="capture"]');
    await page.waitForSelector("#qg-capture", { timeout: 5000 });
    await page.click('#qg-capture [data-target="inbox"]');
    const palCount8 = await page.evaluate(() => document.querySelectorAll('#qg-palette').length);
        if (palCount8 > 1) {
            console.log('   ⚠ 检测到', palCount8, '个堆叠面板（重载瞬态复制）——保留最后一个');
            await page.evaluate(() => {
                const all = Array.from(document.querySelectorAll('#qg-palette'));
                all.slice(0, -1).forEach((d) => d.closest('.b3-dialog')?.remove());
            });
        }
    let inboxOk = true;
    try { await page.waitForSelector("#qg-capture-done", { timeout: 8000 }); } catch { inboxOk = false; }
    hard("I8a inbox 捕获写入成功卡", inboxOk);
    if (inboxOk) {
        let undoOk = false;
        try {
            await page.click("#qg-capture-done [data-cap-undo]");
            await page.waitForTimeout(600);
            await page.evaluate(() => {
                const dialogs = Array.from(document.querySelectorAll(".b3-dialog__container")).filter((c) => c.offsetParent !== null);
                const top = dialogs[dialogs.length - 1];
                const target = Array.from(top?.querySelectorAll("button") ?? [])
                    .find((b) => /^(确认|确定|Confirm|OK)$/i.test((b.textContent ?? "").trim()));
                target?.click();
            });
            await page.waitForFunction(() => {
                const b = document.querySelector("#qg-capture-done [data-cap-undo]");
                return b && /已撤销|撤销失败/.test(b.textContent ?? "");
            }, undefined, { timeout: 8000, polling: 300 });
            undoOk = await page.evaluate(() => /已撤销/.test(document.querySelector("#qg-capture-done [data-cap-undo]")?.textContent ?? ""));
        } catch (e) {
            console.log("   inbox 撤销链异常：", String(e).slice(0, 160));
        }
        soft("I8b inbox 撤销写入删除块", undoOk, undoOk ? "块已删除" : "未完成（R298/R299 路径——记录待人工核对）");
    }
    await page.keyboard.press("Escape").catch(() => {});

    // ═══ 汇总 ═══
    const failed = results.filter((r) => !r.ok);
    console.log(`\n== UI 交互真机 e2e：${results.length - failed.length}/${results.length} 通过 ==`);
    await browser.close();
    process.exit(failed.length === 0 ? 0 : 1);
} catch (e) {
    console.error("✗ 脚本异常：", String(e).slice(0, 400));
    await page.screenshot({ path: "output/ui-interactions-FAIL.png" }).catch(() => {});
    await browser.close();
    process.exit(1);
}
