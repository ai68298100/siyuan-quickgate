/**
 * 恢复中心 UI（G5 · R294）：unknown/failed/expired 回执的人工处理面（查询/重试/放弃/复制）。
 * 入口：设置状态概览与队列页按钮（有候选时显示计数）。
 * 语义（承接 L655/R6-B）：不自动重试；重试=换新 id 重发原信封（写操作经确认门控）；
 * 放弃=人工核对后记录（不改变业务事实，仅关闭打扰）。
 */
import { Dialog, showMessage } from "siyuan";

import { KernelApi } from "./services/kernelApi";
import { BridgeStore } from "./services/store";
import { fmtReceiptTime } from "./results-center";
import { buildRecoveryItems, buildRetryEnvelope, RecoveryItem } from "./recovery";
import type { QuickGateSettings } from "./types/bridge";

export interface RecoveryHost {
    settings: QuickGateSettings;
    kernelApi: KernelApi;
    store: BridgeStore;
    ui: { Dialog: typeof Dialog; showMessage: typeof showMessage };
}

/** 候选计数（状态页徽章用）：非 none 读取失败按 0 计并由对话框承载原因展示 */
export async function countRecoveryItems(host: Pick<RecoveryHost, "settings" | "kernelApi" | "store">): Promise<number> {
    try {
        const { receiptLines, commandLines } = await loadLines(host);
        return buildRecoveryItems(receiptLines, commandLines, host.store.resolved.resolved).length;
    } catch { return 0; }
}

async function loadLines(host: Pick<RecoveryHost, "settings" | "kernelApi">) {
    const base = host.settings.bridgeBasePath;
    const receiptLines = ((await host.kernelApi.getFileText(`${base}/results.ndjson`)) ?? "").split("\n");
    const commandLines = ((await host.kernelApi.getFileText(`${base}/commands.ndjson`)) ?? "").split("\n");
    return { receiptLines, commandLines };
}

const esc = (t: unknown) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export async function openRecoveryCenter(host: RecoveryHost): Promise<void> {
    const { Dialog, showMessage } = host.ui;
    // 焦点回归（L585 部分）：对话框销毁后焦点回到触发元素
    const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = new Dialog({
        // 头部统一走内容区 qg-dlg-head（原生 title 留空即 fn__none，避免双标题）
        content: `<div id="qg-recovery" style="min-width:min(560px, 92vw);padding:14px 16px;font-size:12px"><div class="qg-dlg-head"><span class="qg-dlg-title"><span class="qg-title-logo">门</span>恢复中心</span><span style="font-size:11px;color:var(--b3-theme-on-surface-light)">unknown / 失败 / 过期回执的人工处置面</span><span class="sp"></span><button class="b3-button b3-button--small" data-role="refresh">刷新</button></div><div data-role="body" role="region" aria-label="恢复项列表"></div></div>`,
        width: "min(640px, 92vw)",
        height: "auto",
        destroyCallback: () => { try { focusReturn?.focus({ preventScroll: true }); } catch { /* 焦点失败不阻断 */ } },
    });
    const body = dialog.element.querySelector("[data-role=body]") as HTMLElement;
    dialog.element.querySelector('[data-role="refresh"]')?.addEventListener("click", () => void refresh());
    // 打开后聚焦刷新按钮（键盘入口点；纯浏览用户不受影响）
    (dialog.element.querySelector('[data-role="refresh"]') as HTMLButtonElement | null)?.focus({ preventScroll: true });

    const refresh = async () => {
        let receiptLines: string[] = [];
        let commandLines: string[] = [];
        try {
            ({ receiptLines, commandLines } = await loadLines(host));
        } catch (e) {
            // L652：读取异常要给原因与修复路径，不得显示为"没有待恢复"
            body.innerHTML = `<div style="color:var(--b3-theme-error)">载体读取失败：${esc(e instanceof Error ? e.message : String(e))}——请确认思源内核可达后重试。</div>`;
            return;
        }
        const items = buildRecoveryItems(receiptLines, commandLines, host.store.resolved.resolved);
        if (items.length === 0) {
            body.innerHTML = `<div class="qg-empty">✓ 没有待处理的恢复项——unknown/失败/过期回执出现时会集中在这里。</div>` +
                renderResolvedSection();
            return;
        }
        // R8-A 批处理（R304 调研立项）：全选复选框 + 放弃所选
        body.innerHTML = items.map((it) => itemHtml(it)).join("") +
            `<div style="display:flex;gap:8px;align-items:center;margin-top:8px">` +
            // 注意：select-all 不得包在 label 里——label 会二次派发 click 造成双 toggle（R305 实测）
            `<input type="checkbox" data-act="select-all" aria-label="全选" style="flex:none" />` +
            `<span style="font-size:12px;color:var(--b3-theme-on-surface)">全选</span>` +
            `<button class="b3-button qg-btn-danger b3-button--small" data-act="dismiss-selected" style="display:none">放弃所选</button>` +
            `</div>` +
            `<div style="margin-top:8px;color:var(--b3-theme-on-surface)">处置说明：重试=换新 id 重发原命令（写操作仍经确认门控）；放弃=人工核对后记录，不改变业务事实。</div>` +
            renderResolvedSection();
        // 批处理闭包用函数声明（提升）：minified 后监听器引用后置 const 曾触发 TDZ（R305 实测）
        function syncBatchButton() {
            const n = body.querySelectorAll("input[data-check-id]:checked").length;
            const b = body.querySelector('[data-act="dismiss-selected"]') as HTMLElement | null;
            if (b) {
                b.style.display = n > 0 ? "" : "none";
                b.textContent = `放弃所选（${n}）`;
            }
        }
        async function dismissSelected() {
            const ids = Array.from(body.querySelectorAll("input[data-check-id]:checked"))
                .map((c) => (c as HTMLInputElement).dataset.checkId as string)
                .filter(Boolean);
            for (const id of ids) await host.store.markResolved(id, "dismissed");
            showMessage(`已批量放弃 ${ids.length} 项（逐条记录台账）`, 3000, "info");
            await refresh();
        }
        body.querySelectorAll("[data-act]").forEach((btn) => {
            const act = String((btn as HTMLElement).dataset.act);
            if (act === "select-all") {
                (btn as HTMLInputElement).addEventListener("change", () => {
                    const on = (btn as HTMLInputElement).checked;
                    body.querySelectorAll("input[data-check-id]").forEach((c) => {
                        (c as HTMLInputElement).checked = on;
                    });
                    syncBatchButton();
                });
                return;
            }
            if (act === "dismiss-selected") {
                btn.addEventListener("click", () => void dismissSelected());
                return;
            }
            btn.addEventListener("click", () => void onAction(act, String((btn as HTMLElement).dataset.id)));
        });
        body.querySelectorAll("input[data-check-id]").forEach((c) => {
            c.addEventListener("change", syncBatchButton);
        });
    };

    /** R8 结论②：已处置可回溯（GitHub Done 语义）——折叠列出处置台账 */
    const renderResolvedSection = () => {
        const entries = Object.entries(host.store.resolved.resolved)
            .sort((a, b) => (a[1].at < b[1].at ? 1 : -1))
            .slice(0, 30);
        if (entries.length === 0) return "";
        return `<details style="margin-top:10px"><summary>已处置记录（${entries.length}，最近 30 条）</summary>` +
            `<div style="margin-top:4px;color:var(--b3-theme-on-surface)">${entries.map(([id, r]) =>
                `<div>${esc(r.at.slice(11, 19))} <span class="qg-mono">${esc(id)}</span> → ${esc(r.action)}</div>`).join("")}</div></details>`;
    };

    const itemHtml = (it: RecoveryItem) => {
        const kind = it.status === "expired" ? "warn" : "err";
        return `<div class="qg-card" style="padding:10px 12px;margin-bottom:8px">` +
            `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">` +
            `<input type="checkbox" data-check-id="${esc(it.id)}" aria-label="选择 ${esc(it.id)}" style="flex:none" />` +
            `<span class="qg-chip ${kind}">${esc(it.status)}</span>` +
            `<span class="qg-mono">${esc(it.op)}</span>` +
            `<span class="qg-num" style="color:var(--b3-theme-on-surface)">${esc(fmtReceiptTime(it.finishedAt))}</span>` +
            `<span style="margin-left:auto;display:flex;gap:6px">` +
            (it.canRetry ? `<button class="b3-button b3-button--small" data-act="retry" data-id="${esc(it.id)}">重试（换新 id）</button>` : "") +
            `<button class="b3-button b3-button--small qg-copy-btn" data-act="copy-cmd" data-id="${esc(it.id)}">复制原命令</button>` +
            `<button class="b3-button b3-button--small" data-act="dismiss" data-id="${esc(it.id)}">放弃并记录</button>` +
            `<button class="b3-button b3-button--small qg-copy-btn" data-act="copy" data-id="${esc(it.id)}">复制回执</button>` +
            `</span></div>` +
            `<div style="color:var(--b3-theme-on-surface);margin-top:3px">${esc(it.message)}</div>` +
            `${it.canRetry ? "" : `<div style="color:var(--b3-theme-on-surface);margin-top:2px">原命令信封已不在队列（无法带参重试）——如需重试请从外部客户端重新发起。</div>`}` +
            `</div>`;
    };

    const onAction = async (act: string, id: string) => {
        if (act === "copy") {
            const { receiptLines } = await loadLines(host);
            const line = receiptLines.map((l) => l.trim()).find((l) => l.includes(`"id":"${id}"`));
            if (line) await navigator.clipboard.writeText(line);
            showMessage("已复制原始回执行（JSON）", 2000, "info");
            return;
        }
        if (act === "copy-cmd") {
            // 复制原始命令信封（重试前的核对用：含 args 原文）
            const { commandLines } = await loadLines(host);
            const line = commandLines.map((l) => l.trim()).find((l) => l.includes(`"id":"${id}"`));
            if (line) {
                await navigator.clipboard.writeText(line);
                showMessage("已复制原始命令信封（JSON，含 args）", 2000, "info");
            } else {
                showMessage("原命令信封已不在队列文件中——可改用「复制回执」", 3000, "info");
            }
            return;
        }
        if (act === "retry") {
            const { commandLines } = await loadLines(host);
            const original = commandLines.map((l) => l.trim()).find((l) => l.includes(`"id":"${id}"`));
            const envelope = original ? buildRetryEnvelope(original, `retry-${Date.now()}-${Math.floor(Math.random() * 65536).toString(16)}`) : null;
            if (!envelope) {
                showMessage("原命令信封不可解析，无法重试——请从外部客户端重新发起", 5000, "error");
                return;
            }
            try {
                const base = host.settings.bridgeBasePath;
                const old = (await host.kernelApi.getFileText(`${base}/commands.ndjson`)) ?? "";
                await host.kernelApi.putFileText(`${base}/commands.ndjson`, `${old.replace(/\n+$/, "")}\n${envelope}`);
                await host.store.markResolved(id, "retried");
                showMessage(`已重发（新 id，写操作仍经确认门控）`, 3000, "info");
            } catch (e) {
                showMessage(`重发失败：${e instanceof Error ? e.message : String(e)}`, 6000, "error");
                return;
            }
            await refresh();
            return;
        }
        if (act === "dismiss") {
            await host.store.markResolved(id, "dismissed");
            showMessage("已记录放弃（不影响业务事实，可按 id 查询历史回执）", 3000, "info");
            await refresh();
        }
    };

    await refresh();
}
