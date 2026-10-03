/**
 * 版本一致性门禁（R70·版本门禁，非交互，供 CI 与发版前调用）：
 * plugin.json === package.json === src/index.ts PLUGIN_VERSION（三处必须同值）。
 * 背景：v0.7.3 升版时漏改 PLUGIN_VERSION，运行时自报旧版本——门禁缺位的活例证。
 * 用法：node scripts/check-version.mjs [期望版本]；不带参数则取 plugin.json 为基准互查。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const fail = (msg) => {
    console.error(`❌ 版本门禁：${msg}`);
    process.exit(1);
};

const plugin = read("plugin.json").version;
const pkg = read("package.json").version;
const idx = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");
const m = idx.match(/const PLUGIN_VERSION = "(\d+\.\d+\.\d+)"/);
if (!m) fail("src/index.ts 未找到 PLUGIN_VERSION 常量");
const src = m[1];

const expected = process.argv[2];
for (const [name, v] of [["plugin.json", plugin], ["package.json", pkg], ["src/index.ts", src]]) {
    if (expected && v !== expected) fail(`${name}=${v} ≠ 期望 ${expected}`);
}
if (!(plugin === pkg && pkg === src)) {
    fail(`三处不一致：plugin.json=${plugin} / package.json=${pkg} / src/index.ts=${src}`);
}
console.log(`✅ 版本门禁通过：${plugin}（plugin.json / package.json / src/index.ts 三处一致${expected ? "，且等于期望值" : ""}）`);
