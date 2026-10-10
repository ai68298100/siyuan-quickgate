#!/usr/bin/env node
/**
 * 小驴快门桥客户端（node CLI，零依赖）
 * 用法：
 *   SIYUAN_URL=http://127.0.0.1:6806 SIYUAN_TOKEN=xxx node tools/lv-cli.mjs ping
 *   node tools/lv-cli.mjs run --plugin siyuan-checkin --command "打开打卡" --wait 8000
 *   node tools/lv-cli.mjs send --op checkin.record --args '{"itemId":"...","value":1}' [--plugin siyuan-quickgate]
 *   node tools/lv-cli.mjs receipt --id <命令id> [--plugin siyuan-quickgate]
 * 说明：无快门时也可对打卡/人脉自己的桥目录发命令（--plugin 指定目标插件）。
 */
let url = (process.env.SIYUAN_URL || "").replace(/\/$/,""); // 空则 main() 里自动发现工作区内核
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
    if (!res.ok) throw new Error(await diagnose(res, "putFile"));
}

/** R214 新增：429/401 精确诊断（多会话共享内核时高频踩坑） */
async function diagnose(res, api) {
    const retry = res.headers.get("Retry-After");
    if (res.status === 429) {
        const wait = retry ? `${retry}s（约 ${Math.ceil(retry / 60)} 分钟）` : "未知";
        return `${api} 429 认证锁定：先前失败尝试触发防爆破——等待 ${wait} 后重试；期间勿再发请求（会刷新锁定）`;
    }
    if (res.status === 401) {
        let body = "";
        try { body = (await res.text()).slice(0, 120); } catch { }
        return `${api} 401 令牌被拒：令牌可能已在其他会话/设备轮换——思源 设置→关于 复制新令牌更新 env；响应：${body}`;
    }
    return `${api} HTTP ${res.status}`;
}

function genId() {
    // id 承载幂等语义（processed 台账按键去重）——用 crypto UUID 段，杜绝同毫秒碰撞
    const d = new Date();
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `cli-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${crypto.randomUUID().slice(0, 8)}`;
}

async function send(plugin, op, args, ttlMs) {
    const id = genId();
    const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ...(ttlMs ? { ttlMs } : {}) });
    const path = `/storage/petal/${plugin}/bridge/commands.ndjson`;
    // L453：多生产者 read-modify-write 并发会互相覆盖（实测 4 写者丢 66/100）——
    // 写后读回校验本行仍在，不在则基于最新内容重试（残窗=最后一次写竞态；高并发建议广播通道）
    for (let attempt = 0; attempt < 5; attempt++) {
        const old = (await kernelPost("/api/file/getFile", { path })) ?? "";
        await putText(path, (old.replace(/\n+$/, "")) + (old.trim() ? "\n" : "") + envelope);
        const back = (await kernelPost("/api/file/getFile", { path })) ?? "";
        if (back.includes(`"id":"${id}"`)) return id;
        await new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 120)));
    }
    throw new Error("追加重试 5 次仍未持久化（多写者竞争过于激烈）");
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
    if (!url) {
        const { discoverWorkspaceKernel } = await import("../src/mcp/discover.ts");
        const found = await discoverWorkspaceKernel({ token });
        if (found) { url = found; console.error("[lv-cli] 已自动发现工作区内核：" + found + "（显式指定 SIYUAN_URL 可跳过探测）"); }
        else url = "http://127.0.0.1:6806";
    }
    const [command] = process.argv.slice(2);
    const plugin = arg("--plugin", PLUGIN);
    const waitRaw = arg("--wait", "8000");
    const wait = /^\d+$/.test(waitRaw) ? parseInt(waitRaw, 10) : 8000; // 裸 --wait 无值时回落默认（此前出 NaN）
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
        case "fast": {
            // v1.5 广播快路径：postMessage 推信封到 qg-cmd 频道，插件 SSE 订阅毫秒级执行；
            // 回执仍写 results.ndjson——收到回执即可算出端到端延迟（对比 send 的 NDJSON 慢路径）
            const op = arg("--op") || "bridge.ping";
            const args = JSON.parse(arg("--args", "{}"));
            const channel = arg("--channel", "qg-cmd");
            const id = genId();
            const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString() });
            const t0 = Date.now();
            await kernelPost("/api/broadcast/postMessage", { channel, message: envelope });
            const postMs = Date.now() - t0;
            console.log(JSON.stringify({ id, via: "broadcast", channel, postMs }, null, 2));
            const r = await receipt(plugin, id, wait);
            if (r.finishedAt) r.e2eMs = Date.now() - t0; // 回执字段=finishedAt（bridge-service 写入）
            console.log(JSON.stringify(r, null, 2));
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
            console.log("用法: lv-cli.mjs <ping|send|receipt|run|events|exec|fast> [--plugin <目标插件>] [--op <op>] [--args <json>] [--id <id>] [--command <cmd>] [--wait <ms>]");
            console.log("  events [pull|list] [--names a,b] [--since <iso>] [--limit n]   事件白名单/拉取（events.pull 服务端过滤）");
            console.log("  exec --op bridge.ping [--args {}]                              内核同步路由直呼（spike⑩ 校准用）");
            console.log("  fast [--op bridge.ping] [--channel qg-cmd]                     v1.5 广播快路径（postMessage 推信封，毫秒级；回执算 e2eMs）");
            process.exit(1);
    }
}

main().catch((e) => { console.error("错误：", e.message); process.exit(1); });
