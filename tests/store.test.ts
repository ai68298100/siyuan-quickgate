import { describe, expect, it } from "vitest";
import { normalizeProcessed, normalizeSettings, BridgeStore } from "../src/services/store";
import { DEFAULT_SETTINGS } from "../src/types/bridge";

describe("store.normalize（不兼容→缺省重建，永不抛错）", () => {
    it("processed：坏数据回空台账", () => {
        expect(normalizeProcessed(null).processed).toEqual({});
        expect(normalizeProcessed({ schemaVersion: 9, processed: "x" }).processed).toEqual({});
        expect(normalizeProcessed({ schemaVersion: 1, processed: { a: "x", b: 5 } }).processed).toEqual({ b: 5 });
    });

    it("settings：逐字段校验范围", () => {
        const s = normalizeSettings({ pollMs: 1, backoffMaxMs: -5, blacklist: ["a", 3], bridgeBasePath: "../etc", deviceName: "x".repeat(100) });
        expect(s.pollMs).toBe(DEFAULT_SETTINGS.pollMs); // 越界回缺省
        expect(s.blacklist).toEqual(["a"]);
        expect(s.bridgeBasePath).toBe(DEFAULT_SETTINGS.bridgeBasePath);
        expect(s.deviceName.length).toBe(64);
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });
});

describe("BridgeStore 记账", () => {
    it("markProcessed/isProcessed/save 走注入 IO", async () => {
        const saved = new Map<string, unknown>();
        const io = {
            load: async (f: string) => saved.get(f) ?? null,
            save: async (f: string, d: unknown) => { saved.set(f, d); },
        };
        const store = new BridgeStore(io);
        await store.loadAll();
        expect(store.isProcessed("a")).toBe(false);
        store.markProcessed("a", 123);
        await store.saveProcessed();
        const second = new BridgeStore(io);
        await second.loadAll();
        expect(second.isProcessed("a")).toBe(true); // 跨"重启"恢复（阻断项4）
    });
});

describe("loadAudit（R47 修复候选 bug#8：审计历史跨重启恢复）", () => {
    const io = (data: unknown) => ({ load: async () => data, save: async () => {} });

    it("合法条目恢复、坏条目跳过、按 auditMax 截尾", async () => {
        const store = new BridgeStore(io({
            schemaVersion: 1,
            entries: [
                { time: "2026-10-02T01:00:00Z", plugin: "p1", command: "checkin.record", status: "recorded", elapsedMs: 12 },
                { time: "x", plugin: 1 }, // 缺字段 → 跳过
                null, // 非对象 → 跳过
                { time: "2026-10-02T02:00:00Z", plugin: "p2", command: "doc.open", status: "recorded", elapsedMs: 3 },
            ],
        }));
        const out = await store.loadAudit(200);
        expect(out.length).toBe(2);
        expect(out[0].command).toBe("checkin.record");
        expect(out[1].elapsedMs).toBe(3);
        expect((await store.loadAudit(1)).length).toBe(1); // 截尾只留最新
    });

    it("坏根/空数据回空数组（永不抛错）", async () => {
        expect(await new BridgeStore(io(null)).loadAudit(200)).toEqual([]);
        expect(await new BridgeStore(io("garbage")).loadAudit(200)).toEqual([]);
        expect(await new BridgeStore(io({ entries: "x" })).loadAudit(200)).toEqual([]);
    });
});
