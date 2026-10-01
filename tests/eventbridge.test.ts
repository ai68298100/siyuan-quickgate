import { describe, expect, it } from "vitest";
import { appendEventLine, normalizeCheckinEvent } from "../src/services/eventbridge";

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

    it("缺 externalRef → 从 itemId+occurredAt 派生", () => {
        const e = normalizeCheckinEvent({ itemId: "i1", occurredAt: "2026-10-02T10:00:00Z" }, "2026-10-02T10:00:01Z");
        expect(e!.idempotencyKey).toBe("manual:i1:2026-10-02T10:00:00Z");
    });

    it("不合法 → null（静默跳过）", () => {
        expect(normalizeCheckinEvent(null, "x")).toBeNull();
        expect(normalizeCheckinEvent({ value: 1 }, "x")).toBeNull(); // 缺 itemId
        expect(normalizeCheckinEvent({ itemId: "i" }, "x")).toBeNull(); // 缺 occurredAt
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
