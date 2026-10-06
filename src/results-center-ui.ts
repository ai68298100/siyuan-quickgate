/**
 * 结果中心 UI（G5-01 · R302）：状态筛选 + 关键词 + 分页（每页 50，加载更多）+ 逐条复制。
 * 数据面纯函数在 src/results-center.ts（单测覆盖）。
 */
import { KernelApi } from "./services/kernelApi";
import type { QuickGateSettings } from "./types/bridge";
import { collectStatuses, filterReceipts, fmtElapsedMs, fmtReceiptTime, pageNewestFirst, parseReceiptLines, ReceiptRow } from "./results-center";

export interface ResultsCenterHost {
    settings: QuickGateSettings;
    kernelApi: KernelApi;
    ui: { openDialog(content: string): { element: HTMLElement; destroy(): void }; showMessage(text: string, timeout?: number, type?: "info" | "error"): void };
}

const PAGE_SIZE = 50;

export async function openResultsCenter(host: ResultsCenterHost): Promise<void> {
    const dialog = host.ui.openDialog(
        `<div id="qg-results" style="min-width:min(640px, 92vw);padding:14px 16px;font-size:12px">` +
        `<div class="qg-dlg-head"><span class="qg-dlg-title"><span class="qg-title-logo">门</span>回执中心</span>` +
        `<span style="font-size:11px;color:var(--b3-theme-on-surface-light)">外部命令回执留档（results.ndjson）</span><span class="sp"></span>` +
        `<button class="b3-button b3-button--small" data-role="reload" title="重新读取 results.ndjson">刷新</button>` +
        `<button class="b3-button b3-button--small" data-role="csv">导出 CSV</button>` +
        `<button class="b3-button b3-button--small" data-role="json">导出 JSON</button>` +
        `</div>` +
        `<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">` +
        `<select class="b3-select" data-role="status" style="width:130px"></select>` +
        `<select class="b3-select" data-role="since" style="width:110px">` +
        `<option value="all">全部时间</option><option value="today">今天</option><option value="7d">近 7 天</option></select>` +
        `<input class="b3-text-field" data-role="q" placeholder="搜索 id / op / 消息" style="flex:1;min-width:160px" />` +
        `</div>` +
        `<div data-role="list"></div>` +
        `<div style="display:flex;gap:8px;align-items:center;margin-top:8px">` +
        `<span data-role="count" style="color:var(--b3-theme-on-surface)"></span><span style="flex:1"></span>` +
        `<button class="b3-button b3-button--small" data-role="more" style="display:none">加载更多</button>` +
        `</div></div>`,
    );
    const root = dialog.element.querySelector("#qg-results") as HTMLElement;
    const statusSel = root.querySelector("[data-role=status]") as HTMLSelectElement;
    const qInput = root.querySelector("[data-role=q]") as HTMLInputElement;
    const listEl = root.querySelector("[data-role=list]") as HTMLElement;
    const countEl = root.querySelector("[data-role=count]") as HTMLElement;
    const moreBtn = root.querySelector("[data-role=more]") as HTMLButtonElement;

    let all: ReceiptRow[] = [];
    let filtered: ReceiptRow[] = [];
    let shown = 0;

    const rowEl = (r: ReceiptRow) => {
        const kind = r.status === "recorded" || r.status === "duplicate" ? "ok"
            : r.status === "rejected" || r.status === "expired" ? "warn"
            : r.status === "failed" || r.status === "unknown" ? "err" : "mute";
        const div = document.createElement("div");
        div.className = "qg-card hoverable";
        div.style.cssText = "padding:7px 10px;margin-bottom:6px";
        const top = document.createElement("div");
        top.style.cssText = "display:flex;gap:8px;align-items:center";
        const chip = document.createElement("span");
        chip.className = `qg-chip ${kind}`;
        chip.textContent = r.status;
        const op = document.createElement("span");
        op.className = "qg-mono";
        op.style.flex = "1";
        op.style.minWidth = "0";
        op.style.overflow = "hidden";
        op.style.textOverflow = "ellipsis";
        op.style.whiteSpace = "nowrap";
        op.textContent = r.op;
        const time = document.createElement("span");
        time.className = "qg-dim qg-num";
        time.style.cssText = "flex:none";
        time.textContent = fmtReceiptTime(r.finishedAt);
        const ms = document.createElement("span");
        ms.className = "qg-dim qg-num";
        ms.style.cssText = "flex:none;min-width:44px;text-align:right";
        ms.textContent = fmtElapsedMs(r.elapsedMs);
        const copy = document.createElement("button");
        copy.className = "b3-button b3-button--small qg-copy-btn";
        copy.style.marginLeft = "auto";
        copy.textContent = "复制";
        copy.addEventListener("click", () => {
            void navigator.clipboard.writeText(r.raw).then(() => host.ui.showMessage("已复制回执（JSON）", 1800, "info"));
        });
        top.append(chip, op, time, ms, copy);
        const msg = document.createElement("div");
        msg.style.cssText = "color:var(--b3-theme-on-surface);margin-top:2px;word-break:break-all";
        msg.textContent = r.message;
        div.append(top, msg);
        return div;
    };

    const renderMore = () => {
        // 新→旧展示（日志查询范式）：pageNewestFirst 倒序后窗口切片
        const slice = pageNewestFirst(filtered, shown, PAGE_SIZE);
        for (const r of slice) listEl.appendChild(rowEl(r));
        shown += slice.length;
        moreBtn.style.display = shown < filtered.length ? "" : "none";
        countEl.textContent = `共 ${filtered.length} 条（已显示 ${shown}）`;
    };

    const apply = () => {
        const sinceSel = root.querySelector("[data-role=since]") as HTMLSelectElement;
        filtered = filterReceipts(all, {
            status: statusSel.value,
            q: qInput.value,
            since: sinceSel?.value as "today" | "7d" | "all" | undefined,
        });
        shown = 0;
        listEl.textContent = "";
        renderMore();
        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="qg-empty">无匹配回执——调整筛选或关键词。</div>`;
        }
    };

    // 状态下拉：从数据归纳（有数据的排前）
    const statuses = ["all"];
    const fill = () => {
        const present = collectStatuses(all);
        statuses.length = 0;
        statuses.push("all", ...present);
        statusSel.innerHTML = "";
        for (const s of statuses) {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s === "all" ? "全部状态" : s;
            statusSel.appendChild(opt);
        }
    };
    statusSel.addEventListener("change", apply);
    root.querySelector("[data-role=since]")?.addEventListener("change", apply);
    let qDebounce = 0;
    qInput.addEventListener("input", () => {
        window.clearTimeout(qDebounce);
        qDebounce = window.setTimeout(apply, 150);
    });
    moreBtn.addEventListener("click", renderMore);
    // 刷新（R318b）：重读 results.ndjson（新会话/新回执可见），保持当前筛选
    const reload = async () => {
        const base = host.settings.bridgeBasePath;
        const text = (await host.kernelApi.getFileText(`${base}/results.ndjson`)) ?? "";
        all = parseReceiptLines(text.split("\n"));
        fill();
        apply();
    };
    root.querySelector("[data-role=reload]")?.addEventListener("click", () => void reload());
    // 打开即聚焦搜索（键盘流：打开后直接输入即可过滤）
    qInput.focus();
    // CSV 导出（R302 增量）：导出当前筛选结果（与显示同源）
    root.querySelector("[data-role=csv]")?.addEventListener("click", () => {
        const sinceSel = root.querySelector("[data-role=since]") as HTMLSelectElement | null;
        const rows = filterReceipts(all, { status: statusSel.value, q: qInput.value, since: (sinceSel?.value as "today" | "7d" | "all" | undefined) ?? "all" });
        if (rows.length === 0) {
            host.ui.showMessage("当前筛选无数据可导出", 2500, "info");
            return;
        }
        const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const csv = ["id,op,status,finishedAt,elapsedMs,message",
            ...rows.map((r) => [r.id, r.op, r.status, r.finishedAt, String(r.elapsedMs), r.message].map(cell).join(",")),
        ].join("\n");
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `quickgate-results-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        host.ui.showMessage(`已导出 ${rows.length} 条（CSV，UTF-8 BOM）`, 3000, "info");
    });
    // 打开即聚焦搜索（键盘流：打开后直接输入即可过滤）
    qInput.focus();

    // 首次装载（含状态归纳）
    const base = host.settings.bridgeBasePath;
    const text = (await host.kernelApi.getFileText(`${base}/results.ndjson`)) ?? "";
    all = parseReceiptLines(text.split("\n"));
    fill();
    apply();
}
