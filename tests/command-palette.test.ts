/**
 * G3-01 命令面板 MVP：条目合成纯逻辑（收藏置顶→最近次之→其余；别名过滤；去重）。
 */
import { describe, expect, it } from "vitest";
import { buildPaletteEntries, formFieldsFor, buildArgs, CAPABILITY_OPS, PaletteEntry, paletteNavMaxIndex, clampPaletteActiveIndex } from "../src/command-palette";
import { buildToolDefs } from "../src/mcp/tools";

const e = (plugin: string, id: string, title: string): PaletteEntry => ({
    plugin, pluginDisplayName: plugin, id, title,
});
const ALL = [
    e("siyuan-checkin", "record", "记录打卡"),
    e("siyuan-checkin", "summary", "打卡概览"),
    e("siyuan-contacts", "search", "搜索人脉"),
    e("siyuan-lumina", "flash", "闪卡复习"),
];
const FAVS = [{ plugin: "siyuan-contacts", command: "search" }];
const RECENT = [
    { plugin: "siyuan-checkin", command: "summary", at: "2026-10-06T01:00:00Z" },
    { plugin: "siyuan-checkin", command: "record", at: "2026-10-06T02:00:00Z" },
];

describe("buildPaletteEntries（G3-01 排序与过滤）", () => {
    it("空 query：收藏置顶 → 最近（新→旧）→ 其余；收藏/最近双标记去重", () => {
        const out = buildPaletteEntries(ALL, FAVS, RECENT, "");
        expect(out.map((x) => `${x.plugin}/${x.id}`)).toEqual([
            "siyuan-contacts/search",        // 收藏位
            "siyuan-checkin/record",         // 最近（较新）
            "siyuan-checkin/summary",        // 最近（较旧）
            "siyuan-lumina/flash",           // 其余
        ]);
        expect(out[0].favorite).toBe(true);
        expect(out[0].recent).toBeFalsy();  // contacts/search 不在最近列表
        expect(out[1].recent).toBe(true);   // checkin/record 来自最近
        expect(out[3].favorite).toBeFalsy();
    });

    it("query 过滤走别名展开：daka 命中「打卡」标题", () => {
        const out = buildPaletteEntries(ALL, [], [], "daka");
        expect(out.map((x) => x.title)).toEqual(["记录打卡", "打卡概览"]);
    });

    it("无匹配 → 空数组（UI 层渲染 fallback 兜底）", () => {
        expect(buildPaletteEntries(ALL, [], [], "zzz不存在")).toEqual([]);
    });

    it("收藏指向不存在的命令（插件已卸载）→ 安全跳过", () => {
        const out = buildPaletteEntries(ALL, [{ plugin: "gone", command: "x" }], RECENT, "");
        expect(out.map((x) => `${x.plugin}/${x.id}`)).toEqual([
            "siyuan-checkin/record", "siyuan-checkin/summary", "siyuan-contacts/search", "siyuan-lumina/flash",
        ]);
    });
});

describe("命令面板键盘导航边界", () => {
    it("空结果时活动索引固定为 0，不能回用上一次结果的索引", () => {
        expect(paletteNavMaxIndex(0, 0)).toBe(0);
        expect(clampPaletteActiveIndex(7, 0, 0)).toBe(0);
    });

    it("命令超过渲染上限时只导航已渲染的前 100 项，再接能力动作", () => {
        expect(paletteNavMaxIndex(240, 2)).toBe(101);
        expect(clampPaletteActiveIndex(999, 240, 2)).toBe(101);
    });
});

describe("R6-A 参数化二段式（schema 驱动表单 + args 收敛）", () => {
    it("formFieldsFor：required 穿透、描述带出；未登记 op 无字段", () => {
        const fields = formFieldsFor("checkin.record");
        expect(fields.map((f) => f.key)).toContain("itemId");
        expect(fields.find((f) => f.key === "itemId")!.required).toBe(true);
        expect(formFieldsFor("bridge.ping")).toEqual([]);
        expect(formFieldsFor("no.such.op")).toEqual([]);
    });

    it("buildArgs：类型收敛（number 收敛），required 缺失报错且不产生 args", () => {
        const fields = formFieldsFor("checkin.record");
        const ok = buildArgs(fields, { itemId: "i1", value: "3", note: "" });
        expect(ok.error).toBeUndefined();
        expect(ok.args).toEqual({ itemId: "i1", value: 3 });
        const missing = buildArgs(fields, { value: "3" });
        expect(missing.error).toContain("itemId");
        expect(missing.args).toBeUndefined();
        const badNum = buildArgs(fields, { itemId: "i1", value: "abc" });
        expect(badNum.error).toContain("数字");
    });

    it("能力目录受控：均为白名单 op，不含危险透传（plugin.api/workflow.execute）", () => {
        const ops = CAPABILITY_OPS.map((c) => c.op);
        expect(ops).not.toContain("plugin.api");
        expect(ops).not.toContain("workflow.execute");
        const names = new Set(buildToolDefs().map((d) => d.name));
        for (const op of ops) expect(names.has(op), `${op} 应在 MCP 工具面内`).toBe(true);
    });
});
