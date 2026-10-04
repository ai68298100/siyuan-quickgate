import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";
import { normalizeFavorites, pushRecent, upsertFavorite, removeEntry, FAVORITES_CAP, RECENT_CAP } from "../src/services/favorites";

describe("favorites 纯逻辑（L474）", () => {
    it("upsert 去重前移；cap 截尾", () => {
        const s = normalizeFavorites(null);
        upsertFavorite(s, { plugin: "p", command: "a", title: "A", addedAt: "" });
        upsertFavorite(s, { plugin: "p", command: "b", title: "B", addedAt: "" });
        upsertFavorite(s, { plugin: "p", command: "a", title: "A2", addedAt: "" }); // 重复：前移+刷新
        expect(s.favorites.map((f) => f.command)).toEqual(["a", "b"]);
        expect(s.favorites[0].title).toBe("A2");
        for (let i = 0; i < FAVORITES_CAP + 5; i++) upsertFavorite(s, { plugin: "p", command: "c" + i, title: "", addedAt: "" });
        expect(s.favorites.length).toBe(FAVORITES_CAP);
    });
    it("removeEntry scope 语义：favorite/recent/both", () => {
        const s = normalizeFavorites(null);
        upsertFavorite(s, { plugin: "p", command: "a", title: "", addedAt: "" });
        pushRecent(s, { plugin: "p", command: "a", title: "" });
        expect(removeEntry(s, "p", "a", "recent")).toBe(1);
        expect(s.favorites.length).toBe(1);
        expect(removeEntry(s, "p", "a", "both")).toBe(1);
        expect(s.favorites.length + s.recent.length).toBe(0);
    });
    it("pushRecent 去重前移 + cap；normalize fail-open", () => {
        const s = normalizeFavorites(null);
        for (let i = 0; i < RECENT_CAP + 3; i++) pushRecent(s, { plugin: "p", command: "r" + i, title: "" });
        expect(s.recent.length).toBe(RECENT_CAP);
        pushRecent(s, { plugin: "p", command: "r0", title: "" }); // 旧条目前移
        expect(s.recent[0].command).toBe("r0");
        expect(normalizeFavorites({ schemaVersion: 2 }).favorites).toEqual([]);
        expect(normalizeFavorites("junk").recent).toEqual([]);
    });
});

/** 内存文件系统（favorites 载体在插件存储根，不走 bridgeBasePath） */
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

function makeService(mem: MemKernel) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    return new BridgeService({
        api: mem.api, store, settings,
        pluginName: "siyuan-quickgate", pluginVersion: "0.1.0",
        deviceName: () => "dev-a",
        registry: () => ({ source: "fallback", plugins: [{ name: "siyuan-checkin", displayName: "小驴打卡", commands: [{ title: "记一笔", id: "record", plugin: "siyuan-checkin", callback: async () => {} } as never] }] }),
        confirm: async () => true, audit: () => {}, editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {}, openSetting: () => {},
        getCheckin: () => undefined, getContacts: () => undefined,
    });
}

const envelope = (id: string, op: string, args: object) =>
    JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ttlMs: 60000 });

describe("favorites dispatch 集成（L474）", () => {
    it("add→list→remove 全链；载体落在 /storage/petal/siyuan-quickgate/favorites.json", async () => {
        const mem = new MemKernel();
        const svc = makeService(mem);
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string; data: unknown; message: string }> }).dispatch.bind(svc);

        const add = await dispatch({ id: "f1", op: "favorites.add", args: { plugin: "siyuan-checkin", command: "record", title: "记一笔" } });
        expect(add.status).toBe("recorded");

        const list = await dispatch({ id: "f2", op: "favorites.list", args: {} });
        const data = list.data as { favorites: Array<{ command: string }>; recent: unknown[] };
        expect(data.favorites).toHaveLength(1);
        expect(data.favorites[0].command).toBe("record");
        expect(mem.files.has("/storage/petal/siyuan-quickgate/favorites.json")).toBe(true);

        const rm = await dispatch({ id: "f3", op: "favorites.remove", args: { plugin: "siyuan-checkin", command: "record" } });
        expect((rm.data as { removed: number }).removed).toBe(1);
        const list2 = await dispatch({ id: "f4", op: "favorites.list", args: {} });
        expect((list2.data as { favorites: unknown[] }).favorites).toHaveLength(0);
    });

    it("commands.run 成功记最近使用（title 取自注册表）；recent 可按 scope 隐私清除", async () => {
        const mem = new MemKernel();
        const svc = makeService(mem);
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string; data: unknown }> }).dispatch.bind(svc);

        const run = await dispatch({ id: "r1", op: "commands.run", args: { plugin: "siyuan-checkin", command: "record" } });
        expect(run.status).toBe("recorded");
        const list = await dispatch({ id: "r2", op: "favorites.list", args: {} });
        const recent = (list.data as { recent: Array<{ command: string; title: string }> }).recent;
        expect(recent).toHaveLength(1);
        expect(recent[0].command).toBe("record");
        expect(recent[0].title).toBe("记一笔"); // title 来自 registry 命令面，非调用方传入

        const rm = await dispatch({ id: "r3", op: "favorites.remove", args: { plugin: "siyuan-checkin", command: "record", scope: "recent" } });
        expect((rm.data as { removed: number }).removed).toBe(1);
    });

    it("缺参 rejected", async () => {
        const svc = makeService(new MemKernel());
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string }> }).dispatch.bind(svc);
        expect((await dispatch({ id: "x1", op: "favorites.add", args: { plugin: "p" } })).status).toBe("rejected");
        expect((await dispatch({ id: "x2", op: "favorites.remove", args: {} })).status).toBe("rejected");
    });
});
