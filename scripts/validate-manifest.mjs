#!/usr/bin/env node
/**
 * 生态清单校验门（C9 合同 §5 · TODO L595 R77-P1）——形状违规以非零退出阻断 check/CI。
 * 规则与设计仓库 scripts/validate-ecosystem-manifest.mjs 同源；本文件为发布门（单文件、manifest 模式）。
 * v1=迁移宽容（v2 专属字段缺失仅警告）；manifest 升 version>=2 时全部转强制（与升版同步生效）。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, "src/assets/ecosystem-manifests.json");

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
let warnings = 0;
const fail = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const warn = (msg) => { warnings += 1; console.warn(`  ⚠ ${msg}（v1 迁移期警告；version≥2 起为失败）`); };

const manifest = JSON.parse(await readFile(file, "utf8"));
console.log(`校验 ${file}`);
if (!Number.isInteger(manifest.version) || manifest.version < 1) fail("顶层 version 须为 ≥1 整数");
if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) fail("plugins 须为非空数组");

const v = Number.isInteger(manifest.version) ? manifest.version : 1;
const seen = new Set();
for (const p of Array.isArray(manifest.plugins) ? manifest.plugins : []) {
    const at = p && typeof p.pluginId === "string" ? p.pluginId : "(pluginId 缺失)";
    if (typeof p.pluginId !== "string" || !PLUGIN_ID.test(p.pluginId)) fail(`${at}: pluginId 须匹配 siyuan-* 小写连字符`);
    else if (seen.has(p.pluginId)) fail(`pluginId 重复：${p.pluginId}`);
    else seen.add(p.pluginId);
    if (!MATURITY.has(p.maturity)) fail(`${at}: maturity 须为 stable|design|unlocated`);
    if (p.version !== null && !(typeof p.version === "string" && SEMVER.test(p.version))) fail(`${at}: version 须为 semver 或 null`);
    if (!Array.isArray(p.capabilities)) fail(`${at}: capabilities 须为数组`);
    if (typeof p.hubIntegration !== "string") fail(`${at}: hubIntegration 须为字符串`);
    if (p.minProtocol !== undefined && p.minProtocol !== null && !(typeof p.minProtocol === "string" && PROTOCOL_V.test(p.minProtocol))) fail(`${at}: minProtocol 须为 v<N> 或 null`);
    if (p.ingestion !== undefined && !INGESTION.has(p.ingestion)) fail(`${at}: ingestion ${JSON.stringify(p.ingestion)} 非法`);

    if (Array.isArray(p.events) && p.events.length > 0) {
        if (typeof p.eventNamespace !== "string" || !NS.test(p.eventNamespace)) {
            (v >= 2 ? fail : warn)(`${at}: 有 events 必填 eventNamespace（小写短名）`);
        } else {
            for (const ev of p.events) {
                if (typeof ev.name !== "string" || !EVENT_NAME.test(ev.name)) { fail(`${at}: 事件名 ${JSON.stringify(ev.name)} 须为 <ns>:<kebab-verb>`); continue; }
                if (!ev.name.startsWith(`${p.eventNamespace}:`)) fail(`${at}: 事件 ${ev.name} 前缀 ≠ eventNamespace:${p.eventNamespace}`);
                if (!EVENT_STATUS.has(ev.status)) fail(`${at}: 事件 ${ev.name} status 须为 available|observed|design`);
                if (typeof ev.idempotency !== "string" || !ev.idempotency.trim()) fail(`${at}: 事件 ${ev.name} 缺 idempotency`);
                if (ev.status === "available" && (typeof ev.payload !== "object" || ev.payload === null)) fail(`${at}: available 事件 ${ev.name} 缺 payload 形状`);
            }
        }
        if (p.maturity === "stable" && p.ingestion === "none") fail(`${at}: stable 插件有 events 但 ingestion=none（载体矛盾）`);
    }

    if (v >= 2) {
        if (!Array.isArray(p.sourceOfTruth)) fail(`${at}: v2 必填 sourceOfTruth（数组，可空）`);
        else for (const d of p.sourceOfTruth) if (!DOMAIN.test(d)) fail(`${at}: sourceOfTruth 域 ${JSON.stringify(d)} 须为 domain.sub 格式`);
        if (!INGESTION.has(p.ingestion)) fail(`${at}: v2 必填 ingestion ∈ none|eventFile|windowEvent`);
        if (p.maturity === "stable" && typeof p.protocol === "string" && p.protocol.startsWith("window.") && !(typeof p.minProtocol === "string" && PROTOCOL_V.test(p.minProtocol))) fail(`${at}: stable 插件（window.* 协议）v2 必填 minProtocol（如 v5）；命令面插件=null`);
    }
}

if (warnings > 0) console.warn(`⚠ ${warnings} 条迁移期警告`);
console.log(failures === 0 ? `✓ manifest 校验通过（v${v}）` : `✗ ${failures} 处失败——阻止发布（契约校验门）`);
process.exit(failures === 0 ? 0 : 1);
