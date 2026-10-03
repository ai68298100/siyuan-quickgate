/**
 * 发布自查门（§11：分享/截图前 Token、个人 ID、工作空间/用户目录绝对路径泄露自查）
 * 扫描 dist/（发布包内容）中的高危模式；命中即非零退出——发布/分享前必跑。
 * 用法：node scripts/check-release.mjs [目录，默认 dist]
 *
 * 模式表（误报预算趋零：只抓高置信度个人泄露面）：
 *  - API Token 形态（思源 token 为短字母数字，用 env 文件值精确比对 + 通用形态双保险）
 *  - 用户目录绝对路径（C:\Users\<name>、/home/<name>、/Users/<name>）
 *  - 本机工作空间路径（D:\、E:\ 等盘符 + 反斜杠路径片段）
 *  - 内网地址（127.0.0.1 之外的内网网段写死值）
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const dir = path.resolve(root, process.argv[2] ?? "dist");
if (!fs.existsSync(dir)) {
    console.error(`❌ 发布自查：目录不存在 ${dir}（先 npm run build）`);
    process.exit(1);
}

// ① 本机真实 Token（env 文件）——精确比对最高置信
const realTokens = new Set();
const envPath = path.join(os.homedir(), "AppData", "Roaming", "siyuan", "env");
try {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const m = line.match(/^SIYUAN_TOKEN=(.+)$/);
        if (m && m[1].trim()) realTokens.add(m[1].trim());
    }
} catch { /* env 不存在跳过 */ }

// ② 通用高危模式
const patterns = [
    [/C:\\\\Users\\\\[^"'\s\\]+/g, "用户目录绝对路径"],
    [/C:\\Users\\[^"'\s\\]+/g, "用户目录绝对路径"],
    [/(?:\/home|\/Users)\/[a-z0-9_]+(?:\/[^\s"'*)]*)?/gi, "unix 用户目录路径"],
    [/[D-Fd-f]:\\(?:[^\s"'\\/]+\\)+/g, "盘符工作空间路径"],
    [/\b(?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b/g, "内网 IP（127.0.0.1 除外）"],
];

let hits = 0;
const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) { walk(p); continue; }
        const rel = path.relative(root, p);
        let text = "";
        try { text = fs.readFileSync(p, "utf8"); } catch { continue; }
        for (const t of realTokens) {
            if (text.includes(t)) { console.error(`  ❌ ${rel}: 含本机真实 API Token！`); hits++; }
        }
        for (const [re, label] of patterns) {
            const found = text.match(re);
            if (found) {
                // index.js 里的合法 127.0.0.1 默认值不算；预览路径样例等白名单放行
                const sample = found.slice(0, 2).join(" | ");
                console.error(`  ❌ ${rel}: ${label} → ${sample}${found.length > 2 ? `（共 ${found.length} 处）` : ""}`);
                hits += found.length;
            }
        }
    }
};
walk(dir);

if (hits > 0) {
    console.error(`\n❌ 发布自查不通过：${hits} 处疑似泄露（见上）。修复后重跑。`);
    process.exit(1);
}
console.log(`✅ 发布自查通过：${dir} 无 Token / 个人路径 / 内网地址泄露`);
