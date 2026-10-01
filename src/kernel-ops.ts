/**
 * 内核同步路由的 op 纯逻辑（v0.5.5 从 kernel.ts 抽出以便单测）。
 * 内核 goja 相关的 IO（siyuan.client.fetch）经 KernelDeps 注入；本文件不触碰全局。
 * 与前端通道共享契约：events 白名单口径与 services/events.ts 一致，pull 按 idempotencyKey 去重。
 */
import { eventWhitelist, parseEventLine } from "./services/events";
import type { EcosystemManifest } from "./services/bridge-service";
import { FRONTEND_ONLY_OPS } from "./ops";

export type Args = Record<string, unknown>;

export interface Receipt {
    id: string;
    op: string;
    status: "recorded" | "rejected" | "failed" | "unsupported";
    data: unknown;
    message: string;
}

export interface KernelDeps {
    /** 内核 API JSON 信封 POST（非 0 code 抛错） */
    kpost: <T>(endpoint: `/${string}`, payload?: unknown) => Promise<T>;
    /** 读工作区文件；不可达回 null */
    getFileText: (path: string) => Promise<string | null>;
    manifest: EcosystemManifest;
    pluginName: string;
}

export function kernelPing(deps: KernelDeps): Receipt {
    return {
        id: "kernel", op: "bridge.ping", status: "recorded",
        data: { protocol: 1, plugin: deps.pluginName, channel: "kernel-sync", carrier: "private-route" },
        message: "pong（内核同步通道）",
    };
}

export async function kernelRegistryList(deps: KernelDeps): Promise<Receipt> {
    let petals: Array<Record<string, unknown>> = [];
    try {
        petals = await deps.kpost<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: "desktop" });
    } catch { /* 内核自呼在本运行时的行为待 spike 校准；失败按空处理 */ }
    const byName = new Map<string, Record<string, unknown>>();
    for (const p of petals) {
        const n = (p as { name?: unknown }).name;
        if (typeof n === "string") byName.set(n, p);
    }
    const plugins = deps.manifest.plugins.map((m) => {
        const petal = byName.get(m.pluginId) as { version?: unknown } | undefined;
        return {
            pluginId: m.pluginId, displayName: m.displayName, maturity: m.maturity,
            manifestVersion: m.version,
            installedVersion: typeof petal?.version === "string" ? petal.version : null,
            installed: byName.has(m.pluginId),
            protocol: m.protocol, capabilities: m.capabilities, hubIntegration: m.hubIntegration,
        };
    });
    return { id: "kernel", op: "registry.list", status: "recorded", data: { manifestVersion: deps.manifest.version, plugins, registrySource: "kernel" }, message: `生态清单 ${plugins.length} 款` };
}

export function kernelEventsList(deps: KernelDeps): Receipt {
    const wl = eventWhitelist(deps.manifest);
    const events = [...wl.entries()].map(([name, meta]) => ({ name, ...meta }));
    return { id: "kernel", op: "events.list", status: "recorded", data: { events }, message: `白名单事件 ${events.length} 个` };
}

/** 与前端 pullEvents 同契约：白名单过滤 + idempotencyKey 去重 + since/limit */
export async function kernelEventsPull(deps: KernelDeps, args: Args): Promise<Receipt> {
    const wl = eventWhitelist(deps.manifest);
    const files: string[] = [];
    for (const source of new Set([...wl.values()].map((v) => v.source))) {
        files.push(`/storage/petal/${source}/bridge/events.ndjson`);
    }
    const sinceTs = typeof args.since === "string" ? Date.parse(args.since) : NaN;
    const names = Array.isArray(args.names) ? args.names.filter((x): x is string => typeof x === "string") : undefined;
    const limit = typeof args.limit === "number" ? Math.min(args.limit, 200) : 200;
    const seen = new Set<string>();
    const events: unknown[] = [];
    for (const f of files) {
        if (events.length >= limit) break;
        const text = (await deps.getFileText(f)) ?? "";
        if (!text.trim()) continue;
        for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
            if (events.length >= limit) break;
            const e = parseEventLine(line, f);
            if (!e) continue; // 坏行/缺字段跳过（与前端 parseEventLine 同口径）
            if (!wl.has(e.name)) continue;
            if (names && !names.includes(e.name)) continue;
            if (!Number.isNaN(sinceTs) && Date.parse(e.emittedAt) <= sinceTs) continue;
            if (seen.has(e.idempotencyKey)) continue;
            seen.add(e.idempotencyKey);
            events.push(e);
        }
    }
    return { id: "kernel", op: "events.pull", status: "recorded", data: { events, files }, message: `拉取 ${events.length} 条` };
}

export async function kernelConfigDiscover(deps: KernelDeps): Promise<Receipt> {
    const notes: string[] = [];
    let diaryNotebookId: string | null = null;
    try {
        const resp = await deps.kpost<{ notebooks?: Array<{ id: string; name: string; closed: boolean }> } | Array<{ id: string; name: string; closed: boolean }>>("/api/notebook/lsNotebooks", {});
        const notebooks = Array.isArray(resp) ? resp : resp?.notebooks ?? [];
        for (const nb of notebooks) {
            if (nb.closed) continue;
            try {
                const conf = await deps.kpost<{ conf?: Record<string, unknown> }>("/api/notebook/getNotebookConf", { notebook: nb.id });
                const savePath = (conf?.conf?.dailynoteSavePath as string) ?? "";
                if (!diaryNotebookId && savePath) {
                    diaryNotebookId = nb.id;
                    notes.push(`日记笔记本：${nb.name}（${savePath}）`);
                }
            } catch { /* 单笔记本失败不影响整体 */ }
        }
    } catch (e) {
        notes.push(`发现失败：${e instanceof Error ? e.message : String(e)}`);
    }
    if (!diaryNotebookId) notes.push("未发现日记笔记本（回退手填）");
    return { id: "kernel", op: "config.discover", status: "recorded", data: { diaryNotebookId, inboxDocId: null, notes }, message: "内核侧发现完成" };
}

export async function kernelTemplateNew(deps: KernelDeps, args: Args): Promise<Receipt> {
    const notebook = typeof args.notebook === "string" ? args.notebook : "";
    const hpath = typeof args.hpath === "string" ? args.hpath : "";
    if (!notebook || !hpath) {
        return { id: "kernel", op: "template.new", status: "rejected", data: null, message: "notebook/hpath 缺失" };
    }
    let content = typeof args.template === "string" ? args.template : "";
    if (!content && typeof args.templatePath === "string") {
        content = (await deps.getFileText(`/templates/${args.templatePath.replace(/^\/+/, "")}`)) ?? "";
    }
    if (!content) {
        return { id: "kernel", op: "template.new", status: "rejected", data: null, message: "template/templatePath 均为空" };
    }
    const renderedText = await deps.kpost<string>("/api/template/renderSprig", { template: content });
    const docId = await deps.kpost<string>("/api/filetree/createDocWithMd", { notebook, path: hpath, markdown: renderedText });
    return { id: "kernel", op: "template.new", status: "recorded", data: { docId }, message: "已从模板创建（内核同步通道）" };
}

export function kernelDiagnostics(deps: KernelDeps): Receipt {
    return {
        id: "kernel", op: "diagnostics.report", status: "recorded",
        data: {
            protocol: 1, plugin: deps.pluginName, channel: "kernel-sync",
            kernelRoute: true,
            note: "内核侧精简诊断；桥/队列细节见 NDJSON 通道 diagnostics.report",
        },
        message: "内核诊断（脱敏）",
    };
}

export const FRONTEND_ONLY: Set<string> = new Set(FRONTEND_ONLY_OPS);

export function createKernelOpHandler(deps: KernelDeps): (op: string, args: Args) => Promise<Receipt> {
    return async (op, args) => {
        switch (op) {
            case "bridge.ping": return kernelPing(deps);
            case "registry.list": return await kernelRegistryList(deps);
            case "events.list": return kernelEventsList(deps);
            case "events.pull": return await kernelEventsPull(deps, args);
            case "config.discover": return await kernelConfigDiscover(deps);
            case "template.new": return await kernelTemplateNew(deps, args);
            case "diagnostics.report": return kernelDiagnostics(deps);
            default:
                if (FRONTEND_ONLY.has(op)) {
                    return {
                        id: "kernel", op, status: "unsupported", data: null,
                        message: "该 op 需要前端在线：请走 NDJSON 通道（或等待 v2 前端中继）",
                    };
                }
                return { id: "kernel", op, status: "unsupported", data: null, message: `未知 op：${op}` };
        }
    };
}
