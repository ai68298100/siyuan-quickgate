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
