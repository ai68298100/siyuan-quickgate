import { describe, expect, it, vi } from "vitest";
import { readDailyStatus } from "../src/services/daily-status";
import type { KernelApi } from "../src/services/kernelApi";
import { makeTestService, MemKernel } from "./helpers/test-env";

const DATE = new Date(2026, 9, 14, 9, 30);
const DOC = "20261014090000-aaaaaaa";
const apiWith = (data: unknown) => {
    const post = vi.fn().mockResolvedValue(data);
    return { post, api: { post } as unknown as KernelApi };
};
describe("原生日记状态与读取失败分开", () => {
    it("空结果才表示未创建，不按标题日期识别普通文档", async () => {
        const { api, post } = apiWith([]);
        expect(await readDailyStatus(api, () => DATE)).toEqual({ exists: false, docId: null });
        const sql = post.mock.calls[0][1].stmt;
        expect(sql).toContain("JOIN attributes");
        expect(sql).toContain("custom-dailynote-20261014");
        expect(sql).not.toContain("content LIKE");
        expect(post.mock.calls[0][0]).toBe("/api/query/sql");
    });
    it("返回原生属性对应的文档 ID，不依赖日记标题格式", async () => {
        const { api } = apiWith([{ id: DOC }]);
        expect(await readDailyStatus(api, () => DATE)).toEqual({ exists: true, docId: DOC });
    });
    it.each([null, undefined, {}, [null], [{ id: "not-an-id" }]])("异常响应 %j 不改写为不存在", async (data) => {
        const { api } = apiWith(data);
        await expect(readDailyStatus(api, () => DATE)).rejects.toThrow("响应格式异常");
    });
    it("读取异常原样交给调用方，不能返回 exists=false", async () => {
        const { api, post } = apiWith([]);
        post.mockRejectedValue(new Error("权限拒绝"));
        await expect(readDailyStatus(api, () => DATE)).rejects.toThrow("权限拒绝");
    });
    it("无效日期在查询前拒绝", async () => {
        const { api, post } = apiWith([]);
        await expect(readDailyStatus(api, () => new Date(NaN))).rejects.toThrow("日期无效");
        expect(post).not.toHaveBeenCalled();
    });
    it("桥将读失败记为 failed；恢复后真实空结果才是 recorded/未创建", async () => {
        const mem = new MemKernel();
        mem.jsonEndpoints.set("/api/query/sql", () => { throw new Error("SQL unavailable"); });
        const service = makeTestService(mem, { dailyStatus: () => readDailyStatus(mem.api, () => DATE), now: () => DATE.getTime() });
        const command = (id: string) => ({ v: 1, id, op: "daily.status", args: {}, createdAt: DATE.toISOString() });
        const failed = await service.executeAndRecord(command("daily-read-failed"));
        expect(failed.receipt).toMatchObject({ status: "failed", data: null });
        expect(failed.receipt?.message).toContain("SQL unavailable");
        mem.jsonEndpoints.set("/api/query/sql", []);
        const missing = await service.executeAndRecord(command("daily-read-missing"));
        expect(missing.receipt).toMatchObject({ status: "recorded", data: { exists: false, docId: null } });
    });
});
