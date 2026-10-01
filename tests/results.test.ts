import { describe, expect, it } from "vitest";
import { appendReceipt, findReceiptById, RESULTS_MAX_LINES } from "../src/services/results";
import type { BridgeReceipt } from "../src/types/bridge";

const receipt = (id: string): BridgeReceipt => ({
    v: 1, id, op: "bridge.ping", status: "recorded", data: null,
    message: "pong", finishedAt: "2026-10-01T00:00:00Z", plugin: "siyuan-quickgate", elapsedMs: 1,
});

describe("results.appendReceipt / findReceiptById", () => {
    it("追加并滚动裁剪到上限", () => {
        let text = "";
        for (let i = 0; i < RESULTS_MAX_LINES + 30; i++) {
            text = appendReceipt(text, receipt(`id-${i}`));
        }
        const lines = text.trim().split("\n");
        expect(lines.length).toBe(RESULTS_MAX_LINES);
        expect(findReceiptById(text, "id-0")).toBeUndefined(); // 最旧的被裁掉
        expect(findReceiptById(text, `id-${RESULTS_MAX_LINES + 29}`)).toBeDefined();
    });

    it("按字段匹配 id，而非字符串包含（阻断项8）", () => {
        const text = appendReceipt("", receipt("id-1"));
        const tricky = appendReceipt(text, receipt("id-1-fake") /* id 不同但包含 id-1 */);
        expect(findReceiptById(tricky, "id-1")?.id).toBe("id-1");
        expect(findReceiptById(tricky, "id-1-fake")?.id).toBe("id-1-fake");
        // op 字段里碰巧含目标串也不影响
        const r = receipt("x");
        r.op = "see id-9 inside";
        const t2 = appendReceipt("", r);
        expect(findReceiptById(t2, "id-9")).toBeUndefined();
    });

    it("坏行跳过不抛错", () => {
        const text = "{broken\n" + appendReceipt("", receipt("ok-1"));
        expect(findReceiptById(text, "ok-1")?.id).toBe("ok-1");
        expect(findReceiptById(text, "broken")).toBeUndefined();
    });
});
