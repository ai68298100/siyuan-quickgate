import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";

class MemKernel {
    files = new Map<string, string>();
    api: KernelApi;
    constructor() {
        this.api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
            const u = String(url);
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
            if (u === "/api/file/getFile") {
                const text = this.files.get(body.path);
                return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
            }
            if (u === "/api/file/putFile") {
                const form = init?.body as FormData;
                this.files.set(String(form.get("path")), await (form.get("file") as File).text());
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: null }) } as Response;
            }
            if (u === "/api/template/renderSprig") {
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: `rendered:${body.template}` }) } as Response;
            }
            if (u === "/api/filetree/createDocWithMd") {
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: "doc-1" }) } as Response;
            }
            return { ok: false, status: 404, text: async () => "{}" } as Response;
        }) as unknown as typeof fetch);
    }
}

const settings = () => ({
    schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
    confirmExec: false, blacklist: [] as string[], auditMax: 200,
    rawApiEnabled: false, rawApiAllowlist: [] as string[],
    bridgeBasePath: "/bridge", deviceName: "dev-a",
});

const receipts = (mem: MemKernel) =>
    (mem.files.get("/bridge/results.ndjson") ?? "").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

function make(mem: MemKernel, over: Record<string, unknown> = {}) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    return new BridgeService({
        api: mem.api, store, settings,
        pluginName: "siyuan-quickgate", pluginVersion: "0.3.0",
        deviceName: () => "dev-a",
        registry: () => ({ source: "fallback", plugins: [] }),
        confirm: async () => true,
        audit: () => {},
        editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {}, openSetting: () => {},
        getCheckin: () => undefined, getContacts: () => undefined,
        getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined, getCommon: () => undefined,
        loadPetals: async () => [],
        discoverConfig: async () => ({ diaryNotebookId: null, inboxDocId: null, notes: [] }),
        ...over,
    });
}

const send = (mem: MemKernel, id: string, op: string, args: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
    mem.files.set("/bridge/commands.ndjson", JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ...extra }));
};

describe("v0.3.0 新增", () => {
    it("template.new：读模板→renderSprig→createDocWithMd", async () => {
        const mem = new MemKernel();
        mem.files.set("/templates/weekly.md", "# 周报");
        send(mem, "t1", "template.new", { notebook: "nb", hpath: "/周报/10-01", templatePath: "weekly.md" });
        await make(mem).tick();
        const [r] = receipts(mem);
        expect(r.status).toBe("recorded");
        expect(r.data.docId).toBe("doc-1");
    });

    it("template.new：缺模板内容 → rejected", async () => {
        const mem = new MemKernel();
        send(mem, "t2", "template.new", { notebook: "nb", hpath: "/x" });
        await make(mem).tick();
        expect(receipts(mem)[0].status).toBe("rejected");
    });

    it("业务执行可观测上限：挂起操作回 failed，轮询不被阻塞（阻断项3 补充）", async () => {
        const mem = new MemKernel();
        send(mem, "s1", "registry.list");
        const service = make(mem, {
            loadPetals: () => new Promise<Array<Record<string, unknown>>>( () => {} ), // 永不 resolve
            execTimeoutMs: () => 50,
        });
        const r = await service.tick();
        expect(r.executed).toBe(1);
        expect(receipts(mem)[0].status).toBe("failed");
        expect(receipts(mem)[0].message).toContain("未返回");
    }, 10000);

    it("超时后不得二次派发：底层操作只调用一次（R69-P0 回归）", async () => {
        const mem = new MemKernel();
        send(mem, "s2", "registry.list");
        let calls = 0;
        const service = make(mem, {
            loadPetals: () => { calls += 1; return new Promise<Array<Record<string, unknown>>>( () => {} ); }, // 挂起
            execTimeoutMs: () => 50,
        });
        await service.tick(); // 超时回执 failed
        await new Promise((r) => setTimeout(r, 120)); // 给迟到分支留窗口
        expect(calls).toBe(1); // 修复前=2（超时分支再次 dispatch，写操作会执行两遍）
    }, 10000);

    it("plugin.api args 形状：对象作为唯一 options 实参；非数组非对象 rejected（R69-P1 回归）", async () => {
        const mem = new MemKernel();
        (globalThis as unknown as { window?: Record<string, unknown> }).window = {
            siyuanCheckin: { optionsMethod: async (opts: unknown) => ({ got: opts }), positional: async (...a: unknown[]) => a },
        };
        const s = { ...settings(), rawApiEnabled: true, rawApiAllowlist: ["siyuan-checkin"] };
        const sendLine = (id: string, args: unknown) => {
            const prev = mem.files.get("/bridge/commands.ndjson") ?? "";
            mem.files.set("/bridge/commands.ndjson", prev + JSON.stringify({ v: 1, id, op: "plugin.api", args, createdAt: new Date().toISOString() }) + "\n");
        };
        sendLine("p1", { plugin: "siyuan-checkin", method: "optionsMethod", args: { a: 1 } });
        sendLine("p2", { plugin: "siyuan-checkin", method: "positional", args: [7, "x"] });
        sendLine("p3", { plugin: "siyuan-checkin", method: "positional", args: "bad" });
        await make(mem, { settings: () => s }).tick();
        const rs = receipts(mem);
        expect(rs.find((r) => r.id === "p1").data).toEqual({ got: { a: 1 } }); // 对象=单一 options 实参
        expect(rs.find((r) => r.id === "p2").data).toEqual([7, "x"]); // 数组=位置参数原样
        expect(rs.find((r) => r.id === "p3").status).toBe("rejected"); // 其他形状显式拒绝
    }, 10000);

    it("workflow.execute 单步超时：挂起步回 failed 并停止，不迟到执行后续步（R69-P1 回归）", async () => {
        const mem = new MemKernel();
        const line = (id: string, op: string, args: unknown) => {
            const prev = mem.files.get("/bridge/commands.ndjson") ?? "";
            mem.files.set("/bridge/commands.ndjson", prev + JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() }) + "\n");
        };
        line("w1", "workflow.plan", { steps: [{ op: "contacts.search", args: { keyword: "x" } }] });
        const svc = make(mem, {
            getContacts: () => ({ protocol: 1, searchPeople: () => new Promise(() => {}) }), // 桥在、但 searchPeople 挂起
            execTimeoutMs: () => 50,
        });
        await svc.tick();
        const planReceipt = receipts(mem).find((r) => r.id === "w1");
        expect(planReceipt.status).toBe("recorded");
        const planId = planReceipt.data.plan.planId;
        line("w2", "workflow.execute", { planId });
        await svc.tick();
        const execReceipt = receipts(mem).find((r) => r.id === "w2");
        expect(execReceipt.status).toBe("recorded"); // workflow op 本身完成；步级失败在 data 内
        expect(execReceipt.data.steps[0].status).toBe("failed"); // 挂起步按单步上限回 failed
        expect(execReceipt.data.stoppedAt).toBe(0); // 该步失败即停止
        expect(execReceipt.message).toContain("失败停止");
    }, 10000);
});
