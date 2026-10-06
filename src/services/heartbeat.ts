/**
 * 桥消费权心跳（docs/34 §3.1 · L571/L627 规格）：
 * 持有窗口限流落盘 heartbeat.json；其他窗口按心跳年龄判定 健康/卡死嫌疑/高度失联/无法判断。
 * 心跳只覆盖"持有窗口存活但轮询卡死"缺口；窗口崩溃由 Web Locks 自动释放自愈（规格 §1）。
 */
import { KernelApi } from "./kernelApi";

export const HEARTBEAT_STALE_MS = 15_000;
export const HEARTBEAT_SUSPECT_MS = 60_000;
export const HEARTBEAT_MIN_WRITE_MS = 2_000;

export interface HeartbeatInfo {
    holder: string;
    ts: string;
    pollMs: number;
}

export type HeartbeatLevel = "healthy" | "stale" | "suspect" | "unknown";

export function heartbeatPath(basePath: string): string {
    return `${basePath}/heartbeat.json`;
}

/** 心跳落盘限流（≥2s，docs/34 §3.1）——纯函数便于单测 */
export function shouldWriteHeartbeat(lastWriteMs: number, nowMs: number): boolean {
    return nowMs - lastWriteMs >= HEARTBEAT_MIN_WRITE_MS;
}

export async function writeHeartbeat(api: KernelApi, path: string, info: HeartbeatInfo): Promise<void> {
    await api.putFileText(path, JSON.stringify(info));
}

/** 读取心跳；缺失/损坏返回 null（检测方按"无法判断"降级——docs/34 §3.2 诚实原则） */
export async function readHeartbeat(api: KernelApi, path: string): Promise<HeartbeatInfo | null> {
    try {
        const raw = await api.getFileText(path);
        if (!raw) return null;
        const obj = JSON.parse(raw) as Partial<HeartbeatInfo>;
        if (typeof obj.holder !== "string" || typeof obj.ts !== "string" || typeof obj.pollMs !== "number") return null;
        return { holder: obj.holder, ts: obj.ts, pollMs: obj.pollMs };
    } catch {
        return null;
    }
}

/** 心跳年龄分档：healthy（≤15s）/ stale（15~60s 卡死嫌疑）/ suspect（>60s 高度失联）/ unknown */
export function classifyHeartbeat(info: HeartbeatInfo | null, nowMs: number): { level: HeartbeatLevel; ageMs: number | null } {
    if (!info) return { level: "unknown", ageMs: null };
    const t = Date.parse(info.ts);
    if (!Number.isFinite(t)) return { level: "unknown", ageMs: null };
    const ageMs = Math.max(0, nowMs - t);
    if (ageMs <= HEARTBEAT_STALE_MS) return { level: "healthy", ageMs };
    if (ageMs <= HEARTBEAT_SUSPECT_MS) return { level: "stale", ageMs };
    return { level: "suspect", ageMs };
}
