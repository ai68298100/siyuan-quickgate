import { describe, expect, it, vi } from "vitest";
import { installationFor, installationMessage, readInstallation } from "../src/services/plugin-status";
import { createKernelOpHandler } from "../src/kernel-ops";
import manifest from "../src/assets/ecosystem-manifests.json";
import { dispatchOf, makeTestService, MemKernel } from "./helpers/test-env";

const now = () => 1_792_000_000_000;
const read = (packages: unknown[]) => readInstallation(async () => ({ packages }), now);

describe("公开安装清单的证据边界", () => {
    it("启用、停用、宿主不兼容与坏包独立，版本缺失不当未安装，不输出额外元数据", async () => {
        const snapshot = await read([
            { name: "enabled", version: "1.0", enabled: true, installedIncompatible: false, js: "private-code", token: "secret" },
            { name: "disabled", enabled: false },
            { name: "incompatible", enabled: true, installedIncompatible: true },
            { name: "invalid", invalidReason: "invalid-manifest" },
        ]);
        expect(installationFor(snapshot, "enabled")).toMatchObject({ installed: true, enabled: true, installationState: "enabled" });
        expect(installationFor(snapshot, "disabled")).toMatchObject({ installed: true, installedVersion: null, installationState: "disabled" });
        expect(installationFor(snapshot, "incompatible").installationState).toBe("incompatible");
        expect(installationFor(snapshot, "invalid").installationState).toBe("invalid");
        expect(JSON.stringify(snapshot)).not.toMatch(/private-code|secret/);
    });
    it("有效空清单与省略 enabled 各自保留证据", async () => {
        expect(installationFor(await read([]), "missing").installed).toBe(false);
        expect(installationFor(await read([{ name: "old" }]), "old")).toMatchObject({ installed: true, enabled: null, installationState: "unknown" });
    });
    it.each([null, [], {}, { packages: null }, { packages: [null] }, { packages: [{}] }, { packages: [{ name: "a" }, { name: "a" }] }])("坏响应 %j 不改写成缺席", async (raw) => {
        const snapshot = await readInstallation(async () => raw, now);
        expect(snapshot.status).toBe("failed");
        expect(installationFor(snapshot, "any").installed).toBeNull();
        expect(installationMessage(snapshot, "any").label).toBe("读取失败");
    });
    it("鉴权异常保留原因，读接口仅调用一次", async () => {
        const api = vi.fn(async () => { throw new Error("权限拒绝"); });
        const snapshot = await readInstallation(api, now);
        expect(snapshot.error).toBe("权限拒绝");
        expect(api).toHaveBeenCalledTimes(1);
        expect(installationFor(snapshot, "any").installed).toBeNull();
    });
    it("挂起请求有界，迟到结果不能回填成成功，也不重发", async () => {
        vi.useFakeTimers();
        try {
            let resolve: (value: unknown) => void;
            const api = vi.fn(() => new Promise((r) => { resolve = r; }));
            const request = readInstallation(api, now, 50);
            await vi.advanceTimersByTimeAsync(50);
            const snapshot = await request;
            resolve({ packages: [{ name: "any", enabled: true }] });
            await Promise.resolve();
            expect(snapshot.status).toBe("failed");
            expect(snapshot.error).toContain("超时");
            expect(api).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it("前端和内核使用同一公共清单，不调用 loadPetals，异常 installed=null", async () => {
        const mem = new MemKernel();
        const listInstalledPlugins = vi.fn(async () => ({ packages: [{ name: "siyuan-checkin", enabled: false, installedIncompatible: false }] }));
        const service = makeTestService(mem, { listInstalledPlugins, now });
        const front = await dispatchOf(service)("front", "registry.list");
        const kpost = vi.fn(async (endpoint: string) => {
            expect(endpoint).toBe("/api/bazaar/getInstalledPlugin");
            return listInstalledPlugins();
        });
        const kernel = await createKernelOpHandler({ kpost: kpost as never, getFileText: async () => null, manifest: manifest as never, pluginName: "siyuan-quickgate" })("registry.list", {});
        const plugin = (data: unknown) => (data as { plugins: Array<{ pluginId: string; enabled: boolean }> }).plugins.find(p => p.pluginId === "siyuan-checkin");
        expect(plugin(front.data)).toEqual(plugin(kernel.data));
        expect(plugin(front.data)).toMatchObject({ installed: true, enabled: false, installationState: "disabled" });
        listInstalledPlugins.mockRejectedValue(new Error("不可达"));
        const failed = await dispatchOf(service)("failed", "registry.list");
        expect(plugin(failed.data)).toMatchObject({ installed: null, installationState: "unknown" });
        expect(mem.files.size).toBe(0);
    });
});
