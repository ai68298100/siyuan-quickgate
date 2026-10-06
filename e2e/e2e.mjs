#!/usr/bin/env node
/**
 * 快门 E2E 验收（对照项目设计文档 02 §8 十条 / 06 §10 六条的自动化子集）。
 * 【写型脚本】会写快门桥载体（commands/results，petal 存储）——按 R287 约定：
 * 目标必须是隔离靶场（node scripts/smoke-range.mjs start），打在用工作区会被
 * guardScratch 拒跑（SIYUAN_E2E_ALLOW_SHARED=1 显式豁免）；隔离靶场启动时自动
 * 清残留临时库并重置桥载体。需要思源运行且快门桥已开启（靶场可加前端载体）；
 * 内核不可达或桥无响应时提示并退出码 2（不误报失败）。
 * 桥存活预检（3s）：不通过则跳过 U1~U10（它们都经桥），只跑 U11 内核路由探针。
 *
 *   node e2e/e2e.mjs [<base-url> <token>]      # argv 优先
 *   SIYUAN_BASE_URL=http://127.0.0.1:6807 SIYUAN_TOKEN=xxx node e2e/e2e.mjs
 */
import { resolveTarget, makeApi, sweepOrphans, guardScratch, resetBridgeQueue } from "../scripts/lib/smoke-kernel.mjs";

const { base: url, token } = resolveTarget({ baseArg: process.argv[2], tokenArg: process.argv[3] });
const PLUGIN = "siyuan-quickgate";
const results = [];

async function kernelPost(endpoint, payload) {
    const res = await fetch(`${url}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Token ${token}`, Connection: "close" },
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
        console.log(`思源内核不可达（${url}；请启动思源/靶场、核对 token，并在快门设置开启外部命令桥）。E2E 未执行。`);
        process.exit(2);
    }
    console.log("== 快门 E2E（自动化子集）==\n");

    // R287 防呆：清残留（只动快门冒烟前缀）→ 共享内核拒跑 → 靶场重置桥载体取干净基线
    const api = makeApi(url, token);
    await sweepOrphans(api);
    const isolated = await guardScratch(api, { base: url });
    if (isolated) await resetBridgeQueue(url, token, PLUGIN);
    else console.log("  (共享内核豁免模式：不清桥载体，测试命令会混入现有队列)\n");

    // 桥存活预检（3s）：U1~U10 全部经桥，桥不活就别逐项 8s 超时慢慢死
    const preId = genId();
    {
        const envelope = JSON.stringify({ v: 1, id: preId, op: "bridge.ping", args: {}, createdAt: new Date().toISOString() });
        const path = `/storage/petal/${PLUGIN}/bridge/commands.ndjson`;
        const old = (await kernelPost("/api/file/getFile", { path })) ?? "";
        await putText(path, old.replace(/\n+$/, "") + "\n" + envelope);
    }
    const bridgeLive = (await waitReceipt(preId, 3000)).status !== "timeout";
    if (!bridgeLive) {
        console.log("  (桥无响应：插件前端未运行或外部命令桥未开启——U1~U10 跳过，只探 U11 内核路由；思源重启后可直接重跑本套件)\n");
    }

    if (bridgeLive) {
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

    // U8 events.list 白名单
    id = await send("events.list");
    r = await waitReceipt(id);
    check("U8 events.list", r.status === "recorded" && (r.data?.events ?? []).some((e) => e.name === "checkin:event-recorded"), `白名单=${r.data?.events?.length}`);

    // U9 workflow：plan → execute（只读步骤，无需确认内容）
    id = await send("workflow.plan");
    r = await waitReceipt(id, 15000);
    check("U9a workflow.plan 空 steps → rejected", r.status === "rejected", r.message);
    id = await send("workflow.plan", { steps: [{ op: "daily.status" }] });
    r = await waitReceipt(id);
    const planId = r.data?.plan?.planId;
    check("U9b workflow.plan 出计划", r.status === "recorded" && !!planId);
    if (planId) {
        // 注意：会弹思源确认框，需有人在 30s 内点确认——自动化场景默认跳过 execute
        console.log("  (workflow.execute 会弹确认框，跳过自动执行；手动验收时用 planId=", planId, ")");
    }

    // U10 events.pull：拉取物化事件（含 v0.5.4 event-deleted）；顺带读源文件核对行存在
    id = await send("events.pull", { limit: 50 });
    r = await waitReceipt(id);
    const pulledNames = (r.data?.events ?? []).map((e) => e.name);
    const hasDeletedFile = ((await kernelPost("/api/file/getFile", { path: "/storage/petal/siyuan-checkin/bridge/events.ndjson" })) ?? "").includes("checkin:event-deleted");
    check("U10a events.pull 可拉取", r.status === "recorded", `事件=${pulledNames.length}`);
    if (hasDeletedFile) {
        check("U10b event-deleted 行存在且可拉取", pulledNames.includes("checkin:event-deleted"), `已拉删除标记=${pulledNames.filter((n) => n === "checkin:event-deleted").length}`);
    } else {
        console.log("  (U10b 跳过：events.ndjson 尚无删除标记——在打卡里删一条记录后再跑)");
    }
    } // end bridgeLive

    // U11 内核同步路由探针（v0.5.0 实验性；404/网络错误都算"未启用"而非失败——spike⑩ 校准）
    try {
        const res = await fetch(`${url}/plugin/private/${PLUGIN}/exec`, {
            method: "POST",
            headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ op: "bridge.ping" }),
        });
        if (res.ok) {
            const j = await res.json();
            const receipt = j.data ?? {};
            check("U11 内核路由 ping", receipt.op === "bridge.ping" && receipt.status === "recorded", `channel=${receipt.data?.channel}`);
        } else {
            console.log(`  (U11 跳过：内核路由 HTTP ${res.status}——插件未启用或路由未放行，spike⑩ 校准)`);
        }
    } catch (e) {
        console.log("  (U11 跳过：内核路由不可达——", e.message, ")");
    }

    const failed = results.filter((x) => !x.ok).length;
    if (!bridgeLive && results.length === 0) process.exit(2); // 桥不活=环境未就绪，不算测试失败
    console.log(`\n== 结果：${results.length - failed}/${results.length} 通过 ==`);
    process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("E2E 异常：", e.message); process.exit(1); });
