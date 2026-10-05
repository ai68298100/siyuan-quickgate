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
 * op 逻辑在 src/kernel-ops.ts（依赖注入，可单测）；本文件只做 goja 运行时接线。
 * 运行时：内核 goja——无 DOM/Node；网络经 siyuan.client.fetch；持久化经 siyuan.storage。
 * 校准依赖：spike⑤⑥⑧（真机）——本路由未依赖其结论，字段不符时相关 op 返回 failed 而非崩溃。
 */
import type * as kernel from "siyuan/kernel";
import manifestJson from "./assets/ecosystem-manifests.json";
import { createKernelOpHandler, kernelAgentCapture, kernelAgentDiscover, kernelPing } from "./kernel-ops";
import type { EcosystemManifest } from "./services/bridge-service";

const api: kernel.ISiyuan = siyuan;

const PLUGIN_NAME = "siyuan-quickgate";

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

/* ---------- 生命周期与私有路由 ---------- */

api.plugin.lifecycle.onload = async () => {
    // 已知外观问题（bug#17 候选 · 日志 62+ 条 error）：内核 plugin.go:884 调用 onrunning/onunload 可选钩子时
    // 报「not bound」——内核读取的 lifecycle 路径与本 bundle 设置的 siyuan.plugin.lifecycle 不同（goja 上下文差异）。
    // R245 noop 修复无效已回退；功能零影响（桥/路由/Agent 全部正常）。需 goja 插件机制 DevTools 才能根治。
    await api.logger.info(`[${PLUGIN_NAME}] kernel sync route loading (experimental v2)`);
    const agentDeps = {
        kpost,
        getFileText,
        manifest: manifestJson as EcosystemManifest,
        pluginName: PLUGIN_NAME,
    };
    const handleOp = createKernelOpHandler(agentDeps);

    // —— 内置 Agent 能力注册（R245 · 上游 v3.8.6 kernel/plugin/api_agent.go：siyuan.agent.registerCapability）——
    // 模型可见名 plugin__siyuan-quickgate__<name>；老内核无 siyuan.agent 则跳过（不影响其他功能）。
    // effects 如实声明（ToolEffects 四标志）；安全由 Agent 侧授权/审批 + 快门处理器内校验共同承担。
    try {
        const agent = (api as unknown as { agent?: { registerCapability?: (name: string, config: unknown, handler: (args: Record<string, unknown>) => Promise<unknown>) => Promise<unknown> } }).agent;
        if (agent?.registerCapability) {
            const wrap = (r: { text: string; data?: unknown; isError?: boolean }) =>
                ({ content: [{ type: "text", text: r.text }], structuredContent: r.data, isError: r.isError === true });
            // 火后即忘（R257 教训）：无头内核里注册 Promise 可能永不落定，await 会阻塞内核启动序列
            const registered: string[] = [];
            const reg = (name: string, config: unknown, handler: (args: Record<string, unknown>) => Promise<unknown>) =>
                agent.registerCapability(name, config, handler)
                    .then(() => { registered.push(name); })
                    .catch((e: unknown) => console.warn(`[${PLUGIN_NAME}] Agent 能力 ${name} 注册失败：${e instanceof Error ? e.message : String(e)}`));
            void reg("quickgate_ping", {
                title: "QuickGate Ping",
                description: "快门健康探针（内核同步通道连通性）",
                inputSchema: { type: "object", properties: {} },
                effects: { localRead: true },
            }, async () => {
                const r = await kernelPing(agentDeps);
                return { content: [{ type: "text", text: r.message }], structuredContent: r.data };
            });
            void reg("quickgate_discover", {
                title: "QuickGate 生态发现",
                description: "发现日记笔记本与收集箱文档（只读；createInboxIfMissing=true 授权自动创建收集箱）",
                inputSchema: {
                    type: "object",
                    properties: {
                        createInboxIfMissing: { type: "boolean", description: "收集箱不存在时授权自动创建" },
                        inboxName: { type: "string", description: "自定义约定名（默认 收集箱/Inbox）" },
                    },
                },
                effects: { localRead: true, localWrite: false },
            }, async (args) => wrap(await kernelAgentDiscover(agentDeps, args ?? {})));
            void reg("quickgate_capture", {
                title: "QuickGate 快速捕获",
                description: "把一句话追加到今日日记（- HH:mm 格式；要求某笔记本配置了日记保存路径）",
                inputSchema: {
                    type: "object",
                    properties: { text: { type: "string", description: "要记的一句话" } },
                    required: ["text"],
                },
                effects: { localWrite: true },
            }, async (args) => wrap(await kernelAgentCapture(agentDeps, args ?? {})));
            setTimeout(() => {
                void api.logger.info(`[${PLUGIN_NAME}] 内置 Agent 能力注册完成：${registered.length}/3（${registered.join(", ") || "无"}）`);
            }, 5000);
        } else {
            await api.logger.info(`[${PLUGIN_NAME}] 内核无 siyuan.agent API——跳过 Agent 能力注册`);
        }
    } catch (e) {
        await api.logger.warn(`[${PLUGIN_NAME}] Agent 能力注册失败（不影响其他功能）：${e instanceof Error ? e.message : String(e)}`);
    }
    api.server.private.http.handler = async (req) => {
        try {
            if (req.context.path !== "/exec") {
                return { statusCode: 404, body: { data: { type: "JSON", data: { code: -1, msg: "not found" } } } };
            }
            let body: { op?: string; args?: Record<string, unknown> } = {};
            try {
                const data = req.request.body.data;
                let parsed: unknown = undefined;
                if (data) {
                    parsed = typeof (data as { json?: () => unknown }).json === "function"
                        ? await (data as { json: () => Promise<unknown> }).json()
                        : JSON.parse(await (data as { text: () => Promise<string> }).text());
                }
                body = (parsed ?? {}) as { op?: string; args?: Record<string, unknown> };
            } catch {
                body = {};
            }
            if (typeof body.op !== "string" || !body.op) {
                return { statusCode: 400, body: { data: { type: "JSON", data: { code: -1, msg: "op 缺失" } } } };
            }
            const receipt = await handleOp(body.op, (body.args ?? {}) as Record<string, unknown>);
            return { statusCode: 200, body: { data: { type: "JSON", data: { code: 0, msg: "", data: receipt } } } };
        } catch (e) {
            return {
                statusCode: 500,
                body: { data: { type: "JSON", data: { code: -1, msg: e instanceof Error ? e.message : String(e) } } },
            };
        }
    };
};
