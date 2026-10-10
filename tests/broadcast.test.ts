import { describe, expect, it } from "vitest";
import { BroadcastSubscriber, BROADCAST_CHANNEL } from "../src/services/broadcast";
import { BridgeCommand } from "../src/types/bridge";

/** 可编程 SSE 流（Promise 驱动）：push(line) 注入一行；close() 结束流；abort 唤醒挂起 read */
function makeStream(signal?: AbortSignal) {
    const chunks: string[] = [];
    let closed = false;
    let notify: (() => void) | null = null;
    const wake = () => { const w = notify; notify = null; w?.(); };
    signal?.addEventListener("abort", wake);
    const stream = {
        getReader: () => ({
            read: async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
                while (chunks.length === 0 && !closed && !signal?.aborted) {
                    await new Promise<void>((r) => { notify = r; });
                }
                if (signal?.aborted) throw new DOMException("aborted", "AbortError");
                if (chunks.length > 0) return { done: false, value: new TextEncoder().encode(chunks.shift()!) };
                return { done: true, value: undefined };
            },
        }),
        cancel: () => { closed = true; wake(); },
    };
    return {
        body: stream,
        push: (line: string) => { chunks.push(line); wake(); },
        close: () => { closed = true; wake(); },
    };
}

const cmdEnvelope = (id: string, op = "bridge.ping") => JSON.stringify({ v: 1, id, op, args: {}, createdAt: new Date().toISOString() });

describe("BroadcastSubscriber（v1.5 广播快路径）", () => {
    it("SSE data 帧解析→onCommand；非 data 行/坏信封静默", async () => {
        let stream: ReturnType<typeof makeStream> | null = null;
        const got: BridgeCommand[] = [];
        const sub = new BroadcastSubscriber({
            enabled: () => true,
            onCommand: async (cmd) => { got.push(cmd); },
            fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
                stream = makeStream(init?.signal);
                return { ok: true, status: 200, body: stream.body } as unknown as Response;
            }) as unknown as typeof fetch,
        });
        sub.start();
        await new Promise((r) => setTimeout(r, 15));   // 等连接建立
        stream!.push(`: ping\n`);                       // SSE 注释行 → 忽略
        stream!.push(`event:qg-cmd\n`);                 // 事件行 → 忽略
        stream!.push(`data:${cmdEnvelope("a")}\n\n`);   // 合法信封 → 执行
        stream!.push(`data:{bad json}\n`);              // 坏信封 → 静默
        stream!.push(`data:\n`);                        // 空载荷 → 静默
        await new Promise((r) => setTimeout(r, 120));
        await sub.stop();                               // abort → read 以 AbortError 退出
        expect(got.map((c) => c.id)).toEqual(["a"]);
        expect(got[0].op).toBe("bridge.ping");
        expect(BROADCAST_CHANNEL).toBe("qg-cmd");
        expect(sub.metrics).toMatchObject({ frames: 3, dropped: 2, received: 1, errors: 0 });
    });

    it("消费回调异常计入错误但后续帧仍继续消费", async () => {
        let stream: ReturnType<typeof makeStream> | null = null;
        const got: string[] = [];
        const sub = new BroadcastSubscriber({
            enabled: () => true,
            onCommand: async (cmd) => {
                got.push(cmd.id);
                if (cmd.id === "throws") throw new Error("handler failed");
            },
            fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
                stream = makeStream(init?.signal);
                return { ok: true, status: 200, body: stream.body } as unknown as Response;
            }) as unknown as typeof fetch,
        });
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        stream!.push(`data:${cmdEnvelope("throws")}\n`);
        stream!.push(`data:${cmdEnvelope("after-error")}\n`);
        await new Promise((r) => setTimeout(r, 120));
        await sub.stop();
        expect(got).toEqual(["throws", "after-error"]);
        expect(sub.metrics).toMatchObject({ frames: 2, dropped: 0, received: 2, errors: 1 });
        expect(sub.metrics.lastErrorAt).toEqual(expect.any(Number));
    });

    it("断流→指数退避重连后继续消费", async () => {
        let attempts = 0;
        const got: string[] = [];
        const sub = new BroadcastSubscriber({
            enabled: () => true,
            onCommand: async (cmd) => { got.push(cmd.id); },
            fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
                attempts += 1;
                if (attempts === 1) throw new Error("conn refused");   // 首连失败 → 退避重连
                const s = makeStream(init?.signal);
                setTimeout(() => s.push(`data:${cmdEnvelope("b")}\n`), 10);
                return { ok: true, status: 200, body: s.body } as unknown as Response;
            }) as unknown as typeof fetch,
            sleepImpl: async () => {},   // 退避不等待，加速测试
        });
        sub.start();
        await new Promise((r) => setTimeout(r, 120));
        await sub.stop();
        expect(attempts).toBeGreaterThanOrEqual(2);
        expect(got).toEqual(["b"]);
    });

    it("enabled=false 时不建立连接", async () => {
        let attempts = 0;
        const sub = new BroadcastSubscriber({
            enabled: () => false,
            onCommand: async () => {},
            fetchImpl: (async () => { attempts += 1; return { ok: true, status: 200, body: makeStream().body }; }) as unknown as typeof fetch,
            // 注意：idle 分支的 sleep 必须让出宏任务；零延时会饿死事件循环（测试自己的 setTimeout 永远不触发）
            sleepImpl: async () => { await new Promise((r) => setTimeout(r, 5)); },
        });
        sub.start();
        await new Promise((r) => setTimeout(r, 30));
        await sub.stop();
        expect(attempts).toBe(0);
    });
});

describe("executeAndRecord（预留语义）", () => {
    it("同一 id 双通道到达：先到者执行，后到者跳过（不双执行、不重复回执）", async () => {
        const { BridgeService } = await import("../src/services/bridge-service");
        const { BridgeStore } = await import("../src/services/store");
        const { KernelApi } = await import("../src/services/kernelApi");

        class MemKernel {
            files = new Map<string, string>();
            api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
                const u = String(url);
                const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
                if (u === "/api/file/getFile") {
                    const text = this.files.get(body.path);
                    return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
                }
                if (u === "/api/file/putFile") {
                    const form = init?.body as FormData;
                    this.files.set(String(form.get("path")), await (form.get("file") as File).text());
                    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0 }) } as Response;
                }
                return { ok: false, status: 404, text: async () => "{}" } as Response;
            }) as unknown as typeof fetch);
        }
        const mem = new MemKernel();
        const store = new BridgeStore({ load: async () => null, save: async () => {} });
        const service = new BridgeService({
            api: mem.api,
            store,
            settings: () => ({
                schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
                confirmExec: false, blacklist: [], auditMax: 200,
                rawApiEnabled: false, rawApiAllowlist: [], broadcastEnabled: false,
                bridgeBasePath: "/bridge", deviceName: "dev-a",
            }),
            pluginName: "siyuan-quickgate",
            pluginVersion: "0.6.0",
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
            getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined,
        });

        const cmd: BridgeCommand = { v: 1, id: "bc-1", op: "bridge.ping", args: {}, createdAt: new Date().toISOString() };
        const first = await service.executeAndRecord(cmd);
        expect(first.executed).toBe(true);
        expect(first.receipt?.status).toBe("recorded");

        // NDJSON tick 后到：同一 id 已在台账 → 跳过（不产生第二条回执）
        mem.files.set("/bridge/commands.ndjson", JSON.stringify(cmd));
        const tick = await service.tick();
        expect(tick.executed).toBe(0);
        expect(tick.receipts).toBe(0);

        // 结果文件里只有一条回执
        const results = mem.files.get("/bridge/results.ndjson") ?? "";
        expect(results.trim().split("\n").length).toBe(1);
    });

    it("device 路由与过期：非目标设备/过期命令不执行", async () => {
        const { BridgeService } = await import("../src/services/bridge-service");
        const { BridgeStore } = await import("../src/services/store");
        const { KernelApi } = await import("../src/services/kernelApi");
        const noopFetch = (async () => ({ ok: false, status: 404, text: async () => "" }) as unknown as Response) as unknown as typeof fetch;
        const mk = () => new BridgeService({
            api: new KernelApi(noopFetch),
            store: new BridgeStore({ load: async () => null, save: async () => {} }),
            settings: () => ({
                schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
                confirmExec: false, blacklist: [], auditMax: 200,
                rawApiEnabled: false, rawApiAllowlist: [], broadcastEnabled: false,
                bridgeBasePath: "/bridge", deviceName: "dev-a",
            }),
            pluginName: "siyuan-quickgate",
            pluginVersion: "0.6.0",
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
            getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined,
        });
        const other = await mk().executeAndRecord({ v: 1, id: "d1", op: "bridge.ping", args: {}, createdAt: new Date().toISOString(), device: "dev-b" });
        expect(other.executed).toBe(false);
        const expiredAt = new Date(Date.now() - 60000).toISOString();
        const exp = await mk().executeAndRecord({ v: 1, id: "e1", op: "bridge.ping", args: {}, createdAt: expiredAt, ttlMs: 1000 });
        expect(exp.executed).toBe(false);
        expect(exp.receipt?.status).toBe("expired");
    });

    it("过期信封入台账：同一信封重放（SSE 重投/NDJSON 补扫）不重复回执不重复计数（R69-P1 回归）", async () => {
        const { BridgeService } = await import("../src/services/bridge-service");
        const { BridgeStore } = await import("../src/services/store");
        const { KernelApi } = await import("../src/services/kernelApi");
        const noopFetch = (async () => ({ ok: false, status: 404, text: async () => "" }) as unknown as Response) as unknown as typeof fetch;
        const store = new BridgeStore({ load: async () => null, save: async () => {} });
        const service = new BridgeService({
            api: new KernelApi(noopFetch),
            store,
            settings: () => ({
                schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
                confirmExec: false, blacklist: [], auditMax: 200,
                rawApiEnabled: false, rawApiAllowlist: [], broadcastEnabled: false,
                bridgeBasePath: "/bridge", deviceName: "dev-a",
            }),
            pluginName: "siyuan-quickgate",
            pluginVersion: "0.7.3",
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
            getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined,
        });
        const cmd: BridgeCommand = { v: 1, id: "ex-1", op: "bridge.ping", args: {}, createdAt: new Date(Date.now() - 60000).toISOString(), ttlMs: 1000 };
        const first = await service.executeAndRecord(cmd);
        expect(first.receipt?.status).toBe("expired");
        const expiredAfterFirst = service.stats.expired;
        // 同一信封重放：台账已记账 → 静默跳过（修复前：再次回 expired 回执且 expired 计数 +1）
        const replay = await service.executeAndRecord(cmd);
        expect(replay.executed).toBe(false);
        expect(replay.receipt).toBeUndefined();
        expect(service.stats.expired).toBe(expiredAfterFirst);
    });
});
