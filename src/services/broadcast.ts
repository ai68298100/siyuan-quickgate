/**
 * v1.5 广播快路径（spike⑤ 实证解锁，3.8.5 /es/broadcast 真机通过）：
 * 前端以 SSE 订阅内核广播频道 qg-cmd；外部客户端
 * `POST /api/broadcast/postMessage {channel:"qg-cmd", message:<信封JSON>}` 推命令，
 * 到达即经 executeAndRecord 执行（预留语义防双通道重复执行），回执写回 results.ndjson。
 * 与 NDJSON 慢路径并存：信封同形、幂等台账共用——先到者执行，后到者按 id 跳过。
 * 设置项 broadcastEnabled 默认关（新外部面红线）；断流指数退避重连（1s→30s 封顶）。
 */
import { parseLine } from "./envelope";
import { BridgeCommand } from "../types/bridge";

export const BROADCAST_CHANNEL = "qg-cmd";
const SSE_PATH = `/es/broadcast/subscribe?channel=${BROADCAST_CHANNEL}`;

export interface BroadcastDeps {
    enabled: () => boolean;
    /** 收到合法信封（v1、有 id/op）；设备路由/过期/幂等由 BridgeService.executeAndRecord 统一处理 */
    onCommand: (cmd: BridgeCommand) => Promise<void>;
    log?: (msg: string) => void;
    fetchImpl?: typeof fetch;
    sleepImpl?: (ms: number) => Promise<void>;
}

export class BroadcastSubscriber {
    private stopped = true;
    private loop: Promise<void> | null = null;
    private currentCtrl: AbortController | null = null;

    constructor(private deps: BroadcastDeps) {}

    start(): void {
        if (!this.stopped) return;
        this.stopped = false;
        this.loop = this.runLoop();
    }

    async stop(): Promise<void> {
        this.stopped = true;
        this.currentCtrl?.abort(); // 中断在读的 SSE 流（read() 以 AbortError 立即返回）
        await this.loop?.catch(() => {});
        this.loop = null;
    }

    get running(): boolean {
        return !this.stopped;
    }

    private async runLoop(): Promise<void> {
        const fetchImpl = this.deps.fetchImpl ?? fetch;
        const sleep = this.deps.sleepImpl ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
        let backoff = 1000;
        while (!this.stopped) {
            if (!this.deps.enabled()) {
                await sleep(2000);
                continue;
            }
            const ctrl = new AbortController();
            this.currentCtrl = ctrl;
            try {
                const resp = await fetchImpl(SSE_PATH, { signal: ctrl.signal });
                if (!resp.ok || !resp.body) throw new Error(`SSE HTTP ${resp.status}`);
                backoff = 1000;
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buf = "";
                while (!this.stopped) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    let idx: number;
                    while ((idx = buf.indexOf("\n")) >= 0) {
                        const line = buf.slice(0, idx).trim();
                        buf = buf.slice(idx + 1);
                        if (!line.startsWith("data:")) continue; // SSE 注释/事件行忽略，只取 data 帧
                        const payload = line.slice(5).trim();
                        if (!payload) continue;
                        try {
                            const parsed = parseLine(payload, 0);
                            if (parsed.kind !== "ok") continue; // 坏/空信封静默（外部面不回执）
                            await this.deps.onCommand(parsed.command);
                        } catch { /* 单条坏消息不影响流 */ }
                    }
                }
                try { reader.cancel?.(); } catch { /* 流已断 */ }
            } catch (e) {
                if (this.stopped || ctrl.signal.aborted) break;
                this.deps.log?.(`广播订阅断开，${backoff}ms 后重连：${e instanceof Error ? e.message : String(e)}`);
                await sleep(backoff);
                backoff = Math.min(backoff * 2, 30000);
            } finally {
                if (this.currentCtrl === ctrl) this.currentCtrl = null;
            }
        }
    }
}
