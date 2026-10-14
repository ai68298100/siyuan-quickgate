import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { showMessage } = vi.hoisted(() => ({ showMessage: vi.fn() }));
vi.mock("siyuan", () => ({
    Plugin: class {
        loadData = vi.fn();
        saveData = vi.fn().mockResolvedValue(undefined);
    },
    showMessage,
    confirm: vi.fn(),
    openTab: vi.fn(),
    getFrontend: () => "desktop",
    Dialog: class {},
}));

import QuickGatePlugin from "../src/index";
import type { BridgeService } from "../src/services/bridge-service";

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
};

describe("插件实例退出", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-14T08:00:00Z"));
        vi.clearAllMocks();
        delete (globalThis as { __qgActiveInstance?: unknown }).__qgActiveInstance;
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete (globalThis as { __qgActiveInstance?: unknown }).__qgActiveInstance;
    });

    const makePlugin = () => {
        const plugin = new QuickGatePlugin({ app: {} as never, name: "siyuan-quickgate", displayName: "小驴快门", i18n: {} });
        const stop = vi.spyOn(plugin, "stopBridge").mockResolvedValue(undefined);
        const events = vi.spyOn(plugin, "stopEventBridge").mockImplementation(() => {});
        const stats = vi.spyOn(plugin.store, "saveStats").mockResolvedValue(undefined);
        plugin.activeService = { stats: plugin.store.statsSnapshot } as BridgeService;
        return { plugin, stop, events, stats };
    };

    it("重载退出不误报停用，最后一个 tick 的审计和统计完成后才通知宿主", async () => {
        const { plugin, stop, stats } = makePlugin();
        const tick = deferred();
        const saved = deferred();
        stop.mockImplementation(() => tick.promise.then(() => {
            plugin.auditLog.push({ time: "2026-10-14T08:00:01Z", plugin: "siyuan-quickgate", command: "bridge.ping", status: "recorded", elapsedMs: 1 });
        }));
        stats.mockReturnValue(saved.promise);
        let finished = false;
        const cleanup = plugin.onunload().then(() => { finished = true; });
        await Promise.resolve();
        expect(plugin.saveData).not.toHaveBeenCalled();
        expect(finished).toBe(false);

        tick.resolve();
        await vi.waitFor(() => expect(stats).toHaveBeenCalledOnce());
        expect(plugin.saveData).toHaveBeenCalledWith("audit.json", expect.objectContaining({ entries: [expect.objectContaining({ command: "bridge.ping" })] }));
        expect(finished).toBe(false);
        saved.resolve();
        await cleanup;
        expect(finished).toBe(true);
        expect(showMessage).not.toHaveBeenCalled();
    });

    it("重复退出复用同一次清理，不重复持久化或复活后台循环", async () => {
        const { plugin, stop, events, stats } = makePlugin();
        const tick = deferred();
        stop.mockReturnValue(tick.promise);
        const first = plugin.onunload();
        expect(plugin.onunload()).toBe(first);
        expect(stop).toHaveBeenCalledOnce();
        expect(events).toHaveBeenCalledOnce();
        tick.resolve();
        await first;
        await vi.advanceTimersByTimeAsync(3000);
        expect(plugin.loadData).not.toHaveBeenCalled();
        expect(plugin.saveData).toHaveBeenCalledOnce();
        expect(stats).toHaveBeenCalledOnce();
        expect(showMessage).not.toHaveBeenCalled();
    });

    it("停桥异常保留日志，仍完成审计与统计保存", async () => {
        const { plugin, stop, stats } = makePlugin();
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = new Error("停止桥失败");
        stop.mockRejectedValue(error);
        await plugin.onunload();
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("停止桥时出现异常"), error);
        expect(plugin.saveData).toHaveBeenCalledOnce();
        expect(stats).toHaveBeenCalledOnce();
        expect(showMessage).not.toHaveBeenCalled();
    });

    it("真正卸载仍提供卸载数据提示", async () => {
        const { plugin } = makePlugin();
        await plugin.onunload();
        plugin.uninstall();
        expect(showMessage).toHaveBeenCalledOnce();
        expect(showMessage).toHaveBeenCalledWith(expect.stringContaining("小驴快门已卸载"), 6000, "info");
    });
});
