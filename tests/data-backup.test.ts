/**
 * R9-A 全量备份/恢复数据面：拼装形状、解析校验、往返一致性、坏输入拒绝。
 */
import { describe, expect, it } from "vitest";
import { buildBackupPayload, parseBackupPayload } from "../src/data-backup";
import { normalizeSettings } from "../src/services/store";
import { normalizeFavorites } from "../src/services/favorites";
import { DEFAULT_SETTINGS } from "../src/types/bridge";

const COMPONENTS = {
    settings: { schemaVersion: 1, bridgeEnabled: true, captureTarget: "inbox" },
    favorites: { schemaVersion: 1, favorites: [{ plugin: "siyuan-checkin", command: "record" }], recent: [] },
    audit: { entries: [{ time: "2026-10-06T01:00:00Z", plugin: "p", command: "c", status: "recorded", elapsedMs: 1 }] },
    processed: { schemaVersion: 2, processed: { x: { ts: 1, state: "done" } } },
    resultsNdjson: '{"v":1,"id":"r1","status":"recorded"}',
};

describe("buildBackupPayload / parseBackupPayload（R9-A）", () => {
    it("拼装形状：版本/插件/时间戳/五段齐全", () => {
        const p = buildBackupPayload(COMPONENTS, "2026-10-06T00:00:00Z");
        expect(p.schemaVersion).toBe(1);
        expect(p.plugin).toBe("siyuan-quickgate");
        expect(p.exportedAt).toBe("2026-10-06T00:00:00Z");
        expect(p.settings).toEqual(COMPONENTS.settings);
        expect(p.resultsNdjson).toBe(COMPONENTS.resultsNdjson);
    });

    it("解析往返：导出→解析→组件原样取回", () => {
        const p = buildBackupPayload(COMPONENTS);
        const r = parseBackupPayload(JSON.stringify(p));
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.payload.settings).toEqual(COMPONENTS.settings);
            expect(r.payload.favorites).toEqual(COMPONENTS.favorites);
            expect(r.payload.resultsNdjson).toBe(COMPONENTS.resultsNdjson);
        }
    });

    it("坏输入拒绝：非 JSON/错误版本/异插件/缺段", () => {
        expect(parseBackupPayload("not-json").ok).toBe(false);
        expect(parseBackupPayload(JSON.stringify({ schemaVersion: 9 })).ok).toBe(false);
        expect(parseBackupPayload(JSON.stringify({ schemaVersion: 1, plugin: "other" })).ok).toBe(false);
        expect(parseBackupPayload(JSON.stringify({ schemaVersion: 1, plugin: "siyuan-quickgate" })).ok).toBe(false);
    });

    it("导入互操作：settings 段经 normalizeSettings 校验落默认/合法值", () => {
        const p = buildBackupPayload(COMPONENTS);
        const s = normalizeSettings(p.settings);
        expect(s.bridgeEnabled).toBe(true);
        expect(s.captureTarget).toBe("inbox");
        const fav = normalizeFavorites(p.favorites);
        expect(fav.favorites).toHaveLength(1);
    });
});
