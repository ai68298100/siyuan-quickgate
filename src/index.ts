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
import { BridgeService, EditorContextResult, EcosystemManifest } from "./services/bridge-service";
import manifestJson from "./assets/ecosystem-manifests.json";
import { SingleFlightPoller } from "./services/poller";
import { BroadcastSubscriber, BROADCAST_CHANNEL } from "./services/broadcast";
import { probeCommandRegistry } from "./services/registry";
import { appendEventLine, createSingleFlight, normalizeCheckinEvent, normalizeCheckinEventDeleted, planMaterialization } from "./services/eventbridge";
import { IdempotencyRegistry } from "./services/idempotency";
import { normalizeFavorites, FavoritesStore } from "./services/favorites";
import { BridgeClaimHandle, BridgeClaimer, createNavigatorClaimer } from "./services/bridge-claim";
import { HubEvent } from "./services/events";
import { DEFAULT_SETTINGS, QuickGateSettings, AuditEntry } from "./types/bridge";

const PLUGIN_NAME = "siyuan-quickgate";
const PLUGIN_VERSION = "0.7.5";
const CONFIRM_TIMEOUT_MS = 30000;

/** 诊断包组装（脱敏：无 Token/正文/个人路径） */
function memDiagnostics(settings: QuickGateSettings, auditLog: AuditEntry[], service: BridgeService) {
    const st = service.stats;
    return {
        protocol: 1,
        plugin: PLUGIN_NAME,
        version: PLUGIN_VERSION,
        settings: { ...settings },
        lateCompletions: service.lateCompletions,
        stats: { ...st, avgDispatchMs: st.commands > 0 ? Math.round(st.totalDispatchMs / st.commands) : null },
        auditTail: auditLog.slice(-50),
        exportedAt: new Date().toISOString(),
    };
}

export default class QuickGatePlugin extends Plugin {
    private isMobile: boolean = false;
    private store = new BridgeStore(this.asDataIO());
    private idempotency = new IdempotencyRegistry(this.asDataIO());
    private kernelApi = new KernelApi();
    private poller?: SingleFlightPoller;
    private activeService?: BridgeService;
    private settings: QuickGateSettings = { ...DEFAULT_SETTINGS };
    private auditLog: AuditEntry[] = [];
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
                void prev.stopBridge();
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
        // 优雅停机：单飞循环在当前 tick 结束后退出，不撕正在进行的写；广播订阅同步停止
        this.tornDown = true; // 停用后构造器的热重载自愈不得复活后台循环
        this.poller?.stop();
        this.poller = undefined;
        void this.broadcastSub?.stop();
        this.broadcastSub = undefined;
        void this.bridgeClaim?.release(); // 释放桥消费权（L452）
        this.bridgeClaim = undefined;
        this.stopEventBridge();
        this.flushAudit();
        showMessage("小驴快门已停用；其桥目录随插件数据一并保留/清理", 3000, "info");
    }

    /**
     * events 数据源桥接（R3/R7）：订阅打卡公开宿主事件 → 物化到其桥目录 events.ndjson。
     * 订阅通道=window CustomEvent（上游 integrations.ts emitIntegrationEvent 只走
     * window.dispatchEvent；app.eventBus 仅承载思源内部事件，v18.16 源码实证——
     * v0.4.1 曾误订 eventBus 导致永不触发，v0.5.2 修正）。
     * analytics-updated 不订阅（D-0011：高频触发会挤占滚动窗口）。总线不可用时静默降级。
     */
    private eventBridgeHandler?: (e: Event) => void;
    private broadcastSub?: BroadcastSubscriber;
    /** 桥消费权认领（L452 多窗口互斥）：持有=本窗口跑轮询；null=他窗占用；undefined=无 Locks 环境（单窗口假设） */
    private bridgeClaim?: BridgeClaimHandle;
    private bridgeClaimer?: BridgeClaimer;
    /** 内核路由探针结果（设置面板打开时一次性探测；undefined=未探测） */
    private kernelRouteProbe?: boolean;

    private startEventBridge() {
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

    private stopEventBridge() {
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
                text = appendEventLine(text, e);
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

    private isMobileGuard(): boolean {
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
    private async startBridge(): Promise<boolean> {
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
        const handle = await this.bridgeClaimer.claim("siyuan-quickgate-bridge");
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
            tick: () => service.tick(),
            shouldRun: () => this.settings.bridgeEnabled,
        });
        this.poller.start();
        this.startBroadcastSub();
        console.info(`[${PLUGIN_NAME}] 桥已启动，间隔 ${this.settings.pollMs}ms${claimNote}`);
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

    private async stopBridge() {
        this.poller?.stop();
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

    private flushAudit() {
        if (this.auditTimer) { clearTimeout(this.auditTimer); this.auditTimer = undefined; }
        void this.saveData("audit.json", { schemaVersion: 1, entries: this.auditLog }).catch(() => {});
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

    /** 今日日记状态：只探测不创建（对齐雷切语义）；SQL 标题日期法已于 R25 真机实测 code=0 ✓（字段名实证见 spike⑧） */
    private async readDailyStatus(): Promise<{ docId: string | null; exists: boolean }> {
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

    private async selfPing() {
        try {
            const service = new BridgeService(this.deps());
            const r = await service.tick();
            showMessage(`小驴快门自检：处理 ${r.executed} 条命令，回执 ${r.receipts} 条（桥${this.settings.bridgeEnabled ? "已启用" : "未启用"}）`, 4000, "info");
        } catch (e) {
            showMessage(`小驴快门自检失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
        }
    }

    private deps() {
        return {
            api: this.kernelApi,
            store: this.store,
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

    private openSettingPanel() {
        const dialog = new Dialog({
            title: "小驴快门 · 设置",
            content: `<div class="b3-dialog__content" id="qg-settings" style="padding:12px;max-height:72vh;overflow:auto"></div>`,
            width: "640px",
            height: "auto",
        });
        const root = dialog.element.querySelector("#qg-settings") as HTMLElement;
        let seq = 0;

        // —— 分组折叠节（details 原生键盘可达；open=首屏展开）——
        const section = (title: string, open: boolean) => {
            const d = document.createElement("details");
            d.open = open;
            d.style.marginBottom = "4px";
            const s = document.createElement("summary");
            s.textContent = title;
            s.style.cursor = "pointer";
            s.style.fontWeight = "bold";
            s.style.padding = "4px 0";
            d.appendChild(s);
            const body = document.createElement("div");
            d.appendChild(body);
            root.appendChild(d);
            return body;
        };
        // —— 行：label 关联控件（ htmlFor），hint 为次行说明——
        const row = (parent: HTMLElement, label: string, ctrl: HTMLElement, hint?: string) => {
            const div = document.createElement("div");
            div.className = "fn__flex b3-label";
            div.style.flexWrap = "wrap";
            div.style.alignItems = "center";
            const l = document.createElement("label");
            l.textContent = label;
            l.style.flex = "1";
            l.style.paddingRight = "12px";
            l.style.minWidth = "200px";
            if (!ctrl.id) ctrl.id = `qg-f-${++seq}`;
            l.htmlFor = ctrl.id;
            div.appendChild(l);
            div.appendChild(ctrl);
            if (hint) {
                const h = document.createElement("div");
                h.style.fontSize = "11px";
                h.style.width = "100%";
                h.style.color = "var(--b3-theme-on-surface)";
                h.textContent = hint;
                div.appendChild(h);
            }
            parent.appendChild(div);
            return div;
        };

        // —— 状态概览（首屏；role=status 动态刷新 + 数据截至时间，超出原型要求）——
        const statusCard = document.createElement("div");
        statusCard.className = "b3-card";
        statusCard.style.padding = "8px 12px";
        statusCard.style.marginBottom = "8px";
        const statusLine = document.createElement("div");
        statusLine.setAttribute("role", "status");
        statusLine.setAttribute("aria-live", "polite");
        statusLine.style.fontSize = "12px";
        statusLine.style.lineHeight = "1.9";
        statusCard.appendChild(statusLine);
        root.appendChild(statusCard);
        const badge = (ok: boolean, okText: string, offText: string) =>
            `<span style="color:${ok ? "var(--b3-theme-primary)" : "var(--b3-theme-on-surface)"}">● ${ok ? okText : offText}</span>`;
        const refreshStatus = () => {
            const st = this.activeService?.stats;
            const avg = st && st.commands > 0 ? Math.round(st.totalDispatchMs / st.commands) : null;
            const backoff = this.poller && this.poller.consecutiveFailures > 0 ? `退避中×${this.poller.consecutiveFailures}` : null;
            statusLine.innerHTML = [
                badge(!!this.poller?.isRunning, "桥 运行中", "桥 已停止"),
                badge(!!this.broadcastSub?.running, "广播 运行中", "广播 关"),
                badge(!!this.eventBridgeHandler, "事件物化 已接", "事件物化 未接"),
                this.kernelRouteProbe === undefined ? null : badge(this.kernelRouteProbe, "内核路由 可用", "内核路由 不可达"),
                st ? `本次运行 ${st.commands} 条（成功 ${st.ok} / 拒绝 ${st.rejected} / 失败 ${st.failed} / 过期 ${st.expired}）` : "服务未启动",
                avg !== null ? `平均 ${avg}ms` : null,
                backoff,
                st?.lastActivityAt ? `数据截至 ${new Date(st.lastActivityAt).toLocaleTimeString()}` : null,
            ].filter(Boolean).join(" · ");
        };
        refreshStatus();
        // L505：内核路由状态探针（开面板一次性；随 petal 启用即用，不经桥开关）
        void (async () => {
            try {
                const r = await this.kernelApi.post<unknown>(`/plugin/private/${PLUGIN_NAME}/exec`, { op: "bridge.ping", args: {} });
                this.kernelRouteProbe = !!r;
            } catch { this.kernelRouteProbe = false; }
            if (document.body.contains(root)) refreshStatus();
        })();
        const statusTimer = window.setInterval(() => {
            if (!document.body.contains(root)) { window.clearInterval(statusTimer); return; }
            refreshStatus();
        }, 3000);

        // —— 基础连接（首屏展开）——
        const secBasic = section("基础连接", true);

        const enabledInput = document.createElement("input");
        enabledInput.type = "checkbox";
        enabledInput.className = "b3-switch";
        enabledInput.checked = this.settings.bridgeEnabled;
        enabledInput.onchange = async () => {
            this.settings.bridgeEnabled = enabledInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
            if (this.settings.bridgeEnabled && !this.isMobileGuard()) {
                const started = await this.startBridge(); // L506：等认领完成再提示，如实反映结果
                this.startEventBridge(); // 与 onload 配对：开启桥即接上事件物化，无需重启插件
                refreshStatus();
                showMessage(started ? "外部命令桥已开启（本窗口消费）" : "另一思源窗口正在运行外部命令桥，本窗口未重复启动", 4000, "info");
                return;
            }
            await this.stopBridge();
            this.stopEventBridge(); // 与 onload 配对：关桥即退订，事件物化不得在桥关闭后继续写
            refreshStatus();
            showMessage("外部命令桥已关闭", 3000);
        };
        row(secBasic, "外部命令桥", enabledInput, "默认关；开启后外部程序（Quicker/CLI/MCP）可发命令");

        const mobileInput = document.createElement("input");
        mobileInput.type = "checkbox";
        mobileInput.className = "b3-switch";
        mobileInput.checked = this.settings.mobileBridgeEnabled
            || this.settings.deviceName.endsWith(":mobile-on"); // 旧后缀迁移前也如实显示
        mobileInput.onchange = async () => {
            this.settings.mobileBridgeEnabled = mobileInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
            showMessage(`移动端桥已${this.settings.mobileBridgeEnabled ? "允许" : "关闭"}（仅在移动端设备上生效）`, 3000);
        };
        row(secBasic, "移动端桥 opt-in", mobileInput, "默认关；移动端上开启外部命令桥需单独打开此项");

        const bcInput = document.createElement("input");
        bcInput.type = "checkbox";
        bcInput.className = "b3-switch";
        bcInput.checked = this.settings.broadcastEnabled;
        bcInput.onchange = async () => {
            this.settings.broadcastEnabled = bcInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
            if (this.settings.broadcastEnabled && this.settings.bridgeEnabled && !this.isMobileGuard()) {
                this.startBridge(); // startBridge 内部按开关幂等启动广播订阅
            } else if (this.broadcastSub?.running) {
                await this.broadcastSub.stop();
            }
            refreshStatus();
            showMessage(`广播快路径已${this.settings.broadcastEnabled ? "开启（毫秒级命令通道 qg-cmd）" : "关闭"}`, 3000);
        };
        row(secBasic, "广播快路径 v1.5", bcInput, "默认关；需先开桥；postMessage→qg-cmd 频道毫秒级执行");

        const pollWrap = document.createElement("div");
        pollWrap.style.display = "flex";
        pollWrap.style.alignItems = "center";
        pollWrap.style.gap = "6px";
        const pollInput = document.createElement("input");
        pollInput.type = "number";
        pollInput.className = "b3-text-field fn__size200";
        pollInput.value = String(this.settings.pollMs);
        const pollErr = document.createElement("span");
        pollErr.setAttribute("role", "alert");
        pollErr.style.color = "var(--b3-theme-error)";
        pollErr.style.fontSize = "11px";
        pollWrap.appendChild(pollInput);
        pollWrap.appendChild(pollErr);
        pollInput.onchange = async () => {
            const v = parseInt(pollInput.value, 10);
            if (v >= 200 && v <= 60000) {
                pollErr.textContent = "";
                this.settings.pollMs = v;
                this.store.settings = this.settings;
                await this.store.saveSettings();
            } else {
                // 行内校验：不静默还原，给出原因（超出原型「inline 校验」要求）
                pollErr.textContent = "须为 200~60000 的整数，已还原当前生效值";
                pollInput.value = String(this.settings.pollMs);
            }
        };
        row(secBasic, "轮询间隔（ms）", pollWrap, "200~60000；行内校验，非法值还原并提示");

        // —— 安全与权限（折叠）——
        const secSec = section("安全与权限", false);

        const confirmInput = document.createElement("input");
        confirmInput.type = "checkbox";
        confirmInput.className = "b3-switch";
        confirmInput.checked = this.settings.confirmExec;
        confirmInput.onchange = async () => {
            this.settings.confirmExec = confirmInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
        };
        row(secSec, "命令执行前确认", confirmInput, "默认开；思源端弹确认，30 秒超时拒绝");

        const rawInput = document.createElement("input");
        rawInput.type = "checkbox";
        rawInput.className = "b3-switch";
        rawInput.checked = this.settings.rawApiEnabled;
        rawInput.onchange = async () => {
            if (rawInput.checked) {
                // L513：启用前列出影响/留痕/可逆性（危险开关确认框纪律）；取消则回滚开关
                const 名单 = this.settings.rawApiAllowlist.length > 0
                    ? this.settings.rawApiAllowlist.join("、")
                    : "（当前名单为空——开启后调用仍会被全部拒绝，请先在下方编辑名单）";
                confirm(
                    "小驴快门 · 启用 plugin.api 高级透传",
                    `将允许外部客户端（MCP/CLI）经快门调用名单内插件的窗口桥方法：${名单}。\n` +
                    `所有调用留审计（仅记录插件与方法名，不含参数值）。随时可关闭本开关回退，设置即改即生效。`,
                    async () => {
                        this.settings.rawApiEnabled = true;
                        this.store.settings = this.settings;
                        await this.store.saveSettings();
                        showMessage("plugin.api 已启用（名单可在下方编辑）", 3000);
                    },
                    () => { rawInput.checked = false; },
                );
                return;
            }
            this.settings.rawApiEnabled = false;
            this.store.settings = this.settings;
            await this.store.saveSettings();
        };
        row(secSec, "plugin.api 高级透传", rawInput, "默认关；启用前确认；配合允许名单使用（见下方黑名单）");

        // 允许名单编辑器（L458：api.md §11 承诺「新插件由用户手动加入」——此前无入口，承诺无法履行）
        const allowlistInput = document.createElement("textarea");
        allowlistInput.className = "b3-text-field fn__block";
        allowlistInput.rows = 2;
        allowlistInput.value = this.settings.rawApiAllowlist.join(", ");
        allowlistInput.onchange = async () => {
            // L504：行内校验——pluginId 形状（siyuan-*）不符的条目剔除并列出；合法条目照常保存
            const raw = allowlistInput.value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
            const invalid = raw.filter((s) => !/^siyuan-[a-z0-9-]+$/.test(s));
            const valid = raw.filter((s) => /^siyuan-[a-z0-9-]+$/.test(s));
            this.settings.rawApiAllowlist = [...new Set(valid)];
            this.store.settings = this.settings;
            await this.store.saveSettings();
            allowlistInput.value = this.settings.rawApiAllowlist.join(", ");
            if (invalid.length > 0) {
                showMessage(`已保存合法条目；以下不符合 pluginId 形状（siyuan-*）被剔除：${invalid.join("、")}`, 5000, "error");
            } else {
                showMessage("允许名单已保存", 1500, "info");
            }
        };
        row(secSec, "plugin.api 允许名单", allowlistInput, "逗号分隔的 pluginId；默认仅含已完成契约审计的三个插件（打卡/人脉/雷切）——新加入即授权透传其窗口桥，请先完成契约审计");

        const blacklistInput = document.createElement("textarea");
        blacklistInput.className = "b3-text-field fn__block";
        blacklistInput.rows = 2;
        blacklistInput.value = this.settings.blacklist.join(", ");
        blacklistInput.onchange = async () => {
            this.settings.blacklist = blacklistInput.value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
            this.store.settings = this.settings;
            await this.store.saveSettings();
            showMessage("黑名单已保存", 1500, "info"); // L504：保存反馈（轻提示，不打断）
        };
        row(secSec, "插件黑名单", blacklistInput, "逗号分隔；名单内插件不暴露命令");

        // —— 数据与队列（折叠）——
        const secQueue = section("数据与队列", false);

        const queueBtn = document.createElement("button");
        queueBtn.className = "b3-button b3-button--outline";
        queueBtn.textContent = "查看队列与运行统计";
        queueBtn.onclick = async () => {
            try {
                const text = (await this.kernelApi.getFileText(`${this.settings.bridgeBasePath}/commands.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").length : 0;
                const st = this.activeService?.stats;
                const avg = st && st.commands > 0 ? Math.round(st.totalDispatchMs / st.commands) : null;
                const parts = [
                    `待处理命令 ${lines} 条`,
                    `台账 ${Object.keys(this.store.processed.processed).length} 条`,
                    `迟到完成 ${this.activeService?.lateCompletions ?? 0} 次`,
                    st ? `本次运行已执行 ${st.commands} 条（成功 ${st.ok} / 拒绝 ${st.rejected} / 失败 ${st.failed} / 过期 ${st.expired}）` : "服务未启动",
                    avg !== null ? `平均耗时 ${avg}ms` : null,
                    st?.lastActivityAt ? `最近活动 ${new Date(st.lastActivityAt).toLocaleTimeString()}` : null,
                ].filter((p): p is string => p !== null);
                showMessage(parts.join(" · "), 6000, "info");
            } catch (e) {
                showMessage(`读取失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secQueue, "队列与运行统计", queueBtn);

        const clearBtn = document.createElement("button");
        clearBtn.className = "b3-button b3-button--outline";
        clearBtn.textContent = "清空命令队列";
        clearBtn.onclick = async () => {
            try {
                const base = this.settings.bridgeBasePath;
                // 清空前预览：数量 / 最老命令时间（超出原型「清队列前预览」要求）
                const text = (await this.kernelApi.getFileText(`${base}/commands.ndjson`)) ?? "";
                const ls = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
                let oldest = "";
                for (const l of ls) {
                    try { const c = JSON.parse(l); if (typeof c.createdAt === "string" && (!oldest || c.createdAt < oldest)) oldest = c.createdAt; } catch { }
                }
                const preview = ls.length === 0
                    ? "队列当前为空。仍将清空回执文件并重置处理台账。"
                    : `将丢弃 ${ls.length} 条未消费命令${oldest ? `（最早提交 ${oldest}）` : ""}，并清空回执文件与处理台账。`;
                confirm("小驴快门 · 清空队列", preview + " 此操作不可撤销。", async () => {
                    try {
                        await this.kernelApi.putFileText(`${base}/commands.ndjson`, "");
                        await this.kernelApi.putFileText(`${base}/results.ndjson`, "");
                        this.store.processed = { schemaVersion: 1, processed: {} };
                        await this.store.saveProcessed();
                        showMessage("命令队列已清空", 3000);
                    } catch (e) {
                        showMessage(`清空失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
                    }
                }, () => {});
            } catch (e) {
                showMessage(`预览失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secQueue, "排障", clearBtn, "清空前预览将丢弃数量与最老命令（不可撤销）");

        const auditFilterInput = document.createElement("input");
        auditFilterInput.className = "b3-text-field fn__size200";
        auditFilterInput.placeholder = "筛选：op / 状态 / 插件";
        const auditBtn = document.createElement("button");
        auditBtn.className = "b3-button b3-button--outline";
        auditBtn.textContent = "查看审计（最近 20 条）";
        auditBtn.onclick = () => {
            // L514：关键词（op/状态/插件）+ 日期筛选 + 逐条复制；20 条窗口内不做分页/虚拟化（数据量不支撑，裁剪声明）
            const state = { kw: "", date: "" };
            const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            const view = () => this.auditLog.slice(-20).filter((a) => {
                if (state.date && !a.time.startsWith(state.date)) return false;
                if (state.kw && !`${a.plugin}/${a.command} ${a.status}`.toLowerCase().includes(state.kw)) return false;
                return true;
            });
            const render = () => {
                const rows = view().map((a) => {
                    const idx = this.auditLog.indexOf(a);
                    return `<div style="margin-bottom:2px">${esc(`${a.time} ${a.plugin}/${a.command} → ${a.status} (${a.elapsedMs}ms)`)} ` +
                        `<button class="b3-button b3-button--small" data-qg-copy="${idx}">复制</button></div>`;
                }).join("") || "（无匹配）";
                return `<div style="display:flex;gap:6px;margin-bottom:6px">` +
                    `<input id="qg-audit-filter" class="b3-text-field" style="flex:1" placeholder="筛选：op / 状态 / 插件" value="${esc(state.kw)}" />` +
                    `<input id="qg-audit-date" type="date" class="b3-text-field" style="width:150px" value="${state.date}" title="按日期筛选" />` +
                    `</div><div style="white-space:pre-wrap;font-size:12px">${rows}</div>`;
            };
            const rerender = () => {
                const body = d.element.querySelector("#qg-audit-body");
                if (body) body.innerHTML = render();
                const again = d.element.querySelector("#qg-audit-filter") as HTMLInputElement | null;
                if (again && document.activeElement === again || document.activeElement?.id === "qg-audit-date") {
                    const focusBack = d.element.querySelector(`#${document.activeElement?.id}`) as HTMLInputElement | null;
                    focusBack?.focus();
                }
            };
            const d = new Dialog({ title: "审计日志", content: `<div style="padding:12px"><div id="qg-audit-body">${render()}</div></div>`, width: "640px" });
            d.element.addEventListener("input", (ev) => {
                const target = ev.target as HTMLInputElement;
                if (target.id === "qg-audit-filter") state.kw = target.value.trim().toLowerCase();
                else if (target.id === "qg-audit-date") state.date = target.value;
                else return;
                rerender();
                const again = d.element.querySelector(`#${target.id}`) as HTMLInputElement | null;
                if (again && target.id === "qg-audit-filter") { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
            });
            d.element.addEventListener("click", (ev) => {
                const btn = (ev.target as HTMLElement).closest("[data-qg-copy]") as HTMLElement | null;
                if (!btn) return;
                const entry = this.auditLog[Number(btn.dataset.qgCopy)];
                if (!entry) return;
                void navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => showMessage("已复制单条审计（JSON，脱敏字段本就不含参数值）", 2500, "info"));
            });
        };
        row(secQueue, "审计日志（筛选+复制）", auditBtn, "按 op / 状态 / 插件关键词与日期过滤最近 20 条；单条可复制 JSON");

        // —— 收藏与最近使用管理（L472 消费面 · R250）——
        const favBtn = document.createElement("button");
        favBtn.className = "b3-button b3-button--outline";
        favBtn.textContent = "收藏与最近使用管理";
        favBtn.onclick = () => {
            const favPath = `/storage/petal/${PLUGIN_NAME}/favorites.json`;
            const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            const load = async () => {
                try {
                    const raw = await this.kernelApi.getFileText(favPath);
                    return normalizeFavorites(raw ? JSON.parse(raw) : null);
                } catch { return normalizeFavorites(null); }
            };
            const save = async (s: FavoritesStore) => {
                await this.kernelApi.putFileText(favPath, JSON.stringify({ schemaVersion: 1, favorites: s.favorites, recent: s.recent }, null, 2));
            };
            const render = (s: FavoritesStore) => {
                const favRows = s.favorites.map((f, i) =>
                    `<div style="margin-bottom:2px">★ ${esc(`${f.plugin}/${f.command}`)}（${esc(f.title)}） <button class="b3-button b3-button--small" data-qg-fav-del="${i}">移除</button></div>`).join("")
                    || '<div style="color:var(--b3-theme-on-surface)">暂无收藏——面板/CLI 经 favorites.add 添加</div>';
                const recRows = s.recent.map((r, i) =>
                    `<div style="margin-bottom:2px">${esc(r.at.slice(0, 16).replace("T", " "))} ${esc(`${r.plugin}/${r.command}`)} <button class="b3-button b3-button--small" data-qg-rec-del="${i}">移除</button></div>`).join("")
                    || '<div style="color:var(--b3-theme-on-surface)">暂无最近使用</div>';
                return `<div style="margin-bottom:6px"><b>收藏（${s.favorites.length}）</b></div>${favRows}` +
                    `<div style="margin:8px 0 6px"><b>最近使用（${s.recent.length}）</b></div>${recRows}` +
                    `<div style="margin-top:8px"><button class="b3-button b3-button--small" data-qg-rec-clear ${s.recent.length === 0 ? "disabled" : ""}>清空全部最近使用</button></div>`;
            };
            const d = new Dialog({ title: "收藏与最近使用", content: `<div style="padding:12px;font-size:12px"><div id="qg-fav-body">${render(normalizeFavorites(null))}</div></div>`, width: "640px" });
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
        row(secQueue, "收藏与最近使用", favBtn, "管理 favorites.json：移除收藏/单条最近/一键清空最近（命令面板动态组的数据源，L472）");

        const auditExportBtn = document.createElement("button");
        auditExportBtn.className = "b3-button b3-button--outline";
        auditExportBtn.textContent = "导出审计 JSON";
        auditExportBtn.onclick = async () => {
            try {
                const payload = JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), entries: this.auditLog }, null, 2);
                await navigator.clipboard.writeText(payload);
                showMessage(`已复制 ${this.auditLog.length} 条审计到剪贴板`, 4000, "info");
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secQueue, "审计导出（完整 auditLog → 剪贴板）", auditExportBtn);

        const receiptBtn = document.createElement("button");
        receiptBtn.className = "b3-button b3-button--outline";
        receiptBtn.textContent = "最近回执（20 条）";
        receiptBtn.onclick = async () => {
            try {
                const text = (await this.kernelApi.getFileText(`${this.settings.bridgeBasePath}/results.ndjson`)) ?? "";
                const lines = text.trim() ? text.trim().split("\n").slice(-20) : [];
                const view = lines.map((l) => {
                    try { const r = JSON.parse(l); return `${r.finishedAt} ${r.id} ${r.op} → ${r.status} (${r.elapsedMs}ms)`; }
                    catch { return l.slice(0, 120); }
                }).join("\n") || "（暂无回执）";
                new Dialog({ title: "最近回执", content: `<div class="b3-typography" style="padding:12px;white-space:pre-wrap;font-size:12px">${view.replace(/</g, "&lt;")}</div>`, width: "680px" });
            } catch (e) {
                showMessage(`读取回执失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secQueue, "最近回执", receiptBtn);

        // —— 诊断与生态（折叠）——
        const secDiag = section("诊断与生态", false);

        const diagBtn = document.createElement("button");
        diagBtn.className = "b3-button b3-button--outline";
        diagBtn.textContent = "导出诊断包（到剪贴板）";
        diagBtn.onclick = async () => {
            try {
                // 统计须取自当前活动服务实例：临时 new 的服务计数全零，诊断包会失真（桥关时才回落新实例）
                const service = this.activeService ?? new BridgeService(this.deps());
                const mem = memDiagnostics(this.settings, this.auditLog, service);
                await navigator.clipboard.writeText(JSON.stringify(mem, null, 2));
                showMessage("诊断包已复制到剪贴板（脱敏）", 3000);
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secDiag, "诊断", diagBtn, "脱敏：不含 Token / 正文 / 个人路径");

        const ecoBtn = document.createElement("button");
        ecoBtn.className = "b3-button b3-button--outline";
        ecoBtn.textContent = "生态清单版本";
        ecoBtn.onclick = async () => {
            try {
                const manifest = manifestJson as EcosystemManifest;
                let installed: Array<Record<string, unknown>> = [];
                try {
                    installed = await this.kernelApi.post<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: getFrontend() });
                } catch { /* 内核不可达 → 只展示 manifest 口径 */ }
                const instMap = new Map(installed.map((p) => [String(p.name), p]));
                const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
                // L471 能力目录视图：状态 / 版本对照 / 缺失原因 / 入口，逐插件卡片
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
                        reason = `缺失原因：实装 ${iv} ≠ 清单基准 ${m.version}（能力面可能变化，可校准清单）`;
                    } else if (!enabled) {
                        status = `<span style="color:var(--b3-theme-warning, #d97706)">● 已停用</span>`;
                        reason = "缺失原因：插件在思源插件列表中已停用";
                    } else {
                        status = `<span style="color:var(--b3-theme-primary)">● 已安装启用</span>`;
                    }
                    const maturityBadge = m.maturity === "stable" ? "stable" : m.maturity === "design" ? "design（无公开契约，不接入）" : "unlocated";
                    const caps = m.capabilities.length > 0 ? `能力 ${m.capabilities.length} 项（读写属性经 adapter 能力协商）` : "能力 0 项";
                    return `<div class="b3-card" style="padding:8px 12px;margin-bottom:6px">` +
                        `<div><b>${esc(m.displayName)}</b> <span style="color:var(--b3-theme-on-surface);font-size:11px">${m.pluginId} · ${maturityBadge}</span></div>` +
                        `<div>状态：${status} · 清单 ${m.version ?? "-"} / 实装 ${iv ?? "-"}</div>` +
                        `<div style="color:var(--b3-theme-on-surface)">${esc(m.protocol ?? "协议未定义")} · ${caps}</div>` +
                        `<div style="color:var(--b3-theme-on-surface)">${esc(m.hubIntegration)}${reason ? " · " + reason : ""}</div>` +
                        `</div>`;
                }).join("");
                new Dialog({
                    title: `生态能力目录（清单 v${manifest.version} · 校准 ${manifest.updatedAt ?? "未知"}）`,
                    content: `<div style="padding:12px;font-size:12px">${cards}<div style="margin-top:6px;color:var(--b3-theme-on-surface)">诊断入口：本页「导出诊断包」/ 仓库 tools（verify:bg）</div></div>`,
                    width: "620px",
                });
            } catch (e) {
                showMessage(`读取失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row(secDiag, "生态", ecoBtn, "能力目录视图：状态/版本对照/缺失原因/入口（L471）");

        // —— 关于（常显 + 帮助链接，超出原型「帮助入口」要求）——
        const about = document.createElement("div");
        about.className = "b3-label";
        about.style.fontSize = "12px";
        about.textContent = `小驴快门 v${PLUGIN_VERSION} · 协议 v1 · 小驴生态联动中枢 + 外部网关。`
            + `数据流向与隐私边界见 PRIVACY.md（本插件不外传任何数据）。`;
        root.appendChild(about);
        // L503：全局恢复默认（保留 deviceName——device 路由身份属自动管理字段，重置不应改变本机身份）
        const resetBtn = document.createElement("button");
        resetBtn.className = "b3-button b3-button--outline";
        resetBtn.textContent = "恢复默认设置";
        resetBtn.onclick = () => {
            confirm(
                "小驴快门 · 恢复默认设置",
                "将恢复全部设置为出厂默认：桥/广播关闭、轮询 500ms、黑名单与允许名单还原、确认门控开启；桥若在运行会停止。设备名保留（本机身份不变）。当前自定义值不可找回。",
                async () => {
                    const deviceName = this.settings.deviceName;
                    this.settings = { ...DEFAULT_SETTINGS, deviceName };
                    this.store.settings = this.settings;
                    await this.store.saveSettings();
                    this.stopBridge();
                    this.stopEventBridge();
                    if (this.broadcastSub?.running) await this.broadcastSub.stop();
                    dialog.destroy();
                    this.openSettingPanel(); // 重开面板反映默认值
                    showMessage("已恢复默认设置（设备名保留）", 3000);
                },
                () => { },
            );
        };
        const resetRow = document.createElement("div");
        resetRow.style.marginTop = "4px";
        resetRow.appendChild(resetBtn);
        root.appendChild(resetRow);
        const help = document.createElement("div");
        help.style.fontSize = "12px";
        help.style.marginTop = "4px";
        help.innerHTML = "帮助：" +
            `<a class="b3-link" target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md">上手指南</a> · ` +
            `<a class="b3-link" target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/FAQ.md">故障排查 FAQ</a> · ` +
            `<a class="b3-link" target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/PRIVACY.md">隐私说明</a> · ` +
            `<a class="b3-link" target="_blank" href="https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/api.md">op 契约</a>`;
        root.appendChild(help);

        // 键盘可达：打开后焦点落首控件（原型「焦点落首控件」）
        enabledInput.focus();
    }
}
