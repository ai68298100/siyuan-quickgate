/**
 * L562/L560/L555 MCP 加固：统一参数校验（-32602 分离）、stdio 并发闸、共享回执监视器。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildToolDefs, validateArgs } from "../src/mcp/tools";
import { createMcpServer, createLimiter, MCP_MAX_IN_FLIGHT, BridgeClient } from "../src/mcp/server";
import { ReceiptHub } from "../src/mcp/bridge-client";

const defs = buildToolDefs();
const byName = new Map(defs.map((t) => [t.name, t]));

describe("L562 validateArgs（统一参数校验）", () => {
    it("required 缺失/空串 → 报错并指名参数", () => {
        const def = byName.get("commands.run")!;
        expect(validateArgs(def, {})).toContain("plugin");
        expect(validateArgs(def, { plugin: "siyuan-checkin" })).toContain("command");
        expect(validateArgs(def, { plugin: "siyuan-checkin", command: "   " })).toContain("command");
    });

    it("错型拦截（number/array/object），合法放行，未声明字段不拦", () => {
        const def = byName.get("checkin.record")!;
        expect(validateArgs(def, { itemId: "x", value: "3" })).toContain("number");
        const pull = byName.get("events.pull")!;
        expect(validateArgs(pull, { names: "not-array" })).toContain("array");
        expect(validateArgs(pull, { names: ["a"], limit: 5, undeclared: { x: 1 } })).toBeNull();
        expect(validateArgs(byName.get("bridge.ping")!, {})).toBeNull();
    });
});

describe("L562 server -32602 分离", () => {
    function fakeClient(): BridgeClient & { sent: unknown[] } {
        const sent: unknown[] = [];
        return {
            sent,
            maxWaitMs: 50,
            send: async () => { sent.push(1); return "id-1"; },
            waitReceipt: async (id) => ({ id, status: "recorded", message: "ok" }),
        };
    }

    it("缺必填 → JSON-RPC -32602（协议错误），不消耗桥调用", async () => {
        const client = fakeClient();
        const server = createMcpServer(client, { writeEnabled: true, version: "test" });
        const resp = await server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "commands.run", arguments: {} } });
        expect((resp as { error?: { code: number } }).error?.code).toBe(-32602);
        expect((resp as { error?: { message: string } }).error?.message).toContain("plugin");
        expect(client.sent).toHaveLength(0);
    });

    it("合法调用不受影响（result 正常返回）", async () => {
        const client = fakeClient();
        const server = createMcpServer(client, { writeEnabled: true, version: "test" });
        const resp = await server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "bridge.ping", arguments: {} } });
        expect((resp as { result?: { isError?: boolean } }).result?.isError).toBe(false);
    });
});

describe("L560 stdio 并发闸", () => {
    it("配额内可获取，超限拒绝，释放后恢复", () => {
        const limiter = createLimiter(MCP_MAX_IN_FLIGHT);
        expect(MCP_MAX_IN_FLIGHT).toBe(4);
        for (let i = 0; i < MCP_MAX_IN_FLIGHT; i++) expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(false);
        expect(limiter.inFlight).toBe(MCP_MAX_IN_FLIGHT);
        limiter.release();
        expect(limiter.tryAcquire()).toBe(true);
    });
});

describe("L555 ReceiptHub（共享回执监视器）", () => {
    it("同 tick 内按 id 分发；无等待者自动停表", async () => {
        let reads = 0;
        const hub = new ReceiptHub(async () => {
            reads += 1;
            return reads === 1 ? [] : [`{"id":"a","status":"recorded"}`, `{"id":"b","status":"failed"}`];
        }, 20);
        const pa = hub.wait("a", 2000);
        const pb = hub.wait("b", 2000);
        const [ra, rb] = await Promise.all([pa, pb]);
        expect(ra.status).toBe("recorded");
        expect(rb.status).toBe("failed");
        expect(hub.size).toBe(0);
    });

    it("超时返回 timeout 形状", async () => {
        const hub = new ReceiptHub(async () => [], 20);
        const r = await hub.wait("never", 60);
        expect(r.status).toBe("timeout");
        expect(hub.size).toBe(0);
    });
});

describe("MCP 源码态运行纪律（node --experimental-strip-types 不支持参数属性，R292 实测踩坑）", () => {
    it("src/mcp/*.ts 不得使用 constructor 参数属性", () => {
        const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "mcp");
        for (const f of ["bridge-client.ts", "server.ts", "main.ts", "tools.ts"]) {
            const src = readFileSync(path.join(srcDir, f), "utf-8");
            expect(src, `${f} 使用了参数属性（strip-only 模式直接 SyntaxError）`).not.toMatch(/constructor\s*\(\s*(private|public|protected|readonly)\b/);
        }
    });
});
