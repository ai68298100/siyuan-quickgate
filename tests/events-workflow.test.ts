import { describe, expect, it } from "vitest";
import { eventWhitelist, pullEvents } from "../src/services/events";
import { makePlan, executePlan } from "../src/services/workflow";
import manifest from "../src/assets/ecosystem-manifests.json";

describe("events 白名单与拉取", () => {
    const wl = eventWhitelist(manifest as never);

    it("仅 stable 插件且 available 的事件进白名单", () => {
        expect(wl.has("checkin:event-recorded")).toBe(true);
        expect(wl.has("lv-cards:reviewed")).toBe(false); // design 态
    });

    it("pull：白名单过滤 + since + limit + 坏行跳过", () => {
        const text = [
            JSON.stringify({ name: "checkin:event-recorded", source: "siyuan-checkin", emittedAt: "2026-10-01T10:00:00Z", payload: { itemId: "i" }, idempotencyKey: "k1" }),
            JSON.stringify({ name: "lv-cards:reviewed", emittedAt: "2026-10-01T11:00:00Z", idempotencyKey: "k2" }), // 非白名单
            "{broken",
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-02T09:00:00Z", idempotencyKey: "k3" }),
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-02T10:00:00Z", idempotencyKey: "k4" }),
        ].join("\n");
        const all = pullEvents(text, wl, ["f1"], {});
        expect(all.length).toBe(3);
        const since = pullEvents(text, wl, ["f1"], { since: "2026-10-02T00:00:00Z" });
        expect(since.map((e) => e.idempotencyKey)).toEqual(["k3", "k4"]);
        const limited = pullEvents(text, wl, ["f1"], { limit: 1 });
        expect(limited.length).toBe(1);
    });
});

describe("workflow plan/execute", () => {
    const now = Date.parse("2026-10-02T00:00:00Z");

    it("plan：白名单校验 + 写步骤确认标记", () => {
        const r = makePlan(
            [{ op: "checkin.record", args: { itemId: "i" } }, { op: "doc.open", args: { id: "d" } }, { op: "no.such.op" }],
            { planId: "wf-1", now, whitelistOp: (op) => op === "checkin.record" || op === "doc.open" }
        );
        expect(r.kind).toBe("rejected"); // 第 3 步不在白名单
        const ok = makePlan(
            [{ op: "checkin.record", args: { itemId: "i" } }, { op: "doc.open", args: { id: "d" } }],
            { planId: "wf-2", now, whitelistOp: (op) => op === "checkin.record" || op === "doc.open" }
        );
        expect(ok.kind).toBe("plan");
        if (ok.kind === "plan") {
            expect(ok.plan.steps[0].confirm).toBe(true); // 写操作
            expect(ok.plan.steps[1].confirm).toBe(false);
        }
    });

    it("execute：总确认拒绝 → denied", async () => {
        const plan = makePlan([{ op: "doc.open", args: { id: "d" } }], { planId: "wf-3", now, whitelistOp: () => true });
        // 固定时钟：此前用真实 Date.now()，现实时间越过 expiresAt（2026-10-02T00:05Z）时本测试误爆为 expired（R47 修复）
        const r = await executePlan(plan.kind === "plan" ? plan.plan : undefined, { confirmAll: async () => false, runStep: async () => ({ status: "recorded", data: null, message: "ok" }), now: () => now });
        expect(r.kind).toBe("denied");
    });

    it("execute：单步失败即停止，已完成不回滚（失败停止原则）", async () => {
        const plan = makePlan(
            [{ op: "doc.open", args: { id: "d" } }, { op: "doc.open", args: {} }, { op: "doc.open", args: { id: "e" } }],
            { planId: "wf-4", now, whitelistOp: () => true }
        );
        const r = await executePlan(plan.kind === "plan" ? plan.plan : undefined, {
            confirmAll: async () => true,
            runStep: async (s) => (s.args.id ? { status: "recorded", data: null, message: "ok" } : { status: "rejected", data: null, message: "id 缺失" }),
            now: () => now, // 同上：固定时钟
        });
        expect(r.kind).toBe("done");
        if (r.kind === "done") {
            expect(r.done).toBe(1);
            expect(r.stoppedAt).toBe(1);
            expect(r.steps.length).toBe(2); // 失败步自身也有回执
        }
    });

    it("execute：计划过期 → expired", async () => {
        const plan = makePlan([{ op: "doc.open", args: { id: "d" } }], { planId: "wf-5", now, whitelistOp: () => true });
        const r = await executePlan(plan.kind === "plan" ? plan.plan : undefined, {
            confirmAll: async () => true,
            runStep: async () => ({ status: "recorded", data: null, message: "ok" }),
            now: () => now + 6 * 60 * 1000,
        });
        expect(r.kind).toBe("expired");
    });
});
