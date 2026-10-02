#!/usr/bin/env node
/**
 * build:mcp —— 打包 MCP stdio 服务器为独立可分发目录 dist-mcp/
 * 产物：mcp-quickgate.js（esbuild 单文件 bundle，零依赖）+ package.json（name/bin/engines）
 * 运行验证：SMOKE_TARGET=dist-mcp/mcp-quickgate.js node tools/mcp-smoke.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const out = `${root}/dist-mcp`;
const rootPkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));

// 定位 esbuild（pnpm 布局：node_modules/.pnpm/esbuild@x/node_modules/esbuild/lib/main.js）
async function findEsbuild() {
    const pnpm = `${root}/node_modules/.pnpm`;
    let names;
    try { names = readdirSync(pnpm); } catch { throw new Error("node_modules/.pnpm 不存在——先 pnpm install"); }
    for (const dir of names) {
        if (dir.startsWith("esbuild@")) {
            const p = `${pnpm}/${dir}/node_modules/esbuild/lib/main.js`;
            try { readdirSync(`${pnpm}/${dir}/node_modules/esbuild/lib`); return p; } catch { /* 试下一个 */ }
        }
    }
    throw new Error("找不到 esbuild（node_modules/.pnpm/esbuild@*/lib/main.js）");
}

mkdirSync(out, { recursive: true });
const esbuild = await import(pathToFileURL(await findEsbuild()).href);
await esbuild.build({
    entryPoints: ["src/mcp/main.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: "dist-mcp/mcp-quickgate.js",
    define: { MCP_BUNDLE_VERSION: JSON.stringify(rootPkg.version) },
    logLevel: "error",
});

// dist-mcp 自带 package.json（bundle 内 version 读取 ./package.json 即此文件）
writeFileSync(`${out}/package.json`, JSON.stringify({
    name: "mcp-quickgate",
    displayName: "Lv QuickGate MCP",
    version: rootPkg.version,
    description: "MCP stdio server exposing the Lv QuickGate 23-op contract to AI assistants (13 read-only by default)",
    type: "module",
    main: "mcp-quickgate.js",
    bin: { "mcp-quickgate": "mcp-quickgate.js" },
    engines: { node: ">=24" },
    license: "MIT",
}, null, 2) + "\n");

console.log(`dist-mcp/ 打包完成（v${rootPkg.version}）：mcp-quickgate.js + package.json`);
console.log(`运行验证：SMOKE_TARGET=dist-mcp/mcp-quickgate.js node tools/mcp-smoke.mjs`);
