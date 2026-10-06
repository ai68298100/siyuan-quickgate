/**
 * 恢复中心数据面（G5 · R294）：unknown/failed/expired 回执的人工处理面。
 * 数据源：results.ndjson 尾部回执 × commands.ndjson 现存信封 × 处置台账（resolved.json）。
 * 语义（承接 L655）：unknown 不自动重试——重试=换新 id 重发原信封（写操作经确认门控），
 * 或人工核对后放弃并记录。纯逻辑独立导出供单测。
 */

const RECOVERY_STATUSES = new Set(["unknown", "failed", "expired"]);

export interface RecoveryItem {
    id: string;
    op: string;
    status: string;
    finishedAt: string;
    message: string;
    /** 原命令信封仍在队列文件中 → 可换新 id 重试（args 可得） */
    canRetry: boolean;
}

function parseLine(line: string): Record<string, unknown> | null {
    const t = line.trim();
    if (!t) return null;
    try { return JSON.parse(t) as Record<string, unknown>; } catch { return null; }
}

/**
 * 合成恢复条目：results 尾部回执按 id 取**最新一条**；只收 unknown/failed/expired；
 * 已处置（resolved 台账）过滤；canRetry=原命令信封仍在队列文件（args 可得）。
 * 按 finishedAt 新→旧排序。
 */
export function buildRecoveryItems(
    receiptLines: string[],
    commandLines: string[],
    resolved: Record<string, { at: string; action: string }>,
): RecoveryItem[] {
    const lastById = new Map<string, Record<string, unknown>>();
    for (const line of receiptLines) {
        const o = parseLine(line);
        if (!o || typeof o.id !== "string") continue;
        lastById.set(o.id, o); // 后行覆盖前行 = 最新
    }
    const cmdLineById = new Map<string, string>();
    for (const line of commandLines) {
        const o = parseLine(line);
        if (!o || typeof o.id !== "string") continue;
        cmdLineById.set(o.id, line);
    }
    const items: RecoveryItem[] = [];
    for (const [id, o] of lastById) {
        const status = String(o.status ?? "");
        if (!RECOVERY_STATUSES.has(status)) continue;
        if (resolved[id]) continue;
        items.push({
            id,
            op: String(o.op ?? "(unknown)"),
            status,
            finishedAt: String(o.finishedAt ?? ""),
            message: String(o.message ?? ""),
            canRetry: cmdLineById.has(id),
        });
    }
    return items.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
}

/**
 * 构造重试信封（换新 id 重发）：沿用原 op/args/device，createdAt 刷新、ttl 重置 60s。
 * 原行不可解析时返回 null（调用方禁用重试按钮）。
 */
export function buildRetryEnvelope(originalLine: string, newId: string, now = new Date()): string | null {
    const o = parseLine(originalLine);
    if (!o || typeof o.op !== "string") return null;
    const envelope: Record<string, unknown> = {
        v: 1,
        id: newId,
        op: o.op,
        args: o.args ?? {},
        createdAt: now.toISOString(),
        ttlMs: 60000,
    };
    if (typeof o.device === "string" && o.device) envelope.device = o.device;
    return JSON.stringify(envelope);
}
