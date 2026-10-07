/**
 * 单飞轮询器（阻断项5）：一次 tick 完成后才调度下一次，绝不重入。
 * 纯调度逻辑，tick 由外部注入 —— 单测用假 tick 验证：慢 tick 期间不重入、退避、停止语义。
 */

export interface PollerOptions {
    /** 基础轮询间隔 ms */
    intervalMs: number;
    /** 连续失败后的最大退避 ms */
    backoffMaxMs: number;
    /** tick：一次完整轮询（读取-执行-写回）。抛错视为失败计入退避；返回值仅作遥测 */
    tick: () => Promise<unknown>;
    /** 是否继续的判定（设置开关等）；返回 false 时循环退出 */
    shouldRun: () => boolean;
    delay?: (ms: number) => Promise<void>;
    now?: () => number;
}

export class SingleFlightPoller {
    private running = false;
    private failures = 0;
    private _lastTickMs = 0;
    private _lastDurationMs = 0;
    /** 当前 tick（若有）。停止时等待它完成，避免释放消费权后仍有旧 tick 写入。 */
    private activeTick?: Promise<unknown>;

    constructor(private opts: PollerOptions) {}

    get isRunning() {
        return this.running;
    }

    get consecutiveFailures() {
        return this.failures;
    }

    get lastTickMs() {
        return this._lastTickMs;
    }

    get lastDurationMs() {
        return this._lastDurationMs;
    }

    /** 当前生效间隔：连续失败时指数退避到 backoffMaxMs */
    currentInterval(): number {
        if (this.failures <= 0) return this.opts.intervalMs;
        const factor = Math.min(this.failures, 6); // 2^6 = 64 倍封顶后再由 backoffMax 兜底
        return Math.min(this.opts.intervalMs * Math.pow(2, factor), this.opts.backoffMaxMs);
    }

    start() {
        if (this.running) return;
        this.running = true;
        void this.loop();
    }

    /**
     * 请求停止并等待当前 tick 完成。
     *
     * `stop()` 仍然立即令循环不再调度下一轮；返回的 Promise 只等待已经开始的
     * tick，而不会等待退避定时器。生命周期关闭方可据此在释放 Web Lock/落盘前
     * 确认旧消费者已经退出，避免热重载时两个实例短暂并行写回。
     */
    async stop(): Promise<void> {
        this.running = false;
        // loop 自己会计数并吞掉 tick 错误；这里也必须吞掉同一 rejection，
        // 否则失败 tick 会阻止 stopBridge 继续释放消费权。
        await this.activeTick?.catch(() => {});
    }

    private async loop(): Promise<void> {
        const delay = this.opts.delay ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
        while (this.running && this.opts.shouldRun()) {
            const t0 = this.opts.now?.() ?? Date.now();
            let tick: Promise<unknown>;
            try {
                tick = this.opts.tick();
                this.activeTick = tick;
                await tick;
                this.failures = 0;
            } catch {
                this.failures += 1;
            } finally {
                this.activeTick = undefined;
            }
            const t1 = this.opts.now?.() ?? Date.now();
            this._lastTickMs = t1;
            this._lastDurationMs = t1 - t0;
            if (!this.running || !this.opts.shouldRun()) break;
            await delay(this.currentInterval());
        }
        this.running = false;
    }
}
