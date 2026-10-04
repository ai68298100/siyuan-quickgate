import { describe, expect, it } from "vitest";
import { kernelAgentCapture, kernelAgentDiscover } from "../src/kernel-ops";
import { createKernelOpHandler, type KernelDeps } from "../src/kernel-ops";
import type { EcosystemManifest } from "../src/services/bridge-service";

/** 可编程内核假件（同 kernel-ops.test.ts 模式） */
function makeDeps(opts?: { kpostScript?: Map<string, unknown> }): { deps: KernelDeps; calls: Array<{ endpoint: string; payload: unknown }> } {
    const calls: Array<{ endpoint: string; payload: unknown }> = [];
    const deps: KernelDeps = {
        kpost: async (endpoint, payload = {}) => {
            calls.push({ endpoint, payload });
            const scripted = opts?.kpostScript?.get(endpoint);
            if (scripted !== undefined) return scripted as never;
            throw new Error(`unexpected kpost ${endpoint}`);
        },
        getFileText: async () => null,
        manifest: { version: 2, plugins: [] } as unknown as EcosystemManifest,
        pluginName: "siyuan-quickgate",
    };
    return { deps, calls };
}

describe("kernelAgentCapture/Discover（内置 Agent 能力 · R245）", () => {
    it("capture：发现日记笔记本→appendDailyNoteBlock 落一笔；text 缺失 rejected", async () => {
        const { deps, calls } = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", { notebooks: [{ id: "n1", name: "日记", closed: false }] }],
                ["/api/notebook/getNotebookConf", { conf: { dailyNoteSavePath: "/diary/{{now | date \"2006-01-02\"}}" } }],
                ["/api/query/sql", { data: [] }],
                ["/api/block/appendDailyNoteBlock", null],
            ]),
        });
        const ok = await kernelAgentCapture(deps, { text: "  记一杯水  " });
        expect(ok.isError).toBeFalsy();
        expect(ok.text).toContain("已记到今日日记");
        expect(ok.text).toContain("记一杯水");
        expect(calls.some((c) => c.endpoint === "/api/block/appendDailyNoteBlock")).toBe(true);

        const empty = await kernelAgentCapture(deps, {});
        expect(empty.isError).toBe(true);
        expect(empty.text).toContain("text 缺失");
    });

    it("capture：无日记笔记本→诚实拒绝不落块", async () => {
        const { deps, calls } = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", { notebooks: [{ id: "n2", name: "空", closed: false }] }],
                ["/api/query/sql", { data: [] }],
            ]),
        });
        const r = await kernelAgentCapture(deps, { text: "x" });
        expect(r.isError).toBe(true);
        expect(r.text).toContain("未发现日记笔记本");
        expect(calls.some((c) => c.endpoint === "/api/block/appendDailyNoteBlock")).toBe(false);
    });

    it("discover（Agent 面）：透传 createInboxIfMissing；isError 随 receipt", async () => {
        const { deps } = makeDeps({
            kpostScript: new Map([
                ["/api/notebook/lsNotebooks", { notebooks: [{ id: "n1", name: "笔记", closed: false }] }],
                ["/api/query/sql", { data: [] }],
                ["/api/filetree/createDocWithMd", "20261005-inbox"],
            ]),
        });
        const r = await kernelAgentDiscover(deps, { createInboxIfMissing: true });
        expect(r.isError).toBeFalsy();
        expect((r.data as { inboxDocId: string }).inboxDocId).toBe("20261005-inbox");
    });

    it("kernel route 对 Agent 三能力名的行为不变（仍走各自 op 面）", async () => {
        const { deps } = makeDeps({});
        const handle = createKernelOpHandler(deps);
        const r = await handle("bridge.ping", {});
        expect(r.status).toBe("recorded");
    });
});
