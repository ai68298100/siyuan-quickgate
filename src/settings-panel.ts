/**
 * 小驴快门 · 分层设置面板（R288 · G2-01/02/04 · 原型 design/ui-prototype/mvp1.html）
 *
 * 结构：思源原生 Dialog（G2-04 约定保留宿主入口）→ 侧导航 + 分层内容页：
 *   状态概览（健康首页 G2-02：通道卡片 + 运行 KPI + 下一步 + 最近回执）
 *   首跑向导（G2-01：真首跑时替代状态概览；环境检查 → 开启通道 → 连通自检 → 完成，全部真状态）
 *   连接与通道 / 安全与权限 / 队列与数据 / 诊断与生态 / 关于
 * 数据全部来自真实运行状态（stats / 载体文件 / 探针），空态给出原因与修复动作，不显示为空白。
 * 行为与旧面板一一对应（开关保存/热生效、行内校验、危险开关确认、清空预览、审计筛选复制等）。
 * 颜色一律 b3 令牌（index.scss，作用域 #qg-settings）；触控/焦点基线沿用 L282/R234。
 */
import { Dialog, showMessage, confirm, getFrontend } from "siyuan";

import { KernelApi } from "./services/kernelApi";
import { BridgeStore } from "./services/store";
import { PROCESSED_CAP } from "./services/store";
import { installFocusTrap } from "./services/focus-trap";
import { BridgeService, EcosystemManifest } from "./services/bridge-service";
import { SingleFlightPoller } from "./services/poller";
import { BroadcastSubscriber } from "./services/broadcast";
import { normalizeFavorites, FavoritesStore } from "./services/favorites";
import { normalizeProcessed, normalizeSettings } from "./services/store";
import { buildBackupPayload, parseBackupPayload } from "./data-backup";
import { fmtElapsedMs, fmtLocalStamp, fmtReceiptTime } from "./results-center";
import manifestJson from "./assets/ecosystem-manifests.json";
import { DEFAULT_SETTINGS, QuickGateSettings, AuditEntry } from "./types/bridge";
import { countRecoveryItems } from "./recovery-center";
import { countNotifications } from "./notification-center-ui";

const PLUGIN_NAME = "siyuan-quickgate";
const PLUGIN_VERSION = "0.7.5";

/** 重置撤销（L624 部分）：恢复默认后保留重置前设置快照；状态概览页提供本会话内撤销（模块级——重开会新面板仍可见） */
let preResetSnapshot: QuickGateSettings | null = null;

/** 宿主面（index.ts 提供运行态与操作；成员可见性为 public 以满足结构化类型） */
export interface SettingsPanelHost {
    settings: QuickGateSettings;
    store: BridgeStore;
    auditLog: AuditEntry[];
    poller?: SingleFlightPoller;
    broadcastSub?: BroadcastSubscriber;
    activeService?: BridgeService;
    kernelRouteProbe?: boolean;
    eventBridgeHandler?: (e: Event) => void;
    kernelApi: KernelApi;
    isMobileGuard(): boolean;
    startBridge(): Promise<boolean>;
    stopBridge(): Promise<void>;
    startEventBridge(): void;
    stopEventBridge(): void;
    selfPing(): Promise<void>;
    deps(): import("./services/bridge-service").BridgeServiceDeps;
    openSettingPanel(page?: string): void;
    openCommandPalette(): void;
    openRecoveryCenter(): void;
    openNotificationCenter(): void;
    openResultsCenter(): void;
    openQueuePage(): void;
    openConnectionPage(): void;
    bridgeAlive(): boolean;
    consecutiveFailures(): number;
    lateCompletions(): number;
    openDialog(content: string): { element: HTMLElement; destroy(): void };
}

/** 诊断包组装（脱敏：无 Token/正文/个人路径；自 index.ts 迁入——唯一使用方是设置面板） */
export function memDiagnostics(settings: QuickGateSettings, auditLog: AuditEntry[], service: BridgeService, readMetrics?: { ok: number; missing: number; auth: number; unreachable: number; unexpected: number }, broadcastMetrics?: { connects: number; reconnects: number; received: number; lastEventAt: number | null }) {
    const st = service.stats;
    return {
        protocol: 1,
        plugin: PLUGIN_NAME,
        version: PLUGIN_VERSION,
        settings: { ...settings },
        ...(readMetrics ? { fileRead: { ...readMetrics } } : {}),
        ...(broadcastMetrics ? { broadcast: { ...broadcastMetrics } } : {}),
        lateCompletions: service.lateCompletions,
        stats: { ...st, avgDispatchMs: st.commands > 0 ? Math.round(st.totalDispatchMs / st.commands) : null },
        auditTail: auditLog.slice(-50),
        exportedAt: new Date().toISOString(),
    };
}

const esc = (t: unknown) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** 无闪烁写入：内容未变化时不触碰 DOM——保住悬停态/文本选区，消除 3s 轮询重绘抖动（R289） */
const setHtml = (el: HTMLElement, html: string) => {
    if (el.dataset.h === html) return;
    el.innerHTML = html;
    el.dataset.h = html;
};

/** 按钮 pending 态：异步期间禁用+文案切换，结束恢复（防连点重复执行；节点被页面切换移除时恢复为无害空操作） */
const withPending = (btn: HTMLButtonElement, pendingText: string, fn: () => unknown | Promise<unknown>) => {
    if (btn.disabled) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = pendingText;
    void Promise.resolve()
        .then(fn)
        .catch(() => { /* 错误已由被调方经 showMessage 承载 */ })
        .finally(() => { btn.disabled = false; btn.textContent = original; });
};

/** 回执状态 → 语义徽章（recorded/duplicate=成功绿；rejected/expired=警示；failed/timeout=错误红） */
const receiptKind = (status?: string) =>
    status === "recorded" || status === "duplicate" ? "ok"
    : status === "rejected" || status === "expired" ? "warn"
    : status === "failed" || status === "timeout" ? "err"
    : "mute";

const pageHeader = (title: string, sub?: string) =>
    `<p class="qg-page-title">${esc(title)}</p>${sub ? `<p class="qg-page-sub">${esc(sub)}</p>` : ""}`;

/** KPI 数字排版：数值主体 19px，单位（ms/K/s）缩小降灰（原型 38<small>ms</small> 的层级） */
const kpiValue = (v: string | number) => {
    const m = String(v).match(/^([\d.,]+)(ms|K|s)$/);
    return m ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(v);
};

/** 生态目录显示净化：manifest 的调研注记（R2xx 真机轮次 / Lxxx 账本行号）是维护者信息，不面向用户 */
const stripDevNotes = (t: string) =>
    t.replace(/[（(](?:R\d{2,3}|L\d{2,3})[^）)]*[）)]/g, "").replace(/\s{2,}/g, " ").trim();

const ICONS: Record<string, string> = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/></svg>`,
    flow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>`,
};

type DotState = "ok" | "warn" | "off" | "err";
const dot = (s: DotState) => `<span class="qg-dot ${s}"></span>`;
const chip = (text: string, kind: "ok" | "warn" | "mute" = "mute") => `<span class="qg-chip ${kind}">${esc(text)}</span>`;

export async function openQuickGateSettings(host: SettingsPanelHost, initialPage = "status"): Promise<void> {
    const firstRunTitle = host.store.firstRun;
    // 焦点回归（L585 部分）：对话框销毁后焦点回到触发元素（思源 Dialog destroyCallback；失败不阻断）
    const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = new Dialog({
        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span>` +
            `<span>${firstRunTitle ? "小驴快门 · 欢迎" : "小驴快门 · 设置"}</span>` +
            `<span class="qg-title-ver">${firstRunTitle ? "首次使用" : `v${PLUGIN_VERSION} · 协议 v1`}</span></span>`,
        content: `<div id="qg-settings">` +
            `<div class="qg-searchbar"><input class="b3-text-field" data-role="qg-search" placeholder="搜索设置（跨分组；清空恢复当前页）" /></div>` +
            `<div class="qg-main"><div class="qg-nav"></div><select class="qg-nav-fallback b3-select" aria-label="切换分组"></select><div class="qg-content"></div></div>` +
            `<div class="qg-footer"><span>帮助：<a target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md">上手指南</a> · ` +
            `<a target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/FAQ.md">故障排查 FAQ</a> · ` +
            `<a target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/PRIVACY.md">隐私说明</a> · ` +
            `<a target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/api.md">op 契约</a></span>` +
            `<span class="sp"></span><span>本插件不外传任何数据（<a target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/PRIVACY.md">数据边界</a>）</span></div></div>`,
        width: "min(760px, 92vw)",
        height: "auto",
        destroyCallback: () => { try { focusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
    });
    const root = dialog.element.querySelector("#qg-settings") as HTMLElement;
    installFocusTrap(dialog.element); // L585 部分：Tab 在对话框内循环
    const nav = root.querySelector(".qg-nav") as HTMLElement;
    const fallback = root.querySelector(".qg-nav-fallback") as HTMLSelectElement;
    const content = root.querySelector(".qg-content") as HTMLElement;
    let current = "";
    let pageTimer = 0;
    /** 导航点刷新（由壳层注入；桥开关等状态变化后调用） */
    let refreshNav: () => void = () => {};

    /** 桥开关（状态概览向导与连接页共用同一套保存/启停逻辑） */
    const applyBridgeEnabled = async (on: boolean): Promise<void> => {
        host.settings.bridgeEnabled = on;
        host.store.settings = host.settings;
        await host.store.saveSettings();
        if (on && !host.isMobileGuard()) {
            const started = await host.startBridge(); // L506：等认领完成再提示，如实反映结果
            host.startEventBridge(); // 与 onload 配对：开启桥即接上事件物化
            showMessage(started ? "外部命令桥已开启（本窗口消费）" : "另一思源窗口正在运行外部命令桥，本窗口未重复启动", 4000, "info");
            return;
        }
        await host.stopBridge();
        host.stopEventBridge(); // 关桥即退订，事件物化不得在桥关闭后继续写
        showMessage("外部命令桥已关闭", 3000);
    };

    /** 全量备份下载（队列页「导出全量备份」与「恢复默认设置」防线的共享实现；L624 部分：重置前先备份） */
    const downloadFullBackup = async (): Promise<void> => {
        const readText = async (p: string) => (await host.kernelApi.getFileText(p)) ?? "";
        const parseOr = <T,>(text: string, fallback: T): T => { try { return JSON.parse(text) as T; } catch { return fallback; } };
        const payload = buildBackupPayload({
            settings: host.settings,
            favorites: parseOr(await readText("/storage/petal/siyuan-quickgate/favorites.json"), null),
            audit: parseOr(await readText("/storage/petal/siyuan-quickgate/audit.json"), null),
            processed: host.store.processed,
            resultsNdjson: await readText(`${host.settings.bridgeBasePath}/results.ndjson`),
        }, new Date().toISOString());
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `quickgate-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    /** 诊断包 JSON 组装（诊断页按钮与桥恢复向导共用；统计取自活动服务实例避免全零失真） */
    const buildDiagJson = async (): Promise<string> => {
        const service = host.activeService ?? new BridgeService(host.deps() as never);
        return JSON.stringify(memDiagnostics(host.settings, host.auditLog, service, host.kernelApi.readMetrics, host.broadcastSub?.metrics), null, 2);
    };

    /** 清空命令队列（带预览确认；队列页危险区与桥恢复向导共用） */
    const clearQueueWithPreview = async (onDone?: () => void): Promise<void> => {
        try {
            const base = host.settings.bridgeBasePath;
            const text = (await host.kernelApi.getFileText(`${base}/commands.ndjson`)) ?? "";
            const ls = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
            let oldest = "";
            for (const l of ls) {
                try { const c = JSON.parse(l); if (typeof c.createdAt === "string" && (!oldest || c.createdAt < oldest)) oldest = c.createdAt; } catch { }
            }
            const preview = ls.length === 0
                ? "队列当前为空。仍将清空回执文件并重置处理台账。"
                : `将丢弃 ${ls.length} 条未消费命令${oldest ? `（最早提交 ${fmtLocalStamp(oldest)}）` : ""}，并清空回执文件与处理台账。`;
            confirm(
                "小驴快门 · 清空队列",
                preview + " 此操作不可撤销。",
                async () => {
                    try {
                        await host.kernelApi.putFileText(`${base}/commands.ndjson`, "");
                        await host.kernelApi.putFileText(`${base}/results.ndjson`, "");
                        host.store.processed = { schemaVersion: 2, processed: {} };
                        await host.store.saveProcessed();
                        showMessage("命令队列已清空", 3000);
                        onDone?.();
                    } catch (e) {
                        showMessage(`清空失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
                    }
                },
                () => { },
            );
        } catch (e) {
            showMessage(`预览失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
        }
    };

    // —— 通用行构造（原型 .qg-row：图标 + 标题/说明 + 控件；clickable 时点行即切控件；wide 时控件通栏） ——
    const row = (parent: HTMLElement, opts: { icon: string; label: string; chip?: string; hint?: string; ctrl: HTMLElement; onRowClick?: () => void; wide?: boolean }) => {
        const div = document.createElement("div");
        div.className = "qg-row" + (opts.onRowClick ? " clickable" : "") + (opts.wide ? " wide" : "");
        div.innerHTML = `<div class="ic">${ICONS[opts.icon] ?? ""}</div>` +
            `<div class="body"><div class="label">${esc(opts.label)}${opts.chip ? " " + chip(opts.chip) : ""}</div>` +
            `${opts.hint ? `<div class="hint">${opts.hint}</div>` : ""}</div>`;
        const ctrl = document.createElement("div");
        ctrl.className = "ctrl";
        ctrl.appendChild(opts.ctrl);
        div.appendChild(ctrl);
        if (opts.onRowClick) {
            div.addEventListener("click", (ev) => {
                // 点行体切换；点到控件本体（switch/input/textarea/button）时不重复触发
                const target = ev.target as HTMLElement;
                if (target.closest(".ctrl") || target.closest("a") || target.closest("button")) return;
                opts.onRowClick!();
            });
        }
        parent.appendChild(div);
        return div;
    };
    const switchCtrl = (checked: boolean, onchange: (v: boolean) => void) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "b3-switch";
        input.checked = checked;
        input.onchange = () => void onchange(input.checked);
        return input;
    };

    // ══════════ 页：状态概览 / 首跑向导 ══════════
    const pageStatus = () => {
        if (host.store.firstRun && !host.settings.bridgeEnabled) {
            renderWizard();
            return;
        }
        content.innerHTML = pageHeader("状态概览", "通道实时状态 · 每 3 秒自动刷新") +
            `<div data-role="undo-banner"></div>` +
            `<div class="qg-grid2" data-role="cards"></div>` +
            `<div class="qg-kpi" data-role="kpi"></div>` +
            `<div class="qg-card" data-role="next"><div class="qg-card-title">下一步<span style="flex:1"></span><span style="display:flex;gap:6px" data-role="next-side"></span></div><div class="qg-hint" style="font-size:12px;color:var(--b3-theme-on-surface)"></div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap" data-role="next-btns"></div></div>` +
            `<div class="qg-card" style="padding:0 14px 4px"><div class="qg-card-title" style="padding:10px 0 6px">最近回执 <span data-role="asof" style="margin-left:auto"></span></div><div data-role="receipts" role="status" aria-live="polite" style="min-height:24px"></div></div>`;

        const pingBtn = document.createElement("button");
        pingBtn.className = "b3-button qg-btn-primary";
        pingBtn.textContent = "桥自检（bridge.ping）";
        pingBtn.onclick = () => withPending(pingBtn, "自检中…", () => host.selfPing());
        const ecoBtn = document.createElement("button");
        ecoBtn.className = "b3-button b3-button--outline";
        ecoBtn.textContent = "查看能力目录";
        ecoBtn.onclick = () => showEcoDialog();
        const paletteBtn = document.createElement("button");
        paletteBtn.className = "b3-button b3-button--outline";
        paletteBtn.textContent = "命令面板";
        paletteBtn.onclick = () => { dialog.destroy(); host.openCommandPalette(); };
        // 通知/恢复中心是次级入口：收进卡头右侧小按钮——主行只留主动作（五钮平铺换行会有孤行）
        const notifyBtn = document.createElement("button");
        notifyBtn.className = "b3-button b3-button--small";
        notifyBtn.dataset.role = "notify";
        notifyBtn.textContent = "通知";
        notifyBtn.onclick = () => { dialog.destroy(); host.openNotificationCenter(); };
        const recoveryBtn = document.createElement("button");
        recoveryBtn.className = "b3-button b3-button--small";
        recoveryBtn.dataset.role = "recovery";
        recoveryBtn.textContent = "恢复中心";
        recoveryBtn.onclick = () => { dialog.destroy(); host.openRecoveryCenter(); };
        root.querySelector("[data-role=next-side]")?.append(notifyBtn, recoveryBtn);
        void countNotifications(host).then((n) => {
            if (n > 0 && document.body.contains(notifyBtn)) notifyBtn.textContent = `通知（${n}）`;
        });
        // G5：有 unknown/失败/过期候选时按钮带计数徽章（异步刷新）
        void countRecoveryItems(host).then((n) => {
            if (n > 0 && document.body.contains(recoveryBtn)) recoveryBtn.textContent = `恢复中心（${n}）`;
        });
        root.querySelector("[data-role=next-btns]")?.append(pingBtn, ecoBtn, paletteBtn);

        // 重置撤销横幅（L624 部分）：恢复默认后本会话内可一键撤销（恢复重置前设置并按需重启桥）
        if (preResetSnapshot) {
            const banner = root.querySelector("[data-role=undo-banner]") as HTMLElement;
            banner.innerHTML = `<div class="qg-card accent" style="display:flex;gap:10px;align-items:center;padding:10px 14px;flex-wrap:wrap">` +
                `<span style="font-size:12px">已恢复默认设置——本会话内可撤销（恢复重置前全部设置，桥按该设置重启）。</span>` +
                `<span style="flex:1"></span>` +
                `<button class="b3-button b3-button--primary" data-role="undo-reset">撤销重置</button>` +
                `<button class="b3-button" data-role="undo-dismiss">不再提醒</button></div>`;
            (banner.querySelector("[data-role=undo-reset]") as HTMLElement).onclick = () => {
                const snap = preResetSnapshot;
                preResetSnapshot = null;
                if (!snap) return;
                void (async () => {
                    host.settings = JSON.parse(JSON.stringify(snap)) as QuickGateSettings;
                    host.store.settings = host.settings;
                    await host.store.saveSettings();
                    await host.stopBridge();
                    host.stopEventBridge();
                    if (host.broadcastSub?.running) await host.broadcastSub.stop();
                    if (host.settings.bridgeEnabled && !host.isMobileGuard()) {
                        await host.startBridge();
                        host.startEventBridge();
                    }
                    showMessage("已撤销重置：恢复重置前设置（桥按该设置重启）", 3000, "info");
                    show("status");
                })();
            };
            (banner.querySelector("[data-role=undo-dismiss]") as HTMLElement).onclick = () => {
                preResetSnapshot = null;
                banner.innerHTML = "";
            };
        }

        const refresh = async () => {
            if (!document.body.contains(root) || current !== "status") return;
            const st = host.activeService?.stats;
            const avg = st && st.commands > 0 ? Math.round(st.totalDispatchMs / st.commands) : null;
            const backoff = host.poller && host.poller.consecutiveFailures > 0 ? host.poller.consecutiveFailures : 0;
            // 通道卡片（L505 内核路由探针：undefined=探测中）；运行中通道的状态点带呼吸
            const route = host.kernelRouteProbe === undefined ? { dot: "warn", chip: chip("探测中", "mute") }
                : host.kernelRouteProbe ? { dot: "ok", chip: chip("可用", "ok") }
                : { dot: "off", chip: chip("不可达", "warn") };
            const cards = root.querySelector("[data-role=cards]") as HTMLElement;
            setHtml(cards, [
                { name: "外部命令桥", d: host.poller?.isRunning ? "ok" : "off", live: host.poller?.isRunning === true, chip: host.poller?.isRunning ? chip("运行中", "ok") : chip("已停止", "warn"), sub: host.poller?.isRunning ? `本窗口消费 · 轮询 ${host.settings.pollMs}ms${backoff ? ` · 退避中×${backoff}` : ""}` : "默认关；在「连接与通道」开启" },
                { name: "广播快路径", d: host.broadcastSub?.running ? "ok" : "off", live: host.broadcastSub?.running === true, chip: host.broadcastSub?.running ? chip("已开启", "ok") : chip("关", "mute"), sub: host.broadcastSub?.running ? `qg-cmd 频道 · 已收 ${host.broadcastSub.metrics.received} 条` : "默认关；需先开桥" },
                { name: "事件物化", d: host.eventBridgeHandler ? "ok" : "off", live: host.eventBridgeHandler !== undefined, chip: host.eventBridgeHandler ? chip("已接", "ok") : chip("未接", "mute"), sub: host.eventBridgeHandler ? `白名单监听中 · 台账 ${Object.keys(host.store.processed.processed).length} 条` : "桥开启时自动接入" },
                { name: "内核路由", d: route.dot, live: host.kernelRouteProbe === true, chip: route.chip, sub: "/plugin/private 同步通道（不经桥开关）" },
            ].map((c) => `<div class="qg-stat-card"><div class="head"><span class="qg-dot ${c.d}${c.live ? " live" : ""}"></span>${esc(c.name)}<span style="margin-left:auto">${c.chip}</span></div><div class="sub">${esc(c.sub)}</div></div>`).join(""));
            // KPI
            const kpi = root.querySelector("[data-role=kpi]") as HTMLElement;
            setHtml(kpi, st ? [
                { v: st.commands, l: "累计命令" }, { v: st.ok, l: "成功" }, { v: st.rejected, l: "拒绝" },
                { v: st.failed + st.expired, l: "失败 / 过期" }, { v: avg !== null ? `${avg}ms` : "–", l: "平均耗时" },
            ].map((k) => `<div class="kv"><b>${kpiValue(k.v)}</b><span>${esc(k.l)}</span></div>`).join("")
                : `<div class="kv" style="flex:1"><b>–</b><span>服务未启动（桥关闭时不派发）</span></div>`);
            // 下一步（G2-03：状态 → 动作，不给空白）
            const next = root.querySelector("[data-role=next] .qg-hint") as HTMLElement;
            const nextText = !host.settings.bridgeEnabled
                ? "外部命令桥未开启——开启后外部程序才能发命令进来。"
                : host.kernelRouteProbe === false
                    ? "内核同步路由不可达（桥不受影响）——可到「诊断与生态」导出诊断包定位。"
                    : backoff > 0
                        ? `轮询连续失败 ${backoff} 次，已指数退避——请检查内核与存储是否可写。`
                        : "通道就绪。可从 Quicker / CLI 发一条 bridge.ping 试运行，或核对小驴插件能力目录。";
            if (next.textContent !== nextText) next.textContent = nextText;
            // 最近回执（结果文件尾部 3 条；载入中骨架屏；空态给原因不显示空白）
            const asof = root.querySelector("[data-role=asof]") as HTMLElement;
            const asofHtml = st?.lastActivityAt ? chip(`数据截至 ${new Date(st.lastActivityAt).toLocaleTimeString()}`, "mute") : "";
            setHtml(asof, asofHtml);
            const box = root.querySelector("[data-role=receipts]") as HTMLElement;
            try {
                const text = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/results.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").slice(-3) : [];
                setHtml(box, lines.length === 0
                    ? `<div style="font-size:11px;color:var(--b3-theme-on-surface);padding:6px 0">暂无回执——桥开启后外部命令的回执会出现在这里。</div>`
                    : `<table class="qg-receipts"><tbody>${lines.map((l) => {
                        try {
                            const r = JSON.parse(l) as { status?: string; op?: string; finishedAt?: string; elapsedMs?: number };
                            return `<tr><td><span class="qg-chip ${receiptKind(r.status)}">${esc(r.status ?? "?")}</span></td><td class="qg-mono">${esc(r.op ?? "?")}</td><td class="qg-dim qg-num">${esc(fmtReceiptTime(r.finishedAt ?? ""))}</td><td class="qg-dim qg-num">${esc(fmtElapsedMs(Number(r.elapsedMs)))}</td></tr>`;
                        } catch { return `<tr><td><span class="qg-chip warn">bad-line</span></td><td class="qg-mono">${esc(l.slice(0, 60))}</td><td></td><td></td></tr>`; }
                    }).join("")}</tbody></table>`);
            } catch (e) {
                // L652：读取异常要给原因，不得写成"暂无回执"
                setHtml(box, `<div style="font-size:11px;color:var(--b3-theme-error);padding:6px 0">回执读取失败：${esc(e instanceof Error ? e.message : String(e))}</div>`);
            }
        };
        // 首屏骨架屏（异步回执未就绪时）
        const box0 = root.querySelector("[data-role=receipts]") as HTMLElement;
        box0.innerHTML = `<div class="qg-skel"><span></span><span></span><span></span></div>`;
        void refresh();
        // L505：内核路由状态探针（开面板一次性；随 petal 启用即用，不经桥开关）
        void (async () => {
            try {
                const r = await host.kernelApi.post<unknown>(`/plugin/private/${PLUGIN_NAME}/exec`, { op: "bridge.ping", args: {} });
                host.kernelRouteProbe = !!r;
            } catch { host.kernelRouteProbe = false; }
            void refresh();
        })();
        pageTimer = window.setInterval(() => void refresh(), 3000);
    };

    /** 首跑向导（G2-01）：环境检查 → 开启通道 → 连通自检 → 完成；每步真状态，失败给原因 */
    const renderWizard = () => {
        let pingState: "idle" | "running" | "ok" | "err" = "idle";
        let pingMsg = "";
        let pingMs = 0;
        let pingEvidence = ""; // L564 部分：自检证据（可复制，含时间/结果/耗时/通道）
        let envState: "running" | "ok" | "err" = "running";
        let envMsg = "检查内核与存储……";
        content.innerHTML = `<p class="qg-page-title" style="font-size:14px;color:var(--b3-theme-on-background)">三步接通外部自动化<span style="font-weight:400;color:var(--b3-theme-on-surface)">　——　Quicker / 快捷指令 / CLI 复用同一条命令通道</span></p>` +
            // L565 部分：双路径如实说明——不开桥也有可用的只读面
            `<p style="font-size:11px;color:var(--b3-theme-on-surface);margin:0 0 10px;line-height:1.6">两条路径，按需选择：①<b>外部桥</b>（Quicker / CLI / 手机快捷指令）需完成下面的向导显式开启；②<b>不开桥也可用</b>——AI 助手经 <a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/src/mcp/README.md">MCP 只读工具</a>、或内核同步路由的 7 个只读 op（见 <a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/api.md">op 契约</a>），桥关闭时同样工作。</p>` +
            `<div class="qg-steps" data-role="steps"></div><div data-role="body"></div>` +
            `<div style="font-size:11px;color:var(--b3-theme-on-surface);margin-top:8px">跳过向导，直接浏览<a data-role="skip" style="color:var(--b3-theme-primary);cursor:pointer">全部设置</a></div>`;

        const stepsEl = root.querySelector("[data-role=steps]") as HTMLElement;
        const bodyEl = root.querySelector("[data-role=body]") as HTMLElement;
        const render = () => {
            const bridgeOn = host.settings.bridgeEnabled;
            const stepIdx = pingState === "ok" ? 3 : bridgeOn ? 2 : envState === "ok" ? 1 : 0;
            stepsEl.innerHTML = ["环境检查", "开启通道", "连通自检", "完成"].map((label, i) => {
                const cls = i < stepIdx ? "done" : i === stepIdx ? "current" : "";
                const ball = i < stepIdx ? "✓" : String(i + 1);
                return `<div class="qg-step ${cls}"><div class="ball">${ball}</div>${esc(label)}</div>`;
            }).join("");
            bodyEl.innerHTML = "";
            // 步骤 1：环境检查（真探针：内核 version）
            const envCard = document.createElement("div");
            envCard.className = "qg-card";
            envCard.innerHTML = `<div class="qg-card-title">${dot(envState === "ok" ? "ok" : envState === "err" ? "err" : "warn")}环境检查 <span data-role="envchip" style="margin-left:auto">${envState === "ok" ? chip("通过", "ok") : envState === "err" ? chip("未通过", "warn") : chip("检查中", "mute")}</span></div><div style="font-size:12px;color:var(--b3-theme-on-surface)">${esc(envMsg)}</div>`;
            bodyEl.appendChild(envCard);
            // 步骤 2：开启通道
            const bridgeCard = document.createElement("div");
            bridgeCard.className = "qg-card";
            bridgeCard.classList.toggle("accent", stepIdx === 1);
            const toggle = switchCtrl(bridgeOn, async (v) => { await applyBridgeEnabled(v); render(); });
            bridgeCard.innerHTML = `<div class="qg-card-title">开启外部命令桥 <span style="margin-left:auto">${chip("默认关", "mute")}</span></div>` +
                `<div style="font-size:12px;color:var(--b3-theme-on-surface);margin-bottom:8px">开启后外部程序才能发命令进来。所有命令留审计、写操作有确认门控；随时可关。</div>`;
            const line = document.createElement("div");
            line.style.cssText = "display:flex;align-items:center;gap:10px";
            line.append(toggle, Object.assign(document.createElement("span"), { textContent: bridgeOn ? "已开启（本窗口消费）" : "未开启", style: "font-size:12px" }));
            if (bridgeOn) {
                const nextBtn = document.createElement("button");
                nextBtn.className = "b3-button b3-button--primary";
                nextBtn.textContent = "下一步：连通自检";
                nextBtn.disabled = pingState === "running"; // 自检期间禁用，防连点重复执行
                nextBtn.onclick = () => void runPing();
                const sp = document.createElement("span"); sp.style.flex = "1";
                line.append(sp, nextBtn);
            }
            bridgeCard.appendChild(line);
            bodyEl.appendChild(bridgeCard);
            // 步骤 3：连通自检
            const pingCard = document.createElement("div");
            pingCard.className = "qg-card";
            pingCard.classList.toggle("dimmed", !bridgeOn);
            pingCard.innerHTML = `<div class="qg-card-title">连通自检 <span data-role="pingchip" style="margin-left:auto">${pingState === "ok" ? chip("通过", "ok") : pingState === "err" ? chip("失败", "warn") : pingState === "running" ? chip("检测中", "mute") : chip("待上一步", "mute")}</span></div>` +
                `<div style="font-size:12px;color:var(--b3-theme-on-surface)">${pingState === "err" ? esc(pingMsg) : `发一条 <b>bridge.ping</b> 并核对回执——通过后即可从外部客户端发第一条真实命令。`}</div>`;
            if (bridgeOn) {
                const btn = document.createElement("button");
                btn.className = "b3-button b3-button--outline";
                btn.style.marginTop = "8px";
                btn.textContent = pingState === "running" ? "自检中…" : "发 bridge.ping";
                btn.disabled = pingState === "running";
                btn.onclick = () => void runPing();
                pingCard.appendChild(btn);
                // L564 部分：自检完成后提供可复制证据（时间/结果/耗时/通道——贴进 issue 或留档）
                if (pingState === "ok" || pingState === "err") {
                    const evBtn = document.createElement("button");
                    evBtn.className = "b3-button b3-button--outline";
                    evBtn.style.marginTop = "8px";
                    evBtn.style.marginLeft = "6px";
                    evBtn.textContent = "复制证据";
                    evBtn.title = "复制本次自检证据 JSON（时间/结果/耗时/通道）";
                    evBtn.onclick = () => {
                        void navigator.clipboard.writeText(pingEvidence).then(() => showMessage("自检证据已复制", 2000, "info"));
                    };
                    pingCard.appendChild(evBtn);
                }
            }
            bodyEl.appendChild(pingCard);
            // 步骤 4：完成
            if (pingState === "ok") {
                const done = document.createElement("div");
                done.className = "qg-card";
                done.innerHTML = `<div class="qg-card-title">${dot("ok")}完成 <span style="margin-left:auto">${chip("可以开始用了", "ok")}</span></div><div style="font-size:12px;color:var(--b3-theme-on-surface)">从 Quicker / CLI 发第一条真实命令；写命令会弹确认。数据流向与隐私边界见 PRIVACY.md（本插件不外传任何数据）。</div>`;
                const browse = document.createElement("button");
                browse.className = "b3-button b3-button--outline";
                browse.style.marginTop = "8px";
                browse.textContent = "浏览全部设置";
                browse.onclick = () => show("connection");
                done.appendChild(browse);
                bodyEl.appendChild(done);
            }
        };
        const runPing = async () => {
            pingState = "running"; render();
            const started = performance.now();
            try {
                const service = new BridgeService(host.deps() as never);
                const r = await service.tick();
                pingMs = Math.round(performance.now() - started);
                pingState = "ok";
                pingMsg = "";
                pingEvidence = JSON.stringify({ time: new Date().toISOString(), result: "ok", executed: r.executed, receipts: r.receipts, elapsedMs: pingMs, channel: "wizard", op: "bridge.ping" });
                showMessage(`自检通过：处理 ${r.executed} 条，回执 ${r.receipts} 条`, 3000, "info");
            } catch (e) {
                pingMs = Math.round(performance.now() - started);
                pingState = "err";
                pingMsg = `自检失败：${e instanceof Error ? e.message : String(e)}（内核不可达或桥目录不可写——见下方原因，修好后可重试）`;
                pingEvidence = JSON.stringify({ time: new Date().toISOString(), result: "err", error: e instanceof Error ? e.message : String(e), elapsedMs: pingMs, channel: "wizard", op: "bridge.ping" });
            }
            render();
        };
        // 环境检查探针：内核可达 + 存储可读（读自身设置载体）；失败给原因（G2-03）
        void (async () => {
            try {
                await host.kernelApi.post("/api/system/version", {});
                await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/commands.ndjson`);
                envState = "ok";
                envMsg = `思源内核可达 ✓　插件已加载 ✓　桥目录可读 ✓`;
            } catch (e) {
                envState = "err";
                envMsg = `环境未就绪：${e instanceof Error ? e.message : String(e)}——请确认思源正在运行后重试。`;
            }
            render();
        })();
        content.querySelector("[data-role=skip]")?.addEventListener("click", () => show("connection"));
        render();
    };

    // ══════════ 页：连接与通道 ══════════
    const pageConnection = () => {
        content.innerHTML = pageHeader("连接与通道", "改动即保存生效，无需「确定」");
        const card = document.createElement("div");
        card.className = "qg-card";
        card.style.padding = "2px 14px";
        content.appendChild(card);

        const enabledInput = switchCtrl(host.settings.bridgeEnabled, async (v) => { await applyBridgeEnabled(v); refreshNav(); });
        row(card, {
            icon: "flow", label: "外部命令桥", chip: "默认关",
            hint: "开启后外部程序（Quicker / CLI / MCP）可发命令。思源端弹确认、全程留审计。",
            ctrl: enabledInput,
            onRowClick: () => { enabledInput.checked = !enabledInput.checked; void applyBridgeEnabled(enabledInput.checked).then(refreshNav); },
        });

        const mobileInput = switchCtrl(host.settings.mobileBridgeEnabled || host.settings.deviceName.endsWith(":mobile-on"), async (v) => {
            host.settings.mobileBridgeEnabled = v;
            host.store.settings = host.settings;
            await host.store.saveSettings();
            showMessage(`移动端桥已${v ? "允许" : "关闭"}（仅在移动端设备上生效）`, 3000);
        });
        row(card, {
            icon: "phone", label: "移动端桥 opt-in", chip: "默认关",
            hint: "移动端上开启外部命令桥需单独打开此项。",
            ctrl: mobileInput,
            onRowClick: () => { mobileInput.checked = !mobileInput.checked; mobileInput.dispatchEvent(new Event("change")); },
        });

        const bcInput = switchCtrl(host.settings.broadcastEnabled, async (v) => {
            host.settings.broadcastEnabled = v;
            host.store.settings = host.settings;
            await host.store.saveSettings();
            if (v && host.settings.bridgeEnabled && !host.isMobileGuard()) {
                await host.startBridge(); // startBridge 内部按开关幂等启动广播订阅
            } else if (host.broadcastSub?.running) {
                await host.broadcastSub.stop();
            }
            showMessage(`广播快路径已${v ? "开启（毫秒级命令通道 qg-cmd）" : "关闭"}`, 3000);
        });
        row(card, {
            icon: "bolt", label: "广播快路径 v1.5", chip: "默认关",
            hint: "需先开桥；postMessage → qg-cmd 频道毫秒级执行。",
            ctrl: bcInput,
            onRowClick: () => { bcInput.checked = !bcInput.checked; bcInput.dispatchEvent(new Event("change")); },
        });

        const pollWrap = document.createElement("div");
        pollWrap.style.display = "flex";
        pollWrap.style.alignItems = "center";
        pollWrap.style.gap = "6px";
        const pollInput = document.createElement("input");
        pollInput.type = "number";
        pollInput.className = "b3-text-field";
        pollInput.style.width = "90px";
        pollInput.value = String(host.settings.pollMs);
        const pollErr = document.createElement("span");
        pollErr.setAttribute("role", "alert");
        pollErr.style.color = "var(--b3-theme-error)";
        pollErr.style.fontSize = "11px";
        const pollHint = document.createElement("span");
        pollHint.textContent = "热生效";
        pollHint.style.cssText = "font-size:11px;color:var(--b3-theme-on-surface)";
        pollWrap.append(pollInput, pollErr, pollHint);
        pollInput.onchange = async () => {
            const v = parseInt(pollInput.value, 10);
            if (v >= 200 && v <= 60000) {
                pollErr.textContent = "";
                host.settings.pollMs = v;
                host.store.settings = host.settings;
                await host.store.saveSettings();
                if (host.poller?.isRunning) { // L659：运行中的桥热应用新间隔
                    await host.stopBridge();
                    const started = await host.startBridge();
                    showMessage(started ? `轮询间隔已生效：${v}ms` : "间隔已保存；桥消费权被他窗持有，本窗口轮询未重启", 3000, "info");
                }
            } else {
                pollErr.textContent = "须为 200~60000 的整数，已还原当前生效值";
                pollInput.value = String(host.settings.pollMs);
            }
        };
        row(card, { icon: "clock", label: "轮询间隔（ms）", hint: "200 ~ 60000；行内校验，非法值还原并提示原因；修改后立即生效（运行中的桥自动重启轮询）。", ctrl: pollWrap });

        // R301/R304：快速捕获默认去向（与命令面板选择器共享同一字段；选择器选择亦回写此处）
        const targetSel = document.createElement("select");
        targetSel.className = "b3-select";
        for (const [v, label] of [["daily", "今日日记（HH:mm 前缀）"], ["inbox", "收集箱（纯文本）"]] as const) {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = label;
            targetSel.appendChild(opt);
        }
        targetSel.value = host.settings.captureTarget;
        targetSel.onchange = async () => {
            host.settings.captureTarget = targetSel.value as "daily" | "inbox";
            host.store.settings = host.settings;
            await host.store.saveSettings();
            showMessage(`快速捕获默认去向已设为「${targetSel.selectedOptions[0]?.textContent ?? targetSel.value}」`, 2500, "info");
        };
        row(card, { icon: "check", label: "快速捕获默认去向", hint: "命令面板「捕获」按钮的去向（选择器仍会记住上次使用并排前）。", ctrl: targetSel });

        const claimCard = document.createElement("div");
        claimCard.className = "qg-card";
        claimCard.style.cssText = "display:flex;gap:8px;align-items:center;padding:10px 14px;flex-wrap:wrap";
        claimCard.innerHTML = `<span style="font-size:12px;color:var(--b3-theme-on-surface)">桥消费权：${host.poller?.isRunning ? "本窗口持有（Web Lock 认领）" : "未由本窗口持有"}</span>`;
        const recoveryLink = document.createElement("button");
        recoveryLink.className = "b3-button b3-button--small";
        recoveryLink.textContent = "桥出问题了？运行恢复向导";
        recoveryLink.onclick = () => showBridgeRecoveryWizard();
        const pingBtn = document.createElement("button");
        pingBtn.className = "b3-button b3-button--outline";
        pingBtn.textContent = "桥自检";
        pingBtn.style.marginLeft = "auto";
        pingBtn.onclick = () => withPending(pingBtn, "自检中…", () => host.selfPing());
        claimCard.append(recoveryLink, pingBtn);
        content.appendChild(claimCard);
    };

    // ══════════ 页：安全与权限 ══════════
    const pageSecurity = () => {
        content.innerHTML = pageHeader("安全与权限", "所有写命令默认经确认门控；透传面最小化");
        const card = document.createElement("div");
        card.className = "qg-card";
        card.style.padding = "2px 14px";
        content.appendChild(card);

        const confirmInput = switchCtrl(host.settings.confirmExec, async (v) => {
            host.settings.confirmExec = v;
            host.store.settings = host.settings;
            await host.store.saveSettings();
        });
        row(card, { icon: "check", label: "命令执行前确认", chip: "默认开", hint: "思源端弹确认，30 秒超时拒绝。", ctrl: confirmInput });

        const rawInput = switchCtrl(host.settings.rawApiEnabled, async (v) => {
            if (v) {
                // L513：启用前列出影响/留痕/可逆性（危险开关确认框纪律）；取消则回滚开关
                const 名单 = host.settings.rawApiAllowlist.length > 0
                    ? host.settings.rawApiAllowlist.join("、")
                    : "（当前名单为空——开启后调用仍会被全部拒绝，请先在下方编辑名单）";
                confirm(
                    "小驴快门 · 启用 plugin.api 高级透传",
                    `将允许外部客户端（MCP/CLI）经快门调用名单内插件的窗口桥方法：${名单}。\n` +
                    `所有调用留审计（仅记录插件与方法名，不含参数值）。随时可关闭本开关回退，设置即改即生效。`,
                    async () => {
                        host.settings.rawApiEnabled = true;
                        host.store.settings = host.settings;
                        await host.store.saveSettings();
                        showMessage("plugin.api 已启用（名单可在下方编辑）", 3000);
                    },
                    () => { rawInput.checked = false; },
                );
                return;
            }
            host.settings.rawApiEnabled = false;
            host.store.settings = host.settings;
            await host.store.saveSettings();
        });
        row(card, { icon: "shield", label: "plugin.api 高级透传", chip: "默认关", hint: "启用前确认；配合允许名单使用。", ctrl: rawInput });

        // L458：允许名单编辑（行内校验 pluginId 形状）
        const allowlistInput = document.createElement("textarea");
        allowlistInput.className = "b3-text-field";
        allowlistInput.style.width = "100%";
        allowlistInput.rows = 2;
        allowlistInput.value = host.settings.rawApiAllowlist.join(", ");
        allowlistInput.onchange = async () => {
            const raw = allowlistInput.value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
            const invalid = raw.filter((s) => !/^siyuan-[a-z0-9-]+$/.test(s));
            const valid = raw.filter((s) => /^siyuan-[a-z0-9-]+$/.test(s));
            host.settings.rawApiAllowlist = [...new Set(valid)];
            host.store.settings = host.settings;
            await host.store.saveSettings();
            allowlistInput.value = host.settings.rawApiAllowlist.join(", ");
            if (invalid.length > 0) {
                showMessage(`已保存合法条目；以下不符合 pluginId 形状（siyuan-*）被剔除：${invalid.join("、")}`, 5000, "error");
            } else {
                showMessage("允许名单已保存", 1500, "info");
            }
        };
        row(card, { icon: "list", label: "plugin.api 允许名单", hint: "逗号分隔的 pluginId；默认仅含已完成契约审计的三个插件（打卡/人脉/雷切）——新加入即授权透传其窗口桥，请先完成契约审计。", ctrl: allowlistInput, wide: true });

        const blacklistInput = document.createElement("textarea");
        blacklistInput.className = "b3-text-field";
        blacklistInput.style.width = "100%";
        blacklistInput.rows = 2;
        blacklistInput.value = host.settings.blacklist.join(", ");
        blacklistInput.onchange = async () => {
            host.settings.blacklist = blacklistInput.value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
            host.store.settings = host.settings;
            await host.store.saveSettings();
            showMessage("黑名单已保存", 1500, "info");
        };
        row(card, { icon: "shield", label: "插件黑名单", hint: "逗号分隔；名单内插件不暴露命令。", ctrl: blacklistInput, wide: true });
    };

    // ══════════ 页：队列与数据 ══════════
    const pageQueue = () => {
        content.innerHTML = pageHeader("队列与数据", "队列即 NDJSON 文件，重启不丢；台账滚动裁剪");
        const kpi = document.createElement("div");
        kpi.className = "qg-kpi";
        content.appendChild(kpi);

        const stat = async () => {
            let bytes = 0;
            try {
                const base = host.settings.bridgeBasePath;
                for (const f of ["commands.ndjson", "results.ndjson"]) {
                    const text = (await host.kernelApi.getFileText(`${base}/${f}`)) ?? "";
                    bytes += new TextEncoder().encode(text).length;
                }
            } catch { /* 读取失败保留 0 并在下方面板给原因 */ }
            let pending = 0;
            let oldestMin: number | null = null; // 最老待处理年龄（分钟；L605 部分：超 TTL 可见）
            try {
                const text = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/commands.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
                pending = lines.length;
                const now = Date.now();
                for (const l of lines) {
                    try {
                        const c = JSON.parse(l) as { createdAt?: string };
                        const t = c.createdAt ? Date.parse(c.createdAt) : NaN;
                        if (Number.isFinite(t)) {
                            const age = (now - t) / 60000;
                            if (oldestMin === null || age > oldestMin) oldestMin = age;
                        }
                    } catch { /* 坏行跳过 */ }
                }
            } catch { /* 同上 */ }
            return { pending, bytes, oldestMin };
        };
        void stat().then(({ pending, bytes, oldestMin }) => {
            // L605 部分：待处理超 60s TTL（信封缺省窗口）即示警——积压可灰可见，不再只是数字
            const oldestOverTtl = pending > 0 && oldestMin !== null && oldestMin >= 1;
            // L605 再部分：处理台账容量可见化（上限 500，≥80% 预警）
            const ledgerCount = Object.keys(host.store.processed.processed).length;
            const ledgerRatio = ledgerCount / PROCESSED_CAP;
            const oldestCell = pending === 0
                ? { v: "–", l: "最老待处理", warn: false }
                : {
                    v: oldestMin === null ? "–" : oldestMin >= 60 ? `${Math.round(oldestMin / 60)}时` : `${Math.max(1, Math.round(oldestMin))}分`,
                    l: oldestOverTtl ? "最老待处理（超 TTL）" : "最老待处理",
                    warn: oldestOverTtl,
                };
            const warnStyle = ' style="border-color:color-mix(in srgb, var(--b3-theme-warning, var(--b3-theme-secondary)) 45%, transparent)"';
            const warnNum = ' style="color:var(--b3-theme-warning, var(--b3-theme-secondary))"';
            kpi.innerHTML = [
                { v: pending, l: "待处理命令", warn: false },
                oldestCell,
                { v: ledgerCount, l: `处理台账 / ${PROCESSED_CAP}`, warn: ledgerRatio >= 0.8 },
                { v: host.activeService?.lateCompletions ?? 0, l: "迟到完成", warn: false },
                { v: `${(bytes / 1024).toFixed(1)}K`, l: "载体占用", warn: false },
            ].map((k) => `<div class="kv"${k.warn ? warnStyle : ""}><b${k.warn ? warnNum : ""}>${kpiValue(k.v)}</b><span>${esc(k.l)}</span></div>`).join("");
        });

        const tableCard = document.createElement("div");
        tableCard.className = "qg-card";
        tableCard.style.padding = "0 14px 6px";
        tableCard.innerHTML = `<div class="qg-card-title" style="padding:10px 0 6px">最近回执<span style="margin-left:auto;display:flex;gap:6px"></span></div><div data-role="list" style="min-height:28px"></div>`;
        const btns = tableCard.querySelector(".qg-card-title span") as HTMLElement;
        const rcBtn = document.createElement("button");
        rcBtn.className = "b3-button b3-button--outline b3-button--small";
        rcBtn.textContent = "结果中心";
        rcBtn.onclick = () => { dialog.destroy(); host.openResultsCenter(); };
        const auditBtn = document.createElement("button");
        auditBtn.className = "b3-button b3-button--outline b3-button--small";
        auditBtn.textContent = "审计（筛选/复制）";
        auditBtn.onclick = () => showAuditDialog();
        const favBtn = document.createElement("button");
        favBtn.className = "b3-button b3-button--outline b3-button--small";
        favBtn.textContent = "收藏与最近使用";
        favBtn.onclick = () => showFavoritesDialog();
        const exportBtn = document.createElement("button");
        exportBtn.className = "b3-button b3-button--outline b3-button--small";
        exportBtn.textContent = "导出审计 JSON";
        exportBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), entries: host.auditLog }, null, 2));
                showMessage(`已复制 ${host.auditLog.length} 条审计到剪贴板`, 4000, "info");
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        btns.append(rcBtn, auditBtn, favBtn, exportBtn);
        content.appendChild(tableCard);

        // 最近回执 20 条（含逐条复制）
        const list = tableCard.querySelector("[data-role=list]") as HTMLElement;
        void (async () => {
            try {
                const text = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/results.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").slice(-20) : [];
                list.innerHTML = lines.length === 0
                    ? `<div style="font-size:11px;color:var(--b3-theme-on-surface);padding:6px 0 8px">暂无回执——桥开启后外部命令的回执会出现在这里。</div>`
                    : `<table class="qg-receipts"><thead><tr><th>状态</th><th>op</th><th>时间</th><th>耗时</th><th></th></tr></thead><tbody>${lines.map((l, i) => {
                        let cell = `<td class="qg-mono" colspan="4">${esc(l.slice(0, 120))}</td>`;
                        try {
                            const r = JSON.parse(l) as { status?: string; op?: string; finishedAt?: string; elapsedMs?: number };
                            const kind = receiptKind(r.status);
                            cell = `<td><span class="qg-chip ${kind}">${esc(r.status ?? "?")}</span></td><td class="qg-mono">${esc(r.op ?? "?")}</td><td class="qg-dim qg-num">${esc(fmtReceiptTime(r.finishedAt ?? ""))}</td><td class="qg-dim qg-num">${esc(fmtElapsedMs(Number(r.elapsedMs)))}</td>`;
                        } catch { /* 坏行原样截断展示 */ }
                        return `<tr>${cell}<td style="width:52px"><button class="b3-button b3-button--small qg-copy-btn" data-qg-copy="${i}">复制</button></td></tr>`;
                    }).join("")}</tbody></table>`;
                list.onclick = (ev) => {
                    const btn = (ev.target as HTMLElement).closest("[data-qg-copy]") as HTMLElement | null;
                    if (!btn) return;
                    const line = lines[Number(btn.dataset.qgCopy)];
                    if (!line) return;
                    void navigator.clipboard.writeText(line).then(() => showMessage("已复制回执行（JSON）", 2000, "info"));
                };
            } catch (e) {
                list.innerHTML = `<div style="font-size:11px;color:var(--b3-theme-error);padding:6px 0 8px">回执读取失败：${esc(e instanceof Error ? e.message : String(e))}</div>`;
            }
        })();

        // 危险区：清空队列（保留预览纪律；动作复用共享 clearQueueWithPreview）
        const danger = document.createElement("div");
        danger.className = "qg-card danger";
        danger.innerHTML = `<div style="font-size:12px;color:var(--b3-theme-on-surface)"><b style="color:var(--b3-theme-error)">危险区</b>　清空前将预览：将丢弃条数、最老命令时间，并清空回执与处理台账（不可撤销）。</div>`;
        const clearBtn = document.createElement("button");
        clearBtn.className = "b3-button qg-btn-danger";
        clearBtn.style.marginLeft = "auto"; // 危险区 flex：按钮靠右（原型 .sp 布局）
        clearBtn.textContent = "清空命令队列";
        clearBtn.onclick = () => void clearQueueWithPreview(() => show("queue"));
        danger.appendChild(clearBtn);
        // ══════════ 全量备份/恢复（R9-A · R322）：四载体+台账拼装单 JSON ══════════
        const backupCard = document.createElement("div");
        backupCard.className = "qg-card";
        backupCard.innerHTML = `<div class="qg-card-title">全量备份 / 恢复</div>` +
            `<div style="font-size:11px;color:var(--b3-theme-on-surface);margin-bottom:8px">` +
            `导出=设置+收藏+审计+回执+处理台账拼装单 JSON（含 schemaVersion，导入走校验链）。` +
            `导入=覆盖当前数据（确认后执行，桥自动重启生效）。</div>`;
        const backupBtns = document.createElement("div");
        backupBtns.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
        const backupExportBtn = document.createElement("button");
        backupExportBtn.className = "b3-button qg-btn-primary";
        backupExportBtn.dataset.role = "qg-backup-export"; // e2e roundtrip 选择子
        backupExportBtn.textContent = "导出全量备份";
        backupExportBtn.onclick = () => withPending(backupExportBtn, "导出中…", async () => {
            try {
                await downloadFullBackup();
                showMessage("全量备份已下载", 3000);
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        });
        const importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = ".json,application/json";
        importInput.style.display = "none";
        importInput.onchange = async () => {
            const file = importInput.files?.[0];
            if (!file) return;
            try {
                const parsed = parseBackupPayload(await file.text());
                // in 收窄（strict:false 下布尔判别收窄不可靠，R314 实测）
                if ("error" in parsed) { showMessage(`备份导入失败：${parsed.error}`, 6000, "error"); return; }
                const payload = parsed.payload;
                // 各段走 normalize* 校验链：settings/processed 由 store 承接，favorites/audit 落回载体
                const s = normalizeSettings(payload.settings);
                const fav = normalizeFavorites(payload.favorites);
                const processed = normalizeProcessed(payload.processed);
                confirm(
                    "小驴快门 · 导入全量备份",
                    `备份时间：${payload.exportedAt}\n将覆盖当前 设置/收藏/审计/回执/处理台账（桥会自动重启生效）。确认导入？`,
                    async () => {
                        try {
                            const base = host.settings.bridgeBasePath;
                            host.store.processed = processed;
                            host.settings = s;
                            host.store.settings = s;
                            await host.store.saveProcessed();
                            await host.store.saveSettings();
                            await host.kernelApi.putFileText("/storage/petal/siyuan-quickgate/favorites.json", JSON.stringify(fav, null, 2));
                            await host.kernelApi.putFileText(`${base}/results.ndjson`, payload.resultsNdjson);
                            await host.stopBridge();
                            if (host.settings.bridgeEnabled && !host.isMobileGuard()) {
                                await host.startBridge();
                                host.startEventBridge();
                            }
                            showMessage("全量备份已导入（桥已重启生效）", 3500);
                            dialog.destroy();
                            host.openSettingPanel("queue");
                        } catch (e) {
                            showMessage(`导入失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
                        }
                    },
                    () => { },
                );
            } catch (e) {
                showMessage(`读取备份失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        const importLabel = document.createElement("button");
        importLabel.className = "b3-button b3-button--outline";
        importLabel.textContent = "导入备份";
        importLabel.onclick = () => importInput.click();
        backupBtns.append(backupExportBtn, importLabel, importInput);
        backupCard.appendChild(backupBtns);
        content.appendChild(backupCard);
        content.appendChild(danger);
    };

    // ══════════ 页：诊断与生态 ══════════
    const pageDiagnostics = () => {
        content.innerHTML = pageHeader("诊断与生态", "探测 → 解释 → 修复 → 复测");
        const diagCard = document.createElement("div");
        diagCard.className = "qg-card";
        diagCard.innerHTML = `<div class="qg-card-title">诊断包</div><div style="font-size:12px;color:var(--b3-theme-on-surface)">复制到剪贴板；脱敏——不含 Token / 正文 / 个人路径。</div>`;
        const diagBtn = document.createElement("button");
        diagBtn.className = "b3-button b3-button--outline";
        diagBtn.style.marginTop = "8px";
        diagBtn.textContent = "导出诊断包（到剪贴板）";
        diagBtn.onclick = () => withPending(diagBtn, "组装中…", async () => {
            try {
                // L593 部分：复制前先展示脱敏预览（用户可见将复制的内容），确认后才写入剪贴板
                const diagJson = await buildDiagJson();
                const preview = new Dialog({
                    title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>诊断包预览（脱敏）</span></span>`,
                    content: `<div style="padding:12px 14px">` +
                        `<div style="font-size:11px;color:var(--b3-theme-on-surface);margin-bottom:8px;line-height:1.6">不含 Token / 正文 / 个人路径；含设置、统计、审计尾部 50 条。确认后将写入剪贴板（请勿粘贴到公开场合前二次检查）。</div>` +
                        `<pre style="max-height:300px;overflow:auto;font-size:11px;line-height:1.5;margin:0;padding:8px 10px;border:1px solid var(--b3-border-color);border-radius:6px;background:var(--b3-theme-surface);white-space:pre-wrap;word-break:break-all">${esc(diagJson)}</pre>` +
                        `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">` +
                        `<button class="b3-button" data-qg-diag-cancel>取消</button>` +
                        `<button class="b3-button b3-button--primary" data-qg-diag-copy>确认复制</button></div></div>`,
                    width: "min(640px, 92vw)",
                    height: "auto",
                });
                preview.element.querySelector("[data-qg-diag-copy]")?.addEventListener("click", () => {
                    void navigator.clipboard.writeText(diagJson).then(() => {
                        showMessage("诊断包已复制到剪贴板（脱敏）", 3000);
                        preview.destroy();
                    });
                });
                preview.element.querySelector("[data-qg-diag-cancel]")?.addEventListener("click", () => preview.destroy());
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        });
        diagCard.appendChild(diagBtn);
        content.appendChild(diagCard);

        // 环境预检（L561 部分）：SiYuan 版本 / 前端形态 / 桥目录可写性三档核对（外部客户端项如实标注"无法在此检查"）
        const preflightCard = document.createElement("div");
        preflightCard.className = "qg-card";
        preflightCard.innerHTML = `<div class="qg-card-title">环境预检</div>` +
            `<div class="qg-hint" style="font-size:12px">安装/启用前的环境核对，结果分三档：✓ 可继续 / ⚠ 需注意 / ✕ 阻塞。</div>` +
            `<div data-role="preflight-result" style="margin-top:8px"></div>`;
        const preBtn = document.createElement("button");
        preBtn.className = "b3-button b3-button--outline";
        preBtn.style.marginTop = "8px";
        preBtn.textContent = "运行环境预检";
        preBtn.onclick = () => withPending(preBtn, "预检中…", async () => {
            const box = preflightCard.querySelector("[data-role=preflight-result]") as HTMLElement;
            const MIN_APP = [3, 8, 0]; // 与 plugin.json minAppVersion 同源（集市门槛前手填，改版需同步）
            const checks: Array<{ dot: "ok" | "warn" | "err"; text: string }> = [];
            // ① SiYuan 版本 ≥ minAppVersion
            try {
                const v = await host.kernelApi.post<string>("/api/system/version", {});
                const nums = String(v).split(".").map((n) => parseInt(n, 10));
                const cmp = [0, 1, 2].map((i) => (Number.isFinite(nums[i]) ? nums[i] : 0));
                const ge = cmp[0] > MIN_APP[0] || (cmp[0] === MIN_APP[0] && (cmp[1] > MIN_APP[1] || (cmp[1] === MIN_APP[1] && cmp[2] >= MIN_APP[2])));
                checks.push(ge
                    ? { dot: "ok", text: `SiYuan v${v} ≥ 最低要求 v${MIN_APP.join(".")}` }
                    : { dot: "err", text: `SiYuan v${v} 低于最低要求 v${MIN_APP.join(".")}——请先升级思源` });
            } catch (e) {
                checks.push({ dot: "err", text: `SiYuan 版本探测失败：${e instanceof Error ? e.message : String(e)}——内核不可达？` });
            }
            // ② 前端形态
            const fe = getFrontend();
            checks.push(fe === "desktop" || fe === "desktop-window" || fe === "browser-desktop"
                ? { dot: "ok", text: `前端形态：${fe}（桥全功能可用）` }
                : { dot: "warn", text: `前端形态：${fe}——移动端桥默认关闭（需在「连接与通道」显式开启）` });
            // ③ 桥目录可写性（专用探针文件，写入成功即通过；内容可留作痕迹，不破坏任何载体）
            try {
                await host.kernelApi.putFileText("/storage/petal/siyuan-quickgate/preflight-probe.json", JSON.stringify({ probe: true, at: new Date().toISOString() }));
                checks.push({ dot: "ok", text: "桥目录可写（/storage/petal/siyuan-quickgate/）" });
            } catch (e) {
                checks.push({ dot: "err", text: `桥目录不可写：${e instanceof Error ? e.message : String(e)}——外部命令桥无法落载体` });
            }
            // ④ 外部客户端项：如实标注不可在此检查
            checks.push({ dot: "warn", text: "Quicker / CLI 客户端版本与 Token 配置无法在本面板检查——见 GETTING-STARTED 安装页" });
            const blocked = checks.some((c) => c.dot === "err");
            const warned = checks.some((c) => c.dot === "warn");
            const summary = blocked ? `<div style="font-size:12px;font-weight:600;color:var(--b3-theme-error);margin-bottom:4px">✕ 存在阻塞项——按上述条目处理后重跑</div>`
                : warned ? `<div style="font-size:12px;font-weight:600;color:var(--b3-theme-warning, var(--b3-theme-secondary));margin-bottom:4px">⚠ 可继续，存在需注意项</div>`
                    : `<div style="font-size:12px;font-weight:600;color:var(--b3-theme-success);margin-bottom:4px">✓ 全部通过，可继续</div>`;
            box.innerHTML = summary + checks.map((c) => `<div style="display:flex;gap:7px;align-items:flex-start;font-size:12px;padding:2px 0">${dot(c.dot)}<span>${esc(c.text)}</span></div>`).join("");
        });
        preflightCard.appendChild(preBtn);
        content.appendChild(preflightCard);

        const ecoCard = document.createElement("div");
        ecoCard.className = "qg-card";
        ecoCard.innerHTML = `<div class="qg-card-title">小驴生态能力目录</div><div style="font-size:12px;color:var(--b3-theme-on-surface)">状态 / 版本对照 / 缺失原因 / 入口，逐插件卡片。</div>`;
        const ecoBtn = document.createElement("button");
        ecoBtn.className = "b3-button b3-button--outline";
        ecoBtn.style.marginTop = "8px";
        ecoBtn.textContent = "查看能力目录";
        ecoBtn.onclick = () => showEcoDialog();
        ecoCard.appendChild(ecoBtn);
        content.appendChild(ecoCard);
    };

    // ══════════ 页：关于 ══════════
    const pageAbout = () => {
        content.innerHTML = pageHeader("关于", "版本、数据边界与帮助入口（页脚常驻链接同此）") +
            `<div class="qg-card"><div class="qg-card-title">小驴快门 v${PLUGIN_VERSION} <span style="margin-left:auto">${chip("协议 v1", "mute")}</span></div>` +
            `<div style="font-size:12px;color:var(--b3-theme-on-surface);line-height:1.7">小驴生态联动中枢 + 外部网关：命令注册表、数据透传、编辑器上下文与 NDJSON 外部命令桥。` +
            `数据流向与隐私边界见 PRIVACY.md（本插件不外传任何数据）。</div></div>`;
        const danger = document.createElement("div");
        danger.className = "qg-card danger";
        danger.innerHTML = `<div style="font-size:12px;color:var(--b3-theme-on-surface)"><b style="color:var(--b3-theme-error)">恢复默认设置</b>　桥/广播关闭、轮询 500ms、名单还原、确认门控开启；设备名保留（本机身份不变）。当前自定义值不可找回。</div>`;
        const resetBtn = document.createElement("button");
        resetBtn.className = "b3-button qg-btn-danger";
        resetBtn.style.marginLeft = "auto";
        resetBtn.textContent = "恢复默认设置";
        resetBtn.onclick = () => {
            // L503：全局恢复默认（保留 deviceName——device 路由身份属自动管理字段）
            // L624 部分：确认后先自动下载全量备份（防线），导出失败即中止重置
            confirm(
                "小驴快门 · 恢复默认设置",
                "将恢复全部设置为出厂默认：桥/广播关闭、轮询 500ms、黑名单与允许名单还原、确认门控开启；桥若在运行会停止。设备名保留（本机身份不变）。当前自定义值不可找回。\n\n确认后将先自动下载一份全量备份（设置+收藏+审计+回执+台账）作为防线。",
                async () => {
                    try {
                        await downloadFullBackup();
                        showMessage("防线索份已下载，正在恢复默认设置…", 2500, "info");
                    } catch (e) {
                        showMessage(`重置前自动备份失败，已中止重置：${e instanceof Error ? e.message : String(e)}（可到「队列与数据」手动「导出全量备份」后重试）`, 6000, "error");
                        return;
                    }
                    // L624 部分：快照重置前设置——状态概览页提供本会话内撤销
                    preResetSnapshot = JSON.parse(JSON.stringify(host.settings)) as QuickGateSettings;
                    const deviceName = host.settings.deviceName;
                    host.settings = { ...DEFAULT_SETTINGS, deviceName };
                    host.store.settings = host.settings;
                    await host.store.saveSettings();
                    await host.stopBridge();
                    host.stopEventBridge();
                    if (host.broadcastSub?.running) await host.broadcastSub.stop();
                    dialog.destroy();
                    host.openSettingPanel(); // 重开面板反映默认值
                    showMessage("已恢复默认设置（设备名保留；可在状态概览页撤销）", 3000);
                },
                () => { },
            );
        };
        danger.appendChild(resetBtn);
        content.appendChild(danger);

    };

    // ══════════ 子对话框：桥恢复向导（L571 部分：检测 → 分级呈现 → 复用既有处置动作） ══════════
    const showBridgeRecoveryWizard = () => {
        const dlg = new Dialog({
            title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>桥恢复向导</span></span>`,
            content: `<div id="qg-bridge-recovery" style="padding:14px 16px;min-width:min(560px, 92vw)">` +
                `<div class="qg-dlg-head"><span class="qg-dlg-title"><span class="qg-title-logo">门</span>桥恢复向导</span>` +
                `<span style="font-size:11px;color:var(--b3-theme-on-surface-light)">桥出问题了？逐项检测、按级处置</span>` +
                `<span class="sp"></span><button class="b3-button b3-button--small" data-role="refresh">重新检测</button></div>` +
                `<div data-role="body" role="region" aria-label="检测结果"><div class="qg-skel"><span></span><span></span><span></span></div></div>` +
                `<div style="margin-top:10px;font-size:11px;color:var(--b3-theme-on-surface)">所有清理类动作均带预览确认；检测只读，不改动任何数据。</div></div>`,
            width: "min(640px, 92vw)",
            height: "auto",
            // 焦点回归（L585 部分）
            destroyCallback: () => { try { (document.activeElement as HTMLElement)?.blur?.(); } catch { /* 不阻断 */ } },
        });
        const body = dlg.element.querySelector("[data-role=body]") as HTMLElement;
        installFocusTrap(dlg.element);
        dlg.element.querySelector('[data-role="refresh"]')?.addEventListener("click", () => void refresh());

        type Item = { dot: "ok" | "warn" | "err" | "off"; text: string; action?: { label: string; run: () => void | Promise<void> } };

        const refresh = async () => {
            body.innerHTML = `<div class="qg-skel"><span></span><span></span><span></span></div>`;
            const items: Item[] = [];
            // ① 桥开关
            if (!host.settings.bridgeEnabled) {
                items.push({ dot: "warn", text: "外部命令桥：未开启——Quicker / CLI / 手机快捷指令将无法发命令", action: { label: "去开启", run: () => show("connection") } });
            } else {
                items.push({ dot: "ok", text: "外部命令桥：已开启" });
            }
            // ② 本窗口轮询
            if (host.poller?.isRunning) {
                items.push({ dot: "ok", text: `本窗口轮询运行中（间隔 ${host.settings.pollMs}ms）` });
            } else if (host.settings.bridgeEnabled) {
                items.push({
                    dot: "err", text: "桥已开启但本窗口轮询未运行——多为消费权被另一窗口持有或启动失败",
                    action: {
                        label: "重启桥", run: async () => {
                            await host.stopBridge();
                            const started = await host.startBridge();
                            showMessage(started ? "桥已重启" : "重启未启动：消费权可能仍被另一窗口持有", 3500, started ? "info" : "error");
                        },
                    },
                });
            }
            // ③ 退避
            const backoff = host.poller && host.poller.consecutiveFailures > 0 ? host.poller.consecutiveFailures : 0;
            if (backoff > 0) {
                items.push({
                    dot: "err", text: `轮询连续失败 ${backoff} 次（指数退避中）——多为内核不可达或存储不可写`,
                    action: {
                        label: "导出诊断包", run: async () => {
                            await navigator.clipboard.writeText(await buildDiagJson());
                            showMessage("诊断包已复制到剪贴板（脱敏）", 2500);
                        },
                    },
                });
            }
            // ④ 命令队列（积压 / 坏行 / 最老）
            try {
                const text = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/commands.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
                let bad = 0;
                let oldest = "";
                for (const l of lines) {
                    try {
                        const c = JSON.parse(l) as { createdAt?: string };
                        if (typeof c.createdAt === "string" && (!oldest || c.createdAt < oldest)) oldest = c.createdAt;
                    } catch { bad++; }
                }
                if (lines.length === 0) items.push({ dot: "ok", text: "命令队列：空（无积压）" });
                else {
                    items.push({
                        dot: bad > 0 ? "err" : "warn",
                        text: `命令队列积压 ${lines.length} 条${oldest ? `（最早 ${fmtLocalStamp(oldest)}）` : ""}${bad ? `，坏行 ${bad} 条（多为主机断电/磁盘满所致）` : ""}`,
                        action: { label: "清空队列", run: () => void clearQueueWithPreview(() => void refresh()) },
                    });
                }
            } catch {
                items.push({
                    dot: "err", text: "命令队列读取失败——载体不可达",
                    action: {
                        label: "导出诊断包", run: async () => {
                            await navigator.clipboard.writeText(await buildDiagJson());
                            showMessage("诊断包已复制到剪贴板（脱敏）", 2500);
                        },
                    },
                });
            }
            // ⑤ 广播（可选通道）
            items.push(host.broadcastSub?.running
                ? { dot: "ok", text: "广播快路径运行中（可选通道）" }
                : { dot: "off", text: "广播快路径未运行（可选通道，不影响 NDJSON 桥）" });
            // ⑥ 内核路由
            items.push(host.kernelRouteProbe === undefined
                ? { dot: "warn", text: "内核同步路由：探测中" }
                : host.kernelRouteProbe
                    ? { dot: "ok", text: "内核同步路由可用（桥关闭时 7 只读 op 仍可用）" }
                    : { dot: "warn", text: "内核同步路由不可达（不影响 NDJSON 桥；内核升级/重启后自愈）" });

            const hasErr = items.some((i) => i.dot === "err");
            const hasWarn = items.some((i) => i.dot === "warn");
            const summary = hasErr
                ? { cls: "err", text: "✕ 检测到阻塞项——按行内动作逐项处置后「重新检测」" }
                : hasWarn
                    ? { cls: "warn", text: "⚠ 可继续，存在需注意项" }
                    : { cls: "ok", text: "✓ 全部正常，无需恢复动作" };
            const summaryColor = `color:var(--b3-theme-${summary.cls === "err" ? "error" : summary.cls === "warn" ? "warning, var(--b3-theme-secondary)" : "success"})`;
            body.innerHTML = `<div style="font-size:12px;font-weight:600;${summaryColor};margin-bottom:6px">${esc(summary.text)}</div>` +
                items.map((it) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 2px;border-bottom:1px solid var(--b3-border-color)">` +
                    `${dot(it.dot)}<span style="flex:1;min-width:0;font-size:12px;line-height:1.6">${esc(it.text)}</span>` +
                    (it.action ? `<button class="b3-button b3-button--small" data-role="wiz-action">${esc(it.action.label)}</button>` : "") +
                    `</div>`).join("");
            // 接线动作（每行最后一个按钮）
            const actionButtons = Array.from(body.querySelectorAll<HTMLButtonElement>('[data-role="wiz-action"]'));
            const actions = items.map((i) => i.action);
            actionButtons.forEach((btn, i) => {
                const run = actions[i]?.run;
                if (!run) return;
                btn.addEventListener("click", () => void Promise.resolve(run()).then(() => void refresh()));
            });
        };
        void refresh();
    };

    // ══════════ 子对话框：审计（筛选/日期/逐条复制/加载更多 · L514+R313） ══════════
    const showAuditDialog = () => {
        const state = { kw: "", date: "", shown: 20 };
        const view = () => {
            const hits = host.auditLog.filter((a) => {
                if (state.date && !a.time.startsWith(state.date)) return false;
                if (state.kw && !`${a.plugin}/${a.command} ${a.status}`.toLowerCase().includes(state.kw)) return false;
                return true;
            });
            return { hits, shown: hits.slice(-state.shown) }; // 新→旧窗口尾部
        };
        const render = () => {
            const { hits, shown } = view();
            const rows = shown.map((a) => {
                const idx = host.auditLog.indexOf(a);
                return `<div class="qg-audit-row">` +
                    `<span class="qg-dim qg-num">${esc(fmtLocalStamp(a.time))}</span>` +
                    `<span class="qg-mono qg-audit-cmd">${esc(a.plugin)}/${esc(a.command)}</span>` +
                    `<span class="qg-chip ${receiptKind(a.status)}">${esc(a.status)}</span>` +
                    `<span class="qg-dim qg-num qg-audit-ms">${esc(fmtElapsedMs(a.elapsedMs))}</span>` +
                    `<button class="b3-button b3-button--small qg-copy-btn" data-qg-copy="${idx}">复制</button></div>`;
            }).join("") || `<div class="qg-empty">无匹配条目——调整关键词或日期；入门见 <a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md">上手指南</a>。</div>`;
            return `<div style="display:flex;gap:6px;margin-bottom:8px">` +
                `<input id="qg-audit-filter" class="b3-text-field" style="flex:1" placeholder="筛选：op / 状态 / 插件" value="${esc(state.kw)}" />` +
                `<input id="qg-audit-date" type="date" class="b3-text-field" style="width:150px" value="${state.date}" title="按日期筛选" />` +
                `<button id="qg-audit-export" class="b3-button b3-button--small" title="导出当前筛选命中（JSON）">导出筛选</button>` +
                `</div><div class="qg-audit-list">${rows}</div>` +
                `<div style="margin-top:8px;display:flex;gap:8px;align-items:center">` +
                `<span style="color:var(--b3-theme-on-surface)">命中 ${hits.length} 条（显示 ${shown.length}）</span>` +
                (hits.length > shown.length ? `<button class="b3-button b3-button--small" data-more="1">加载更多（+20）</button>` : "") +
                `</div>`;
        };
        // 焦点回归（L585 部分）：销毁后焦点回到触发元素
        const auditFocusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const d = new Dialog({
            title: "审计日志",
            content: `<div style="padding:12px"><div id="qg-audit-body">${render()}</div></div>`,
            width: "min(640px, 92vw)",
            destroyCallback: () => { try { auditFocusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
        });
        d.element.addEventListener("input", (ev) => {
            const target = ev.target as HTMLInputElement;
            if (target.id === "qg-audit-filter") state.kw = target.value.trim().toLowerCase();
            else if (target.id === "qg-audit-date") state.date = target.value;
            else return;
            const body = d.element.querySelector("#qg-audit-body");
            if (body) body.innerHTML = render();
            const again = d.element.querySelector(`#${target.id}`) as HTMLInputElement | null;
            if (again) { again.focus(); if (target.id === "qg-audit-filter") again.setSelectionRange(again.value.length, again.value.length); }
        });
        d.element.addEventListener("click", (ev) => {
            if ((ev.target as HTMLElement).id === "qg-audit-export") {
                const { hits } = view();
                if (hits.length === 0) { showMessage("当前筛选无命中可导出", 2500, "info"); return; }
                void navigator.clipboard.writeText(JSON.stringify({ exportedAt: new Date().toISOString(), count: hits.length, entries: hits }, null, 2)).then(() => {
                    showMessage(`已复制 ${hits.length} 条筛选命中到剪贴板（JSON）`, 3000, "info");
                });
                return;
            }
            const more = (ev.target as HTMLElement).closest("[data-more]") as HTMLElement | null;
            if (more) { state.shown += 20; const body = d.element.querySelector("#qg-audit-body"); if (body) body.innerHTML = render(); }
            const btn = (ev.target as HTMLElement).closest("[data-qg-copy]") as HTMLElement | null;
            if (!btn) return;
            const entry = host.auditLog[Number(btn.dataset.qgCopy)];
            if (!entry) return;
            void navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => showMessage("已复制单条审计（JSON，脱敏字段本就不含参数值）", 2500, "info"));
        });
    };

    // ══════════ 子对话框：收藏与最近使用（L472 消费面 · R250） ══════════
    const showFavoritesDialog = () => {
        const favPath = `/storage/petal/${PLUGIN_NAME}/favorites.json`;
        const load = async () => {
            try {
                const raw = await host.kernelApi.getFileText(favPath);
                return normalizeFavorites(raw ? JSON.parse(raw) : null);
            } catch { return normalizeFavorites(null); }
        };
        const save = async (s: FavoritesStore) => {
            await host.kernelApi.putFileText(favPath, JSON.stringify({ schemaVersion: 1, favorites: s.favorites, recent: s.recent }, null, 2));
        };
        const render = (s: FavoritesStore) => {
            const favRow = (f: { plugin: string; command: string; title: string }, i: number) =>
                `<div class="qg-fav-row"><span class="qg-fav-star">★</span>` +
                `<div class="qg-fav-main"><div class="qg-fav-title">${esc(f.title || `${f.plugin}/${f.command}`)}</div>` +
                `<div class="qg-mono qg-fav-id">${esc(f.plugin)}/${esc(f.command)}</div></div>` +
                `<button class="b3-button b3-button--small qg-copy-btn" data-qg-fav-del="${i}">移除</button></div>`;
            const recRow = (r: { plugin: string; command: string; title: string; at: string }, i: number) =>
                `<div class="qg-fav-row"><span class="qg-fav-star dim">↺</span>` +
                `<div class="qg-fav-main"><div class="qg-fav-title">${esc(r.title || `${r.plugin}/${r.command}`)}</div>` +
                `<div class="qg-mono qg-fav-id">${esc(r.plugin)}/${esc(r.command)} · ${esc(fmtLocalStamp(r.at, false))}</div></div>` +
                `<button class="b3-button b3-button--small qg-copy-btn" data-qg-rec-del="${i}">移除</button></div>`;
            return `<div class="qg-page-title" style="margin:2px 0 6px">收藏（${s.favorites.length}）</div>` +
                (s.favorites.map(favRow).join("") || `<div class="qg-empty">暂无收藏——面板条目右侧 ☆ 或 CLI/MCP 经 favorites.add 添加；命令用法见 <a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md">上手指南</a>。</div>`) +
                `<div class="qg-page-title" style="margin:12px 0 6px">最近使用（${s.recent.length}）</div>` +
                (s.recent.map(recRow).join("") || `<div class="qg-empty">暂无最近使用。</div>`) +
                `<div style="margin-top:12px"><button class="b3-button b3-button--small qg-btn-danger" data-qg-rec-clear ${s.recent.length === 0 ? "disabled" : ""}>清空全部最近使用</button></div>`;
        };
        // 焦点回归（L585 部分）：销毁后焦点回到触发元素
        const favFocusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const d = new Dialog({
            title: "收藏与最近使用",
            content: `<div style="padding:12px;font-size:12px"><div id="qg-fav-body"></div></div>`,
            width: "min(640px, 92vw)",
            destroyCallback: () => { try { favFocusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
        });
        const refresh = async () => {
            const body = d.element.querySelector("#qg-fav-body");
            if (body) body.innerHTML = render(await load());
        };
        void refresh();
        d.element.addEventListener("click", async (ev) => {
            const t = ev.target as HTMLElement;
            const delFav = t.closest("[data-qg-fav-del]") as HTMLElement | null;
            const delRec = t.closest("[data-qg-rec-del]") as HTMLElement | null;
            const clr = t.closest("[data-qg-rec-clear]") as HTMLElement | null;
            if (!delFav && !delRec && !clr) return;
            const s = await load();
            if (delFav) s.favorites.splice(Number(delFav.dataset.qgFavDel), 1);
            else if (delRec) s.recent.splice(Number(delRec.dataset.qgRecDel), 1);
            else if (clr) s.recent = [];
            await save(s);
            await refresh();
        });
    };

    // ══════════ 子对话框：生态能力目录（L471） ══════════
    const showEcoDialog = () => {
        void (async () => {
            try {
                const manifest = manifestJson as EcosystemManifest;
                let installed: Array<Record<string, unknown>> = [];
                try {
                    installed = await host.kernelApi.post<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: getFrontend() });
                } catch { /* 内核不可达 → 只展示 manifest 口径 */ }
                const instMap = new Map(installed.map((p) => [String(p.name), p]));
                const cards = manifest.plugins.map((m) => {
                    const inst = instMap.get(m.pluginId) as { version?: unknown; enabled?: unknown } | undefined;
                    const iv = typeof inst?.version === "string" ? inst.version : null;
                    const enabled = inst ? inst.enabled !== false : false;
                    const stale = iv !== null && m.version !== null && iv !== m.version;
                    let status: string;
                    let reason = "";
                    if (iv === null) {
                        status = `<span style="color:var(--b3-theme-on-surface)">● 未安装</span>`;
                        reason = m.maturity === "stable" ? "缺失原因：未安装（集市暂缓，<a class=\"b3-link\" target=\"_blank\" href=\"https://github.com/ai68298100/siyuan-quickgate/releases\">GitHub Releases</a> 获取上游；或用本页诊断核对环境）" : "";
                    } else if (stale) {
                        status = `<span style="color:var(--b3-theme-warning, #d97706)">● 版本漂移</span>`;
                        reason = `缺失原因：实装 ${esc(iv)} ≠ 清单基准 ${esc(m.version)}（能力面可能变化，可校准清单）`;
                    } else if (!enabled) {
                        status = `<span style="color:var(--b3-theme-warning, #d97706)">● 已停用</span>`;
                        reason = "缺失原因：插件在思源插件列表中已停用";
                    } else {
                        status = `<span style="color:var(--b3-theme-primary)">● 已安装启用</span>`;
                    }
                    const maturityBadge = m.maturity === "stable" ? "stable" : m.maturity === "design" ? "design" : "unlocated";
                    const caps = m.capabilities.length > 0 ? `能力 ${m.capabilities.length} 项（读写属性经 adapter 能力协商）` : "能力 0 项";
                    // L554 部分：stable 插件给仓库入口（design 态插件未公开仓库，不显示链接——诚实边界）
                    const repoLink = m.maturity === "stable"
                        ? ` · <a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/${esc(m.pluginId)}">仓库</a>` +
                          `<a class="b3-link" target="_blank" rel="noopener" href="https://github.com/ai68298100/${esc(m.pluginId)}/releases">Releases</a>`
                        : "";
                    return `<div class="qg-card" style="padding:10px 12px;margin-bottom:8px">` +
                        `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(m.displayName)}</b> <span class="qg-mono" style="color:var(--b3-theme-on-surface)">${esc(m.pluginId)}</span> <span class="qg-chip mute">${esc(maturityBadge)}</span>${repoLink}</div>` +
                        `<div style="margin-top:3px">状态：${status} · <span class="qg-num">清单 ${esc(m.version ?? "-")} / 实装 ${esc(iv ?? "-")}</span></div>` +
                        `<div style="color:var(--b3-theme-on-surface)">${esc(m.protocol ?? "协议未定义")} · ${esc(caps)}</div>` +
                        `<div style="color:var(--b3-theme-on-surface);margin-top:2px">${esc(stripDevNotes(m.hubIntegration))}${reason ? " · " + reason : ""}</div>` +
                        `</div>`;
                }).join("");
                new Dialog({
                    title: `生态能力目录（清单 v${manifest.version} · 校准 ${manifest.updatedAt ?? "未知"}）`,
                    content: `<div style="padding:12px;font-size:12px">${cards}<div style="margin-top:6px;color:var(--b3-theme-on-surface)">诊断入口：设置→诊断与生态「导出诊断包」/ 仓库 tools（verify:bg）</div></div>`,
                    width: "min(640px, 92vw)",
                });
            } catch (e) {
                showMessage(`读取失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        })();
    };

    // ══════════ 导航壳 ══════════
    const pages: Array<{ id: string; label: string; icon: string; dot?: () => DotState | undefined }> = [
        { id: "status", label: host.store.firstRun ? "欢迎 / 首跑" : "状态概览", icon: "home", dot: () => host.poller?.isRunning ? "ok" : "off" },
        { id: "connection", label: "连接与通道", icon: "flow" },
        { id: "security", label: "安全与权限", icon: "shield" },
        { id: "queue", label: "队列与数据", icon: "list" },
        { id: "diagnostics", label: "诊断与生态", icon: "info" },
        { id: "about", label: "关于", icon: "info" },
    ];
    const builders: Record<string, () => void> = {
        status: pageStatus,
        connection: pageConnection,
        security: pageSecurity,
        queue: pageQueue,
        diagnostics: pageDiagnostics,
        about: pageAbout,
    };
    const renderNav = () => {
        nav.innerHTML = "";
        fallback.innerHTML = "";
        for (const p of pages) {
            const dotState = p.dot?.() ?? undefined;
        const b = document.createElement("button");
        b.className = "qg-nav-item" + (p.id === current ? " active" : "");
        b.dataset.page = p.id;
        if (p.id === current) b.setAttribute("aria-current", "page");
        b.innerHTML = `${ICONS[p.icon]}<span>${esc(p.label)}</span>${dotState ? `<span class="qg-nav-dot ${dotState === "ok" ? "" : dotState}"></span>` : ""}`;
            nav.appendChild(b);
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.label;
            if (p.id === current) opt.selected = true;
            fallback.appendChild(opt);
        }
        // 品牌已上移至对话框头部（logo+版本胶囊），导航不再重复
    };
    const show = (page: string) => {
        if (pageTimer) { window.clearInterval(pageTimer); pageTimer = 0; }
        current = page;
        // 首跑向导期间隐藏搜索条（欢迎语境下是噪音；跳过向导进入分组页即恢复）
        root.classList.toggle("qg-firstrun", page === "status" && host.store.firstRun && !host.settings.bridgeEnabled);
        renderNav();
        content.innerHTML = "";
        builders[page]?.();
    };
    nav.addEventListener("click", (ev) => {
        const b = (ev.target as HTMLElement).closest("[data-page]") as HTMLElement | null;
        if (b?.dataset.page) show(b.dataset.page);
    });
    fallback.addEventListener("change", () => show(fallback.value));
    refreshNav = renderNav;

    // ══════════ 设置搜索（G2-04 验收项：跨分组过滤，R297）══════════
    // 做法：顺序构建各分组页 → 从真实 DOM 抽取匹配的 .qg-row（元素迁移保留监听器）→ 分组拼装。
    // 行型分组参与（connection/security/queue/diagnostics）；status/about 为卡片页不参与。
    const searchInput = root.querySelector("[data-role=qg-search]") as HTMLInputElement;
    const rowPages: Array<{ id: string; label: string }> = [
        { id: "connection", label: "连接与通道" },
        { id: "security", label: "安全与权限" },
        { id: "queue", label: "队列与数据" },
        { id: "diagnostics", label: "诊断与生态" },
    ];
    let searchDebounce = 0;
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        // 防抖 150ms（R298 性能）：搜索会顺序重建四个分组页，逐键全量重建是可省的开销
        if (searchDebounce) window.clearTimeout(searchDebounce);
        searchDebounce = window.setTimeout(() => {
        if (!q) { show(current); return; }
        if (pageTimer) { window.clearInterval(pageTimer); pageTimer = 0; }
        renderNav();
        content.innerHTML = "";
        let total = 0;
        const groups: Array<{ id: string; label: string; rows: HTMLElement[] }> = [];
        for (const p of rowPages) {
            content.innerHTML = "";
            builders[p.id]?.();
            const hits = Array.from(content.querySelectorAll<HTMLElement>(".qg-row"))
                .filter((r) => (r.textContent ?? "").toLowerCase().includes(q));
            content.innerHTML = ""; // 每轮迭代尾清空：非命中的整页构建残留不得带入结果
            if (hits.length === 0) continue;
            total += hits.length;
            groups.push({ id: p.id, label: p.label, rows: hits }); // 元素迁移保留事件监听
        }
        content.innerHTML = "";
        content.appendChild(Object.assign(document.createElement("p"), {
            className: "qg-page-title",
            textContent: `搜索「${searchInput.value.trim()}」— ${total} 项`,
        }));
        if (total === 0) {
            content.appendChild(Object.assign(document.createElement("div"), {
                className: "qg-palette-empty",
                textContent: "无匹配设置项——换个关键词试试。",
            }));
            // R6-B 对齐：无匹配也给可用的下一步
            const fallbacks = document.createElement("div");
            fallbacks.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:6px";
            const diagBtn = document.createElement("button");
            diagBtn.className = "b3-button b3-button--outline b3-button--small";
            diagBtn.textContent = "复制诊断包";
            diagBtn.onclick = async () => {
                const { memDiagnostics } = await import("./settings-panel");
                const service = host.activeService ?? new BridgeService(host.deps());
                const mem = memDiagnostics(host.settings, host.auditLog, service);
                await navigator.clipboard.writeText(JSON.stringify(mem, null, 2));
                showMessage("诊断包已复制到剪贴板（脱敏）", 3000);
            };
            const guideBtn = document.createElement("button");
            guideBtn.className = "b3-button b3-button--outline b3-button--small";
            guideBtn.textContent = "上手指南";
            guideBtn.onclick = () => window.open("https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md", "_blank");
            fallbacks.append(diagBtn, guideBtn);
            content.appendChild(fallbacks);
            return;
        }
        for (const g of groups) {
            const head = document.createElement("p");
            head.className = "qg-page-title";
            head.style.cssText = "display:flex;align-items:center;gap:8px";
            head.textContent = g.label;
            const jump = document.createElement("a");
            jump.className = "b3-link";
            jump.style.cursor = "pointer";
            jump.textContent = "进入分组 →";
            jump.addEventListener("click", () => {
                searchInput.value = "";
                show(g.id); // 跳转后该页正常渲染（行已随迁移带过来，但整页上下文更完整）
            });
            head.appendChild(jump);
            content.appendChild(head);
            for (const r of g.rows) content.appendChild(r);
        }
        }, 150);
    });

    show(initialPage); // 首跑向导或状态概览；支持 queue/connection 等直达（通知中心动作跳转用）
    // 打开即聚焦搜索（R330：键盘流入口；首跑向导语境搜索条隐藏则不抢焦点）
    if (!root.classList.contains("qg-firstrun")) {
        setTimeout(() => { if (document.body.contains(root)) searchInput.focus({ preventScroll: true }); }, 50);
    }
}
