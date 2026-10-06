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
import { getArgsSpec } from "./mcp/tools";
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
    openSettingPanel(): void;
    /** 再记一条：从捕获成功卡重开面板（清空输入即录即走） */
    openCommandPalette(): void;
    copyDiagnostics(): Promise<void>;
    /** 快速捕获（G3-04 + R7 结论②）：目标二选一（daily=今日日记 HH:mm 前缀 / inbox=收集箱纯文本） */
    captureQuick(text: string, target: "daily" | "inbox"): Promise<{ ok: boolean; message: string; blockId?: string; docId?: string }>;
    /** 上次捕获去向（R301：选择器预置；选择后经 rememberCaptureTarget 回写） */
    lastCaptureTarget(): "daily" | "inbox";
    rememberCaptureTarget(target: "daily" | "inbox"): void;
    /** 打开文档/块（原文操作） */
    openDoc(id: string): Promise<void>;
    /** 桥是否在运行（能力动作分组门控） */
    bridgeAlive(): boolean;
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

/** 能力动作目录（R6-A 二段式）：精选的桥 op（schema 由 mcp/tools ARGS 表驱动） */
export const CAPABILITY_OPS: ReadonlyArray<{ op: string; label: string }> = [
    { op: "checkin.record", label: "打卡记录" },
    { op: "checkin.summary", label: "打卡概览" },
    { op: "checkin.items", label: "打卡项目清单" },
    { op: "contacts.search", label: "人脉搜索" },
    { op: "contacts.ensure", label: "确保人脉存在" },
    { op: "contacts.interaction", label: "记录人脉互动" },
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
            args[f.key] = raw === true || raw === "true";
        } else if (f.type === "array" || f.type === "object") {
            try { args[f.key] = JSON.parse(String(raw)); } catch { return { error: `参数 ${f.key} 须为合法 JSON` }; }
        } else {
            args[f.key] = String(raw);
        }
    }
    return { args };
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

    const dialog = new Dialog({
        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>命令面板</span><span class="qg-title-ver">↑↓ 选择 · Enter 执行 · Esc 关闭</span></span>`,
        content: `<div id="qg-palette"><input class="b3-text-field" data-role="q" placeholder="搜索命令（中英/拼音别名；收藏与最近自动置顶）" /><div data-role="list"></div></div>`,
        width: "min(620px, 92vw)",
        height: "auto",
    });
    const root = dialog.element.querySelector("#qg-palette") as HTMLElement;
    const input = root.querySelector("[data-role=q]") as HTMLInputElement;
    const list = root.querySelector("[data-role=list]") as HTMLElement;
    let entries: PaletteEntry[] = [];
    let active = 0;
    /** R6-A 二段式：list=搜索列表；form=能力动作参数面板（取消无副作用） */
    let stage: "list" | "form" = "list";
    let formOp = "";

    const render = () => {
        if (stage === "form") { renderForm(); return; }
        entries = buildPaletteEntries(all, favorites, recent, input.value);
        // 能力动作（R6-A）：桥运行时附加精选 op 分组（label/op 同入过滤）
        const kws = input.value.trim() ? expandSearchKeyword(input.value.trim()) : null;
        const caps = host.bridgeAlive()
            ? CAPABILITY_OPS.filter((c) => !kws || kws.some((k) => c.label.toLowerCase().includes(k) || c.op.toLowerCase().includes(k)))
            : [];
        active = Math.min(active, Math.max(0, entries.length + caps.length - 1));
        if (entries.length === 0 && caps.length === 0) {
            // R6-B fallback 兜底：无匹配时给可用的下一步，不做死面板；
            // 有输入文本时首位=快速捕获（G3-04：一句话进今日日记）
            const q = input.value.trim();
            list.textContent = "";
            const empty = document.createElement("div");
            empty.className = "qg-palette-empty";
            empty.textContent = q ? `无匹配命令「${q}」` : "无可用命令";
            list.appendChild(empty);
            const fallbacks = document.createElement("div");
            fallbacks.className = "qg-palette-fallbacks";
            if (q) {
                const cap = document.createElement("button");
                cap.className = "b3-button b3-button--outline";
                cap.dataset.fb = "capture";
                cap.textContent = `捕获「${q.slice(0, 24)}${q.length > 24 ? "…" : ""}」`;
                fallbacks.appendChild(cap);
            }
            for (const [fb, label] of [["panel", "打开快门设置（健康页）"], ["diag", "复制诊断包"], ["guide", "上手指南"]] as const) {
                const b = document.createElement("button");
                b.className = "b3-button b3-button--outline";
                b.dataset.fb = fb;
                b.textContent = label;
                fallbacks.appendChild(b);
            }
            list.appendChild(fallbacks);
            return;
        }
        // 列表用 DOM API 构建（textContent 免转义，杜绝注入面）
        list.textContent = "";
        const mkItem = (opts: { mark?: string; title: string; sub?: string; kbd?: string; isActive: boolean; attrs?: Record<string, string> }) => {
            const div = document.createElement("div");
            div.className = "qg-palette-item" + (opts.isActive ? " active" : "");
            for (const [k, v] of Object.entries(opts.attrs ?? {})) div.dataset[k] = v;
            if (opts.mark) {
                const m = document.createElement("span");
                m.className = "qg-palette-mark";
                m.textContent = opts.mark;
                div.appendChild(m);
            }
            const t = document.createElement("span");
            t.className = "qg-palette-title";
            t.textContent = opts.title;
            div.appendChild(t);
            if (opts.sub) {
                const s = document.createElement("span");
                s.className = "qg-palette-sub";
                s.textContent = opts.sub;
                div.appendChild(s);
            }
            if (opts.kbd) {
                const k = document.createElement("kbd");
                k.className = "qg-palette-kbd";
                k.textContent = opts.kbd;
                div.appendChild(k);
            }
            return div;
        };
        entries.forEach((e, i) => {
            const item = mkItem({
                // mark 全用单色文本字形（★/↺）——彩色 emoji（🕐）在 Windows 上视觉重量突兀
                mark: e.favorite ? "★" : e.recent ? "↺" : undefined,
                title: e.title, sub: e.pluginDisplayName, kbd: e.accelerator,
                isActive: i === active, attrs: { i: String(i) },
            });
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
        if (caps.length > 0) {
            const head = document.createElement("div");
            head.className = "qg-palette-group";
            head.textContent = "能力动作（快门桥）";
            list.appendChild(head);
            caps.forEach((c, j) => list.appendChild(mkItem({
                mark: " ", title: c.label, sub: c.op, kbd: "参数",
                isActive: cmdCount() + j === active, attrs: { cap: c.op },
            })));
        }
        list.querySelector(".qg-palette-item.active")?.scrollIntoView({ block: "nearest" });
    };
    const cmdCount = () => entries.length;

    /** R6-A 二段式参数面板：schema 驱动字段渲染，取消/返回无副作用 */
    const renderForm = () => {
        const fields = formFieldsFor(formOp);
        const label = CAPABILITY_OPS.find((c) => c.op === formOp)?.label ?? formOp;
        const fieldHtml = fields.map((f) => {
            const req = f.required ? ` <span style="color:var(--b3-theme-error)">*</span>` : "";
            const ctl = f.type === "boolean"
                ? `<input class="b3-switch" type="checkbox" data-f="${esc(f.key)}" />`
                : f.type === "array" || f.type === "object"
                    ? `<textarea class="b3-text-field" data-f="${esc(f.key)}" rows="2" placeholder='JSON，如 ["a","b"]'></textarea>`
                    : `<input class="b3-text-field" data-f="${esc(f.key)}" type="${f.type === "number" ? "number" : "text"}" style="width:100%" />`;
            return `<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:500">${esc(f.key)}${req}</div>` +
                `<div style="font-size:11px;color:var(--b3-theme-on-surface);margin:1px 0 3px">${esc(f.description)}</div>${ctl}</div>`;
        }).join("");
        list.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:8px">${esc(label)} <span style="font-weight:400;color:var(--b3-theme-on-surface);font-size:11px">— 填写参数后执行</span></div>` +
            (fieldHtml || `<div style="color:var(--b3-theme-on-surface);font-size:12px;margin-bottom:8px">该动作无参数。</div>`) +
            `<div style="display:flex;gap:8px;margin-top:4px">` +
            `<button class="b3-button b3-button--outline" data-form="back">返回</button>` +
            `<button class="b3-button b3-button--primary" data-form="exec">执行</button></div>` +
            `<div data-form="msg" style="margin-top:8px;font-size:12px"></div>`;
        list.querySelector('[data-form="back"]')?.addEventListener("click", () => { stage = "list"; render(); });
        list.querySelector('[data-form="exec"]')?.addEventListener("click", () => void execForm());
        // 文本字段内 Enter 直执行（textarea 保留换行语义）
        list.querySelectorAll('input[data-f]').forEach((inp) => {
            inp.addEventListener("keydown", ((ev: KeyboardEvent) => {
                if (ev.key === "Enter") { ev.preventDefault(); void execForm(); }
            }) as EventListener);
        });
    };

    const execForm = async () => {
        const fields = formFieldsFor(formOp);
        const values: Record<string, string | boolean> = {};
        for (const f of fields) {
            const el = list.querySelector(`[data-f="${f.key}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
            values[f.key] = el ? (el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el.value) : "";
        }
        const { args, error } = buildArgs(fields, values);
        const msg = list.querySelector('[data-form="msg"]') as HTMLElement;
        // 先清上一轮错误高亮
        list.querySelectorAll("[data-f]").forEach((el) => ((el as HTMLElement).style.borderColor = "", (el as HTMLElement).style.boxShadow = ""));
        if (error) {
            // 从报错文案提取字段名（buildArgs 的错误均含「参数 <key>」或「缺少必填参数：<key>」），红框高亮该字段
            const m = error.match(/参数 (\S+)/) ?? error.match(/参数：(\S+)/);
            const bad = m?.[1];
            if (bad) {
                const el = list.querySelector(`[data-f="${bad}"]`) as HTMLElement | null;
                if (el) { el.style.borderColor = "var(--b3-theme-error)"; el.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--b3-theme-error) 25%, transparent)"; }
            }
            msg.style.color = "var(--b3-theme-error)";
            msg.textContent = error;
            return;
        }
        msg.style.color = "var(--b3-theme-on-surface)";
        msg.textContent = "执行中……";
        const r = await host.dispatchOp(formOp, args ?? {});
        if (r.status === "recorded" || r.status === "duplicate") {
            showMessage(`已执行（${r.status}）：${r.message}`, 4000, "info");
            dialog.destroy();
            return;
        }
        msg.style.color = "var(--b3-theme-error)";
        msg.textContent = `${r.status}：${r.message}`;
    };

    /** R311：★ 收藏/取消收藏（favorites.add/remove 走完整簿记；本地 favorites 数组即时更新免重拉） */
    const toggleFavorite = async (plugin: string, command: string, title: string, starBtn: HTMLElement) => {
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
    };

    const runEntry = async (e: PaletteEntry) => {
        dialog.destroy();
        const r = await runCommand(probe, e.plugin, e.id, {
            confirmExec: host.settings.confirmExec,
            confirm: (t) => host.confirm(t),
        });
        showMessage(r.ok ? `已执行：${e.title}` : r.message, r.ok ? 2500 : 5000, r.ok ? "info" : "error");
    };

    input.addEventListener("input", () => { active = 0; if (stage === "list") render(); });
    input.addEventListener("keydown", (ev) => {
        if (stage === "form") return; // 表单阶段由字段自身处理键盘
        const capCount = list.querySelectorAll("[data-cap]").length;
        if (ev.key === "ArrowDown") { ev.preventDefault(); active = Math.min(active + 1, entries.length + capCount - 1); render(); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); active = Math.max(active - 1, 0); render(); }
        else if (ev.key === "Enter") {
            ev.preventDefault();
            if (active < entries.length) {
                const picked = entries[active];
                if (picked) void runEntry(picked);
            } else {
                const capEl = list.querySelectorAll("[data-cap]")[active - entries.length] as HTMLElement | undefined;
                const op = capEl?.dataset.cap;
                if (op) { stage = "form"; formOp = op; render(); }
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
        if (item) { void runEntry(entries[Number(item.dataset.i)]); return; }
        const fb = (ev.target as HTMLElement).closest("[data-fb]") as HTMLElement | null;
        if (!fb) return;
        if (fb.dataset.fb === "capture") {
            // G3-04 + R7 结论②：目标二选一（先询问去向再写入；失败保留文本可改后重试）
            // R7-A：成功后给原文操作（打开原文 / 复制块引用）
            const text = input.value.trim();
            const ask = new Dialog({
                title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>捕获到哪儿？</span></span>`,
                content: `<div style="padding:14px;display:flex;gap:8px;flex-wrap:wrap">` +
                    (host.lastCaptureTarget() === "inbox"
                        ? `<button class="b3-button b3-button--primary" data-target="inbox">收集箱（上次）</button><button class="b3-button" data-target="daily">今日日记</button>`
                        : `<button class="b3-button b3-button--primary" data-target="daily">今日日记（上次）</button><button class="b3-button" data-target="inbox">收集箱</button>`) +
                    `</div>`,
                width: "min(360px, 92vw)",
                height: "auto",
            });
            ask.element.addEventListener("click", (ev) => {
                const b = (ev.target as HTMLElement).closest("[data-target]") as HTMLElement | null;
                if (!b) return;
                const target = b.dataset.target as "daily" | "inbox";
                ask.destroy();
                host.rememberCaptureTarget(target);
                void host.captureQuick(text, target).then((r) => {
                    if (!r.ok) {
                        showMessage(r.message, 6000, "error");
                        return;
                    }
                    dialog.destroy();
                    showMessage(r.message, 2500, "info");
                    const done = new Dialog({
                        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>捕获成功</span></span>`,
                        content: `<div style="padding:14px;font-size:12px;line-height:1.8">` +
                            `<div>${esc(r.message)}</div>` +
                            `<div style="margin-top:4px;color:var(--b3-theme-on-surface)">${r.blockId ? `块 ${esc(r.blockId)}` : ""}${r.blockId && r.docId ? " · " : ""}${r.docId ? `文档 ${esc(r.docId)}` : ""}</div>` +
                            `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">` +
                            (r.docId ? `<button class="b3-button b3-button--outline" data-cap-doc="${esc(r.docId)}">打开原文</button>` : "") +
                            (r.blockId ? `<button class="b3-button b3-button--outline" data-cap-ref="${esc(r.blockId)}">复制块引用</button>` : "") +
                            `<button class="b3-button b3-button--outline" data-cap-again>再记一条</button>` +
                            `<button class="b3-button" data-cap-close>关闭</button></div></div>`,
                        width: "min(520px, 92vw)",
                        height: "auto",
                    });
                    const root2 = done.element;
                    root2.querySelector("[data-cap-doc]")?.addEventListener("click", () => {
                        const id = (root2.querySelector("[data-cap-doc]") as HTMLElement).dataset.capDoc as string;
                        void host.openDoc(id);
                        done.destroy();
                    });
                    root2.querySelector("[data-cap-ref]")?.addEventListener("click", () => {
                        const id = (root2.querySelector("[data-cap-ref]") as HTMLElement).dataset.capRef as string;
                        void navigator.clipboard.writeText(`((${id} ''))`).then(() => {
                            host.ui.showMessage("块引用已复制", 2000, "info");
                            done.destroy();
                        });
                    });
                    root2.querySelector("[data-cap-close]")?.addEventListener("click", () => done.destroy());
                    // 再记一条：关闭结果卡并重开面板（输入框为空，即录即走）
                    root2.querySelector("[data-cap-again]")?.addEventListener("click", () => {
                        done.destroy();
                        host.openCommandPalette();
                    });
                });
            });
            return;
        }
        dialog.destroy();
        if (fb.dataset.fb === "panel") host.openSettingPanel();
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
