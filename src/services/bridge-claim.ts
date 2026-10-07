/**
 * 桥消费权认领（TODO L452 · R69-P2 多窗口互斥）。
 * 问题：两个思源窗口各自实例的 processed 台账互相独立——同一命令 id 会被双窗口各执行一次
 * （写副作用双执行：重复打卡/重复建文档）。修法：Web Locks 认领「桥消费权」，同一时刻
 * 只有一个窗口跑轮询；未抢到的窗口诚实拒绝启动并提示。
 * 语义三态：handle=认领成功；null=被占用；undefined=环境无 Locks API（Electron renderer 均有；
 * 缺席时按单窗口假设放行——与旧行为一致，但以日志声明边界，不静默）。
 */
export interface BridgeClaimHandle {
    release(): Promise<void> | void;
}

export interface BridgeClaimer {
    claim(name: string, opts?: ClaimOptions): Promise<BridgeClaimHandle | null | undefined>;
    /** L571/L627 失联接管：steal 破坏已持锁（docs/34 §3.3）；5s 超时防环境不支持时挂死 */
    claimSteal?(name: string, opts?: ClaimOptions): Promise<BridgeClaimHandle | null | undefined>;
}

export interface ClaimOptions {
    /**
     * 被接管回调（docs/34 §3.4）：本窗口持有的锁被 steal 时，held promise 以 AbortError 拒绝——
     * 消费方必须在此**停止本窗口轮询**（否则与接管窗口双消费）。正常 release 不触发。
     */
    onStolen?: () => void;
}

/** Locks API 最小形状（仅用到的部分，避免引 DOM lib 差异） */
interface LocksLike {
    request(name: string, opts: { ifAvailable: boolean; steal?: boolean }, cb: (lock: unknown) => Promise<void> | void): Promise<void>;
}

/**
 * @param locks 可注入（单测）；缺省读 globalThis.navigator.locks（Electron renderer 均有）
 */
export function createNavigatorClaimer(locks?: LocksLike): BridgeClaimer | undefined {
    const api = locks ?? (globalThis as { navigator?: { locks?: LocksLike } }).navigator?.locks;
    if (!api || typeof api.request !== "function") return undefined;
    const requestLock = (name: string, opts: ClaimOptions & { ifAvailable: boolean; steal?: boolean }) =>
        new Promise<BridgeClaimHandle | null | undefined>((resolve) => {
            let settled = false;
            const done = (v: BridgeClaimHandle | null | undefined) => { if (!settled) { settled = true; resolve(v); } };
            let releaseResolve: (() => void) | undefined;
            const held = new Promise<void>((r) => { releaseResolve = r; });
            // 被 steal 打断时此 promise reject——通知消费方停止轮询（双消费防线，docs/34 §3.4）
            held.catch(() => { opts.onStolen?.(); });
            void api
                .request(name, opts, (lock) => {
                    if (!lock) {
                        done(null); // 被占用
                        return;
                    }
                    done({
                        release: async () => releaseResolve?.(),
                    });
                    return held; // 持锁直到 release
                })
                .catch(() => {
                    // 锁丢失（真实浏览器中被 steal 时 P1 拒绝；API 异常同理）→ 停止消费
                    // （fail-safe：与其双消费不如停机）。onStolen 通知宿主停轮询（docs/34 §3.4）。
                    opts.onStolen?.();
                    done(undefined);
                });
            if (opts.steal) setTimeout(() => done(undefined), 5000); // steal 不被支持时会排队等锁——超时防挂死
        });
    return {
        claim: (name, o) => requestLock(name, { ifAvailable: true, ...o }),
        claimSteal: (name, o) => requestLock(name, { ifAvailable: false, steal: true, ...o }),
    };
}
