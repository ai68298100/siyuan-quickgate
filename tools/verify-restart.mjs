#!/usr/bin/env node
/**
 * 快门重启复测一键脚本（R23）：思源重启（kernel.js/前端加载）后跑一遍，自动判定复测批各项。
 * 覆盖：③桥文件端到端（含延迟）· ⑩内核路由（负向鉴权/ping/events.list/降级）· ⑪事件物化
 *      · ⑤广播通道存活 · v1.5 快路径联调（postMessage→回执延迟，需设置开启广播快路径+前端在线）
 *
 * 用法：node tools/verify-restart.mjs
 *   环境变量：SIYUAN_URL（默认自动读 %APPDATA%\siyuan\env，再退 6806/1568）、SIYUAN_TOKEN（同上自动读）
 * 退出码：0=关键项全过；1=有失败；2=内核不可达（不误报）
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
    const envPath = path.join(process.env.APPDATA ?? "", "siyuan", "env");
    let url = process.env.SIYUAN_URL ?? "";
    let token = process.env.SIYUAN_TOKEN ?? "";
    try {
        for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
            const i = line.indexOf("=");
            if (i <= 0) continue;
            const k = line.slice(0, i).trim();
            const v = line.slice(i + 1).trim();
            if (k === "SIYUAN_URL" && !url) url = v;
            if (k === "SIYUAN_TOKEN" && !token) token = v;
        }
    } catch { /* 无 env 文件时用环境变量/默认 */ }
    return { url: (url || "http://127.0.0.1:6806").replace(/\/$/, ""), token };
}

const { url, token } = loadEnv();
const PLUGIN = "siyuan-quickgate";
const results = [];
const check = (name, ok, detail = "") => {
    results.push({ name, ok });
    console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  ${detail}` : ""}`);
};
const post = async (endpoint, body, extraHeaders = {}) => {
    const res = await fetch(`${url}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* 非 JSON */ }
    return { status: res.status, json };
};
const getFile = async (p) => {
    const res = await fetch(`${url}/api/file/getFile`, {
        method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: p }),
    });
    return res.ok ? res.text() : null;
};
const putText = async (p, text) => {
    const form = new FormData();
    form.append("path", p);
    form.append("isDir", "false");
    form.append("file", new Blob([text], { type: "application/octet-stream" }), "f");
    const res = await fetch(`${url}/api/file/putFile`, { method: "POST", headers: { Authorization: `Token ${token}` }, body: form });
    return res.ok;
};
const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

async function main() {
    console.log(`内核：${url}\n`);

    // 0) 内核可达性
    let version = null;
    try {
        const v = await post("/api/system/version", {});
        version = v.json?.data ?? null;
    } catch { /* 不可达 */ }
    if (version === null) {
        console.log("内核不可达——思源未运行。复测批需在思源运行时执行（不误报失败）。");
        process.exit(2);
    }
    check("内核可达", true, `v${version}`);

    // ③ 桥文件端到端（需桥开启=前端快门在跑）
    const cmdPath = `/storage/petal/${PLUGIN}/bridge/commands.ndjson`;
    const resPath = `/storage/petal/${PLUGIN}/bridge/results.ndjson`;
    const id3 = genId("vr");
    const t0 = Date.now();
    await putText(cmdPath, ((await getFile(cmdPath)) ?? "").replace(/\n+$/, "") + "\n" +
        JSON.stringify({ v: 1, id: id3, op: "bridge.ping", args: {}, createdAt: new Date().toISOString(), ttlMs: 20000 }));
    let r3 = null;
    while (Date.now() - t0 < 8000) {
        const text = (await getFile(resPath)) ?? "";
        for (const line of text.split("\n")) {
            try { const o = JSON.parse(line); if (o.id === id3) { r3 = o; break; } } catch { /* skip */ }
        }
        if (r3) break;
        await new Promise((r) => setTimeout(r, 250));
    }
    if (r3) check("③ 桥文件端到端", r3.status === "recorded", `${Date.now() - t0}ms status=${r3.status}`);
    else check("③ 桥文件端到端", false, "8s 未收到回执——桥未开启或前端快门未加载（设置→外部命令桥）");

    // ⑩ 内核路由
    const neg = await fetch(`${url}/plugin/private/${PLUGIN}/exec`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "bridge.ping" }),
    });
    check("⑩⓪ 无 Token 负向鉴权", neg.status === 401 || neg.status === 403, `HTTP ${neg.status}（401/403=安全基线成立）`);
    const exec = async (op, args = {}) => {
        const res = await fetch(`${url}/plugin/private/${PLUGIN}/exec`, {
            method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ op, args }),
        });
        let j = null; try { j = await res.json(); } catch { /* ignore */ }
        return { status: res.status, receipt: j?.data ?? null };
    };
    const p10 = await exec("bridge.ping");
    if (p10.status === 200 && p10.receipt?.op === "bridge.ping") {
        check("⑩ 内核路由 ping", p10.receipt.status === "recorded", `channel=${p10.receipt.data?.channel}`);
        const ev = await exec("events.list");
        check("⑩ events.list", ev.receipt?.status === "recorded", `白名单=${ev.receipt?.data?.events?.length}`);
        const de = await exec("commands.run", { plugin: "x", command: "y" });
        check("⑩ 前端专属 op 降级", de.receipt?.status === "unsupported", de.receipt?.message?.slice(0, 40));
    } else {
        check("⑩ 内核路由", false, `HTTP ${p10.status}（"plugin not found"=内核未重启，kernel.js 未加载）`);
    }

    // ⑪ 事件物化（需打卡 ≥18.16 且前端快门在跑；无删除记录时跳过）
    const evText = (await getFile("/storage/petal/siyuan-checkin/bridge/events.ndjson")) ?? "";
    if (evText.includes("checkin:event-recorded") || evText.includes("checkin:event-deleted")) {
        check("⑪ 事件物化", true, `recorded=${evText.split("checkin:event-recorded").length - 1} deleted=${evText.split("checkin:event-deleted").length - 1}`);
    } else {
        console.log("  (⑪ 跳过：events.ndjson 尚无事件——在打卡里记/删一条后重跑)");
    }

    // ⑤ 广播通道存活 + v1.5 快路径联调
    try {
        const pm = await post("/api/broadcast/postMessage", { channel: "qg-verify", message: "alive" });
        check("⑤ 广播 postMessage", pm.json?.code === 0);
    } catch (e) { check("⑤ 广播 postMessage", false, String(e.message)); }

    const id15 = genId("v15");
    const envelope = JSON.stringify({ v: 1, id: id15, op: "bridge.ping", args: {}, createdAt: new Date().toISOString(), ttlMs: 20000 });
    const t15 = Date.now();
    await post("/api/broadcast/postMessage", { channel: "qg-cmd", message: envelope });
    let r15 = null;
    while (Date.now() - t15 < 5000) {
        const text = (await getFile(resPath)) ?? "";
        if (text.includes(`"${id15}"`)) { r15 = { ms: Date.now() - t15 }; break; }
        await new Promise((r) => setTimeout(r, 120));
    }
    if (r15) check("v1.5 广播快路径联调", true, `postMessage→回执落盘 ${r15.ms}ms`);
    else console.log("  (v1.5 联调跳过：回执未出现——需设置开启「广播快路径」且前端快门在线；NDJSON 慢路径兜底时也能收到，仅延迟~750ms)");

    const failed = results.filter((x) => !x.ok).length;
    console.log(`\n== 复测：${results.length - failed}/${results.length} 通过 ==`);
    process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("复测异常：", e.message); process.exit(2); });
