/**
 * events.* 文件载体实现（M2，契约草案 docs/contracts/events-workflow-draft.md）。
 * 载体：各来源插件在自己的桥目录追加 events.ndjson（与命令桥同构：NDJSON、白名单、幂等键）。
 * 快门只读不写；白名单来自 ecosystem-manifests（status=available 的 events）。
 * spike⑤ 若证实广播可用，可加 push 级订阅——pull 语义保持不变（载体可替换，契约稳定）。
 */
import { EcosystemManifest } from "./bridge-service";

export interface HubEvent {
    name: string;
    source: string;
    emittedAt: string;
    payload: unknown;
    idempotencyKey: string;
}

/** manifest → 白名单（source=available 的事件） */
export function eventWhitelist(manifest: EcosystemManifest): Map<string, { source: string; idempotency: string }> {
    const map = new Map<string, { source: string; idempotency: string }>();
    for (const p of manifest.plugins) {
        for (const e of (p as unknown as { events?: Array<{ name: string; idempotency?: string; status?: string }> }).events ?? []) {
            if (e.status === "available" || p.maturity === "stable") {
                map.set(e.name, { source: p.pluginId, idempotency: e.idempotency ?? "idempotencyKey" });
            }
        }
    }
    return map;
}

export function parseEventLine(line: string, sourceFile: string): HubEvent | undefined {
    const t = line.trim();
    if (!t) return undefined;
    try {
        const o = JSON.parse(t) as Record<string, unknown>;
        if (typeof o.name !== "string" || typeof o.emittedAt !== "string" || typeof o.idempotencyKey !== "string") return undefined;
        return {
            name: o.name,
            source: typeof o.source === "string" ? o.source : sourceFile,
            emittedAt: o.emittedAt,
            payload: o.payload ?? null,
            idempotencyKey: o.idempotencyKey,
        };
    } catch {
        return undefined; // 坏行跳过（与回执解析同纪律）
    }
}

export interface PullOptions {
    names?: string[];
    since?: string;
    limit?: number;
}

/**
 * 拉取：白名单过滤 → since 过滤（emittedAt > since）→ idempotencyKey 去重 → limit 截断。
 * 入参为逐文件文本（file 归属真实来源）；idempotencyKey 去重与内核路径 kernelEventsPull 同口径
 * （R69-P1：双路径一致——跨源文件重复行只保留先到者）。
 */
export function pullEvents(texts: Array<{ file: string; text: string }>, whitelist: Map<string, { source: string }>, opts: PullOptions): HubEvent[] {
    const out: HubEvent[] = [];
    const sinceTs = opts.since ? Date.parse(opts.since) : NaN;
    const seen = new Set<string>();
    for (const { file, text } of texts) {
        for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
            if (out.length >= (opts.limit ?? 200)) return out;
            const e = parseEventLine(line, file);
            if (!e) continue;
            if (!whitelist.has(e.name)) continue;
            if (opts.names && !opts.names.includes(e.name)) continue;
            if (!Number.isNaN(sinceTs) && Date.parse(e.emittedAt) <= sinceTs) continue;
            if (seen.has(e.idempotencyKey)) continue;
            seen.add(e.idempotencyKey);
            out.push(e);
        }
    }
    return out.slice(0, opts.limit ?? 200);
}
