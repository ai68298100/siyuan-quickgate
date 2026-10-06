import { describe, expect, it } from "vitest";
import { classifyFileRead, fileReadLegacy, FileReadError } from "../src/services/file-read";
import { createPlanIdFactory, nextWorkflowPlanId } from "../src/services/workflow";

/** L652/L653：文件读取五分类（缺失≠鉴权≠不可达≠异常≠空文件），前端 KernelApi 与内核侧共用 */
describe("classifyFileRead（L652 错误分类）", () => {
    const res = (over: Partial<{ ok: boolean; status: number; ct: string; text: string }>) => ({
        ok: over.ok ?? true,
        status: over.status ?? 200,
        headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? (over.ct ?? "text/plain") : null) },
        text: over.text ?? "hello",
    });

    it("200 文本 → ok（含空文件：空文件≠缺失）", () => {
        expect(classifyFileRead(res({}))).toEqual({ kind: "ok", text: "hello" });
        expect(classifyFileRead(res({ text: "" }))).toEqual({ kind: "ok", text: "" });
    });

    it("404 → missing", () => {
        expect(classifyFileRead(res({ ok: false, status: 404, text: "not found" })).kind).toBe("missing");
    });

    it("bug#12 形态：202 + 错误信封 code=404 → missing（不得当文件内容）", () => {
        const fr = classifyFileRead(res({ status: 202, ct: "application/json", text: '{"code":404,"msg":"file not found"}' }));
        expect(fr.kind).toBe("missing");
    });

    it("200 + JSON 错误信封（content-type json）code!=0 → 分类透出，不混入数据", () => {
        expect(classifyFileRead(res({ ct: "application/json", text: '{"code":404,"msg":"nf"}' })).kind).toBe("missing");
        const fr = classifyFileRead(res({ ct: "application/json", text: '{"code":500,"msg":"boom"}' }));
        expect(fr.kind).toBe("unexpected");
    });

    it("200 + JSON 内容类型但非信封正文 → 按文件内容返回", () => {
        expect(classifyFileRead(res({ ct: "application/json", text: '{"code":0,"msg":"","data":[1,2]}' })))
            .toEqual({ kind: "ok", text: '{"code":0,"msg":"","data":[1,2]}' });
    });

    it("401/403 → auth（状态码或信封 code 均识别）", () => {
        expect(classifyFileRead(res({ ok: false, status: 401, text: "denied" })).kind).toBe("auth");
        expect(classifyFileRead(res({ status: 202, ct: "application/json", text: '{"code":403,"msg":"x"}' })).kind).toBe("auth");
    });

    it("5xx / 网络异常 → unreachable（带原因）", () => {
        expect(classifyFileRead(res({ ok: false, status: 502, text: "bad gateway" })))
            .toEqual({ kind: "unreachable", detail: "HTTP 502" });
        const net = classifyFileRead(null, new Error("ECONNREFUSED"));
        expect(net.kind).toBe("unreachable");
        expect((net as { detail: string }).detail).toContain("ECONNREFUSED");
    });

    it("fileReadLegacy 旧契约：missing→null、ok→正文、真异常抛 FileReadError（不得显示成\"没有文件\"）", () => {
        expect(fileReadLegacy("/p", classifyFileRead(res({ text: "" })))).toBe("");
        expect(fileReadLegacy("/p", { kind: "missing" })).toBeNull();
        try {
            fileReadLegacy("/p", { kind: "auth", detail: "HTTP 401" });
            expect.unreachable("应当抛出");
        } catch (e) {
            expect(e).toBeInstanceOf(FileReadError);
            expect((e as Error).message).toContain("鉴权失败");
            expect((e as Error).message).toContain("/p");
        }
    });
});

/** L657：planId 同毫秒唯一（plans.set 覆盖曾使并发计划静默丢失） */
describe("createPlanIdFactory（L657 planId 并发唯一）", () => {
    it("同毫秒连续生成不重号；不同毫秒亦不重号", () => {
        const next = createPlanIdFactory();
        const a = next(1000);
        const b = next(1000);
        const c = next(1001);
        expect(a).not.toBe(b);
        expect(a).not.toBe(c);
        expect(b).not.toBe(c);
        expect(a.startsWith("wf-1000-")).toBe(true);
    });

    it("模块级单例跨调用永不重号（bridge-service 用的就是它：selfPing 临时服务与常驻服务并发也不冲突）", () => {
        const seen = new Set([nextWorkflowPlanId(7), nextWorkflowPlanId(7), nextWorkflowPlanId(7), nextWorkflowPlanId(8)]);
        expect(seen.size).toBe(4);
    });
});
