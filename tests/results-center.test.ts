/**
 * G5-01 结果中心数据面（R302）：解析（坏行跳过）、状态/关键词过滤、倒序分页、状态枚举归纳。
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { parseReceiptLines, filterReceipts, pageNewestFirst, collectStatuses } from "../src/results-center";

const r = (id: string, status: string, at: string, op = "bridge.ping", message = `${status} msg`) =>
    JSON.stringify({ v: 1, id, op, status, message, finishedAt: at, elapsedMs: 3 });

const LINES = [
    r("a", "recorded", "2026-10-06T01:00:00Z"),
    "not-json",
    r("b", "failed", "2026-10-06T02:00:00Z", "checkin.record", "目标缺席"),
    r("c", "unknown", "2026-10-06T03:00:00Z"),
    r("d", "expired", "2026-10-06T04:00:00Z"),
    r("e", "recorded", "2026-10-06T05:00:00Z", "contacts.search"),
];

describe("parseReceiptLines", () => {
    it("坏行跳过；字段缺省兜底", () => {
        const rows = parseReceiptLines(LINES);
        expect(rows).toHaveLength(5);
        expect(rows[1].op).toBe("checkin.record");
        expect(rows[1].message).toContain("目标缺席");
    });
});

describe("filterReceipts", () => {
    const rows = parseReceiptLines(LINES);

    it("状态过滤", () => {
        expect(filterReceipts(rows, { status: "failed" }).map((x) => x.id)).toEqual(["b"]);
        expect(filterReceipts(rows, { status: "all" })).toHaveLength(5);
    });

    it("关键词命中 id/op/message（大小写不敏感）", () => {
        expect(filterReceipts(rows, { q: "contacts" }).map((x) => x.id)).toEqual(["e"]);
        expect(filterReceipts(rows, { q: "目标缺席" }).map((x) => x.id)).toEqual(["b"]);
        expect(filterReceipts(rows, { q: "NOSUCH" })).toEqual([]);
    });

    it("状态+关键词叠加", () => {
        expect(filterReceipts(rows, { status: "failed", q: "checkin" }).map((x) => x.id)).toEqual(["b"]);
        expect(filterReceipts(rows, { status: "failed", q: "contacts" })).toEqual([]);
    });
});

describe("pageNewestFirst / collectStatuses", () => {
    const rows = parseReceiptLines(LINES);

    it("倒序分页：第一页为新→旧前 N 条", () => {
        const page1 = pageNewestFirst(rows, 0, 2);
        expect(page1.map((x) => x.id)).toEqual(["e", "d"]);
        const page2 = pageNewestFirst(rows, 2, 2);
        expect(page2.map((x) => x.id)).toEqual(["c", "b"]);
    });

    it("状态枚举从数据归纳（顺序=常量全集序）", () => {
        expect(collectStatuses(rows)).toEqual(["recorded", "failed", "unknown", "expired"]);
    });
});

describe("filterReceipts since（R314 时间范围；固定时钟——「现在」锚在正午，防本地午夜后 1h 内 isoHoursAgo(1) 落入昨天使 today 断言日历性误爆，同 R47 教训）", () => {
    afterEach(() => vi.useRealTimers());
    // 固定到本地今天 12:00：now1=今天 11:00（today 命中）、day3=前天、day10=10 天前，断言与运行时刻无关
    vi.setSystemTime(new Date(new Date().setHours(12, 0, 0, 0)));
    const isoHoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const rows = parseReceiptLines([
        r("now1", "recorded", isoHoursAgo(1)),
        r("day3", "failed", isoHoursAgo(72)),
        r("day10", "expired", isoHoursAgo(240)),
    ]);

    it("today：只留本地今天 0 点之后的条目", () => {
        expect(filterReceipts(rows, { since: "today" }).map((x) => x.id)).toEqual(["now1"]);
    });
    it("7d：近 7 天含 72h 前的条目，240h 前剔除", () => {
        expect(filterReceipts(rows, { since: "7d" }).map((x) => x.id).sort()).toEqual(["day3", "now1"].sort());
    });
    it("all/未指定：不过滤", () => {
        expect(filterReceipts(rows, {}).length).toBe(3);
    });
});
