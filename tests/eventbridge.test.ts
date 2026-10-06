import { describe, expect, it } from "vitest";
import { appendEventLine, normalizeCheckinEvent, normalizeCheckinEventDeleted, unwrapCheckinDetail } from "../src/services/eventbridge";

describe("eventbridge（D-0009 事件物化）", () => {
    it("合法 detail → HubEvent，幂等键=source:externalRef", () => {
        const e = normalizeCheckinEvent(
            { itemId: "i1", value: 5, unit: "分钟", occurredAt: "2026-10-02T10:00:00Z", source: "quicker", externalRef: "qk-abc" },
            "2026-10-02T10:00:01Z"
        );
        expect(e).not.toBeNull();
        expect(e!.name).toBe("checkin:event-recorded");
        expect(e!.idempotencyKey).toBe("quicker:qk-abc");
        expect((e!.payload as { value: number }).value).toBe(5);
    });

    it("上游包裹形状 {type:'event-recorded', event:{…}} → 解包归一化（v0.5.2 通道修正）", () => {
        const detail = {
            type: "event-recorded",
            event: { itemId: "i9", value: 2, occurredAt: "2026-10-02T08:00:00Z", source: "quickgate", externalRef: "ext-1" },
        };
        expect(unwrapCheckinDetail(detail)).toBe(detail.event);
        const e = normalizeCheckinEvent(detail, "2026-10-02T08:00:01Z");
        expect(e).not.toBeNull();
        expect(e!.idempotencyKey).toBe("quickgate:ext-1");
    });

    it("非 event-recorded 的包裹不误解包", () => {
        const detail = { type: "event-deleted", event: { itemId: "i1", occurredAt: "t" } };
        expect(unwrapCheckinDetail(detail)).toBe(detail);
    });

    it("event-deleted：event 单条 → 一条 :deleted 标记（v0.5.4）", () => {
        const detail = {
            type: "event-deleted",
            event: { id: "ev1", itemId: "i1", occurredAt: "2026-10-02T10:00:00Z", source: "api", externalRef: "ext-9" },
        };
        const out = normalizeCheckinEventDeleted(detail, "2026-10-02T11:00:00Z");
        expect(out.length).toBe(1);
        expect(out[0].name).toBe("checkin:event-deleted");
        expect(out[0].idempotencyKey).toBe("api:ext-9:deleted");
        expect((out[0].payload as { eventId: string }).eventId).toBe("ev1");
    });

    it("event-deleted：deletedEvents 批量 → 多条标记；无信息 → 空数组", () => {
        const detail = {
            type: "event-deleted",
            deletedEvents: [
                { itemId: "i1", occurredAt: "2026-10-02T10:00:00Z", source: "manual" },
                { itemId: "i2", occurredAt: "2026-10-02T10:05:00Z" },
                { itemId: "" }, // 非法：静默跳过
                "junk", // 非对象：跳过
            ],
        };
        const out = normalizeCheckinEventDeleted(detail, "t");
        expect(out.length).toBe(2);
        expect(out[0].idempotencyKey).toBe("manual:i1:2026-10-02T10:00:00Z:deleted");
        expect(out[1].idempotencyKey).toBe("manual:i2:2026-10-02T10:05:00Z:deleted");
        expect(normalizeCheckinEventDeleted({ type: "event-recorded" }, "t")).toEqual([]);
        expect(normalizeCheckinEventDeleted(null, "t")).toEqual([]);
    });

    it("缺 externalRef → 从 itemId+occurredAt 派生", () => {
        const e = normalizeCheckinEvent({ itemId: "i1", occurredAt: "2026-10-02T10:00:00Z" }, "2026-10-02T10:00:01Z");
        expect(e!.idempotencyKey).toBe("manual:i1:2026-10-02T10:00:00Z");
    });

    it("不合法 → null（静默跳过）", () => {
        expect(normalizeCheckinEvent(null, "x")).toBeNull();
        expect(normalizeCheckinEvent({ value: 1 }, "x")).toBeNull(); // 缺 itemId
        expect(normalizeCheckinEvent({ itemId: "i" }, "x")).toBeNull(); // 缺 occurredAt
        expect(normalizeCheckinEvent({ type: "event-recorded" }, "x")).toBeNull(); // 包裹但无 event
    });

    it("appendEventLine 滚动裁剪", () => {
        let text = "";
        for (let i = 0; i < 205; i++) {
            text = appendEventLine(text, {
                name: "checkin:event-recorded", source: "s", emittedAt: "t",
                payload: null, idempotencyKey: `k${i}`,
            });
        }
        const lines = text.trim().split("\n");
        expect(lines.length).toBe(200);
        expect(lines[0]).toContain("k5"); // 最旧的被裁掉
    });

    it("createSingleFlight：并发读改写串行化，无丢更新（R69-P1 回归）", async () => {
        const { createSingleFlight } = await import("../src/services/eventbridge");
        const enqueue = createSingleFlight();
        // 模拟桥文件读改写：读（含延迟）→ 追加 → 写回。20 个并发触发，
        // 无串行化时后任务读到旧文本会覆盖前任务（丢更新）；串行后 20 行全在
        let file = "";
        const simulateMaterialize = (tag: string) => enqueue(async () => {
            const old = file; // 读
            await new Promise((r) => setTimeout(r, 2)); // 读-写窗口
            file = appendEventLine(old, {
                name: "checkin:event-recorded", source: "s", emittedAt: "t",
                payload: null, idempotencyKey: tag,
            }); // 写回
        });
        await Promise.all(Array.from({ length: 20 }, (_, i) => simulateMaterialize(`k${i}`)));
        const lines = file.trim().split("\n");
        expect(lines.length).toBe(20);
        for (let i = 0; i < 20; i++) expect(lines[i]).toContain(`k${i}`); // 全部保留且有序
    });

    it("createSingleFlight：单任务失败不阻塞后续任务", async () => {
        const { createSingleFlight } = await import("../src/services/eventbridge");
        const enqueue = createSingleFlight();
        await expect(enqueue(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
        const out = await enqueue(async () => "after-failure");
        expect(out).toBe("after-failure");
    });

    it("L630 R-A · appendEventLine 天数裁剪（默认关；>0 剔除超期行，时间不可解析按保留）", () => {
        const ev = (k: string, emittedAt: string) => ({
            name: "checkin:event-recorded", source: "s", emittedAt, payload: null, idempotencyKey: k,
        });
        const now = Date.parse("2026-10-06T10:00:00Z");
        let text = "";
        text = appendEventLine(text, ev("old", "2026-09-01T00:00:00Z"), { retentionDays: 30, nowMs: now });
        text = appendEventLine(text, ev("new", "2026-10-01T00:00:00Z"), { retentionDays: 30, nowMs: now });
        const keys = text.trim().split("\n").map((l) => (JSON.parse(l) as { idempotencyKey: string }).idempotencyKey);
        expect(keys).toEqual(["new"]); // 超期行被剔除
        // 默认关：同样的数据不裁
        let text2 = "";
        text2 = appendEventLine(text2, ev("old", "2026-09-01T00:00:00Z"));
        text2 = appendEventLine(text2, ev("new", "2026-10-01T00:00:00Z"));
        expect(text2.trim().split("\n").length).toBe(2);
    });
});
