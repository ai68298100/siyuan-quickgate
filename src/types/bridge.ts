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
    | "expired";

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
export interface ProcessedStore {
    schemaVersion: 1;
    /** id → 处理完成时间戳（ms）。上限 PROCESSED_CAP，超限按时间淘汰最旧 */
    processed: Record<string, number>;
}

/** 桥设置（bridge-settings.json） */
export interface QuickGateSettings {
    schemaVersion: 1;
    bridgeEnabled: boolean;
    pollMs: number;
    backoffMaxMs: number;
    confirmExec: boolean;
    /** 不暴露命令的插件名单 */
    blacklist: string[];
    auditMax: number;
    /** 高级透传 plugin.api：独立开关 + 允许名单 */
    rawApiEnabled: boolean;
    rawApiAllowlist: string[];
    /** 桥目录基路径（spike⑨ 后可迁 storage/local） */
    bridgeBasePath: string;
    /** 本机设备名（device 路由） */
    deviceName: string;
    /** v1.5 广播快路径：前端 SSE 订阅 /es/broadcast/subscribe?channel=qg-cmd（新外部面，默认关） */
    broadcastEnabled: boolean;
    /** 移动端桥 opt-in（默认关；旧版用 deviceName ":mobile-on" 隐式后缀，加载时迁移为本字段） */
    mobileBridgeEnabled: boolean;
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
