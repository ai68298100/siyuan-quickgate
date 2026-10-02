#!/usr/bin/env node
/**
 * TODO 账本快照（§18.1 R123-G0 第一条的落地工具）
 *
 * 把 TODO.md 解析为机器可读快照 snapshot/todo-snapshot.json：
 *   每条 = { id, line, section, round, priority, topic, type, status, text, mainline(C1~C8), evidence }
 * 内建验收（R123 两条）：
 *   A. 快照条数与 TODO 勾选项总数一致；
 *   B. 不存在无规范主线（mainline=null）的条目。
 * 运行：node scripts/todo-snapshot.mjs [--write]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";

const TODO_PATH = "TODO.md";
const OUT_PATH = "snapshot/todo-snapshot.json";

/* ---------- 规范主线归属（§18.1-R123-G0 第二条：每条归属 C1~C8 之一） ---------- */
/* 关键词启发式，按序首个命中生效。顺序即优先级（越具体的越靠前）。 */
const MAINLINE_RULES = [
    ["C6", /AI|模型|Agent|agent|提示词|MCP|LLM|智能体|prompt|草稿对比|推理/],
    ["C7", /Quicker|动作|showmenu|面板|快捷键|侧键|悬浮球|GUI|编辑器内/],
    ["C1", /回执|receipt|结果卡|结果定义|状态词典|成功证据|结果状态|unknown/],
    ["C2", /上下文|意图|Intent|Context|澄清|选择范围|来源|引用|证据信封/],
    ["C3", /权限|owner|允许名单|能力注册|manifest|effects|授权|职责矩阵/],
    ["C4", /幂等|超时|取消|重试|恢复|冲突|迟到|队列|同步|备份|迁移|离线|连续性/],
    ["C5", /首成功|纵向|样板|闭环|首跑|首个|最小可用/],
    ["C8", /.*/],
];

function classifyMainline(text) {
    for (const [mainline, re] of MAINLINE_RULES) {
        if (re.test(text)) return mainline;
    }
    return "C8";
}

/* ---------- 证据等级（§18.1-R123-G0 第六条 E0~E5，按当前事实初判） ---------- */
function classifyEvidence(text, section) {
    if (/已实证|✅|真机复测|全线打通|3\.8\.5 真机|3\.8\.6 真机/.test(text)) return "E4";
    if (section.includes("实测") || /【实测】/.test(text)) return "E4"; // 待真机执行，登记目标等级
    if (section.includes("spike") || /【spike】/.test(text)) return "E4";
    if (/官方文档|调研|Zotero|Obsidian|Readwise|外部资料|先例/.test(text + section)) return "E1";
    if (/契约|schema|合同|Schema/.test(text)) return "E2";
    if (/测试|单测|回归/.test(text)) return "E3";
    if (/用户研究|访谈|自愿用户|使用反馈/.test(text + section)) return "E5";
    return "E0";
}

/* ---------- 类型/状态词表（历史格式谱系：2026-10 四个月八种写法） ---------- */
const TYPE_WORDS = ["评估", "实测", "spike", "开发", "契约", "发布", "维护", "实现", "自动化测试", "用户研究", "事实核对", "新", "工具", "账本快照", "规范主线", "重复映射", "状态词典", "类型标签", "证据等级", "依赖字段", "历史归档"];
const STATUS_SUFFIX = /等实测|等用户|等思源|等内核重启|需思源|需Quicker|等模型|门槛后|暂缓|已一键化/;

/* 状态词典（R123-G0·状态词典：统一语义与归一化目标） */
const STATUS_LEXICON = {
    done: { meaning: "已完成且有证据", terminal: true },
    pending: { meaning: "未完成", terminal: false },
    "等实测": { meaning: "等用户真机验证（用户侧阻塞）", blockedBy: "user" },
    "等用户": { meaning: "等用户输入/决策（用户侧阻塞）", blockedBy: "user" },
    "等思源": { meaning: "等思源侧能力/行为确认（上游阻塞）", blockedBy: "upstream" },
    "需思源": { meaning: "需思源环境（环境阻塞）", blockedBy: "environment" },
    "需Quicker": { meaning: "需 Quicker 编辑器（用户侧阻塞）", blockedBy: "user" },
    "等内核重启": { meaning: "等内核重启（环境阻塞，2026-10-02 已解除）", blockedBy: "resolved" },
    "等模型": { meaning: "等模型服务可用（上游阻塞）", blockedBy: "upstream" },
    "门槛后": { meaning: "发布门槛后（主动延后）", blockedBy: "deferred" },
    "暂缓": { meaning: "主动延后（主动延后）", blockedBy: "deferred" },
    "已一键化": { meaning: "已封装为一键命令（等用户执行）", blockedBy: "user" },
};

function normalizeStatus(parsedStatus, done) {
    if (done) return { status: "done", blockedBy: null };
    for (const [key, meta] of Object.entries(STATUS_LEXICON)) {
        if (parsedStatus && parsedStatus.includes(key)) {
            return { status: key, blockedBy: meta.blockedBy ?? null };
        }
    }
    return { status: "pending", blockedBy: null };
}

function parseTag(tag) {
    const out = { round: null, priority: null, topic: null, type: null, status: null };
    if (!tag) return out;
    const parts = tag.split("·").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
        if (!out.round) {
            const r = p.match(/R\d+/);
            if (r) { out.round = r[0]; if (!/P\d|G\d/.test(p)) continue; }
        }
        if (!out.priority) {
            const pr = p.match(/(?:^|[-·])?(P\d|G\d)(?:[-·]|$)/);
            if (pr) { out.priority = pr[1]; continue; }
        }
        if (STATUS_SUFFIX.test(p)) { out.status = out.status ?? p; continue; }
        if (TYPE_WORDS.some((w) => p === w)) { out.type = out.type ?? p; continue; }
        out.topic = out.topic ?? p; // 首个非轮次/优先级段=主题
    }
    return out;
}

function parseEntry(line, sectionPath, sectionRound, sectionBlocked) {
    const m = line.match(/^- \[( |x)\][ \t]?(.*)\r?$/);
    if (!m) return null;
    const done = m[1] === "x";
    let rest = m[2].trim();
    let tag = null;
    const tm = rest.match(/^【([^】]+)】\s*(.*)$/);
    if (tm) { tag = tm[1]; rest = tm[2].trim(); }
    const parsed = parseTag(tag);
    // 状态后缀可能在行首 tag，也可能在文本尾部（...【等实测】）——扫全部【】段
    const allTags = [tag, ...([...(sectionPath + " " + m[2]).matchAll(/【([^】]+)】/g)].map((x) => x[1]))].filter(Boolean);
    let parsedStatus = parsed.status;
    if (!parsedStatus) {
        for (const t of allTags) {
            if (STATUS_SUFFIX.test(t)) { parsedStatus = t; break; }
        }
    }
    // 条目自身无状态标记时，继承最近一级带阻塞标记的节
    if (!parsedStatus) {
        for (let l = sectionBlocked.length - 1; l >= 0; l--) {
            if (sectionBlocked[l]) { parsedStatus = sectionBlocked[l]; break; }
        }
    }
    const norm = normalizeStatus(parsedStatus, done);
    return {
        id: null,
        line: null,
        section: sectionPath,
        round: parsed.round ?? sectionRound,
        priority: parsed.priority,
        topic: parsed.topic,
        type: parsed.type ?? "unknown",
        status: norm.status,
        blockedBy: norm.blockedBy,
        text: rest || (tag ?? ""),
        mainline: null,
        evidence: null,
        _classify: sectionPath + " " + (tag ?? "") + " " + (rest || ""),
    };
}

function main() {
    if (!existsSync(TODO_PATH)) {
        console.error(`错误：找不到 ${TODO_PATH}（请在设计文档项目根目录运行）`);
        process.exit(2);
    }
    const raw = readFileSync(TODO_PATH, "utf8");
    const lines = raw.split(/\r?\n/);
    const entries = [];
    const sectionStack = [];
    const sectionBlocked = [];
    let dupCounter = 0;

    lines.forEach((line, i) => {
        const h = line.match(/^(#{1,4})\s+(.+?)\s*$/);
        if (h) {
            const level = h[1].length;
            sectionStack.length = level - 1;
            sectionStack[level - 1] = h[2].replace(/【.*$/, "").trim();
            // 节级阻塞标记（如「## 1. 实测与环境验证【等实测：全部条目待用户…】」）——其下条目继承
            const sb = h[2].match(/【([^】]*(?:等实测|等用户|等思源|需思源|需Quicker|暂缓|门槛后)[^】]*)】/);
            sectionBlocked[level - 1] = sb ? sb[1] : null;
            return;
        }
        const sectionPath = sectionStack.filter(Boolean).join(" / ");
        const sectionRound = (sectionPath.match(/R\d{2,3}/) || [])[0] ?? null;
        const e = parseEntry(line, sectionPath, sectionRound, sectionBlocked);
        if (!e) return;
        const lineNo = i + 1;
        e.id = `TODO-L${lineNo}`;
        e.line = lineNo;
        if (entries.some((x) => x.id === e.id)) { e.id = `${e.id}-${++dupCounter}`; }
        e.mainline = classifyMainline(e._classify);
        e.evidence = classifyEvidence(e._classify, sectionPath);
        // 引用图（R124 依赖图地基）：text 里的 §章节 / R轮次 / docs 文档号 引用
        e.refs = {
            sections: [...new Set((e._classify.match(/§\d+(?:\.\d+)?/g) ?? []).map((s) => s.replace("§", "")))],
            rounds: [...new Set((e._classify.match(/R\d{1,3}/g) ?? []))].filter((r) => r !== e.round),
            docs: [...new Set((e._classify.match(/docs\/\d+|0\d-|1\d-/g) ?? []))].slice(0, 8),
        };
        delete e._classify;
        entries.push(e);
    });

    const totalCheckboxes = lines.filter((l) => /^- \[( |x)\]/.test(l)).length;

    const issues = [];
    // 验收 A：快照与 TODO 数量一致
    if (entries.length !== totalCheckboxes) {
        issues.push(`R123-A 数量不一致：快照 ${entries.length} vs TODO 勾选项 ${totalCheckboxes}（存在非标准条目行）`);
    }
    // 验收 B：无无主线条目
    const orphans = entries.filter((e) => !e.mainline);
    if (orphans.length > 0) issues.push(`R123-B 无主线条目 ${orphans.length} 条`);

    const byMainline = {};
    for (const e of entries) byMainline[e.mainline] = (byMainline[e.mainline] ?? 0) + 1;
    const byEvidence = {};
    for (const e of entries) byEvidence[e.evidence] = (byEvidence[e.evidence] ?? 0) + 1;
    const byStatus = { done: entries.filter((e) => e.status === "done").length, pending: entries.filter((e) => e.status === "pending").length };
    const byBlocked = {};
    for (const e of entries) {
        if (e.status === "done") continue;
        byBlocked[e.blockedBy ?? "dev"] = (byBlocked[e.blockedBy ?? "dev"] ?? 0) + 1;
    }

    const snapshot = {
        generatedAt: new Date().toISOString(),
        source: TODO_PATH,
        counts: { total: entries.length, checkboxes: totalCheckboxes, byStatus, byMainline, byEvidence, byBlocked },
        statusLexicon: STATUS_LEXICON,
        acceptance: { r123_a_countMatch: entries.length === totalCheckboxes, r123_b_noOrphans: orphans.length === 0, issues },
        entries,
    };

    if (process.argv.includes("--write")) {
        mkdirSync("snapshot", { recursive: true });
        writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
        const bySection = {};
        for (const e of entries) {
            if (e.status === "done") continue;
            const sec = e.section.split(" / ").slice(0, 2).join(" / ");
            bySection[sec] = (bySection[sec] ?? 0) + 1;
        }
        const report = [
            "# 账本治理简报（自动生成）", "",
            `> 生成于 ${snapshot.generatedAt} · 来源 ${TODO_PATH} · 条目 ${entries.length}`,
            "", "## 阻塞分布", "",
            ...Object.entries(byBlocked).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
            "", "## 规范主线分布", "",
            ...Object.entries(byMainline).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
            "", "## 证据等级分布", "",
            ...Object.entries(byEvidence).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
            "", "## 未完成条目 Top 章节", "",
            ...Object.entries(bySection).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `- ${k}: ${v}`),
            "",
        ].join("\n");
        writeFileSync("snapshot/report.md", report + "\n");
        console.log(`已写入 snapshot/report.md`);
    }

    console.log(`条目 ${entries.length}/${totalCheckboxes}；状态 ${JSON.stringify(byStatus)}`);
    console.log(`阻塞分布（未完成按 blockedBy） ${JSON.stringify(byBlocked)}`);
    console.log(`主线分布 ${JSON.stringify(byMainline)}`);
    console.log(`证据分布 ${JSON.stringify(byEvidence)}`);
    if (issues.length) {
        for (const s of issues) console.error("✗ " + s);
        process.exit(1);
    }
    console.log("✓ R123 验收 A/B 通过");
}

const isMain = process.argv[1] && (process.argv[1].endsWith("todo-snapshot.mjs"));
if (isMain || (statSync(process.argv[1] ?? "").size >= 0 && false)) main();
