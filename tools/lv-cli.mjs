#!/usr/bin/env node
/**
 * 小驴快门桥客户端（node CLI，零依赖）
 * 用法：
 *   SIYUAN_URL=http://127.0.0.1:1568 SIYUAN_TOKEN=xxx node tools/lv-cli.mjs ping
 *   node tools/lv-cli.mjs run --plugin siyuan-checkin --command "打开打卡" --wait 8000
 *   node tools/lv-cli.mjs send --op checkin.record --args '{"itemId":"...","value":1}' [--plugin siyuan-quickgate]
 *   node tools/lv-cli.mjs receipt --id <命令id> [--plugin siyuan-quickgate]
 * 说明：无快门时也可对打卡/人脉自己的桥目录发命令（--plugin 指定目标插件）。
 */
const url = (process.env.SIYUAN_URL || "http://127.0.0.1:1568").replace(/\/$/, "");
const token = process.env.SIYUAN_TOKEN || "";
const PLUGIN = "siyuan-quickgate";

function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}

async function kernelPost(endpoint, payload) {
    const res = await fetch(`${url}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: JSON.stringify(payload),
    });
    if (endpoint === "/api/file/getFile") {
        if (!res.ok) return null;
        return await res.text();
    }
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg || `code=${json.code}`);
    return json.data;
}

async function putText(path, text) {
    const form = new FormData();
    form.append("path", path);
    form.append("isDir", "false");
    form.append("file", new Blob([text], { type: "application/octet-stream" }), "file");
    const res = await fetch(`${url}/api/file/putFile`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: form,
    });
    if (!res.ok) throw new Error(`putFile HTTP ${res.status}`);
}

function genId() {
    const d = new Date();
    const p = (n, l = 2) => String(n).padStart(l, "0");
    const rand = Math.random().toString(16).slice(2, 6);
    return `cli-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${rand}`;
}

async function send(plugin, op, args, ttlMs) {
    const id = genId();
    const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ...(ttlMs ? { ttlMs } : {}) });
    const path = `/storage/petal/${plugin}/bridge/commands.ndjson`;
    const old = (await kernelPost("/api/file/getFile", { path })) ?? "";
    await putText(path, (old.replace(/\n+$/, "")) + "\n" + envelope);
    return id;
}

async function receipt(plugin, id, maxWaitMs) {
    const path = `/storage/petal/${plugin}/bridge/results.ndjson`;
    const t0 = Date.now();
    while (Date.now() - t0 < maxWaitMs) {
        const text = (await kernelPost("/api/file/getFile", { path })) ?? "";
        for (const line of text.split("\n")) {
            const t = line.trim();
            if (!t) continue;
            try {
                const obj = JSON.parse(t);
                if (obj.id === id) return obj;
            } catch { /* skip */ }
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    return { id, status: "timeout", message: `等待 ${maxWaitMs}ms 未收到回执` };
}

async function main() {
    const [command] = process.argv.slice(2);
    const plugin = arg("--plugin", PLUGIN);
    const wait = parseInt(arg("--wait", "8000"), 10);
    switch (command) {
        case "ping": {
            const id = await send(plugin, "bridge.ping", {});
            const r = await receipt(plugin, id, wait);
            console.log(JSON.stringify(r, null, 2));
            break;
        }
        case "send": {
            const op = arg("--op");
            const args = JSON.parse(arg("--args", "{}"));
            const id = await send(plugin, op, args, parseInt(arg("--ttl", "60000"), 10));
            console.log(JSON.stringify({ id, sent: true, plugin, op }, null, 2));
            if (arg("--wait", null) !== null) {
                console.log(JSON.stringify(await receipt(plugin, id, wait), null, 2));
            }
            break;
        }
        case "receipt": {
            console.log(JSON.stringify(await receipt(plugin, arg("--id"), wait), null, 2));
            break;
        }
        case "run": {
            const id = await send(plugin, "commands.run", { plugin: arg("--plugin2"), command: arg("--command") });
            // commands.run 确认窗口最长 30s：等待覆盖确认窗口（阻断项3）
            const r = await receipt(plugin, id, Math.max(wait, 35000));
            console.log(JSON.stringify(r, null, 2));
            break;
        }
        case "events": {
            // 直接读源插件桥目录的 events.ndjson（无快门也可用；--names/--since 过滤在 events.pull 有服务端实现）
            const sub = process.argv[3] || "pull";
            if (sub === "list") {
                const id = await send(plugin, "events.list", {});
                console.log(JSON.stringify(await receipt(plugin, id, wait), null, 2));
            } else {
                const args = {};
                if (arg("--names")) args.names = arg("--names").split(",");
                if (arg("--since")) args.since = arg("--since");
                if (arg("--limit")) args.limit = parseInt(arg("--limit"), 10);
                const id = await send(plugin, "events.pull", args);
                const r = await receipt(plugin, id, wait);
                console.log(JSON.stringify(r, null, 2));
            }
            break;
        }
        case "exec": {
            // 内核同步路由（v0.5.0 实验性）：同步直呼，不经桥文件
            const op = arg("--op");
            const res = await fetch(`${url}/plugin/private/${plugin}/exec`, {
                method: "POST",
                headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ op, args: JSON.parse(arg("--args", "{}")) }),
            });
            const json = await res.json();
            console.log(JSON.stringify(json.data ?? json, null, 2));
            break;
        }
        default:
            console.log("用法: lv-cli.mjs <ping|send|receipt|run|events|exec> [--plugin <目标插件>] [--op <op>] [--args <json>] [--id <id>] [--command <cmd>] [--wait <ms>]");
            console.log("  events [pull|list] [--names a,b] [--since <iso>] [--limit n]   事件白名单/拉取（events.pull 服务端过滤）");
            console.log("  exec --op bridge.ping [--args {}]                              内核同步路由直呼（spike⑩ 校准用）");
            process.exit(1);
    }
}

main().catch((e) => { console.error("错误：", e.message); process.exit(1); });
