/**
 * MCP stdio 服务器核心（协议：JSON-RPC 2.0，换行分帧；方法面=initialize/ping/tools/list/tools/call）。
 * 纯请求→响应函数，无 IO——stdio 循环在 main.ts，单测直接打 handleRequest。
 * 安全（docs/10 §3.14）：writeEnabled=false 时写工具不进 tools/list，tools/call 调用也拒绝。
 */
import { buildToolDefs, filterTools } from "./tools.ts";
import type { McpToolDef } from "./tools.ts";
import { KERNEL_OPS } from "../ops.ts";

export interface BridgeClient {
    send(op: string, args: Record<string, unknown>): Promise<string>;
    sendFast?(op: string, args: Record<string, unknown>): Promise<string>;
    /** 内核同步路由（KERNEL_OPS 专属）；失败时调用方回退慢路径 */
    callKernelRoute?(op: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
    waitReceipt(id: string, maxMs?: number, op?: string): Promise<Record<string, unknown>>;
    readonly maxWaitMs: number;
}

export interface JsonRpcRequest {
    jsonrpc?: string;
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2024-11-05";
const OK_STATUSES = new Set(["recorded", "duplicate"]);

export function createMcpServer(client: BridgeClient, opts: { writeEnabled: boolean; version: string }) {
    const allDefs = buildToolDefs();
    const visibleDefs: McpToolDef[] = filterTools(allDefs, opts.writeEnabled);
    const visibleByName = new Map(visibleDefs.map((t) => [t.name, t]));

    async function handleRequest(req: JsonRpcRequest): Promise<Record<string, unknown> | null> {
        if (!req || typeof req.method !== "string") {
            return err(null, -32600, "请求缺少 method");
        }
        const isNotification = req.id === undefined || req.id === null;
        const id = req.id ?? null;
        switch (req.method) {
            case "initialize":
                return {
                    jsonrpc: "2.0",
                    id,
                    result: {
                        protocolVersion: PROTOCOL_VERSION,
                        capabilities: { tools: { listChanged: false } },
                        serverInfo: { name: "lv-quickgate", version: opts.version },
                    },
                };
            case "notifications/initialized":
                return null; // 通知不回包
            case "ping":
                return { jsonrpc: "2.0", id, result: {} };
            case "tools/list":
                return {
                    jsonrpc: "2.0",
                    id,
                    result: {
                        tools: visibleDefs.map((t) => ({
                            name: t.name,
                            description: t.description,
                            inputSchema: t.inputSchema,
                            annotations: t.annotations,
                        })),
                    },
                };
            case "tools/call": {
                const name = typeof req.params?.name === "string" ? req.params.name : "";
                const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
                if (!name) return err(id, -32602, "tools/call 缺少 name");
                const def = visibleByName.get(name);
                if (!def) {
                    const known = allDefs.some((t) => t.name === name);
                    return result(id, `工具不可用：${name}${known ? "（写操作需 LV_MCP_WRITE=1 显式开启）" : "（未知工具）"}`, true);
                }
                try {
                    const kernelOp = (KERNEL_OPS as readonly string[]).includes(name) && typeof client.callKernelRoute === "function";
                    if (kernelOp && client.callKernelRoute) {
                        // 内核同步路由（~100ms；桥开关默认关也可用）；失败回退下方慢路径
                        try {
                            const receipt = await client.callKernelRoute(name, args);
                            const status = String(receipt.status ?? "");
                            return result(id, JSON.stringify(receipt, null, 2), !OK_STATUSES.has(status));
                        } catch { /* 路由未放行/插件缺席 → 回退（只读走 fast，其余 NDJSON） */ }
                    }
                    const useFast = def.annotations.readOnlyHint && typeof client.sendFast === "function";
                    const sent = useFast && client.sendFast ? await client.sendFast(name, args) : await client.send(name, args);
                    const waitMs = name === "commands.run" || name === "workflow.execute" ? 35000 : client.maxWaitMs;
                    const receipt = await client.waitReceipt(sent, waitMs, name);
                    const status = String(receipt.status ?? "");
                    return result(id, JSON.stringify(receipt, null, 2), !OK_STATUSES.has(status));
                } catch (e) {
                    return result(id, `调用失败：${e instanceof Error ? e.message : String(e)}`, true);
                }
            }
            default:
                if (isNotification) return null;
                return err(id, -32601, `未知方法：${req.method}`);
        }
    }

    return { handleRequest, toolCount: visibleDefs.length };
}

function result(id: string | number | null, text: string, isError: boolean): Record<string, unknown> {
    return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text }], isError },
    };
}

function err(id: string | number | null, code: number, message: string): Record<string, unknown> {
    return { jsonrpc: "2.0", id, error: { code, message } };
}
