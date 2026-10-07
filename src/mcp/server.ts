/**
 * MCP stdio 服务器核心（协议：JSON-RPC 2.0，换行分帧；方法面=initialize/ping/tools/list/tools/call）。
 * 纯请求→响应函数，无 IO——stdio 循环在 main.ts，单测直接打 handleRequest。
 * 安全模型见 src/mcp/README.md：writeEnabled=false 时写工具不进 tools/list，tools/call 调用也拒绝。
 */
import { buildToolDefs, filterTools, validateArgs } from "./tools.ts";
import type { McpToolDef } from "./tools.ts";
import { KERNEL_OPS } from "../ops.ts";

/** stdio 并发上限（L560）：超限立即回 -32000，防并发调用把 NDJSON 写者放大成队列竞争 */
export const MCP_MAX_IN_FLIGHT = 4;

/** 简易并发闸：granted 计数当前持有配额的任务；main.ts 的 stdio 循环据此拒超限请求 */
export function createLimiter(max: number) {
    let inFlight = 0;
    return {
        get inFlight() { return inFlight; },
        tryAcquire(): boolean {
            if (inFlight >= max) return false;
            inFlight += 1;
            return true;
        },
        release() { inFlight = Math.max(0, inFlight - 1); },
    };
}

export interface BridgeClient {
    send(op: string, args: Record<string, unknown>): Promise<string>;
    sendFast?(op: string, args: Record<string, unknown>): Promise<string>;
    /** 内核同步路由（KERNEL_OPS 专属）；失败时调用方回退慢路径 */
    callKernelRoute?(op: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
    waitReceipt(id: string, maxMs?: number, op?: string): Promise<Record<string, unknown>>;
    readonly maxWaitMs: number;
}export interface JsonRpcRequest {
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
                // L562：schema 本地校验 → -32602（协议级 invalid params），与工具执行失败（isError）分离，
                // 且不再消耗桥队列槽位等前端回执
                const invalid = validateArgs(def, args);
                if (invalid) return err(id, -32602, `参数校验失败：${invalid}`);
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
                    let sent: string;
                    let waitMs = name === "commands.run" || name === "workflow.execute" ? 35000 : client.maxWaitMs;
                    if (useFast && client.sendFast) {
                        sent = await client.sendFast(name, args);
                        // bug#10（R81）：SSE 订阅断连退避窗口内快路径无人消费——3s 无回执即
                        // **同 id** 走 NDJSON 补发（D-0012 预留语义：先到者执行、后到者 duplicate，
                        // 不会双执行），订阅缺口自愈且毫秒级场景不受影响
                        const early = await client.waitReceipt(sent, 3000, name);
                        const m = (client as { metrics?: { fastHits: number; fallbackResends: number } }).metrics;
                        if (early.status !== "timeout") {
                            if (m) m.fastHits += 1;
                            const st = String(early.status ?? "");
                            return result(id, JSON.stringify(early, null, 2), !OK_STATUSES.has(st));
                        }
                        else if (m) m.fallbackResends += 1;
                        sent = await client.send(name, args);
                    } else {
                        sent = await client.send(name, args);
                    }
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
