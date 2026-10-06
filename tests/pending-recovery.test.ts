/**
 * L655 执行状态机（pending/done/unknown）：预约去重、假死扫描、跨重启恢复。
 * 背景（R78-P1·运行记录）：v1"先记账后执行"在崩溃时有两个失败模式——
 *   ①台账已落盘、回执未写 → 调用方按 id 重查永远无回执（静默丢失）；
 *   ②台账在内存未落盘 → 队列行未压缩 → 重启后写操作重放。
 * v2 方案：reserve 即落盘（杜绝②）；假死 pending 扫描发 unknown 回执（杜绝①的静默），
 * unknown 不自动重试，回执附人工核对路径。
 */
import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore, PROCESSED_STALE_PENDING_MS } from "../src/services/store";
import type { BridgeReceipt } from "../src/types/bridge";

const cmd = (id: string, op = "bridge.ping") =>
    JSON.stringify({ v: 1, id, op, args: {}, createdAt: new Date().toISOString(), ttlMs: 60000 });

/** 内存文件系统 + 假 fetch（与 bridge-service.test.ts 的 MemKernel 同款） */
class MemKernel {
    files = new Map<string, string>();
    api: KernelApi;
    constructor() {
        this.api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
            const u = String(url);
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
            if (u === "/api/file/getFile") {
                const text = this.files.get(body.path);
                return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
            }
            if (u === "/api/file/putFile") {
                const form = init?.body as FormData;
                const path = String(form.get("path"));
                const file = form.get("file") as File;
                this.files.set(path, await file.text());
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: null }) } as Response;
            }
            return { ok: false, status: 404, text: async () => "{}" } as Response;
        }) as unknown as typeof fetch);
    }
}

const settings = () => ({
    schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
    confirmExec: false, blacklist: [] as string[], auditMax: 200,
    rawApiEnabled: false, rawApiAllowlist: [] as string[],
    bridgeBasePath: "/bridge", deviceName: "dev-a",
});

function makeService(mem: MemKernel, store: BridgeStore) {
    const service = new BridgeService({
        api: mem.api,
        store,
        settings,
        pluginName: "siyuan-quickgate",
        pluginVersion: "0.1.0",
        deviceName: () => "dev-a",
        registry: () => ({ source: "fallback", plugins: [] }),
        confirm: async () => true,
        audit: () => {},
        editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {},
        openSetting: () => {},
        getCheckin: () => undefined,
        getContacts: () => undefined,
    });
    return service;
}

describe("L655 预约去重与状态机", () => {
    it("reserve 幂等：同 id 二次预约返回 false（双通道去重）", async () => {
        const saved = new Map<string, unknown>();
        const store = new BridgeStore({ load: async (f) => saved.get(f) ?? null, save: async (f, d) => { saved.set(f, d); } });
        expect(await store.reserve("c1", 1000, "doc.open")).toBe(true);
        expect(await store.reserve("c1", 1001, "doc.open")).toBe(false);
        expect(store.isProcessed("c1")).toBe(true);
    });

    it("takeStalePending：过期 pending 标记 done(unknown) 且只回收一次", async () => {
        const saved = new Map<string, unknown>();
        const store = new BridgeStore({ load: async (f) => saved.get(f) ?? null, save: async (f, d) => { saved.set(f, d); } });
        await store.reserve("old", 1000, "checkin.record");
        await store.reserve("fresh", 1000 + PROCESSED_STALE_PENDING_MS - 1000, "doc.open");
        const stale = store.takeStalePending(1000 + PROCESSED_STALE_PENDING_MS + 1);
        expect(stale.map((s) => s.id)).toEqual(["old"]);
        expect(stale[0].entry.status).toBe("unknown");
        expect(store.takeStalePending(1000 + PROCESSED_STALE_PENDING_MS + 2)).toEqual([]); // 不重复回收
    });
});

describe("L655 跨重启恢复（端到端）", () => {
    it("崩溃残留 pending → 新实例首 tick 发 unknown 回执（附人工核对路径，不重放不静默）", async () => {
        // 上一生命周期：reserve 后崩溃（pending 已落盘，队列行未压缩、回执未写）
        const saved = new Map<string, unknown>();
        const deadStore = new BridgeStore({ load: async (f) => saved.get(f) ?? null, save: async (f, d) => { saved.set(f, d); } });
        await deadStore.reserve("crash1", Date.now() - PROCESSED_STALE_PENDING_MS - 10, "checkin.record");

        // 新生命周期：从落盘数据装载（模拟重启）
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("crash1", "checkin.record"));
        const revivedStore = new BridgeStore({ load: async (f) => saved.get(f) ?? null, save: async (f, d) => { saved.set(f, d); } });
        await revivedStore.loadAll();
        const service = makeService(mem, revivedStore);
        const r = await service.tick();

        expect(r.receipts).toBe(1);
        expect(r.executed).toBe(0); // 不重放写操作
        const receipt = JSON.parse((mem.files.get("/bridge/results.ndjson") ?? "").trim().split("\n")[0]) as BridgeReceipt;
        expect(receipt.id).toBe("crash1");
        expect(receipt.status).toBe("unknown");
        expect(receipt.message).toContain("不自动重试");
        expect(receipt.message).toContain("人工核对");
        // 终态落台账：重启再 tick 不重复回执
        const r2 = await service.tick();
        expect(r2.receipts).toBe(0);
    });

    it("正常路径不受影响：执行后 done，无 unknown 回执", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("ok1"));
        const store = new BridgeStore({ load: async () => null, save: async () => {} });
        const service = makeService(mem, store);
        const r = await service.tick();
        expect(r.executed).toBe(1);
        const lines = (mem.files.get("/bridge/results.ndjson") ?? "").trim().split("\n");
        expect(lines).toHaveLength(1);
        expect((JSON.parse(lines[0]) as BridgeReceipt).status).toBe("recorded");
    });
});
