import { describe, expect, it } from "vitest";
import { appendEventLine, normalizeCheckinEvent, unwrapCheckinDetail } from "../src/services/eventbridge";

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
});
