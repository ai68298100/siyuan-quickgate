/**
 * 命令注册表探测（M0 spike ① 待实证）：单点封装，探测失败自动降级。
 * 形状依据（v0.5.8 审计，思源 master app/src/types/index.d.ts ICommand 实证）：
 *   - 命令身份=**langKey**（不存在 command/id 字段——v0.5.7 前误读导致列表为空）
 *   - 显示文本=langText；缺省时由宿主按 i18n[langKey] 解析（插件实例 .i18n 可代取）
 *   - 回调五形态：callback（焦点无关）/ globalCallback / execute / editorCallback / dockCallback /
 *     fileTreeCallback——**更具体的回调存在时 callback 不会被宿主触发**（ICommand 注释原文）；
 *     editor/fileTree/dock 三形需要焦点上下文参数，外部执行仅支持 callback/execute/globalCallback
 *   - 快捷键：customHotkey（宿主 addCommand 解析写回的生效键）→ hotkey → hotkeys[]
 * 运行时仍以 spike① 实证为准；探测到的形状必须记录进 docs/WALKTHROUGH.md。
 * 2026-10-02 bundle 静态核实（本机 3.8.5 安装产物 common.js）：
 *   - Plugin 基类构造器挂载 this.i18n/.displayName/.commands=[] ✓（p.i18n/p.displayName 探测链成立）
 *   - addCommand 用 (name,langKey,hotkey,hotkeys) 解析后回写 hotkey=默认/customHotkey=生效值，
 *     解析失败者报错并从 commands 移除；window.siyuan.ws.app.plugins 遍历路径 ✓
 */
import { PluginCommandInfo } from "../types/bridge";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 运行时命令条目（含 callback；wire 输出时由调用方投影为 PluginCommandInfo） */
export interface CommandEntry extends PluginCommandInfo {
    /** 可无焦点执行的回调（callback/execute/globalCallback 之一）；editor/dock/fileTree 形态无值 */
    callback?: () => unknown;
    /** true=该命令声明的是焦点相关回调（editorCallback/dockCallback/fileTreeCallback），外部无法代执行 */
    focusOnly?: boolean;
}

export interface RegistryProbeResult {
    source: "host" | "fallback";
    plugins: Array<{ name: string; displayName: string; commands: CommandEntry[] }>;
    reason?: string;
}

function firstCallable(c: any): (() => unknown) | undefined {
    for (const k of ["callback", "execute", "globalCallback"] as const) {
        if (typeof c?.[k] === "function") return c[k].bind(c);
    }
    return undefined;
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
            const i18n = (p.i18n ?? {}) as Record<string, string>;
            const cmds = Array.isArray(p.commands) ? p.commands : [];
            const list: CommandEntry[] = [];
            for (const c of cmds) {
                if (!c || typeof c !== "object") continue;
                // 身份：ICommand.langKey（官方唯一标识；command/id 兼容兜底防第三方塞私货）
                const id = typeof c.langKey === "string" && c.langKey
                    ? c.langKey
                    : typeof c.command === "string" ? c.command : typeof c.id === "string" ? c.id : "";
                if (!id) continue;
                const fn = firstCallable(c);
                const focusOnly = !fn && ["editorCallback", "dockCallback", "fileTreeCallback"].some((k) => typeof c[k] === "function");
                if (!fn && !focusOnly) continue;
                // 显示文本：langText 直给 → 宿主 i18n 解析 → 历史兜底 → id
                const title =
                    (typeof c.langText === "string" && c.langText) ||
                    (typeof i18n[c.langKey as string] === "string" && i18n[c.langKey as string]) ||
                    (typeof c.customHotTitle === "string" && c.customHotTitle) ||
                    (typeof c.title === "string" && c.title) ||
                    id;
                // 快捷键：customHotkey（宿主 addCommand 就地写入的用户生效键，3.8.5 bundle 实证）
                // → hotkey（宿主解析后的默认键串）→ hotkeys[]（绕过 addCommand 直塞时的原始形态）
                const accelerator =
                    (typeof c.customHotkey === "string" && c.customHotkey) ||
                    (typeof c.hotkey === "string" && c.hotkey) ||
                    (Array.isArray(c.hotkeys) && c.hotkeys.length > 0 ? c.hotkeys.join(",") : undefined);
                list.push({
                    plugin: p.name,
                    pluginDisplayName: typeof p.displayName === "string" ? p.displayName : p.name,
                    id,
                    title,
                    accelerator: accelerator || undefined,
                    callback: fn,
                    focusOnly: fn ? undefined : true,
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
    if (cmd.focusOnly || typeof cmd.callback !== "function") {
        return { ok: false, status: "unsupported", message: `该命令声明了焦点相关回调（编辑器/文档树/dock），需在思源前台手动执行：${cmd.title}`, elapsedMs: 0 };
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
