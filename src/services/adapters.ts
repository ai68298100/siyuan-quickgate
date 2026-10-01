/**
 * 数据透传适配器（08-O1）：打卡 v5 / 人脉 bridge v1 的公开窗口桥转发。
 * 纪律：只调用公开桥方法，能力协商后调用；缺席/未就绪/能力缺失 → unsupported，不阻断宿主。
 * 纯逻辑（桥实例注入），单测可 mock。
 */

export interface CheckinBridgeLike {
    protocolName?: string;
    apiVersion?: number;
    whenReady?: () => Promise<unknown>;
    isReady?: () => boolean;
    hasCapability?: (name: string) => boolean;
    getItems?: () => unknown[];
    queryItems?: (args: unknown) => Promise<unknown[]> | unknown[];
    recordEvent?: (args: unknown) => Promise<unknown> | unknown;
    /** 批量接口（唯一接受 occurredAt 的写入路径）；返回 BatchEntryResult[]（kind: recorded|duplicate|discarded|blocked|rejected） */
    recordEventsBatch?: (inputs: unknown[]) => Promise<unknown> | unknown;
    /** v18.16 公开面核实：无 getSummary；summary 由 getSummaryContext("day") + getStreaks 组合（v0.5.6 修正）。
     *  getStreaks 实际返回数组 {itemId,current,longest,milestones?}[]（v0.5.7 审计），适配器归一为映射。 */
    getSummaryContext?: (range: "day" | "week" | "month") => Promise<unknown> | unknown;
    getStreaks?: (itemIds: string[]) => Promise<unknown> | unknown;
}

export interface ContactsBridgeLike {
    protocol?: number;
    searchPeople?: (kw?: string) => Promise<unknown[]>;
    ensurePerson?: (name: string) => Promise<unknown>;
    recordInteraction?: (docIds: string[], meta?: unknown) => Promise<unknown>;
}

export type BridgeResult =
    | { status: "recorded"; data: unknown; message: string }
    | { status: "unsupported"; data: null; message: string }
    | { status: "rejected"; data: null; message: string }
    | { status: "failed"; data: null; message: string };

const REFETCH_WAIT_MS = 200;
const READY_TIMEOUT_MS = 5000;

async function waitReady(bridge: CheckinBridgeLike): Promise<boolean> {
    if (typeof bridge.isReady === "function" && bridge.isReady()) return true;
    if (typeof bridge.whenReady !== "function") return true; // 旧形状：无协商，直接试
    const winner = await Promise.race([
        bridge.whenReady().then(() => true).catch(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(false), READY_TIMEOUT_MS)),
    ]);
    return winner === true;
}

/* ---------------- 打卡 v5 ---------------- */

export async function checkinItems(
    getBridge: () => CheckinBridgeLike | undefined,
    args: { includeArchived?: boolean; limit?: number }
): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.hasCapability !== "function" || !b.hasCapability("items.read")) {
        return { status: "unsupported", data: null, message: "小驴打卡未安装或无 items.read 能力" };
    }
    if (!(await waitReady(b))) {
        return { status: "unsupported", data: null, message: "小驴打卡数据未就绪（超时 5s）" };
    }
    try {
        let items: unknown[] = [];
        if (typeof b.queryItems === "function") {
            items = (await b.queryItems({ includeArchived: args.includeArchived ?? false })) as unknown[];
        } else if (typeof b.getItems === "function") {
            items = (b.getItems() as unknown[]).filter((i) => {
                if (args.includeArchived) return true;
                return !(i as { archived?: boolean })?.archived;
            });
        } else {
            return { status: "unsupported", data: null, message: "打卡桥缺少 items 读取方法" };
        }
        const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
        const view = items.slice(0, limit).map((i) => {
            const o = i as Record<string, unknown>;
            return { id: o.id, name: o.name, kind: o.kind, unit: o.unit, archived: o.archived };
        });
        return { status: "recorded", data: { items: view }, message: `共 ${items.length} 项，返回前 ${view.length} 项` };
    } catch (e) {
        return { status: "failed", data: null, message: `打卡读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function checkinRecord(
    getBridge: () => CheckinBridgeLike | undefined,
    args: { itemId?: unknown; value?: unknown; unit?: unknown; note?: unknown; occurredAt?: unknown },
    externalRef: string
): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.hasCapability !== "function" || !b.hasCapability("events.record")) {
        return { status: "unsupported", data: null, message: "小驴打卡未安装或无 events.record 能力" };
    }
    if (typeof args.itemId !== "string" || !args.itemId) {
        return { status: "rejected", data: null, message: "itemId 缺失" };
    }
    if (!(await waitReady(b))) {
        return { status: "unsupported", data: null, message: "小驴打卡数据未就绪（超时 5s）" };
    }
    try {
        const base = {
            itemId: args.itemId,
            value: typeof args.value === "number" ? args.value : 1,
            unit: typeof args.unit === "string" ? args.unit : undefined,
            note: typeof args.note === "string" ? args.note : undefined,
            // v0.5.7 审计：上游 source 白名单（manual/tomato/import/api/sireader/siplayer/weread/yeguif）
            // 外值静默归一为 "api"——quickgate 不是合法 source，直接传 "api"，身份由 externalRef 承担
            source: "api" as const,
            externalRef,
        };

        // occurredAt 只有批量接口接受（单条 recordEvent 会静默忽略→时间被记成现在）：
        // 带 occurredAt 时走 recordEventsBatch 并把 BatchEntryResult 映射回快门状态
        if (typeof args.occurredAt === "string" && args.occurredAt) {
            const batch = b.recordEventsBatch;
            if (typeof batch !== "function") {
                return { status: "unsupported", data: null, message: "打卡桥缺少 recordEventsBatch，无法按指定时间记录（occurredAt）" };
            }
            const results = (await batch([{
                ...base, occurredAt: args.occurredAt,
            }])) as Array<{ kind?: string; eventId?: string; reason?: string }> | undefined;
            const entry = Array.isArray(results) ? results[0] : undefined;
            const kind = entry?.kind ?? "rejected";
            if (kind === "recorded" || kind === "duplicate") {
                return {
                    status: "recorded",
                    data: { eventId: entry?.eventId ?? null, duplicate: kind === "duplicate" },
                    message: kind === "duplicate" ? "已存在（幂等命中，未重复记录）" : "已按指定时间记录",
                };
            }
            return { status: "rejected", data: null, message: `打卡桥拒绝（${kind}${entry?.reason ? `：${entry.reason}` : ""}）` };
        }

        const data = await b.recordEvent?.(base);
        if (data === undefined) {
            return { status: "rejected", data: null, message: "打卡桥拒绝了该记录（参数非法或事项不可用）" };
        }
        return { status: "recorded", data, message: "已记录" };
    } catch (e) {
        return { status: "failed", data: null, message: `打卡记录失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function checkinSummary(getBridge: () => CheckinBridgeLike | undefined): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.hasCapability !== "function" || !b.hasCapability("summary.read")) {
        return { status: "unsupported", data: null, message: "小驴打卡未安装或无 summary.read 能力" };
    }
    if (!(await waitReady(b))) {
        return { status: "unsupported", data: null, message: "小驴打卡数据未就绪（超时 5s）" };
    }
    try {
        // v0.5.6 修正：上游 v18.16 公开面没有 getSummary 方法（此前可选调用静默返回空数据）。
        // 组合 getSummaryContext("day")（SummaryContext：range/startDate/endDate/items/totalEvents/
        // completedItems/scheduledItems）与 getStreaks。
        // v0.5.7 审计：getStreaks 实际返回数组 {itemId,current,longest,milestones?}[]——归一为映射，
        // 消费方拿到的 {streaks:{itemId:当前连击}, streaksLongest:{itemId:最长连击}} 与文档一致。
        const gc = b.getSummaryContext;
        const today = typeof gc === "function" ? await gc("day") : null;

        let streaks: unknown = null;
        let streaksLongest: unknown = null;
        if (typeof b.getStreaks === "function" && typeof b.getItems === "function") {
            const ids = (b.getItems() ?? [])
                .map((i) => String((i as { id?: unknown })?.id ?? ""))
                .filter((s) => s.length > 0);
            if (ids.length > 0) {
                const raw = await b.getStreaks(ids);
                const cur: Record<string, number> = {};
                const longest: Record<string, number> = {};
                for (const row of Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []) {
                    const id = typeof row?.itemId === "string" ? row.itemId : "";
                    if (!id) continue;
                    if (typeof row.current === "number") cur[id] = row.current;
                    if (typeof row.longest === "number") longest[id] = row.longest;
                }
                streaks = cur;
                streaksLongest = longest;
            } else {
                streaks = {};
                streaksLongest = {};
            }
        }

        if (today === null && streaks === null) {
            return { status: "unsupported", data: null, message: "打卡桥缺少 summary 方法（getSummaryContext/getStreaks 均不可用；v18.16 公开面已核实无 getSummary）" };
        }
        return { status: "recorded", data: { today, streaks, streaksLongest }, message: "已读取（今日上下文 + 连击）" };
    } catch (e) {
        return { status: "failed", data: null, message: `汇总读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

/* ---------------- 人脉 v1 ---------------- */

export async function contactsSearch(
    getBridge: () => ContactsBridgeLike | undefined,
    args: { keyword?: unknown }
): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.protocol !== "number" || typeof b.searchPeople !== "function") {
        return { status: "unsupported", data: null, message: "小驴人脉未安装或协议不可用" };
    }
    try {
        const kw = typeof args.keyword === "string" ? args.keyword : "";
        const people = (await b.searchPeople(kw)).slice(0, 50);
        return { status: "recorded", data: { people }, message: `命中 ${people.length} 人` };
    } catch (e) {
        return { status: "failed", data: null, message: `人脉搜索失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function contactsEnsure(
    getBridge: () => ContactsBridgeLike | undefined,
    args: { name?: unknown }
): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.ensurePerson !== "function") {
        return { status: "unsupported", data: null, message: "小驴人脉未安装或协议不可用" };
    }
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name || name.length > 64) {
        return { status: "rejected", data: null, message: "name 缺失或超长（≤64 字符）" };
    }
    try {
        const data = await b.ensurePerson(name);
        return { status: "recorded", data, message: "已收编/复用" };
    } catch (e) {
        return { status: "failed", data: null, message: `收编失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

/** 名字分隔兼容：中英文逗号、顿号、分号、空白 */
export function splitNames(input: unknown): string[] {
    if (typeof input !== "string") return Array.isArray(input) ? input.filter((x): x is string => typeof x === "string") : [];
    return input
        .split(/[,，、;；\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 50);
}

export async function contactsInteraction(
    getBridge: () => ContactsBridgeLike | undefined,
    args: { names?: unknown; docIds?: unknown; date?: unknown; place?: unknown; note?: unknown },
    ref: string
): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.recordInteraction !== "function" || typeof b.ensurePerson !== "function") {
        return { status: "unsupported", data: null, message: "小驴人脉未安装或协议不可用" };
    }
    const names = splitNames(args.names);
    const docIds = Array.isArray(args.docIds) ? args.docIds.filter((x): x is string => typeof x === "string") : [];
    if (names.length + docIds.length === 0) {
        return { status: "rejected", data: null, message: "names/docIds 均为空" };
    }
    try {
        const people: Array<{ name: string; docId: string; created?: boolean }> = [];
        for (const n of names) {
            const p = (await b.ensurePerson(n)) as { docId?: string } | undefined;
            if (p?.docId) people.push({ name: n, docId: p.docId, created: (p as { created?: boolean }).created });
        }
        const ids = [...docIds, ...people.map((p) => p.docId)];
        const data = await b.recordInteraction(ids, {
            ref,
            date: typeof args.date === "string" ? args.date : undefined,
            place: typeof args.place === "string" ? args.place : undefined,
            note: typeof args.note === "string" ? args.note : undefined,
        });
        return { status: "recorded", data: { ...(data as object), people }, message: "已记录共同交集" };
    } catch (e) {
        return { status: "failed", data: null, message: `互动记录失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export const _internal = { waitReady, REFETCH_WAIT_MS, READY_TIMEOUT_MS };
