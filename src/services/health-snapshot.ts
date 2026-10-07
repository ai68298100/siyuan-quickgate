import { AuditEntry } from "../types/bridge";

/**
 * A bounded, local-only health view for diagnostics.  The sample window is
 * deliberately scoped to the current plugin instance: the persisted bridge
 * counters are cumulative, while these fields describe what this instance
 * can actually observe.
 */
export interface HealthSnapshotInput {
    sessionStartedAt: number;
    now?: number;
    sessionId?: string;
    audit?: AuditEntry[];
    commandsText?: string | null;
    /** 当前 SSE 实例丢弃的 data 帧数；不作为跨重启累计值。 */
    dropped?: number;
}

export interface HealthEvent {
    at: string;
    kind: string;
    op: string;
}

export interface HealthSnapshot {
    scope: "session";
    sessionId: string;
    startedAt: string;
    sampledAt: string;
    uptimeMs: number;
    sampleWindow: { scope: "session"; startedAt: string; sampledAt: string };
    lastSuccess: HealthEvent | null;
    lastError: HealthEvent | null;
    /** 当前采样窗口内的外部帧丢弃数；队列坏行另见 queue.parseErrors。 */
    drops: number;
    queue: {
        pending: number;
        oldestCreatedAt: string | null;
        oldestAgeMs: number | null;
        parseErrors: number;
    };
}

const successKinds = new Set(["recorded", "duplicate"]);
const errorKinds = new Set(["failed", "rejected", "unsupported", "expired", "unknown"]);

function iso(ts: number): string {
    return new Date(ts).toISOString();
}

function validMs(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Remove audit argument-key hints; diagnostics must never expose command args. */
function auditOp(command: string): string {
    const op = command.split(" args(", 1)[0]?.trim() ?? "";
    return op || "(unknown)";
}

function latestAudit(audit: AuditEntry[] | undefined, kinds: Set<string>, sessionStartedAt: number): HealthEvent | null {
    if (!audit) return null;
    for (let i = audit.length - 1; i >= 0; i -= 1) {
        const entry = audit[i];
        if (!entry || !kinds.has(entry.status) || typeof entry.time !== "string") continue;
        const at = Date.parse(entry.time);
        if (!Number.isFinite(at) || at < sessionStartedAt) continue;
        return { at: entry.time, kind: entry.status, op: auditOp(entry.command) };
    }
    return null;
}

function queueSnapshot(text: string | null | undefined, now: number): HealthSnapshot["queue"] {
    const lines = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim() !== "");
    let parseErrors = 0;
    let oldestAt: number | null = null;
    for (const line of lines) {
        try {
            const value = JSON.parse(line) as { createdAt?: unknown };
            const createdAt = typeof value?.createdAt === "string" ? Date.parse(value.createdAt) : NaN;
            if (Number.isFinite(createdAt) && (oldestAt === null || createdAt < oldestAt)) oldestAt = createdAt;
        } catch {
            parseErrors += 1;
        }
    }
    return {
        pending: lines.length,
        oldestCreatedAt: oldestAt === null ? null : iso(oldestAt),
        oldestAgeMs: oldestAt === null ? null : Math.max(0, now - oldestAt),
        parseErrors,
    };
}

export function buildHealthSnapshot(input: HealthSnapshotInput): HealthSnapshot {
    const now = validMs(input.now, Date.now());
    const started = validMs(input.sessionStartedAt, now);
    const sessionId = input.sessionId?.trim() || `session-${Math.max(0, Math.floor(started)).toString(36)}`;
    const startedAt = iso(started);
    const sampledAt = iso(now);
    return {
        scope: "session",
        sessionId,
        startedAt,
        sampledAt,
        uptimeMs: Math.max(0, now - started),
        sampleWindow: { scope: "session", startedAt, sampledAt },
        lastSuccess: latestAudit(input.audit, successKinds, started),
        lastError: latestAudit(input.audit, errorKinds, started),
        drops: Math.max(0, Math.floor(validMs(input.dropped, 0))),
        queue: queueSnapshot(input.commandsText, now),
    };
}
