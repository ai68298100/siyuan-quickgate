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
import { eventWhitelist, pullEvents } from "./events";
import { executePlan, makePlan, WorkflowPlan, WORKFLOW_ALLOWED_OPS } from "./workflow";
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
        /** 插件暴露在 window 上的公开桥全局名（如 siyuanCheckin）；无则缺省 */
        windowBridge?: string;
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
    /** 业务执行可观测上限 ms（缺省 15000；commands.run 不受此限） */
    execTimeoutMs?: () => number;
    /** 日记笔记本/收集箱自动发现（spike⑧ 校准前 best-effort） */
    discoverConfig: () => Promise<{ diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] }>;
    /** 公开桥获取器 */
    getCheckin: () => unknown;
    getContacts: () => unknown;
    now?: () => number;
}

export class BridgeService {
    /** workflow.plan 一次性计划池（内存即可：短生命周期，5 分钟过期） */
    private plans = new Map<string, WorkflowPlan>();

    /** 累计统计（内存态，内核/插件重载归零；设置页与诊断包展示用） */
    readonly stats = {
        /** 实际执行过的命令数（不含跳过/坏行/过期） */
        commands: 0,
        ok: 0,
        rejected: 0,
        failed: 0,
        expired: 0,
        /** 执行耗时累计 ms（与 commands 对应，均值=totalDispatchMs/commands） */
        totalDispatchMs: 0,
        /** 最近一次读到非空命令文件的时间（ms；空转不刷新） */
        lastActivityAt: null as number | null,
    };

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
        this.stats.lastActivityAt = this.deps.now?.() ?? Date.now();

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
            // 预留语义（v0.6.0）：与广播快路径（executeAndRecord）共用"先记账后执行"，
            // 同步 check+mark 原子——双通道（NDJSON tick / 广播 SSE）不重复执行同一 id
            if (this.deps.store.isProcessed(cmd.id)) continue;
            this.deps.store.markProcessed(cmd.id, this.deps.now?.() ?? Date.now());
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
                    await this.deps.api.putFileText(resultsPath, appendReceipt(old, expiredReceipt));
                } catch { /* 忽略 */ }
            }
            return { executed: false, receipt: expiredReceipt };
        }
        this.deps.store.markProcessed(cmd.id, now); // 同步预留，防双通道竞态双执行
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

            // ---- 模板（内核 renderSprig 渲染，支持 {{}} 语法）----
            case "template.new": {
                const notebook = typeof a.notebook === "string" ? a.notebook : "";
                const hpath = typeof a.hpath === "string" ? a.hpath : "";
                if (!notebook || !hpath) return this.reject("notebook/hpath 缺失");
                let content = typeof a.template === "string" ? a.template : "";
                if (!content && typeof a.templatePath === "string") {
                    content = (await this.deps.api.getFileText(`/templates/${a.templatePath.replace(/^\/+/, "")}`)) ?? "";
                }
                if (!content) return this.reject("template/templatePath 均为空");
                const rendered = await this.deps.api.post<string>("/api/template/renderSprig", { template: content });
                const docId = await this.deps.api.post<string>("/api/filetree/createDocWithMd", { notebook, path: hpath, markdown: rendered });
                return { status: "recorded", data: { docId }, message: "已从模板创建" };
            }

            // ---- 设计态契约（M2 实现：events 文件载体 + workflow 受控编排）----
            case "events.list": {
                const manifest = (await import("../assets/ecosystem-manifests.json")).default as unknown as EcosystemManifest;
                const wl = eventWhitelist(manifest);
                const events = [...wl.entries()].map(([name, meta]) => ({ name, ...meta }));
                return { status: "recorded", data: { events }, message: `白名单事件 ${events.length} 个` };
            }
            case "events.pull": {
                const manifest = (await import("../assets/ecosystem-manifests.json")).default as unknown as EcosystemManifest;
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
                    planId: `wf-${this.deps.now?.() ?? Date.now()}`,
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
                const r = await executePlan(plan, {
                    confirmAll: async (steps) => {
                        const summary = steps.map((s) => `${s.index + 1}. ${s.op}${s.confirm ? "（写）" : ""}`).join("\n");
                        return this.deps.confirm(`执行工作流（${steps.length} 步）：\n${summary}`);
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
                return {
                    status: "recorded",
                    data: { done: r.done, stoppedAt: r.stoppedAt, steps: r.steps },
                    message: r.stoppedAt === null ? `全部 ${r.done} 步完成` : `第 ${r.stoppedAt + 1} 步失败停止（已完成 ${r.done} 步不回滚）`,
                };
            }

            // ---- 高级透传（默认关）----
            case "plugin.api": {
                if (!s.rawApiEnabled) return { status: "unsupported", data: null, message: "plugin.api 未开启（设置中手动启用）" };
                const plugin = typeof a.plugin === "string" ? a.plugin : "";
                const method = typeof a.method === "string" ? a.method : "";
                if (!plugin || !method) return this.reject("plugin/method 缺失");
                if (!s.rawApiAllowlist.includes(plugin)) return this.reject(`插件 ${plugin} 不在 plugin.api 允许名单`);
                const manifest = (await import("../assets/ecosystem-manifests.json")).default as unknown as EcosystemManifest;
                const globalName = manifest.plugins.find((m) => m.pluginId === plugin)?.windowBridge ?? "";
                const w = globalThis as unknown as { window?: { [k: string]: unknown } };
                const bridge = (globalName ? w.window?.[globalName] : null) as Record<string, unknown> | null | undefined;
                const fn = bridge && typeof (bridge as Record<string, unknown>)[method] === "function" ? (bridge as Record<string, unknown>)[method] as () => unknown : undefined;
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
