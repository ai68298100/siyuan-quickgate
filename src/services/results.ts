/**
 * 回执文件（results.ndjson）的纯函数：追加 + 滚动裁剪 200 行。
 * IO 由调用方注入（内核文件 API / 测试内存）。
 */
import { BridgeReceipt } from "../types/bridge";

export const RESULTS_MAX_LINES = 200;

export function appendReceipt(existingText: string, receipt: BridgeReceipt): string {
    const lines = existingText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
    lines.push(JSON.stringify(receipt));
    return lines.slice(-RESULTS_MAX_LINES).join("\n") + "\n";
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
