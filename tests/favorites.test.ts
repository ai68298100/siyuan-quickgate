import { describe, expect, it } from "vitest";
import { normalizeFavorites, pushRecent, upsertFavorite, removeEntry, FAVORITES_CAP, RECENT_CAP } from "../src/services/favorites";
import { MemKernel, makeTestService, testEnvelope as envelope } from "./helpers/test-env";

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

/** 内存文件系统 + 服务组装：共享夹具（tests/helpers/test-env.ts），registry 特化在此注入 */
function makeService(mem: MemKernel) {
    return makeTestService(mem, {
        registry: () => ({ source: "fallback", plugins: [{ name: "siyuan-checkin", displayName: "小驴打卡", commands: [{ title: "记一笔", id: "record", plugin: "siyuan-checkin", callback: async () => {} } as never] }] }),
    });
}

const envelope = (id: string, op: string, args: object) => testEnvelope(id, op, args);

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

    it("clearRecent=true：一次清空全部最近使用，无需 plugin/command（L472 清除历史）", async () => {
        const mem = new MemKernel();
        const svc = makeService(mem);
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string; data: unknown }> }).dispatch.bind(svc);
        await dispatch({ id: "c0", op: "commands.run", args: { plugin: "siyuan-checkin", command: "record" } });
        const before = await dispatch({ id: "c1", op: "favorites.list", args: {} });
        expect((before.data as { recent: unknown[] }).recent).toHaveLength(1);
        const clr = await dispatch({ id: "c2", op: "favorites.remove", args: { clearRecent: true } });
        expect(clr.status).toBe("recorded");
        expect((clr.data as { removed: number }).removed).toBe(1);
        const after = await dispatch({ id: "c3", op: "favorites.list", args: {} });
        expect((after.data as { recent: unknown[] }).recent).toHaveLength(0);
    });

    it("缺参 rejected", async () => {
        const svc = makeService(new MemKernel());
        const dispatch = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string }> }).dispatch.bind(svc);
        expect((await dispatch({ id: "x1", op: "favorites.add", args: { plugin: "p" } })).status).toBe("rejected");
        expect((await dispatch({ id: "x2", op: "favorites.remove", args: {} })).status).toBe("rejected");
    });
});
