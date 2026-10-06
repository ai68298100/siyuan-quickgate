/**
 * 通知中心数据面（G5-02 · R300）：把散落在恢复中心/队列/轮询退避的"需要关注"聚合为单一通知列表。
 * 纯逻辑独立导出供单测；UI（openNotificationCenter）只消费与接线动作。
 * 通知不改变业务事实——每条都只是"指向已存在处理面"的入口（G5-02：通知关闭≠停止业务执行）。
 */

export type NotifyLevel = "err" | "warn" | "info";
export type NotifyAction = "recovery" | "queue" | "connection" | "none";

export interface NotifyInput {
    recoveryCount: number;
    pendingCommands: number;
    lateCompletions: number;
    /** 轮询连续失败次数（>0 即退避中） */
    consecutiveFailures: number;
    bridgeRunning: boolean;
    /** 最近 24h 失败命令数（审计尾部聚合；0 或缺省不产生通知） */
    failed24h?: number;
}

export interface NotificationItem {
    level: NotifyLevel;
    title: string;
    detail: string;
    action: NotifyAction;
}

export function buildNotifications(input: NotifyInput): NotificationItem[] {
    const out: NotificationItem[] = [];
    if (input.consecutiveFailures > 0) {
        out.push({
            level: "err",
            title: `轮询连续失败 ${input.consecutiveFailures} 次（指数退避中）`,
            detail: "命令可能未被消费——请检查内核与存储是否可写；恢复后自动继续。",
            action: "connection",
        });
    }
    if (input.failed24h && input.failed24h > 0) {
        out.push({
            level: "warn",
            title: `最近 24h 有 ${input.failed24h} 条失败命令`,
            detail: "失败不计入重试——可在审计日志按 status=failed 筛选核对，或导出诊断包定位。",
            action: "queue",
        });
    }
    if (input.recoveryCount > 0) {
        out.push({
            level: input.recoveryCount > 2 ? "err" : "warn",
            title: `${input.recoveryCount} 项待恢复（unknown / 失败 / 过期）`,
            detail: "unknown 不自动重试——需人工核对后选择重试或放弃。",
            action: "recovery",
        });
    }
    if (input.pendingCommands > 0) {
        out.push({
            level: "warn",
            title: `${input.pendingCommands} 条命令积压未消费`,
            detail: "可能为目标设备不匹配或桥短暂离线——积压命令在 TTL 内仍会被消费。",
            action: "queue",
        });
    }
    if (input.lateCompletions > 0) {
        out.push({
            level: "info",
            title: `${input.lateCompletions} 次迟到完成`,
            detail: "超时已先行回执 failed，但底层操作稍后完成——副作用可能已发生，请按 op 核对。",
            action: "queue",
        });
    }
    if (!input.bridgeRunning) {
        out.push({
            level: "info",
            title: "外部命令桥未运行",
            detail: "默认关；开启后外部程序（Quicker / CLI / MCP）才能发命令进来。",
            action: "connection",
        });
    }
    if (out.length === 0) {
        out.push({ level: "info", title: "一切正常", detail: "无待恢复、无积压、无退避。", action: "none" });
    }
    return out.sort((a, b) => rank(b.level) - rank(a.level));
}

function rank(level: NotifyLevel): number {
    return level === "err" ? 3 : level === "warn" ? 2 : 1;
}
