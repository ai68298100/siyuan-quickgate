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
        const d = new Date();
        const p = (n: number, l = 2) => String(n).padStart(l, "0");
        const rand = Math.random().toString(16).slice(2, 6);
        return `mcp-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${rand}`;
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
        const old = (await this.getText(path)).replace(/\n+$/, "");
        await this.putText(path, old + "\n" + envelope);
        return id;
    }

    /** 广播快路径：postMessage 推信封（毫秒级；回执仍走 results.ndjson） */
    async sendFast(op: string, args: Record<string, unknown>, channel = "qg-cmd"): Promise<string> {
        const id = this.genId();
        const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() });
        await this.kernelPost("/api/broadcast/postMessage", { channel, message: envelope });
        return id;
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
