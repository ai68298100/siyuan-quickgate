/**
 * 命令面板（G3-01 MVP · R293，交互范式依据 design/docs/10-生态调研-R6.md）：
 * 单输入框 + 实时过滤 + 键盘导航 + 收藏/最近置顶 + 空结果 fallback 兜底。
 * 数据面：registry 探针（宿主命令 callback 可直接执行）+ 收藏/最近载体（L472/L474）；
 * 执行语义与桥完全一致：runCommand → confirmExec 确认门控 → 审计（auditWriteOp 在 dispatch 层）。
 * 纯逻辑（buildPaletteEntries）独立导出供单测；UI 只消费。
 */
import { expandSearchKeyword } from "./services/search-alias";
import { normalizeFavorites } from "./services/favorites";
import { runCommand, RegistryProbeResult } from "./services/registry";
import { installFocusTrap } from "./services/focus-trap";
import { argMatchesType, getArgsSpec, opDescription, opWriteAnnotation } from "./mcp/tools";
import { openQuickCapture } from "./quick-capture-ui";
import type { CapturePlan, CaptureResult, CaptureTarget } from "./services/quick-capture";
import type { OpPreflight } from "./services/op-preflight";
import type { Dialog, showMessage } from "siyuan";
import type { KernelApi } from "./services/kernelApi";
import type { QuickGateSettings, AuditEntry } from "./types/bridge";

export interface PaletteHost {
    settings: QuickGateSettings;
    pluginName: string;
    kernelApi: KernelApi;
    /** 宿主注入的思源 UI（siyuan 包不可在裸 Node 单测环境导入，故经宿主传入） */
    ui: { Dialog: typeof Dialog; showMessage: typeof showMessage };
    /** registry 探针（含各命令 callback，可直接执行） */
    registry(): RegistryProbeResult;
    confirm(title: string): Promise<boolean>;
    audit(entry: AuditEntry): void;
    /** fallback 兜底动作 */
    openSettingPanel(page?: string): void;
    /** 再记一条：从捕获成功卡重开面板（清空输入即录即走） */
    openCommandPalette(): void;
    copyDiagnostics(): Promise<void>;
    /** 快速捕获（G3-04 + R7 结论②）：目标二选一（daily=今日日记 HH:mm 前缀 / inbox=收集箱纯文本） */
    prepareCapture(text: string, target: CaptureTarget): Promise<{ plan?: CapturePlan; message?: string }>;
    captureQuick(plan: CapturePlan): Promise<CaptureResult>;
    /** 上次成功捕获去向；选择与预检均不回写。 */
    lastCaptureTarget(): "daily" | "inbox";
    rememberCaptureTarget(target: "daily" | "inbox"): void;
    /** 打开文档/块（原文操作） */
    openDoc(id: string): Promise<void>;
    /** 桥是否在运行（能力动作分组门控） */
    bridgeAlive(): boolean;
    preflightOp(op: string, args: Record<string, unknown>): Promise<OpPreflight>;
    /** 前端直派桥 op（R6-A 二段式执行；走完整簿记：确认门控/审计/幂等台账/回执） */
    dispatchOp(op: string, args: Record<string, unknown>): Promise<{ status: string; message: string; data: unknown }>;
}

export interface PaletteEntry {
    plugin: string;
    pluginDisplayName: string;
    id: string;
    title: string;
    accelerator?: string;
    favorite?: boolean;
    recent?: boolean;
    recentAt?: string;
}

/** 命令面板键盘导航只覆盖实际渲染的条目（默认最多 100 条）。 */
export function paletteNavMaxIndex(commandCount: number, capabilityCount: number, renderLimit = 100, fallbackCount = 0): number {
    const commands = Math.min(Math.max(0, Math.trunc(commandCount)), Math.max(0, Math.trunc(renderLimit)));
    const capabilities = Math.max(0, Math.trunc(capabilityCount));
    const fallbacks = Math.max(0, Math.trunc(fallbackCount));
    return Math.max(0, commands + capabilities + fallbacks - 1);
}

/** 将过期活动索引收敛到当前可导航范围，空结果固定回到 0。 */
export function clampPaletteActiveIndex(active: number, commandCount: number, capabilityCount: number, renderLimit = 100, fallbackCount = 0): number {
    const safeActive = Number.isFinite(active) ? Math.trunc(active) : 0;
    return Math.max(0, Math.min(safeActive, paletteNavMaxIndex(commandCount, capabilityCount, renderLimit, fallbackCount)));
}

/**
 * 将活动索引映射到实际渲染的命令、能力动作或空态 fallback。
 * 命令列表可能超过渲染上限；偏移必须使用可见命令数，而不是过滤结果总数。
 */
export function paletteActionIndex(active: number, visibleCommandCount: number, capabilityCount: number):
    { kind: "command"; index: number } | { kind: "capability"; index: number } | { kind: "fallback"; index: number } {
    const commandCount = Math.max(0, Math.trunc(visibleCommandCount));
    const capabilities = Math.max(0, Math.trunc(capabilityCount));
    const safeActive = Number.isFinite(active) ? Math.trunc(active) : 0;
    if (safeActive < commandCount) return { kind: "command", index: Math.max(0, safeActive) };
    const afterCommands = safeActive - commandCount;
    if (afterCommands < capabilities) return { kind: "capability", index: Math.max(0, afterCommands) };
    return { kind: "fallback", index: Math.max(0, afterCommands - capabilities) };
}

/**
 * 面板条目合成（纯函数）：收藏置顶（按收藏顺序）→ 最近使用（新→旧）→ 其余按注册表序；
 * 过滤：query 经别名展开（中英/拼音）对 title/id/plugin 任一命中；空 query 不过滤。
 * 同一命令既是收藏又是最近 → 只出现一次（以收藏位为准，保留两枚标记）。
 */
export function buildPaletteEntries(
    all: PaletteEntry[],
    favorites: Array<{ plugin: string; command: string }>,
    recent: Array<{ plugin: string; command: string; at: string }>,
    query: string,
): PaletteEntry[] {
    const favKeys = favorites.map((f) => `${f.plugin}/${f.command}`);
    const recentMap = new Map(recent.map((r) => [`${r.plugin}/${r.command}`, r.at]));
    const byKey = new Map(all.map((e) => [`${e.plugin}/${e.id}`, { ...e }]));
    const kws = query.trim() ? expandSearchKeyword(query.trim()) : null;
    const match = (e: PaletteEntry) =>
        !kws || kws.some((k) => e.title.toLowerCase().includes(k) || e.id.toLowerCase().includes(k) || e.plugin.toLowerCase().includes(k));
    const out: PaletteEntry[] = [];
    for (const key of favKeys) {
        const e = byKey.get(key);
        if (e && match(e)) out.push({ ...e, favorite: true, recent: recentMap.has(key), recentAt: recentMap.get(key) });
    }
    const seen = new Set(out.map((e) => `${e.plugin}/${e.id}`));
    const recentSorted = [...recent].sort((a, b) => (a.at < b.at ? 1 : -1));
    for (const r of recentSorted) {
        const key = `${r.plugin}/${r.command}`;
        const e = byKey.get(key);
        if (e && !seen.has(key) && match(e)) {
            out.push({ ...e, recent: true, recentAt: r.at });
            seen.add(key);
        }
    }
    for (const e of all) {
        const key = `${e.plugin}/${e.id}`;
        if (!seen.has(key) && match(e)) out.push(e);
    }
    return out;
}

const esc = (t: unknown) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** 匹配高亮（Raycast/Alfred 范式）：首个命中的关键词片段主题色加粗——DOM 分段构建免注入；
 *  最长关键词优先，避免短词遮住长词命中。title 与副标题（op/插件名）共用，让英文搜索词
 *  （只命中 op/插件名，不命中中文标题）也能看出匹配原因。 */
function fillHighlighted(el: HTMLElement, text: string, highlight?: string[]): void {
    const kws = (highlight ?? []).filter((k) => k).sort((a, b) => b.length - a.length);
    const lower = text.toLowerCase();
    const hitKw = kws.find((k) => lower.includes(k));
    if (!hitKw) { el.textContent = text; return; }
    const idx = lower.indexOf(hitKw);
    if (idx > 0) el.appendChild(document.createTextNode(text.slice(0, idx)));
    const hit = document.createElement("span");
    hit.className = "qg-palette-hit";
    hit.textContent = text.slice(idx, idx + hitKw.length);
    el.appendChild(hit);
    el.appendChild(document.createTextNode(text.slice(idx + hitKw.length)));
}

/** 能力动作目录（R6-A 二段式）：精选的桥 op（schema 由 mcp/tools ARGS 表驱动） */
export const CAPABILITY_OPS: ReadonlyArray<{ op: string; label: string }> = [
    { op: "checkin.record", label: "打卡记录" },
    { op: "checkin.summary", label: "打卡概览" },
    { op: "checkin.items", label: "打卡项目清单" },
    { op: "contacts.search", label: "人脉搜索" },
    { op: "contacts.ensure", label: "确保人脉存在" },
    { op: "contacts.interaction", label: "记录人脉互动" },
    { op: "glean.list", label: "拾遗读库检索" },
    { op: "glean.get", label: "拾遗读取文章" },
    { op: "glean.status", label: "拾遗改读库状态" },
    { op: "home.summary", label: "管家提醒概览" },
    { op: "home.memo", label: "管家快速备忘" },
    { op: "home.open", label: "打开管家/提醒中枢" },
    { op: "exam.stats", label: "考试学习统计" },
    { op: "exam.open", label: "打开考试练习台" },
    { op: "common.search", label: "常用条目检索" },
    { op: "common.get", label: "常用读取条目" },
    { op: "common.recent", label: "常用最近使用" },
    { op: "common.favorites", label: "常用收藏清单" },
    { op: "daily.status", label: "今日日记状态" },
    { op: "doc.open", label: "打开文档" },
    { op: "template.new", label: "从模板建文档" },
];

export interface PaletteFormField { key: string; type: string; description: string; required: boolean }

/** schema → 表单字段（R6-A：schema 驱动渲染；required 穿透；未登记 op 无字段=直接执行） */
export function formFieldsFor(op: string): PaletteFormField[] {
    const spec = getArgsSpec(op);
    if (!spec) return [];
    const required = new Set(spec.required ?? []);
    return Object.entries(spec.properties).map(([key, m]) => ({
        key, type: m.type, description: m.description, required: required.has(key),
    }));
}

/** 表单值 → op args（类型收敛；required 缺失/转换失败报错，取消无副作用） */
export function buildArgs(fields: PaletteFormField[], values: Record<string, string | boolean>): { args?: Record<string, unknown>; error?: string } {
    const args: Record<string, unknown> = {};
    for (const f of fields) {
        const raw = values[f.key];
        const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
        if (empty) {
            if (f.required) return { error: `缺少必填参数：${f.key}` };
            continue;
        }
        if (f.type === "number") {
            const n = Number(raw);
            if (!Number.isFinite(n)) return { error: `参数 ${f.key} 须为数字` };
            args[f.key] = n;
        } else if (f.type === "boolean") {
            if (raw !== true && raw !== false && raw !== "true" && raw !== "false") return { error: `参数 ${f.key} 须为布尔值` };
            args[f.key] = raw === true || raw === "true";
        } else if (f.type === "array" || f.type === "object") {
            try { args[f.key] = JSON.parse(String(raw)); } catch { return { error: `参数 ${f.key} 须为合法 JSON` }; }
        } else {
            args[f.key] = raw;
        }
        if (!argMatchesType(args[f.key], f.type)) return { error: `参数 ${f.key} 类型应为 ${f.type}` };
    }
    return { args };
}

/** 显式复制当前表单；只包含 schema 字段，不读取设置、Token 或环境变量，不执行请求。 */
export function buildInvocationExamples(op: string, values: Record<string, string | boolean>, now = Date.now(), id?: string) {
    if (!getArgsSpec(op)) return { error: `未登记参数契约：${op}` };
    const result = buildArgs(formFieldsFor(op), values);
    if (result.error) return { error: result.error };
    const args = result.args ?? {};
    return {
        envelope: { v: 1, id: id ?? `copy-${crypto.randomUUID()}`, op, args, createdAt: new Date(now).toISOString(), ttlMs: 60_000, reply: true },
        mcp: { name: op, arguments: args },
    };
}

/** 渲染与键盘导航使用同一空态动作清单，避免增加入口后索引漂移。 */
export function paletteFallbacks(query: string): ReadonlyArray<readonly [string, string]> {
    const q = query.trim();
    const next: Array<readonly [string, string]> = [
        ["plugins", "检查插件状态"],
        ["panel", "打开快门设置（健康页）"],
        ["diag", "复制诊断包"],
        ["guide", "上手指南"],
    ];
    if (q) next.unshift(["capture", `捕获「${q.slice(0, 24)}${q.length > 24 ? "…" : ""}」`]);
    return next;
}

export async function openCommandPalette(host: PaletteHost): Promise<void> {
    const { Dialog, showMessage } = host.ui;
    let probe = host.registry();
    const favPath = `/storage/petal/${host.pluginName}/favorites.json`;
    let favorites: Array<{ plugin: string; command: string }> = [];
    let recent: Array<{ plugin: string; command: string; at: string }> = [];
    try {
        const raw = await host.kernelApi.getFileText(favPath);
        const f = normalizeFavorites(raw ? JSON.parse(raw) : null);
        favorites = f.favorites.map((x) => ({ plugin: x.plugin, command: x.command }));
        recent = f.recent.map((x) => ({ plugin: x.plugin, command: x.command, at: x.at }));
    } catch { /* 载体缺失按空处理（真异常由 L652 分类器抛出，不会静默走这里） */ }

    const collect = (p: RegistryProbeResult): PaletteEntry[] =>
        p.plugins.flatMap((pl) => pl.commands.map((c) => ({
            plugin: pl.name,
            pluginDisplayName: pl.displayName,
            id: c.id,
            title: c.title,
            accelerator: c.accelerator,
        })));
    let all = collect(probe);

    // 焦点回归（L585 部分）：面板销毁后焦点回到触发元素
    const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let closed = false;
    let formGeneration = 0;
    let formBusy = false;
    const dialog = new Dialog({
        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>命令面板</span><span class="qg-title-ver">↑↓ 选择 · Enter 执行 · Esc 关闭</span></span>`,
        content: `<div id="qg-palette"><input class="b3-text-field" data-role="q" role="combobox" aria-label="搜索命令" aria-controls="qg-palette-list" aria-expanded="true" aria-haspopup="listbox" aria-autocomplete="list" placeholder="搜索命令（中英/拼音别名；收藏与最近自动置顶）" /><div id="qg-palette-list" data-role="list" role="listbox" aria-label="命令结果"></div><div class="qg-palette-foot" data-role="foot"></div></div>`,
        width: "min(620px, 92vw)",
        height: "auto",
        destroyCallback: () => { closed = true; formGeneration++; try { focusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
    });
    const root = dialog.element.querySelector("#qg-palette") as HTMLElement;
    installFocusTrap(dialog.element); // L585 部分：Tab 在对话框内循环
    const input = root.querySelector("[data-role=q]") as HTMLInputElement;
    const list = root.querySelector("[data-role=list]") as HTMLElement;
    const foot = root.querySelector("[data-role=foot]") as HTMLElement;
    // 上下文键位提示条（Raycast ActionPanel 范式）：随阶段联动；键帽用 kbd 语义——
    // 同时让 ☆ 收藏 / {} 复制信封这类悬停才显形的动作有恒定可发现的入口提示（内容为固定模板）
    const setFoot = (pairs: ReadonlyArray<readonly [string, string]>) => {
        const html = pairs.map(([k, label]) => `<span class="qg-foot-pair"><span class="qg-palette-kbd">${k}</span>${esc(label)}</span>`).join(`<span class="qg-foot-sep">·</span>`);
        if (foot.dataset.h !== html) {
            foot.innerHTML = html;
            foot.dataset.h = html;
        }
    };
    let entries: PaletteEntry[] = [];
    let active = 0;
    /** R6-A 二段式：list=搜索列表；form=能力动作参数面板（取消无副作用） */
    let stage: "list" | "form" = "list";
    let formOp = "";

    /** 表单/列表两态的搜索框语义：参数阶段只读降透明——输入无效，明示「返回后再搜」 */
    const setStageInput = (formStage: boolean) => {
        const ph = formStage ? "参数阶段——点「返回」后可重新搜索" : "搜索命令（中英/拼音别名；收藏与最近自动置顶）";
        if (input.readOnly !== formStage) input.readOnly = formStage;
        if (input.placeholder !== ph) input.placeholder = ph;
        input.classList.toggle("qg-stage-dim", formStage);
    };

    let renderDebounce = 0;
    const RENDER_LIMIT = 100; // L600 部分：渲染截断——千条命令下每键全量重建 DOM 会卡，先出前 100 条保顺序稳定
    let visibleEntries: PaletteEntry[] = []; // 截断后实际渲染的切片（键盘/点击索引统一用它）

    const render = () => {
        if (stage === "form") { renderForm(); return; }
        setStageInput(false);
        entries = buildPaletteEntries(all, favorites, recent, input.value);
        // 能力动作（R6-A）：桥运行时附加精选 op 分组（label/op 同入过滤）
        const kws = input.value.trim() ? expandSearchKeyword(input.value.trim()) : null;
        const caps = host.bridgeAlive()
            ? CAPABILITY_OPS.filter((c) => !kws || kws.some((k) => c.label.toLowerCase().includes(k) || c.op.toLowerCase().includes(k)))
            : [];
        // 只允许导航到实际渲染的条目；超出 100 条时后续条目不会被隐藏的活动索引选中。
        // 空态 fallback 也必须纳入键盘导航，否则无匹配时只能用鼠标点击下一步。
        const fallbackCount = entries.length === 0 && caps.length === 0 ? paletteFallbacks(input.value).length : 0;
        active = clampPaletteActiveIndex(active, entries.length, caps.length, RENDER_LIMIT, fallbackCount);
        if (entries.length === 0 && caps.length === 0) {
            setFoot([["↑↓", "选择"], ["↵", "执行选中动作"], ["Esc", "关闭"]]);
            // R6-B fallback 兜底：无匹配时给可用的下一步，不做死面板；
            // 有输入文本时首位=快速捕获（G3-04：一句话进今日日记）
            const q = input.value.trim();
            // 清空上一次结果，避免搜索无匹配后按 Enter 误执行旧条目。
            visibleEntries = [];
            input.removeAttribute("aria-activedescendant");
            list.textContent = "";
            const empty = document.createElement("div");
            empty.className = "qg-palette-empty";
            empty.setAttribute("role", "presentation");
            empty.textContent = q ? `无匹配命令「${q}」` : "无可用命令";
            list.appendChild(empty);
            const fallbacks = document.createElement("div");
            fallbacks.className = "qg-palette-fallbacks";
            fallbacks.setAttribute("role", "group");
            fallbacks.setAttribute("aria-label", "下一步操作");
            const fallbackDefs = paletteFallbacks(q);
            for (const [i, [fb, label]] of fallbackDefs.entries()) {
                const b = document.createElement("button");
                b.className = `b3-button ${fb === "capture" ? "b3-button--primary" : "b3-button--outline"}` + (i === active ? " active" : "");
                b.dataset.fb = fb;
                b.dataset.fbIndex = String(i);
                // 空态按钮也是 combobox 的可选项：保持 aria-activedescendant 与键盘索引一致，
                // 让读屏用户能知道 ↑↓ 当前选中的下一步动作。
                b.id = `qg-palette-option-fallback-${i}`;
                b.setAttribute("role", "option");
                b.setAttribute("aria-selected", String(i === active));
                b.textContent = label;
                fallbacks.appendChild(b);
            }
            list.appendChild(fallbacks);
            const activeFallback = list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
            if (activeFallback) input.setAttribute("aria-activedescendant", activeFallback.id);
            return;
        }
        // 列表用 DOM API 构建（textContent 免转义，杜绝注入面）
        list.textContent = "";
        const mkItem = (opts: { mark?: string; title: string; sub?: string; kbd?: string; kbdFirst?: boolean; isActive: boolean; id: string; attrs?: Record<string, string>; highlight?: string[] }) => {
            const div = document.createElement("div");
            div.className = "qg-palette-item" + (opts.isActive ? " active" : "");
            div.id = opts.id;
            div.setAttribute("role", "option");
            div.setAttribute("aria-selected", String(opts.isActive));
            for (const [k, v] of Object.entries(opts.attrs ?? {})) div.dataset[k] = v;
            if (opts.mark) {
                const m = document.createElement("span");
                m.className = "qg-palette-mark";
                m.textContent = opts.mark;
                div.appendChild(m);
            }
            const t = document.createElement("span");
            t.className = "qg-palette-title";
            fillHighlighted(t, opts.title, opts.highlight);
            t.title = opts.title; // 截断时的原生 tooltip（Raycast subtitle tooltip 同款）
            div.appendChild(t);
            // 原型行语言：宿主命令行 [快捷键] 在插件名副前（kbdFirst）；能力动作行 op 副标题在「参数」键前
            const mkKbd = () => {
                const k = document.createElement("kbd");
                k.className = "qg-palette-kbd";
                k.textContent = opts.kbd ?? "";
                return k;
            };
            const mkSub = () => {
                const s = document.createElement("span");
                s.className = "qg-palette-sub";
                fillHighlighted(s, opts.sub ?? "", opts.highlight); // 副标题同样高亮：英文词只命中 op/插件名时可见匹配原因
                s.title = opts.sub ?? ""; // 截断时的原生 tooltip
                return s;
            };
            if (opts.kbdFirst && opts.kbd && opts.sub) div.append(mkKbd(), mkSub());
            else {
                if (opts.sub) div.append(mkSub());
                if (opts.kbd) div.append(mkKbd());
            }
            return div;
        };
        // L600 部分：渲染截断（先出前 100 条，顺序稳定；超出部分提示继续输入缩小范围）
        const visible = entries.length > RENDER_LIMIT ? entries.slice(0, RENDER_LIMIT) : entries;
        visibleEntries = visible;
        visible.forEach((e, i) => {
            const item = mkItem({
                // mark 全用单色文本字形（★/↺）——彩色 emoji（🕐）在 Windows 上视觉重量突兀
                mark: e.favorite ? "★" : e.recent ? "↺" : undefined,
                title: e.title, sub: e.pluginDisplayName, kbd: e.accelerator, kbdFirst: true,
                highlight: kws ?? undefined,
                isActive: i === active, id: `qg-palette-option-command-${i}`, attrs: { i: String(i) },
            });
            // L552 部分：复制命令信封（宿主命令 → commands.run 信封；粘贴到 lv-cli send / Quicker 即发）
            const copyEnv = document.createElement("button");
            copyEnv.className = "qg-palette-copy";
            copyEnv.title = "复制命令信封 JSON（commands.run，可粘贴到 lv-cli / Quicker 发命令）";
            copyEnv.setAttribute("aria-label", `复制 ${e.title} 的命令信封`);
            copyEnv.textContent = "{}";
            copyEnv.onclick = (ev) => {
                ev.stopPropagation();
                const envelope = {
                    v: 1,
                    id: `ui-${Date.now()}-${Math.floor(Math.random() * 65536).toString(16)}`,
                    op: "commands.run",
                    args: { plugin: e.plugin, command: e.id },
                    createdAt: new Date().toISOString(),
                };
                void navigator.clipboard.writeText(JSON.stringify(envelope)).then(() => showMessage("命令信封已复制（commands.run，id 由桥记账）", 2200, "info"));
            };
            item.appendChild(copyEnv);
            // ★ 收藏切换（R311）：按钮独立于整行执行热区
            const star = document.createElement("button");
            star.className = "qg-palette-star";
            star.dataset.star = "";
            star.dataset.plugin = e.plugin;
            star.dataset.command = e.id;
            star.dataset.title = e.title;
            star.textContent = e.favorite ? "★" : "☆";
            star.setAttribute("aria-label", e.favorite ? "取消收藏" : "收藏");
            item.appendChild(star);
            list.appendChild(item);
        });
        if (entries.length > RENDER_LIMIT) {
            const more = document.createElement("div");
            more.className = "qg-palette-empty";
            more.textContent = `共 ${entries.length} 条匹配，已显示前 ${RENDER_LIMIT} 条——继续输入缩小范围。`;
            list.appendChild(more);
        }
        if (caps.length > 0) {
            const head = document.createElement("div");
            head.className = "qg-palette-group";
            head.textContent = "能力动作（快门桥）";
            list.appendChild(head);
            caps.forEach((c, j) => {
                const capItem = mkItem({
                    mark: " ", title: c.label, sub: c.op, kbd: "参数",
                    highlight: kws ?? undefined,
                    isActive: cmdCount() + j === active, id: `qg-palette-option-cap-${j}`, attrs: { cap: c.op },
                });
                // L552 部分：能力动作的信封即自身 op（args 由「参数」表单填写）
                const copyEnv = document.createElement("button");
                copyEnv.className = "qg-palette-copy";
                copyEnv.title = "复制命令信封 JSON（可粘贴到 lv-cli / Quicker 后补 args）";
                copyEnv.setAttribute("aria-label", `复制 ${c.label} 的命令信封`);
                copyEnv.textContent = "{}";
                copyEnv.onclick = (ev) => {
                    ev.stopPropagation();
                    const envelope = {
                        v: 1,
                        id: `ui-${Date.now()}-${Math.floor(Math.random() * 65536).toString(16)}`,
                        op: c.op,
                        args: {},
                        createdAt: new Date().toISOString(),
                    };
                    void navigator.clipboard.writeText(JSON.stringify(envelope)).then(() => showMessage(`命令信封已复制（${c.op}，args 待填）`, 2200, "info"));
                };
                capItem.appendChild(copyEnv);
                list.appendChild(capItem);
            });
        }
        const activeOption = list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
        if (activeOption) input.setAttribute("aria-activedescendant", activeOption.id);
        else input.removeAttribute("aria-activedescendant");
        // 上下文提示（Raycast ActionPanel 同款）：随列表内容切换——有能力动作时提示「参数」阶段
        if (caps.length > 0) setFoot([["↑↓", "选择"], ["↵", "执行"], ["参数", "填参数后执行"], ["Esc", "关闭"]]);
        else setFoot([["↑↓", "选择"], ["↵", "执行"], ["☆", "收藏"], ["{}", "复制信封"], ["Esc", "关闭"]]);
        list.querySelector(".qg-palette-item.active")?.scrollIntoView({ block: "nearest" });
    };
    const cmdCount = () => entries.length;

    /** R6-A 二段式参数面板：schema 驱动字段渲染，取消/返回无副作用 */
    const renderForm = () => {
        formGeneration++;
        formBusy = false;
        setStageInput(true);
        setFoot([["↵", "执行"], ["Tab", "切换字段"], ["Esc", "关闭"]]);
        input.removeAttribute("aria-activedescendant");
        const fields = formFieldsFor(formOp);
        const label = CAPABILITY_OPS.find((c) => c.op === formOp)?.label ?? formOp;
        const fieldHtml = fields.map((f) => {
            const req = f.required ? ` <span style="color:var(--qg-error-text)">*</span>` : "";
            const fid = `qg-f-${esc(f.key)}`;
            const ctl = f.type === "boolean"
                ? `<input class="b3-switch" type="checkbox" id="${fid}" data-f="${esc(f.key)}" />`
                : f.type === "array" || f.type === "object"
                    ? `<textarea class="b3-text-field qg-form-field" id="${fid}" data-f="${esc(f.key)}" rows="2" placeholder='${f.type === "array" ? 'JSON 数组，如 ["a","b"]' : 'JSON 对象，如 {"key":"value"}'}'></textarea>`
                    : `<input class="b3-text-field qg-form-field" id="${fid}" data-f="${esc(f.key)}" type="${f.type === "number" ? "number" : "text"}" />`;
            // label 与控件 for/id 关联：点标签即聚焦字段（读屏同读）
            return `<div class="qg-form-item"><label class="qg-form-label" for="${fid}">${esc(f.key)}${req}</label>` +
                `<div class="qg-form-desc">${esc(f.description)}</div>${ctl}</div>`;
        }).join("");
        list.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:2px">${esc(label)} <span style="font-weight:400;color:var(--b3-theme-on-surface);font-size:11px">— 填写参数后执行</span></div>` +
            // L552 再部分：op 一句话说明（与 MCP 工具描述同源）
            `<div style="font-size:11px;color:var(--b3-theme-on-surface);margin-bottom:8px;line-height:1.6">${esc(opDescription(formOp))}</div>` +
            // L552 部分：副作用标注（口径与 MCP annotations 同源）——destructive 红框、写操作琥珀提示
            (() => {
                const ann = opWriteAnnotation(formOp);
                if (ann.destructive) {
                    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 10px;margin-bottom:10px;border:1px solid color-mix(in srgb, var(--b3-theme-error) 35%, transparent);border-radius:6px;background:color-mix(in srgb, var(--b3-theme-error) 6%, transparent);font-size:12px;line-height:1.6">` +
                        `<span class="qg-chip err" style="flex:none;margin-top:1px">写入</span>` +
                        `<span>此动作会<b>写入或修改数据</b>——执行前请核对参数；确认门控仍会在派发层拦截。</span></div>`;
                }
                if (ann.write) {
                    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 10px;margin-bottom:10px;border:1px solid color-mix(in srgb, var(--b3-theme-warning, var(--b3-theme-secondary)) 30%, transparent);border-radius:6px;background:color-mix(in srgb, var(--b3-theme-warning, var(--b3-theme-secondary)) 7%, transparent);font-size:12px;line-height:1.6">` +
                        `<span class="qg-chip warn" style="flex:none;margin-top:1px">写入</span>` +
                        `<span>此动作会写入数据（打卡 / 人脉 / 收藏 / 文档）；确认门控仍会在派发层拦截。</span></div>`;
                }
                return "";
            })() +
            (fieldHtml || `<div style="color:var(--b3-theme-on-surface);font-size:12px;margin-bottom:8px">该动作无参数。</div>`) +
            `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">` +
            `<button class="b3-button b3-button--outline" data-form="back">返回</button>` +
            `<button class="b3-button b3-button--outline" data-form="preflight">检查调用条件</button>` +
            `<button class="b3-button b3-button--primary" data-form="exec">执行</button>` +
            `<button class="b3-button b3-button--outline" data-form="copy-envelope">复制命令信封</button>` +
            `<button class="b3-button b3-button--outline" data-form="copy-mcp">复制 MCP 参数</button></div>` +
            `<div data-form="preflight-result" role="status" aria-live="polite" style="margin-top:8px;font-size:12px"></div>` +
            `<div data-form="msg" role="status" aria-live="polite" style="margin-top:8px;font-size:12px"></div>`;
        list.scrollTop = 0; // 从列表切表单时清除残留滚动，标题不被裁
        list.querySelector('[data-form="back"]')?.addEventListener("click", () => { formGeneration++; stage = "list"; render(); });
        list.querySelector('[data-form="preflight"]')?.addEventListener("click", () => void runForm(false));
        list.querySelector('[data-form="exec"]')?.addEventListener("click", () => void execForm());
        list.querySelector('[data-form="copy-envelope"]')?.addEventListener("click", () => void copyForm("envelope"));
        list.querySelector('[data-form="copy-mcp"]')?.addEventListener("click", () => void copyForm("mcp"));
        list.querySelectorAll('[data-f]').forEach((field) => field.addEventListener("input", () => {
            const result = list.querySelector('[data-form="preflight-result"]');
            if (result) result.textContent = "参数已变更；执行前会重新检查。";
        }));
        // 文本字段内 Enter 直执行（textarea 保留换行语义）；组字中的 Enter 属输入法确认，不执行
        list.querySelectorAll('input[data-f]').forEach((inp) => {
            inp.addEventListener("keydown", ((ev: KeyboardEvent) => {
                if (ev.isComposing || ev.keyCode === 229) return;
                if (ev.key === "Enter") { ev.preventDefault(); void execForm(); }
            }) as EventListener);
        });
    };

    const formValues = () => {
        const fields = formFieldsFor(formOp);
        const values: Record<string, string | boolean> = {};
        for (const f of fields) {
            const el = list.querySelector(`[data-f="${f.key}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
            values[f.key] = el ? (el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el.value) : "";
        }
        return values;
    };
    const formError = (error?: string) => {
        const msg = list.querySelector('[data-form="msg"]') as HTMLElement;
        // 先清上一轮错误高亮
        list.querySelectorAll("[data-f]").forEach((el) => ((el as HTMLElement).style.borderColor = "", (el as HTMLElement).style.boxShadow = ""));
        if (error) {
            // 从报错文案提取字段名（buildArgs 的错误均含「参数 <key>」或「缺少必填参数：<key>」），红框高亮该字段
            const m = error.match(/参数 (\S+)/) ?? error.match(/参数：(\S+)/);
            const bad = m?.[1];
            if (bad) {
                const el = list.querySelector(`[data-f="${bad}"]`) as HTMLElement | null;
                if (el) {
                    el.style.borderColor = "var(--b3-theme-error)";
                    el.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--b3-theme-error) 25%, transparent)";
                    // 长表单下错误信息在底部不可见：聚焦并滚动到问题字段，用户立即看到改哪里
                    (el as HTMLInputElement | HTMLTextAreaElement).focus?.();
                    el.scrollIntoView({ block: "nearest" });
                }
            } else {
                msg.scrollIntoView({ block: "nearest" });
            }
            msg.style.color = "var(--qg-error-text)";
            msg.textContent = error;
            return true;
        }
        return false;
    };
    const copyForm = async (format: "envelope" | "mcp") => {
        const examples = buildInvocationExamples(formOp, formValues());
        if (formError(examples.error)) return;
        const msg = list.querySelector('[data-form="msg"]') as HTMLElement;
        try {
            await navigator.clipboard.writeText(format === "envelope" ? JSON.stringify(examples.envelope) : JSON.stringify(examples.mcp, null, 2));
            msg.style.color = "var(--b3-theme-on-surface)";
            msg.textContent = `${format === "envelope" ? "命令信封" : "tools/call 的 MCP 参数"}已复制；包含当前填写内容，未执行。分享前请核对。`;
        } catch {
            msg.style.color = "var(--qg-error-text)";
            msg.textContent = "剪贴板写入失败，请检查系统剪贴板权限后重试。";
        }
    };
    const showPreflight = (report: OpPreflight) => {
        const box = list.querySelector('[data-form="preflight-result"]') as HTMLElement;
        box.replaceChildren();
        const title = document.createElement("div");
        title.textContent = `${report.canInvoke ? "已核验的调用条件通过" : "调用条件需要修复"} · ${new Date(report.checkedAt).toLocaleTimeString()}；预检不代表执行成功。`;
        box.appendChild(title);
        for (const check of report.checks) {
            if (check.state === "pass") continue;
            const row = document.createElement("div");
            row.textContent = `${check.state === "blocked" ? "需修复" : "未核验"}：${check.message}`;
            box.appendChild(row);
        }
        const repairs = new Set(report.checks.filter((check) => check.blocking && check.repair).map((check) => check.repair));
        for (const page of repairs) {
            const button = document.createElement("button");
            button.className = "b3-button b3-button--outline";
            button.textContent = page === "connection" ? "打开连接与通道" : "检查插件状态";
            button.onclick = () => host.openSettingPanel(page);
            box.appendChild(button);
        }
    };
    const execForm = () => runForm(true);
    const runForm = async (execute: boolean) => {
        if (formBusy || closed) return;
        const { args, error } = buildArgs(formFieldsFor(formOp), formValues());
        if (formError(error)) return;
        const requestGeneration = formGeneration;
        const op = formOp;
        const msg = list.querySelector('[data-form="msg"]') as HTMLElement;
        msg.style.color = "var(--b3-theme-on-surface)";
        msg.textContent = "检查调用条件中……";
        formBusy = true;
        const controls = [...list.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input[data-f], textarea[data-f], button[data-form]:not([data-form="back"])')];
        controls.forEach((control) => { control.disabled = true; });
        const current = () => !closed && stage === "form" && requestGeneration === formGeneration;
        let dispatched = false;
        try {
            const report = await host.preflightOp(op, args ?? {});
            if (!current()) return;
            showPreflight(report);
            if (!report.canInvoke) { msg.textContent = "尚未执行；请修复列出的条件后重试。"; return; }
            if (!execute) { msg.textContent = "检查结束，未执行；执行前会重新检查。"; return; }
            msg.textContent = "执行中……";
            dispatched = true;
            const r = await host.dispatchOp(op, args ?? {});
            if (!current()) return;
            if (r.status === "recorded" || r.status === "duplicate") {
                showMessage(`已执行（${r.status}）：${r.message}`, 4000, "info");
                dialog.destroy();
                return;
            }
            msg.style.color = "var(--qg-error-text)";
            msg.textContent = `${r.status}：${r.message}`;
            if (r.status === "unknown") { controls.splice(0, controls.length); }
        } catch (e) {
            if (!current()) return;
            msg.style.color = "var(--qg-error-text)";
            msg.textContent = `检查或调用失败：${e instanceof Error ? e.message : String(e)}。请先核对回执和目标状态。`;
            if (dispatched) controls.splice(0, controls.length);
        } finally {
            if (current() && controls.length) {
                formBusy = false;
                controls.forEach((control) => { control.disabled = false; });
            }
        }
    };

    /** R311：★ 收藏/取消收藏（favorites.add/remove 走完整簿记；本地 favorites 数组即时更新免重拉） */
    const toggleFavorite = async (plugin: string, command: string, title: string, starBtn: HTMLElement) => {
        if (starBtn.dataset.busy) return; // 防连点：簿记在途时忽略重复点击（否则 add→remove 交错）
        starBtn.dataset.busy = "1";
        try {
            const isFav = starBtn.textContent === "★";
            const r = await host.dispatchOp(isFav ? "favorites.remove" : "favorites.add", isFav
                ? { plugin, command }
                : { plugin, command, title });
            if (r.status === "recorded") {
                starBtn.textContent = isFav ? "☆" : "★";
                starBtn.setAttribute("aria-label", isFav ? "收藏" : "取消收藏");
                const key = `${plugin}/${command}`;
                if (isFav) {
                    favorites = favorites.filter((f) => `${f.plugin}/${f.command}` !== key);
                } else {
                    favorites = [...favorites, { plugin, command }];
                }
                showMessage(isFav ? "已取消收藏" : "已收藏", 1500, "info");
            } else {
                showMessage(r.message || "收藏操作失败", 4000, "error");
            }
        } finally {
            delete starBtn.dataset.busy;
        }
    };

    const runEntry = async (e: PaletteEntry) => {
        dialog.destroy();
        const r = await runCommand(probe, e.plugin, e.id, {
            confirmExec: host.settings.confirmExec,
            confirm: (t) => host.confirm(t),
        });
        showMessage(r.ok ? `已执行：${e.title}` : r.message, r.ok ? 2500 : 5000, r.ok ? "info" : "error");
    };

    // L600 部分：输入防抖 120ms——千条命令下每键全量过滤+重建会掉帧（settings 搜索同口径）
    const navMaxIndex = () => paletteNavMaxIndex(
        visibleEntries.length,
        list.querySelectorAll("[data-cap]").length,
        RENDER_LIMIT,
        list.querySelectorAll("[data-fb]").length,
    );
    input.addEventListener("input", () => {
        active = 0;
        if (stage !== "list") return;
        if (renderDebounce) window.clearTimeout(renderDebounce);
        renderDebounce = window.setTimeout(() => { renderDebounce = 0; render(); }, 120);
    });
    input.addEventListener("keydown", (ev) => {
        if (stage === "form") return; // 表单阶段由字段自身处理键盘
        const kev = ev as KeyboardEvent;
        if (kev.isComposing || kev.keyCode === 229) return; // 中文输入法组字中：Enter/Esc 属输入法确认/取消，不得触发面板
        if (renderDebounce) { window.clearTimeout(renderDebounce); renderDebounce = 0; render(); } // 键盘导航前先落定最新结果
        if (kev.key === "ArrowDown") { kev.preventDefault(); active = Math.min(active + 1, navMaxIndex()); render(); }
        else if (kev.key === "ArrowUp") { kev.preventDefault(); active = Math.max(active - 1, 0); render(); }
        else if (kev.key === "Escape" && input.value) {
            // 两段式 Esc（Raycast 同款）：有词先清词并拦住宿主关闭，空词才落到宿主关面板
            kev.stopPropagation();
            input.value = "";
            active = 0;
            render();
        }
        else if (kev.key === "Enter") {
            ev.preventDefault();
            const capCount = list.querySelectorAll("[data-cap]").length;
            const action = paletteActionIndex(active, visibleEntries.length, capCount);
            if (action.kind === "command") {
                const picked = visibleEntries[active];
                if (picked) void runEntry(picked);
            } else if (action.kind === "capability") {
                const capEl = list.querySelectorAll("[data-cap]")[action.index] as HTMLElement | undefined;
                const op = capEl?.dataset.cap;
                if (op) { stage = "form"; formOp = op; render(); }
            } else {
                const fallback = list.querySelectorAll<HTMLButtonElement>("[data-fb]")[action.index];
                fallback?.click();
            }
        }
    });
    list.addEventListener("click", (ev) => {
        if (stage === "form") return; // 表单阶段事件已挂载到专属按钮
        const starBtn = (ev.target as HTMLElement).closest("[data-star]") as HTMLElement | null;
        if (starBtn) {
            void toggleFavorite(starBtn.dataset.plugin as string, starBtn.dataset.command as string, starBtn.dataset.title as string, starBtn);
            return;
        }
        const capItem = (ev.target as HTMLElement).closest("[data-cap]") as HTMLElement | null;
        if (capItem?.dataset.cap) { stage = "form"; formOp = capItem.dataset.cap; render(); return; }
        const item = (ev.target as HTMLElement).closest("[data-i]") as HTMLElement | null;
        if (item) { void runEntry(visibleEntries[Number(item.dataset.i)]); return; }
        const fb = (ev.target as HTMLElement).closest("[data-fb]") as HTMLElement | null;
        if (!fb) return;
        if (fb.dataset.fb === "capture") {
            openQuickCapture(host, input.value.trim(), () => dialog.destroy());
            return;
        }
        dialog.destroy();
        if (fb.dataset.fb === "plugins") host.openSettingPanel("diagnostics");
        else if (fb.dataset.fb === "panel") host.openSettingPanel();
        else if (fb.dataset.fb === "diag") void host.copyDiagnostics();
        else window.open("https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md", "_blank");
    });

    render();
    input.focus();
    // 启动竞态兜底（R293 实测）：插件实例先入列、onload 异步未完成时注册表暂空——
    // 首探非 host 源则 1.2s 后自动重探一次并重渲染
    if (probe.source !== "host") {
        setTimeout(() => {
            if (!document.body.contains(root)) return;
            probe = host.registry();
            if (probe.source === "host") {
                all = collect(probe);
                render();
            }
        }, 1200);
    }
}
