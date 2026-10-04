/**
 * 内核 HTTP 桥客户端（MCP 代理专用）：与 tools/lv-cli.mjs 同构，消费的端点全部已在真机实证
 * （getFile/putFile R21、postMessage spike⑤/R35）。send→NDJSON 慢路径，sendFast→广播快路径。
 */
const PLUGIN = "siyuan-quickgate";

export interface McpBridgeClientOptions {
    url: string;
    token: string;
    plugin?: string;
    /** 默认 15000ms（commands.run 类确认窗口可传更长） */
    maxWaitMs?: number;
}

export class KernelBridgeClient {
    private readonly url: string;
    private readonly token: string;
    private readonly plugin: string;
    readonly maxWaitMs: number;

    constructor(opts: McpBridgeClientOptions) {
        this.url = opts.url.replace(/\/$/, "");
        this.token = opts.token;
        this.plugin = opts.plugin ?? PLUGIN;
        this.maxWaitMs = opts.maxWaitMs ?? 15000;
    }

    genId(): string {
        // id 承载幂等语义（processed 台账按键去重）——用 crypto UUID 段，杜绝同毫秒碰撞
        const d = new Date();
        const p = (n: number, l = 2) => String(n).padStart(l, "0");
        return `mcp-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${crypto.randomUUID().slice(0, 8)}`;
    }

    private async kernelPost(endpoint: string, payload: unknown): Promise<unknown> {
        const res = await fetch(`${this.url}${endpoint}`, {
            method: "POST",
            headers: { Authorization: `Token ${this.token}` },
            body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { code?: number; msg?: string; data?: unknown };
        if (json.code !== 0) throw new Error(json.msg || `code=${json.code}`);
        return json.data;
    }

    private async getText(path: string): Promise<string> {
        const res = await fetch(`${this.url}/api/file/getFile`, {
            method: "POST",
            headers: { Authorization: `Token ${this.token}` },
            body: JSON.stringify({ path }),
        });
        if (!res.ok) return "";
        return await res.text();
    }

    private async putText(path: string, text: string): Promise<void> {
        const form = new FormData();
        form.append("path", path);
        form.append("isDir", "false");
        form.append("file", new Blob([text], { type: "application/octet-stream" }), "file");
        const res = await fetch(`${this.url}/api/file/putFile`, {
            method: "POST",
            headers: { Authorization: `Token ${this.token}` },
            body: form,
        });
        if (!res.ok) throw new Error(`putFile HTTP ${res.status}`);
    }

    /** NDJSON 慢路径：追加信封到 commands.ndjson，返回命令 id */
    async send(op: string, args: Record<string, unknown>): Promise<string> {
        const id = this.genId();
        const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() });
        const path = `/storage/petal/${this.plugin}/bridge/commands.ndjson`;
        // L453：多生产者 read-modify-write 并发会互相覆盖（实测 4 写者丢 66/100）——
        // 写后读回校验本行仍在，丢失则基于最新内容重试 ≤5 次（残窗=最后一次写竞态）
        for (let attempt = 0; attempt < 5; attempt++) {
            const old = (await this.getText(path)).replace(/\n+$/, "");
            await this.putText(path, (old ? old + "\n" : "") + envelope);
            const back = await this.getText(path);
            if (back.includes(`"id":"${id}"`)) return id;
            await new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 120)));
        }
        throw new Error("追加重试 5 次仍未持久化（多写者竞争过于激烈）");
    }

    /** 广播快路径：postMessage 推信封（毫秒级；回执仍走 results.ndjson） */
    async sendFast(op: string, args: Record<string, unknown>, channel = "qg-cmd"): Promise<string> {
        const id = this.genId();
        const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() });
        await this.kernelPost("/api/broadcast/postMessage", { channel, message: envelope });
        return id;
    }

    /**
     * 内核同步路由直呼（KERNEL_OPS 专属，~100ms）：同步返回回执对象。
     * 价值：kernel.js 随 petal 启用即加载，桥开关默认关时这 7 个 op 也可用。
     * 路由未放行/插件缺席时抛错（调用方回退 NDJSON 慢路径）。
     * 注：Mimosa 扫描器曾将本方法（HTTP URL 模板串+同步语义）误判为命令注入——
     * 实为 fetch 到内核 HTTP 私有路由，无 shell 参与；url/plugin 均来自配置常量。
     */
    async callKernelRoute(op: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
        const routeUrl = `${this.url}/plugin/private/${this.plugin}/exec`;
        const res = await fetch(routeUrl, {
            method: "POST",
            headers: { Authorization: `Token ${this.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ op, args }),
        });
        if (!res.ok) throw new Error(`内核路由 HTTP ${res.status}`);
        const json = (await res.json()) as { code?: number; msg?: string; data?: unknown };
        if (json.code !== 0) throw new Error(json.msg || `code=${json.code}`);
        return (json.data ?? {}) as Record<string, unknown>;
    }

    /** 轮询 results.ndjson 等回执 */
    async waitReceipt(id: string, maxMs = this.maxWaitMs, op?: string): Promise<Record<string, unknown>> {
        const path = `/storage/petal/${this.plugin}/bridge/results.ndjson`;
        const deadline = Date.now() + maxMs;
        while (Date.now() < deadline) {
            const text = await this.getText(path);
            for (const line of text.split("\n")) {
                const t = line.trim();
                if (!t) continue;
                try {
                    const o = JSON.parse(t) as Record<string, unknown>;
                    if (o.id === id) return o;
                } catch { /* 跳过坏行 */ }
            }
            await new Promise((r) => setTimeout(r, 300));
        }
        return { id, op, status: "timeout", message: `等待 ${maxMs}ms 未收到回执` };
    }
}
