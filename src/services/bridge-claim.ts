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
    claim(name: string): Promise<BridgeClaimHandle | null | undefined>;
}

/** Locks API 最小形状（仅用到的部分，避免引 DOM lib 差异） */
interface LocksLike {
    request(name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void> | void): Promise<void>;
}

/**
 * @param locks 可注入（单测）；缺省读 globalThis.navigator.locks（Electron renderer 均有）
 */
export function createNavigatorClaimer(locks?: LocksLike): BridgeClaimer | undefined {
    const api = locks ?? (globalThis as { navigator?: { locks?: LocksLike } }).navigator?.locks;
    if (!api || typeof api.request !== "function") return undefined;
    return {
        claim: (name) =>
            new Promise((resolve) => {
                let releaseResolve: (() => void) | undefined;
                const held = new Promise<void>((r) => { releaseResolve = r; });
                void api
                    .request(name, { ifAvailable: true }, (lock) => {
                        if (!lock) {
                            resolve(null); // 被占用
                            return;
                        }
                        resolve({
                            release: async () => releaseResolve?.(),
                        });
                        return held; // 持锁直到 release
                    })
                    .catch(() => resolve(undefined)); // API 异常=环境不支持
            }),
    };
}
