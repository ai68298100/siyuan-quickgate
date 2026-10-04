// R221 绑定思源窗口（一次性探针）
import fs from "node:fs";
const root = process.env.ZCODE_PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT;
if (!root) throw new Error("no plugin root");
const { join } = await import("node:path");
const { pathToFileURL } = await import("node:url");
const mod = await import(pathToFileURL(join(root, "scripts", "computer-use-client.mjs")).href);
await mod.setupComputerUseRuntime({ globals: globalThis });

const st = await agent.computerUse.getState({ emit: false });
const apps = st.apps || [];
const sy = apps.filter(a => /siyuan/i.test(a.bundle_id || "") || /思源/.test(a.name || ""));
console.log("思源相关窗口:");
sy.forEach(a => console.log(" ", JSON.stringify(a)));
