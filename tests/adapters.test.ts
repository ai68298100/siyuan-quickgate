import { describe, expect, it } from "vitest";
import {
    checkinItems, checkinRecord, contactsEnsure, contactsInteraction, splitNames,
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
    getSummary: () => ({ streak: 3 }),
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

    it("record 注入 source/externalRef（幂等键来自信封 id）", async () => {
        let captured: unknown;
        const b = readyCheckin(["events.record"]);
        b.recordEvent = (args) => { captured = args; return { ok: true }; };
        const r = await checkinRecord(() => b, { itemId: "i1", value: 5 }, "qk-abc");
        expect(r.status).toBe("recorded");
        expect((captured as { source: string }).source).toBe("quickgate");
        expect((captured as { externalRef: string }).externalRef).toBe("qk-abc");
    });

    it("桥缺席 → unsupported；itemId 缺失 → rejected", async () => {
        expect((await checkinItems(() => undefined, {})).status).toBe("unsupported");
        const r = await checkinRecord(() => readyCheckin(["events.record"]), {}, "ref");
        expect(r.status).toBe("rejected");
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
