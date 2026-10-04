#!/usr/bin/env node
/**
 * 生态清单校验器（C9 合同 §5 · R226）——与 docs/contracts/ecosystem-manifest.schema.json 同规则的零依赖实现。
 * 用法：
 *   node scripts/validate-ecosystem-manifest.mjs                     # 默认：本仓库模板 + quickgate manifest（存在即校验）
 *   node scripts/validate-ecosystem-manifest.mjs --file <path.json>  # 校验单个文件（整体 manifest 或单插件条目均可）
 * 退出码：0=全部通过；1=有失败。设计仓库侧=评审门；quickgate 侧 CI 阻断挂实现批（合同 §6）。
 */
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const QUICKGATE_MANIFEST = "D:/AI/Codex/siyuan-quickgate/src/assets/ecosystem-manifests.json";
const TEMPLATE = "templates/ecosystem-manifest-entry.template.json";

const MATURITY = new Set(["stable", "design", "unlocated"]);
const INGESTION = new Set(["none", "eventFile", "windowEvent"]);
const EVENT_STATUS = new Set(["available", "observed", "design"]);
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const PLUGIN_ID = /^siyuan-[a-z][a-z0-9-]*$/;
const NS = /^[a-z][a-z0-9-]*$/;
const EVENT_NAME = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const DOMAIN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const PROTOCOL_V = /^v[0-9]+$/;

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const warn = (msg) => console.warn(`  ⚠ ${msg}（v1 迁移期警告；version≥2 起为失败）`);
const strip = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => (k.startsWith("$comment") ? undefined : v)));

function validatePlugin(p, ctx, manifestVersion) {
    const at = `${ctx} ${p.pluginId ?? "(pluginId 缺失)"}`;
    for (const key of ["pluginId", "displayName", "maturity", "version", "protocol", "capabilities", "hubIntegration"]) {
        if (!(key in p)) fail(`${at}: 缺必填字段 ${key}`);
    }
    if (typeof p.pluginId !== "string" || !PLUGIN_ID.test(p.pluginId)) fail(`${at}: pluginId 须匹配 siyuan-* 小写连字符`);
    if (!MATURITY.has(p.maturity)) fail(`${at}: maturity 须为 stable|design|unlocated`);
    if (p.version !== null && !(typeof p.version === "string" && SEMVER.test(p.version))) fail(`${at}: version 须为 semver 或 null`);
    if (!Array.isArray(p.capabilities)) fail(`${at}: capabilities 须为数组`);
    if (typeof p.hubIntegration !== "string") fail(`${at}: hubIntegration 须为字符串`);

    if (Array.isArray(p.events) && p.events.length > 0) {
        if (typeof p.eventNamespace !== "string" || !NS.test(p.eventNamespace)) {
            (manifestVersion >= 2 ? fail : warn)(`${at}: 有 events 必填 eventNamespace（小写短名）`);
        } else {
            for (const ev of p.events) {
                if (typeof ev.name !== "string" || !EVENT_NAME.test(ev.name)) { fail(`${at}: 事件名 ${JSON.stringify(ev.name)} 须为 <ns>:<kebab-verb>`); continue; }
                if (!ev.name.startsWith(`${p.eventNamespace}:`)) fail(`${at}: 事件 ${ev.name} 前缀 ≠ eventNamespace:${p.eventNamespace}`);
                if (!EVENT_STATUS.has(ev.status)) fail(`${at}: 事件 ${ev.name} status 须为 available|observed|design`);
                if (typeof ev.idempotency !== "string" || !ev.idempotency.trim()) fail(`${at}: 事件 ${ev.name} 缺 idempotency`);
                if (ev.status === "available" && (typeof ev.payload !== "object" || ev.payload === null)) fail(`${at}: available 事件 ${ev.name} 缺 payload 形状`);
                if (manifestVersion >= 2 && ev.since !== undefined && !(typeof ev.since === "string" && SEMVER.test(ev.since))) fail(`${at}: 事件 ${ev.name} since 须为 semver`);
            }
        }
        if (p.maturity === "stable" && p.ingestion === "none") fail(`${at}: stable 插件有 events 但 ingestion=none（载体矛盾）`);
    }

    // v2 严格面（version>=2 的 manifest 强制；v1 宽容迁移期）
    if (manifestVersion >= 2) {
        if (!Array.isArray(p.sourceOfTruth)) fail(`${at}: v2 必填 sourceOfTruth（数组，可空）`);
        else for (const d of p.sourceOfTruth) if (!DOMAIN.test(d)) fail(`${at}: sourceOfTruth 域 ${JSON.stringify(d)} 须为 domain.sub 格式`);
        if (!INGESTION.has(p.ingestion)) fail(`${at}: v2 必填 ingestion ∈ none|eventFile|windowEvent`);
        if (p.maturity === "stable" && typeof p.protocol === "string" && p.protocol.startsWith("window.") && !(typeof p.minProtocol === "string" && PROTOCOL_V.test(p.minProtocol))) fail(`${at}: stable 插件（window.* 协议）v2 必填 minProtocol（如 v5）；命令面插件=null`);
    }
    if (p.ingestion !== undefined && !INGESTION.has(p.ingestion)) fail(`${at}: ingestion ${JSON.stringify(p.ingestion)} 非法`);
    if (p.minProtocol !== undefined && p.minProtocol !== null && !(typeof p.minProtocol === "string" && PROTOCOL_V.test(p.minProtocol))) fail(`${at}: minProtocol 须为 v<N> 或 null`);
}

async function validateFile(path, expectSingleEntry) {
    console.log(`校验 ${path}`);
    let raw;
    try { raw = await readFile(path, "utf8"); } catch { console.error(`  ✗ 无法读取`); failures += 1; return; }
    let obj;
    try { obj = strip(JSON.parse(raw)); } catch (e) { fail(`JSON 解析失败：${e.message}`); return; }

    const isManifest = !expectSingleEntry && obj && typeof obj === "object" && Array.isArray(obj.plugins);
    const manifest = isManifest ? obj : { version: 2, plugins: [obj] };
    const v = manifest.version;
    if (!Number.isInteger(v) || v < 1) { fail(`顶层 version 须为 ≥1 整数`); return; }

    if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) { fail(`plugins 须为非空数组`); return; }
    const seen = new Set();
    for (const p of manifest.plugins) {
        if (p && typeof p === "object") {
            if (typeof p.pluginId === "string") {
                if (seen.has(p.pluginId)) fail(`pluginId 重复：${p.pluginId}`);
                seen.add(p.pluginId);
            }
            validatePlugin(p, isManifest ? "[manifest]" : "[单条目]", v);
        } else fail(`plugins[] 含非对象条目`);
    }
}

const argFile = (() => {
    const i = process.argv.indexOf("--file");
    return i > 0 ? process.argv[i + 1] : null;
})();

if (argFile) {
    await validateFile(resolve(process.cwd(), argFile), true);
} else {
    await validateFile(resolve(process.cwd(), TEMPLATE), true);
    let hasQuickgate = false;
    try { await access(QUICKGATE_MANIFEST); hasQuickgate = true; } catch { console.log(`（未找到 quickgate manifest，跳过：${QUICKGATE_MANIFEST}）`); }
    if (hasQuickgate) await validateFile(QUICKGATE_MANIFEST, false);
}

console.log(failures === 0 ? `✓ 全部通过（${new Date().toISOString()}）` : `✗ ${failures} 处失败`);
process.exit(failures === 0 ? 0 : 1);
