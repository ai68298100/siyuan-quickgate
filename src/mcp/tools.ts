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
    annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
    /** true=副作用/写 op，需 mcpWriteEnabled 才暴露 */
    write: boolean;
}

const READ_ONLY_OPS: ReadonlySet<string> = new Set([
    "bridge.ping",
    "commands.list",
    "commands.search",
    "favorites.list",
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

/** 面板/CLI 等前端面复用 MCP 注解口径（L552 部分）：该 op 的副作用标注；未登记 op 保守视为有副作用 */
export function opWriteAnnotation(op: string): { write: boolean; destructive: boolean } {
    const readOnly = READ_ONLY_OPS.has(op);
    return { write: !readOnly, destructive: !readOnly && DESTRUCTIVE_OPS.has(op) };
}

/** 供前端命令面板等复用（L552 部分）：op 的一句话说明（未登记回落 op 名） */
export function opDescription(op: string): string {
    return DESCRIPTIONS[op] ?? op;
}

/** 幂等（同一调用重复执行无额外副作用；R234 调研候选①）——config.discover 有 opt-in 创建故不在列 */
const IDEMPOTENT_OPS: ReadonlySet<string> = new Set([
    "bridge.ping", "commands.list", "commands.search", "favorites.list", "favorites.add",
    "checkin.items", "checkin.summary", "contacts.search",
    "daily.status", "doc.open", "setting.open", "editor.context",
    "registry.list", "diagnostics.report", "events.list", "events.pull",
]);

/** 开放世界（与任意宿主插件/命令交互，实体面不可枚举）——其余为封闭面 false */
const OPEN_WORLD_OPS: ReadonlySet<string> = new Set(["commands.run", "plugin.api"]);

/** 逐 op 参数 schema（形状对齐 docs/api.md；无参 op 为空 properties——纪律测试强制每 op 都登记） */
const ARGS: Record<string, { properties: Record<string, { type: string; description: string }>; required?: string[] }> = {
    "bridge.ping": { properties: {} },
    "commands.list": { properties: { plugin: { type: "string", description: "可选，仅列出该插件" } } },
    "commands.search": { properties: { keyword: { type: "string", description: "关键词（内存过滤 ≤50 条；支持中英/拼音别名，L471）" } }, required: ["keyword"] },
    "favorites.list": { properties: {} },
    "favorites.add": {
        properties: {
            plugin: { type: "string", description: "插件 id" },
            command: { type: "string", description: "命令 langKey" },
            title: { type: "string", description: "可选展示名（缺省=command）" },
        },
        required: ["plugin", "command"],
    },
    "favorites.remove": {
        properties: {
            plugin: { type: "string", description: "插件 id（clearRecent=true 时可省）" },
            command: { type: "string", description: "命令 langKey（clearRecent=true 时可省）" },
            scope: { type: "string", description: "favorite（默认）| recent | both——recent 即隐私清除" },
            clearRecent: { type: "boolean", description: "true=一次清空全部最近使用（L472 清除历史）" },
        },
        required: [],
    },
    "commands.run": {
        properties: {
            plugin: { type: "string", description: "命令所属插件 id，如 siyuan-checkin" },
            command: { type: "string", description: "命令 langKey（用 commands.list 查询）" },
        },
        required: ["plugin", "command"],
    },
    "checkin.items": {
        properties: {
            includeArchived: { type: "boolean", description: "可选，含归档项目" },
            limit: { type: "number", description: "可选，≤200" },
        },
    },
    "checkin.record": {
        properties: {
            itemId: { type: "string", description: "打卡项目 id（checkin.items 查询）" },
            value: { type: "number", description: "数值（或 value/unit 二选一语义见上游）" },
            note: { type: "string", description: "可选备注" },
            occurredAt: { type: "string", description: "可选 ISO 时间；带值时走批量接口（单条接口不接受）" },
        },
        required: ["itemId"],
    },
    "checkin.summary": { properties: {} },
    "contacts.search": { properties: { keyword: { type: "string", description: "可选关键词（≤50 条）" } } },
    "contacts.ensure": { properties: { name: { type: "string", description: "人脉名" } }, required: ["name"] },
    "contacts.interaction": {
        properties: {
            names: { type: "string", description: "人脉名（兼容中英文逗号/顿号/分号/空白分隔）；与 docIds 二选一" },
            docIds: { type: "array", description: "人脉文档 id 数组" },
            date: { type: "string", description: "可选日期" },
            place: { type: "string", description: "可选地点" },
            note: { type: "string", description: "可选备注" },
        },
    },
    "doc.open": { properties: { id: { type: "string", description: "文档/块 id" } }, required: ["id"] },
    "daily.status": { properties: {} },
    "setting.open": { properties: {} },
    "editor.context": { properties: {} },
    "registry.list": { properties: {} },
    "diagnostics.report": { properties: {} },
    "config.discover": { properties: {} },
    "template.new": {
        properties: {
            notebook: { type: "string", description: "目标笔记本 id" },
            hpath: { type: "string", description: "文档人类可读路径（如 /2026/10/xxx）" },
            template: { type: "string", description: "模板内容（Sprig 会渲染）；与 templatePath 二选一" },
            templatePath: { type: "string", description: "模板相对路径（/templates/ 下）" },
        },
        required: ["notebook", "hpath"],
    },
    "events.list": { properties: {} },
    "events.pull": {
        properties: {
            names: { type: "array", description: "可选事件名数组过滤" },
            since: { type: "string", description: "可选起始时间" },
            limit: { type: "number", description: "可选 ≤200" },
        },
    },
    "workflow.plan": {
        properties: {
            steps: {
                type: "array",
                description: "≤8 步骤，每步 {op, args}；受控白名单；写步骤带 confirm 标记；只出计划不执行",
            },
        },
        required: ["steps"],
    },
    "workflow.execute": { properties: { planId: { type: "string", description: "workflow.plan 返回的 planId；总确认 30s，一次性" } }, required: ["planId"] },
    "workflow.cancel": { properties: { planId: { type: "string", description: "要取消的 planId（运行中计划的取消请求；每步开始前检查）" } }, required: ["planId"] },
    "plugin.api": {
        properties: {
            plugin: { type: "string", description: "目标插件 id" },
            method: { type: "string", description: "公开桥方法名" },
            args: { type: "object", description: "方法参数：数组=位置参数原样；对象=作为唯一 options 实参；缺省=无参" },
        },
        required: ["plugin", "method"],
    },
};

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
    "config.discover": "日记笔记本/收集箱自动发现（失败回 null+notes；createInboxIfMissing=true 授权自动创建）",
    "favorites.list": "收藏与最近使用清单（命令面板体验，L474）",
    "favorites.add": "加收藏（plugin+command 去重前移）",
    "favorites.remove": "移除收藏/清最近使用（scope=recent 即隐私清除）",
    "template.new": "从模板建文档（需指定笔记本）",
    "events.list": "事件白名单目录",
    "events.pull": "拉取物化事件（含 event-deleted 删除标记，幂等键配对由调用方做）",
    "workflow.plan": "编排计划（≤8 步骤；只出计划不执行）",
    "workflow.execute": "执行计划（planId 一次性；总确认 30s——MCP 场景建议人工在场）",
    "workflow.cancel": "请求取消运行中的工作流（在下一开始前停止；已完成步骤保留，回执标注 user-cancel）",
    "plugin.api": "原始 API 透传（默认关+允许名单；MCP 侧需 writeEnabled 且快门透传开关已开）",
};

export function buildToolDefs(): McpToolDef[] {
    return (ALL_OPS as readonly string[]).map((op) => {
        const readOnly = READ_ONLY_OPS.has(op);
        const destructive = DESTRUCTIVE_OPS.has(op);
        const argSpec = ARGS[op] ?? { properties: {} };
        return {
            name: op,
            description: DESCRIPTIONS[op] ?? op,
            inputSchema: {
                type: "object" as const,
                properties: argSpec.properties,
                ...(argSpec.required ? { required: argSpec.required } : {}),
                additionalProperties: true,
            },
            // MCP 规范 annotations（R234 调研候选①）：宿主 UI 建议——确认弹窗/并行执行等。
            // 纪律：四字段**显式恒填**（规范对缺省值有危险假设：destructiveHint 缺省按 true 解读）；
            // 注解只是投影，安全仍以服务端门控为准（safety-gate「防线在 dispatch 层」不变量）。
            annotations: {
                readOnlyHint: readOnly,
                destructiveHint: !readOnly && destructive,
                idempotentHint: IDEMPOTENT_OPS.has(op),
                openWorldHint: OPEN_WORLD_OPS.has(op),
            },
            write: !readOnly,
        };
    });
}

export function filterTools(defs: McpToolDef[], writeEnabled: boolean): McpToolDef[] {
    return writeEnabled ? defs : defs.filter((t) => !t.write);
}

/**
 * 统一参数校验（L562）：按登记 schema 做**宽严适度**的本地校验——required 缺失/空串、
 * 已声明类型的明显错型（string/number/boolean/array/object）。未声明字段不拦（additionalProperties: true，
 * 转发语义不变）。校验失败返回错误文案，server 层据此回 JSON-RPC -32602（协议级 invalid params），
 * 与工具执行失败（isError result）分离——不再消耗桥队列槽位等前端回执。
 */
/** 供前端命令面板等复用：op 的参数 schema（未登记返回 null） */
export function getArgsSpec(op: string): { properties: Record<string, { type: string; description: string }>; required?: string[] } | null {
    return ARGS[op] ?? null;
}

export function validateArgs(def: McpToolDef, args: Record<string, unknown>): string | null {
    const spec = ARGS[def.name];
    if (!spec) return null; // 未登记 schema 的 op 不校验（纪律测试保证全登记）
    for (const key of spec.required ?? []) {
        const v = args?.[key];
        if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
            return `缺少必填参数：${key}`;
        }
    }
    for (const [key, meta] of Object.entries(spec.properties)) {
        const v = args?.[key];
        if (v === undefined || v === null) continue;
        const wrong = (meta.type === "string" && typeof v !== "string")
            || (meta.type === "number" && typeof v !== "number")
            || (meta.type === "boolean" && typeof v !== "boolean")
            || (meta.type === "array" && !Array.isArray(v))
            || (meta.type === "object" && (typeof v !== "object" || Array.isArray(v)));
        if (wrong) return `参数 ${key} 类型应为 ${meta.type}（实得 ${Array.isArray(v) ? "array" : typeof v}）`;
    }
    return null;
}
