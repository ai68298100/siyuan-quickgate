/**
 * 内核 HTTP 桥客户端（MCP 代理专用）：与 tools/lv-cli.mjs 同构，消费的端点全部已在真机实证
 * （getFile/putFile R21、postMessage spike⑤/R35）。send→NDJSON 慢路径，sendFast→广播快路径。
 */
const PLUGIN = "siyuan-quickgate";

/**
 * 共享回执监视器（L555）：N 个并发 tools/call 只共享**一个** results.ndjson 读取循环，
 * 按 id 分发解析结果——替代 v1 每调用各自 300ms 轮询（并发下内核getFile chatter 随调用数放大）。
 * 全部等待者消失即停表；新订阅即时起表（保持 v1"先读一次再睡"的时延语义）。
 */
export class ReceiptHub {
    // 注意：MCP 源码态经 node --experimental-strip-types 运行（不支持参数属性），字段须显式声明
    private readLines: () => Promise<string[]>;
    private intervalMs: number;
    private waiters = new Map<string, Array<{ resolve: (r: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> }>>();
    private timer?: ReturnType<typeof setInterval>;
    private ticking = false;

    constructor(readLines: () => Promise<string[]>, intervalMs = 250) {
        this.readLines = readLines;
        this.intervalMs = intervalMs;
    }

    /** 等待指定 id 的回执；超时返回 timeout 形状（与 v1 契约一致） */
    wait(id: string, maxMs: number, op?: string): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.remove(id);
                resolve({ id, op, status: "timeout", message: `等待 ${maxMs}ms 未收到回执` });
            }, maxMs);
            this.push(id, { resolve, timer });
            this.ensureLoop();
        });
    }

    /** 当前等待者数（观测用） */
    get size() { return this.waiters.size; }

    private push(id: string, w: { resolve: (r: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> }) {
        const list = this.waiters.get(id) ?? [];
        list.push(w);
        this.waiters.set(id, list);
    }

    private remove(id: string) {
        const list = this.waiters.get(id);
        if (!list) return;
        for (const w of list) clearTimeout(w.timer);
        this.waiters.delete(id);
    }

    private ensureLoop() {
        if (this.timer) return;
        this.timer = setInterval(() => void this.tick(), this.intervalMs);
        void this.tick();
    }

    private stopLoop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }

    private async tick() {
        if (this.ticking || this.waiters.size === 0) {
            if (this.waiters.size === 0) this.stopLoop();
            return;
        }
        this.ticking = true;
        try {
            const lines = await this.readLines();
            for (const line of lines) {
                const t = line.trim();
                if (!t) continue;
                let o: Record<string, unknown>;
                try { o = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
                const id = String(o.id ?? "");
                const list = this.waiters.get(id);
                if (!list) continue;
                this.waiters.delete(id);
                for (const w of list) {
                    clearTimeout(w.timer);
                    w.resolve(o);
                }
            }
        } catch { /* 读取失败下一轮重试 */ } finally {
            this.ticking = false;
            if (this.waiters.size === 0) this.stopLoop();
        }
    }
}

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
    /** L553 观测指标：通道用量与回退/超时计数（诊断与测试用） */
    readonly metrics = { sent: 0, sentFast: 0, fastHits: 0, fallbackResends: 0, timeouts: 0 };
    private hub: ReceiptHub;

    constructor(opts: McpBridgeClientOptions) {
        this.url = opts.url.replace(/\/$/, "");
        this.token = opts.token;
        this.plugin = opts.plugin ?? PLUGIN;
        this.maxWaitMs = opts.maxWaitMs ?? 15000;
        const resultsPath = `/storage/petal/${this.plugin}/bridge/results.ndjson`;
        this.hub = new ReceiptHub(async () => (await this.getText(resultsPath)).replace(/\r/g, "").split("\n"));
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
        this.metrics.sent += 1;
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
        this.metrics.sentFast += 1;
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

    /** 等回执（L555）：经共享监视器分发，多调用共享单一 results.ndjson 读取循环 */
    async waitReceipt(id: string, maxMs = this.maxWaitMs, op?: string): Promise<Record<string, unknown>> {
        const r = await this.hub.wait(id, maxMs, op);
        if ((r as { status?: string }).status === "timeout") this.metrics.timeouts += 1;
        return r;
    }
}
