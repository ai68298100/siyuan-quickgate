import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/services/store";

/** 混沌工程：故意注入恶劣输入验证系统韧性（不依赖 SiYuan 内核） */

describe("混沌工程：设置归一化恶劣场景", () => {
    it("normalizeSettings 为 null/undefined/数组/字符串 → 回默认", () => {
        expect(normalizeSettings(null).bridgeEnabled).toBe(false);
        expect(normalizeSettings(undefined).bridgeEnabled).toBe(false);
        expect(normalizeSettings([1,2,3] as unknown as Record<string,unknown>).bridgeEnabled).toBe(false);
        expect(normalizeSettings("string" as unknown as Record<string,unknown>).bridgeEnabled).toBe(false);
    });

    it("normalizeSettings 越界值 → 回默认", () => {
        const s = normalizeSettings({ pollMs: -1, backoffMaxMs: -1, auditMax: -1, bridgeBasePath: "../etc/passwd", deviceName: "x".repeat(200) });
        expect(s.pollMs).toBe(500);
        expect(s.backoffMaxMs).toBe(10000);
        expect(s.auditMax).toBe(200);
        expect(s.bridgeBasePath).toBe("/storage/petal/siyuan-quickgate/bridge");
        expect(s.deviceName.length).toBe(64);
    });

    it("normalizeSettings 正常值 → 保留", () => {
        const s = normalizeSettings({ bridgeEnabled: true, pollMs: 1000, confirmExec: false });
        expect(s.bridgeEnabled).toBe(true);
        expect(s.pollMs).toBe(1000);
        expect(s.confirmExec).toBe(false);
    });

    it("安全默认守护（§11 红线）：确认开关默认开、桥默认关、允许名单非空——任何历史/损坏数据不得关闭", () => {
        // 全空/垃圾输入 → 安全默认
        for (const bad of [null, undefined, {}, { schemaVersion: 999 }, []]) {
            const s = normalizeSettings(bad as unknown as Record<string, unknown>);
            expect(s.confirmExec, "commands.run 确认门必须默认开").toBe(true);
            expect(s.bridgeEnabled, "外部面必须默认关").toBe(false);
            expect(s.rawApiEnabled, "plugin.api 透传必须默认关").toBe(false);
            expect(s.broadcastEnabled, "广播快路径必须默认关").toBe(false);
            expect(s.mobileBridgeEnabled, "移动端桥必须默认关").toBe(false);
            expect(s.rawApiAllowlist.length, "允许名单默认须含已审计适配器").toBeGreaterThan(0);
        }
        // 部分字段损坏：坏字段回默认，其余保留（confirmExec 坏值不得悄悄变 false）
        const partial = normalizeSettings({ confirmExec: "true", blacklist: "x", pollMs: "abc" } as unknown as Record<string, unknown>);
        expect(partial.confirmExec).toBe(true);
        expect(partial.blacklist).toEqual([]);
        expect(partial.pollMs).toBe(500);
    });
});

describe("混沌工程：JSON 恶劣输入", () => {
    it("合法 JSON 解析不崩溃", () => {
        const valid = ['null', '{"a":1}', '[1,2]', '"string"', '123', 'true', 'false', '{}', '[]'];
        for (const input of valid) {
            expect(() => JSON.parse(input)).not.toThrow();
        }
    });

    it("无效 JSON 抛 SyntaxError（系统层 catch 处理而非阻止抛出）", () => {
        const invalid = ['{"a":}', '{"a":1,}', '[1,2,', '{', '}', '', '  '];
        for (const input of invalid) {
            expect(() => JSON.parse(input)).toThrow();
        }
    });

    it("prototype pollution 尝试不污染 Object.prototype", () => {
        const input = '{"__proto__":{"polluted":"yes"}}';
        const parsed = JSON.parse(input);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("超长 JSON 字符串（1MB）解析不崩溃", () => {
        const huge = JSON.stringify({ data: "x".repeat(1024 * 1024) });
        const parsed = JSON.parse(huge);
        expect(parsed.data.length).toBe(1024 * 1024);
    });
});

// ============================================================================
// 多写者混沌（R69-P1：CLI/PowerShell/MCP 并发 getFile→append→putFile 的窗口实证）
// 结论（确定性实证）：双写者交错存在真实丢行窗口（stale-writer overwrite）；
// 系统性恢复 = 调用方超时后**同 id** 重发（台账去重，绝不双执行）→ 最终无丢失。
// 生产约定：外部单写者（每个客户端只写自己的命令、消费靠快门）+ MCP 3s 补发已内建。
// ============================================================================
import { BridgeService } from "../src/services/bridge-service";
import { KernelApi } from "../src/services/kernelApi";
import { BridgeStore } from "../src/services/store";

class ChaosKernel {
    files = new Map<string, string>();
    putCount = 0;
    api: KernelApi;
    constructor(jitterMs = 0) {
        this.api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
            const u = String(url);
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
            const jitter = () => new Promise((r) => setTimeout(r, jitterMs));
            if (u === "/api/file/getFile") {
                await jitter();
                const text = this.files.get(body.path);
                return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
            }
            if (u === "/api/file/putFile") {
                const form = init?.body as FormData;
                await jitter(); // 扩大写-写交错窗口
                this.files.set(String(form.get("path")), await (form.get("file") as File).text());
                this.putCount += 1;
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: null }) } as Response;
            }
            return { ok: false, status: 404, text: async () => "{}" } as Response;
        }) as unknown as typeof fetch);
    }
    lines(path: string): string[] {
        return (this.files.get(path) ?? "").split(/\r?\n/).filter((l) => l.trim() !== "");
    }
}

const chaosSettings = () => ({
    schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 20, backoffMaxMs: 10000,
    confirmExec: false, blacklist: [] as string[], auditMax: 200,
    rawApiEnabled: false, rawApiAllowlist: [], broadcastEnabled: false,
    bridgeBasePath: "/bridge", deviceName: "dev-a",
});

function makeService(mem: ChaosKernel) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    return new BridgeService({
        api: mem.api, store, settings: chaosSettings,
        pluginName: "chaos", pluginVersion: "0",
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
    });
}

const CMD_PATH = "/bridge/commands.ndjson";
const RES_PATH = "/bridge/results.ndjson";

function envelope(id: string): string {
    return JSON.stringify({ v: 1, id, op: "bridge.ping", args: {}, createdAt: new Date().toISOString() });
}

function receiptsFor(mem: ChaosKernel, id: string): string[] {
    return mem.lines(RES_PATH).filter((l) => l.includes("\"id\":\"" + id + "\""));
}

describe("混沌工程：多写者（R69-P1 混沌测试）", () => {

    it("确定性双写者交错：stale-writer 丢行窗口实证", async () => {
        const mem = new ChaosKernel(3);
        // A 读（拿到空文件）→ B 读+追加 B1+写 → A 追加 A1 写回（基于旧快照）→ B1 被覆盖丢失
        const readA = mem.api.getFileText(CMD_PATH); await readA;         // A 的快照 = 空
        const textB = (await mem.api.getFileText(CMD_PATH)) ?? "";        // B 的快照 = 空
        await mem.api.putFileText(CMD_PATH, textB + envelope("B1") + "\n"); // B 写入 B1
        await mem.api.putFileText(CMD_PATH, (await readA ?? "") + envelope("A1") + "\n"); // A 旧快照写回

        expect(mem.lines(CMD_PATH).map((l) => JSON.parse(l).id).sort()).toEqual(["A1"]); // B1 丢失实证
    }, 15000);

    it("丢行后同 id 重发：台账去重恢复——每 id 恰好一条回执，无永久丢失无双执行", async () => {
        const mem = new ChaosKernel(2);
        const svc = makeService(mem);
        // 复现丢行：B1 被覆盖
        const readA = mem.api.getFileText(CMD_PATH); await readA;
        const textB = (await mem.api.getFileText(CMD_PATH)) ?? "";
        await mem.api.putFileText(CMD_PATH, textB + envelope("B1") + "\n");
        await mem.api.putFileText(CMD_PATH, envelope("A1") + "\n");

        // 消费者消费 A1（B1 已不在文件里）
        await svc.tick();
        expect(receiptsFor(mem, "A1").length).toBe(1);

        // 调用方超时发现 B1 无回执 → **同 id** 重发（MCP 3s 补发同款语义）
        await mem.api.putFileText(CMD_PATH, (mem.files.get(CMD_PATH) ?? "").trimEnd() + "\n" + envelope("B1") + "\n");
        await svc.tick();

        expect(receiptsFor(mem, "B1").length).toBe(1); // 恢复：恰好一条
        expect(mem.lines(RES_PATH).length).toBe(2);    // 总回执 = 命令数，无双执行
    }, 15000);

    it("消费者压缩不吞并发追加：生产者新行在压缩窗口后仍被消费", async () => {
        const mem = new ChaosKernel(1);
        const svc = makeService(mem);
        mem.files.set(CMD_PATH, envelope("C1") + "\n");
        await svc.tick();                 // 消费 C1 → 压缩
        expect(mem.lines(CMD_PATH).length).toBe(0); // C1 已压缩
        // 并发生产者在压缩后追加 C2（真实时序：压缩与追加都走整文件写，追加基于最新读）
        const latest = (await mem.api.getFileText(CMD_PATH)) ?? "";
        await mem.api.putFileText(CMD_PATH, latest + envelope("C2") + "\n");
        await svc.tick();
        expect(receiptsFor(mem, "C2").length).toBe(1); // 新行存活且被消费（阻断项1 语义）
    }, 15000);
});
