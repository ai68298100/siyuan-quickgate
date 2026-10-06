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

    it("observed 事件不进白名单——stable 插件不旁路（R77-P0 事件治理回归）", () => {
        // 修复前 `|| maturity==="stable"` 使 checkin 的 6 个 observed 事件全部混入（白名单 8→2）
        expect(wl.has("checkin:analytics-updated")).toBe(false); // D-0011 高频明确排除
        expect(wl.has("checkin:item-created")).toBe(false);
        expect(wl.has("checkin:item-updated")).toBe(false);
        expect(wl.has("checkin:item-deleted")).toBe(false);
        expect(wl.has("checkin:item-archived")).toBe(false);
        expect(wl.has("checkin:suggestion-workflow-updated")).toBe(false);
        expect(wl.size).toBe(2);
    });

    it("pull：白名单过滤 + since + limit + 坏行跳过", () => {
        const text = [
            JSON.stringify({ name: "checkin:event-recorded", source: "siyuan-checkin", emittedAt: "2026-10-01T10:00:00Z", payload: { itemId: "i" }, idempotencyKey: "k1" }),
            JSON.stringify({ name: "lv-cards:reviewed", emittedAt: "2026-10-01T11:00:00Z", idempotencyKey: "k2" }), // 非白名单
            "{broken",
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-02T09:00:00Z", idempotencyKey: "k3" }),
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-02T10:00:00Z", idempotencyKey: "k4" }),
        ].join("\n");
        const all = pullEvents([{ file: "f1", text }], wl, {});
        expect(all.length).toBe(3);
        const since = pullEvents([{ file: "f1", text }], wl, { since: "2026-10-02T00:00:00Z" });
        expect(since.map((e) => e.idempotencyKey)).toEqual(["k3", "k4"]);
        const limited = pullEvents([{ file: "f1", text }], wl, { limit: 1 });
        expect(limited.length).toBe(1);
    });

    it("pull：多文件不重复解析、source 归属真实文件、idempotencyKey 跨文件去重（R69-P1 回归）", () => {
        const f1 = [
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-01T10:00:00Z", idempotencyKey: "ka" }),
        ].join("\n");
        const f2 = [
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-01T11:00:00Z", idempotencyKey: "kb" }),
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "2026-10-01T12:00:00Z", idempotencyKey: "ka" }), // 与 f1 跨文件重复
        ].join("\n");
        // 修复前：合并文本按 files 数量重复解析（每事件出现 2 次且 source 错乱）、无跨文件去重
        const out = pullEvents([{ file: "/a.ndjson", text: f1 }, { file: "/b.ndjson", text: f2 }], wl, {});
        expect(out.length).toBe(2); // ka + kb，重复 ka 只留先到者
        expect(out.map((e) => e.idempotencyKey)).toEqual(["ka", "kb"]);
        expect(out.find((e) => e.idempotencyKey === "ka").source).toBe("/a.ndjson"); // 归属真实来源文件
        expect(out.find((e) => e.idempotencyKey === "kb").source).toBe("/b.ndjson");
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

    it("plan：必填参数校验早失败（R69-P1 回归）——缺 itemId 的 checkin.record 在 plan 阶段拒绝", () => {
        const bad = makePlan(
            [{ op: "checkin.record", args: {} }, { op: "doc.open", args: { id: "d" } }],
            { planId: "wf-arg1", now, whitelistOp: () => true }
        );
        expect(bad.kind).toBe("rejected");
        if (bad.kind === "rejected") expect(bad.message).toContain("第 1 步 checkin.record 缺 itemId");
        const bad2 = makePlan(
            [{ op: "doc.open", args: {} }, { op: "contacts.interaction", args: { note: "x" } }],
            { planId: "wf-arg2", now, whitelistOp: () => true }
        );
        expect(bad2.kind).toBe("rejected");
        if (bad2.kind === "rejected") expect(bad2.message).toContain("contacts.interaction 缺 names/docIds");
        // 合法参数照常通过
        const good = makePlan(
            [{ op: "contacts.interaction", args: { names: ["张三"] } }],
            { planId: "wf-arg3", now, whitelistOp: () => true }
        );
        expect(good.kind).toBe("plan");
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

    // L572（docs/36）：取消检查点——每步开始前检查 isCancelled
    it("execute：中途取消 → 已完成步骤保留不回滚，回执标注 user-cancel", async () => {
        const plan = makePlan(
            [{ op: "doc.open", args: { id: "d" } }, { op: "doc.open", args: { id: "d" } }, { op: "doc.open", args: { id: "d" } }],
            { planId: "wf-cancel", now, whitelistOp: () => true }
        );
        if (plan.kind !== "plan") throw new Error("plan expected");
        let executed = 0;
        const r = await executePlan(plan.plan, {
            confirmAll: async () => true,
            runStep: async () => { executed += 1; return { status: "recorded", data: null, message: "ok" }; },
            isCancelled: async () => executed >= 2, // 第 3 步开始前命中取消
            now: () => now,
        });
        expect(r.kind).toBe("done");
        expect(executed).toBe(2); // 第 3 步未执行
        if (r.kind !== "done") return;
        expect(r.cancelled?.requestedBy).toBe("user");
        expect(r.steps.length).toBe(2); // 已完成步骤照常列入回执
    });

    it("execute：isCancelled 全程 false → 正常完成无取消标注", async () => {
        const plan = makePlan([{ op: "doc.open", args: { id: "d" } }], { planId: "wf-nocancel", now, whitelistOp: () => true });
        const r = await executePlan(plan.kind === "plan" ? plan.plan : undefined, {
            confirmAll: async () => true,
            runStep: async () => ({ status: "recorded", data: null, message: "ok" }),
            isCancelled: async () => false,
            now: () => now,
        });
        expect(r.kind).toBe("done");
        if (r.kind !== "done") return;
        expect(r.cancelled).toBeUndefined();
    });
});
