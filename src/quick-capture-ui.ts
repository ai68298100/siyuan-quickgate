import { installFocusTrap } from "./services/focus-trap";
import type { CapturePlan, CaptureResult, CaptureTarget } from "./services/quick-capture";
import type { PaletteHost } from "./command-palette";

type CaptureHost = Pick<PaletteHost, "ui" | "kernelApi" | "prepareCapture" | "captureQuick" | "lastCaptureTarget" | "rememberCaptureTarget" | "openDoc" | "confirm" | "openCommandPalette">;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function openQuickCapture(host: CaptureHost, text: string, onCaptured: () => void): void {
    const { Dialog, showMessage } = host.ui;
    let closed = false;
    let generation = 0;
    let busy = false;
    let unknown = false;
    let plan: CapturePlan | undefined;
    const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first: CaptureTarget = host.lastCaptureTarget() === "inbox" ? "inbox" : "daily";
    const targets: CaptureTarget[] = [first, first === "inbox" ? "daily" : "inbox"];
    const ask = new Dialog({
        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>确认捕获去向</span></span>`,
        content: `<div id="qg-capture" style="padding:14px 16px;font-size:12px;line-height:1.7">` +
            `<div>选择去向只核验目标；确认后才追加内容。</div>` +
            `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">` +
            targets.map((target) => `<button class="b3-button b3-button--outline" data-target="${target}" aria-pressed="false">${target === "daily" ? "今日日记" : "收集箱"}${target === first ? "（上次）" : ""}</button>`).join("") +
            `</div><div data-role="capture-destination">请先选择去向。</div>` +
            `<details style="margin:8px 0"><summary>目标详情与写入影响</summary><pre data-role="capture-details" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details>` +
            `<div>将追加的 Markdown 内容：</div>` +
            `<pre data-role="capture-preview" style="margin:4px 0 8px;padding:8px 10px;max-height:220px;overflow:auto;border:1px solid var(--b3-border-color);border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere"></pre>` +
            `<div style="display:flex;gap:8px;margin-top:12px"><button class="b3-button" data-capture="cancel">取消</button>` +
            `<button class="b3-button b3-button--primary" data-capture="confirm" disabled>确认追加</button></div>` +
            `<div data-role="capture-status" role="status" aria-live="polite" style="margin-top:8px"></div></div>`,
        width: "min(520px, 92vw)", height: "auto",
        destroyCallback: () => { closed = true; generation++; focusReturn?.focus({ preventScroll: true }); },
    });
    installFocusTrap(ask.element);
    const buttons = Array.from(ask.element.querySelectorAll<HTMLButtonElement>("[data-target]"));
    const confirm = ask.element.querySelector<HTMLButtonElement>('[data-capture="confirm"]')!;
    const cancel = ask.element.querySelector<HTMLButtonElement>('[data-capture="cancel"]')!;
    const destination = ask.element.querySelector<HTMLElement>('[data-role="capture-destination"]')!;
    const details = ask.element.querySelector<HTMLElement>('[data-role="capture-details"]')!;
    const preview = ask.element.querySelector<HTMLElement>('[data-role="capture-preview"]')!;
    const status = ask.element.querySelector<HTMLElement>('[data-role="capture-status"]')!;
    const select = async (target: CaptureTarget) => {
        if (busy || unknown) return;
        const current = ++generation;
        plan = undefined;
        confirm.disabled = true;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.target === target)));
        destination.textContent = "正在核验目标……";
        details.textContent = "";
        preview.textContent = "";
        status.textContent = "";
        try {
            const result = await host.prepareCapture(text, target);
            if (closed || current !== generation) return;
            if (!result.plan) {
                destination.textContent = "目标尚未确认";
                status.textContent = result.message ?? "核验未通过，请检查配置后重新选择。";
                return;
            }
            plan = result.plan;
            destination.textContent = `追加到：${plan.destination}`;
            details.textContent = plan.details;
            preview.textContent = plan.body; // 不截断，不在确认时重新拼装时间或正文。
            confirm.disabled = false;
            status.textContent = "请核对去向和内容；等待过久或配置变化时需要重新预览。";
        } catch {
            if (closed || current !== generation) return;
            destination.textContent = "目标尚未确认";
            status.textContent = "目标核验请求未完成，请检查连接后重新选择。";
        }
    };
    buttons.forEach((b) => b.addEventListener("click", () => void select(b.dataset.target as CaptureTarget)));
    cancel.addEventListener("click", () => ask.destroy());
    confirm.addEventListener("click", () => {
        if (!plan || busy || unknown) return;
        const confirmed = plan;
        plan = undefined;
        busy = true;
        confirm.disabled = true;
        cancel.disabled = true;
        buttons.forEach((b) => b.disabled = true);
        status.textContent = "正在重新核验目标并追加……";
        void host.captureQuick(confirmed).catch((): CaptureResult => ({
            ok: false, status: "unknown", message: "写入结果未确认，请核查目标文档，勿重复提交。",
        })).then((result) => {
            busy = false;
            if (result.ok) host.rememberCaptureTarget(confirmed.target);
            if (closed) { showMessage(result.message, 6000, result.ok ? "info" : "error"); return; }
            cancel.disabled = false;
            if (!result.ok) {
                unknown = result.status === "unknown";
                buttons.forEach((b) => b.disabled = unknown);
                status.textContent = result.message;
                return;
            }
            ask.destroy();
            onCaptured();
            showMessage(result.message, 2500, "info");
            showCaptureDone(host, result);
        });
    });
    buttons[0]?.focus();
}

function showCaptureDone(host: CaptureHost, r: CaptureResult): void {
    const { Dialog } = host.ui;
    const done = new Dialog({
        title: `<span class="qg-title-wrap"><span class="qg-title-logo">门</span><span>捕获成功</span></span>`,
        content: `<div id="qg-capture-done" style="padding:14px 16px;font-size:12px;line-height:1.8">` +
            `<div style="display:flex;gap:8px;align-items:center"><span class="qg-chip ok">已写入</span><span>${esc(r.message)}</span></div>` +
            `<div style="margin-top:4px;color:var(--b3-theme-on-surface)" class="qg-mono">${r.blockId ? `块 ${esc(r.blockId)}` : ""}${r.blockId && r.docId ? " · " : ""}${r.docId ? `文档 ${esc(r.docId)}` : ""}</div>` +
            `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">` +
            (r.docId ? `<button class="b3-button" data-cap-doc="${esc(r.docId)}">打开原文</button>` : "") +
            (r.blockId ? `<button class="b3-button" data-cap-ref="${esc(r.blockId)}">复制块引用</button>` : "") +
            `<button class="b3-button b3-button--primary" data-cap-again>再记一条</button>` +
            (r.blockId ? `<button class="b3-button qg-btn-danger" data-cap-undo="${esc(r.blockId)}">撤销写入</button>` : "") +
            `<button class="b3-button" data-cap-close>关闭</button></div>` +
            (r.blockId ? `<div style="margin-top:8px;font-size:11px;color:var(--b3-theme-on-surface)">撤销 = 删除刚写入的块（测试写入可撤销）；若你已在思源中编辑过该块，请勿撤销。</div>` : "") +
            `</div>`,
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
    // L566 部分：撤销写入——删除刚追加的块（内核 deleteBlock；走 PaletteHost.confirm 二次把关）
    root2.querySelector("[data-cap-undo]")?.addEventListener("click", () => {
        const blockId = (root2.querySelector("[data-cap-undo]") as HTMLElement).dataset.capUndo as string;
        const undoBtn = root2.querySelector("[data-cap-undo]") as HTMLButtonElement;
        if (undoBtn.disabled) return;
        undoBtn.disabled = true;
        void host.confirm(`撤销本次捕获：将删除刚写入的块 ${blockId}。若你已在思源中编辑过该块，请取消。`).then((ok) => {
            if (!ok) { undoBtn.disabled = false; return; }
            // kernelApi.post 语义：code!=0 抛错、成功返回解包 data——成败以 then/catch 判定，
            // 不得读返回值上的 code 字段（undefined!==0 会把成功误报为失败，靶场 E4 实测踩坑）
            void host.kernelApi.post("/api/block/deleteBlock", { id: blockId }).then(() => {
                undoBtn.textContent = "已撤销";
                host.ui.showMessage("已撤销本次捕获（块已删除）", 2500, "info");
            }).catch((e: unknown) => {
                undoBtn.disabled = false;
                host.ui.showMessage(`撤销失败：${e instanceof Error ? e.message : String(e)}`, 5000, "error");
            });
        });
    });
    root2.querySelector("[data-cap-close]")?.addEventListener("click", () => done.destroy());
    // 再记一条：关闭结果卡并重开面板（输入框为空，即录即走）
    root2.querySelector("[data-cap-again]")?.addEventListener("click", () => {
        done.destroy();
        host.openCommandPalette();
    });
    installFocusTrap(done.element);
}
