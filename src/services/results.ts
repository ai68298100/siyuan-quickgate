/**
 * 回执文件（results.ndjson）的纯函数：追加 + 滚动裁剪 200 行。
 * IO 由调用方注入（内核文件 API / 测试内存）。
 */
import { BridgeReceipt } from "../types/bridge";

export const RESULTS_MAX_LINES = 200;

export interface AppendTrimOptions {
    /** 天数保留（L630 R-A）：>0 时追加后按 finishedAt 剔除超期行；默认 0=关（行为与旧版逐字节一致，零额外解析开销） */
    retentionDays?: number;
    /** 时钟注入（测试） */
    nowMs?: number;
}

export function appendReceipt(existingText: string, receipt: BridgeReceipt, opts?: AppendTrimOptions): string {
    const lines = existingText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
    lines.push(JSON.stringify(receipt));
    const trimmed = lines.slice(-RESULTS_MAX_LINES);
    if (opts?.retentionDays && opts.retentionDays > 0) {
        const cutoff = (opts.nowMs ?? Date.now()) - opts.retentionDays * 86_400_000;
        const kept = trimmed.filter((l) => {
            try {
                const t = Date.parse((JSON.parse(l) as BridgeReceipt).finishedAt);
                // 时间不可解析的行（坏行/未知行）按保留处理——人工核对权高于空间节约
                return !Number.isFinite(t) || t >= cutoff;
            } catch { return true; }
        });
        return kept.join("\n") + "\n";
    }
    return trimmed.join("\n") + "\n";
}

/** 逐行解析回执（阻断项8：禁止 Contains 匹配，必须逐行 JSON.parse 后按字段取值） */
export function findReceiptById(existingText: string, id: string): BridgeReceipt | undefined {
    for (const line of existingText.replace(/\r\n/g, "\n").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
            const obj = JSON.parse(t);
            if (obj && typeof obj === "object" && (obj as Record<string, unknown>).id === id) {
                return obj as BridgeReceipt;
            }
        } catch {
            // 坏行跳过
        }
    }
    return undefined;
}
