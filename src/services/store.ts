/**
 * 持久化处理台账（阻断项4）：处理过的命令 id 跨重启保留；
 * 队列压缩以它为准，外部并发写回造成的"行复活"按 id 跳过。
 * v2（L655）：条目带 pending/done 状态机——崩溃恢复时假死 pending 发 unknown 回执，
 * 不重放写操作也不静默吞命令。
 */
import { ProcessedEntry, ProcessedStore, DEFAULT_SETTINGS, QuickGateSettings, AuditEntry, BridgeStats, ResolvedStore } from "../types/bridge";

export const PROCESSED_CAP = 500;
/** pending 超过此时长视为假死（崩溃残留），扫描发 unknown 回执（L655） */
export const PROCESSED_STALE_PENDING_MS = 60_000;
const PROCESSED_FILE = "bridge-state.json";
const SETTINGS_FILE = "bridge-settings.json";
const STATS_FILE = "bridge-stats.json";
const RESOLVED_FILE = "resolved.json";

export interface DataIO {
    load(file: string): Promise<unknown | null>;
    save(file: string, data: unknown): Promise<void>;
}

export function normalizeProcessed(raw: unknown): ProcessedStore {
    const empty: ProcessedStore = { schemaVersion: 2, processed: {} };
    if (!raw || typeof raw !== "object") return empty;
    const obj = raw as Record<string, unknown>;
    // v1 旧格式（id → number 时间戳）迁移为 done；v2 逐条校验；其余引导重建，绝不抛错阻断启动
    const rawProcessed = obj.processed;
    if (typeof rawProcessed !== "object" || rawProcessed === null) return empty;
    const processed: Record<string, ProcessedEntry> = {};
    for (const [id, v] of Object.entries(rawProcessed as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) {
            processed[id] = { ts: v, state: "done" }; // v1 迁移
            continue;
        }
        if (v && typeof v === "object") {
            const e = v as Record<string, unknown>;
            if (typeof e.ts === "number" && Number.isFinite(e.ts) && (e.state === "pending" || e.state === "done")) {
                processed[id] = {
                    ts: e.ts,
                    state: e.state,
                    ...(typeof e.op === "string" ? { op: e.op } : {}),
                    ...(typeof e.status === "string" ? { status: e.status } : {}),
                };
            }
        }
    }
    return { schemaVersion: 2, processed };
}

export function normalizeStats(raw: unknown): BridgeStats {    const base: BridgeStats = { commands: 0, ok: 0, rejected: 0, failed: 0, expired: 0, unknown: 0, totalDispatchMs: 0, lastActivityAt: null };
    if (!raw || typeof raw !== "object") return base;
    const obj = (raw as { stats?: unknown }).stats ?? raw;
    if (typeof obj !== "object" || obj === null) return base;
    const s = obj as Record<string, unknown>;
    const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
    return {
        commands: int(s.commands),
        ok: int(s.ok),
        rejected: int(s.rejected),
        failed: int(s.failed),
        expired: int(s.expired),
        unknown: int(s.unknown),
        totalDispatchMs: int(s.totalDispatchMs),
        lastActivityAt: typeof s.lastActivityAt === "number" && Number.isFinite(s.lastActivityAt) ? s.lastActivityAt : null,
    };
}

export function normalizeResolved(raw: unknown): ResolvedStore {
    const empty: ResolvedStore = { schemaVersion: 1, resolved: {} };
    if (!raw || typeof raw !== "object") return empty;
    const obj = raw as Record<string, unknown>;
    const entries = obj.resolved;
    if (typeof entries !== "object" || entries === null) return empty;
    const out: ResolvedStore["resolved"] = {};
    for (const [id, v] of Object.entries(entries as Record<string, unknown>)) {
        if (v && typeof v === "object" && typeof (v as { at?: unknown }).at === "string" && typeof (v as { action?: unknown }).action === "string") {
            out[id] = { at: (v as { at: string }).at, action: (v as { action: string }).action };
        }
    }
    return { schemaVersion: 1, resolved: out };
}

export function normalizeSettings(raw: unknown): QuickGateSettings {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
    const obj = raw as Record<string, unknown>;
    const s: QuickGateSettings = { ...DEFAULT_SETTINGS };
    // 边界加固（R78）：整数语义字段（pollMs/backoffMaxMs/auditMax）要求 Number.isInteger——
    // 小数/NaN/Infinity 一律回默认（NaN/Infinity 被范围比较自然拒绝，小数此前会漏进持久化）
    if (typeof obj.bridgeEnabled === "boolean") s.bridgeEnabled = obj.bridgeEnabled;
    if (typeof obj.pollMs === "number" && Number.isInteger(obj.pollMs) && obj.pollMs >= 200 && obj.pollMs <= 60000) s.pollMs = obj.pollMs;
    if (typeof obj.backoffMaxMs === "number" && Number.isInteger(obj.backoffMaxMs) && obj.backoffMaxMs >= 1000 && obj.backoffMaxMs <= 300000) s.backoffMaxMs = obj.backoffMaxMs;
    if (typeof obj.confirmExec === "boolean") s.confirmExec = obj.confirmExec;
    if (Array.isArray(obj.blacklist)) s.blacklist = obj.blacklist.filter((x): x is string => typeof x === "string");
    if (typeof obj.auditMax === "number" && Number.isInteger(obj.auditMax) && obj.auditMax >= 0 && obj.auditMax <= 2000) s.auditMax = obj.auditMax;
    if (typeof obj.rawApiEnabled === "boolean") s.rawApiEnabled = obj.rawApiEnabled;
    if (Array.isArray(obj.rawApiAllowlist)) s.rawApiAllowlist = obj.rawApiAllowlist.filter((x): x is string => typeof x === "string");
    if (typeof obj.bridgeBasePath === "string" && obj.bridgeBasePath.startsWith("/") && !obj.bridgeBasePath.includes("..")) {
        s.bridgeBasePath = obj.bridgeBasePath;
    }
    if (typeof obj.deviceName === "string") s.deviceName = obj.deviceName.slice(0, 64);
    if (typeof obj.broadcastEnabled === "boolean") s.broadcastEnabled = obj.broadcastEnabled;
    // 移动端桥 opt-in：显式字段优先；缺省时从旧版隐式后缀迁移（deviceName ":mobile-on"，R69-P1）
    if (typeof obj.mobileBridgeEnabled === "boolean") {
        s.mobileBridgeEnabled = obj.mobileBridgeEnabled;
    } else if (typeof obj.deviceName === "string" && obj.deviceName.endsWith(":mobile-on")) {
        s.mobileBridgeEnabled = true;
    }
    // 快速捕获默认去向（R301）：仅接受合法枚举，其余回 daily
    if (obj.captureTarget === "daily" || obj.captureTarget === "inbox") {
        s.captureTarget = obj.captureTarget;
    }
    // 天数保留（L630 R-A）：非负整数天（≤3650）；默认 0=关（行为与旧版一致）——不进设置页，改 bridge-settings.json 生效
    if (typeof obj.retentionDays === "number" && Number.isInteger(obj.retentionDays) && obj.retentionDays >= 0 && obj.retentionDays <= 3650) {
        s.retentionDays = obj.retentionDays;
    }
    return s;
}

export class BridgeStore {
    processed: ProcessedStore = { schemaVersion: 2, processed: {} };
    settings: QuickGateSettings = { ...DEFAULT_SETTINGS };
    /** 首跑标记（R288 · G2-01）：本次加载前不存在设置文件——向导只在真首跑出现 */
    firstRun = false;
    /** 运行统计快照（L554）：上次生命周期累计，启动时注入 BridgeService 续计 */
    statsSnapshot: BridgeStats = normalizeStats(null);
    /** 恢复中心处置台账（G5 · R294）：人工处理过的回执 id */
    resolved: ResolvedStore = normalizeResolved(null);

    constructor(private io: DataIO) {}

    async loadAll(): Promise<void> {
        this.processed = normalizeProcessed(await this.io.load(PROCESSED_FILE));
        const settingsRaw = await this.io.load(SETTINGS_FILE);
        // 宿主 loadData 对缺失文件解析为 ""（非 null）——两者都算真首跑（R288 实测踩坑）
        this.firstRun = settingsRaw === null || settingsRaw === "";
        this.settings = normalizeSettings(settingsRaw);
        this.statsSnapshot = normalizeStats(await this.io.load(STATS_FILE));
        this.resolved = normalizeResolved(await this.io.load(RESOLVED_FILE));
    }

    /** 处置记账（G5）：retried=换新 id 重发 / dismissed=人工核对后放弃；cap 500 防无界增长 */
    async markResolved(id: string, action: string): Promise<void> {
        this.resolved.resolved[id] = { at: new Date().toISOString(), action };
        const list = Object.entries(this.resolved.resolved);
        if (list.length > 500) {
            list.sort((a, b) => (a[1].at < b[1].at ? -1 : 1));
            this.resolved.resolved = Object.fromEntries(list.slice(list.length - 500));
        }
        await this.io.save(RESOLVED_FILE, this.resolved);
    }

    async saveStats(stats: BridgeStats): Promise<void> {
        await this.io.save(STATS_FILE, { schemaVersion: 1, stats, savedAt: new Date().toISOString() });
    }

    /**
     * 审计历史加载（R47 修复候选 bug#8：此前只写不读——重启后内存清空，
     * 且首次 flushAudit 会用新条目整个覆写 audit.json，静默销毁上次历史）。
     * 逐条形状校验；坏条目跳过；按 auditMax 截尾。
     */
    async loadAudit(auditMax: number): Promise<AuditEntry[]> {
        const raw = (await this.io.load("audit.json")) as { entries?: unknown } | null;
        const entries = Array.isArray(raw?.entries) ? raw!.entries : [];
        const out: AuditEntry[] = [];
        for (const e of entries) {
            if (!e || typeof e !== "object") continue;
            const o = e as Record<string, unknown>;
            if (typeof o.time !== "string" || typeof o.plugin !== "string" || typeof o.command !== "string" || typeof o.status !== "string" || typeof o.elapsedMs !== "number") continue;
            out.push({ time: o.time, plugin: o.plugin, command: o.command, status: o.status, elapsedMs: o.elapsedMs });
        }
        return out.slice(-Math.max(0, auditMax));
    }

    async saveProcessed(): Promise<void> {
        this.processed.processed = capEntries(this.processed.processed, PROCESSED_CAP);
        await this.io.save(PROCESSED_FILE, this.processed);
    }

    async saveSettings(): Promise<void> {
        await this.io.save(SETTINGS_FILE, this.settings);
    }

    /** 已处理？处理并记账（时间戳单调取大） */
    isProcessed(id: string): boolean {
        return id in this.processed.processed;
    }

    /** 终结记账（过期/坏行等同步路径）；不落盘——调用方按批 saveProcessed */
    markProcessed(id: string, now = Date.now()) {
        this.processed.processed[id] = { ts: now, state: "done" };
    }

    /**
     * 预约执行（L655）：pending 记账并立即落盘——崩溃后假死 pending 可被扫描识别，
     * 不至于"内存丢了台账→队列重放写操作"（v1 的重复执行失败模式）。
     * 返回 false 表示该 id 已存在（双通道去重），调用方跳过。
     */
    async reserve(id: string, now: number, op: string): Promise<boolean> {
        if (this.processed.processed[id]) return false;
        this.processed.processed[id] = { ts: now, state: "pending", op };
        await this.saveProcessed();
        return true;
    }

    /** 预约→终结：回执落定后调用（status 记入台账供诊断），不落盘——调用方按批 saveProcessed */
    markDone(id: string, now: number, status: string) {
        const e = this.processed.processed[id];
        if (e) {
            e.state = "done";
            e.status = status;
            e.ts = now;
        } else {
            this.processed.processed[id] = { ts: now, state: "done", status };
        }
    }

    /**
     * 假死扫描（L655）：pending 超过 maxAgeMs 的条目标记为 done(unknown) 并返回——
     * 调用方据此发 unknown 回执（不重放写操作）。重复扫描不重复返回。
     */
    takeStalePending(now: number, maxAgeMs = PROCESSED_STALE_PENDING_MS): Array<{ id: string; entry: ProcessedEntry }> {
        const out: Array<{ id: string; entry: ProcessedEntry }> = [];
        for (const [id, e] of Object.entries(this.processed.processed)) {
            if (e.state === "pending" && now - e.ts >= maxAgeMs) {
                e.state = "done";
                e.status = "unknown";
                out.push({ id, entry: { ...e } });
            }
        }
        if (out.length > 0) void this.saveProcessed();
        return out;
    }
}

function capEntries(entries: Record<string, ProcessedEntry>, cap: number): Record<string, ProcessedEntry> {
    const list = Object.entries(entries);
    if (list.length <= cap) return entries;
    list.sort((a, b) => a[1].ts - b[1].ts);
    const next: Record<string, ProcessedEntry> = {};
    for (const [id, e] of list.slice(list.length - cap)) next[id] = e;
    return next;
}
