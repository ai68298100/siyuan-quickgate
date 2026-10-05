import { describe, expect, it } from "vitest";
import { MemKernel, makeTestService, dispatchOf } from "./helpers/test-env";

/** plugin.api 原型链防护（L651 · R283）：method 必须是桥对象自有属性 */
describe("plugin.api 原型链防护（L651）", () => {
    it("constructor/hasOwnProperty/inherited 等非自有成员不得经透传调用", async () => {
        const svc = makeTestService(new MemKernel(), {
            settings: () => ({
                schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
                confirmExec: false, blacklist: [] as string[], auditMax: 200,
                rawApiEnabled: true, rawApiAllowlist: ["siyuan-checkin"],
                bridgeBasePath: "/bridge", deviceName: "dev-a",
            }),
        });
        const dispatch = dispatchOf(svc);

        const bridgeObj = { realMethod: async () => "ok" } as Record<string, unknown>;
        Object.setPrototypeOf(bridgeObj, { inherited: async () => "should-not-call" });
        (globalThis as { window?: Record<string, unknown> }).window = { fakeBridge: bridgeObj };
        try {
            for (const method of ["constructor", "hasOwnProperty", "inherited", "__defineGetter__"]) {
                const r = await dispatch("p1", "plugin.api", { plugin: "siyuan-checkin", method, args: [] });
                expect(r.status, `${method} 应被拒`).toBe("unsupported");
                expect(r.message).toBe("桥方法不存在");
            }
        } finally {
            delete (globalThis as { window?: unknown }).window;
        }
    });
});
