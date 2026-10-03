import { describe, expect, it } from "vitest";
import { createKernelOpHandler, type KernelDeps } from "../src/kernel-ops";
import type { EcosystemManifest } from "../src/services/bridge-service";

/** 可编程内核假件：记录调用并按脚本应答 */
function makeDeps(opts?: { petals?: unknown[]; failLoadPetals?: boolean; files?: Map<string, string>; kpostScript?: Map<string, unknown> }): { deps: KernelDeps; calls: Array<{ endpoint: string; payload: unknown }> } {
    const calls: Array<{ endpoint: string; payload: unknown }> = [];
    const files = opts?.files ?? new Map<string, string>();
    const deps: KernelDeps = {
        kpost: async (endpoint, payload = {}) => {
            calls.push({ endpoint, payload });
            if (opts?.failLoadPetals && endpoint === "/api/petal/loadPetals") throw new Error("kernel self-call unsupported");
            if (endpoint === "/api/petal/loadPetals") return (opts?.petals ?? []) as never;
            const scripted = opts?.kpostScript?.get(endpoint);
            if (scripted !== undefined) return scripted as never;
            throw new Error(`unexpected kpost ${endpoint}`);
        },
        getFileText: async (path) => files.get(path) ?? null,
        manifest: {
            version: 1,
            updatedAt: "2026-10-02",
            plugins: [
                {
                    pluginId: "siyuan-checkin", displayName: "小驴打卡", maturity: "stable", version: "18.16.0",
                    protocol: "window.siyuanCheckin v5", capabilities: ["items.read"], hubIntegration: "透传",
                    events: [
                        { name: "checkin:event-recorded", status: "available" },
                        { name: "checkin:event-deleted", status: "available" },
                        { name: "checkin:analytics-updated", status: "observed" },
                    ],
                },
                { pluginId: "siyuan-contacts", displayName: "小驴人脉", maturity: "stable", version: "0.4.1", protocol: "window.LvContacts v1", capabilities: [], hubIntegration: "透传" },
                { pluginId: "siyuan-flashcards", displayName: "小驴闪卡", maturity: "design", version: "0.5.0", protocol: null, capabilities: [], hubIntegration: "仅 manifest" },
            ],
        } as unknown as EcosystemManifest,
        pluginName: "siyuan-quickgate",
    };
    return { deps, calls };
}

const evLine = (key: string, name = "checkin:event-recorded", emittedAt = "2026-10-02T10:00:00Z") =>
    JSON.stringify({ name, source: "siyuan-checkin", emittedAt, payload: { k: key }, idempotencyKey: key });

describe("kernel-ops（内核同步路由纯逻辑）", () => {
    it("bridge.ping → recorded（kernel-sync 通道标识）", async () => {
        const { deps } = makeDeps();
        const r = await createKernelOpHandler(deps)("bridge.ping", {});
        expect(r.status).toBe("recorded");
        expect((r.data as { channel: string }).channel).toBe("kernel-sync");
    });

    it("registry.list：manifest × loadPetals 合并；loadPetals 失败按空降级", async () => {
        const { deps, calls } = makeDeps({ petals: [{ name: "siyuan-checkin", version: "18.16.0" }] });
        const r = await createKernelOpHandler(deps)("registry.list", {});
        expect(r.status).toBe("recorded");
        const plugins = (r.data as { plugins: Array<{ pluginId: string; installed: boolean; installedVersion: string | null }> }).plugins;
        expect(plugins.find((p) => p.pluginId === "siyuan-checkin")!.installed).toBe(true);
        expect(plugins.find((p) => p.pluginId === "siyuan-contacts")!.installed).toBe(false);
        expect(calls[0].endpoint).toBe("/api/petal/loadPetals");

        const { deps: deps2 } = makeDeps({ failLoadPetals: true });
        const r2 = await createKernelOpHandler(deps2)("registry.list", {});
        expect(r2.status).toBe("recorded");
        expect((r2.data as { plugins: unknown[] }).plugins.length).toBe(3);
    });

    it("events.list：白名单目录（stable 插件全部事件，含 observed）", async () => {
        const { deps } = makeDeps();
        const r = await createKernelOpHandler(deps)("events.list", {});
        const events = (r.data as { events: Array<{ name: string }> }).events;
        expect(events.map((e) => e.name)).toContain("checkin:event-recorded");
        expect(events.map((e) => e.name)).toContain("checkin:analytics-updated"); // stable 插件全量白名单
    });

    it("events.pull：白名单过滤 + names/since/limit + idempotencyKey 去重（与前端同契约）", async () => {
        const files = new Map<string, string>();
        files.set("/storage/petal/siyuan-checkin/bridge/events.ndjson", [
            evLine("k1"),
            evLine("k1"), // 跨行重复 → 去重
            evLine("k2", "checkin:event-deleted", "2026-10-02T11:00:00Z"),
            evLine("k3", "checkin:analytics-updated"), // 不在白名单？stable 插件全量在 → 会进
            "not-json", // 坏行跳过
            JSON.stringify({ name: "checkin:event-recorded", emittedAt: "t" }), // 缺 idempotencyKey → 跳过
        ].join("\n"));
        const { deps } = makeDeps({ files });
        const handle = createKernelOpHandler(deps);

        const r1 = await handle("events.pull", {});
        const ev1 = (r1.data as { events: Array<{ idempotencyKey: string }> }).events;
        expect(ev1.map((e) => e.idempotencyKey)).toEqual(["k1", "k2", "k3"]);

        const r2 = await handle("events.pull", { names: ["checkin:event-deleted"] });
        expect((r2.data as { events: unknown[] }).events.length).toBe(1);

        const r3 = await handle("events.pull", { since: "2026-10-02T10:30:00Z" });
        expect((r3.data as { events: Array<{ idempotencyKey: string }> }).events.map((e) => e.idempotencyKey)).toEqual(["k2"]);

        const r4 = await handle("events.pull", { limit: 1 });
        expect((r4.data as { events: unknown[] }).events.length).toBe(1);
    });

    it("config.discover：dailyNoteSavePath 唯一候选命中；closed 跳过；全未命中给提示", async () => {
        const { deps } = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", { notebooks: [{ id: "n1", name: "日记", closed: false }, { id: "n2", name: "归档", closed: true }] }],
                ["/api/notebook/getNotebookConf", { conf: { dailyNoteSavePath: "/diary/{{now | date \"2006-01-02\"}}" } }],
            ]),
        });
        const r = await createKernelOpHandler(deps)("config.discover", {});
        expect((r.data as { diaryNotebookId: string }).diaryNotebookId).toBe("n1");

        const { deps: deps2 } = makeDeps({
            kpostScript: new Map([["/api/notebook/lsNotebooks", []]]),
        });
        const r2 = await createKernelOpHandler(deps2)("config.discover", {});
        expect((r2.data as { diaryNotebookId: string | null }).diaryNotebookId).toBeNull();
        expect((r2.data as { notes: string[] }).notes.join()).toContain("未发现");
    });

    it("config.discover R25 实证场景：默认模板多数派+自定义模板一个 → 自定义者直接命中（无需等今日日记）", async () => {
        const DEFAULT_T = `/daily note/{{now | date "2006/01"}}/{{now | date "2006-01-02"}}`;
        const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
        const deps2: KernelDeps = {
            kpost: async (endpoint, payload = {}) => {
                calls.push({ endpoint, payload });
                if (endpoint === "/api/notebook/lsNotebooks") return { notebooks: [{ id: "d1", name: "默认甲", closed: false }, { id: "d2", name: "默认乙", closed: false }, { id: "cx", name: "DailyNote", closed: false }] } as never;
                if (endpoint === "/api/notebook/getNotebookConf") {
                    const id = (payload as { notebook: string }).notebook;
                    return { conf: { dailyNoteSavePath: id === "cx" ? `/{{now | date "2006/01"}}/x` : DEFAULT_T } } as never;
                }
                throw new Error(`unexpected ${endpoint}`); // 不应走到 renderSprig/listDocs
            },
            getFileText: async () => null,
            manifest: {
                version: 1,
                plugins: [],
            } as never,
            pluginName: "siyuan-quickgate",
        };
        const r = await createKernelOpHandler(deps2)("config.discover", {});
        expect((r.data as { diaryNotebookId: string }).diaryNotebookId).toBe("cx");
        expect((r.data as { notes: string[] }).notes.join()).toContain("自定义日记模板");
        expect(calls.some((c) => c.endpoint === "/api/template/renderSprig")).toBe(false); // 缩小范围后无需消歧
    });

    it("config.discover 歧义消解（spike⑧ 实证：默认模板多笔记本同值）——按今日日记文档存在性定位", async () => {        const { deps } = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", { notebooks: [{ id: "n1", name: "A", closed: false }, { id: "n2", name: "B", closed: false }] }],
                ["/api/notebook/getNotebookConf", { conf: { dailyNoteSavePath: "/daily note/{{now | date \"2006-01-02\"}}" } }],
                ["/api/template/renderSprig", "/daily note/2026-10-02"],
                ["/api/filetree/listDocsByPath", { files: [{ name: "2026-10-02" }] }],
            ]),
        });
        // getNotebookConf 是同一脚本端点，两笔记本同配置——消歧依赖 listDocsByPath；这里 n1/n2 都"存在"
        // → 无法唯一判定。用可区分脚本重跑：为 n2 定制（kpostScript 按 payload 区分做不到，改用注入顺序函数）。
        const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
        const deps2: KernelDeps = {
            kpost: async (endpoint, payload = {}) => {
                calls.push({ endpoint, payload });
                if (endpoint === "/api/notebook/lsNotebooks") return { notebooks: [{ id: "n1", name: "A", closed: false }, { id: "n2", name: "B", closed: false }] } as never;
                if (endpoint === "/api/notebook/getNotebookConf") return { conf: { dailyNoteSavePath: "/daily note/{{…}}" } } as never;
                if (endpoint === "/api/template/renderSprig") return "/daily note/2026-10-02" as never;
                if (endpoint === "/api/filetree/listDocsByPath") return { files: [{ name: payload.notebook === "n2" ? "2026-10-02" : "别的文档" }] } as never;
                throw new Error(`unexpected ${endpoint}`);
            },
            getFileText: async () => null,
            manifest: deps.manifest,
            pluginName: "siyuan-quickgate",
        };
        const r2 = await createKernelOpHandler(deps2)("config.discover", {});
        expect((r2.data as { diaryNotebookId: string }).diaryNotebookId).toBe("n2");
        expect((r2.data as { notes: string[] }).notes.join()).toContain("消歧");
    });

    it("template.new：参数校验 rejected；templatePath 读取 + renderSprig + createDoc 链", async () => {
        const { deps } = makeDeps();
        const handle = createKernelOpHandler(deps);
        const r0 = await handle("template.new", { notebook: "n" });
        expect(r0.status).toBe("rejected");

        const files = new Map<string, string>([["/templates/meeting.md", "今日 {{ nowos }}" ]]);
        const { deps: deps2, calls } = makeDeps({
            files,
            kpostScript: new Map([
                ["/api/template/renderSprig", "渲染后内容"],
                ["/api/filetree/createDocWithMd", "20261002-doc-id"],
            ]),
        });
        const r = await createKernelOpHandler(deps2)("template.new", { notebook: "n1", hpath: "/日记/x", templatePath: "meeting.md" });
        expect(r.status).toBe("recorded");
        expect((r.data as { docId: string }).docId).toBe("20261002-doc-id");
        expect(calls.some((c) => c.endpoint === "/api/template/renderSprig")).toBe(true);
        expect(calls.find((c) => c.endpoint === "/api/filetree/createDocWithMd")!.payload).toMatchObject({ notebook: "n1", markdown: "渲染后内容" });
    });

    it("前端专属 op → unsupported 指引 NDJSON；未知 op → unsupported", async () => {
        const { deps } = makeDeps();
        const handle = createKernelOpHandler(deps);
        const r1 = await handle("commands.run", {});
        expect(r1.status).toBe("unsupported");
        expect(r1.message).toContain("NDJSON");
        const r2 = await handle("no.such.op", {});
        expect(r2.status).toBe("unsupported");
        expect(r2.message).toContain("no.such.op");
    });

    it("config.discover 收集箱发现：约定名唯一命中即取；零命中回 null+指引；自定义名生效（R69-P2）", async () => {
        // 唯一命中
        const depsHit = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", []],
                ["/api/query/sql", { data: [{ id: "20240101120000-abc", content: "收集箱", box: "nb1" }] }] as never,
            ]),
        });
        const r1 = await createKernelOpHandler(depsHit.deps)("config.discover", {});
        expect((r1.data as { inboxDocId: string }).inboxDocId).toBe("20240101120000-abc");
        expect((r1.data as { notes: string[] }).notes.join()).toContain("收集箱（按约定名发现）");

        // 零命中 → null + 指引建文档/手填
        const depsMiss = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", []],
                ["/api/query/sql", { data: [] }] as never,
            ]),
        });
        const r2 = await createKernelOpHandler(depsMiss.deps)("config.discover", {});
        expect((r2.data as { inboxDocId: string | null }).inboxDocId).toBeNull();
        expect((r2.data as { notes: string[] }).notes.join()).toContain("未发现收集箱根文档");

        // 自定义约定名传入 SQL（取最后一次 SQL 调用——前一次零命中调用用的是默认名）
        await createKernelOpHandler(depsMiss.deps)("config.discover", { inboxName: "收件箱" });
        const sqlCalls = depsMiss.calls.filter((c) => c.endpoint === "/api/query/sql");
        expect(JSON.stringify(sqlCalls[sqlCalls.length - 1]?.payload)).toContain("收件箱");
    });
});
