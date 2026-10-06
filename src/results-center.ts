/**
 * 结果中心数据面（G5-01 · R302）：results.ndjson 回执的解析/过滤/分页纯函数。
 * 文件追加序=时间序（旧→新）；UI 展示倒序（新→旧）。坏行跳过不进结果面。
 */

export interface ReceiptRow {
    id: string;
    op: string;
    status: string;
    finishedAt: string;
    elapsedMs: number;
    message: string;
    raw: string;
}

export function parseReceiptLines(lines: string[]): ReceiptRow[] {
    const out: ReceiptRow[] = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
            const o = JSON.parse(t) as Record<string, unknown>;
            if (typeof o.id !== "string" || typeof o.status !== "string") continue;
            out.push({
                id: o.id,
                op: typeof o.op === "string" ? o.op : "(unknown)",
                status: o.status,
                finishedAt: typeof o.finishedAt === "string" ? o.finishedAt : "",
                elapsedMs: typeof o.elapsedMs === "number" ? o.elapsedMs : 0,
                message: typeof o.message === "string" ? o.message : "",
                raw: t,
            });
        } catch { /* 坏行跳过 */ }
    }
    return out;
}

/** 状态筛选 + 关键词（id/op/message 任一命中，大小写不敏感）+ 时间范围（**本地日界**语义：
 *  "today"=本地今天 0 点起、"7d"=近 7 天；用户心智为本地日，勿用 UTC 前缀比对——R314 测试实证踩坑）；
 *  返回仍为旧→新 */
export function filterReceipts(rows: ReceiptRow[], opts: { status?: string; q?: string; since?: "today" | "7d" | "all" }): ReceiptRow[] {
    const q = opts.q?.trim().toLowerCase() ?? "";
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOf7d = startOfToday.getTime() - 6 * 86400_000; // 含今天共 7 天
    return rows.filter((r) => {
        if (opts.status && opts.status !== "all" && r.status !== opts.status) return false;
        if (opts.since && opts.since !== "all") {
            const t = Date.parse(r.finishedAt);
            if (!Number.isFinite(t)) return false;
            if (opts.since === "today" && t < startOfToday.getTime()) return false;
            if (opts.since === "7d" && t < startOf7d) return false;
        }
        if (q && !`${r.id} ${r.op} ${r.message}`.toLowerCase().includes(q)) return false;
        return true;
    });
}

/** 倒序（新→旧）分页切片 */
export function pageNewestFirst(rows: ReceiptRow[], offset: number, limit: number): ReceiptRow[] {
    const sliced = rows.slice().reverse().slice(offset, offset + limit);
    return sliced;
}

/** 状态枚举（筛选下拉用）：从实际数据归纳 + 常量全集，保证有数据才出现选项 */
export function collectStatuses(rows: ReceiptRow[]): string[] {
    const known = ["recorded", "duplicate", "rejected", "failed", "unsupported", "expired", "unknown"];
    const set = new Set<string>();
    for (const r of rows) if (known.includes(r.status)) set.add(r.status);
    for (const s of known) if (rows.some((r) => r.status === s)) set.add(s);
    return [...set];
}

/** 回执时间 → 本地 HH:mm:ss（信封 finishedAt 是 ISO UTC，slice(11,19) 会错位显示——一律经 Date 转本地） */
export function fmtReceiptTime(finishedAt: string): string {
    const t = Date.parse(finishedAt);
    if (!Number.isFinite(t)) return "–";
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 耗时人性化：<10s 显示 ms（等宽数字），≥10s 升秒保留 1 位（30012ms → 30.0s） */
export function fmtElapsedMs(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "–";
    return ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
