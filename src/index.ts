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
import { SingleFlightPoller } from "./services/poller";
import { BroadcastSubscriber, BROADCAST_CHANNEL } from "./services/broadcast";
import { probeCommandRegistry } from "./services/registry";
import { appendEventLine, normalizeCheckinEvent, normalizeCheckinEventDeleted } from "./services/eventbridge";
import { HubEvent } from "./services/events";
import { DEFAULT_SETTINGS, QuickGateSettings, AuditEntry } from "./types/bridge";

const PLUGIN_NAME = "siyuan-quickgate";
const PLUGIN_VERSION = "0.6.1";
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
    private isMobile: boolean;
    private store = new BridgeStore(this.asDataIO());
    private kernelApi = new KernelApi();
    private poller?: SingleFlightPoller;
    private activeService?: BridgeService;
    private settings: QuickGateSettings = { ...DEFAULT_SETTINGS };
    private auditLog: AuditEntry[] = [];

    async onload() {
        this.isMobile = getFrontend() === "mobile" || getFrontend() === "browser-mobile";
        await this.store.loadAll();
        this.settings = this.store.settings;
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
    }

    onLayoutReady() {
        // 轮询已在 onload 启动；为布局相关扩展留位
    }

    onunload() {
        // 优雅停机：单飞循环在当前 tick 结束后退出，不撕正在进行的写；广播订阅同步停止
        this.poller?.stop();
        this.poller = undefined;
        void this.broadcastSub?.stop();
        this.broadcastSub = undefined;
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

    /** 批量物化：一次读改写追加多行；空列表不动文件 */
    private async materializeHubEvents(events: HubEvent[] | null) {
        if (!events || events.length === 0) return;
        try {
            const path = "/storage/petal/siyuan-checkin/bridge/events.ndjson";
            const old = (await this.kernelApi.getFileText(path)) ?? "";
            let text = old;
            for (const e of events) {
                text = appendEventLine(text, e);
            }
            await this.kernelApi.putFileText(path, text);
        } catch (err) {
            console.warn(`[${PLUGIN_NAME}] 事件物化失败：`, err);
        }
    }

    uninstall() {
        // 宿主卸载钩子：提示桥目录随 petal 数据删除（TODO M2：提供导出审计入口）
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
        // TODO(M1.5)：移动端默认关桥，设置页显式打开后带 :mobile-on 后缀
        return this.isMobile && !this.settings.deviceName.endsWith(":mobile-on");
    }

    private asDataIO(): DataIO {
        return {
            load: (file) => this.loadData(file),
            save: (file, data) => this.saveData(file, data),
        };
    }

    private startBridge() {
        if (this.poller?.isRunning) return;
        const service = new BridgeService(this.deps());
        this.activeService = service;
        this.poller = new SingleFlightPoller({
            intervalMs: this.settings.pollMs,
            backoffMaxMs: this.settings.backoffMaxMs,
            tick: () => service.tick(),
            shouldRun: () => this.settings.bridgeEnabled,
        });
        this.poller.start();
        // v1.5 广播快路径（独立开关，默认关）：SSE 订阅 qg-cmd 频道，毫秒级命令通道
        if (this.settings.broadcastEnabled && !this.broadcastSub?.running) {
            this.broadcastSub = new BroadcastSubscriber({
                enabled: () => this.settings.bridgeEnabled && this.settings.broadcastEnabled,
                onCommand: (cmd) => service.executeAndRecord(cmd).then(() => {}),
                log: (msg) => console.warn(`[${PLUGIN_NAME}] ${msg}`),
            });
            this.broadcastSub.start();
            console.info(`[${PLUGIN_NAME}] 广播快路径已启动（频道 ${BROADCAST_CHANNEL}）`);
        }
        console.info(`[${PLUGIN_NAME}] 桥已启动，间隔 ${this.settings.pollMs}ms`);
    }

    private async stopBridge() {
        this.poller?.stop();
        this.poller = undefined;
        if (this.broadcastSub?.running) {
            await this.broadcastSub.stop();
            console.info(`[${PLUGIN_NAME}] 广播快路径已停止`);
        }
    }

    /** 确认对话框：先尝试激活思源窗口（08-O10），30s 超时=拒绝 */
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

    /** 编辑器上下文（M0⑦ 待实证，尽力而为永不抛错） */
    private readEditorContext(): EditorContextResult | null {
        try {
            const activeProtyle = document.querySelector(".layout__center .protyle:not(.fn__none)") as HTMLElement | null;
            if (!activeProtyle) return null;
            const docId = activeProtyle.getAttribute("data-doc-id")
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
            const rootTitle = (activeProtyle.querySelector(".protyle-title") as HTMLElement | null)?.textContent?.trim() ?? null;
            return { docId, rootTitle, blockId, selectedText };
        } catch {
            return null; // 降级：不阻断
        }
    }

    /** 今日日记状态：只探测不创建（对齐雷切语义）；getConf 字段名 M0⑧ 实证前用标题日期法 */
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
    private async discoverConfig(): Promise<{ diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] }> {
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
        return { diaryNotebookId, inboxDocId, notes };
    }

    private openSettingPanel() {
        const dialog = new Dialog({
            title: "小驴快门 · 设置",
            content: `<div class="b3-dialog__content" id="qg-settings" style="padding:12px"></div>`,
            width: "560px",
            height: "auto",
        });
        const root = dialog.element.querySelector("#qg-settings") as HTMLElement;
        const row = (label: string, ctrl: HTMLElement) => {
            const div = document.createElement("div");
            div.className = "fn__flex b3-label";
            const l = document.createElement("div");
            l.textContent = label;
            l.style.flex = "1";
            l.style.paddingRight = "12px";
            div.appendChild(l);
            div.appendChild(ctrl);
            root.appendChild(div);
        };

        const enabledInput = document.createElement("input");
        enabledInput.type = "checkbox";
        enabledInput.className = "b3-switch";
        enabledInput.checked = this.settings.bridgeEnabled;
        enabledInput.onchange = async () => {
            this.settings.bridgeEnabled = enabledInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
            if (this.settings.bridgeEnabled && !this.isMobileGuard()) this.startBridge(); else this.stopBridge();
            showMessage(`外部命令桥已${this.settings.bridgeEnabled ? "开启" : "关闭"}`, 3000);
        };
        row("外部命令桥（默认关；开启后外部程序可发命令）", enabledInput);

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
            showMessage(`广播快路径已${this.settings.broadcastEnabled ? "开启（毫秒级命令通道 qg-cmd）" : "关闭"}`, 3000);
        };
        row("广播快路径 v1.5（默认关；需先开桥；postMessage→qg-cmd 频道毫秒级执行）", bcInput);

        const pollInput = document.createElement("input");
        pollInput.type = "number";
        pollInput.className = "b3-text-field fn__size200";
        pollInput.value = String(this.settings.pollMs);
        pollInput.onchange = async () => {
            const v = parseInt(pollInput.value, 10);
            if (v >= 200 && v <= 60000) {
                this.settings.pollMs = v;
                this.store.settings = this.settings;
                await this.store.saveSettings();
            }
        };
        row("轮询间隔（ms，200~60000）", pollInput);

        const confirmInput = document.createElement("input");
        confirmInput.type = "checkbox";
        confirmInput.className = "b3-switch";
        confirmInput.checked = this.settings.confirmExec;
        confirmInput.onchange = async () => {
            this.settings.confirmExec = confirmInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
        };
        row("命令执行前确认（默认开，30 秒超时拒绝）", confirmInput);

        const rawInput = document.createElement("input");
        rawInput.type = "checkbox";
        rawInput.className = "b3-switch";
        rawInput.checked = this.settings.rawApiEnabled;
        rawInput.onchange = async () => {
            this.settings.rawApiEnabled = rawInput.checked;
            this.store.settings = this.settings;
            await this.store.saveSettings();
        };
        row("plugin.api 高级透传（默认关）", rawInput);

        const queueBtn = document.createElement("button");
        queueBtn.className = "b3-button b3-button--outline";
        queueBtn.textContent = "队列状态";
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
        row("可观测性（R2）", queueBtn);

        const clearBtn = document.createElement("button");
        clearBtn.className = "b3-button b3-button--outline";
        clearBtn.textContent = "清空命令队列";
        clearBtn.onclick = async () => {
            confirm("小驴快门", "清空 commands 与 results 桥文件，并重置处理台账？未消费命令将全部丢弃。", async () => {
                try {
                    const base = this.settings.bridgeBasePath;
                    await this.kernelApi.putFileText(`${base}/commands.ndjson`, "");
                    await this.kernelApi.putFileText(`${base}/results.ndjson`, "");
                    this.store.processed = { schemaVersion: 1, processed: {} };
                    await this.store.saveProcessed();
                    showMessage("命令队列已清空", 3000);
                } catch (e) {
                    showMessage(`清空失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
                }
            }, () => {});
        };
        row("排障", clearBtn);

        const auditBtn = document.createElement("button");
        auditBtn.className = "b3-button b3-button--outline";
        auditBtn.textContent = "查看审计（最近 20 条）";
        auditBtn.onclick = () => {
            const lines = this.auditLog.slice(-20)
                .map((a) => `${a.time} ${a.plugin}/${a.command} → ${a.status} (${a.elapsedMs}ms)`)
                .join("\n") || "（暂无）";
            new Dialog({
                title: "审计日志",
                content: `<div class="b3-typography" style="padding:12px;white-space:pre-wrap;font-size:12px">${lines.replace(/</g, "&lt;")}</div>`,
                width: "640px",
            });
        };
        row("审计日志", auditBtn);

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
        row("最近回执", receiptBtn);

        const blacklistInput = document.createElement("textarea");
        blacklistInput.className = "b3-text-field fn__block";
        blacklistInput.rows = 2;
        blacklistInput.value = this.settings.blacklist.join(", ");
        blacklistInput.onchange = async () => {
            this.settings.blacklist = blacklistInput.value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
            this.store.settings = this.settings;
            await this.store.saveSettings();
        };
        row("插件黑名单（逗号分隔，不暴露其命令）", blacklistInput);

        const diagBtn = document.createElement("button");
        diagBtn.className = "b3-button b3-button--outline";
        diagBtn.textContent = "导出诊断包（到剪贴板）";
        diagBtn.onclick = async () => {
            try {
                const service = new BridgeService(this.deps());
                const mem = memDiagnostics(this.settings, this.auditLog, service);
                await navigator.clipboard.writeText(JSON.stringify(mem, null, 2));
                showMessage("诊断包已复制到剪贴板（脱敏）", 3000);
            } catch (e) {
                showMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row("诊断", diagBtn);

        const ecoBtn = document.createElement("button");
        ecoBtn.className = "b3-button b3-button--outline";
        ecoBtn.textContent = "生态清单版本";
        ecoBtn.onclick = async () => {
            try {
                const manifest = (await import("./assets/ecosystem-manifests.json")).default as unknown as EcosystemManifest & { updatedAt?: string };
                let installed: Array<Record<string, unknown>> = [];
                try {
                    installed = await this.kernelApi.post<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: getFrontend() });
                } catch { /* 内核不可达 → 只展示 manifest 口径 */ }
                const instMap = new Map(installed.map((p) => [String(p.name), p]));
                const lines = manifest.plugins.map((m) => {
                    const inst = instMap.get(m.pluginId) as { version?: unknown } | undefined;
                    const iv = typeof inst?.version === "string" ? inst.version : "未安装";
                    const stale = typeof inst?.version === "string" && m.version && inst.version !== m.version ? "（与清单不一致，可校准）" : "";
                    return `${m.displayName}：清单 ${m.version ?? "-"} · 实装 ${iv}${stale} · ${m.maturity}`;
                });
                const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
                new Dialog({
                    title: `生态清单（校准 ${manifest.updatedAt ?? "未知"}）`,
                    content: `<div class="b3-typography" style="padding:12px;white-space:pre-wrap;font-size:12px">${esc(lines.join("\n"))}</div>`,
                    width: "560px",
                });
            } catch (e) {
                showMessage(`读取失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
            }
        };
        row("生态", ecoBtn);

        const about = document.createElement("div");
        about.className = "b3-label";
        about.style.fontSize = "12px";
        about.textContent = `小驴快门 v${PLUGIN_VERSION} · 协议 v1 · 小驴生态联动中枢 + 外部网关。op 契约见仓库 docs/api.md；M0 spike 实证项见 docs/WALKTHROUGH.md。`;
        root.appendChild(about);
    }
}
