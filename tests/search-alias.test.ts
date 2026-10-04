import { describe, expect, it } from "vitest";
import { SEARCH_ALIASES, expandSearchKeyword } from "../src/services/search-alias";
import { MemKernel, makeTestService } from "./helpers/test-env";

describe("search-alias（命令搜索别名 · L471）", () => {
    it("条目验收词对：「打卡/daka/checkin」互达", () => {
        expect(expandSearchKeyword("打卡")).toContain("checkin");
        expect(expandSearchKeyword("daka")).toContain("打卡");
        expect(expandSearchKeyword("checkin")).toContain("打卡");
    });
    it("条目验收词对：「摘录/捕获/capture」互达", () => {
        expect(expandSearchKeyword("摘录")).toContain("capture");
        expect(expandSearchKeyword("捕获")).toContain("capture");
        expect(expandSearchKeyword("capture")).toContain("摘录");
    });
    it("展开词全部小写；无别名时返回原词", () => {
        expect(expandSearchKeyword("CheckIn")).toEqual(["checkin", "打卡", "check-in", "daka"]);
        expect(expandSearchKeyword("nonexistent")).toEqual(["nonexistent"]);
    });
    it("别名表纪律：所有别名均为小写字面（与展开逻辑一致）", () => {
        for (const [k, vs] of Object.entries(SEARCH_ALIASES)) {
            expect(k).toBe(k.toLowerCase());
            for (const v of vs) expect(v).toBe(v.toLowerCase());
        }
    });
});

function makeService(commands: Array<{ title: string; id: string; plugin: string }>) {
    // 共享夹具（tests/helpers/test-env.ts）：MemKernel 全端点 404 也能跑（registry 假件不走内核）
    const mem = new MemKernel();
    return makeTestService(mem, {
        registry: () => ({ source: "fallback", plugins: [{ name: "siyuan-checkin", displayName: "小驴打卡", commands }] }),
    });
}

describe("commands.search 别名集成（L471）", () => {
    it("中文关键词命中英文命令 id；拼音命中中文标题", async () => {
        const svc = makeService([
            { title: "Record check-in", id: "record-checkin", plugin: "siyuan-checkin" }, // 标题纯英文
            { title: "打开今日打卡概览", id: "open-overview", plugin: "siyuan-checkin" }, // 标题纯中文
        ]);
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ data: { commands: unknown[] } }> })
            .dispatch.bind(svc);
        // "打卡" → 别名 checkin 命中英文标题；原词命中中文标题
        const zh = await dispatch({ id: "t1", op: "commands.search", args: { keyword: "打卡" } });
        expect(zh.data.commands).toHaveLength(2);
        // "daka" → 别名链（打卡/checkin/check-in）交叉命中两条——别名设计即跨语言广撒网
        const py = await dispatch({ id: "t2", op: "commands.search", args: { keyword: "daka" } });
        expect(py.data.commands).toHaveLength(2);
        const pyIds = py.data.commands.map((c: { id: string }) => c.id);
        expect(pyIds).toContain("open-overview");
        // "checkin" → 原词命中英文标题/id，别名「打卡」命中中文标题（交叉命中=设计行为）
        const en = await dispatch({ id: "t3", op: "commands.search", args: { keyword: "checkin" } });
        expect(en.data.commands).toHaveLength(2);
        const enIds = en.data.commands.map((c: { id: string }) => c.id);
        expect(enIds).toContain("record-checkin");
    });
});
