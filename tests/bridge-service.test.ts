import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";
import { BridgeReceipt } from "../src/types/bridge";

/** 内存文件系统 + 内存内核：模拟 commands/results 文件与并发追加 */
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
                // multipart：从 FormData 中取 path 与 file
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

const cmd = (id: string, op = "bridge.ping") => JSON.stringify({ v: 1, id, op, args: {}, createdAt: new Date().toISOString(), ttlMs: 60000 });

function makeService(mem: MemKernel) {
    const store = new BridgeStore({
        load: async () => null,
        save: async () => {},
    });
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
    return { service, store };
}

describe("bridge-service tick（队列可靠性集成）", () => {
    it("端到端：命令→执行→回执→压缩", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("a") + "\n" + JSON.stringify({ v: 1 }) + "\n");
        const { service } = makeService(mem);
        const r = await service.tick();
        expect(r.executed).toBe(1);
        expect(r.receipts).toBe(2); // a=recorded，坏行=rejected
        const results = mem.files.get("/bridge/results.ndjson")!;
        expect(results.includes("bridge.ping")).toBe(true);
        const commands = mem.files.get("/bridge/commands.ndjson")!.trim();
        expect(commands).toBe(""); // 全部已消费（含坏行），压缩为空
    });

    it("核心竞态：消费期间外部追加不丢失（阻断项1 验收）", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("a"));
        const { service } = makeService(mem);

        // 外部消费者读文件（旧快照）
        const snapshot = mem.files.get("/bridge/commands.ndjson")!;
        // 同一瞬间外部追加 b（基于旧快照读-改-写）
        mem.files.set("/bridge/commands.ndjson", snapshot.trim() + "\n" + cmd("b") + "\n");
        // 桥 tick：处理 a 与 b
        const r = await service.tick();
        expect(r.executed).toBe(2);

        // 反向竞态：桥处理了 a，外部基于"含 a 的旧文件"追加 c 写回 → a 复活 + c 到达
        mem.files.set("/bridge/commands.ndjson", cmd("a") + "\n" + cmd("c") + "\n");
        const r2 = await service.tick();
        expect(r2.executed).toBe(1); // a 复活但按 id 跳过；只有 c 被执行
        expect(r2.receipts).toBe(1);
        const ids = mem.files.get("/bridge/results.ndjson")!
            .trim().split("\n").map((l) => (JSON.parse(l) as BridgeReceipt).id);
        expect(ids).toContain("c");
        expect(ids.filter((x) => x === "a").length).toBeLessThanOrEqual(1); // a 不重复回执
    });

    it("reply:false 执行但不写回执", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", JSON.stringify({ v: 1, id: "nr", op: "bridge.ping", args: {}, reply: false, createdAt: new Date().toISOString() }));
        const { service } = makeService(mem);
        const r = await service.tick();
        expect(r.executed).toBe(1);
        expect(r.receipts).toBe(0);
        expect(mem.files.has("/bridge/results.ndjson")).toBe(false);
    });

    it("TTL 过期：不执行、回执 expired", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", JSON.stringify({ v: 1, id: "old", op: "bridge.ping", args: {}, createdAt: new Date(Date.now() - 120000).toISOString(), ttlMs: 60000 }));
        const { service } = makeService(mem);
        const r = await service.tick();
        expect(r.executed).toBe(0);
        const receipt = JSON.parse(mem.files.get("/bridge/results.ndjson")!.trim()) as BridgeReceipt;
        expect(receipt.status).toBe("expired");
    });

    it("device 路由：非目标设备不消费不回执，命令保留", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", JSON.stringify({ v: 1, id: "d1", op: "bridge.ping", args: {}, device: "dev-b", createdAt: new Date().toISOString() }));
        const { service } = makeService(mem);
        const r = await service.tick();
        expect(r.executed).toBe(0);
        expect(r.receipts).toBe(0);
        expect(mem.files.get("/bridge/commands.ndjson")).toContain("d1"); // 保留给目标设备
    });

    it("未知 op → unsupported 回执", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("u", "no.such.op"));
        const { service } = makeService(mem);
        await service.tick();
        const receipt = JSON.parse(mem.files.get("/bridge/results.ndjson")!.trim()) as BridgeReceipt;
        expect(receipt.status).toBe("unsupported");
        expect(receipt.message).toContain("no.such.op");
    });
});
