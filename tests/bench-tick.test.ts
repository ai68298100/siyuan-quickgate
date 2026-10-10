import { describe, expect, it } from "vitest";
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";

/**
 * R74-P0 队列压测：1k 命令积压下 tick 的吞吐与时延（基准数据，非硬阈值断言）。
 * 佐证「单 tick 条数上限」的设计取舍——见本文件末尾结论注释与 MAX_TICK_COMMANDS。
 */

class BenchKernel {
    files = new Map<string, string>();
    getFileCalls = 0;
    putCalls = 0;
    api: KernelApi;
    constructor() {
        this.api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
            const u = String(url);
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
            if (u === "/api/file/getFile") {
                this.getFileCalls += 1;
                const text = this.files.get(body.path);
                return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
            }
            if (u === "/api/file/putFile") {
                const form = init?.body as FormData;
                this.putCalls += 1;
                this.files.set(String(form.get("path")), await (form.get("file") as File).text());
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: null }) } as Response;
            }
            return { ok: false, status: 404, text: async () => "{}" } as Response;
        }) as unknown as typeof fetch);
    }
}

const benchSettings = () => ({
    schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
    confirmExec: false, blacklist: [] as string[], auditMax: 200,
    rawApiEnabled: false, rawApiAllowlist: [], broadcastEnabled: false,
    bridgeBasePath: "/bridge", deviceName: "dev-a",
});

function makeService(mem: BenchKernel) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    return new BridgeService({
        api: mem.api, store, settings: benchSettings,
        pluginName: "bench", pluginVersion: "0",
        deviceName: () => "dev-a",
        registry: () => ({ source: "fallback", plugins: [] }),
        confirm: async () => true,
        audit: () => {},
        editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {}, openSetting: () => {},
        getCheckin: () => undefined, getContacts: () => undefined,
        getGlean: () => undefined, getHome: () => undefined, getExam: () => undefined,
        loadPetals: async () => [],
        discoverConfig: async () => ({ diaryNotebookId: null, inboxDocId: null, notes: [] }),
    });
}

describe("R74-P0 队列压测（基准）", () => {
    it("1000 条 bridge.ping 积压：单 tick 全消费吞吐", async () => {
        const mem = new BenchKernel();
        const lines: string[] = [];
        for (let i = 0; i < 1000; i++) {
            lines.push(JSON.stringify({ v: 1, id: "bench-" + i, op: "bridge.ping", args: {}, createdAt: new Date().toISOString() }));
        }
        mem.files.set("/bridge/commands.ndjson", lines.join("\n") + "\n");
        const svc = makeService(mem);

        const t0 = Date.now();
        const r = await svc.tick();
        const elapsed = Date.now() - t0;

        expect(r.executed).toBe(1000);
        expect(r.receipts).toBe(1000);
        const resultLines = (mem.files.get("/bridge/results.ndjson") ?? "").trim().split("\n").length;
        expect(resultLines).toBe(200); // 回执裁剪到最近 200 行（RESULTS_MAX_LINES）
        console.log(`[bench] 1000 命令单 tick：${elapsed}ms（${(1000 / Math.max(elapsed, 1)).toFixed(0)} cmd/s），getFile×${mem.getFileCalls} putFile×${mem.putCalls}`);
        expect(elapsed).toBeLessThan(30000); // 宽松上界：30s 内必须消化完（真实 op 更慢，此为纯 ping 面）
    }, 60000);
});

// 结论（R74-P0 取舍）：单 tick 全消费在纯 ping 面足够快；真实慢 op 靠 15s 单命令上限兜底。
// 公平性设计：不设 MAX_TICK_COMMANDS 硬上限——「一次 tick 尽量多消化」符合桥"尽快清积压"的
// 语义，且轮询器单飞保证不会并发 tick；若未来引入慢 op 批量积压场景，再按本基准引入
// 条数上限 + 剩余行保留（压缩语义已支持未处理行原样保留）。
