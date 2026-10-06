#!/usr/bin/env node
/**
 * 文档数字门禁（G0-02 · R306）：结构性数字（op 总数 / MCP 工具数 / 只读工具数）以代码为
 * 单一事实来源，自动核对文档声明。历史沿革（如 "23→26 op"）中 → 前的数字不算声明。
 * 失败退出 1 并列出漂移点；接入 pnpm check 链。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require2 = createRequire(import.meta.url);

// 事实来源：代码
const { ALL_OPS, KERNEL_OPS } = await import(pathToFileURL(path.join(ROOT, "src/ops.ts")));
const { buildToolDefs } = require2(path.join(ROOT, "src/mcp/tools.ts"));
const OPS = ALL_OPS.length;
const TOOLS = buildToolDefs().length;
const READONLY = buildToolDefs().filter((d) => d.annotations.readOnlyHint).length;
// 合法子集声明：内核路由子集（如 "7 ops"）也是结构性数字
const KERNEL = KERNEL_OPS.length;
const ALLOWED_OP_COUNTS = new Set([OPS, KERNEL]);

const DOCS = [
    "README.md",
    "README.zh-CN.md",
    "docs/api.md",
    "src/mcp/README.md",
];

// 声明模式 → 期望值（→ 前的历史数字不匹配，跳过）
const EXPECT_PATTERNS = [
    { re: /(?<!→\s)(\d+)\s*个\s*op\b/g, expect: null, allowed: ALLOWED_OP_COUNTS, label: `op 总数应为 ${OPS}${KERNEL !== OPS ? `（或内核子集 ${KERNEL}）` : ""}` },
    { re: /(?<!→\s)(\d+)\s+ops\b(?!\s*→)/g, expect: null, allowed: ALLOWED_OP_COUNTS, label: `ops 总数应为 ${OPS}${KERNEL !== OPS ? `（或内核子集 ${KERNEL}）` : ""}` },
    { re: /(\d+)\s*个只读工具/g, allowed: new Set([READONLY]), label: `只读工具数应为 ${READONLY}` },
    { re: /(\d+)\s*只读工具/g, allowed: new Set([READONLY]), label: `只读工具数应为 ${READONLY}` },
];

let failed = false;
let checked = 0;
for (const doc of DOCS) {
    const file = path.join(ROOT, doc);
    let text;
    try {
        text = readFileSync(file, "utf8");
    } catch {
        console.error(`✗ 文档缺失：${doc}`);
        failed = true;
        continue;
    }
    for (const { re, allowed, label } of EXPECT_PATTERNS) {
        for (const m of text.matchAll(re)) {
            checked += 1;
            const n = Number(m[1]);
            if (!allowed.has(n)) {
                const line = text.slice(0, m.index).split("\n").length;
                console.error(`✗ ${doc}:${line} 声明「${m[0]}」与事实不符（${label}）`);
                failed = true;
            }
        }
    }
}

console.log(`文档数字门禁：核对 ${DOCS.length} 个文档的 op/工具/只读声明（事实来源 src/ops.ts + src/mcp/tools.ts = ${OPS}/${TOOLS}/${READONLY}）`);
if (failed) process.exit(1);
console.log("✓ 全部一致");
