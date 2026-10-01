/**
 * op 清单单一事实来源（R8 教训：events.list 曾"文档声称支持但实现缺失"，
 * 三处清单（契约 JSON / NDJSON dispatch / 内核路由）各自维护必然漂移）。
 * 任何新增 op：①在此登记 ②在对应 dispatch 实现并测试 ③同步 docs/contracts/quickgate-api-v1.json。
 * tests/contract-consistency.test.ts 强制三处一致。
 */

/** NDJSON 桥与内核同步路由的全量 op（= bridge-service dispatch 的 switch 面） */
export const ALL_OPS = [
    "bridge.ping",
    // 命令注册表
    "commands.list", "commands.search", "commands.run",
    // 数据透传
    "checkin.items", "checkin.record", "checkin.summary",
    "contacts.search", "contacts.ensure", "contacts.interaction",
    // 便利 op
    "doc.open", "daily.status", "setting.open", "editor.context",
    // 生态中枢
    "registry.list", "diagnostics.report", "config.discover",
    // 模板
    "template.new",
    // events / workflow
    "events.list", "events.pull", "workflow.plan", "workflow.execute",
    // 高级透传
    "plugin.api",
] as const;

/** 内核同步路由可直接处理的子集（无需前端/DOM；v0.5.0 实验性通道） */
export const KERNEL_OPS = [
    "bridge.ping", "registry.list", "diagnostics.report",
    "events.list", "events.pull", "config.discover", "template.new",
] as const;

/** 前端专属 op（内核路由收到时回结构化 unsupported，指引 NDJSON 通道） */
export const FRONTEND_ONLY_OPS: string[] = ALL_OPS.filter((op) => !(KERNEL_OPS as readonly string[]).includes(op));

export type OpName = (typeof ALL_OPS)[number];
