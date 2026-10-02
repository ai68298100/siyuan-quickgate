#!/usr/bin/env node
/**
 * MCP 代理协议级冒烟（tools/mcp-smoke.mjs）：完整 stdio 协议序列 vs src/mcp/main.ts。
 * 今天就能全量跑（不依赖插件消费）；唯一的"诚实超时"断言需要 15s。
 *   SIYUAN_TOKEN=xxx node tools/mcp-smoke.mjs
 */
import { spawn } from "node:child_process";

const results = [];
const check = (name, ok, detail = "") => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

function session(writeMode) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, LV_MCP_WRITE: writeMode ? "1" : "0" };
        const child = spawn(process.execPath, ["src/mcp/main.ts"], { env, stdio: ["pipe", "pipe", "pipe"] });
        let buf = "";
        const pending = new Map();
        let exited = false;
        let exitHint = "";
        child.on("exit", (code) => {
            exited = true;
            if (code !== 0) exitHint = `代理进程提前退出 code=${code}（常见原因：SIYUAN_TOKEN 未设置——直接跑脚本时先 export $(grep -v '^#' "$APPDATA/siyuan/env" | xargs)）`;
        });
        child.stdout.on("data", (c) => {
            buf += String(c);
            let idx;
            while ((idx = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, idx).trim();
                buf = buf.slice(idx + 1);
                if (!line.startsWith("{")) continue;
                try {
                    const o = JSON.parse(line);
                    if (o.id !== undefined && pending.has(o.id)) { pending.get(o.id)(o); pending.delete(o.id); }
                } catch { /* 跳过 */ }
            }
        });
        child.stderr.on("data", (c) => { if (!exitHint) exitHint = String(c).split("\n")[0].slice(0, 120); });
        const call = (method, params) => new Promise((res) => {
            const id = pending.size + 1 + Math.floor(Math.random() * 1000);
            pending.set(id, res);
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
        });
        const notify = (method) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
        const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(exited ? (exitHint || `代理进程退出（${tag} 阶段）`) : `${tag} ${ms}ms 超时`)), ms))]);
        resolve({
            call: (m, p) => withTimeout(call(m, p), 20000, m),
            notify,
            end: () => child.kill(),
        });
    }).catch((e) => { throw e; });
}

try {
    // —— 只读会话（默认）——
    const ro = await session(false);
    const init = await ro.call("initialize", {});
    check("initialize 握手", init.result?.protocolVersion === "2024-11-05" && init.result?.serverInfo?.name === "lv-quickgate", `${init.result?.serverInfo?.name}@${init.result?.serverInfo?.version}`);
    ro.notify("notifications/initialized");
    const list = await ro.call("tools/list", {});
    const names = (list.result?.tools ?? []).map((t) => t.name);
    check("tools/list 默认只读 13 工具", names.length === 13, `实际 ${names.length}`);
    check("写工具未暴露", !names.includes("checkin.record") && !names.includes("commands.run"));
    const denied = await ro.call("tools/call", { name: "checkin.record", arguments: { itemId: "x" } });
    check("tools/call 写工具诚实拒绝", denied.result?.isError === true && String(denied.result?.content?.[0]?.text ?? "").includes("LV_MCP_WRITE"));
    const roEnd = ro;
    roEnd.end();

    // —— 写模式会话——
    const rw = await session(true);
    const list2 = await rw.call("tools/list", {});
    check("LV_MCP_WRITE=1 时 23 工具全暴露", (list2.result?.tools ?? []).length === 23, `实际 ${(list2.result?.tools ?? []).length}`);
    // read-only op 走广播快路径：无消费者 → 15s 诚实超时回执
    const ping = await rw.call("tools/call", { name: "bridge.ping", arguments: {} });
    const text = ping.result?.content?.[0]?.text ?? "";
    check("bridge.ping 无消费者诚实超时", ping.result?.isError === true && text.includes('"timeout"'), text.includes('"timeout"') ? "15s" : text.slice(0, 60));
    rw.end();
} catch (e) {
    check("会话异常", false, e.message);
}

const failed = results.filter((x) => !x.ok).length;
console.log(`\n== MCP 冒烟：${results.length - failed}/${results.length} 通过 ==`);
process.exit(failed ? 1 : 0);
