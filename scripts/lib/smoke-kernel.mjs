// ============================================================
// 冒烟/e2e 脚本共享件：目标解析 + 共享内核防呆 + 残留清扫
// 改造自小驴考试 scripts/lib/smoke-kernel.mjs（fa57d6a），快门前缀注册表版。
// 背景（R287 · 用户约定）：本机内核常被多个插件项目和真实数据共用——
// 写型脚本（改 petal 存储/部署插件文件/建删笔记本）不应直打在用工作区：
//   - 其他插件的事件监听会把测试写入当真实事件做出反应
//   - 浏览器载体会话会认领桥（Web Lock），与真实前台的桥消费互相搅动
//   - 部署式重写 index.js 会触发 push_reload（Electron 前台即 bug#15 死桥序列）
// 三层防护：
//   1) resolveTarget：SIYUAN_BASE_URL / SIYUAN_TOKEN（argv 优先），缺 token 即退出
//   2) sweepOrphans：清扫上次崩溃残留的临时笔记本（前缀注册表匹配）
//   3) guardScratch：目标内核存在非快门前缀笔记本 → 拒跑；SIYUAN_E2E_ALLOW_SHARED=1 显式豁免
// 隔离靶场做法：scripts/smoke-range.mjs——独立 workspace 起第二个内核实例
// （端口从 6807 起自动顺延），实例内只装快门；详见 AGENTS.md「冒烟/e2e 内核防呆」。
// ============================================================

/** 快门所有冒烟/e2e 临时笔记本前缀（新脚本一律用 siyuan-quickgate-smoke-；旧前缀保留供清扫） */
export const SCRATCH_PREFIXES = [
    "siyuan-quickgate-smoke-",
];

/**
 * 思源自建样板笔记本名（首启/空库时自动补建，删了会被活跃会话立刻重建——靶场实测）。
 * 视为中性：不算外来数据。真工作区不可能只有这些名字，防护不受影响。
 */
export const SAMPLE_NOTEBOOK_NAMES = new Set(["My Notebook", "思源笔记", "Welcome", "欢迎使用思源笔记"]);

export function isSampleName(name) {
    return SAMPLE_NOTEBOOK_NAMES.has(name);
}

export function isScratchName(name) {
    return SCRATCH_PREFIXES.some((p) => name.startsWith(p));
}

/** 目标解析：argv > SIYUAN_BASE_URL > SIYUAN_URL（旧变量，兼容既有文档）；token 缺失即退出（不使用默认密钥） */
export function resolveTarget({ baseArg, tokenArg } = {}) {
    const base = String(
        baseArg ?? process.env.SIYUAN_BASE_URL ?? process.env.SIYUAN_URL ?? "http://127.0.0.1:6806",
    ).replace(/\/+$/, "");
    const token = tokenArg ?? process.env.SIYUAN_TOKEN ?? "";
    if (!token) {
        console.error("✗ 缺少思源 token：请传入第二参数或设置 SIYUAN_TOKEN；不会使用默认 token");
        process.exit(1);
    }
    return { base, token };
}

/** 统一 api 调用器（思源返回非 2xx 时抛错；code!=0 由调用方按语义判定）。
 * Connection: close——防 process.exit 时 keep-alive 句柄未关触发 libuv 断言（Windows v24 实证） */
export function makeApi(base, token) {
    return async function api(path, body) {
        const res = await fetch(base + path, {
            method: "POST",
            headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", Connection: "close" },
            body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };
}

/** 思源建库 id 双形态（3.8.5 裸 id / 3.8.6 { notebook: { id } }） */
export function notebookIdOf(data) {
    return data?.notebook?.id ?? data?.notebook ?? data?.id ?? "";
}

async function listNotebooks(api) {
    const r = await api("/api/notebook/lsNotebooks", {});
    if (r.code !== 0) throw new Error(`lsNotebooks code=${r.code} ${r.msg}`);
    return r.data?.notebooks ?? [];
}

/** 清扫上次崩溃残留的临时笔记本（只动前缀注册表内的，绝不碰其他数据） */
export async function sweepOrphans(api) {
    const orphans = (await listNotebooks(api)).filter((n) => isScratchName(n.name));
    for (const n of orphans) {
        try {
            await api("/api/notebook/removeNotebook", { notebook: n.id });
            console.log(`  清扫残留临时库：${n.name}`);
        } catch (e) {
            console.log(`  ⚠ 残留清理失败（不影响本次运行）：${n.name} — ${String(e).slice(0, 60)}`);
        }
    }
}

/** 共享内核防呆：存在任何非快门前缀、非思源样板的笔记本即拒跑写型脚本；返回是否为隔离靶场 */
export async function guardScratch(api, { base } = {}) {
    const notebooks = await listNotebooks(api);
    const foreign = notebooks.filter((n) => !isScratchName(n.name) && !isSampleName(n.name));
    if (!foreign.length) return true;
    if (process.env.SIYUAN_E2E_ALLOW_SHARED === "1") {
        console.log(`  ⚠ SIYUAN_E2E_ALLOW_SHARED=1：在共享内核上直跑写型脚本（${foreign.length} 个既有笔记本），临时产物用后即清`);
        return false;
    }
    console.error([
        `✗ 目标内核 ${base} 不是隔离靶场：存在 ${foreign.length} 个非快门冒烟前缀的笔记本（如「${foreign[0].name}」）。`,
        "  写型脚本会改 petal 存储/重写插件文件——与其他插件/真实数据共用的内核不宜直跑：",
        "    ① 推荐：node scripts/smoke-range.mjs start（独立 workspace 起第二内核，端口 6807 起，只装快门）；",
        "    ② 或确认风险后设 SIYUAN_E2E_ALLOW_SHARED=1 显式豁免（临时产物自清理，脚本崩溃可能残留）。",
    ].join("\n"));
    process.exit(1);
}

/**
 * 隔离靶场上重置快门桥载体（commands/results 清零，跑出干净基线）。
 * 仅在 guardScratch 判定隔离（未豁免）时调用——共享内核上这些文件是真实桥历史，绝不清。
 */
export async function resetBridgeQueue(base, token, pluginName = "siyuan-quickgate") {
    for (const f of ["commands.ndjson", "results.ndjson"]) {
        const path = `/storage/petal/${pluginName}/bridge/${f}`;
        const form = new FormData();
        form.append("path", path);
        form.append("isDir", "false");
        form.append("modTime", String(Math.floor(Date.now() / 1000)));
        form.append("file", new Blob([""], { type: "application/octet-stream" }), "file");
        const res = await fetch(`${base}/api/file/putFile`, {
            method: "POST",
            headers: { Authorization: `Token ${token}` },
            body: form,
        });
        if (!res.ok) throw new Error(`重置 ${f} 失败：HTTP ${res.status}`);
    }
    console.log("  已重置桥载体（commands/results 清零）");
}

/** AI 外发开关（约定 4）：凡向已配置模型真实发请求的检查步，默认跳过；SIYUAN_E2E_AI=1 显式启用 */
export function aiEnabled() {
    return process.env.SIYUAN_E2E_AI === "1";
}

export function skipUnlessAi(stepName) {
    if (aiEnabled()) return true;
    console.log(`  (SKIP ${stepName}：会向已配置 AI 模型真实发请求；SIYUAN_E2E_AI=1 启用)`);
    return false;
}
