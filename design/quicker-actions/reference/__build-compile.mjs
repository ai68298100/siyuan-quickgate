// 生成 csc 编译组合件：把 Quicker 顶级 Exec 脚本包进类（模拟 Quicker 宿主包装）
// 用法：node __build-compile.mjs → 产出 __combined.cs；csc /out:x.dll __combined.cs __compile-stub.cs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".cs") && !f.startsWith("__"));
const usings = new Set();
const classes = [];
let n = 0;
for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const bodyLines = [];
    for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*using\s+([A-Za-z_][\w.]*\s*(?:=\s*[\w.]+)?)\s*;/);
        if (m) { usings.add(m[1].trim()); continue; }
        bodyLines.push(line);
    }
    classes.push(`// ==== ${f} ====\npublic class __Snippet${n} {\n${bodyLines.join("\n")}\n}`);
    n++;
}
const out = [...usings].map((u) => `using ${u};`).join("\n") + "\n\n" + classes.join("\n\n") + "\n";
fs.writeFileSync(path.join(dir, "__combined.cs"), out, "utf8");
console.log(`__combined.cs 生成：${files.length} 个脚本 → ${n} 个包装类`);
