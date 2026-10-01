/**
 * events 数据源桥接（R3）：把公开宿主事件物化为 events.ndjson。
 * 首个来源：小驴打卡的 checkin:event-recorded（公开宿主事件总线）。
 * 纪律：只消费公开事件，不读私有存储；解析失败静默跳过；幂等键由事件自身携带。
 * 去重：events.pull 的消费方按 idempotencyKey 去重（契约），此处只做尽力而为的去重提示。
 */
import { HubEvent } from "./events";

/** 打卡宿主事件 detail 的防御性形状（window CustomEvent detail；上游 integrations.ts 包裹为 {type, event}） */
export interface CheckinEventDetail {
    itemId?: unknown;
    value?: unknown;
    unit?: unknown;
    occurredAt?: unknown;
    source?: unknown;
    externalRef?: unknown;
}

/** 从 CustomEvent detail 取出 CheckinEvent：兼容上游包裹形状 {type:"event-recorded", event:{…}} 与平铺形状 */
export function unwrapCheckinDetail(detail: unknown): unknown {
    if (!detail || typeof detail !== "object") return detail;
    const w = detail as { type?: unknown; event?: unknown };
    if (w.type === "event-recorded" && w.event && typeof w.event === "object") return w.event;
    return detail;
}

/** 归一化为 HubEvent；不合法返回 null（静默跳过） */
export function normalizeCheckinEvent(detail: unknown, emittedAt: string): HubEvent | null {
    const unwrapped = unwrapCheckinDetail(detail);
    if (!unwrapped || typeof unwrapped !== "object") return null;
    const d = unwrapped as CheckinEventDetail;
    if (typeof d.itemId !== "string" || !d.itemId) return null;
    if (typeof d.occurredAt !== "string") return null;
    const ref = typeof d.externalRef === "string" ? d.externalRef : `${d.itemId}:${d.occurredAt}`;
    return {
        name: "checkin:event-recorded",
        source: "siyuan-checkin",
        emittedAt,
        payload: {
            itemId: d.itemId,
            value: typeof d.value === "number" ? d.value : null,
            unit: typeof d.unit === "string" ? d.unit : null,
            source: typeof d.source === "string" ? d.source : null,
        },
        idempotencyKey: `${d.source ?? "manual"}:${ref}`,
    };
}

/**
 * event-deleted → 删除标记 HubEvent 列表（event 单条 + deletedEvents 批量，均可空）。
 * 幂等键加 `:deleted` 后缀：append-only 载体里与原 recorded 行共存，消费方按键配对应用删除。
 */
export function normalizeCheckinEventDeleted(detail: unknown, emittedAt: string): HubEvent[] {
    if (!detail || typeof detail !== "object") return [];
    const w = detail as { type?: unknown; event?: unknown; deletedEvents?: unknown };
    if (w.type !== "event-deleted") return [];
    const raws: unknown[] = [];
    if (w.event && typeof w.event === "object") raws.push(w.event);
    if (Array.isArray(w.deletedEvents)) {
        raws.push(...w.deletedEvents.filter((x) => x !== null && typeof x === "object"));
    }
    const out: HubEvent[] = [];
    for (const raw of raws) {
        const d = raw as CheckinEventDetail & { id?: unknown };
        if (typeof d.itemId !== "string" || !d.itemId) continue;
        if (typeof d.occurredAt !== "string") continue;
        const ref = typeof d.externalRef === "string" ? d.externalRef : `${d.itemId}:${d.occurredAt}`;
        out.push({
            name: "checkin:event-deleted",
            source: "siyuan-checkin",
            emittedAt,
            payload: {
                itemId: d.itemId,
                eventId: typeof d.id === "string" ? d.id : null,
            },
            idempotencyKey: `${d.source ?? "manual"}:${ref}:deleted`,
        });
    }
    return out;
}

/** 追加事件行（滚动上限与 results 一致） */
export function appendEventLine(existingText: string, event: HubEvent, cap = 200): string {
    const lines = existingText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
    lines.push(JSON.stringify(event));
    return lines.slice(-cap).join("\n") + "\n";
}
