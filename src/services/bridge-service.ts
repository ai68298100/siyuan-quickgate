/**
 * 桥服务：一次 poll tick 的完整实现（读取→解析→执行→写回）。
 * 依赖全部注入，便于单测；DOM/思源仅经由注入的桥实例与 kernelApi 触达。
 */
import { BridgeCommand, BridgeReceipt, QuickGateSettings, AuditEntry, BridgeStats } from "../types/bridge";
import manifestJson from "../assets/ecosystem-manifests.json";
import { parseLine, splitLines, isExpired } from "./envelope";
import { compactCommands } from "./queue";
import { appendReceipt } from "./results";
import { BridgeStore } from "./store";
import { KernelApi } from "./kernelApi";
import { FileReadError } from "./file-read";
import { RegistryProbeResult, runCommand } from "./registry";
import { eventWhitelist, pullEvents } from "./events";
import { executePlan, makePlan, WorkflowPlan, WORKFLOW_ALLOWED_OPS, nextWorkflowPlanId } from "./workflow";
import {
    checkinItems, checkinRecord, checkinSummary,
    contactsSearch, contactsEnsure, contactsInteraction,
    BridgeResult,
} from "./adapters";
import { validateTemplatePath, validateTemplateContent } from "./path-guard";
import { expandSearchKeyword } from "./search-alias";
import {
    FavoritesStore, normalizeFavorites, upsertFavorite, removeEntry, pushRecent,
    emptyFavorites, FAVORITES_CAP, RECENT_CAP,
} from "./favorites";

export interface EditorContextResult {
    docId: string | null;
    rootTitle: string | null;
    blockId: string | null;
    selectedText: string | null;
}

/**
 * 写 op 统一审计面（safety-gate-contract §6 差距① · TODO L446）。
 * commands.run 自审计（含目标插件与命令名）不在此列，避免双写；其余写 op 出口统一落 audit。
 * audit 的 command 字段只记 args 键名，不记值（零 PII：note/正文/路径不进审计）。
 */
const WRITE_OP_OWNER: Record<string, string> = {
    "checkin.record": "siyuan-checkin",
    "contacts.ensure": "siyuan-contacts",
    "contacts.interaction": "siyuan-contacts",
    "template.new": "siyuan-quickgate",
    "workflow.execute": "siyuan-quickgate",
    "plugin.api": "siyuan-quickgate",
    "favorites.add": "siyuan-quickgate",
    "favorites.remove": "siyuan-quickgate",
};

/** 事件白名单条目形状（ecosystem-manifest-contract §1；v2 起 since/_eventNamespace 纳入漂移审计） */
export interface EcosystemEvent {
    name: string;
    status: "available" | "observed" | "design";
    idempotency: string;
    payload?: object;
    /** 上游引入版本（v2·漂移审计用） */
    since?: string;
    note?: string;
}

/** 生态清单（src/assets/ecosystem-manifests.json 的形状；v2 新增字段=可缺省，合同 §1） */
export interface EcosystemManifest {
    version: number;
    updatedAt?: string;
    note?: string;
    plugins: Array<{
        pluginId: string;
        displayName: string;
        maturity: "stable" | "design" | "unlocated";
        version: string | null;
        protocol: string | null;
        capabilities: string[];
        hubIntegration: string;
        /** 插件暴露在 window 上的公开桥全局名（如 siyuanCheckin）；无则缺省 */
        windowBridge?: string;
        /** 快门接入的最低协议 major（如 "v5"）；命令面/未接入插件缺省（v2） */
        minProtocol?: string | null;
        /** 该插件权威的数据域（domain.sub，v2） */
        sourceOfTruth?: string[];
        /** 事件物化载体：none | eventFile | windowEvent（v2） */
        ingestion?: "none" | "eventFile" | "windowEvent";
        /** 事件名前缀（如 checkin、lv-cards）；有 events 必填（v2） */
        eventNamespace?: string;
        /** 逐能力参数 schema（v2·planned 逐能力补齐） */
        capabilitySchemas?: Record<string, { required?: string[]; properties?: object }>;
        events?: EcosystemEvent[];
    }>;
}

export interface BridgeServiceDeps {
    api: KernelApi;
    store: BridgeStore;
    /** 上次生命周期统计快照（L554）：构造时播种累计，onunload 回写 */
    initialStats?: BridgeStats;
    settings: () => QuickGateSettings;
    pluginName: string;
    pluginVersion: string;
    deviceName: () => string;
    /** 注册表快照（每次 tick 前刷新） */
    registry: () => RegistryProbeResult;
    /** 思源 confirm 注入（默认实现带 30s 超时，见 index.ts） */
    confirm: (title: string) => Promise<boolean>;
    /** 审计落盘 */
    audit: (entry: AuditEntry) => void;
    /** 编辑器上下文（DOM 相关，注入以便测试） */
    editorContext: () => EditorContextResult | null;
    /** 今日日记状态（只探测不创建） */
    dailyStatus: () => Promise<{ docId: string | null; exists: boolean }>;
    /** 打开文档 */
    openDoc: (id: string) => Promise<void> | void;
    /** 打开设置 */
    openSetting: () => void;
    /** petal/loadPetals（已装插件表） */
    loadPetals: () => Promise<Array<Record<string, unknown>>>;
    /** 业务执行可观测上限 ms（缺省 15000；commands.run 不受此限） */
    execTimeoutMs?: () => number;
    /** 日记笔记本/收集箱自动发现（与内核通道同口径：约定名 SQL 根文档发现；args 透传 inboxName/createInboxIfMissing） */
    discoverConfig: (args?: { inboxName?: unknown; createInboxIfMissing?: unknown }) => Promise<{ diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] }>;
    /** 公开桥获取器 */
    getCheckin: () => unknown;
    getContacts: () => unknown;
    now?: () => number;
}

export class BridgeService {
    /** workflow.plan 一次性计划池（内存即可：短生命周期，5 分钟过期） */
    private plans = new Map<string, WorkflowPlan>();

    /** 累计统计（L554：由 deps.initialStats 播种跨重启快照，onunload 回写 bridge-stats.json） */
    readonly stats: BridgeStats = {
        /** 实际执行过的命令数（不含跳过/坏行/过期） */
        commands: 0,
        ok: 0,
        rejected: 0,
        failed: 0,
        expired: 0,
        /** 执行中途中断的假死回收数（L655 unknown 终态） */
        unknown: 0,
        /** 执行耗时累计 ms（与 commands 对应，均值=totalDispatchMs/commands） */
        totalDispatchMs: 0,
        /** 最近一次读到非空命令文件的时间（ms；空转不刷新） */
        lastActivityAt: null,
    };

    constructor(private deps: BridgeServiceDeps) {
        if (deps.initialStats) Object.assign(this.stats, deps.initialStats);
    }

    private paths() {
        const base = this.deps.settings().bridgeBasePath;
        return {
            commands: `${base}/commands.ndjson`,
            results: `${base}/results.ndjson`,
        };
    }

    /** 收藏/最近使用载体（快门自身存储根，非桥载体；L474） */
    private favoritesPath() {
        return `/storage/petal/${this.deps.pluginName}/favorites.json`;
    }

    private async loadFavorites(): Promise<FavoritesStore> {
        try {
            const raw = await this.deps.api.getFileText(this.favoritesPath());
            return raw ? normalizeFavorites(JSON.parse(raw)) : emptyFavorites();
        } catch (e) {
            // L652：鉴权/不可达等真异常必须透出（failed 回执带原因），只有缺文件/坏 JSON 才回退空收藏
            if (e instanceof FileReadError) throw e;
            return emptyFavorites();
        }
    }

    private async saveFavorites(store: FavoritesStore): Promise<void> {
        const text = JSON.stringify({ schemaVersion: 1, favorites: store.favorites.slice(0, FAVORITES_CAP), recent: store.recent.slice(0, RECENT_CAP) }, null, 2);
        await this.deps.api.putFileText(this.favoritesPath(), text);
    }

    /** 处理过的 id 集合（含本次新增） */
    private processedSet(): Set<string> {
        return new Set(Object.keys(this.deps.store.processed.processed));
    }

    /** 一次完整轮询。抛错由轮询器计为失败退避。 */
    async tick(): Promise<{ executed: number; receipts: number }> {
        const s = this.deps.settings();
        if (!s.bridgeEnabled) return { executed: 0, receipts: 0 };
        const { commands, results } = this.paths();

        // L655 假死扫描（在空队列早退之前）：崩溃残留的 pending → unknown 回执一次性补发
        const receipts: BridgeReceipt[] = [];
        const stale = this.deps.store.takeStalePending(this.deps.now?.() ?? Date.now());
        for (const { id, entry } of stale) {
            this.stats.unknown += 1;
            receipts.push(this.makeReceipt({
                id, op: entry.op ?? "(unknown)", status: "unknown", data: null, elapsedMs: 0,
                message: "执行中途中断（崩溃/重启），最终状态未知——不自动重试。处理路径：只读 op 可换新 id 重发；写 op 请先人工核对目标；可按 id 查询历史回执；确认放弃则忽略本条。",
            }));
        }

        const raw = await this.deps.api.getFileText(commands);
        if (raw === null || raw.trim() === "") {
            if (receipts.length > 0) {
                let t = (await this.deps.api.getFileText(results)) ?? "";
                for (const r of receipts) t = appendReceipt(t, r, { retentionDays: this.deps.settings().retentionDays });
                await this.deps.api.putFileText(results, t);
                await this.deps.store.saveProcessed().catch(() => {});
            }
            return { executed: 0, receipts: receipts.length };
        }
        this.stats.lastActivityAt = this.deps.now?.() ?? Date.now();

        const now = this.deps.now?.() ?? Date.now();
        const toProcess: BridgeCommand[] = [];
        let executions = 0;

        for (const line of splitLines(raw)) {
            const parsed = parseLine(line, 0);
            if (parsed.kind === "empty") continue;
            if (parsed.kind === "bad") {
                const fid = `bad-${parsed.fingerprint}`;
                if (!this.deps.store.isProcessed(fid)) {
                    receipts.push(this.makeReceipt({
                        id: fid, op: "(bad-line)", status: "rejected",
                        data: null, message: `第 ${parsed.line + 1} 行：${parsed.reason}`, elapsedMs: 0,
                    }));
                    this.deps.store.markProcessed(fid, now); // 只回执一次，防每轮重复
                }
                continue;
            }
            const cmd = parsed.command;
            if (this.deps.store.isProcessed(cmd.id)) continue; // 复活行：静默跳过（已有回执）
            if (cmd.device && cmd.device !== this.deps.deviceName()) continue; // 非目标设备：不消费不回执
            if (isExpired(cmd, now)) {
                this.stats.expired += 1;
                if (cmd.reply !== false) {
                    receipts.push(this.makeReceipt({
                        id: cmd.id, op: cmd.op, status: "expired", data: null,
                        message: "命令已过期（TTL 超时未消费）", elapsedMs: 0,
                    }));
                }
                this.deps.store.markProcessed(cmd.id, now);
                continue;
            }
            toProcess.push(cmd);
        }

        for (const cmd of toProcess) {
            // 预留语义（v0.6.0 + L655 状态机）：pending 立即落盘——双通道不重复执行同一 id，
            // 崩溃残留的 pending 由假死扫描发 unknown 回执（不重放写操作）
            if (!(await this.deps.store.reserve(cmd.id, this.deps.now?.() ?? Date.now(), cmd.op))) continue;
            const t0 = this.deps.now?.() ?? Date.now(); // 预留后取时：elapsed 只含本条命令
            let result: BridgeResult;
            try {
                result = await this.dispatchWithTimeout(cmd);
                executions += 1;
            } catch (e) {
                result = { status: "failed", data: null, message: `执行异常：${e instanceof Error ? e.message : String(e)}` };
            }
            const elapsed = (this.deps.now?.() ?? Date.now()) - t0;
            this.stats.commands += 1;
            this.stats.totalDispatchMs += elapsed;
            if (result.status === "recorded") this.stats.ok += 1;
            else if (result.status === "rejected") this.stats.rejected += 1;
            else this.stats.failed += 1;
            this.auditWriteOp(cmd, result.status, elapsed);
            this.deps.store.markDone(cmd.id, this.deps.now?.() ?? Date.now(), result.status);
            if (cmd.reply !== false) {
                receipts.push(this.makeReceipt({
                    id: cmd.id, op: cmd.op, status: result.status, data: result.data,
                    message: result.message, elapsedMs: elapsed,
                }));
            }
        }

        if (receipts.length > 0) {
            let resultsText = (await this.deps.api.getFileText(results)) ?? "";
            for (const r of receipts) {
                resultsText = appendReceipt(resultsText, r, { retentionDays: this.deps.settings().retentionDays });
            }
            await this.deps.api.putFileText(results, resultsText);
        }

        // 压缩：仅移除已处理 id 的行（坏行已回执指纹 id，一并移除）；并发追加的新行原样保留（阻断项1 修正）
        const processed = this.processedSet();
        const compacted = compactCommands(raw, processed, { dropBadLines: true });
        if (compacted !== raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "")) {
            await this.deps.api.putFileText(commands, compacted.endsWith("\n") ? compacted : compacted + "\n");
        }

        await this.deps.store.saveProcessed();
        this.maybeSaveStats(); // L554
        return { executed: executions, receipts: receipts.length };
    }

    private makeReceipt(r: Omit<BridgeReceipt, "v" | "finishedAt" | "plugin">): BridgeReceipt {
        return {
            v: 1,
            finishedAt: new Date().toISOString(),
            plugin: this.deps.pluginName,
            ...r,
        };
    }

    /**
     * v1.5 广播快路径的公共执行入口：设备路由/过期/预留→执行→回执。
     * 预留语义（v0.6.0）：同步检查+markProcessed 后才 await——JS 单线程下两条命令通道
     * （NDJSON tick 与广播 SSE）不会重复执行同一 id；先到者执行，后到者静默跳过。
     */
    async executeAndRecord(cmd: BridgeCommand): Promise<{ executed: boolean; receipt?: BridgeReceipt }> {
        const now = this.deps.now?.() ?? Date.now();
        if (cmd.device && cmd.device !== this.deps.deviceName()) return { executed: false }; // 非目标设备
        if (this.deps.store.isProcessed(cmd.id)) return { executed: false };
        if (isExpired(cmd, now)) {
            this.deps.store.markProcessed(cmd.id, now); // 过期同样入台账：同一信封重放（SSE 重投/NDJSON 补扫）不得重复回执或重复计数
            this.stats.expired += 1;
            let expiredReceipt: BridgeReceipt | undefined;
            if (cmd.reply !== false) {
                expiredReceipt = this.makeReceipt({
                    id: cmd.id, op: cmd.op, status: "expired", data: null,
                    message: "命令已过期（TTL 超时未消费）", elapsedMs: 0,
                });
                try {
                    const resultsPath = this.paths().results;
                    const old = (await this.deps.api.getFileText(resultsPath)) ?? "";
                    await this.deps.api.putFileText(resultsPath, appendReceipt(old, expiredReceipt, { retentionDays: this.deps.settings().retentionDays }));
                } catch { /* 忽略 */ }
            }
            return { executed: false, receipt: expiredReceipt };
        }
        if (!(await this.deps.store.reserve(cmd.id, now, cmd.op))) return { executed: false }; // L655：pending 落盘预约，防双通道竞态双执行
        const t0 = this.deps.now?.() ?? Date.now();
        let result: BridgeResult;
        try {
            result = await this.dispatchWithTimeout(cmd);
        } catch (e) {
            result = { status: "failed", data: null, message: `执行异常：${e instanceof Error ? e.message : String(e)}` };
        }
        const elapsed = (this.deps.now?.() ?? Date.now()) - t0;
        this.stats.commands += 1;
        this.stats.totalDispatchMs += elapsed;
        if (result.status === "recorded") this.stats.ok += 1;
        else if (result.status === "rejected") this.stats.rejected += 1;
        else this.stats.failed += 1;
        this.auditWriteOp(cmd, result.status, elapsed);
        this.deps.store.markDone(cmd.id, this.deps.now?.() ?? Date.now(), result.status);

        let receipt: BridgeReceipt | undefined;
        if (cmd.reply !== false) {
            receipt = this.makeReceipt({
                id: cmd.id, op: cmd.op, status: result.status, data: result.data,
                message: result.message, elapsedMs: elapsed,
            });
            try {
                const resultsPath = this.paths().results;
                const old = (await this.deps.api.getFileText(resultsPath)) ?? "";
                await this.deps.api.putFileText(resultsPath, appendReceipt(old, receipt));
            } catch { /* 回执写失败不阻断（台账已记账，调用方可按原 id 重查） */ }
        }
        await this.deps.store.saveProcessed().catch(() => {});
        return { executed: true, receipt };
    }

    /**
     * 业务执行可观测上限（阻断项3 补充）：15s 未返回即回执 failed 并放行轮询，
     * 底层操作继续运行（不假设可取消）；迟到完成仅记日志，不再补发回执。
     * commands.run 的确认窗口（30s）走确认流程自身语义，不受此上限截断。
     */
    lateCompletions = 0;

    /** L554：统计快照节落盘节流（30s；onunload 兜底全量回写） */
    private lastStatsSaveAt = 0;

    private maybeSaveStats(): void {
        const now = this.deps.now?.() ?? Date.now();
        if (now - this.lastStatsSaveAt < 30_000) return;
        this.lastStatsSaveAt = now;
        void this.deps.store.saveStats(this.stats).catch(() => {});
    }

    private dispatchWithTimeout(cmd: BridgeCommand): Promise<BridgeResult> {
        // commands.run（确认窗口自管）/ workflow.execute（单步上限自管）：内部已有界，
        // 外层不再叠加同额超时——否则外层先到会把整个 envelope 判 failed 而工作流仍在底层迟到执行
        if (cmd.op === "commands.run" || cmd.op === "workflow.execute") return this.dispatch(cmd);
        const EXEC_TIMEOUT_MS = this.deps.execTimeoutMs?.() ?? 15000;
        return new Promise<BridgeResult>((resolve) => {
            let settled = false;
            const inFlight = this.dispatch(cmd); // 只派发一次；超时后仅观测迟到结果，不得再次调用同一写操作
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve({ status: "failed", data: null, message: `执行超过 ${Math.round(EXEC_TIMEOUT_MS / 100) / 10}s 未返回，已标记失败（若稍后完成，副作用已发生，见日志）` });
                inFlight
                    .then(() => { this.lateCompletions += 1; console.warn(`[${this.deps.pluginName}] 迟到完成：${cmd.id} ${cmd.op}`); })
                    .catch(() => { this.lateCompletions += 1; });
            }, EXEC_TIMEOUT_MS);
            inFlight
                .then((r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } })
                .catch((e) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ status: "failed", data: null, message: `执行异常：${e instanceof Error ? e.message : String(e)}` }); } });
        });
    }

    private reject(message: string): BridgeResult {
        return { status: "rejected", data: null, message };
    }

    /** 写 op 出口统一审计（NDJSON tick 与广播快路径共用；rejected/unsupported 也留痕） */
    private auditWriteOp(cmd: BridgeCommand, status: string, elapsedMs: number): void {
        const owner = WRITE_OP_OWNER[cmd.op];
        if (!owner) return;
        this.deps.audit({
            time: new Date().toISOString(),
            plugin: owner,
            command: `${cmd.op} args(${Object.keys(cmd.args ?? {}).join(",")})`,
            status,
            elapsedMs,
        });
    }

    private async dispatch(cmd: BridgeCommand): Promise<BridgeResult> {
        const a = cmd.args ?? {};
        const s = this.deps.settings();
        switch (cmd.op) {
            // ---- 通用协商 ----
            case "bridge.ping":
                return {
                    status: "recorded",
                    data: {
                        protocol: 1, plugin: this.deps.pluginName, version: this.deps.pluginVersion,
                        pollMs: s.pollMs, bridgeEnabled: s.bridgeEnabled,
                    },
                    message: "pong",
                };

            // ---- 命令注册表（commands.*）----
            case "commands.list": {
                const probe = this.deps.registry();
                const pluginFilter = typeof a.plugin === "string" ? a.plugin : undefined;
                const plugins = probe.plugins
                    .filter((p) => !s.blacklist.includes(p.name))
                    .filter((p) => !pluginFilter || p.name === pluginFilter)
                    .map((p) => ({ name: p.name, displayName: p.displayName, commands: p.commands.slice(0, 100) }))
                    .slice(0, 100);
                return { status: "recorded", data: { plugins, source: probe.source }, message: `共 ${plugins.length} 个插件` };
            }
            case "commands.search": {
                const kw = typeof a.keyword === "string" ? a.keyword.toLowerCase() : "";
                const probe = this.deps.registry();
                const kws = kw ? expandSearchKeyword(kw) : []; // L471：中英/拼音别名扩展，任一命中即算
                const hits = probe.plugins
                    .filter((p) => !s.blacklist.includes(p.name))
                    .flatMap((p) => p.commands)
                    .filter((c) => kws.length === 0 || kws.some((k) => c.title.toLowerCase().includes(k) || c.id.toLowerCase().includes(k) || c.plugin.toLowerCase().includes(k)))
                    .slice(0, 50);
                return { status: "recorded", data: { commands: hits }, message: `命中 ${hits.length} 条` };
            }
            case "commands.run": {
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const command = typeof a.command === "string" ? a.command : "";
                if (!plugin || !command) return this.reject("plugin/command 缺失");
                if (s.blacklist.includes(plugin)) return this.reject(`插件 ${plugin} 在黑名单中`);
                const r = await runCommand(this.deps.registry(), plugin, command, {
                    confirmExec: s.confirmExec,
                    confirm: this.deps.confirm,
                });
                this.deps.audit({
                    time: new Date().toISOString(), plugin, command,
                    status: r.status, elapsedMs: r.elapsedMs,
                });
                if (r.status === "recorded") {
                    // L474：成功执行记最近使用（只记 plugin/command/title 元数据，不记参数值）
                    try {
                        const store = await this.loadFavorites();
                        const title = this.deps.registry().plugins.find((p) => p.name === plugin)?.commands.find((c) => c.id === command)?.title ?? command;
                        pushRecent(store, { plugin, command, title });
                        await this.saveFavorites(store);
                    } catch { /* 最近使用失败不阻断命令结果 */ }
                    return { status: "recorded", data: { ok: r.ok }, message: r.message };
                }
                return { status: r.status, data: null, message: r.message };
            }

            // ---- 收藏与最近使用（L474；前端专属，载体=插件存储 favorites.json）----
            case "favorites.list": {
                const store = await this.loadFavorites();
                return { status: "recorded", data: { favorites: store.favorites, recent: store.recent }, message: `收藏 ${store.favorites.length} 条 / 最近 ${store.recent.length} 条` };
            }
            case "favorites.add": {
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const command = typeof a.command === "string" ? a.command : "";
                if (!plugin || !command) return this.reject("plugin/command 缺失");
                const title = typeof a.title === "string" && a.title ? a.title : command;
                const store = await this.loadFavorites();
                upsertFavorite(store, { plugin, command, title, addedAt: "" });
                await this.saveFavorites(store);
                return { status: "recorded", data: { ok: true, favorites: store.favorites.length }, message: `已收藏 ${plugin}/${command}` };
            }
            case "favorites.remove": {
                const scope = a.scope === "recent" || a.scope === "both" ? a.scope : "favorite";
                const store = await this.loadFavorites();
                // L472 清除历史：{scope:"recent"} 不带 plugin/command = 一次清空全部最近使用（隐私清除）
                if (a.clearRecent === true) {
                    const cleared = store.recent.length;
                    store.recent = [];
                    await this.saveFavorites(store);
                    return { status: "recorded", data: { ok: true, removed: cleared }, message: `已清空最近使用 ${cleared} 条` };
                }
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const command = typeof a.command === "string" ? a.command : "";
                if (!plugin || !command) return this.reject("plugin/command 缺失");
                const removed = removeEntry(store, plugin, command, scope);
                await this.saveFavorites(store);
                return { status: "recorded", data: { ok: true, removed }, message: removed > 0 ? `已移除 ${removed} 条` : "未找到匹配条目" };
            }

            // ---- 数据透传（checkin.* / contacts.*）----
            case "checkin.items":
                return await checkinItems(this.deps.getCheckin as () => never, a as { includeArchived?: boolean; limit?: number });
            case "checkin.record":
                return await checkinRecord(this.deps.getCheckin as () => never, a as { itemId?: unknown; value?: unknown; unit?: unknown; note?: unknown; occurredAt?: unknown }, cmd.id);
            case "checkin.summary":
                return await checkinSummary(this.deps.getCheckin as () => never);
            case "contacts.search":
                return await contactsSearch(this.deps.getContacts as () => never, a);
            case "contacts.ensure":
                return await contactsEnsure(this.deps.getContacts as () => never, a);
            case "contacts.interaction":
                return await contactsInteraction(this.deps.getContacts as () => never, a as { names?: unknown; docIds?: unknown; date?: unknown; place?: unknown; note?: unknown }, cmd.id);

            // ---- 便利 op ----
            case "doc.open": {
                const id = typeof a.id === "string" ? a.id : "";
                if (!id) return this.reject("id 缺失");
                await this.deps.openDoc(id);
                return { status: "recorded", data: { ok: true }, message: "已打开" };
            }
            case "daily.status": {
                const st = await this.deps.dailyStatus();
                return { status: "recorded", data: st, message: st.exists ? "今日日记已存在" : "今日日记不存在（未创建）" };
            }
            case "setting.open":
                this.deps.openSetting();
                return { status: "recorded", data: { ok: true }, message: "已打开设置" };
            case "editor.context": {
                const ctx = this.deps.editorContext();
                return { status: "recorded", data: ctx ?? { docId: null, rootTitle: null, blockId: null, selectedText: null }, message: "已读取" };
            }

            // ---- 生态中枢（R1）----
            case "registry.list": {
                let petals: Array<Record<string, unknown>> = [];
                try {
                    petals = await this.deps.loadPetals();
                } catch { /* 内核不可达时也返回 manifest 口径 */ }
                const manifest = manifestJson as EcosystemManifest;
                const enabledMap = new Map<string, unknown>();
                for (const p of petals) {
                    const name = (p as { name?: unknown }).name;
                    if (typeof name === "string") enabledMap.set(name, p);
                }
                const plugins = manifest.plugins.map((m) => {
                    const petal = enabledMap.get(m.pluginId) as { version?: unknown; enabled?: unknown } | undefined;
                    return {
                        pluginId: m.pluginId,
                        displayName: m.displayName,
                        maturity: m.maturity,
                        manifestVersion: m.version,
                        installedVersion: typeof petal?.version === "string" ? petal.version : null,
                        installed: enabledMap.has(m.pluginId),
                        protocol: m.protocol,
                        capabilities: m.capabilities,
                        hubIntegration: m.hubIntegration,
                    };
                });
                return {
                    status: "recorded",
                    data: { manifestVersion: manifest.version, plugins, registrySource: this.deps.registry().source },
                    message: `生态清单 ${plugins.length} 款（stable ${plugins.filter((p) => p.maturity === "stable").length}）`,
                };
            }
            case "diagnostics.report": {
                const raw = await this.deps.api.getFileText(this.paths().commands);
                const probe = this.deps.registry();
                return {
                    status: "recorded",
                    data: {
                        protocol: 1,
                        plugin: this.deps.pluginName,
                        version: this.deps.pluginVersion,
                        bridge: {
                            enabled: s.bridgeEnabled,
                            pollMs: s.pollMs,
                            basePath: s.bridgeBasePath,
                            commandsFileLines: raw === null ? null : splitLines(raw).filter((l) => l.trim() !== "").length,
                        },
                        registry: { source: probe.source, hostPlugins: probe.plugins.length, reason: probe.reason ?? null },
                        confirmExec: s.confirmExec,
                        rawApiEnabled: s.rawApiEnabled,
                        // 不输出 Token/正文/个人路径（docs/09 P1 红线）
                    },
                    message: "诊断快照（脱敏）",
                };
            }
            case "config.discover": {
                const d = await this.deps.discoverConfig({ inboxName: a.inboxName, createInboxIfMissing: a.createInboxIfMissing });
                return { status: "recorded", data: d, message: d.diaryNotebookId ? "已发现日记笔记本" : "未发现日记笔记本（回退手填）" };
            }

            // ---- 模板（内核 renderSprig 渲染，支持 {{}} 语法；路径守卫=safety-gate §7）----
            case "template.new": {
                const notebook = typeof a.notebook === "string" ? a.notebook : "";
                const hpath = typeof a.hpath === "string" ? a.hpath : "";
                if (!notebook || !hpath) return this.reject("notebook/hpath 缺失");
                let content = typeof a.template === "string" ? a.template : "";
                if (!content && typeof a.templatePath === "string") {
                    const guard = validateTemplatePath(a.templatePath);
                    if (!guard.ok) return this.reject(guard.reason);
                    content = (await this.deps.api.getFileText(`/templates/${a.templatePath}`)) ?? "";
                }
                const contentGuard = validateTemplateContent(content);
                if (!contentGuard.ok) return this.reject(contentGuard.reason);
                if (!content) return this.reject("template/templatePath 均为空");
                const rendered = await this.deps.api.post<string>("/api/template/renderSprig", { template: content });
                const docId = await this.deps.api.post<string>("/api/filetree/createDocWithMd", { notebook, path: hpath, markdown: rendered });
                return { status: "recorded", data: { docId }, message: "已从模板创建" };
            }

            // ---- 设计态契约（M2 实现：events 文件载体 + workflow 受控编排）----
            case "events.list": {
                const manifest = manifestJson as EcosystemManifest;
                const wl = eventWhitelist(manifest);
                const events = [...wl.entries()].map(([name, meta]) => ({ name, ...meta }));
                return { status: "recorded", data: { events }, message: `白名单事件 ${events.length} 个` };
            }
            case "events.pull": {
                const manifest = manifestJson as EcosystemManifest;
                const wl = eventWhitelist(manifest);
                const files: string[] = [];
                for (const source of new Set([...wl.values()].map((v) => v.source))) {
                    files.push(`/storage/petal/${source}/bridge/events.ndjson`);
                }
                const texts: Array<{ file: string; text: string }> = [];
                for (const f of files) {
                    const t = await this.deps.api.getFileText(f);
                    if (t) texts.push({ file: f, text: t });
                }
                const events = pullEvents(texts, wl, {
                    names: Array.isArray(a.names) ? a.names.filter((x): x is string => typeof x === "string") : undefined,
                    since: typeof a.since === "string" ? a.since : undefined,
                    limit: typeof a.limit === "number" ? Math.min(a.limit, 200) : undefined,
                });
                return { status: "recorded", data: { events, files }, message: `拉取 ${events.length} 条` };
            }
            case "workflow.plan": {
                const r = makePlan(a.steps, {
                    planId: nextWorkflowPlanId(this.deps.now?.() ?? Date.now()),
                    now: this.deps.now?.() ?? Date.now(),
                    whitelistOp: (op) => WORKFLOW_ALLOWED_OPS.has(op),
                });
                if (r.kind !== "plan") return this.reject(r.message);
                this.plans.set(r.plan.planId, r.plan);
                return { status: "recorded", data: { plan: r.plan }, message: `计划 ${r.plan.steps.length} 步，5 分钟内 execute` };
            }
            case "workflow.execute": {
                const planId = typeof a.planId === "string" ? a.planId : "";
                const plan = this.plans.get(planId);
                this.plans.delete(planId); // 一次性：执行即消费
                // L572（docs/36 §3.1）：取消检查点——每步开始前读 cancel.json
                const cancelPath = `${this.deps.settings().bridgeBasePath}/cancel.json`;
                const r = await executePlan(plan, {
                    confirmAll: async (steps) => {
                        const summary = steps.map((s) => `${s.index + 1}. ${s.op}${s.confirm ? "（写）" : ""}`).join("\n");
                        return this.deps.confirm(`执行工作流（${steps.length} 步）：\n${summary}`);
                    },
                    isCancelled: async () => {
                        try {
                            const raw = await this.deps.api.getFileText(cancelPath);
                            if (!raw) return false;
                            const obj = JSON.parse(raw) as { planId?: string };
                            return obj.planId === planId;
                        } catch { return false; } // 损坏按无请求（docs/36 §4）
                    },
                    runStep: async (step) => {
                        const cmd: BridgeCommand = {
                            v: 1, id: `${planId}-${step.index}`, op: step.op, args: step.args,
                            createdAt: new Date().toISOString(),
                        };
                        // 单步 15s 可观测上限（R69-P1）：挂起步在该步停止并回执 failed，
                        // 不让后续步骤在调用方收到失败后迟到执行；复用 dispatchWithTimeout
                        // 的单次派发保证（超时只观测迟到结果，不二次调用写操作）
                        return await this.dispatchWithTimeout(cmd);
                    },
                });
                if (r.kind !== "done") return this.reject(r.message);
                // L572：用完即删 cancel.json（docs/36 §7 开放问题 1）
                void this.deps.api.putFileText(cancelPath, "").catch(() => {});
                if (r.cancelled) {
                    return {
                        status: "recorded",
                        data: { stopped: "user-cancel", completedSteps: r.steps.map((s) => s.index + 1), done: r.done },
                        message: `用户取消于第 ${(r.stoppedAt ?? 0) + 1} 步前（已完成 ${r.done} 步不回滚）`,
                    };
                }
                return {
                    status: "recorded",
                    data: { done: r.done, stoppedAt: r.stoppedAt, steps: r.steps },
                    message: r.stoppedAt === null ? `全部 ${r.done} 步完成` : `第 ${r.stoppedAt + 1} 步失败停止（已完成 ${r.done} 步不回滚）`,
                };
            }
            case "workflow.cancel": {
                // L572（docs/36）：写取消请求，运行中的 execute 每步开始前检查。
                // 同信封队列内会排在运行中 execute 之后——跨窗口/直写内核 putFile 才是实时通道；
                // 本 op 幂等 recorded（已停止再取消仍 recorded，docs/36 §3.2）。
                const planId = typeof a.planId === "string" ? a.planId : "";
                if (!planId) return this.reject("缺少 planId");
                const cancelPath = `${this.deps.settings().bridgeBasePath}/cancel.json`;
                try {
                    await this.deps.api.putFileText(cancelPath, JSON.stringify({ schemaVersion: 1, planId, requestedBy: "external", requestedAt: new Date().toISOString() }));
                } catch (e) {
                    return this.reject(`取消请求写入失败：${e instanceof Error ? e.message : String(e)}`);
                }
                return { status: "recorded", data: { planId }, message: `取消请求已写入（planId ${planId}）；运行中的计划将在下一开始前停止` };
            }

            // ---- 高级透传（默认关）----
            case "plugin.api": {
                if (!s.rawApiEnabled) return { status: "unsupported", data: null, message: "plugin.api 未开启（设置中手动启用）" };
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const method = typeof a.method === "string" ? a.method : "";
                if (!plugin || !method) return this.reject("plugin/method 缺失");
                if (!s.rawApiAllowlist.includes(plugin)) return this.reject(`插件 ${plugin} 不在 plugin.api 允许名单`);
                const manifest = manifestJson as EcosystemManifest;
                const globalName = manifest.plugins.find((m) => m.pluginId === plugin)?.windowBridge ?? "";
                const w = globalThis as unknown as { window?: { [k: string]: unknown } };
                const bridge = (globalName ? w.window?.[globalName] : null) as Record<string, unknown> | null | undefined;
                // L651：仅允许桥对象**自有属性**——`constructor`/`hasOwnProperty` 等原型链成员不得经透传调用
                const isOwn = !!bridge && Object.prototype.hasOwnProperty.call(bridge, method);
                const fn = bridge && isOwn && typeof (bridge as Record<string, unknown>)[method] === "function" ? (bridge as Record<string, unknown>)[method] as () => unknown : undefined;
                if (!fn) return { status: "unsupported", data: null, message: "桥方法不存在" };
                // args 形状（契约 v0.7.3 钉死）：数组=位置参数原样；对象=作为唯一 options 实参；
                // 其他类型显式拒绝——不得静默丢弃参数后照常调用（未知不得改写为成功）
                let callArgs: unknown[];
                if (Array.isArray(a.args)) callArgs = a.args as unknown[];
                else if (a.args !== undefined && a.args !== null && typeof a.args === "object") callArgs = [a.args];
                else if (a.args === undefined || a.args === null) callArgs = [];
                else return this.reject("args 须为数组（位置参数）或对象（单一 options 实参）");
                try {
                    const data = await fn.apply(bridge, callArgs);
                    return { status: "recorded", data, message: "已透传" };
                } catch (e) {
                    return { status: "failed", data: null, message: `透传异常：${e instanceof Error ? e.message : String(e)}` };
                }
            }

            default:
                return { status: "unsupported", data: null, message: `未知 op：${cmd.op}` };
        }
    }
}
