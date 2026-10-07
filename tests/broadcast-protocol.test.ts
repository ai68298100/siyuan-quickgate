/**
 * L608 部分：广播 SSE 协议边界电池（WHATWG 语义对照）。
 * 协议门禁（固化为测试）：广播 message **必须是单行 JSON 信封**——
 * 内核 postMessage 的 message 本就是单字符串，客户端不做多行 data: 拼接
 * （WHATWG 的多 data 行聚合语义不适用本通道，多行 JSON 将被静默拒绝）。
 * id/Last-Event-ID 语义：广播是即时命令流、不回放历史，重连不带 Last-Event-ID。
 */
import { describe, expect, it } from "vitest";
import { BroadcastSubscriber, BROADCAST_CHANNEL } from "../src/services/broadcast";
import { BridgeCommand } from "../src/types/bridge";

function makeStream(signal?: AbortSignal) {
    const chunks: string[] = [];
    let closed = false;
    let notify: (() => void) | null = null;
    const wake = () => { const w = notify; notify = null; w?.(); };
    signal?.addEventListener("abort", wake);
    return {
        body: {
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
        },
        push: (line: string) => { chunks.push(line); wake(); },
        close: () => { closed = true; wake(); },
    };
}

const envelopeLine = (id: string) => `data:${JSON.stringify({ v: 1, id, op: "bridge.ping", args: {}, createdAt: new Date().toISOString() })}\n`;

function makeSub(got: BridgeCommand[], streamRef: { current: ReturnType<typeof makeStream> | null }, requestLog: Array<{ url: string; headers: Record<string, string> }>) {
    return new BroadcastSubscriber({
        enabled: () => true,
        onCommand: async (cmd) => { got.push(cmd); },
        fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
            requestLog.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
            streamRef.current = makeStream(init?.signal);
            return { ok: true, status: 200, body: streamRef.current.body } as unknown as Response;
        }) as unknown as typeof fetch,
    });
}

describe("L608 · 广播 SSE 协议边界电池", () => {
    it("CRLF 帧（\\r\\n）正常消费——trim 剥离回车", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const reqLog: Array<{ url: string; headers: Record<string, string> }> = [];
        const sub = makeSub(got, streamRef, reqLog);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        streamRef.current!.push(`data:${JSON.stringify({ v: 1, id: "crlf-1", op: "bridge.ping", args: {}, createdAt: new Date().toISOString() })}\r\n`);
        await new Promise((r) => setTimeout(r, 120));
        await sub.stop();
        expect(got.map((c) => c.id)).toEqual(["crlf-1"]);
    });

    it("一条信封跨 chunk 分片（TCP 分片）→ 缓冲组装后消费", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const sub = makeSub(got, streamRef, []);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        const full = envelopeLine("split-1");
        streamRef.current!.push(full.slice(0, 18));   // 前半（无换行）
        await new Promise((r) => setTimeout(r, 60));
        expect(got.length).toBe(0);                    // 半行不消费
        streamRef.current!.push(full.slice(18));       // 后半含换行
        await new Promise((r) => setTimeout(r, 120));
        expect(got.map((c) => c.id)).toEqual(["split-1"]);
        await sub.stop();
    });

    it("EOF 前没有换行的 data 尾帧仍消费，避免断流丢最后一条命令", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const sub = makeSub(got, streamRef, []);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        streamRef.current!.push(envelopeLine("eof-tail").replace(/\n$/, ""));
        streamRef.current!.close();
        await new Promise((r) => setTimeout(r, 120));
        expect(got.map((c) => c.id)).toEqual(["eof-tail"]);
        expect(sub.metrics).toMatchObject({ frames: 1, received: 1, dropped: 0 });
        await sub.stop();
    });

    it("UTF-8 BOM 开头 → TextDecoder 剥离，首条仍消费", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const sub = makeSub(got, streamRef, []);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        streamRef.current!.push("\uFEFF" + envelopeLine("bom-1"));
        await new Promise((r) => setTimeout(r, 120));
        expect(got.map((c) => c.id)).toEqual(["bom-1"]);
        await sub.stop();
    });

    it("协议门禁：多行 JSON 信封（pretty-printed）被静默拒绝且不崩流——后续合法行继续消费", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const sub = makeSub(got, streamRef, []);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        const pretty = JSON.stringify({ v: 1, id: "pretty-1", op: "bridge.ping", args: {}, createdAt: new Date().toISOString() }, null, 2);
        streamRef.current!.push(`data:{\n`);                 // 多行 JSON 第一行 → 门禁拒绝（不拼接）
        await new Promise((r) => setTimeout(r, 60));
        streamRef.current!.push(`data:"v":1\n`);             // 后续行同样各自被拒
        await new Promise((r) => setTimeout(r, 60));
        streamRef.current!.push(envelopeLine("after-pretty")); // 流未崩，合法行继续
        await new Promise((r) => setTimeout(r, 120));
        expect(got.map((c) => c.id)).toEqual(["after-pretty"]);
        await sub.stop();
    });

    it("id:/Last-Event-ID 语义：EOF 后立即重连且不带 Last-Event-ID 头（广播不回放历史）", async () => {
        const got: BridgeCommand[] = [];
        const streamRef = { current: null as ReturnType<typeof makeStream> | null };
        const reqLog: Array<{ url: string; headers: Record<string, string> }> = [];
        const sub = makeSub(got, streamRef, reqLog);
        sub.start();
        await new Promise((r) => setTimeout(r, 15));
        expect(reqLog.length).toBe(1);
        streamRef.current!.push(`id:42\n`);                  // id 行忽略（不记忆位点）
        streamRef.current!.close();                          // EOF → 正常结束不抛错，runLoop 静默立即重连
        await new Promise((r) => setTimeout(r, 300));
        expect(reqLog.length).toBeGreaterThanOrEqual(2);     // 重连发生
        expect(got).toEqual([]);                             // 不回放
        const last = reqLog[reqLog.length - 1];
        expect(last.url).toContain(`/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`);
        expect(JSON.stringify(last.headers).toLowerCase()).not.toContain("last-event-id");
        await sub.stop();
    });
});
