import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ALL_OPS, KERNEL_OPS, FRONTEND_ONLY_OPS } from "../src/ops";
import { createKernelOpHandler, type KernelDeps } from "../src/kernel-ops";

const contractPath = join(fileURLToPath(new URL(".", import.meta.url)), "..", "docs", "contracts", "quickgate-api-v1.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as { ops: Array<{ op: string }> };

const manifestForTest = {
    version: 1,
    plugins: [{ pluginId: "siyuan-checkin", displayName: "打卡", maturity: "stable", version: "18.16.0", protocol: null, capabilities: [], hubIntegration: "" }],
} as never;
const deps: KernelDeps = {
    kpost: async () => { throw new Error("unused"); },
    getFileText: async () => null,
    manifest: manifestForTest,
    pluginName: "siyuan-quickgate",
};

describe("契约一致性（三处 op 清单防漂移，R8 events.list 教训）", () => {
    it("契约 JSON 的 op 面 = ops.ts ALL_OPS（双向）", () => {
        const contractOps = contract.ops.map((o) => o.op).sort();
        expect(contractOps).toEqual([...ALL_OPS].sort());
    });

    it("KERNEL_OPS ∪ FRONTEND_ONLY_OPS = ALL_OPS，且两集合不相交", () => {
        const union = [...KERNEL_OPS, ...FRONTEND_ONLY_OPS].sort();
        expect(union).toEqual([...ALL_OPS].sort());
        expect(KERNEL_OPS.some((op) => FRONTEND_ONLY_OPS.includes(op))).toBe(false);
    });

    it("内核路由行为契约：KERNEL_OPS 不回'未知 op'，FRONTEND_ONLY 回 unsupported+NDJSON 指引", async () => {
        const handle = createKernelOpHandler(deps);
        for (const op of KERNEL_OPS) {
            const r = await handle(op, {});
            expect(r.status, `${op} 应被内核路由处理`).not.toBe("unsupported");
            expect(r.message, `${op} 不应报未知`).not.toContain("未知 op");
        }
        for (const op of FRONTEND_ONLY_OPS) {
            const r = await handle(op, {});
            expect(r.status, `${op} 应回 unsupported`).toBe("unsupported");
            expect(r.message, `${op} 应指引 NDJSON 通道`).toContain("NDJSON");
        }
    });
});
