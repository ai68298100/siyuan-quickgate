import { describe, expect, it } from "vitest";
import {
    IdempotencyRegistry, IDEMPOTENCY_FILE, IDEMPOTENCY_SCHEMA_VERSION,
    normalizeIdempotency, EVENT_TTL_MS,
} from "../src/services/idempotency";
import { planMaterialization } from "../src/services/eventbridge";
import type { HubEvent } from "../src/services/events";
import type { DataIO } from "../src/services/store";

/** 内存 DataIO */
function memIO(initial?: unknown): { io: DataIO; dump: () => unknown } {
    let data: unknown = initial ?? null;
    return {
        io: {
            load: async () => data,
            save: async (_f, d) => { data = d; },
        },
        dump: () => data,
    };
}

const ev = (key: string, emittedAt = "2026-10-05T10:00:00Z"): HubEvent => ({
    name: "checkin:event-recorded",
    source: "siyuan-checkin",
    emittedAt,
    payload: { itemId: "x" },
    idempotencyKey: key,
});

describe("IdempotencyRegistry（事件域幂等记账 · L599/C9 合同 §3）", () => {
    it("keyOf：统一 <pluginId>:<idempotencyKey> 形状", () => {
        expect(IdempotencyRegistry.keyOf("siyuan-checkin", "manual:i1:2026-10-05")).toBe("siyuan-checkin:manual:i1:2026-10-05");
    });

    it("seen/mark：同键第二次 seen=true；TTL 过期后视为未见过", async () => {
        const { io } = memIO();
        const t0 = 1_000_000;
        const r = new IdempotencyRegistry(io, 30, 100); // ttl=30（测试用小值）
        await r.load();
        expect(r.seen("a", t0)).toBe(false);
        r.mark("a", t0);
        expect(r.seen("a", t0 + 29)).toBe(true);
        expect(r.seen("a", t0 + 30)).toBe(false); // 恰好到期=过期（< ttl 才算有效）
    });

    it("save→load 持久化往返；坏形状 fail-open 重建", async () => {
        const { io, dump } = memIO();
        const r = new IdempotencyRegistry(io);
        await r.load();
        r.mark("k1", 100);
        r.mark("k2", 200);
        await r.save(300);
        const persisted = dump() as { schemaVersion: number; entries: Record<string, number> };
        expect(persisted.schemaVersion).toBe(IDEMPOTENCY_SCHEMA_VERSION);
        expect(persisted.entries.k1).toBe(100);

        const r2 = new IdempotencyRegistry(io);
        await r2.load();
        expect(r2.seen("k1", 100 + EVENT_TTL_MS - 1)).toBe(true);
        expect(r2.seen("k2", 200 + EVENT_TTL_MS - 1)).toBe(true);

        // 坏形状：schemaVersion 错 → 重建（不抛错）
        expect(normalizeIdempotency({ schemaVersion: 99, entries: { x: 1 } })).toEqual({});
        expect(normalizeIdempotency({ schemaVersion: 1, entries: { good: 1, bad: "no", alsoBad: NaN, "": 2 } })).toEqual({ good: 1 });
        expect(normalizeIdempotency(null)).toEqual({});
    });

    it("save：TTL 清扫 + LRU 截尾（最旧先淘汰）", async () => {
        const { io, dump } = memIO();
        const t0 = 1_000_000;
        const r = new IdempotencyRegistry(io, 100, 3); // ttl=100, cap=3
        await r.load();
        r.mark("old1", t0);
        r.mark("old2", t0 + 1);
        r.mark("mid", t0 + 2);
        r.mark("new1", t0 + 3);
        r.mark("expired", t0 - 1000);
        await r.save(t0 + 10);
        const entries = (dump() as { entries: Record<string, number> }).entries;
        expect(Object.keys(entries).sort()).toEqual(["mid", "new1", "old2"]); // old1 LRU 淘汰，expired TTL 清扫
    });

    it("size 诊断面", async () => {
        const { io } = memIO();
        const r = new IdempotencyRegistry(io);
        await r.load();
        r.mark("x", 1);
        r.mark("y", 2);
        expect(r.size).toBe(2);
    });
});

describe("planMaterialization（物化去重计划 · 先写后记账）", () => {
    it("seen 过滤：重复事件不进 toAppend；toMark 与 toAppend 一一对应", () => {
        const seen = new Set(["siyuan-checkin:dup"]);
        const plan = planMaterialization(
            [ev("fresh"), ev("dup"), ev("fresh2")],
            (key) => seen.has(key),
            (e) => `${e.source}:${e.idempotencyKey}`,
        );
        expect(plan.toAppend.map((e) => e.idempotencyKey)).toEqual(["fresh", "fresh2"]);
        expect(plan.toMark).toEqual(["siyuan-checkin:fresh", "siyuan-checkin:fresh2"]);
    });

    it("全重复：toAppend 为空（调用方跳过 putFile）", () => {
        const plan = planMaterialization([ev("dup")], () => true, (e) => e.idempotencyKey);
        expect(plan.toAppend).toHaveLength(0);
        expect(plan.toMark).toHaveLength(0);
    });

    it("IDEMPOTENCY_FILE 常量稳定（持久化文件名是契约）", () => {
        expect(IDEMPOTENCY_FILE).toBe("idempotency.json");
    });
});
