import { describe, expect, it } from "vitest";
import {
    checkinItems, checkinRecord, checkinSummary, contactsEnsure, contactsInteraction, splitNames,
    CheckinBridgeLike, ContactsBridgeLike,
} from "../src/services/adapters";

const readyCheckin = (caps: string[]): CheckinBridgeLike => ({
    whenReady: async () => undefined,
    hasCapability: (c) => caps.includes(c),
    getItems: () => [
        { id: "i1", name: "跑步", kind: "count", unit: "次", archived: false },
        { id: "i2", name: "旧事项", archived: true },
    ],
    recordEvent: (args) => ({ ok: true, echo: args }),
    recordEventsBatch: (inputs) => (inputs as unknown[]).map((x) => ({ kind: "recorded", eventId: "ev-" + (x as {itemId: string}).itemId })),
    getSummaryContext: (range) => ({ range, totalEvents: 7, completedItems: 2, scheduledItems: 3 }),
    getStreaks: (ids) => ids.map((id) => ({ itemId: id, current: 3, longest: 5 })),
});

describe("checkin 适配器（能力协商）", () => {
    it("缺能力 → unsupported", async () => {
        const r = await checkinItems(() => readyCheckin([]), {});
        expect(r.status).toBe("unsupported");
    });

    it("items.list 正常返回并过滤归档", async () => {
        const r = await checkinItems(() => readyCheckin(["items.read"]), { includeArchived: false });
        expect(r.status).toBe("recorded");
        const items = (r.data as { items: Array<{ id: string }> }).items;
        expect(items.map((i) => i.id)).toEqual(["i1"]);
    });

    it("record 注入 source=api/externalRef（v0.5.7 审计：quickgate 非合法 source，上游会静默归一 api）", async () => {
        let captured: unknown;
        const b = readyCheckin(["events.record"]);
        b.recordEvent = (args) => { captured = args; return { ok: true }; };
        const r = await checkinRecord(() => b, { itemId: "i1", value: 5 }, "qk-abc");
        expect(r.status).toBe("recorded");
        expect((captured as { source: string }).source).toBe("api");
        expect((captured as { externalRef: string }).externalRef).toBe("qk-abc");
        expect((captured as { occurredAt?: string }).occurredAt).toBeUndefined(); // 不再传给单条接口（上游忽略）
    });

    it("occurredAt 路由 recordEventsBatch：recorded/duplicate/rejected 映射（v0.5.7）", async () => {
        const b = readyCheckin(["events.record"]);
        const r = await checkinRecord(() => b, { itemId: "i1", occurredAt: "2026-10-01T09:00:00Z" }, "ref-1");
        expect(r.status).toBe("recorded");
        expect((r.data as { eventId: string }).eventId).toBe("ev-i1");

        const b2 = readyCheckin(["events.record"]);
        b2.recordEventsBatch = () => [{ kind: "duplicate" }];
        const r2 = await checkinRecord(() => b2, { itemId: "i1", occurredAt: "2026-10-01T09:00:00Z" }, "ref-2");
        expect(r2.status).toBe("recorded");
        expect((r2.data as { duplicate: boolean }).duplicate).toBe(true);

        const b3 = readyCheckin(["events.record"]);
        b3.recordEventsBatch = () => [{ kind: "rejected", reason: "invalid-value" }];
        const r3 = await checkinRecord(() => b3, { itemId: "i1", occurredAt: "bad" }, "ref-3");
        expect(r3.status).toBe("rejected");
        expect(r3.message).toContain("invalid-value");

        const b4 = readyCheckin(["events.record"]);
        delete (b4 as Partial<CheckinBridgeLike>).recordEventsBatch;
        const r4 = await checkinRecord(() => b4, { itemId: "i1", occurredAt: "2026-10-01T09:00:00Z" }, "ref-4");
        expect(r4.status).toBe("unsupported");
    });

    it("桥缺席 → unsupported；itemId 缺失 → rejected", async () => {
        expect((await checkinItems(() => undefined, {})).status).toBe("unsupported");
        const r = await checkinRecord(() => readyCheckin(["events.record"]), {}, "ref");
        expect(r.status).toBe("rejected");
    });

    it("summary：组合 getSummaryContext(day)+getStreaks（v0.5.6——上游无 getSummary）；streaks 数组归一为映射（v0.5.7）", async () => {
        const r = await checkinSummary(() => readyCheckin(["summary.read"]));
        expect(r.status).toBe("recorded");
        const data = r.data as { today: { totalEvents: number }; streaks: Record<string, number>; streaksLongest: Record<string, number> };
        expect(data.today.totalEvents).toBe(7);
        expect(data.streaks.i1).toBe(3);       // current
        expect(data.streaksLongest.i1).toBe(5); // longest
    });

    it("summary 回归：桥无任何 summary 方法 → unsupported（不得静默 recorded 空数据）", async () => {
        const bare = readyCheckin(["summary.read"]);
        delete (bare as Partial<CheckinBridgeLike>).getSummaryContext;
        delete (bare as Partial<CheckinBridgeLike>).getStreaks;
        const r = await checkinSummary(() => bare);
        expect(r.status).toBe("unsupported");
        expect(r.message).toContain("getSummaryContext");
    });
});

describe("contacts 适配器", () => {
    const bridge: ContactsBridgeLike = {
        protocol: 1,
        ensurePerson: async (name) => ({ docId: `doc-${name}`, name, created: true }),
        searchPeople: async (kw) => [{ docId: "d1", name: kw ?? "" }],
        recordInteraction: async (docIds, meta) => ({ recorded: docIds.length, ref: (meta as { ref: string }).ref }),
    };

    it("ensure 校验 name", async () => {
        expect((await contactsEnsure(() => bridge, {})).status).toBe("rejected");
        expect((await contactsEnsure(() => bridge, { name: "张三" })).status).toBe("recorded");
    });

    it("interaction：names 逐个 ensure → recordInteraction(ref=信封id)", async () => {
        let capturedMeta: unknown;
        const b: ContactsBridgeLike = {
            ...bridge,
            recordInteraction: async (docIds, meta) => { capturedMeta = meta; return { recorded: docIds.length }; },
        };
        const r = await contactsInteraction(() => b, { names: "张三、李四,王五 五六" }, "qk-xyz");
        expect(r.status).toBe("recorded");
        expect((capturedMeta as { ref: string }).ref).toBe("qk-xyz");
        expect((r.data as { recorded: number }).recorded).toBe(4);
    });

    it("splitNames 兼容中英文分隔符", () => {
        expect(splitNames("a，b、c d;e；f")).toEqual(["a", "b", "c", "d", "e", "f"]);
        expect(splitNames(["x", 3, "y"])).toEqual(["x", "y"]);
    });
});
