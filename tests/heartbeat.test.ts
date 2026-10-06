/**
 * L571/L627 心跳服务单测（docs/34）：限流、分档、损坏降级、steal 选项传递。
 */
import { describe, expect, it } from "vitest";
import {
    classifyHeartbeat,
    heartbeatPath,
    readHeartbeat,
    shouldWriteHeartbeat,
    writeHeartbeat,
    HEARTBEAT_STALE_MS,
    HEARTBEAT_SUSPECT_MS,
    HEARTBEAT_MIN_WRITE_MS,
} from "../src/services/heartbeat";
import { createNavigatorClaimer } from "../src/services/bridge-claim";
import type { KernelApi } from "../src/services/kernelApi";

const NOW = Date.parse("2026-10-06T10:00:00Z");

describe("心跳限流与分档（docs/34 §3.1/§3.2）", () => {
    it("shouldWriteHeartbeat：≥2s 才落盘（限流）", () => {
        expect(shouldWriteHeartbeat(NOW, NOW + 1999)).toBe(false);
        expect(shouldWriteHeartbeat(NOW, NOW + 2000)).toBe(true);
        expect(HEARTBEAT_MIN_WRITE_MS).toBe(2000);
    });

    it("classifyHeartbeat：healthy/stale/suspect 三档", () => {
        const info = { holder: "dev#aa", ts: new Date(NOW - 5000).toISOString(), pollMs: 500 };
        expect(classifyHeartbeat(info, NOW)).toEqual({ level: "healthy", ageMs: 5000 });
        const stale = { ...info, ts: new Date(NOW - HEARTBEAT_STALE_MS - 1000).toISOString() };
        expect(classifyHeartbeat(stale, NOW).level).toBe("stale");
        const suspect = { ...info, ts: new Date(NOW - HEARTBEAT_SUSPECT_MS - 1000).toISOString() };
        expect(classifyHeartbeat(suspect, NOW).level).toBe("suspect");
        expect(HEARTBEAT_STALE_MS).toBe(15_000);
        expect(HEARTBEAT_SUSPECT_MS).toBe(60_000);
    });

    it("classifyHeartbeat：缺失/损坏 → unknown（诚实不猜）", () => {
        expect(classifyHeartbeat(null, NOW).level).toBe("unknown");
        expect(classifyHeartbeat({ holder: "x", ts: "not-a-date", pollMs: 500 }, NOW).level).toBe("unknown");
    });
});

describe("readHeartbeat/writeHeartbeat（损坏降级）", () => {
    const makeApi = (store: Map<string, string>): KernelApi =>
        ({
            getFileText: async (p: string) => store.get(p) ?? null,
            putFileText: async (p: string, t: string) => { store.set(p, t); },
        }) as unknown as KernelApi;

    it("readHeartbeat：损坏 JSON / 缺字段 → null", async () => {
        const store = new Map<string, string>([["hb.json", "{broken"], ["bad.json", JSON.stringify({ holder: 1 })]]);
        const api = makeApi(store);
        expect(await readHeartbeat(api, "hb.json")).toBeNull();
        expect(await readHeartbeat(api, "bad.json")).toBeNull();
        expect(await readHeartbeat(api, "missing.json")).toBeNull();
    });

    it("write→read 往返保留 holder/ts/pollMs；路径 = basePath/heartbeat.json", async () => {
        const store = new Map<string, string>();
        const api = makeApi(store);
        const path = heartbeatPath("/storage/petal/siyuan-quickgate/bridge");
        expect(path).toBe("/storage/petal/siyuan-quickgate/bridge/heartbeat.json");
        await writeHeartbeat(api, path, { holder: "dev#aa", ts: "2026-10-06T10:00:00Z", pollMs: 500 });
        expect(await readHeartbeat(api, path)).toEqual({ holder: "dev#aa", ts: "2026-10-06T10:00:00Z", pollMs: 500 });
    });
});

describe("claimSteal（docs/34 §3.3 接管）", () => {
    it("steal 选项传递 { ifAvailable:false, steal:true }；回调带锁 → handle", async () => {
        let captured: { ifAvailable: boolean; steal?: boolean } | null = null;
        const locks = {
            request: async (_name: string, opts: { ifAvailable: boolean; steal?: boolean }, cb: (lock: unknown) => void) => {
                captured = opts;
                cb({ name: _name }); // 授予锁
            },
        };
        const claimer = createNavigatorClaimer(locks);
        const handle = await claimer?.claimSteal("siyuan-quickgate-bridge");
        console.log("[mock] handle:", typeof handle, JSON.stringify(handle));
        expect(captured).toEqual({ ifAvailable: false, steal: true });
        expect(handle?.release).toBeTypeOf("function");
    });

    it("被 steal 打断的原持锁 promise reject → 静默不炸（§3.4 容错）", async () => {
        const locks = {
            request: async (_name: string, _opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void>) => {
                cb({ name: _name }); // 授予
                await new Promise((r) => setTimeout(r, 10));
                throw new DOMException("aborted", "AbortError"); // 模拟被 steal 打断
            },
        };
        const claimer = createNavigatorClaimer(locks);
        const handle = await claimer?.claim("n");
        expect(handle?.release).toBeTypeOf("function");
        await new Promise((r) => setTimeout(r, 30)); // 若有未处理 rejection 此处会触发 vitest 失败
        await handle?.release();
    });
});
