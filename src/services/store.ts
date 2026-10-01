/**
 * 持久化处理台账（阻断项4）：处理过的命令 id 跨重启保留；
 * 队列压缩以它为准，外部并发写回造成的"行复活"按 id 跳过。
 */
import { ProcessedStore, DEFAULT_SETTINGS, QuickGateSettings } from "../types/bridge";

export const PROCESSED_CAP = 500;
const PROCESSED_FILE = "bridge-state.json";
const SETTINGS_FILE = "bridge-settings.json";

export interface DataIO {
    load(file: string): Promise<unknown | null>;
    save(file: string, data: unknown): Promise<void>;
}

export function normalizeProcessed(raw: unknown): ProcessedStore {
    if (!raw || typeof raw !== "object") return { schemaVersion: 1, processed: {} };
    const obj = raw as Record<string, unknown>;
    if (obj.schemaVersion !== 1 || typeof obj.processed !== "object" || obj.processed === null) {
        return { schemaVersion: 1, processed: {} }; // 不兼容 → 引导重建，绝不抛错阻断启动
    }
    const processed: Record<string, number> = {};
    for (const [id, ts] of Object.entries(obj.processed as Record<string, unknown>)) {
        if (typeof ts === "number" && Number.isFinite(ts)) processed[id] = ts;
    }
    return { schemaVersion: 1, processed };
}

export function normalizeSettings(raw: unknown): QuickGateSettings {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
    const obj = raw as Record<string, unknown>;
    const s: QuickGateSettings = { ...DEFAULT_SETTINGS };
    if (typeof obj.bridgeEnabled === "boolean") s.bridgeEnabled = obj.bridgeEnabled;
    if (typeof obj.pollMs === "number" && obj.pollMs >= 200 && obj.pollMs <= 60000) s.pollMs = obj.pollMs;
    if (typeof obj.backoffMaxMs === "number" && obj.backoffMaxMs >= 1000 && obj.backoffMaxMs <= 300000) s.backoffMaxMs = obj.backoffMaxMs;
    if (typeof obj.confirmExec === "boolean") s.confirmExec = obj.confirmExec;
    if (Array.isArray(obj.blacklist)) s.blacklist = obj.blacklist.filter((x): x is string => typeof x === "string");
    if (typeof obj.auditMax === "number" && obj.auditMax >= 0 && obj.auditMax <= 2000) s.auditMax = obj.auditMax;
    if (typeof obj.rawApiEnabled === "boolean") s.rawApiEnabled = obj.rawApiEnabled;
    if (Array.isArray(obj.rawApiAllowlist)) s.rawApiAllowlist = obj.rawApiAllowlist.filter((x): x is string => typeof x === "string");
    if (typeof obj.bridgeBasePath === "string" && obj.bridgeBasePath.startsWith("/") && !obj.bridgeBasePath.includes("..")) {
        s.bridgeBasePath = obj.bridgeBasePath;
    }
    if (typeof obj.deviceName === "string") s.deviceName = obj.deviceName.slice(0, 64);
    return s;
}

export class BridgeStore {
    processed: ProcessedStore = { schemaVersion: 1, processed: {} };
    settings: QuickGateSettings = { ...DEFAULT_SETTINGS };

    constructor(private io: DataIO) {}

    async loadAll(): Promise<void> {
        this.processed = normalizeProcessed(await this.io.load(PROCESSED_FILE));
        this.settings = normalizeSettings(await this.io.load(SETTINGS_FILE));
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

    markProcessed(id: string, now = Date.now()) {
        this.processed.processed[id] = now;
    }
}

function capEntries(entries: Record<string, number>, cap: number): Record<string, number> {
    const list = Object.entries(entries);
    if (list.length <= cap) return entries;
    list.sort((a, b) => a[1] - b[1]);
    const next: Record<string, number> = {};
    for (const [id, ts] of list.slice(list.length - cap)) next[id] = ts;
    return next;
}
