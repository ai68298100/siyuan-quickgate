/**
 * 命令队列消费与压缩（纯函数）。
 *
 * 阻断项1 修正（docs/09）：不再"执行后用剩余行覆盖整文件"——那会在消费期间丢失外部并发追加。
 * 新算法：
 *   1. 消费者按 id 记账（processedIds 持久化，阻断项4）；
 *   2. 压缩时仅移除"已处理 id"的行，未处理行（含压缩窗口期内新追加的行）原样保留；
 *   3. 外部并发追加若基于旧快照写回，最多造成"已处理行复活"，下一次轮询按 id 跳过并再次压缩——
 *      不丢新命令，不重复执行。数学上不存在丢失窗口：任何写回都包含外部读到的全部未处理行。
 */
export interface QueueLine<T> {
    line: number;
    text: string;
    command?: T;
}

export function mapLines<T>(text: string, parse: (line: string, no: number) => T | undefined): QueueLine<T>[] {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((t, i) => ({ line: i, text: t, command: parse(t, i) }))
        .filter((l) => l.text.trim() !== "");
}

/**
 * 计算压缩后的文件内容：移除「已处理 id」的行与「不可跟踪」的行（坏 JSON / 合法 JSON 但无可跟踪 id——
 * 与 envelope.parseLine 的坏行判定保持同一分类），其余原样保留。
 */
export function compactCommands(
    text: string,
    processedIds: Set<string>,
    opts?: { dropBadLines?: boolean }
): string {
    const dropBad = opts?.dropBadLines ?? false;
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const kept = lines.filter((raw) => {
        const t = raw.trim();
        if (t === "") return false; // 空行直接压缩掉
        let id: unknown;
        try {
            const obj = JSON.parse(t);
            id = obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>).id : undefined;
        } catch {
            id = undefined;
        }
        if (typeof id === "string") {
            return !processedIds.has(id); // 有 id：按记账移除
        }
        return !dropBad; // 无可跟踪 id（坏行）：默认保留，dropBadLines=true 时移除
    });
    return kept.join("\n");
}

/** LRU 淘汰：processed 超过 cap 时按时间戳淘汰最旧（阻断项4 的边界） */
export function capProcessed(processed: Record<string, number>, cap: number): Record<string, number> {
    const entries = Object.entries(processed);
    if (entries.length <= cap) return processed;
    entries.sort((a, b) => a[1] - b[1]);
    const next: Record<string, number> = {};
    for (const [id, ts] of entries.slice(entries.length - cap)) {
        next[id] = ts;
    }
    return next;
}
