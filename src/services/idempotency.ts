/**
 * 幂等身份注册表（C9 合同 §3 · TODO L599 R77-P1）——统一 `source+externalRef` 记账。
 *
 * 分工：桥命令域沿用 processed 台账（键=命令 id，见 store.ts）；本注册表服务**事件域**，
 * 键形状 `<pluginId>:<idempotencyKey>`（idempotencyKey 由事件自身携带=源发生身份，禁止用接收时间猜，L600）。
 * 价值：events.ndjson 是滚动裁剪的 append-only 载体（appendEventLine cap=200），裁剪后的重放事件
 * 会被再次追加——写入侧按注册表去重，「同一用户动作只记一次」跨滚动窗口成立。
 * 持久化在快门自身存储（idempotency.json），TTL 30 天（跨设备回放窗口）+ LRU 截尾防无限增长。
 * 纪律：mark 必须在载体写入成功之后调用（先写后记账；save 失败=fail-open，重启后重放至多多记一行）。
 */
import type { DataIO } from "./store";

export const IDEMPOTENCY_FILE = "idempotency.json";
export const IDEMPOTENCY_SCHEMA_VERSION = 1;
/** 事件域 TTL：30 天（合同 §3；覆盖跨设备回放窗口） */
export const EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** LRU 截尾上限（与 auditMax 上限同量级，防无限增长） */
export const IDEMPOTENCY_CAP = 2000;

export function normalizeIdempotency(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== "object") return {};
    const obj = raw as Record<string, unknown>;
    if (obj.schemaVersion !== IDEMPOTENCY_SCHEMA_VERSION || typeof obj.entries !== "object" || obj.entries === null) {
        return {}; // 不兼容 → 重建（fail-open：重放至多重复一行，不阻断启动）
    }
    const entries: Record<string, number> = {};
    for (const [k, ts] of Object.entries(obj.entries as Record<string, unknown>)) {
        if (k && typeof ts === "number" && Number.isFinite(ts)) entries[k] = ts;
    }
    return entries;
}

export class IdempotencyRegistry {
    private entries: Record<string, number> = {};
    private loaded = false;

    constructor(private io: DataIO, private ttlMs = EVENT_TTL_MS, private cap = IDEMPOTENCY_CAP) {}

    /** 统一键形状：`<pluginId>:<idempotencyKey>`（合同 §3） */
    static keyOf(source: string, idempotencyKey: string): string {
        return `${source}:${idempotencyKey}`;
    }

    async load(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;
        this.entries = normalizeIdempotency(await this.io.load(IDEMPOTENCY_FILE));
    }

    /** 已登记且未过 TTL */
    seen(key: string, now = Date.now()): boolean {
        const ts = this.entries[key];
        return typeof ts === "number" && now - ts < this.ttlMs;
    }

    mark(key: string, now = Date.now()): void {
        this.entries[key] = now;
    }

    /** 载体写入成功后调用：记账 + TTL 清扫 + LRU 截尾 + 持久化（失败不抛出阻断调用方） */
    async save(now = Date.now()): Promise<void> {
        const live = Object.entries(this.entries).filter(([, ts]) => now - ts < this.ttlMs);
        live.sort((a, b) => a[1] - b[1]);
        this.entries = Object.fromEntries(live.slice(-this.cap));
        try {
            await this.io.save(IDEMPOTENCY_FILE, { schemaVersion: IDEMPOTENCY_SCHEMA_VERSION, entries: this.entries });
        } catch { /* 持久化失败=fail-open：内存已记账，重启后重放至多重复一行 */ }
    }

    /** 诊断面：当前记账条数（未清扫的原始值） */
    get size(): number {
        return Object.keys(this.entries).length;
    }
}
