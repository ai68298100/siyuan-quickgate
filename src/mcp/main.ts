/**
 * MCP stdio 入口：LV_MCP_WRITE=1 开写工具；SIYUAN_URL/SIYUAN_TOKEN 从 env（对齐其他客户端）。
 * 运行（Node ≥24 原生 TS 类型剥离；显式 .ts 扩展导入）：
 *   SIYUAN_TOKEN=<token> node src/mcp/main.ts
 * Claude Desktop 配置示例：
 *   { "mcpServers": { "lv-quickgate": { "command": "node",
 *     "args": ["D:/AI/Codex/siyuan-quickgate/src/mcp/main.ts"], "env": { "SIYUAN_TOKEN": "…" } } } }
 * 注意：版本号读 package.json（不 import ../index——那会拉起思源 SDK 与 CSS，无法在裸 Node 运行）。
 */
import { readFileSync } from "node:fs";
import { createMcpServer } from "./server.ts";
import { KernelBridgeClient } from "./bridge-client.ts";

// bundle 态：dist-mcp/ 自带 package.json（build:mcp 生成）；源态：读仓库根 package.json
const version = (() => {
    for (const u of ["../../package.json", "./package.json"]) {
        try {
            return (JSON.parse(readFileSync(new URL(u, import.meta.url), "utf8")) as { version: string }).version;
        } catch { /* 试下一个路径 */ }
    }
    return "0.0.0";
})();

const url = (process.env.SIYUAN_URL || "http://127.0.0.1:6806").replace(/\/$/, "");
const token = process.env.SIYUAN_TOKEN || "";
if (!token) {
    console.error("错误：请设置 SIYUAN_TOKEN 环境变量（思源 设置→关于→API 令牌）");
    process.exit(1);
}
const writeEnabled = process.env.LV_MCP_WRITE === "1";

const client = new KernelBridgeClient({ url, token });
const server = createMcpServer(client, { writeEnabled, version });

const decoder = new TextDecoder();
let buffer = "";
process.stdin.on("data", (chunk: Buffer) => {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        void (async () => {
            let req: Parameters<typeof server.handleRequest>[0];
            try {
                req = JSON.parse(line);
            } catch {
                process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "不是合法 JSON" } }) + "\n");
                return;
            }
            try {
                const resp = await server.handleRequest(req);
                if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
            } catch (e) {
                const id = (req as { id?: unknown }).id ?? null;
                process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }) + "\n");
            }
        })();
    }
});
process.stdin.resume();
