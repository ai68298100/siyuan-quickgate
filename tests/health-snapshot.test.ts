import { describe, expect, it } from "vitest";
import { buildHealthSnapshot } from "../src/services/health-snapshot";

describe("health snapshot（R74-P1 统计窗口）", () => {
    it("只保留本会话窗口，并从审计推导最近成功/失败的 op", () => {
        const snapshot = buildHealthSnapshot({
            sessionStartedAt: 1_000,
            now: 6_000,
            audit: [
                { time: "1970-01-01T00:00:02.000Z", plugin: "p", command: "x args(secret)", status: "recorded", elapsedMs: 3 },
                { time: "1970-01-01T00:00:03.000Z", plugin: "p", command: "y args(token)", status: "failed", elapsedMs: 4 },
                { time: "1970-01-01T00:00:04.000Z", plugin: "p", command: "z args(body)", status: "recorded", elapsedMs: 5 },
            ],
        });
        expect(snapshot.scope).toBe("session");
        expect(snapshot.sessionId).toBe("session-rs");
        expect(snapshot.uptimeMs).toBe(5_000);
        expect(snapshot.lastSuccess).toEqual({ at: "1970-01-01T00:00:04.000Z", kind: "recorded", op: "z" });
        expect(snapshot.lastError).toEqual({ at: "1970-01-01T00:00:03.000Z", kind: "failed", op: "y" });
        expect(JSON.stringify(snapshot)).not.toContain("secret");
    });

    it("统计队列深度、最老年龄与坏 JSON 行，不暴露队列正文", () => {
        const snapshot = buildHealthSnapshot({
            sessionStartedAt: 10_000,
            now: Date.parse("2026-10-07T00:00:10.000Z"),
            commandsText: [
                JSON.stringify({ id: "new", createdAt: "2026-10-07T00:00:09.000Z", args: { secret: "x" } }),
                JSON.stringify({ id: "old", createdAt: "2026-10-07T00:00:01.000Z" }),
                "not-json",
            ].join("\n"),
        });
        expect(snapshot.queue).toEqual({
            pending: 3,
            oldestCreatedAt: "2026-10-07T00:00:01.000Z",
            oldestAgeMs: 9_000,
            parseErrors: 1,
        });
        expect(JSON.stringify(snapshot)).not.toContain("secret");
        expect(JSON.stringify(snapshot)).not.toContain("not-json");
    });

    it("空输入保持可复制的空态快照", () => {
        const snapshot = buildHealthSnapshot({ sessionStartedAt: 1_000, now: 2_000 });
        expect(snapshot.lastSuccess).toBeNull();
        expect(snapshot.lastError).toBeNull();
        expect(snapshot.queue).toEqual({ pending: 0, oldestCreatedAt: null, oldestAgeMs: null, parseErrors: 0 });
    });
});
