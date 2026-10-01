/**
 * 小驴快门 · 内核插件（v2 同步通道 · 实验性）
 *
 * 私有路由 `ANY /plugin/private/siyuan-quickgate/*path`（思源自带 Token+管理员鉴权）：
 *   POST /exec  body={op, args}  → 同步回执（与 NDJSON 回执同形状）
 *
 * 内核可直接处理的 op 子集（只读 + JSON-POST 类，无需前端/DOM）：
 *   bridge.ping / registry.list / diagnostics.report / events.list / events.pull /
 *   config.discover / template.new
 * 前端专属 op（commands.run、checkin.*、contacts.*、editor.context、doc.open 等）
 * 返回 `unsupported`（message 指引走 NDJSON 通道）。
 *
 * 运行时：内核 goja——无 DOM/Node；网络经 siyuan.client.fetch；持久化经 siyuan.storage。
 * 校准依赖：spike⑤⑥⑧（真机）——本路由未依赖其结论，字段不符时相关 op 返回 failed 而非崩溃。
 */
import type * as kernel from "siyuan/kernel";
import manifestJson from "./assets/ecosystem-manifests.json";

const api: kernel.ISiyuan = siyuan;

const PLUGIN_NAME = "siyuan-quickgate";

type Args = Record<string, unknown>;
interface Receipt {
    id: string;
    op: string;
    status: "recorded" | "rejected" | "failed" | "unsupported";
    data: unknown;
    message: string;
}

/* ---------- 内核侧 HTTP 客户端（JSON 信封） ---------- */

async function kpost<T>(endpoint: `/${string}`, payload: unknown = {}): Promise<T> {
    const res = await api.client.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
    });
    const text = await res.text();
    const json = JSON.parse(text) as { code: number; msg: string; data: T };
    if (json.code !== 0) throw new Error(json.msg || `内核错误 code=${json.code}`);
    return json.data;
}

async function getFileText(path: string): Promise<string | null> {
    try {
        const res = await api.client.fetch("/api/file/getFile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path }),
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/* ---------- 内核可处理 op ---------- */

function opPing(): Receipt {
    return {
        id: "kernel", op: "bridge.ping", status: "recorded",
        data: { protocol: 1, plugin: PLUGIN_NAME, channel: "kernel-sync", carrier: "private-route" },
        message: "pong（内核同步通道）",
    };
}

async function opRegistryList(): Promise<Receipt> {
    const manifest = manifestJson as unknown as {
        version: number;
        plugins: Array<{ pluginId: string; displayName: string; maturity: string; version: string | null; protocol: string | null; capabilities: string[]; hubIntegration: string }>;
    };
    let petals: Array<Record<string, unknown>> = [];
    try {
        petals = await kpost<Array<Record<string, unknown>>>("/api/petal/loadPetals", { frontend: "desktop" });
    } catch { /* 内核自呼在本运行时的行为待 spike 校准；失败按空处理 */ }
    const byName = new Map<string, Record<string, unknown>>();
    for (const p of petals) {
        const n = (p as { name?: unknown }).name;
        if (typeof n === "string") byName.set(n, p);
    }
    const plugins = manifest.plugins.map((m) => {
        const petal = byName.get(m.pluginId) as { version?: unknown } | undefined;
        return {
            pluginId: m.pluginId, displayName: m.displayName, maturity: m.maturity,
            manifestVersion: m.version,
            installedVersion: typeof petal?.version === "string" ? petal.version : null,
            installed: byName.has(m.pluginId),
            protocol: m.protocol, capabilities: m.capabilities, hubIntegration: m.hubIntegration,
        };
    });
    return { id: "kernel", op: "registry.list", status: "recorded", data: { manifestVersion: manifest.version, plugins, registrySource: "kernel" }, message: `生态清单 ${plugins.length} 款` };
}

async function opEventsPull(args: Args): Promise<Receipt> {
    const manifest = manifestJson as unknown as { plugins: Array<{ pluginId: string; maturity: string; events?: Array<{ name: string; status?: string }> }> };
    const whitelist = new Set<string>();
    const files: string[] = [];
    for (const p of manifest.plugins) {
        for (const e of p.events ?? []) {
            if (p.maturity === "stable" || e.status === "available") {
                whitelist.add(e.name);
                files.push(`/storage/petal/${p.pluginId}/bridge/events.ndjson`);
            }
        }
    }
    const sinceTs = typeof args.since === "string" ? Date.parse(args.since) : NaN;
    const names = Array.isArray(args.names) ? args.names.filter((x): x is string => typeof x === "string") : undefined;
    const limit = typeof args.limit === "number" ? Math.min(args.limit, 200) : 200;
    const events: unknown[] = [];
    for (const f of [...new Set(files)]) {
        const text = (await getFileText(f)) ?? "";
        if (!text.trim()) continue;
        for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
            if (events.length >= limit) break;
            const t = line.trim();
            if (!t) continue;
            try {
                const o = JSON.parse(t) as Record<string, unknown>;
                if (typeof o.name !== "string" || !whitelist.has(o.name)) continue;
                if (names && !names.includes(o.name)) continue;
                if (!Number.isNaN(sinceTs) && typeof o.emittedAt === "string" && Date.parse(o.emittedAt) <= sinceTs) continue;
                events.push(o);
            } catch { /* 坏行跳过 */ }
        }
    }
    return { id: "kernel", op: "events.pull", status: "recorded", data: { events, files: [...new Set(files)] }, message: `拉取 ${events.length} 条` };
}

async function opConfigDiscover(): Promise<Receipt> {
    const notes: string[] = [];
    let diaryNotebookId: string | null = null;
    try {
        const resp = await kpost<{ notebooks?: Array<{ id: string; name: string; closed: boolean }> } | Array<{ id: string; name: string; closed: boolean }>>("/api/notebook/lsNotebooks", {});
        const notebooks = Array.isArray(resp) ? resp : resp?.notebooks ?? [];
        for (const nb of notebooks) {
            if (nb.closed) continue;
            try {
                const conf = await kpost<{ conf?: Record<string, unknown> }>("/api/notebook/getNotebookConf", { notebook: nb.id });
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

async function opTemplateNew(args: Args): Promise<Receipt> {
    const notebook = typeof args.notebook === "string" ? args.notebook : "";
    const hpath = typeof args.hpath === "string" ? args.hpath : "";
    if (!notebook || !hpath) {
        return { id: "kernel", op: "template.new", status: "rejected", data: null, message: "notebook/hpath 缺失" };
    }
    let content = typeof args.template === "string" ? args.template : "";
    if (!content && typeof args.templatePath === "string") {
        content = (await getFileText(`/templates/${args.templatePath.replace(/^\/+/, "")}`)) ?? "";
    }
    if (!content) {
        return { id: "kernel", op: "template.new", status: "rejected", data: null, message: "template/templatePath 均为空" };
    }
    const renderedText = await kpost<string>("/api/template/renderSprig", { template: content });
    const docId = await kpost<string>("/api/filetree/createDocWithMd", { notebook, path: hpath, markdown: renderedText });
    return { id: "kernel", op: "template.new", status: "recorded", data: { docId }, message: "已从模板创建（内核同步通道）" };
}

function opDiagnostics(): Receipt {
    return {
        id: "kernel", op: "diagnostics.report", status: "recorded",
        data: {
            protocol: 1, plugin: PLUGIN_NAME, channel: "kernel-sync",
            kernelRoute: true,
            note: "内核侧精简诊断；桥/队列细节见 NDJSON 通道 diagnostics.report",
        },
        message: "内核诊断（脱敏）",
    };
}

/* ---------- op 路由 ---------- */

const FRONTEND_ONLY = new Set([
    "commands.list", "commands.search", "commands.run",
    "checkin.items", "checkin.record", "checkin.summary",
    "contacts.search", "contacts.ensure", "contacts.interaction",
    "doc.open", "setting.open", "editor.context", "plugin.api",
]);

async function handleOp(op: string, args: Args): Promise<Receipt> {
    switch (op) {
        case "bridge.ping": return opPing();
        case "registry.list": return await opRegistryList();
        case "events.pull": return await opEventsPull(args);
        case "config.discover": return await opConfigDiscover();
        case "template.new": return await opTemplateNew(args);
        case "diagnostics.report": return opDiagnostics();
        default:
            if (FRONTEND_ONLY.has(op)) {
                return {
                    id: "kernel", op, status: "unsupported", data: null,
                    message: "该 op 需要前端在线：请走 NDJSON 通道（或等待 v2 前端中继）",
                };
            }
            return { id: "kernel", op, status: "unsupported", data: null, message: `未知 op：${op}` };
    }
}

/* ---------- 生命周期与私有路由 ---------- */

api.plugin.lifecycle.onload = async () => {
    await api.logger.info(`[${PLUGIN_NAME}] kernel sync route loading (experimental v2)`);
    api.server.private.http.handler = async (req) => {
        try {
            if (req.context.path !== "/exec") {
                return { statusCode: 404, body: { data: { type: "JSON", data: { code: -1, msg: "not found" } } } };
            }
            let body: { op?: string; args?: Args } = {};
            try {
                const data = req.request.body.data;
                let parsed: unknown = undefined;
                if (data) {
                    parsed = typeof (data as { json?: () => unknown }).json === "function"
                        ? await (data as { json: () => Promise<unknown> }).json()
                        : JSON.parse(await (data as { text: () => Promise<string> }).text());
                }
                body = (parsed ?? {}) as { op?: string; args?: Args };
            } catch {
                body = {};
            }
            if (typeof body.op !== "string" || !body.op) {
                return { statusCode: 400, body: { data: { type: "JSON", data: { code: -1, msg: "op 缺失" } } } };
            }
            const receipt = await handleOp(body.op, (body.args ?? {}) as Args);
            return { statusCode: 200, body: { data: { type: "JSON", data: { code: 0, msg: "", data: receipt } } } };
        } catch (e) {
            return {
                statusCode: 500,
                body: { data: { type: "JSON", data: { code: -1, msg: e instanceof Error ? e.message : String(e) } } },
            };
        }
    };
};
