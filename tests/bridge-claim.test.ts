import { describe, expect, it } from "vitest";
import { BridgeClaimer, BridgeClaimHandle, createNavigatorClaimer } from "../src/services/bridge-claim";

/** 可编程 Locks 假件：共享一个占用表，模拟多窗口 */
function makeLocksStore() {
    const held = new Map<string, symbol>();
    const waiters: Array<() => void> = [];
    const release = (name: string) => {
        held.delete(name);
        waiters.splice(0).forEach((w) => w());
    };
    const locks = {
        request: (name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void> | void): Promise<void> =>
            new Promise((resolve) => {
                const run = () => {
                    if (held.has(name)) {
                        if (opts.ifAvailable) { cb(null); resolve(); return; }
                        waiters.push(run); // 阻塞模式排队（本模块只用 ifAvailable）
                        return;
                    }
                    const token = Symbol(name);
                    held.set(name, token);
                    void Promise.resolve(cb({ name, token })).then(() => {
                        if (held.get(name) === token) release(name);
                        resolve();
                    });
                };
                run();
            }),
    };
    return { locks, release };
}

function claimerWith(locks: unknown): BridgeClaimer {
    const c = createNavigatorClaimer(locks as never);
    if (!c) throw new Error("claimer should exist when locks present");
    return c;
}

describe("bridge-claim（桥消费权认领 · L452）", () => {
    it("三态：空闲=handle；占用=null；无 Locks API=undefined", async () => {
        const store = makeLocksStore();
        const a = claimerWith(store.locks);
        const h: BridgeClaimHandle | null | undefined = await a.claim("qg-test");
        expect(h).toBeTruthy(); // 空闲 → 认领成功
        const b = claimerWith(store.locks);
        expect(await b.claim("qg-test")).toBeNull(); // 占用 → null

        expect(createNavigatorClaimer({} as never)).toBeUndefined(); // 无 request 方法=环境不支持

        await h!.release();
        const h2 = await b.claim("qg-test");
        expect(h2).toBeTruthy(); // 释放后可接管
        await h2!.release();
    });

    it("多窗口场景：第二窗口拿不到锁→不启动轮询（防同 id 双执行）；第一窗口释放→可接管", async () => {
        const store = makeLocksStore();
        const w1 = claimerWith(store.locks);
        const w2 = claimerWith(store.locks);
        const h1 = await w1.claim("siyuan-quickgate-bridge");
        expect(h1).toBeTruthy();
        const started: string[] = [];
        const tryStart = async (claimer: BridgeClaimer, win: string) => {
            const h = await claimer.claim("siyuan-quickgate-bridge");
            if (h) started.push(win);
            return h;
        };
        expect(await tryStart(w2, "win2")).toBeNull();
        expect(started).toEqual([]); // win2 被拒
        await h1!.release();
        expect(await tryStart(w2, "win2")).toBeTruthy(); // 释放后接管
        expect(started).toEqual(["win2"]);
    });
});

describe("L571/L627 · onStolen 被接管回调（docs/34 §3.4 双消费防线）", () => {
    /** 支持 steal 的假件：request 采纳 cb 返回的 promise（模拟 navigator.locks adoption）并记录其 reject；steal(name) 触发该 reject（原持有者 held reject） */
    function makeStealableLocks() {
        const rejects = new Map<string, (e: Error) => void>();
        return {
            locks: {
                request: (_name: string, _opts: Record<string, unknown>, cb: (lock: unknown) => Promise<void> | void): Promise<void> =>
                    new Promise<void>((res, rej) => {
                        const adopted = Promise.resolve(cb({ name: _name }));
                        adopted.then(res, rej);
                        rejects.set(_name, rej); // steal 时 reject → 采纳链整体 reject
                    }),
            },
            steal: (name: string) => {
                rejects.get(name)?.(new DOMException("aborted", "AbortError")); // 拆锁：原持有者 held reject → onStolen
            },
        };
    }

    it("claim：锁被他窗 steal（held reject）→ onStolen 触发；正常 release 不触发", async () => {
        let stolen = 0;
        let released = 0;
        const store = makeStealableLocks();
        const w = createNavigatorClaimer(store.locks as never)!;
        const h1 = await w.claim("siyuan-quickgate-bridge", { onStolen: () => { stolen += 1; } });
        expect(h1).toBeTruthy();
        // 正常 release → held resolve（非 reject）→ 不触发
        await h1.release();
        expect(stolen).toBe(0);
        expect(released).toBe(0);
        // 重新持有，然后被 steal
        const h2 = await w.claim("siyuan-quickgate-bridge", { onStolen: () => { released += 1; } });
        void h2;
        store.steal("siyuan-quickgate-bridge"); // 拆 h2 的锁 → h2 的 onStolen
        await new Promise((r) => setTimeout(r, 20));
        expect(released).toBe(1); // 被接管方（h2）收到通知
        expect(stolen).toBe(0); // steal 方（新持有者）不触发自身 onStolen
    });

    it("claimSteal：授予锁且不触发自身的 onStolen", async () => {
        let selfNotified = 0;
        const store = makeStealableLocks();
        const w = createNavigatorClaimer(store.locks as never)!;
        const h = await w.claimSteal("siyuan-quickgate-bridge", { onStolen: () => { selfNotified += 1; } });
        expect(h).toBeTruthy();
        await new Promise((r) => setTimeout(r, 20));
        expect(selfNotified).toBe(0);
    });
});
