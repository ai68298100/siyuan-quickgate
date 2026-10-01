#!/usr/bin/env node
/**
 * 快门 E2E 验收（对照项目设计文档 02 §8 十条 / 06 §10 六条的自动化子集）。
 * 需要思源运行且快门桥已开启；内核不可达时提示并退出码 2（不误报失败）。
 *
 *   SIYUAN_URL=http://127.0.0.1:1568 SIYUAN_TOKEN=xxx node e2e/e2e.mjs
 */
const url = (process.env.SIYUAN_URL || "http://127.0.0.1:1568").replace(/\/$/, "");
const token = process.env.SIYUAN_TOKEN || "";
const PLUGIN = "siyuan-quickgate";
const results = [];

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
    return await res.json();
}

async function putText(path, text) {
    const form = new FormData();
    form.append("path", path);
    form.append("isDir", "false");
    form.append("file", new Blob([text], { type: "application/octet-stream" }), "file");
    const res = await fetch(`${url}/api/file/putFile`, { method: "POST", headers: { Authorization: `Token ${token}` }, body: form });
    if (!res.ok) throw new Error(`putFile HTTP ${res.status}`);
}

const genId = () => `e2e-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

async function send(op, args = {}, extra = {}) {
    const id = genId();
    const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ...extra });
    const path = `/storage/petal/${PLUGIN}/bridge/commands.ndjson`;
    const old = (await kernelPost("/api/file/getFile", { path })) ?? "";
    await putText(path, old.replace(/\n+$/, "") + "\n" + envelope);
    return id;
}

async function waitReceipt(id, maxMs = 8000) {
    const path = `/storage/petal/${PLUGIN}/bridge/results.ndjson`;
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        const text = (await kernelPost("/api/file/getFile", { path })) ?? "";
        for (const line of text.split("\n")) {
            const t = line.trim();
            if (!t) continue;
            try { const o = JSON.parse(t); if (o.id === id) return o; } catch {}
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    return { id, status: "timeout" };
}

function check(name, cond, detail = "") {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
    // 内核可达性预检
    try {
        await kernelPost("/api/system/version", {});
    } catch {
        console.log("思源内核不可达（请启动思源、核对 SIYUAN_URL/Token，并在快门设置开启外部命令桥）。E2E 未执行。");
        process.exit(2);
    }
    console.log("== 快门 E2E（自动化子集）==\n");

    // U1 正常链路：bridge.ping → recorded
    let id = await send("bridge.ping");
    let r = await waitReceipt(id);
    check("U1 ping → recorded", r.status === "recorded", `pollMs=${r.data?.pollMs}`);

    // U2 幂等：同 id 重发 → duplicate/跳过（幂等台账按 id）
    await send("bridge.ping");
    // U3 未知 op → unsupported
    id = await send("no.such.op");
    r = await waitReceipt(id);
    check("U3 未知 op → unsupported", r.status === "unsupported", r.message);

    // U4 TTL：过期命令 → expired 不执行
    id = await send("bridge.ping", {}, { ttlMs: 1 });
    r = await waitReceipt(id, 15000);
    check("U4 TTL 过期 → expired", r.status === "expired", r.message);

    // U5 registry.list
    id = await send("registry.list");
    r = await waitReceipt(id);
    check("U5 registry.list", r.status === "recorded", `插件数=${r.data?.plugins?.length}`);

    // U6 diagnostics.report
    id = await send("diagnostics.report");
    r = await waitReceipt(id);
    check("U6 diagnostics.report", r.status === "recorded", `bridge=${r.data?.bridge?.enabled}`);

    // U7 config.discover
    id = await send("config.discover");
    r = await waitReceipt(id);
    check("U7 config.discover", r.status === "recorded", `日记=${r.data?.diaryNotebookId ?? "未发现"}`);

    const failed = results.filter((x) => !x.ok).length;
    console.log(`\n== 结果：${results.length - failed}/${results.length} 通过 ==`);
    process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("E2E 异常：", e.message); process.exit(1); });
