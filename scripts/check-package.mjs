#!/usr/bin/env node
/**
 * package.zip 解包静态断言（TODO L446 · R261 · bug#9 回归门）
 *
 * 背景：v0.7.0 曾因 plugin.json 缺 `kernels` 字段导致内核插件全用户失效（bug#9）——
 * 构建与打包均绿，只有装上才知道。本脚本在发布链内做三道断言：
 *   1. dist/plugin.json 有 `kernels` 字段且含 "all" 或内核标识（bug#9 直接回归）
 *   2. dist/kernel.js / dist/index.js 存在且非空
 *   3. package.zip 内部真实打包了 plugin.json（含 kernels）与 kernel.js（解包级，防 vite 静默漏拷）
 * 用法：node scripts/check-package.mjs [distDir]（默认 dist）；退出码 0=过 1=失败
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const dist = resolveDist(process.argv[2] ?? "dist");
function resolveDist(d) {
    const abs = path.resolve(d);
    if (!fs.existsSync(abs)) { console.error(`✗ ${abs} 不存在（先 build）`); process.exit(1); }
    return abs;
}

const failures = [];
const fail = (msg) => failures.push(msg);

// ---- 1. dist/plugin.json kernels 字段（bug#9 直接回归）----
let kernels = null;
try {
    const pj = JSON.parse(fs.readFileSync(path.join(dist, "plugin.json"), "utf8"));
    kernels = pj.kernels ?? null;
    if (!Array.isArray(kernels) || kernels.length === 0) {
        fail(`dist/plugin.json 缺 kernels 字段或为空数组——内核将不加载 kernel.js（bug#9 复发）`);
    } else if (!kernels.includes("all")) {
        console.warn(`⚠ kernels=[${kernels.join(",")}] 不含 "all"——确认目标内核版本在列`);
    }
} catch (e) {
    fail(`dist/plugin.json 不可解析：${e.message}`);
}

// ---- 2. 双 js 存在且非空 ----
for (const js of ["kernel.js", "index.js"]) {
    try {
        const size = fs.statSync(path.join(dist, js)).size;
        if (size < 1000) fail(`dist/${js} 过小（${size}B）——疑似空/截断`);
    } catch {
        fail(`dist/${js} 缺失`);
    }
}

// ---- 3. zip 解包级断言（PowerShell 落盘 .ps1 执行，规避引号地狱；Windows 目标环境）----
const zipPath = path.join(root, "package.zip");
if (!fs.existsSync(zipPath)) {
    fail("package.zip 不存在（build 应产出）");
} else {
    try {
        const os = await import("node:os");
        const psList = path.join(os.tmpdir(), "qg-zip-list.ps1");
        fs.writeFileSync(psList, `
param([string]$zip)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }
`);
        const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psList}" "${zipPath}"`, { encoding: "utf8" });
        const entries = new Set(out.split(/\r?\n/).filter(Boolean));
        for (const n of ["plugin.json", "kernel.js", "index.js"]) {
            if (![...entries].some((e) => e === n || e.endsWith("/" + n))) fail(`package.zip 缺 ${n}（打包静默漏拷——if-no-files-found 类事故）`);
        }
        // zip 内 plugin.json 的 kernels 字段（解包级内容断言）
        const psRead = path.join(os.tmpdir(), "qg-zip-read.ps1");
        fs.writeFileSync(psRead, `
param([string]$zip, [string]$entryName)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $e = $z.Entries | Where-Object { $_.FullName -eq $entryName }
  if ($e) { $r = New-Object System.IO.StreamReader($e.Open()); $r.ReadToEnd() }
} finally { $z.Dispose() }
`);
        const pjText = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psRead}" "${zipPath}" "plugin.json"`, { encoding: "utf8" });
        const pj = JSON.parse(pjText);
        if (!Array.isArray(pj.kernels) || pj.kernels.length === 0) fail(`package.zip 内 plugin.json 缺 kernels 字段（zip 与 dist 不同源？）`);
    } catch (e) {
        fail(`zip 解包断言异常：${String(e.message).slice(0, 160)}`);
    }
}

if (failures.length > 0) {
    console.error(`✗ package 断言失败：`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}
console.log(`✅ package 断言通过（kernels ✓ / 双 js ✓ / zip 内含 plugin.json+kernel.js+index.js ✓）`);
