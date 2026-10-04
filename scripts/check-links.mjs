#!/usr/bin/env node
/**
 * 发布包链接检查门（TODO L624 · R78-P1）——扫描待发布目录内全部 Markdown：
 *   1. 相对链接必须落到包内真实文件（含相对目录/JSON 引用）
 *   2. 禁止工作区绝对路径（盘符路径出现在链接或正文中）
 *   3. 禁止指向源码仓库专属路径的相对链接（src/ tools/ tests/ e2e/ scripts/）——
 *      发布包消费者没有源码树，此类目标必须改 GitHub permalink 或包内文件
 * 用法：node scripts/check-links.mjs [dir]（默认 dist）· 退出码 0=通过 1=有违规
 * CI：挂在 check:release 之后（构建产物即扫描对象）。
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, posix, resolve, sep } from "node:path";

const root = resolve(process.cwd(), process.argv[2] ?? "dist");
const SOURCE_ONLY = new Set(["src", "tools", "tests", "e2e", "scripts"]);
// 盘符路径：前面不能是字母/数字/./+/-（排除 https:// 的 "s://"）
const DRIVE_PATH = /(?<![A-Za-z0-9+.-])[A-Za-z]:[\\/][^\s`)\]"']*/;

const violations = [];
let links = 0;

async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) await walk(p);
        else if (entry.name.toLowerCase().endsWith(".md")) files.push(p);
    }
}
const files = [];
await walk(root);

for (const file of files) {
    const rel = file.slice(root.length + 1);
    const text = await readFile(file, "utf8");

    // 正文/链接中的盘符绝对路径（工作区路径泄露）
    for (const m of text.matchAll(new RegExp(DRIVE_PATH, "g"))) {
        violations.push(`${rel}: 疑似绝对路径泄露 → ${m[0].slice(0, 80)}`);
    }

    // Markdown 链接 + 行内图片
    const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)|(?:img|script)[^\s>]*src="([^"]+)"/g;
    for (const m of text.matchAll(linkRe)) {
        const raw = m[1] ?? m[2];
        if (!raw) continue;
        links += 1;
        if (/^(https?:|mailto:|#)/i.test(raw)) continue;
        const [targetRaw, anchor] = raw.split("#");
        if (targetRaw === "" && anchor !== undefined) continue; // 纯页内锚点
        const clean = targetRaw.replaceAll("\\", "/").replace(/^\.\//, "");
        const segs = clean.split("/");
        if (SOURCE_ONLY.has(segs[0])) { violations.push(`${rel}: 指向源码仓库专属目录（包内不存在）→ ${raw}——请改 GitHub permalink 或包内文件`); continue; }
        // 先归一化再判定：../ 只有真的逃出包根才算违规（docs/../README.md 是合法包内引用）
        const baseDir = posix.join(...dirname(file).slice(root.length + 1).split(sep));
        const resolved = posix.normalize(posix.join(baseDir, clean));
        if (resolved.startsWith("..")) { violations.push(`${rel}: 逃出发布包的相对链接 → ${raw}`); continue; }
        try {
            const s = await stat(join(root, resolved));
            if (s.isDirectory()) continue;
        } catch {
            violations.push(`${rel}: 链接目标在包内不存在 → ${raw}`);
        }
    }
}

// 安装后最小显示回归（L625 后半）：集市/设置面板按固定名读取 icon.png 与 preview.png——存在且为真 PNG
for (const asset of ["icon.png", "preview.png"]) {
    try {
        const buf = await readFile(join(root, asset));
        const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
        if (!isPng) violations.push(`发布包资产：${asset} 不是有效 PNG（magic 头不符）`);
    } catch {
        violations.push(`发布包资产：${asset} 缺失（安装后集市/设置面板显示回归会失败）`);
    }
}

if (violations.length > 0) {
    console.error(`✗ 发布包链接检查：${violations.length} 处违规（扫描 ${files.length} 个 md / ${links} 条链接）`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
}
console.log(`✓ 发布包链接检查通过（${files.length} 个 md / ${links} 条链接，绝对路径 0 / 包外引用 0，icon/preview PNG ✓）`);
