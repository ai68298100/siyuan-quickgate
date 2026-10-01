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
import { createKernelOpHandler } from "./kernel-ops";
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
    await api.logger.info(`[${PLUGIN_NAME}] kernel sync route loading (experimental v2)`);
    const handleOp = createKernelOpHandler({
        kpost,
        getFileText,
        manifest: manifestJson as unknown as EcosystemManifest,
        pluginName: PLUGIN_NAME,
    });
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
