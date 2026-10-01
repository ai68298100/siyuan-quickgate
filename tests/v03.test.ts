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
});
