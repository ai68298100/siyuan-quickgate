#!/usr/bin/env node
/**
 * 工具 schema 导出器（v0.9.1 · AI 客户端矩阵路径 C）：
 * 从 src/mcp/tools.ts 单一来源导出两种形态的工具清单，供不支持 MCP 的 Agent
 * （千问办公/豆包办公/WorkBuddy/DeepSeek dsh 等的「自定义工具/插件」面）一键导入：
 *   1. function-calling JSON —— OpenAI tools 数组形状（国内各家 function-call 实现普遍兼容）
 *   2. OpenAPI 3.1 —— 每个 op 一个 POST 操作，配合内核 HTTP 路由 /plugin/private/siyuan-quickgate/exec
 * 用法：node tools/export-toolschema.mjs [--out <dir>] [--write]（--write 把写工具也导出，默认只导只读面）
 * 事实来源与 MCP tools/list 完全一致（buildToolDefs），契约漂移由 tests/contract-consistency 强制。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildToolDefs } from "../src/mcp/tools.ts";
import { KERNEL_OPS } from "../src/ops.ts";

const argv = process.argv.slice(2);
function argOf(flag) {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
}
const has = (flag) => argv.includes(flag);
const outDir = resolve(argOf("--out") ?? "dist/toolschema");
const writeEnabled = has("--write");

const defs = buildToolDefs().filter((d) => writeEnabled || !d.write);
const version = (await import("../package.json", { with: { type: "json" } })).default.version;

/* 1) function-calling（OpenAI tools 形状；注解放 x-quickgate 扩展键，宿主忽略不报错） */
const functionCalling = defs.map((d) => ({
    type: "function",
    function: {
        name: d.name,
        description: d.description,
        parameters: {
            type: "object",
            properties: d.inputSchema.properties,
            ...(d.inputSchema.required ? { required: d.inputSchema.required } : {}),
        },
        "x-quickgate": {
            write: d.annotations.readOnlyHint === false,
            destructive: d.annotations.destructiveHint,
            idempotent: d.annotations.idempotentHint,
        },
    },
}));

/* 2) OpenAPI 3.1：单端点 exec，按 op 划分 operation；内核路由子集标注 availableOnKernel */
const kernelOps = new Set(KERNEL_OPS);
const SY_URL = "http://127.0.0.1:6806";
const openapi = {
    openapi: "3.1.0",
    info: {
        title: "Lv QuickGate (小驴快门) ops",
        version,
        description:
            "小驴快门 35 op 公开契约的 OpenAPI 投影。调用方式：POST {SIYUAN_URL}/plugin/private/siyuan-quickgate/exec，" +
            "头 Authorization: Token <思源API令牌>，体 {op, args}。仅标注 availableOnKernel=true 的 op 可走该端点；" +
            "其余 op 为前端专属，需经 NDJSON 桥（见 docs/api.md）。写 op 默认需确认门控/桥开关，详见安全模型。",
    },
    servers: [{ url: SY_URL }],
    "x-quickgate": { kernelRoute: "/plugin/private/siyuan-quickgate/exec", envelope: "POST body {op, args}" },
    paths: Object.fromEntries(
        defs.map((d) => [
            `/${d.name}`,
            {
                post: {
                    operationId: d.name,
                    summary: d.description,
                    description: `快门 op：${d.name}。请求体 {"op":"${d.name}","args":{…}}；响应 data.data 为回执（status ∈ recorded|duplicate|rejected|failed|unsupported|expired）。` +
                        (kernelOps.has(d.name) ? "（availableOnKernel=true）" : "（前端专属：内核路由回 unsupported，需 NDJSON 桥）"),
                    "x-quickgate": { op: d.name, availableOnKernel: kernelOps.has(d.name), ...d.annotations },
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        op: { const: d.name },
                                        args: {
                                            type: "object",
                                            properties: d.inputSchema.properties,
                                            ...(d.inputSchema.required ? { required: d.inputSchema.required } : {}),
                                        },
                                    },
                                    required: ["op"],
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "回执信封（data.data.status 语义见 docs/api.md）" },
                        401: { description: "缺少/错误 Token" },
                    },
                },
            },
        ])
    ),
};

await mkdir(outDir, { recursive: true });
const fcPath = resolve(outDir, `quickgate-tools${writeEnabled ? "-rw" : "-readonly"}.function-calling.json`);
const oaPath = resolve(outDir, `quickgate-tools${writeEnabled ? "-rw" : "-readonly"}.openapi3.json`);
await writeFile(fcPath, JSON.stringify(functionCalling, null, 2) + "\n", "utf8");
await writeFile(oaPath, JSON.stringify(openapi, null, 2) + "\n", "utf8");
console.log(`✓ 导出 ${defs.length} 个工具（writeEnabled=${writeEnabled}）→`);
console.log(`  ${fcPath}`);
console.log(`  ${oaPath}`);
console.log("提示：写工具默认不导出；--write 显式放开（安全门控仍在快门侧：确认框/审计/桥开关）。");
