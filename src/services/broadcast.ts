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

/** SSE 观测指标；数值只描述当前前端实例，不是跨重启累计。 */
export interface BroadcastMetrics {
    connects: number;
    reconnects: number;
    /** 收到的 data: 行数（包括空载荷和被丢弃的坏载荷）。 */
    frames: number;
    /** 无法解析为合法单行信封而丢弃的 data: 行数。 */
    dropped: number;
    /** 连接错误或命令处理异常次数。 */
    errors: number;
    received: number;
    lastEventAt: number | null;
    lastErrorAt: number | null;
}

export class BroadcastSubscriber {
    private stopped = true;
    private loop: Promise<void> | null = null;
    private currentCtrl: AbortController | null = null;
    /** L553/R74 观测指标：连接、帧、丢弃、错误与最近时间（诊断包与设置页展示用）。 */
    readonly metrics: BroadcastMetrics = {
        connects: 0,
        reconnects: 0,
        frames: 0,
        dropped: 0,
        errors: 0,
        received: 0,
        lastEventAt: null,
        lastErrorAt: null,
    };

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
                // 仅统计真正拿到可读 SSE body 的连接；start() 可能因 disabled
                // 长时间空转，不能把“订阅意图”误报为已连接。
                this.metrics.connects += 1;
                backoff = 1000;
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buf = "";
                const consumeLine = async (rawLine: string): Promise<void> => {
                    const line = rawLine.trim();
                    if (!line.startsWith("data:")) return; // SSE 注释/事件行忽略，只取 data 帧
                    this.metrics.frames += 1;
                    const payload = line.slice(5).trim();
                    if (!payload) {
                        this.metrics.dropped += 1;
                        return;
                    }
                    try {
                        const parsed = parseLine(payload, 0);
                        if (parsed.kind !== "ok") {
                            this.metrics.dropped += 1;
                            return; // 坏/空信封静默（外部面不回执）
                        }
                        this.metrics.received += 1;
                        this.metrics.lastEventAt = Date.now();
                        try {
                            await this.deps.onCommand(parsed.command);
                        } catch (e) {
                            // 消费方异常不能杀死 SSE 流；保留错误计数并继续接收后续帧。
                            this.metrics.errors += 1;
                            this.metrics.lastErrorAt = Date.now();
                            this.deps.log?.(`广播命令处理失败：${e instanceof Error ? e.message : String(e)}`);
                        }
                    } catch {
                        this.metrics.dropped += 1;
                        /* 单条坏消息不影响流 */
                    }
                };
                while (!this.stopped) {
                    const { done, value } = await reader.read();
                    if (done) {
                        // 流可能在换行前断开。SSE 的 EOF 会派发尚未结束的 data 行；
                        // 刷出 TextDecoder 并消费尾帧，避免最后一条命令静默丢失。
                        buf += decoder.decode();
                        // stop() 与 read() 完成存在竞态：显式关闭后不再执行尾帧。
                        if (buf && !this.stopped && !ctrl.signal.aborted) {
                            const tail = buf;
                            buf = "";
                            await consumeLine(tail);
                        }
                        buf = "";
                        break;
                    }
                    buf += decoder.decode(value, { stream: true });
                    let idx: number;
                    while ((idx = buf.indexOf("\n")) >= 0) {
                        const line = buf.slice(0, idx);
                        buf = buf.slice(idx + 1);
                        await consumeLine(line);
                    }
                }
                try { reader.cancel?.(); } catch { /* 流已断 */ }
                // EOF 是即时广播流的正常断流，同样计入一次重连；不计为 error。
                if (!this.stopped && !ctrl.signal.aborted) this.metrics.reconnects += 1;
            } catch (e) {
                if (this.stopped || ctrl.signal.aborted) break;
                this.metrics.errors += 1;
                this.metrics.lastErrorAt = Date.now();
                this.metrics.reconnects += 1;
                this.deps.log?.(`广播订阅断开，${backoff}ms 后重连：${e instanceof Error ? e.message : String(e)}`);
                await sleep(backoff);
                // 退避上限 5s（bug#10，R81 真机实测：30s 上限时断连窗口内广播命令全部无人消费；
                // 本地回环重连成本极低，5s 保证订阅缺口快速愈合）
                backoff = Math.min(backoff * 2, 5000);
            } finally {
                if (this.currentCtrl === ctrl) this.currentCtrl = null;
            }
        }
    }
}
