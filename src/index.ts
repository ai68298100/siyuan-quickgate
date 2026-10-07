/**
 * 小驴快门（Lv QuickGate）· 插件入口
 * 生态中枢 + 外部网关：NDJSON 桥（v1）→ 命令/数据/上下文/诊断。
 */
import {
    Plugin, showMessage, confirm, openTab, getFrontend, Dialog,
} from "siyuan";
import "./index.scss";

import { KernelApi } from "./services/kernelApi";
import { BridgeStore, DataIO } from "./services/store";
import { BridgeService, EditorContextResult } from "./services/bridge-service";
import { SingleFlightPoller } from "./services/poller";
import { BroadcastSubscriber, BROADCAST_CHANNEL } from "./services/broadcast";
import { probeCommandRegistry } from "./services/registry";
import { appendEventLine, createSingleFlight, normalizeCheckinEvent, normalizeCheckinEventDeleted, planMaterialization } from "./services/eventbridge";
import { IdempotencyRegistry } from "./services/idempotency";
import { BridgeClaimHandle, BridgeClaimer, createNavigatorClaimer } from "./services/bridge-claim";
import { heartbeatPath, readHeartbeat, shouldWriteHeartbeat, writeHeartbeat } from "./services/heartbeat";
import { HubEvent } from "./services/events";
import { DEFAULT_SETTINGS, QuickGateSettings, AuditEntry, BridgeCommand } from "./types/bridge";
import { memDiagnostics, openQuickGateSettings } from "./settings-panel";
import { openCommandPalette } from "./command-palette";
import { openRecoveryCenter } from "./recovery-center";
import { openNotificationCenter } from "./notification-center-ui";
import { openResultsCenter } from "./results-center-ui";
import { PLUGIN_VERSION } from "./version";

const PLUGIN_NAME = "siyuan-quickgate";
const CONFIRM_TIMEOUT_MS = 30000;

export default class QuickGatePlugin extends Plugin {
    private isMobile: boolean = false;
    store = new BridgeStore(this.asDataIO());
    private idempotency = new IdempotencyRegistry(this.asDataIO());
    kernelApi = new KernelApi();
    poller?: SingleFlightPoller;
    activeService?: BridgeService;
    settings: QuickGateSettings = { ...DEFAULT_SETTINGS };
    auditLog: AuditEntry[] = [];
    /** 正常生命周期完成标记（onload 末尾置位；热重载接管用） */
    private lifecycleBooted = false;
    /** 卸载标记：停用后构造器自愈不得复活后台循环 */
    private tornDown = false;

    /**
     * 热重载接管（bug#15 候选 · SiYuan 3.8.6 push_reload 实证）：
     * 插件目录数据变更（部署/开关持久化等）触发内核 push_reload——重建插件实例但**不走完整
     * 卸载/加载生命周期**：onload 不再执行，旧实例的轮询循环随之丢失（NDJSON 桥静默死亡），
     * 而其 SSE 连接幸存（广播假活）。本构造器在重载重建实例时同样执行：
     * ①全局所有权令牌——新实例接管时停掉旧实例的轮询与 SSE（防双实例双消费；命令幂等台账兜底）；
     * ②延迟自检 onload 是否被调用，未被调用即自愈（加载设置+按开关重启桥循环）。
     * 自愈失败仅记日志不抛出（构造器抛错会被宿主吞掉且更难诊断）。
     */
    constructor(...args: ConstructorParameters<typeof Plugin>) {
        super(...args);
        const g = globalThis as unknown as { __qgActiveInstance?: QuickGatePlugin };
        const prev = g.__qgActiveInstance;
        g.__qgActiveInstance = this;
        if (prev && prev !== this) {
            try {
                // 新实例可能已在 onload 里抢锁；旧实例 tick 完成释放后再补一次启动，
                // 解决热重载时短暂 claim=null 导致桥永久不启动的竞态。
                void prev.stopBridge().then(() => {
                    if (this.lifecycleBooted && !this.tornDown && !this.poller && this.settings.bridgeEnabled && !this.isMobileGuard()) {
                        void this.startBridge().catch((e) => console.warn(`[${PLUGIN_NAME}] 热重载补偿启动失败：`, e));
                    }
                }).catch((e) => console.warn(`[${PLUGIN_NAME}] 热重载旧实例停机失败：`, e));
                prev.stopEventBridge();
            } catch { /* 旧实例可能已半失效 */ }
        }
        setTimeout(() => void this.selfHealAfterHotReload(), 3000);
    }

    private async selfHealAfterHotReload() {
        if (this.lifecycleBooted || this.tornDown) return;
        if (this.poller?.isRunning) return; // 已有循环在跑（并发自愈防护）
        try {
            this.isMobile = getFrontend() === "mobile" || getFrontend() === "browser-mobile";
            await this.store.loadAll();
            this.settings = this.store.settings;
            await this.idempotency.load();
            this.auditLog = await this.store.loadAudit(this.settings.auditMax);
            console.warn(`[${PLUGIN_NAME}] 检测到热重载（onload 未执行）——自愈启动后台循环`);
            if (this.settings.bridgeEnabled && !this.isMobileGuard()) {
                this.startBridge();
                this.startEventBridge();
            }
        } catch (e) {
            console.error(`[${PLUGIN_NAME}] 热重载自愈失败：`, e);
        }
    }

    async onload() {
        this.isMobile = getFrontend() === "mobile" || getFrontend() === "browser-mobile";
        await this.store.loadAll();
        this.settings = this.store.settings;
        await this.idempotency.load(); // L599：事件域幂等记账（滚动裁剪后重放不重复落行）
        this.bridgeClaimer = createNavigatorClaimer();
        this.auditLog = await this.store.loadAudit(this.settings.auditMax); // R47 修复：恢复上次审计历史（此前只写不读，重启即静默销毁）
        await this.ensureDeviceName();

        this.addCommand({
            langKey: "openSetting",
            langText: "小驴快门：打开设置",
            hotkey: "",
            callback: () => this.openSettingPanel(),
        });
        this.addCommand({
            langKey: "openPalette",
            langText: "小驴快门：命令面板",
            hotkey: "Ctrl+Alt+P",
            callback: () => this.openCommandPalette(),
        });
        this.addCommand({
            langKey: "pingBridge",
            langText: "小驴快门：桥自检（bridge.ping）",
            hotkey: "",
            callback: () => void this.selfPing(),
        });

        if (this.settings.bridgeEnabled && !this.isMobileGuard()) {
            this.startBridge();
            this.startEventBridge();
        }
        this.lifecycleBooted = true; // 正常生命周期完成——构造器的热重载自检不再介入
    }

    onLayoutReady() {
        // 轮询已在 onload 启动；为布局相关扩展留位
    }

    onunload() {
        // 优雅停机：先等待当前 tick 完成，再释放消费权，避免热重载时旧实例仍写回。
        this.tornDown = true; // 停用后构造器的热重载自愈不得复活后台循环
        const stopping = this.stopBridge().catch((e) => {
            console.warn(`[${PLUGIN_NAME}] 停止桥时出现异常：`, e);
        });
        this.stopEventBridge();
        const auditFlushed = this.flushAudit();
        // L554：等最后一个 tick 完成后再回写统计，避免 in-flight 结果丢失。
        void Promise.allSettled([stopping, auditFlushed]).then(() => {
            if (this.activeService) {
                void this.store.saveStats(this.activeService.stats).catch((e) => {
                    console.warn(`[${PLUGIN_NAME}] 保存运行统计失败：`, e);
                });
            }
        });
        showMessage("小驴快门已停用；其桥目录随插件数据一并保留/清理", 3000, "info");
    }

    /**
     * events 数据源桥接（R3/R7）：订阅打卡公开宿主事件 → 物化到其桥目录 events.ndjson。
     * 订阅通道=window CustomEvent（上游 integrations.ts emitIntegrationEvent 只走
     * window.dispatchEvent；app.eventBus 仅承载思源内部事件，v18.16 源码实证——
     * v0.4.1 曾误订 eventBus 导致永不触发，v0.5.2 修正）。
     * analytics-updated 不订阅（D-0011：高频触发会挤占滚动窗口）。总线不可用时静默降级。
     */
    eventBridgeHandler?: (e: Event) => void;
    broadcastSub?: BroadcastSubscriber;
    /** 桥消费权认领（L452 多窗口互斥）：持有=本窗口跑轮询；null=他窗占用；undefined=无 Locks 环境（单窗口假设） */
    private bridgeClaim?: BridgeClaimHandle;
    private bridgeClaimer?: BridgeClaimer;
    /** L571/L627 心跳：本窗口序号（deviceName#seq 作 holder 标识，Math.random 非加密用途仅 UI 展示——R50 同先例）与上次心跳落盘时间 */
    private windowId = Math.random().toString(16).slice(2, 6);
    private lastHeartbeatMs = 0;
    /** L610 部分：会话启动时间（实例构造 ≈ onload）——关于页运行时长展示 */
    readonly sessionStartedAt = Date.now();
    /** 内核路由探针结果（设置面板打开时一次性探测；undefined=未探测） */
    kernelRouteProbe?: boolean;

    startEventBridge() {
        if (this.eventBridgeHandler) return;
        try {
            if (typeof window?.addEventListener !== "function") return;
            this.eventBridgeHandler = (e: Event) => {
                const emittedAt = new Date().toISOString();
                const detail = (e as CustomEvent).detail;
                const recorded = e.type === "checkin:event-recorded" ? normalizeCheckinEvent(detail, emittedAt) : null;
                void this.materializeHubEvents(e.type === "checkin:event-deleted" ? normalizeCheckinEventDeleted(detail, emittedAt) : recorded ? [recorded] : null);
            };
            window.addEventListener("checkin:event-recorded", this.eventBridgeHandler);
            window.addEventListener("checkin:event-deleted", this.eventBridgeHandler);
        } catch { /* window 事件不可用 → 静默降级 */ }
    }

    stopEventBridge() {
        if (!this.eventBridgeHandler) return;
        try {
            window.removeEventListener("checkin:event-recorded", this.eventBridgeHandler);
            window.removeEventListener("checkin:event-deleted", this.eventBridgeHandler);
        } catch { /* 忽略 */ }
        this.eventBridgeHandler = undefined;
    }

    /** 批量物化：single-flight 串行（并发读改写会丢更新，R69-P1）；空列表不动文件 */
    private materializeEnqueue = createSingleFlight();

    private materializeHubEvents(events: HubEvent[] | null) {
        if (!events || events.length === 0) return;
        void this.materializeEnqueue(() => this.doMaterialize(events));
    }

    private async doMaterialize(events: HubEvent[]) {
        try {
            const path = "/storage/petal/siyuan-checkin/bridge/events.ndjson";
            // 写入侧幂等（L599/C9 合同 §3）：滚动裁剪后的重放事件不重复落行；
            // 先写后记账——putFile 失败时不 mark，避免事件永久丢失
            const plan = planMaterialization(
                events,
                (key) => this.idempotency.seen(key),
                (e) => IdempotencyRegistry.keyOf(e.source, e.idempotencyKey),
            );
            if (plan.toAppend.length === 0) return;
            const old = (await this.kernelApi.getFileText(path)) ?? "";
            let text = old;
            for (const e of plan.toAppend) {
                text = appendEventLine(text, e, { retentionDays: this.settings.retentionDays });
            }
            await this.kernelApi.putFileText(path, text);
            for (const key of plan.toMark) this.idempotency.mark(key);
            await this.idempotency.save();
        } catch (err) {
            console.warn(`[${PLUGIN_NAME}] 事件物化失败：`, err);
        }
    }

    uninstall() {
        // 宿主卸载钩子：提示桥目录随 petal 数据删除（导出审计入口已在设置页提供）
        try {
            showMessage("小驴快门已卸载：data/storage/petal/siyuan-quickgate/（含桥与审计）将随插件数据清理", 6000, "info");
        } catch { /* 卸载期 UI 不可用时静默 */ }
    }

    /**
     * 设备名：优先读 data/storage/local（不随同步，多设备各自独立）；无则生成并双写
     * local 与 settings（settings 作为 local 不可用时的回退）。spike⑨ 后如迁移桥目录，此文件跟着走。
     */
    private async ensureDeviceName() {
        if (this.settings.deviceName) return;
        const localPath = "/storage/local/siyuan-quickgate/device.json";
        try {
            const raw = await this.kernelApi.getFileText(localPath);
            if (raw) {
                const obj = JSON.parse(raw) as { deviceName?: string };
                if (obj.deviceName) {
                    this.settings.deviceName = obj.deviceName;
                    await this.store.saveSettings();
                    return;
                }
            }
        } catch { /* local 不可用 → 回退 settings */ }
        const generated = `dev-${Math.random().toString(16).slice(2, 6)}`;
        this.settings.deviceName = generated;
        await this.store.saveSettings();
        try {
            await this.kernelApi.putFileText(localPath, JSON.stringify({ deviceName: generated, createdAt: new Date().toISOString() }));
        } catch { /* 写 local 失败不阻断 */ }
    }

    isMobileGuard(): boolean {
        // TODO(M1.5)：移动端默认关桥；显式设置项 mobileBridgeEnabled 开启后放行
        // （旧版隐式 deviceName ":mobile-on" 后缀仍兜底识别——normalize 迁移前的双保险）
        return this.isMobile && !(this.settings.mobileBridgeEnabled || this.settings.deviceName.endsWith(":mobile-on"));
    }

    private asDataIO(): DataIO {
        return {
            load: (file) => this.loadData(file),
            save: (file, data) => this.saveData(file, data),
        };
    }

    /** 启动桥（L506：异步认领，返回是否实际启动；false=消费权被另一窗口持有） */
    async startBridge(): Promise<boolean> {
        if (this.poller?.isRunning) {
            this.startBroadcastSub(); // 桥已在跑、仅广播开关变化时也要接上订阅（幂等）
            return true;
        }
        const service = new BridgeService(this.deps());
        this.activeService = service;
        // L452：先认领桥消费权（Web Locks）——另一思源窗口已持锁时本窗口拒绝启动轮询
        // （双窗口各自 processed 台账独立，无认领会同 id 双执行）。无 Locks 环境=按单窗口假设放行并声明。
        if (!this.bridgeClaimer) {
            this.beginPolling(service, "（无 Locks 环境：单窗口假设）");
            return true;
        }
        const handle = await this.bridgeClaimer.claim("siyuan-quickgate-bridge", {
            // L571/L627（docs/34 §3.4）：本窗口的锁被他窗 steal 接管时——立即停止本窗口消费
            // （轮询/广播全停），防与接管窗口双消费。用户可见通知引导确认原窗口状态。
            onStolen: () => {
                console.warn(`[${PLUGIN_NAME}] 桥消费权已被另一窗口接管——本窗口停止轮询（防双消费）`);
                showMessage("桥消费权已被另一窗口接管，本窗口已停止消费（如非本人操作请检查其他思源窗口）", 6000, "error");
                void this.stopBridge().catch((e) => console.warn(`[${PLUGIN_NAME}] 被接管后停止桥失败：`, e));
            },
        });
        if (handle === null) {
            this.activeService = undefined;
            console.warn(`[${PLUGIN_NAME}] 桥消费权被另一思源窗口持有——本窗口不启动轮询（防同 id 双执行）`);
            return false;
        }
        this.bridgeClaim = handle ?? undefined;
        this.beginPolling(service, handle ? "（Web Lock 认领）" : "（无 Locks 环境：单窗口假设）");
        return true;
    }

    private beginPolling(service: BridgeService, claimNote: string) {
        this.poller = new SingleFlightPoller({
            intervalMs: this.settings.pollMs,
            backoffMaxMs: this.settings.backoffMaxMs,
            tick: () =>
                service.tick().then((r) => {
                    // L571/L627 心跳（docs/34 §3.1）：限流 ≥2s 落盘；失败静默——检测方按"无法判断"降级
                    const now = Date.now();
                    if (shouldWriteHeartbeat(this.lastHeartbeatMs, now)) {
                        this.lastHeartbeatMs = now;
                        void writeHeartbeat(this.kernelApi, heartbeatPath(this.settings.bridgeBasePath), {
                            holder: `${this.settings.deviceName || "win"}#${this.windowId}`,
                            ts: new Date(now).toISOString(),
                            pollMs: this.settings.pollMs,
                        }).catch(() => {});
                    }
                    return r;
                }),
            shouldRun: () => this.settings.bridgeEnabled,
        });
        this.poller.start();
        this.startBroadcastSub();
        console.info(`[${PLUGIN_NAME}] 桥已启动，间隔 ${this.settings.pollMs}ms${claimNote}`);
    }

    /**
     * 失联接管（docs/34 §3.3 · L571/L627）：steal 破坏他窗锁并接管消费权。
     * 安全不变量：台账先查防双消费（接管窗与苏醒窗的毫秒级理论竞窗已在规格 §3.3 登记，
     * 建议用户接管后在原窗口停用桥）。返回被接管 holder 供 UI 标注。
     */
    async takeoverBridge(): Promise<{ ok: boolean; holder: string | null }> {
        const claimer = this.bridgeClaimer;
        if (!claimer?.claimSteal) return { ok: false, holder: null };
        const hb = await readHeartbeat(this.kernelApi, heartbeatPath(this.settings.bridgeBasePath));
        await this.stopBridge();
        const handle = await claimer.claimSteal("siyuan-quickgate-bridge");
        if (handle === null || handle === undefined) return { ok: false, holder: hb?.holder ?? null };
        this.bridgeClaim = handle ?? undefined;
        const service = new BridgeService(this.deps());
        this.activeService = service;
        this.beginPolling(service, hb ? `（接管自 ${hb.holder}）` : "（接管：原持有方无心跳记录）");
        return { ok: true, holder: hb?.holder ?? null };
    }

    /** v1.5 广播快路径（独立开关，默认关）：SSE 订阅 qg-cmd 频道，毫秒级命令通道。幂等。 */
    private startBroadcastSub() {
        if (!this.settings.broadcastEnabled || this.broadcastSub?.running) return;
        const service = this.activeService;
        if (!service) return;
        this.broadcastSub = new BroadcastSubscriber({
            enabled: () => this.settings.bridgeEnabled && this.settings.broadcastEnabled,
            onCommand: (cmd) => service.executeAndRecord(cmd).then(() => {}),
            log: (msg) => console.warn(`[${PLUGIN_NAME}] ${msg}`),
        });
        this.broadcastSub.start();
        console.info(`[${PLUGIN_NAME}] 广播快路径已启动（频道 ${BROADCAST_CHANNEL}）`);
    }

    async stopBridge() {
        const poller = this.poller;
        // stop() 等待已开始的 tick；因此释放 Web Lock 前不会有旧消费者继续写回。
        if (poller) await poller.stop();
        this.poller = undefined;
        if (this.broadcastSub?.running) {
            await this.broadcastSub.stop();
            console.info(`[${PLUGIN_NAME}] 广播快路径已停止`);
        }
        await this.bridgeClaim?.release(); // 释放桥消费权（L452），其他窗口可接管
        this.bridgeClaim = undefined;
    }

    /**
     * 确认对话框：先尝试激活思源窗口（08-O10），30s 超时=拒绝。
     * 3.8.5 bundle 实证：宿主 confirm 为回调式、无返回值、无自动超时——
     * 确认按钮回调后 destroy；Esc/取消仅 destroy（3.8.5 取消分支未见回调调用）。
     * 30s 自制超时是唯一兜底，必须保留。
     */
    private async confirmWithFront(title: string): Promise<boolean> {
        try {
            window.focus();
        } catch { /* 忽略 */ }
        return new Promise<boolean>((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) { settled = true; resolve(false); }
            }, CONFIRM_TIMEOUT_MS);
            confirm("小驴快门 · 外部执行确认", `${title}\n\n确认执行该命令？（30 秒未确认视为拒绝）`, () => {
                if (!settled) { settled = true; clearTimeout(timer); resolve(true); }
            }, () => {
                if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
            });
        });
    }

    private pushAudit(e: AuditEntry) {
        this.auditLog.push(e);
        if (this.auditLog.length > this.settings.auditMax) {
            this.auditLog = this.auditLog.slice(-this.settings.auditMax);
        }
        // L630 R-A：天数保留（默认 0=关）——与条数裁剪叠加；无 finishedAt 字段，time 即 ISO
        if (this.settings.retentionDays > 0) {
            const cutoff = Date.now() - this.settings.retentionDays * 86_400_000;
            this.auditLog = this.auditLog.filter((a) => { try { return Date.parse(a.time) >= cutoff; } catch { return true; } });
        }
        this.scheduleAuditFlush(); // R2：节流合并写，避免每条命令一次 saveData
    }

    private auditTimer?: ReturnType<typeof setTimeout>;

    private scheduleAuditFlush() {
        if (this.auditTimer) return;
        this.auditTimer = setTimeout(() => {
            this.auditTimer = undefined;
            this.flushAudit();
        }, 5000);
    }

    flushAudit(): Promise<void> { // R338：公开——设置面板「导入备份（审计分组）」写回载体需要
        if (this.auditTimer) { clearTimeout(this.auditTimer); this.auditTimer = undefined; }
        return this.saveData("audit.json", { schemaVersion: 1, entries: this.auditLog }).catch(() => {});
    }

    /**
     * 编辑器上下文（尽力而为永不抛错）。
     * 选择器证据（2026-10-02 对照本机安装 bundle resources/stage/build/app/common.js 静态核实）：
     * - .protyle 容器自带 data-node-id=rootID（Protyle 类加载路径 setAttribute，与 fn__none 切换同方法）；
     *   注意 data-doc-id 在 bundle 中不存在（只有 data-doc-type），勿用。
     * - .protyle-title 元素在 render 时也 setAttribute("data-node-id")；标题文本官方走 .protyle-title__input（editElement）。
     * - fn__none 由 Protyle 类在 tab 切换时 add/remove，:not(.fn__none) 过滤有效。
     * DevTools 实证（spike⑦ 现场部分）仍待用户机验证。
     */
    private readEditorContext(): EditorContextResult | null {
        try {
            const activeProtyle = document.querySelector(".layout__center .protyle:not(.fn__none)") as HTMLElement | null;
            if (!activeProtyle) return null;
            const docId = activeProtyle.getAttribute("data-node-id")
                ?? (activeProtyle.querySelector(".protyle-title") as HTMLElement | null)?.getAttribute("data-node-id")
                ?? null;
            const sel = window.getSelection();
            let blockId: string | null = null;
            let selectedText: string | null = null;
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                selectedText = sel.toString().slice(0, 2000);
                let node: Node | null = sel.getRangeAt(0).startContainer;
                while (node && !(node instanceof HTMLElement)) node = node.parentNode;
                let el: HTMLElement | null = node as HTMLElement | null;
                while (el && !el.getAttribute?.("data-node-id")) el = el.parentElement;
                blockId = el?.getAttribute("data-node-id") ?? null;
            }
            const rootTitle = (activeProtyle.querySelector(".protyle-title__input") as HTMLElement | null)?.textContent?.trim()
                ?? (activeProtyle.querySelector(".protyle-title") as HTMLElement | null)?.textContent?.trim()
                ?? null;
            return { docId, rootTitle, blockId, selectedText };
        } catch {
            return null; // 降级：不阻断
        }
    }

    /** 今日日记状态：只探测不创建（对齐雷切语义）；SQL 标题日期法已于 R25 真机实测 code=0 ✓（字段名实证见 spike⑧）。R347 转公开——首跑向导步骤 5 样例只读探针 */
    async readDailyStatus(): Promise<{ docId: string | null; exists: boolean }> {
        try {
            const today = new Date();
            const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const data = await this.kernelApi.post<Array<{ root_id: string }>>("/api/query/sql", {
                stmt: `SELECT root_id FROM blocks WHERE type='d' AND content LIKE '%${ymd}%' LIMIT 1`,
            });
            const docId = data?.[0]?.root_id ?? null;
            return { docId, exists: docId !== null };
        } catch {
            return { docId: null, exists: false };
        }
    }

    private async openDocById(id: string) {
        const app = (window as unknown as { siyuan?: { ws?: { app?: unknown } } }).siyuan?.ws?.app
            ?? (this as unknown as { app: unknown }).app;
        await openTab({ app, doc: { id } } as Parameters<typeof openTab>[0]);
    }

    async selfPing() {
        try {
            const service = new BridgeService(this.deps());
            const r = await service.tick();
            showMessage(`小驴快门自检：处理 ${r.executed} 条命令，回执 ${r.receipts} 条（桥${this.settings.bridgeEnabled ? "已启用" : "未启用"}）`, 4000, "info");
        } catch (e) {
            showMessage(`小驴快门自检失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
        }
    }

    deps() {
        return {
            api: this.kernelApi,
            store: this.store,
            initialStats: this.store.statsSnapshot, // L554：跨重启续计
            settings: () => this.settings,
            pluginName: PLUGIN_NAME,
            pluginVersion: PLUGIN_VERSION,
            deviceName: () => this.settings.deviceName,
            registry: () => probeCommandRegistry(),
            confirm: (t: string) => this.confirmWithFront(t),
            audit: (e: AuditEntry) => this.pushAudit(e),
            editorContext: () => this.readEditorContext(),
            dailyStatus: () => this.readDailyStatus(),
            openDoc: (id: string) => void this.openDocById(id),
            openSetting: () => this.openSettingPanel(),
            getCheckin: () => (window as unknown as { siyuanCheckin?: unknown }).siyuanCheckin,
            getContacts: () => (window as unknown as { LvContacts?: unknown }).LvContacts,
            loadPetals: () => this.kernelApi.post<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: getFrontend() }),
            discoverConfig: () => this.discoverConfig(),
        };
    }

    /**
     * 日记笔记本/收集箱自动发现（spike⑧ 已实证 3.8.5：字段为 dailyNoteSavePath 驼峰；
     * 默认模板三个笔记本同值——需二级消歧，逻辑与 kernel-ops.kernelConfigDiscover 保持一致；永不抛错）
     */
    private async discoverConfig(args: { inboxName?: unknown; createInboxIfMissing?: unknown } = {}): Promise<{ diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] }> {
        const notes: string[] = [];
        let diaryNotebookId: string | null = null;
        let inboxDocId: string | null = null;
        try {
            const resp = await this.kernelApi.post<{ notebooks?: Array<{ id: string; name: string; closed: boolean }> } | Array<{ id: string; name: string; closed: boolean }>>("/api/notebook/lsNotebooks", {});
            const notebooks = Array.isArray(resp) ? resp : resp?.notebooks ?? [];
            type Cand = { id: string; name: string; savePath: string };
            const candidates: Cand[] = [];
            for (const nb of notebooks) {
                if (nb.closed) continue;
                try {
                    const conf = await this.kernelApi.post<{ conf?: Record<string, unknown> }>("/api/notebook/getNotebookConf", { notebook: nb.id });
                    const c = conf?.conf ?? {};
                    const savePath = (c.dailyNoteSavePath as string) ?? (c.dailynoteSavePath as string) ?? "";
                    if (savePath) candidates.push({ id: nb.id, name: nb.name, savePath });
                } catch { /* 单笔记本 conf 失败不影响整体 */ }
                if (!inboxDocId && /收集箱|inbox/i.test(nb.name)) {
                    try {
                        const docs = await this.kernelApi.post<{ files?: Array<{ id: string; name: string }> }>("/api/filetree/listDocsByPath", { notebook: nb.id, path: "/" });
                        inboxDocId = docs?.files?.[0]?.id ?? null;
                        if (inboxDocId) notes.push(`收集箱：${nb.name} 根文档`);
                    } catch { /* 忽略 */ }
                }
            }
            if (candidates.length === 1) {
                diaryNotebookId = candidates[0].id;
                notes.push(`日记笔记本：${candidates[0].name}（dailyNoteSavePath=${candidates[0].savePath}）`);
            } else if (candidates.length > 1) {
                // R25 实证：非默认模板者优先（默认模板字面量取自 3.8.5 出厂值；自定义者几乎必是日记笔记本）
                const DEFAULT_DAILY_TEMPLATE = `/daily note/{{now | date "2006/01"}}/{{now | date "2006-01-02"}}`;
                let scope = candidates;
                const customized = candidates.filter((c) => c.savePath !== DEFAULT_DAILY_TEMPLATE);
                if (customized.length > 0) {
                    scope = customized;
                    notes.push(`按"自定义日记模板"缩小范围：${scope.map((c) => c.name).join("、")}`);
                }
                if (scope.length === 1) {
                    diaryNotebookId = scope[0].id;
                    notes.push(`日记笔记本：${scope[0].name}（dailyNoteSavePath=${scope[0].savePath}）`);
                } else {
                notes.push(`多个笔记本配置了日记路径（${scope.map((c) => c.name).join("、")}），尝试按"今日日记文档存在性"消歧…`);
                const withDiary: Cand[] = [];
                for (const c of scope) {
                    try {
                        const hpath = await this.kernelApi.post<string>("/api/template/renderSprig", { template: c.savePath });
                        const parent = hpath.replace(/\/[^/]+$/, "") || "/";
                        const leaf = hpath.slice(parent.length + 1);
                        const docs = await this.kernelApi.post<{ files?: Array<{ name: string }> }>("/api/filetree/listDocsByPath", { notebook: c.id, path: parent });
                        const exists = (docs?.files ?? []).some((f) => f.name === leaf);
                        if (exists) withDiary.push(c);
                    } catch { /* 单候选消歧失败忽略 */ }
                }
                if (withDiary.length === 1) {
                    diaryNotebookId = withDiary[0].id;
                    notes.push(`日记笔记本（按今日日记文档消歧）：${withDiary[0].name}`);
                } else {
                    notes.push(withDiary.length === 0 ? "各候选笔记本均无今日日记文档，无法唯一判定" : `多个笔记本均有今日日记（${withDiary.map((c) => c.name).join("、")}），无法唯一判定`);
                }
                }
            }
        } catch (e) {
            notes.push(`发现失败：${e instanceof Error ? e.message : String(e)}`);
        }
        if (!diaryNotebookId) notes.push("未发现日记笔记本（回退手填）");

        // 收集箱发现（与内核通道同口径 · L456）：SQL 按约定名找根级文档；零命中可 opt-in 创建（默认不建，v0.7.3 决策）
        try {
            const nameArg = typeof args.inboxName === "string" && args.inboxName.trim() ? args.inboxName.trim() : "";
            const names = nameArg ? [nameArg] : ["收集箱", "Inbox", "inbox"];
            if (!inboxDocId) {
                const inList = names.map((n) => "'" + n.replace(/'/g, "''") + "'").join(",");
                const r = await this.kernelApi.post<{ data?: unknown }>("/api/query/sql", {
                    stmt: `SELECT id, content, box FROM blocks WHERE type='d' AND parent_id='' AND content IN (${inList}) ORDER BY id LIMIT 10`,
                });
                const rows = (r && typeof r === "object" ? (r as { data?: unknown }).data ?? r : r) as unknown[];
                const docs = Array.isArray(rows) ? rows : [];
                if (docs.length === 1) {
                    const doc = docs[0] as { id?: string; content?: string; box?: string };
                    if (doc.id) {
                        inboxDocId = doc.id;
                        notes.push(`收集箱（按约定名发现）：${doc.content ?? ""}（笔记本 ${doc.box ?? "?"}）`);
                    }
                } else if (docs.length > 1) {
                    const first = docs[0] as { id?: string; content?: string; box?: string };
                    if (first.id) {
                        inboxDocId = first.id;
                        notes.push(`收集箱：发现 ${docs.length} 个同名根文档，取最早创建的「${first.content ?? ""}」（笔记本 ${first.box ?? "?"}）；如需指定其它，请手填收集箱文档ID`);
                    }
                }
            }
            if (!inboxDocId && args.createInboxIfMissing) {
                const name = names[0];
                const notebook = diaryNotebookId ?? (await this.kernelApi.post<{ notebooks?: Array<{ id: string; closed: boolean }> }>("/api/notebook/lsNotebooks", {})).notebooks?.find((nb) => !nb.closed)?.id ?? null;
                if (notebook) {
                    const created = await this.kernelApi.post<string>("/api/filetree/createDocWithMd", { notebook, path: `/${name}`, markdown: "" });
                    if (created) {
                        inboxDocId = created;
                        notes.push(`收集箱不存在，已按 createInboxIfMissing 在笔记本 ${notebook} 创建「${name}」`);
                    } else {
                        notes.push(`创建「${name}」未返回文档 ID（可能同名已存在但未被 SQL 命中——请手填收集箱文档ID）`);
                    }
                } else {
                    notes.push("无打开的笔记本，无法按 createInboxIfMissing 创建收集箱");
                }
            }
            if (!inboxDocId) notes.push(`未发现收集箱根文档（约定名${nameArg ? "：" + nameArg : "：收集箱/Inbox"}）——可在思源建一个名为「收集箱」的顶层文档，或手填收集箱文档ID（或以 createInboxIfMissing=true 授权自动创建）`);
        } catch (e) {
            notes.push(`收集箱发现失败：${e instanceof Error ? e.message : String(e)}（回退手填）`);
        }
        return { diaryNotebookId, inboxDocId, notes };
    }

    /**
     * 思源以「覆写基类 openSetting 或存在 this.setting」判定插件有无设置入口
     * （app/src/plugin/index.ts hasPluginSetting）：不覆写时集市已下载卡片不显示齿轮、
     * 顶栏插件菜单无设置项，UI 上零入口（本类仅有私有 openSettingPanel，此前即踩此坑）。
     */
    openSetting(): void {
        this.openSettingPanel();
    }

    /**
     * 设置面板（R288 起为分层面板）：实现迁移至 src/settings-panel.ts（原型 design/ui-prototype/mvp1.html），
     * 本类仅提供运行态与操作（SettingsPanelHost 接口）。
     */
    openSettingPanel(page?: string): void {
        void openQuickGateSettings(this, page);
    }

    /** 桥运行态（通知中心/面板能力分组门控） */
    bridgeAlive(): boolean {
        return Boolean(this.activeService);
    }

    consecutiveFailures(): number {
        return this.poller?.consecutiveFailures ?? 0;
    }

    lateCompletions(): number {
        return this.activeService?.lateCompletions ?? 0;
    }

    openQueuePage(): void {
        this.openSettingPanel("queue");
    }

    openConnectionPage(): void {
        this.openSettingPanel("connection");
    }

    /** 裸对话框（通知中心等宿主注入用；宽度与四中心其余面对齐 640；销毁后焦点回归触发元素——L585 部分） */
    openDialog(content: string): { element: HTMLElement; destroy(): void } {
        const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const d = new Dialog({
            content, width: "min(640px, 92vw)", height: "auto",
            destroyCallback: () => { try { focusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
        });
        return { element: d.element, destroy: () => d.destroy() };
    }

    /** 结果中心（G5-01）：回执查询（状态筛选/关键词/分页/复制） */
    openResultsCenter(): void {
        void openResultsCenter({
            settings: this.settings,
            kernelApi: this.kernelApi,
            ui: {
                openDialog: (content) => this.openDialog(content),
                showMessage: (text, timeout, type) => showMessage(text, timeout, type),
            },
        });
    }

    /** 通知中心（G5-02）：聚合待恢复/积压/退避/迟到为单一关注面 */
    openNotificationCenter(): void {
        void openNotificationCenter({
            settings: this.settings,
            kernelApi: this.kernelApi,
            store: this.store,
            auditLog: this.auditLog,
            bridgeAlive: () => this.bridgeAlive(),
            consecutiveFailures: () => this.consecutiveFailures(),
            lateCompletions: () => this.lateCompletions(),
            openRecoveryCenter: () => this.openRecoveryCenter(),
            openQueuePage: () => this.openQueuePage(),
            openConnectionPage: () => this.openConnectionPage(),
            openDialog: (content: string) => {
                const d = new Dialog({ content, width: "min(640px, 92vw)", height: "auto" });
                return { element: d.element, destroy: () => d.destroy() };
            },
        });
    }

    /** 恢复中心（G5 · R294）：unknown/失败/过期回执的人工处理面（查询/重试/放弃/复制） */
    openRecoveryCenter(): void {
        void openRecoveryCenter({
            settings: this.settings,
            kernelApi: this.kernelApi,
            store: this.store,
            ui: { Dialog, showMessage },
        });
    }

    /** 快速捕获（G3-04 + R7 结论②）：目标二选一——今日日记（HH:mm 前缀）或收集箱（纯文本）。
     * 笔记本/收集箱自动发现（只探测不创建）；返回块/文档 id 供原文操作（R7-A）。 */
    async captureQuick(text: string, target: "daily" | "inbox"): Promise<{ ok: boolean; message: string; blockId?: string; docId?: string }> {
        const clean = text.trim();
        if (!clean) return { ok: false, message: "捕获内容为空" };
        const disc = await this.discoverConfig();
        if (target === "inbox" && !disc.inboxDocId) {
            return { ok: false, message: "未发现收集箱（建一个名为「收集箱」的顶层文档，或在捕获设置里手填 id）——已取消" };
        }
        if (target === "daily" && !disc.diaryNotebookId) {
            return { ok: false, message: "未发现日记笔记本（请确认某笔记本配置了日记保存路径）——已取消" };
        }
        const hhmm = new Date().toTimeString().slice(0, 5);
        let res: unknown;
        if (target === "inbox") {
            res = await this.kernelApi.post("/api/block/appendBlock", {
                dataType: "markdown",
                data: clean,
                parentID: disc.inboxDocId,
            });
        } else {
            res = await this.kernelApi.post("/api/block/appendDailyNoteBlock", {
                notebook: disc.diaryNotebookId,
                dataType: "markdown",
                data: `- ${hhmm} ${clean}`,
            });
        }
        // 返回形状（真机实证 R298/R299）：data[0].doOperations[*].id = 新块 id
        let blockId: string | undefined;
        try {
            const ops = (res as Array<{ doOperations?: Array<{ id?: string }> }>)?.[0]?.doOperations;
            blockId = ops?.[ops.length - 1]?.id;
        } catch { /* 形状异常不阻断成功路径 */ }
        const daily = target === "daily" ? await this.readDailyStatus() : null;
        const where = target === "inbox" ? "收集箱" : "今日日记";
        return {
            ok: true,
            message: `已记到${where}（${target === "daily" ? hhmm : new Date().toTimeString().slice(0, 5)}）：${clean.slice(0, 40)}${clean.length > 40 ? "…" : ""}`,
            blockId,
            docId: target === "daily" ? daily?.docId ?? undefined : disc.inboxDocId ?? undefined,
        };
    }

    /** 命令面板（G3-01 MVP）：与桥共用 runCommand 语义（确认门控/审计一致） */
    openCommandPalette(): void {
        void openCommandPalette({
            settings: this.settings,
            pluginName: PLUGIN_NAME,
            kernelApi: this.kernelApi,
            ui: { Dialog, showMessage },
            registry: () => probeCommandRegistry(),
            confirm: (t) => this.confirmWithFront(t),
            audit: (e) => this.pushAudit(e),
            openSettingPanel: () => this.openSettingPanel(),
            copyDiagnostics: async () => {
                const service = this.activeService ?? new BridgeService(this.deps());
                const commandsText = await this.kernelApi.getFileText(`${this.settings.bridgeBasePath}/commands.ndjson`).catch(() => null);
                const mem = memDiagnostics(this.settings, this.auditLog, service, undefined, this.broadcastSub?.metrics, { sessionStartedAt: this.sessionStartedAt, commandsText });
                await navigator.clipboard.writeText(JSON.stringify(mem, null, 2));
                showMessage("诊断包已复制到剪贴板（脱敏）", 3000);
            },
            captureQuick: (text, target) => this.captureQuick(text, target),
            openCommandPalette: () => this.openCommandPalette(),
            lastCaptureTarget: () => this.settings.captureTarget,
            rememberCaptureTarget: (target) => {
                this.settings.captureTarget = target;
                this.store.settings = this.settings;
                void this.store.saveSettings().catch(() => {});
            },
            openDoc: async (id) => { await this.openDocById(id); },
            bridgeAlive: () => Boolean(this.activeService),
            dispatchOp: async (op, args) => {
                if (!this.activeService) return { status: "failed", message: "桥未运行——请先在 连接与通道 开启外部命令桥", data: null };
                const command: BridgeCommand = {
                    v: 1,
                    id: `ui-${Date.now()}-${Math.floor(Math.random() * 65536).toString(16)}`,
                    op, args,
                    createdAt: new Date().toISOString(),
                };
                const r = await this.activeService.executeAndRecord(command);
                return {
                    status: r.receipt?.status ?? (r.executed ? "recorded" : "skipped"),
                    message: r.receipt?.message ?? "",
                    data: r.receipt?.data ?? null,
                };
            },
        });
    }
}
