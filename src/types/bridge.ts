/**
 * 小驴快门（Lv QuickGate）· 桥协议类型
 * 协议规范见项目设计文档 02-小驴桥协议 v1.1（信封字段与语义的唯一事实源在文档，此处为镜像）。
 */

export const BRIDGE_PROTOCOL_VERSION = 1;

/** 外部 → 插件 的命令信封（commands.ndjson 每行一条） */
export interface BridgeCommand {
    v: number;
    /** 幂等键，调用方生成；重复投递按 duplicate/skip 处理 */
    id: string;
    /** 白名单 op，见 src/ops */
    op: string;
    args: Record<string, unknown>;
    /** ISO8601；缺省视为已过期 */
    createdAt?: string;
    /** 过期窗口毫秒，缺省 60000 */
    ttlMs?: number;
    /** false = 只执行不写回执 */
    reply?: boolean;
    /** 目标设备名；非空且不匹配本机时跳过（不消费不回执） */
    device?: string;
    /** 原始行号（解析时填充，协议外字段） */
    line?: number;
}

export type BridgeStatus =
    | "recorded"
    | "duplicate"
    | "rejected"
    | "failed"
    | "unsupported"
    | "expired"
    /** 执行中途中断（崩溃/重启），最终状态未知——不自动重试，回执附人工核对路径（L655） */
    | "unknown";

/** 插件 → 外部 的回执信封（results.ndjson 每行一条） */
export interface BridgeReceipt {
    v: number;
    id: string;
    op: string;
    status: BridgeStatus;
    data: unknown;
    message: string;
    finishedAt: string;
    plugin: string;
    elapsedMs: number;
}

/** 坏行回执（阻断项：坏 JSON 行也要有占位身份，见 docs/09 阻断项7） */
export interface BadLineFingerprint {
    line: number;
    /** 行内容 sha-256 前 12 位，作为占位 id */
    fingerprint: string;
}

/** 处理过的命令 id 持久化存储（阻断项4：幂等跨重启，不用内存 200 条） */
/** 台账条目状态（L655）：pending=已预约未终结；done=已终结（含 unknown 终态） */
export type ProcessedState = "pending" | "done";

export interface ProcessedEntry {
    ts: number;
    state: ProcessedState;
    /** 预约时记录的 op（假死扫描发 unknown 回执时用） */
    op?: string;
    /** 终结时的回执状态 */
    status?: string;
}

export interface ProcessedStore {
    /** v2（L655）：id → 条目（pending/done 状态机）；v1（number 时间戳）迁移为 done */
    schemaVersion: 2;
    /** 上限 PROCESSED_CAP，超限按时间淘汰最旧 */
    processed: Record<string, ProcessedEntry>;
}

/** 桥设置（bridge-settings.json） */
export interface QuickGateSettings {
    schemaVersion: 1;
    bridgeEnabled: boolean;
    pollMs: number;
    /**
     * 断线退避上限（代码默认 10000，设置页不暴露——L458 核对裁定：内部鲁棒性参数，无用户调优场景）
     */
    backoffMaxMs: number;
    confirmExec: boolean;
    /** 不暴露命令的插件名单 */
    blacklist: string[];
    /**
     * 审计条数上限（代码默认 200、合法上限 2000，设置页不暴露——L458 裁定：默认值覆盖常规审计回溯）
     */
    auditMax: number;
    /** 高级透传 plugin.api：独立开关 + 允许名单（名单默认=三个已完成契约审计的插件；设置页可编辑，L458 补） */
    rawApiEnabled: boolean;
    rawApiAllowlist: string[];
    /**
     * 桥目录基路径（代码默认 /storage/petal/siyuan-quickgate/bridge，设置页不暴露——
     * spike⑨ 迁移裁定=不迁（R138：device 路由已解多设备），字段仅为迁移预案保留）
     */
    bridgeBasePath: string;
    /** 本机设备名（device 路由；自动生成并持久化 storage/local，设置页不暴露编辑——L458 裁定：自动管理） */
    deviceName: string;
    /** v1.5 广播快路径：前端 SSE 订阅 /es/broadcast/subscribe?channel=qg-cmd（新外部面，默认关） */
    broadcastEnabled: boolean;
    /** 移动端桥 opt-in（默认关；旧版用 deviceName ":mobile-on" 隐式后缀，加载时迁移为本字段） */
    mobileBridgeEnabled: boolean;
    /** 快速捕获默认去向（R301：daily=今日日记 / inbox=收集箱；面板选择器记忆上次选择） */
    captureTarget: "daily" | "inbox";
    /** 天数保留（L630 R-A · 默认 0=关）：>0 时 results/events/audit 追加裁剪追加"且 createdAt/finishedAt ≥ N 天前"；不进设置页（改 bridge-settings.json 生效——L458 内部参数先例） */
    retentionDays: number;
}

export const DEFAULT_SETTINGS: QuickGateSettings = {
    schemaVersion: 1,
    bridgeEnabled: false,
    pollMs: 500,
    backoffMaxMs: 10000,
    confirmExec: true,
    blacklist: [],
    auditMax: 200,
    rawApiEnabled: false,
    rawApiAllowlist: ["siyuan-checkin", "siyuan-contacts", "siyuan-speed-switch"],
    bridgeBasePath: "/storage/petal/siyuan-quickgate/bridge",
    deviceName: "",
    broadcastEnabled: false,
    mobileBridgeEnabled: false,
    captureTarget: "daily",
    retentionDays: 0,
};

/** 命令注册表条目（spike① 已实证：id=langKey；形状见 services/registry.ts 头注与 WALKTHROUGH ①） */
export interface PluginCommandInfo {
    plugin: string;
    pluginDisplayName?: string;
    id: string;
    title: string;
    accelerator?: string;
}

export interface AuditEntry {
    time: string;
    plugin: string;
    command: string;
    status: string;
    elapsedMs: number;
}

/** 运行统计快照（L554）：跨重启累计（bridge-stats.json） */
export interface BridgeStats {
    commands: number;
    ok: number;
    rejected: number;
    failed: number;
    expired: number;
    unknown: number;
    totalDispatchMs: number;
    lastActivityAt: number | null;
}

/** 恢复中心处置台账（G5 · R294）：人工处理过的回执 id，避免重复打扰 */
export interface ResolvedStore {
    schemaVersion: 1;
    /** id → 处置记录（action: retried=已换新 id 重发 / dismissed=人工核对后放弃） */
    resolved: Record<string, { at: string; action: string }>;
}
