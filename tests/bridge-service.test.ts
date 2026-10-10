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
        getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined, getCommon: () => undefined,
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

describe("bridge-service 累计统计（可观测性）", () => {
    it("执行后计数与耗时累计；elapsed 只含本条命令（注入时钟）", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("s1") + "\n" + cmd("s2"));
        const store = new BridgeStore({ load: async () => null, save: async () => {} });
        let clock = 1000;
        let reads = 0;
        // now() 调用序列（L655 状态机）：①假死扫描 ②lastActivity ③tick 基准 ④reserve(s1) ⑤t0(s1)+10 ⑥elapsed(s1)+40 ⑦markDone(s1) ⑧reserve(s2) ⑨t0(s2)+10 ⑩elapsed(s2)+10 ⑪markDone(s2)
        const steps = [0, 0, 0, 0, 10, 40, 0, 0, 10, 10, 0];
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
            getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined, getCommon: () => undefined,
            now: () => {
                clock += steps[reads] ?? 0;
                reads += 1;
                return clock;
            },
        });
        await service.tick();
        expect(service.stats.commands).toBe(2);
        expect(service.stats.ok).toBe(2);
        expect(service.stats.rejected).toBe(0);
        expect(service.stats.failed).toBe(0);
        // s1: t0=1010, elapsed 至 1050=40ms；s2: t0=1060, elapsed 至 1070=10ms（不叠加）
        expect(service.stats.totalDispatchMs).toBe(50);
        expect(service.stats.lastActivityAt).not.toBeNull();
        const results = mem.files.get("/bridge/results.ndjson")!;
        const lines = results.trim().split("\n").map((l) => JSON.parse(l) as BridgeReceipt);
        expect(lines.map((r) => r.elapsedMs)).toEqual([40, 10]);
    });

    it("失败/拒绝/过期分账（unsupported 计入 failed）", async () => {
        const mem = new MemKernel();
        const expired = JSON.stringify({ v: 1, id: "e1", op: "bridge.ping", args: {}, createdAt: new Date(Date.now() - 120000).toISOString(), ttlMs: 1000 });
        mem.files.set(
            "/bridge/commands.ndjson",
            cmd("ok1") + "\n" + cmd("rj1", "no.such.op") + "\n" + expired,
        );
        const { service } = makeService(mem);
        await service.tick();
        expect(service.stats.commands).toBe(2); // 过期不进入执行统计
        expect(service.stats.ok).toBe(1);
        expect(service.stats.failed).toBe(1); // unsupported 归 failed 桶
        expect(service.stats.expired).toBe(1);
    });
});

describe("plugin.api 高级透传（安全敏感：开关+允许名单+manifest 窗口桥映射）", () => {
    const command = (id: string, args: Record<string, unknown>) =>
        JSON.stringify({ v: 1, id, op: "plugin.api", args, createdAt: new Date().toISOString(), ttlMs: 60000 });

    function makeRawService(mem: MemKernel) {
        const store = new BridgeStore({ load: async () => null, save: async () => {} });
        const service = new BridgeService({
            api: mem.api,
            store,
            settings: () => ({ ...settings(), rawApiEnabled: true, rawApiAllowlist: ["siyuan-checkin"] }),
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
            getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined, getCommon: () => undefined,
        });
        return service;
    }

    it("开关关 → unsupported；不在允许名单 → rejected", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", cmd("p0", "plugin.api"));
        const { service } = makeService(mem); // 默认 rawApiEnabled=false
        await service.tick();
        let receipt = JSON.parse(mem.files.get("/bridge/results.ndjson")!.trim().split("\n")[0]) as BridgeReceipt;
        expect(receipt.status).toBe("unsupported");

        const mem2 = new MemKernel();
        mem2.files.set("/bridge/commands.ndjson", command("p1", { plugin: "siyuan-contacts", method: "searchPeople" }));
        const service2 = makeRawService(mem2); // 名单只有 siyuan-checkin
        await service2.tick();
        receipt = JSON.parse(mem2.files.get("/bridge/results.ndjson")!.trim()) as BridgeReceipt;
        expect(receipt.status).toBe("rejected");
        expect(receipt.message).toContain("允许名单");
    });

    it("manifest windowBridge 映射：siyuan-checkin → window.siyuanCheckin 透传成功", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", command("p2", { plugin: "siyuan-checkin", method: "getSummary", args: [] }));
        (globalThis as unknown as { window?: Record<string, unknown> }).window = {
            siyuanCheckin: { getSummary: async () => ({ total: 42 }) },
        };
        try {
            const service = makeRawService(mem);
            await service.tick();
            const receipt = JSON.parse(mem.files.get("/bridge/results.ndjson")!.trim()) as BridgeReceipt;
            expect(receipt.status).toBe("recorded");
            expect(receipt.data).toEqual({ total: 42 });
        } finally {
            delete (globalThis as unknown as { window?: unknown }).window;
        }
    });

    it("方法不存在 → unsupported", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", command("p3", { plugin: "siyuan-checkin", method: "noSuchMethod" }));
        (globalThis as unknown as { window?: Record<string, unknown> }).window = { siyuanCheckin: {} };
        try {
            const service = makeRawService(mem);
            await service.tick();
            const receipt = JSON.parse(mem.files.get("/bridge/results.ndjson")!.trim()) as BridgeReceipt;
            expect(receipt.status).toBe("unsupported");
        } finally {
            delete (globalThis as unknown as { window?: unknown }).window;
        }
    });
});
