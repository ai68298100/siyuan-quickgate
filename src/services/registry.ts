/**
 * 命令注册表探测（M0 spike ① 待实证）：单点封装，探测失败自动降级。
 * 假设形状（3.8.x 常见）：window.siyuan.ws.app.plugins = 插件实例数组，
 * 实例含 .name / .displayName / .commands[]（addCommand 注册的命令面板条目）。
 * 探测到的形状必须记录进 docs/WALKTHROUGH.md；本文件是唯一允许接触注册表的模块。
 */
import { PluginCommandInfo } from "../types/bridge";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 运行时命令条目（含 callback；wire 输出时由调用方投影为 PluginCommandInfo） */
export interface CommandEntry extends PluginCommandInfo {
    callback: () => unknown;
}

export interface RegistryProbeResult {
    source: "host" | "fallback";
    plugins: Array<{ name: string; displayName: string; commands: CommandEntry[] }>;
    reason?: string;
}

export function probeCommandRegistry(getWindow: () => any = () => (globalThis as any).window): RegistryProbeResult {
    try {
        const w = getWindow();
        const app = w?.siyuan?.ws?.app;
        const plugins = app?.plugins;
        if (!Array.isArray(plugins)) {
            return { source: "fallback", plugins: [], reason: "宿主注册表形状不符（spike ① 待实证），已降级" };
        }
        const out: RegistryProbeResult["plugins"] = [];
        for (const p of plugins) {
            if (!p || typeof p.name !== "string") continue;
            const cmds = Array.isArray(p.commands) ? p.commands : [];
            const list: CommandEntry[] = [];
            for (const c of cmds) {
                if (!c || typeof c !== "object") continue;
                const id = typeof c.command === "string" ? c.command : typeof c.id === "string" ? c.id : "";
                if (!id || typeof c.callback !== "function") continue;
                const title =
                    (typeof c.customHotTitle === "string" && c.customHotTitle) ||
                    (typeof c.langText === "string" && c.langText) ||
                    (typeof c.title === "string" && c.title) ||
                    id;
                list.push({
                    plugin: p.name,
                    pluginDisplayName: typeof p.displayName === "string" ? p.displayName : p.name,
                    id,
                    title,
                    accelerator: typeof c.hotkey === "string" ? c.hotkey : undefined,
                    callback: c.callback as () => unknown,
                });
            }
            out.push({ name: p.name, displayName: typeof p.displayName === "string" ? p.displayName : p.name, commands: list });
        }
        return { source: "host", plugins: out };
    } catch (e) {
        return { source: "fallback", plugins: [], reason: `注册表探测异常：${String(e)}` };
    }
}

/** 命令查找与执行（对用户等价于在命令面板选中该条目） */
export function findCommand(probe: RegistryProbeResult, pluginName: string, commandId: string) {
    return probe.plugins
        .find((p) => p.name === pluginName)
        ?.commands.find((c) => c.id === commandId);
}

export async function runCommand(
    probe: RegistryProbeResult,
    pluginName: string,
    commandId: string,
    opts: { confirmExec: boolean; confirm: (title: string) => Promise<boolean> }
): Promise<{ ok: boolean; status: "recorded" | "rejected" | "unsupported" | "failed"; message: string; elapsedMs: number }> {
    const t0 = Date.now();
    const cmd = findCommand(probe, pluginName, commandId);
    if (!cmd) {
        return { ok: false, status: "unsupported", message: `命令不存在：${pluginName}/${commandId}（插件可能已停用）`, elapsedMs: 0 };
    }
    if (opts.confirmExec) {
        const ok = await opts.confirm(`${cmd.title}（来自 ${pluginName}）`);
        if (!ok) return { ok: false, status: "rejected", message: "用户未确认", elapsedMs: Date.now() - t0 };
    }
    try {
        await cmd.callback();
        return { ok: true, status: "recorded", message: "已执行", elapsedMs: Date.now() - t0 };
    } catch (e) {
        return { ok: false, status: "failed", message: `执行异常：${e instanceof Error ? e.message : String(e)}`, elapsedMs: Date.now() - t0 };
    }
}
