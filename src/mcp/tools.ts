/**
 * MCP 工具映射（契约驱动）：23 op → MCP tools 一比一。
 * 单一事实来源仍是 src/ops.ts 的 ALL_OPS——tests/mcp-server.test.ts 强制两侧一致（R8 教训的延伸）。
 * 安全模型（docs/10 §3.14）：只读 op 默认暴露；写 op 需显式 mcpWriteEnabled。
 */
import { ALL_OPS } from "../ops.ts";

export interface McpToolDef {
    name: string;
    description: string;
    /** 宽松 schema：args 具体形状以 docs/api.md 为准（服务端原样转发，不在 MCP 层重复校验） */
    inputSchema: { type: "object"; properties: Record<string, unknown>; additionalProperties?: boolean };
    annotations: { readOnlyHint: boolean; destructiveHint?: boolean };
    /** true=副作用/写 op，需 mcpWriteEnabled 才暴露 */
    write: boolean;
}

const READ_ONLY_OPS: ReadonlySet<string> = new Set([
    "bridge.ping",
    "commands.list",
    "commands.search",
    "checkin.items",
    "checkin.summary",
    "contacts.search",
    "daily.status",
    "editor.context",
    "registry.list",
    "diagnostics.report",
    "config.discover",
    "events.list",
    "events.pull",
]);

/** 破坏性（可删改数据）而非仅副作用：plugin.api 任意调用、workflow.execute 执行计划 */
const DESTRUCTIVE_OPS: ReadonlySet<string> = new Set(["plugin.api", "workflow.execute"]);

const DESCRIPTIONS: Record<string, string> = {
    "bridge.ping": "桥健康探测：返回 protocol/plugin/version/pollMs",
    "commands.list": "列出思源命令注册表（每插件 ≤100 条；黑名单插件不返回）",
    "commands.search": "按关键词过滤命令（≤50 条）",
    "commands.run": "执行思源命令（需插件名+命令 langKey；默认确认门控 30s+审计）",
    "checkin.items": "打卡项目清单（走打卡 v5 items.read）",
    "checkin.record": "打卡记录（source=api；occurredAt 走批量接口）",
    "checkin.summary": "打卡概览：今日汇总+连击（getSummaryContext+getStreaks 组合）",
    "contacts.search": "人脉搜索（≤50 条）",
    "contacts.ensure": "确保人脉存在（返回 docId）",
    "contacts.interaction": "记录人脉互动（names/docIds+date/place/note；ref=幂等键）",
    "doc.open": "受控打开文档（不改数据）",
    "daily.status": "今日日记状态（只探测不创建）",
    "setting.open": "打开思源设置",
    "editor.context": "当前编辑器上下文（docId/rootTitle/blockId/selectedText，无焦点全 null）",
    "registry.list": "小驴生态注册表：七插件安装/协议/能力对照",
    "diagnostics.report": "脱敏诊断快照（不含 Token/正文/个人路径）",
    "config.discover": "日记笔记本/收集箱自动发现（失败回 null+notes）",
    "template.new": "从模板建文档（需指定笔记本）",
    "events.list": "事件白名单目录",
    "events.pull": "拉取物化事件（含 event-deleted 删除标记，幂等键配对由调用方做）",
    "workflow.plan": "编排计划（≤8 步骤；只出计划不执行）",
    "workflow.execute": "执行计划（planId 一次性；总确认 30s——MCP 场景建议人工在场）",
    "plugin.api": "原始 API 透传（默认关+允许名单；MCP 侧需 writeEnabled 且快门透传开关已开）",
};

export function buildToolDefs(): McpToolDef[] {
    return (ALL_OPS as readonly string[]).map((op) => {
        const readOnly = READ_ONLY_OPS.has(op);
        const destructive = DESTRUCTIVE_OPS.has(op);
        return {
            name: op,
            description: DESCRIPTIONS[op] ?? op,
            inputSchema: {
                type: "object" as const,
                properties: {},
                additionalProperties: true,
            },
            annotations: readOnly
                ? { readOnlyHint: true }
                : { readOnlyHint: false, destructiveHint: destructive },
            write: !readOnly,
        };
    });
}

export function filterTools(defs: McpToolDef[], writeEnabled: boolean): McpToolDef[] {
    return writeEnabled ? defs : defs.filter((t) => !t.write);
}
