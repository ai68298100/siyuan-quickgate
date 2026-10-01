/**
 * 命令信封 parse / normalize / 校验。
 * 纯函数、无 DOM、无网络 —— 单测直接覆盖。
 */
import { BRIDGE_PROTOCOL_VERSION, BridgeCommand } from "../types/bridge";

const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const ARGS_MAX_BYTES = 32 * 1024;

export function fingerprintLine(line: string): string {
    // 简单稳定指纹（非安全用途）：djb2 十六进制前 12 位
    let h = 5381;
    for (let i = 0; i < line.length; i++) {
        h = ((h << 5) + h + line.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0") + (line.length % 9973).toString(16).padStart(4, "0");
}

export type ParsedLine =
    | { kind: "ok"; command: BridgeCommand }
    | { kind: "bad"; line: number; reason: string; fingerprint: string }
    | { kind: "empty" };

export function parseLine(line: string, lineNumber: number): ParsedLine {
    const trimmed = line.trim();
    if (!trimmed) return { kind: "empty" };
    let obj: unknown;
    try {
        obj = JSON.parse(trimmed);
    } catch {
        return { kind: "bad", line: lineNumber, reason: "命令行不是合法 JSON", fingerprint: fingerprintLine(trimmed) };
    }
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return { kind: "bad", line: lineNumber, reason: "命令必须是 JSON 对象", fingerprint: fingerprintLine(trimmed) };
    }
    const raw = obj as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!ID_RE.test(id)) {
        return { kind: "bad", line: lineNumber, reason: "id 缺失或格式非法（≤64 位字母数字-_）", fingerprint: fingerprintLine(trimmed) };
    }
    const op = typeof raw.op === "string" ? raw.op : "";
    if (!op) {
        return { kind: "bad", line: lineNumber, reason: "op 缺失", fingerprint: fingerprintLine(trimmed) };
    }
    const args = (raw.args ?? {}) as Record<string, unknown>;
    if (JSON.stringify(args).length > ARGS_MAX_BYTES) {
        return { kind: "bad", line: lineNumber, reason: "args 超过 32KB 上限", fingerprint: fingerprintLine(trimmed) };
    }
    const command: BridgeCommand = {
        v: typeof raw.v === "number" ? raw.v : BRIDGE_PROTOCOL_VERSION,
        id,
        op,
        args,
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
        ttlMs: typeof raw.ttlMs === "number" ? raw.ttlMs : 60000,
        reply: raw.reply === false ? false : true,
        device: typeof raw.device === "string" ? raw.device : undefined,
        line: lineNumber,
    };
    if (command.v !== BRIDGE_PROTOCOL_VERSION) {
        return { kind: "bad", line: lineNumber, reason: `协议版本不支持：${command.v}`, fingerprint: fingerprintLine(trimmed) };
    }
    return { kind: "ok", command };
}

export function splitLines(text: string): string[] {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function isExpired(command: BridgeCommand, now = Date.now()): boolean {
    if (!command.createdAt) return true; // 缺省 createdAt 视为已过期（协议 §2）
    const created = Date.parse(command.createdAt);
    if (Number.isNaN(created)) return true;
    return now - created > (command.ttlMs ?? 60000);
}
