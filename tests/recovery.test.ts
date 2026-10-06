/**
 * G5 恢复中心数据面（R294）：候选合成（按 id 取最新/状态过滤/已处置过滤/canRetry 判定）
 * 与重试信封构造（换新 id，沿用 op/args/device）。
 */
import { describe, expect, it } from "vitest";
import { buildRecoveryItems, buildRetryEnvelope } from "../src/recovery";

const receipt = (id: string, status: string, at = "2026-10-06T01:00:00Z", op = "checkin.record") =>
    JSON.stringify({ v: 1, id, op, status, message: `${status} msg`, finishedAt: at, elapsedMs: 5 });
const command = (id: string, op = "checkin.record") =>
    JSON.stringify({ v: 1, id, op, args: { itemId: "i1" }, createdAt: "2026-10-06T00:59:00Z", ttlMs: 60000 });

describe("buildRecoveryItems（候选合成）", () => {
    it("只收 unknown/failed/expired；recorded/duplicate/rejected 不进恢复面", () => {
        const lines = [
            receipt("u1", "unknown"), receipt("f1", "failed"), receipt("e1", "expired"),
            receipt("ok1", "recorded"), receipt("d1", "duplicate"), receipt("rj1", "rejected"),
        ];
        expect(buildRecoveryItems(lines, [], {}).map((i) => i.id).sort()).toEqual(["e1", "f1", "u1"]);
    });

    it("同 id 多条回执取最新（迟到补写不产生重复候选）", () => {
        const lines = [receipt("x", "failed", "2026-10-06T01:00:00Z"), receipt("x", "unknown", "2026-10-06T02:00:00Z")];
        const items = buildRecoveryItems(lines, [], {});
        expect(items).toHaveLength(1);
        expect(items[0].status).toBe("unknown");
    });

    it("已处置（resolved 台账）过滤", () => {
        const lines = [receipt("u1", "unknown"), receipt("f1", "failed")];
        const items = buildRecoveryItems(lines, [], { u1: { at: "2026-10-06T03:00:00Z", action: "dismissed" } });
        expect(items.map((i) => i.id)).toEqual(["f1"]);
    });

    it("canRetry=原命令信封仍在队列文件", () => {
        const items = buildRecoveryItems([receipt("has", "failed"), receipt("gone", "failed")], [command("has")], {});
        expect(items.find((i) => i.id === "has")!.canRetry).toBe(true);
        expect(items.find((i) => i.id === "gone")!.canRetry).toBe(false);
    });
});

describe("buildRetryEnvelope（换新 id 重发）", () => {
    it("沿用 op/args/device，id 换新、createdAt 刷新、ttl 重置", () => {
        const original = command("crash1");
        const env = buildRetryEnvelope(original, "retry-abc");
        expect(env).not.toBeNull();
        const o = JSON.parse(env!) as { id: string; op: string; args: unknown; device?: string; ttlMs: number };
        expect(o.id).toBe("retry-abc");
        expect(o.op).toBe("checkin.record");
        expect(o.args).toEqual({ itemId: "i1" });
        expect(o.ttlMs).toBe(60000);
    });

    it("坏行 → null（调用方禁用重试）", () => {
        expect(buildRetryEnvelope("not-json", "x")).toBeNull();
    });
});
