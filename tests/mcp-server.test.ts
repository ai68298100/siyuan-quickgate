import { describe, expect, it } from "vitest";
import { ALL_OPS } from "../src/ops";
import { buildToolDefs, filterTools } from "../src/mcp/tools";
import { createMcpServer, BridgeClient } from "../src/mcp/server";

/** 假桥客户端：send/sendFast 返回固定 id，waitReceipt 回放队列 */
function fakeClient(receipts: Record<string, unknown>[] = [], opts: { execImpl?: (op: string) => Promise<Record<string, unknown>> } = {}): BridgeClient & { sent: { via: string; op: string; args: Record<string, unknown> }[] } {
    const sent: { via: string; op: string; args: Record<string, unknown> }[] = [];
    return {
        sent,
        maxWaitMs: 100,
        send: async (op, args) => {
            sent.push({ via: "ndjson", op, args });
            return "id-1";
        },
        sendFast: async (op, args) => {
            sent.push({ via: "fast", op, args });
            return "id-1";
        },
        callKernelRoute: opts.execImpl ? async (op) => {
            sent.push({ via: "kernel", op, args: {} });
            return await opts.execImpl!(op);
        } : undefined,
        waitReceipt: async (id, _max, op) => receipts.shift() ?? { id, op, status: "timeout", message: "无回执" },
    };
}

describe("MCP 工具映射（契约驱动）", () => {
    it("工具名集合与 ALL_OPS 严格一致（多/漏都是漂移）", () => {
        const defs = buildToolDefs();
        expect(new Set(defs.map((t) => t.name))).toEqual(new Set(ALL_OPS as readonly string[]));
        expect(defs.length).toBe(ALL_OPS.length);
    });

    it("每个 op 都登记了参数 schema（含无参 op 的空 properties）——AI 可构造正确调用", () => {
        const defs = buildToolDefs();
        for (const t of defs) {
            expect(t.inputSchema, `${t.name} 缺 properties`).toHaveProperty("properties");
            expect(t.description.length, `${t.name} 描述过短`).toBeGreaterThan(4);
        }
        // 抽查必填项穿透到 schema
        const byName = new Map(defs.map((t) => [t.name, t]));
        expect(byName.get("commands.run")!.inputSchema.required).toEqual(["plugin", "command"]);
        expect(byName.get("template.new")!.inputSchema.required).toEqual(["notebook", "hpath"]);
        expect(byName.get("checkin.record")!.inputSchema.required).toEqual(["itemId"]);
        expect(Object.keys(byName.get("bridge.ping")!.inputSchema.properties)).toEqual([]);
    });

    it("只读/写分类与破坏性标注符合 MCP 安全模型", () => {
        const defs = buildToolDefs();
        const byName = new Map(defs.map((t) => [t.name, t]));
        expect(byName.get("bridge.ping")!.annotations.readOnlyHint).toBe(true);
        expect(byName.get("checkin.summary")!.annotations.readOnlyHint).toBe(true);
        expect(byName.get("events.pull")!.annotations.readOnlyHint).toBe(true);
        expect(byName.get("checkin.record")!.write).toBe(true);
        expect(byName.get("commands.run")!.write).toBe(true);
        expect(byName.get("plugin.api")!.annotations.destructiveHint).toBe(true);
        expect(byName.get("workflow.execute")!.annotations.destructiveHint).toBe(true);
        expect(byName.get("commands.run")!.annotations.destructiveHint).toBe(false);
    });

    it("filterTools：writeEnabled=false 隐藏全部写工具，true 全暴露", () => {
        const defs = buildToolDefs();
        expect(filterTools(defs, false).some((t) => t.write)).toBe(false);
        expect(filterTools(defs, true).length).toBe(defs.length);
    });
});

describe("MCP stdio 服务器核心", () => {
    it("initialize 返回协议版本与 capabilities", async () => {
        const s = createMcpServer(fakeClient(), { writeEnabled: false, version: "0.6.5" });
        const r = await s.handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
        expect((r!.result as Record<string, unknown>).protocolVersion).toBe("2024-11-05");
        expect(((r!.result as Record<string, unknown>).serverInfo as Record<string, unknown>).name).toBe("lv-quickgate");
    });

    it("tools/list 在 writeEnabled=false 时不返回写工具；=true 时 39 个全暴露", async () => {
        const ro = createMcpServer(fakeClient(), { writeEnabled: false, version: "0.6.5" });
        const roList = ((await ro.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }))!.result as { tools: { name: string }[] }).tools;
        expect(roList.length).toBeGreaterThan(0);
        expect(new Set(ALL_OPS).size).toBe(39);
        expect(roList.length).toBeLessThan(27);

        const rw = createMcpServer(fakeClient(), { writeEnabled: true, version: "0.6.5" });
        const rwList = ((await rw.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }))!.result as { tools: { name: string }[] }).tools;
        expect(rwList.length).toBe(39);
    });

    it("tools/call 只读工具走 fast 通道、写工具在 writeEnabled=false 时被拒（known 提示）", async () => {
        const ok = fakeClient([{ id: "id-1", status: "recorded", data: { pollMs: 750 } }]);
        const s = createMcpServer(ok, { writeEnabled: false, version: "0.6.5" });
        const r = await s.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "bridge.ping", arguments: {} } });
        expect((r!.result as { isError: boolean }).isError).toBe(false);
        expect(String((r!.result as { content: { text: string }[] }).content[0].text)).toContain('"recorded"');
        expect(ok.sent[0].via).toBe("fast");

        const denied = fakeClient();
        const s2 = createMcpServer(denied, { writeEnabled: false, version: "0.6.5" });
        const r2 = await s2.handleRequest({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "checkin.record", arguments: {} } });
        expect((r2!.result as { isError: boolean }).isError).toBe(true);
        expect((r2!.result as { content: { text: string }[] }).content[0].text).toContain("LV_MCP_WRITE");
        expect(denied.sent.length).toBe(0);
    });

    it("写工具在 writeEnabled=true 时走 NDJSON 慢路径；回执非 recorded → isError", async () => {
        const bad = fakeClient([{ id: "id-1", status: "rejected", message: "note 超长" }]);
        const s = createMcpServer(bad, { writeEnabled: true, version: "0.6.5" });
        const r = await s.handleRequest({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "checkin.record", arguments: { itemId: "x" } } });
        expect((r!.result as { isError: boolean }).isError).toBe(true);
        expect(bad.sent[0].via).toBe("ndjson");
        expect(bad.sent[0].op).toBe("checkin.record");
    });

    it("未知方法 -32601；通知（无 id）不回包；坏请求 -32600", async () => {
        const s = createMcpServer(fakeClient(), { writeEnabled: false, version: "0.6.5" });
        const e1 = await s.handleRequest({ jsonrpc: "2.0", id: 5, method: "resources/list" });
        expect((e1!.error as { code: number }).code).toBe(-32601);
        expect(await s.handleRequest({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
        const e2 = await s.handleRequest({ jsonrpc: "2.0", id: 6 } as never);
        expect((e2!.error as { code: number }).code).toBe(-32600);
    });

    it("快路径 3s 无回执 → 同 id NDJSON 补发（bug#10 自愈，预留语义防双执行）", async () => {
        const c = fakeClient([]); // 永无回执
        const s = createMcpServer(c, { writeEnabled: false, version: "0.6.5" });
        const r = await s.handleRequest({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "bridge.ping", arguments: {} } });
        // fast 推过一次、NDJSON 补发过一次（同 id），最终诚实 timeout
        expect(c.sent.map((x) => x.via)).toEqual(["fast", "ndjson"]);
        expect((r!.result as { isError: boolean }).isError).toBe(true);
    });

    it("KERNEL_OPS 优先内核同步路由；路由失败回退快路径（R49）", async () => {
        // registry.list ∈ KERNEL_OPS：exec 可用 → 走 kernel 通道，同步回执，不落 NDJSON
        const ok = fakeClient([], { execImpl: async () => ({ status: "recorded", data: { channel: "kernel-sync" }, message: "内核诊断（脱敏）" }) });
        const s = createMcpServer(ok, { writeEnabled: false, version: "0.6.5" });
        const r = await s.handleRequest({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "registry.list", arguments: {} } });
        expect(ok.sent[0].via).toBe("kernel");
        expect((r!.result as { isError: boolean }).isError).toBe(false);

        // exec 抛错（路由 404 等）→ 回退 fast（registry.list 只读）
        const fallback = fakeClient([{ id: "id-1", status: "recorded" }], { execImpl: async () => { throw new Error("内核路由 HTTP 404"); } });
        const s2 = createMcpServer(fallback, { writeEnabled: false, version: "0.6.5" });
        const r2 = await s2.handleRequest({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "registry.list", arguments: {} } });
        expect(fallback.sent.map((x) => x.via)).toEqual(["kernel", "fast"]);
        expect((r2!.result as { isError: boolean }).isError).toBe(false);

        // 无 callKernelRoute 的客户端（旧形态）→ 直接 fast，不受影响
        const legacy = fakeClient([{ id: "id-1", status: "recorded" }]);
        delete (legacy as Partial<BridgeClient>).callKernelRoute;
        const s3 = createMcpServer(legacy, { writeEnabled: false, version: "0.6.5" });
        await s3.handleRequest({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "registry.list", arguments: {} } });
        expect(legacy.sent[0].via).toBe("fast");
    });
});
