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

/* ---------------- 拾遗 v1（window.siyuanGlean，契约=上游 docs/BRIDGE.md） ---------------- */

/** 拾遗五态（上游 domain/schema CLIP_STATUSES；写面校验用） */
export const GLEAN_CLIP_STATUSES = ["inbox", "later", "reading", "done", "archived"] as const;

export interface GleanBridgeLike {
    apiVersion?: number;
    version?: string;
    listClips?: (filter?: unknown) => Promise<unknown[]>;
    getClip?: (id: string) => Promise<unknown>;
    setClipStatus?: (id: string, status: string) => Promise<void>;
}

/** 上游 getClip 的文档 id 形状：YYYYMMDDHHmmss-xxxxxxx（后七位小写字母/数字） */
const GLEAN_DOC_ID = /^\d{14}-[0-9a-z]{7}$/;

const GLEAN_MISSING = "小驴拾遗未安装或无 window.siyuanGlean v1 桥";

/** 桥协商：apiVersion=1 才可用（strict:false 下不用判别联合守卫，直接回桥实例或 undefined） */
function gleanBridgeOf(getBridge: () => unknown): GleanBridgeLike | undefined {
    const b = getBridge() as GleanBridgeLike | undefined;
    return b && b.apiVersion === 1 ? b : undefined;
}

export async function gleanList(
    getBridge: () => unknown,
    args: { status?: unknown; site?: unknown; tag?: unknown; aiTag?: unknown; keyword?: unknown; direction?: unknown; limit?: unknown; offset?: unknown }
): Promise<BridgeResult> {
    const b = gleanBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: GLEAN_MISSING };
    if (typeof b.listClips !== "function") {
        return { status: "unsupported", data: null, message: "拾遗桥缺少 listClips 方法" };
    }
    // 本地预校验（与上游 normalizeFilter 同口径早失败：TypeError/RangeError 归 rejected，不靠上游错误语义）
    const status = args.status === undefined || args.status === null ? undefined : args.status;
    if (status !== undefined && status !== "all" && !(GLEAN_CLIP_STATUSES as readonly unknown[]).includes(status)) {
        return { status: "rejected", data: null, message: `status 须为 ${GLEAN_CLIP_STATUSES.join("/")} 或 all` };
    }
    for (const k of ["site", "tag", "aiTag", "keyword"] as const) {
        if (args[k] !== undefined && typeof args[k] !== "string") {
            return { status: "rejected", data: null, message: `${k} 须为字符串` };
        }
    }
    const direction = args.direction === undefined ? undefined : args.direction;
    if (direction !== undefined && direction !== "asc" && direction !== "desc") {
        return { status: "rejected", data: null, message: "direction 须为 asc 或 desc" };
    }
    let limit: number | undefined;
    if (args.limit !== undefined && args.limit !== null) {
        if (!Number.isSafeInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > 200) {
            return { status: "rejected", data: null, message: "limit 须为 1–200 整数" };
        }
        limit = args.limit as number;
    }
    let offset: number | undefined;
    if (args.offset !== undefined && args.offset !== null) {
        if (!Number.isSafeInteger(args.offset) || (args.offset as number) < 0) {
            return { status: "rejected", data: null, message: "offset 须为非负整数" };
        }
        offset = args.offset as number;
    }
    try {
        const clips = (await b.listClips({
            status, site: args.site, tag: args.tag, aiTag: args.aiTag, keyword: args.keyword,
            direction, limit, offset,
        })) as unknown[];
        const list = Array.isArray(clips) ? clips : [];
        return { status: "recorded", data: { clips: list, count: list.length }, message: `命中 ${list.length} 条` };
    } catch (e) {
        return { status: "failed", data: null, message: `拾遗读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function gleanGet(getBridge: () => unknown, args: { id?: unknown }): Promise<BridgeResult> {
    const b = gleanBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: GLEAN_MISSING };
    if (typeof b.getClip !== "function") {
        return { status: "unsupported", data: null, message: "拾遗桥缺少 getClip 方法" };
    }
    if (typeof args.id !== "string" || !GLEAN_DOC_ID.test(args.id)) {
        return { status: "rejected", data: null, message: "id 缺失或形状非法（YYYYMMDDHHmmss-xxxxxxx）" };
    }
    try {
        const clip = await b.getClip(args.id);
        return { status: "recorded", data: { clip: clip ?? null }, message: clip ? "已读取" : "不存在（或非已收录文档）" };
    } catch (e) {
        return { status: "failed", data: null, message: `拾遗读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function gleanStatus(getBridge: () => unknown, args: { id?: unknown; status?: unknown }): Promise<BridgeResult> {
    const b = gleanBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: GLEAN_MISSING };
    if (typeof b.setClipStatus !== "function") {
        return { status: "unsupported", data: null, message: "拾遗桥缺少 setClipStatus 方法（上游版本过旧）" };
    }
    if (typeof args.id !== "string" || !GLEAN_DOC_ID.test(args.id)) {
        return { status: "rejected", data: null, message: "id 缺失或形状非法（YYYYMMDDHHmmss-xxxxxxx）" };
    }
    if (!(GLEAN_CLIP_STATUSES as readonly unknown[]).includes(args.status)) {
        return { status: "rejected", data: null, message: `status 须为 ${GLEAN_CLIP_STATUSES.join("/")}` };
    }
    try {
        await b.setClipStatus(args.id, args.status as string);
        return { status: "recorded", data: { id: args.id, status: args.status }, message: `已置为 ${args.status}` };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 上游写门控：settings.integration.bridgeWriteEnabled 关闭时明确拒绝（桥写开关在拾遗侧设置）
        if (/writes are disabled/i.test(msg)) {
            return { status: "rejected", data: null, message: "拾遗桥写开关未开启（拾遗设置 → 集成 → 桥写入）" };
        }
        if (/Not a confirmed reading library article/i.test(msg)) {
            return { status: "rejected", data: null, message: "该 id 不是已收录的读库文章" };
        }
        return { status: "failed", data: null, message: `拾遗写入失败：${msg}` };
    }
}

/* ---------------- 管家 v1（window.LvHome，契约=上游 docs/BRIDGE.md） ---------------- */

export interface HomeBridgeLike {
    protocol?: number;
    capabilities?: readonly string[];
    whenReady?: () => Promise<unknown>;
    openButler?: () => void;
    openReminders?: () => void;
    addMemo?: (title: string, dueDate: string) => Promise<void>;
    summary?: () => { overdue: number; soon: number; today: number; updatedAt: string };
}

const HOME_MISSING = "小驴管家未安装或无 window.LvHome v1 桥";

/** 桥协商：protocol=1 才可用 */
function homeBridgeOf(getBridge: () => unknown): HomeBridgeLike | undefined {
    const b = getBridge() as HomeBridgeLike | undefined;
    return b && b.protocol === 1 ? b : undefined;
}

export async function homeSummary(getBridge: () => unknown): Promise<BridgeResult> {
    const b = homeBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: HOME_MISSING };
    if (typeof b.summary !== "function") {
        return { status: "unsupported", data: null, message: "管家桥缺少 summary 能力" };
    }
    try {
        // 有界计数快照（overdue/soon/today），只读不含标题/日期/成员（上游 EC17 同边界）
        const data = await b.summary();
        return { status: "recorded", data, message: "已读取（提醒有界计数）" };
    } catch (e) {
        return { status: "failed", data: null, message: `管家读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function homeMemo(getBridge: () => unknown, args: { title?: unknown; dueDate?: unknown }): Promise<BridgeResult> {
    const b = homeBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: HOME_MISSING };
    if (typeof b.addMemo !== "function") {
        return { status: "unsupported", data: null, message: "管家桥缺少 addMemo 能力" };
    }
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const dueDate = typeof args.dueDate === "string" ? args.dueDate.trim() : "";
    if (!title || title.length > 200) {
        return { status: "rejected", data: null, message: "title 缺失或超长（≤200 字符）" };
    }
    if (!dueDate) {
        return { status: "rejected", data: null, message: "dueDate 缺失（到期日期，如 2026-10-15）" };
    }
    try {
        await b.addMemo(title, dueDate);
        return { status: "recorded", data: { title, dueDate }, message: "已记入备忘（运行态；无幂等键，勿重试同语义）" };
    } catch (e) {
        return { status: "failed", data: null, message: `备忘写入失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function homeOpen(getBridge: () => unknown, args: { target?: unknown }): Promise<BridgeResult> {
    const b = homeBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: HOME_MISSING };
    const target = args.target === "reminders" ? "reminders" : "butler";
    const fn = target === "reminders" ? b.openReminders : b.openButler;
    if (typeof fn !== "function") {
        return { status: "unsupported", data: null, message: `管家桥缺少 ${target === "reminders" ? "openReminders" : "openButler"} 能力` };
    }
    try {
        fn();
        return { status: "recorded", data: { ok: true, target }, message: target === "reminders" ? "已打开提醒中枢" : "已打开管家总览" };
    } catch (e) {
        return { status: "failed", data: null, message: `管家导航失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

/* ---------------- 考试 lite（window.siyuanExam，契约=上游 docs/ecosystem-contracts.md §3） ---------------- */

export interface ExamBridgeLike {
    version?: string;
    statsRead?: () => Promise<unknown>;
    open?: () => void;
    practice?: () => void;
    wrongbook?: () => void;
    mock?: () => void;
    report?: () => void;
}

/** exam.open 支持的入口（与上游 siyuanExam 成员一一对应） */
export const EXAM_OPEN_TARGETS = ["practice", "wrongbook", "mock", "report"] as const;

const EXAM_MISSING = "小驴考试未安装或无 window.siyuanExam 公开 API";

/** 桥协商：以 statsRead 为锚（上游 47-04/48-06 lite 的推荐读取形态） */
function examBridgeOf(getBridge: () => unknown): ExamBridgeLike | undefined {
    const b = getBridge() as ExamBridgeLike | undefined;
    return b && typeof b.statsRead === "function" ? b : undefined;
}

export async function examStats(getBridge: () => unknown): Promise<BridgeResult> {
    const b = examBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: EXAM_MISSING };
    try {
        // statsRead()：按需重算脱敏快照（作答量/正确率/消灭数/连击/时段分布；无题目内容/key/路径）
        const data = await b.statsRead();
        if (data === null || data === undefined) {
            return { status: "recorded", data: { stats: null }, message: "练习应用未就绪（statsRead 返回 null）" };
        }
        return { status: "recorded", data: { stats: data }, message: "已读取（脱敏统计快照）" };
    } catch (e) {
        return { status: "failed", data: null, message: `考试统计读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function examOpen(getBridge: () => unknown, args: { target?: unknown }): Promise<BridgeResult> {
    const b = examBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: EXAM_MISSING };
    const target = EXAM_OPEN_TARGETS.find((t) => t === args.target) ?? "practice";
    const fn = b[target as "open" | "practice" | "wrongbook" | "mock" | "report"];
    if (typeof fn !== "function") {
        return { status: "unsupported", data: null, message: `考试桥缺少 ${target} 入口` };
    }
    try {
        (fn as () => void)();
        return { status: "recorded", data: { ok: true, target }, message: `已打开练习台（${target}）` };
    } catch (e) {
        return { status: "failed", data: null, message: `考试导航失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

/* ---------------- 常用 v1（window.xiaolvCommon，契约=上游 ADR-0013 · 只读子集） ---------------- */

export interface CommonBridgeLike {
    protocol?: number;
    protocolName?: string;
    capabilities?: readonly string[];
    whenReady?: () => Promise<unknown>;
    getCapabilities?: () => unknown;
    search?: (query?: unknown) => Promise<unknown>;
    get?: (itemId: string) => Promise<unknown>;
    getRecent?: (limit?: number) => Promise<unknown>;
    getFavorites?: () => Promise<unknown>;
}

const COMMON_MISSING = "小驴常用未安装或无 window.xiaolvCommon v1 桥";

/** 桥协商：protocol=1 才可用 */
function commonBridgeOf(getBridge: () => unknown): CommonBridgeLike | undefined {
    const b = getBridge() as CommonBridgeLike | undefined;
    return b && b.protocol === 1 ? b : undefined;
}

/** SearchResultAction → 快门回执（信封透传：ok=false 映射 rejected/failed，reason 保留给消费方） */
function commonResult(r: unknown, okMessage: string): BridgeResult {
    const env = r as { ok?: boolean; reason?: string; message?: string; data?: unknown } | undefined;
    if (!env || typeof env.ok !== "boolean") {
        return { status: "failed", data: null, message: "常用桥返回形状异常（缺 ActionResult 信封）" };
    }
    if (!env.ok) {
        // not-found/invalid-input = 调用方语义问题（rejected）；kernel-error/timeout = failed
        const soft = env.reason === "not-found" || env.reason === "invalid-input" || env.reason === "protocol-mismatch";
        return { status: soft ? "rejected" : "failed", data: null, message: env.message || `常用桥拒绝（${env.reason ?? "unknown"}）` };
    }
    return { status: "recorded", data: env.data ?? null, message: okMessage };
}

export async function commonSearch(getBridge: () => unknown, args: { keyword?: unknown; itemType?: unknown; tag?: unknown; category?: unknown; scope?: unknown; limit?: unknown }): Promise<BridgeResult> {
    const b = commonBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: COMMON_MISSING };
    if (typeof b.search !== "function") {
        return { status: "unsupported", data: null, message: "常用桥缺少 search 方法" };
    }
    const query: Record<string, unknown> = {};
    for (const k of ["keyword", "itemType", "tag", "category", "scope"] as const) {
        if (args[k] !== undefined && typeof args[k] === "string") query[k === "keyword" ? "text" : k] = args[k];
    }
    try {
        const r = await b.search(query);
        const out = commonResult(r, "已检索");
        if (out.status === "recorded" && typeof args.limit === "number" && Array.isArray(out.data)) {
            out.data = (out.data as unknown[]).slice(0, Math.max(1, Math.min(200, Math.floor(args.limit))));
        }
        return out;
    } catch (e) {
        return { status: "failed", data: null, message: `常用检索失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function commonGet(getBridge: () => unknown, args: { id?: unknown }): Promise<BridgeResult> {
    const b = commonBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: COMMON_MISSING };
    if (typeof b.get !== "function") {
        return { status: "unsupported", data: null, message: "常用桥缺少 get 方法" };
    }
    if (typeof args.id !== "string" || !args.id.trim() || args.id.length > 64) {
        return { status: "rejected", data: null, message: "id 缺失或超长（≤64）" };
    }
    try {
        const r = await b.get(args.id);
        return commonResult(r, "已读取");
    } catch (e) {
        return { status: "failed", data: null, message: `常用读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function commonRecent(getBridge: () => unknown, args: { limit?: unknown }): Promise<BridgeResult> {
    const b = commonBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: COMMON_MISSING };
    if (typeof b.getRecent !== "function") {
        return { status: "unsupported", data: null, message: "常用桥缺少 getRecent 方法" };
    }
    const limit = typeof args.limit === "number" ? args.limit : undefined;
    try {
        const r = await b.getRecent(limit);
        return commonResult(r, "已读取（最近使用）");
    } catch (e) {
        return { status: "failed", data: null, message: `常用读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function commonFavorites(getBridge: () => unknown): Promise<BridgeResult> {
    const b = commonBridgeOf(getBridge);
    if (!b) return { status: "unsupported", data: null, message: COMMON_MISSING };
    if (typeof b.getFavorites !== "function") {
        return { status: "unsupported", data: null, message: "常用桥缺少 getFavorites 方法" };
    }
    try {
        const r = await b.getFavorites();
        return commonResult(r, "已读取（收藏）");
    } catch (e) {
        return { status: "failed", data: null, message: `常用读取失败：${e instanceof Error ? e.message : String(e)}` };
    }
}

export const _internal = { waitReady, REFETCH_WAIT_MS, READY_TIMEOUT_MS };
