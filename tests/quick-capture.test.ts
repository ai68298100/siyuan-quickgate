import { describe, expect, it, vi } from "vitest";
import { QuickCaptureService } from "../src/services/quick-capture";
import type { KernelApi } from "../src/services/kernelApi";

const NB = "20261014090000-aaaaaaa";
const OTHER_NB = "20261014090000-zzzzzzz";
const DOC = "20261014090100-ddddddd";
const BLOCK = "20261014090200-bbbbbbb";
const DAILY_DOC = "20261014090100-eeeeeee";
function fixture(time = new Date(2026, 9, 14, 9, 30).getTime()) {
    const state = {
        time, closed: false, savePath: '/daily/{{now | date "2006-01-02"}}', content: "收集箱", hpath: "/收集箱",
        diaryNotebookId: NB as string | null, inboxDocId: DOC as string | null,
        errorAt: "", advanceOnRead: 0,
        reply: [{ doOperations: [{ id: BLOCK, parentID: DAILY_DOC }] }] as unknown,
    };
    const discover = vi.fn(async () => ({ diaryNotebookId: state.diaryNotebookId, inboxDocId: state.inboxDocId, notes: [] }));
    const post = vi.fn(async (endpoint: string) => {
        if (endpoint === state.errorAt) throw new Error("API unavailable");
        if (endpoint === "/api/notebook/lsNotebooks") {
            state.time += state.advanceOnRead;
            return { notebooks: [{ id: NB, name: "我的笔记", closed: state.closed }, { id: OTHER_NB, name: "其它笔记", closed: false }] };
        }
        if (endpoint === "/api/notebook/getNotebookConf") return { conf: { dailyNoteSavePath: state.savePath } };
        if (endpoint === "/api/query/sql") return [{ id: DOC, box: NB, hpath: state.hpath, content: state.content, type: "d" }];
        if (endpoint.startsWith("/api/block/append")) return state.reply;
        throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
    const service = new QuickCaptureService({ post } as unknown as KernelApi, discover, () => state.time);
    const writes = () => post.mock.calls.filter(([endpoint]) => endpoint.startsWith("/api/block/append"));
    return { service, state, discover, post, writes };
}

describe("快速捕获只读核验与一次性确认", () => {
    it("空输入不探测，选择去向只读且明确目标与完整 Markdown", async () => {
        const f = fixture();
        expect((await f.service.prepare("  ", "daily")).plan).toBeUndefined();
        expect(f.discover).not.toHaveBeenCalled();
        const text = "长内容".repeat(100);
        const { plan } = await f.service.prepare(text, "inbox");
        expect(plan?.destination).toBe("我的笔记 / 收集箱");
        expect(plan?.body).toBe(text);
        expect(plan?.docId).toBe(DOC);
        expect(f.writes()).toHaveLength(0);
    });

    it.each(["/api/query/sql", "/api/notebook/lsNotebooks", "/api/notebook/getNotebookConf"])("%s 读取异常不冒充无目标，不产生写请求", async (endpoint) => {
        const f = fixture();
        f.state.errorAt = endpoint;
        const result = await f.service.prepare("正文", endpoint === "/api/query/sql" ? "inbox" : "daily");
        expect(result.plan).toBeUndefined();
        expect(result.message).toContain("API unavailable");
        expect(f.writes()).toHaveLength(0);
    });

    it("发现不唯一或笔记本关闭时拒绝生成可执行预览", async () => {
        const f = fixture();
        f.state.diaryNotebookId = null;
        expect((await f.service.prepare("正文", "daily")).plan).toBeUndefined();
        f.state.closed = true;
        expect((await f.service.prepare("正文", "inbox")).plan).toBeUndefined();
        expect(f.writes()).toHaveLength(0);
    });

    it("无效目标 ID 在 SQL 查询前拒绝", async () => {
        const f = fixture();
        f.state.inboxDocId = "' OR 1=1 --";
        expect((await f.service.prepare("正文", "inbox")).plan).toBeUndefined();
        expect(f.post).not.toHaveBeenCalled();
    });

    it("执行使用已预览正文与时间，日记原文来自本次回执而非全局日期查询", async () => {
        const f = fixture();
        const { plan } = await f.service.prepare("  正文  ", "daily");
        expect(plan?.body).toBe("- 09:30 正文");
        expect(plan?.details).toContain("日记路径模板");
        f.state.time += 45_000;
        const result = await f.service.execute(plan!);
        expect(result).toMatchObject({ ok: true, status: "recorded", blockId: BLOCK, docId: DAILY_DOC });
        expect(f.post).toHaveBeenCalledWith("/api/block/appendDailyNoteBlock", { notebook: NB, dataType: "markdown", data: plan!.body });
        expect(f.post.mock.calls.some(([endpoint]) => endpoint === "/api/query/sql")).toBe(false);
    });

    it("收集箱请求固定到已确认文档，不新增文档", async () => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "inbox");
        expect(await f.service.execute(plan!)).toMatchObject({ ok: true, docId: DOC });
        expect(f.post).toHaveBeenCalledWith("/api/block/appendBlock", { parentID: DOC, dataType: "markdown", data: "正文" });
        expect(f.writes()).toHaveLength(1);
    });

    it.each(["savePath", "diaryNotebookId", "closed"] as const)("日记 %s 在确认前变化时零写入", async (key) => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "daily");
        if (key === "savePath") f.state.savePath = "/new-path";
        if (key === "diaryNotebookId") f.state.diaryNotebookId = OTHER_NB;
        if (key === "closed") f.state.closed = true;
        expect(await f.service.execute(plan!)).toMatchObject({ ok: false, status: "failed" });
        expect(f.writes()).toHaveLength(0);
    });

    it("收集箱移动后要求重新预览", async () => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "inbox");
        f.state.hpath = "/归档/收集箱";
        expect(await f.service.execute(plan!)).toMatchObject({ ok: false, status: "failed" });
        expect(f.writes()).toHaveLength(0);
    });

    it.each([false, true])("有效期在重检%s到达时均零写入", async (duringRead) => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "daily");
        if (duringRead) f.state.advanceOnRead = 60_000;
        else f.state.time += 60_000;
        expect(await f.service.execute(plan!)).toMatchObject({ ok: false, status: "failed" });
        expect(f.writes()).toHaveLength(0);
    });

    it("一分钟窗口内跨日仍拒绝旧预览", async () => {
        const f = fixture(new Date(2026, 9, 14, 23, 59, 59).getTime());
        const { plan } = await f.service.prepare("正文", "daily");
        f.state.time += 2_000;
        expect(await f.service.execute(plan!)).toMatchObject({ ok: false, status: "failed" });
        expect(f.writes()).toHaveLength(0);
    });

    it("并发确认同一预览只发一次请求；伪造副本不可执行", async () => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "inbox");
        expect((await f.service.execute({ ...plan! })).ok).toBe(false);
        const results = await Promise.all([f.service.execute(plan!), f.service.execute(plan!)]);
        expect(results.filter((r) => r.ok)).toHaveLength(1);
        expect(f.writes()).toHaveLength(1);
    });

    it.each(["timeout", "malformed"])("写请求 %s 保留 unknown，不能复用预览重发", async (kind) => {
        const f = fixture();
        const { plan } = await f.service.prepare("正文", "daily");
        if (kind === "timeout") f.state.errorAt = "/api/block/appendDailyNoteBlock";
        else f.state.reply = [];
        expect(await f.service.execute(plan!)).toMatchObject({ ok: false, status: "unknown" });
        expect((await f.service.execute(plan!)).ok).toBe(false);
        // vi 记录抛错调用，但 fixture 的 writes 按调用入口计数。
        expect(f.writes()).toHaveLength(1);
    });
});
