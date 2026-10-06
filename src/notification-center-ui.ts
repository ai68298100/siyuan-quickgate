/**
 * 通知中心 UI（G5-02 · R300）：聚合通知列表（每条含指向已存在处理面的动作按钮）。
 * 通知只是入口，不承载业务逻辑；计数与恢复中心/队列页共享同一数据源。
 */
import { KernelApi } from "./services/kernelApi";
import { BridgeStore } from "./services/store";
import { countRecoveryItems } from "./recovery-center";
import { fmtReceiptTime } from "./results-center";
import { buildNotifications, NotificationItem } from "./notification-center";
import type { QuickGateSettings } from "./types/bridge";

export interface NotificationCenterHost {
    settings: QuickGateSettings;
    kernelApi: KernelApi;
    store: BridgeStore;
    auditLog: { time: string; plugin: string; command: string; status: string; elapsedMs: number }[];
    bridgeAlive(): boolean;
    consecutiveFailures(): number;
    lateCompletions(): number;
    openRecoveryCenter(): void;
    openQueuePage(): void;
    openConnectionPage(): void;
    /** 宿主注入（siyuan 包不可在裸 Node 环境导入） */
    openDialog(content: string): { element: HTMLElement; destroy(): void };
}

async function gather(host: NotificationCenterHost): Promise<NotificationItem[]> {
    let recoveryCount = 0;
    try {
        recoveryCount = await countRecoveryItems(host);
    } catch { /* 读取失败按 0，队列/桥侧通知仍有效 */ }
    // L553/R300 增量：最近 24h 失败命令聚合（审计尾部扫描）
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const failed24h = host.auditLog.filter((a) => a.status === "failed" && a.time >= dayAgo).length;
    const pending = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/commands.ndjson`)) ?? "";
    const pendingCommands = pending.trim() ? pending.trim().split("\n").filter(Boolean).length : 0;
    return buildNotifications({
        recoveryCount,
        pendingCommands,
        lateCompletions: host.lateCompletions(),
        consecutiveFailures: host.consecutiveFailures(),
        bridgeRunning: host.bridgeAlive(),
        failed24h,
    });
}

/** 状态页徽章用：需要关注的通知数（全部 action≠none 的条目） */
export async function countNotifications(host: NotificationCenterHost): Promise<number> {
    return (await gather(host)).filter((n) => n.action !== "none").length;
}

export async function openNotificationCenter(host: NotificationCenterHost): Promise<void> {
    const dialog = host.openDialog(
        `<div id="qg-notify" style="padding:14px 16px;font-size:12px;min-width:min(560px, 92vw)">` +
        `<div class="qg-dlg-head"><span class="qg-dlg-title"><span class="qg-title-logo">门</span>通知中心</span>` +
        `<span style="font-size:11px;color:var(--b3-theme-on-surface-light)">需要关注的事态（↑↓ 选择 · Enter 跳转）</span><span class="sp"></span>` +
        `<button class="b3-button b3-button--small" data-role="refresh">刷新</button></div>` +
        `<div data-role="body" role="region" aria-label="通知列表"></div></div>`,
    );
    dialog.element.querySelector(".b3-dialog__container")?.setAttribute("style", "width:min(640px, 92vw)");
    const body = dialog.element.querySelector("[data-role=body]") as HTMLElement;
    dialog.element.querySelector('[data-role="refresh"]')?.addEventListener("click", () => void refresh());
    // 键盘导航（R315/R330）：容器 tabindex=-1 并在打开后聚焦——否则焦点留在外部触发按钮，
    // ↑↓/Enter 根本收不进本对话框（靶场实测踩坑）
    (dialog.element.querySelector("#qg-notify") as HTMLElement | null)?.setAttribute("tabindex", "-1");
    (dialog.element.querySelector("#qg-notify") as HTMLElement | null)?.focus({ preventScroll: true });
    // 键盘导航（R315）：↑↓ 移动高亮，Enter 触发当前条目动作（与命令面板交互习惯一致）
    let items: NotificationItem[] = [];
    let active = 0;
    dialog.element.addEventListener("keydown", (ev) => {
        const kev = ev as KeyboardEvent;
        if (kev.key === "ArrowDown") { kev.preventDefault(); active = Math.min(active + 1, Math.max(items.length - 1, 0)); paintActive(); }
        else if (kev.key === "ArrowUp") { kev.preventDefault(); active = Math.max(active - 1, 0); paintActive(); }
        else if (kev.key === "Enter") {
            kev.preventDefault();
            const n = items[active];
            if (n && n.action !== "none") {
                dialog.destroy();
                if (n.action === "recovery") host.openRecoveryCenter();
                else if (n.action === "queue") host.openQueuePage();
                else host.openConnectionPage();
            }
        }
    });

    const paintActive = () => {
        // 仅动作卡参与键盘序列——「最近成功」信息卡无跳转动作，混入会错位高亮/Enter 目标
        const actionable = body.querySelectorAll<HTMLElement>(".qg-card:not(.qg-notify-info)");
        actionable.forEach((c, i) => {
            c.classList.toggle("active", i === active);
            c.style.borderColor = i === active ? "var(--b3-theme-primary)" : "";
        });
    };

    const refresh = async () => {
        const itemsNow = await gather(host);
        items = itemsNow;
        active = Math.min(active, Math.max(0, items.length - 1));
        body.textContent = "";
        // 最近成功（G5-02 spec：成功也是通知面的一部分——info 级，不带动作）
        try {
            const text = (await host.kernelApi.getFileText(`${host.settings.bridgeBasePath}/results.ndjson`)) ?? "";
            const lastRecorded = text.split("\n").reverse().map((l) => l.trim()).filter(Boolean)
                .map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
                .find((o) => o && o.status === "recorded");
            if (lastRecorded) {
                const card = document.createElement("div");
                card.className = "qg-card qg-notify-info";
                card.style.cssText = "display:flex;gap:10px;align-items:center;padding:8px 12px;margin-bottom:8px";
                const chip = document.createElement("span");
                chip.className = "qg-chip ok";
                chip.textContent = "最近成功";
                const info = document.createElement("span");
                info.style.color = "var(--b3-theme-on-surface)";
                info.textContent = `${String(lastRecorded.op ?? "?")} · ${fmtReceiptTime(String(lastRecorded.finishedAt ?? ""))}`;
                card.append(chip, info);
                body.appendChild(card);
            }
        } catch { /* 读取失败静默——通知主列表不受影响 */ }
        for (const n of items) {
            const card = document.createElement("div");
            card.className = "qg-card";
            card.style.cssText = "display:flex;gap:10px;align-items:flex-start;padding:10px 12px";
            const chip = document.createElement("span");
            chip.className = `qg-chip ${n.level === "err" ? "err" : n.level === "warn" ? "warn" : "mute"}`;
            chip.textContent = n.level === "err" ? "紧急" : n.level === "warn" ? "提醒" : "提示";
            const text = document.createElement("div");
            text.style.flex = "1";
            const t = document.createElement("div");
            t.style.fontWeight = "500";
            t.textContent = n.title;
            const d = document.createElement("div");
            d.style.cssText = "color:var(--b3-theme-on-surface);margin-top:2px";
            d.textContent = n.detail;
            text.append(t, d);
            card.append(chip, text);
            if (n.action !== "none") {
                const btn = document.createElement("button");
                btn.className = "b3-button b3-button--small";
                btn.textContent = n.action === "recovery" ? "去恢复中心" : n.action === "queue" ? "查看队列" : "连接设置";
                btn.addEventListener("click", () => {
                    dialog.destroy();
                    if (n.action === "recovery") host.openRecoveryCenter();
                    else if (n.action === "queue") host.openQueuePage();
                    else host.openConnectionPage();
                });
                card.appendChild(btn);
            }
            body.appendChild(card);
        }
        paintActive();
    };

    await refresh();
}
