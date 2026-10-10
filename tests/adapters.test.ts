import { describe, expect, it } from "vitest";
import {
    checkinItems, checkinRecord, checkinSummary, contactsEnsure, contactsInteraction, splitNames,
    gleanList, gleanGet, gleanStatus,
    homeSummary, homeMemo, homeOpen,
    examStats, examOpen,
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

describe("glean 适配器（window.siyuanGlean v1）", () => {
    const readyGlean = () => ({
        apiVersion: 1,
        version: "1.3.3",
        listClips: async (f?: Record<string, unknown>) => [{ id: "20261001120000-abcdefg", title: "文一", status: "inbox" }],
        getClip: async (id: string) => (id === "20261001120000-abcdefg" ? { id, title: "文一" } : null),
        setClipStatus: async (id: string, status: string) => {
            // 按状态区分上游错误路径：done→写开关关闭；archived→非收录文章；其余成功
            if (status === "done") throw new Error("Glean bridge writes are disabled");
            if (status === "archived") throw new Error("Not a confirmed reading library article");
        },
    });

    it("缺桥/apiVersion 不为 1 → unsupported", async () => {
        expect((await gleanList(() => undefined, {})).status).toBe("unsupported");
        expect((await gleanList(() => ({ apiVersion: 2 }), {})).status).toBe("unsupported");
        expect((await gleanGet(() => undefined, { id: "20261001120000-abcdefg" })).status).toBe("unsupported");
    });

    it("list 参数预校验：非法 status/limit/direction → rejected", async () => {
        expect((await gleanList(readyGlean, { status: "nope" })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { limit: 0 })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { limit: 201 })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { limit: 1.5 })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { offset: -1 })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { direction: "up" })).status).toBe("rejected");
        expect((await gleanList(readyGlean, { site: 3 })).status).toBe("rejected");
    });

    it("list 正常透传并回 count", async () => {
        const r = await gleanList(readyGlean, { status: "inbox", limit: 50, offset: 0, direction: "desc" });
        expect(r.status).toBe("recorded");
        expect((r.data as { count: number }).count).toBe(1);
    });

    it("get id 形状守卫 + 未命中回 null", async () => {
        expect((await gleanGet(readyGlean, {})).status).toBe("rejected");
        expect((await gleanGet(readyGlean, { id: "BAD" })).status).toBe("rejected");
        const ok = await gleanGet(readyGlean, { id: "20261001120000-abcdefg" });
        expect((ok.data as { clip: unknown }).clip).toBeTruthy();
        const miss = await gleanGet(readyGlean, { id: "20261001120000-zzzzzzz" });
        expect((miss.data as { clip: unknown }).clip).toBeNull();
        expect(miss.status).toBe("recorded");
    });

    it("status 写面：非法状态 rejected；上游写开关/非收录错误归 rejected 透出", async () => {
        expect((await gleanStatus(readyGlean, { id: "20261001120000-abcdefg" })).status).toBe("rejected");
        expect((await gleanStatus(readyGlean, { id: "20261001120000-abcdefg", status: "nope" })).status).toBe("rejected");
        const gate = await gleanStatus(readyGlean, { id: "20261001120000-abcdefg", status: "done" });
        expect(gate.status).toBe("rejected");
        expect(gate.message).toContain("桥写开关");
        const notClip = await gleanStatus(readyGlean, { id: "20261001120000-abcdefg", status: "archived" });
        expect(notClip.status).toBe("rejected");
        expect(notClip.message).toContain("读库文章");
        const ok = await gleanStatus(readyGlean, { id: "20261001120000-abcdefg", status: "reading" });
        expect(ok.status).toBe("recorded");
    });
});

describe("home 适配器（window.LvHome v1）", () => {
    const readyHome = () => ({
        protocol: 1,
        capabilities: ["whenReady", "openButler", "openReminders", "addMemo", "summary"],
        summary: () => ({ overdue: 2, soon: 1, today: 3, updatedAt: "2026-10-11T00:00:00Z" }),
        addMemo: async (title: string, due: string) => {
            if (!title.trim()) throw new Error("备忘标题不能为空");
        },
        openButler: () => undefined,
        openReminders: () => undefined,
    });

    it("缺桥/协议不符 → unsupported", async () => {
        expect((await homeSummary(() => undefined)).status).toBe("unsupported");
        expect((await homeSummary(() => ({ protocol: 2 }))).status).toBe("unsupported");
    });

    it("summary 有界计数透传", async () => {
        const r = await homeSummary(readyHome);
        expect(r.status).toBe("recorded");
        expect((r.data as { overdue: number }).overdue).toBe(2);
    });

    it("memo 校验：title/dueDate 缺失 rejected；空白 title 上游错误 → failed", async () => {
        expect((await homeMemo(readyHome, {})).status).toBe("rejected");
        expect((await homeMemo(readyHome, { title: "x" })).status).toBe("rejected");
        expect((await homeMemo(readyHome, { title: "  ", dueDate: "2026-10-15" })).status).toBe("rejected");
        const ok = await homeMemo(readyHome, { title: "体检", dueDate: "2026-10-15" });
        expect(ok.status).toBe("recorded");
        expect((ok.data as { dueDate: string }).dueDate).toBe("2026-10-15");
    });

    it("open 默认 butler；target=reminders 走提醒中枢", async () => {
        const a = await homeOpen(readyHome, {});
        expect((a.data as { target: string }).target).toBe("butler");
        const b = await homeOpen(readyHome, { target: "reminders" });
        expect((b.data as { target: string }).target).toBe("reminders");
    });
});

describe("exam 适配器（window.siyuanExam lite）", () => {
    const readyExam = () => ({
        version: "0.9.6",
        statsRead: async () => ({ version: 1, attempts: 10, accuracy: 80 }),
        open: () => undefined,
        practice: () => undefined,
        wrongbook: () => undefined,
        mock: () => undefined,
        report: () => undefined,
    });

    it("缺桥/缺 statsRead → unsupported", async () => {
        expect((await examStats(() => undefined)).status).toBe("unsupported");
        expect((await examStats(() => ({ version: "x" }))).status).toBe("unsupported");
    });

    it("stats 透传；null（应用未就绪）仍 recorded", async () => {
        const r = await examStats(readyExam);
        expect((r.data as { stats: { attempts: number } }).stats.attempts).toBe(10);
        const nullish = await examStats(() => ({ statsRead: async () => null }));
        expect(nullish.status).toBe("recorded");
        expect((nullish.data as { stats: unknown }).stats).toBeNull();
    });

    it("open 非法 target 回落 practice", async () => {
        const r = await examOpen(readyExam, { target: "hacker" });
        expect((r.data as { target: string }).target).toBe("practice");
        const w = await examOpen(readyExam, { target: "wrongbook" });
        expect((w.data as { target: string }).target).toBe("wrongbook");
    });
});
