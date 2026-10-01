/**
 * 桥服务：一次 poll tick 的完整实现（读取→解析→执行→写回）。
 * 依赖全部注入，便于单测；DOM/思源仅经由注入的桥实例与 kernelApi 触达。
 */
import { BridgeCommand, BridgeReceipt, QuickGateSettings, AuditEntry } from "../types/bridge";
import { parseLine, splitLines, isExpired } from "./envelope";
import { compactCommands } from "./queue";
import { appendReceipt } from "./results";
import { BridgeStore } from "./store";
import { KernelApi } from "./kernelApi";
import { RegistryProbeResult, runCommand } from "./registry";
import {
    checkinItems, checkinRecord, checkinSummary,
    contactsSearch, contactsEnsure, contactsInteraction,
    BridgeResult,
} from "./adapters";

export interface EditorContextResult {
    docId: string | null;
    rootTitle: string | null;
    blockId: string | null;
    selectedText: string | null;
}

/** 生态清单（src/assets/ecosystem-manifests.json 的形状） */
export interface EcosystemManifest {
    version: number;
    plugins: Array<{
        pluginId: string;
        displayName: string;
        maturity: "stable" | "design" | "unlocated";
        version: string | null;
        protocol: string | null;
        capabilities: string[];
        hubIntegration: string;
    }>;
}

export interface BridgeServiceDeps {
    api: KernelApi;
    store: BridgeStore;
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
    /** 日记笔记本/收集箱自动发现（spike⑧ 校准前 best-effort） */
    discoverConfig: () => Promise<{ diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] }>;
    /** 公开桥获取器 */
    getCheckin: () => unknown;
    getContacts: () => unknown;
    now?: () => number;
}

export class BridgeService {
    constructor(private deps: BridgeServiceDeps) {}

    private paths() {
        const base = this.deps.settings().bridgeBasePath;
        return {
            commands: `${base}/commands.ndjson`,
            results: `${base}/results.ndjson`,
        };
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

        const raw = await this.deps.api.getFileText(commands);
        if (raw === null || raw.trim() === "") return { executed: 0, receipts: 0 };

        const now = this.deps.now?.() ?? Date.now();
        const receipts: BridgeReceipt[] = [];
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
            const t0 = now;
            let result: BridgeResult;
            try {
                result = await this.dispatch(cmd);
                executions += 1;
            } catch (e) {
                result = { status: "failed", data: null, message: `执行异常：${e instanceof Error ? e.message : String(e)}` };
            }
            if (cmd.reply !== false) {
                receipts.push(this.makeReceipt({
                    id: cmd.id, op: cmd.op, status: result.status, data: result.data,
                    message: result.message, elapsedMs: (this.deps.now?.() ?? Date.now()) - t0,
                }));
            }
            this.deps.store.markProcessed(cmd.id, this.deps.now?.() ?? Date.now());
        }

        if (receipts.length > 0) {
            let resultsText = (await this.deps.api.getFileText(results)) ?? "";
            for (const r of receipts) {
                resultsText = appendReceipt(resultsText, r);
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

    private reject(message: string): BridgeResult {
        return { status: "rejected", data: null, message };
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
                const hits = probe.plugins
                    .filter((p) => !s.blacklist.includes(p.name))
                    .flatMap((p) => p.commands)
                    .filter((c) => !kw || c.title.toLowerCase().includes(kw) || c.id.toLowerCase().includes(kw) || c.plugin.toLowerCase().includes(kw))
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
                    return { status: "recorded", data: { ok: r.ok }, message: r.message };
                }
                return { status: r.status, data: null, message: r.message };
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
                const manifest = (await import("../assets/ecosystem-manifests.json")).default as unknown as EcosystemManifest;
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
                const d = await this.deps.discoverConfig();
                return { status: "recorded", data: d, message: d.diaryNotebookId ? "已发现日记笔记本" : "未发现日记笔记本（回退手填）" };
            }

            // ---- 设计态契约（M2 实现，先返回结构化 unsupported）----
            case "events.list":
            case "events.subscribe":
            case "workflow.plan":
            case "workflow.execute":
                return { status: "unsupported", data: null, message: `${cmd.op} 为设计态契约（docs/09 R1），将在 M2 实现` };

            // ---- 高级透传（默认关）----
            case "plugin.api": {
                if (!s.rawApiEnabled) return { status: "unsupported", data: null, message: "plugin.api 未开启（设置中手动启用）" };
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const method = typeof a.method === "string" ? a.method : "";
                if (!plugin || !method) return this.reject("plugin/method 缺失");
                if (!s.rawApiAllowlist.includes(plugin)) return this.reject(`插件 ${plugin} 不在 plugin.api 允许名单`);
                const w = globalThis as unknown as { window?: { [k: string]: unknown } };
                const bridge = (w.window?.[plugin === "siyuan-checkin" ? "siyuanCheckin" : plugin === "siyuan-contacts" ? "LvContacts" : ""] as Record<string, unknown>) ?? null;
                const fn = bridge && typeof (bridge as Record<string, unknown>)[method] === "function" ? (bridge as Record<string, unknown>)[method] as () => unknown : undefined;
                if (!fn) return { status: "unsupported", data: null, message: "桥方法不存在" };
                try {
                    const data = await fn.apply(bridge, Array.isArray(a.args) ? a.args : []);
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
