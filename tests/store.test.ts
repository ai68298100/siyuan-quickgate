import { describe, expect, it } from "vitest";
import { normalizeProcessed, normalizeSettings, BridgeStore } from "../src/services/store";
import { DEFAULT_SETTINGS } from "../src/types/bridge";

describe("store.normalize（不兼容→缺省重建，永不抛错）", () => {
    it("processed：坏数据回空台账；v1 数字时间戳迁移为 done 条目（L655 v2）", () => {
        expect(normalizeProcessed(null).processed).toEqual({});
        expect(normalizeProcessed({ schemaVersion: 9, processed: "x" }).processed).toEqual({});
        expect(normalizeProcessed({ schemaVersion: 1, processed: { a: "x", b: 5 } }).processed).toEqual({
            b: { ts: 5, state: "done" },
        });
        // v2 逐条校验：pending/done 保留，坏条目跳过
        expect(normalizeProcessed({
            schemaVersion: 2,
            processed: {
                p: { ts: 1, state: "pending", op: "doc.open" },
                d: { ts: 2, state: "done", status: "recorded" },
                bad: { ts: "x", state: "pending" },
                n: 7,
            },
        }).processed).toEqual({
            p: { ts: 1, state: "pending", op: "doc.open" },
            d: { ts: 2, state: "done", status: "recorded" },
            n: { ts: 7, state: "done" },
        });
    });

    it("settings：逐字段校验范围", () => {
        const s = normalizeSettings({ pollMs: 1, backoffMaxMs: -5, blacklist: ["a", 3], bridgeBasePath: "../etc", deviceName: "x".repeat(100) });
        expect(s.pollMs).toBe(DEFAULT_SETTINGS.pollMs); // 越界回缺省
        expect(s.blacklist).toEqual(["a"]);
        expect(s.bridgeBasePath).toBe(DEFAULT_SETTINGS.bridgeBasePath);
        expect(s.deviceName.length).toBe(64);
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it("settings：captureTarget 仅接受合法枚举（R301）", () => {
        expect(normalizeSettings({ captureTarget: "inbox" }).captureTarget).toBe("inbox");
        expect(normalizeSettings({ captureTarget: "daily" }).captureTarget).toBe("daily");
        expect(normalizeSettings({ captureTarget: "whatever" }).captureTarget).toBe("daily");
        expect(normalizeSettings({}).captureTarget).toBe("daily");
    });

    it("settings：移动端桥 opt-in 迁移（R69-P1）——显式字段优先，旧 :mobile-on 后缀迁移", () => {
        // 旧版隐式后缀 → 迁移为 true
        expect(normalizeSettings({ deviceName: "phone:mobile-on" }).mobileBridgeEnabled).toBe(true);
        // 无后缀无字段 → 默认关
        expect(normalizeSettings({ deviceName: "desktop" }).mobileBridgeEnabled).toBe(false);
        // 显式字段优先：false 显式覆盖旧后缀（用户已在设置关掉）
        expect(normalizeSettings({ deviceName: "phone:mobile-on", mobileBridgeEnabled: false }).mobileBridgeEnabled).toBe(false);
        expect(normalizeSettings({ mobileBridgeEnabled: true }).mobileBridgeEnabled).toBe(true);
        // 非布尔回默认
        expect(normalizeSettings({ mobileBridgeEnabled: "yes" }).mobileBridgeEnabled).toBe(false);
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

describe("store.firstRun（R288 · G2-01 首跑判定）", () => {
    const io = (data: unknown) => ({ load: async () => data, save: async () => {} });

    it("缺失（null 或宿主 loadData 对缺失文件的空串）→ true", async () => {
        for (const raw of [null, ""]) {
            const store = new BridgeStore(io(raw));
            await store.loadAll();
            expect(store.firstRun).toBe(true);
        }
    });

    it("已有设置（对象）→ false；空对象也算已存在（normalize 落默认不改变判定）", async () => {
        for (const raw of [{ schemaVersion: 1, bridgeEnabled: true }, {}]) {
            const store = new BridgeStore(io(raw));
            await store.loadAll();
            expect(store.firstRun).toBe(false);
        }
    });
});
