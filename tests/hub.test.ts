import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";

class MemKernel {
    files = new Map<string, string>();
    petals: Array<Record<string, unknown>> = [];
    notebooks: Array<{ id: string; name: string; closed: boolean; conf?: Record<string, unknown> }> = [];
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
            if (u === "/api/petal/loadPetals") {
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: this.petals }) } as Response;
            }
            if (u === "/api/notebook/lsNotebooks") {
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: { notebooks: this.notebooks } }) } as Response;
            }
            if (u === "/api/notebook/getNotebookConf") {
                const nb = this.notebooks.find((n) => n.id === body.notebook);
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: { conf: nb?.conf ?? {} } }) } as Response;
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

function make(mem: MemKernel) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    const service = new BridgeService({
        api: mem.api,
        store,
        settings,
        pluginName: "siyuan-quickgate",
        pluginVersion: "0.2.0",
        deviceName: () => "dev-a",
        registry: () => ({ source: "fallback", plugins: [], reason: "未实证" }),
        confirm: async () => true,
        audit: () => {},
        editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {},
        openSetting: () => {},
        getCheckin: () => undefined,
        getContacts: () => undefined,
        getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined, getCommon: () => undefined,
        loadPetals: async () => mem.petals,
        discoverConfig: async () => {
            const diary = mem.notebooks.find((n) => !n.closed && n.conf?.dailynoteSavePath);
            const inbox = mem.notebooks.find((n) => !n.closed && /收集箱|inbox/i.test(n.name));
            return { diaryNotebookId: diary?.id ?? null, inboxDocId: inbox ? "doc-x" : null, notes: [] };
        },
    });
    return service;
}

const send = (mem: MemKernel, id: string, op: string, args: Record<string, unknown> = {}) => {
    mem.files.set(
        "/bridge/commands.ndjson",
        JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() }),
    );
};

async function run(mem: MemKernel, service: BridgeService) {
    await service.tick();
    const text = mem.files.get("/bridge/results.ndjson") ?? "";
    const lines = text.trim() ? text.trim().split("\n") : [];
    return lines.map((l) => JSON.parse(l));
}

describe("生态中枢 op（R1）", () => {
    it("registry.list 合并 manifest 与 loadPetals", async () => {
        const mem = new MemKernel();
        mem.petals = [{ name: "siyuan-checkin", version: "18.9.0", enabled: true }, { name: "siyuan-glean", version: "1.1.0", enabled: true }];
        send(mem, "r1", "registry.list");
        const [receipt] = await run(mem, make(mem));
        expect(receipt.status).toBe("recorded");
        const checkin = receipt.data.plugins.find((p: { pluginId: string }) => p.pluginId === "siyuan-checkin");
        expect(checkin.installed).toBe(true);
        expect(checkin.installedVersion).toBe("18.9.0");
        expect(checkin.maturity).toBe("stable");
        // v0.9.1 校准：拾遗 window.siyuanGlean v1 已实装（docs/BRIDGE.md）→ stable，adapter 已注册
        const glean = receipt.data.plugins.find((p: { pluginId: string }) => p.pluginId === "siyuan-glean");
        expect(glean.maturity).toBe("stable");
        expect(glean.installed).toBe(true);
    });

    it("diagnostics.report 脱敏快照", async () => {
        const mem = new MemKernel();
        send(mem, "d1", "diagnostics.report");
        const [receipt] = await run(mem, make(mem));
        expect(receipt.status).toBe("recorded");
        expect(receipt.data.bridge.basePath).toBe("/bridge");
        expect(receipt.data.registry.source).toBe("fallback");
        expect(JSON.stringify(receipt)).not.toContain("token");
    });

    it("config.discover 发现日记笔记本", async () => {
        const mem = new MemKernel();
        mem.notebooks = [
            { id: "nb1", name: "日记", closed: false, conf: { dailynoteSavePath: "/2026/" } },
            { id: "nb2", name: "收集箱", closed: false, conf: {} },
            { id: "nb3", name: "旧", closed: true, conf: { dailynoteSavePath: "/x" } },
        ];
        send(mem, "c1", "config.discover");
        const [receipt] = await run(mem, make(mem));
        expect(receipt.data.diaryNotebookId).toBe("nb1");
        expect(receipt.data.inboxDocId).toBe("doc-x");
    });

    it("events.*/workflow.* 已实现（v0.4.0）：list/pull/plan 正常返回", async () => {
        const mem = new MemKernel();
        send(mem, "e1", "events.list");
        const s = make(mem);
        const r1 = await run(mem, s);
        expect(r1[0].status).toBe("recorded"); // 白名单含 checkin:event-recorded（stable）
        send(mem, "w1", "workflow.plan");
        const r2 = await run(mem, s);
        expect(r2.at(-1)!.status).toBe("rejected"); // 空 steps → rejected（实现生效的证据）
        expect(r2.at(-1)!.message).toContain("steps");
    });
});
