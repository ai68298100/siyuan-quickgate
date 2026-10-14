import { describe, expect, it, vi } from "vitest";
import { checkOpPreflight, PreflightDeps } from "../src/services/op-preflight";

const now = () => 1_792_000_000_000;
function setup(plugin = "siyuan-checkin", bridge: Record<string, unknown> = {}) {
    const deps: PreflightDeps = {
        now, bridgeAlive: vi.fn(() => true),
        listInstalledPlugins: vi.fn(async () => ({ packages: [{ name: plugin, enabled: true, installedIncompatible: false }] })),
        getBridge: vi.fn(() => ({ version: 5, isReady: () => true, hasCapability: () => true, ...bridge })),
    };
    return deps;
}
describe("命令表单只读预检", () => {
    it("零业务调用、无正文证据，false/0 合法；重检读取当前状态", async () => {
        const recordEvent = vi.fn();
        const deps = setup("siyuan-checkin", { recordEvent, whenReady: vi.fn() });
        const first = await checkOpPreflight("checkin.record", { itemId: "i1", value: 0, note: "正文不能进入报告" }, deps);
        expect(first.canInvoke).toBe(true);
        expect(JSON.stringify(first)).not.toContain("正文不能进入报告");
        expect(first.checks).toContainEqual(expect.objectContaining({ condition: "business-config", state: "unknown", blocking: false }));
        expect(recordEvent).not.toHaveBeenCalled();
        const bridge = deps.getBridge("siyuan-checkin") as { whenReady: ReturnType<typeof vi.fn> };
        expect(bridge.whenReady).not.toHaveBeenCalled();
        vi.mocked(deps.listInstalledPlugins).mockResolvedValue({ packages: [{ name: "siyuan-checkin", enabled: false }] });
        expect((await checkOpPreflight("checkin.record", { itemId: "i1" }, deps)).canInvoke).toBe(false);
    });
    it.each([["checkin.record", {}], ["contacts.interaction", { docIds: {} }], ["unknown.op", {}]])("%s 输入错型或缺失不取安装清单", async (op, args) => {
        const deps = setup();
        const result = await checkOpPreflight(op, args, deps);
        expect(result.canInvoke).toBe(false);
        expect(deps.listInstalledPlugins).not.toHaveBeenCalled();
    });
    it("桥关闭只给连接修复入口，检查期间停止也阻止调用", async () => {
        const deps = setup("siyuan-checkin", { getItems: vi.fn() });
        vi.mocked(deps.bridgeAlive).mockReturnValue(false);
        expect((await checkOpPreflight("checkin.items", { includeArchived: false }, deps)).checks).toContainEqual(expect.objectContaining({ repair: "connection", blocking: true }));
        expect(deps.listInstalledPlugins).not.toHaveBeenCalled();
        vi.mocked(deps.bridgeAlive).mockReturnValueOnce(true).mockReturnValue(false);
        expect((await checkOpPreflight("checkin.items", {}, deps)).canInvoke).toBe(false);
    });
    it.each([
        { packages: [] }, { packages: [{ name: "siyuan-checkin", enabled: false }] },
        { packages: [{ name: "siyuan-checkin", enabled: true, installedIncompatible: true }] },
        { packages: [{ name: "siyuan-checkin", enabled: true, invalidReason: "invalid-manifest" }] }, {},
    ])("安装条件 %j 失败，不探业务桥", async (installation) => {
        const deps = setup();
        vi.mocked(deps.listInstalledPlugins).mockResolvedValue(installation);
        const report = await checkOpPreflight("checkin.items", {}, deps);
        expect(report.canInvoke).toBe(false);
        expect(deps.getBridge).not.toHaveBeenCalled();
    });
    it.each([
        { version: 4, getItems: vi.fn() }, { version: 5 },
        { version: 5, getItems: vi.fn(), hasCapability: () => false },
        { version: 5, getItems: vi.fn(), isReady: () => false },
    ])("协议、方法、能力、就绪分别阻止调用", async (bridge) => {
        const result = await checkOpPreflight("checkin.items", {}, setup("siyuan-checkin", bridge));
        expect(result.canInvoke).toBe(false);
    });
    it("公开桥缺席和探针异常不推断未安装/未配置", async () => {
        const deps = setup();
        vi.mocked(deps.getBridge).mockReturnValue(undefined);
        const absent = await checkOpPreflight("checkin.items", {}, deps);
        expect(absent.canInvoke).toBe(false);
        expect(absent.checks.find(c => c.condition === "public-bridge")?.message).toContain("不能由此推断未配置");
        vi.mocked(deps.getBridge).mockImplementation(() => { throw new Error("探针拒绝"); });
        expect((await checkOpPreflight("checkin.items", {}, deps)).checks).toContainEqual(expect.objectContaining({ condition: "public-probe", blocking: true }));
    });
    it("指定 occurredAt 只检查批量方法；检查不调用批量方法", async () => {
        const batch = vi.fn();
        const result = await checkOpPreflight("checkin.record", { itemId: "i1", occurredAt: "2026-10-14T00:00:00Z" }, setup("siyuan-checkin", { recordEventsBatch: batch }));
        expect(result.canInvoke).toBe(true);
        expect(batch).not.toHaveBeenCalled();
    });
    it.each([
        ["contacts.search", "siyuan-contacts", { protocol: 1, searchPeople: vi.fn() }, {}],
        ["glean.get", "siyuan-glean", { apiVersion: 1, getClip: vi.fn() }, { id: "20261014100530-abcdefg" }],
        ["home.memo", "siyuan-home", { protocol: 1, addMemo: vi.fn() }, { title: "t", dueDate: "2026-10-14" }],
        ["common.recent", "xiaolv-common", { protocol: 1, getRecent: vi.fn() }, {}],
        ["exam.open", "siyuan-exam", { statsRead: vi.fn(), practice: vi.fn() }, {}],
    ])("%s 按当前公开字段核验，不调用方法", async (op, plugin, bridge, args) => {
        const result = await checkOpPreflight(op, args, setup(plugin, bridge));
        expect(result.canInvoke).toBe(true);
        for (const method of Object.values(bridge)) if (typeof method === "function") expect(method).not.toHaveBeenCalled();
    });
    it("导航参数选择真实入口；未纳入的目标条件诚实保留", async () => {
        const deps = setup("siyuan-home", { protocol: 1, openButler: vi.fn() });
        expect((await checkOpPreflight("home.open", { target: "reminders" }, deps)).canInvoke).toBe(false);
        expect((await checkOpPreflight("home.open", {}, deps)).canInvoke).toBe(true);
        const doc = await checkOpPreflight("doc.open", { id: "id" }, deps);
        expect(doc.canInvoke).toBe(true);
        expect(doc.checks.find(c => c.condition === "scope")?.state).toBe("unknown");
    });
});
