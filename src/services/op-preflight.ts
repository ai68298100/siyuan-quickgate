import { argMatchesType, getArgsSpec } from "../mcp/tools";
import { ALL_OPS } from "../ops";
import { installationFor, installationMessage, readInstallation } from "./plugin-status";

export interface PreflightCheck {
    condition: string;
    state: "pass" | "blocked" | "unknown";
    blocking: boolean;
    message: string;
    repair?: "connection" | "diagnostics";
}
export interface OpPreflight {
    op: string;
    checkedAt: string;
    canInvoke: boolean;
    checks: PreflightCheck[];
}
export interface PreflightDeps {
    bridgeAlive(): boolean;
    listInstalledPlugins(): Promise<unknown>;
    getBridge(pluginId: string): unknown;
    now?: () => number;
}

type Requirement = { plugin: string; protocol?: [string, number]; methods: string[][]; capability?: string };
const requirements: Record<string, Requirement> = {
    "checkin.items": { plugin: "siyuan-checkin", protocol: ["version", 5], methods: [["queryItems", "getItems"]], capability: "items.read" },
    "checkin.record": { plugin: "siyuan-checkin", protocol: ["version", 5], methods: [["recordEvent"]], capability: "events.record" },
    "checkin.summary": { plugin: "siyuan-checkin", protocol: ["version", 5], methods: [["getSummaryContext", "getStreaks"]], capability: "summary.read" },
    "contacts.search": { plugin: "siyuan-contacts", protocol: ["protocol", 1], methods: [["searchPeople"]] },
    "contacts.ensure": { plugin: "siyuan-contacts", protocol: ["protocol", 1], methods: [["ensurePerson"]] },
    "contacts.interaction": { plugin: "siyuan-contacts", protocol: ["protocol", 1], methods: [["ensurePerson"], ["recordInteraction"]] },
    "glean.list": { plugin: "siyuan-glean", protocol: ["apiVersion", 1], methods: [["listClips"]] },
    "glean.get": { plugin: "siyuan-glean", protocol: ["apiVersion", 1], methods: [["getClip"]] },
    "glean.status": { plugin: "siyuan-glean", protocol: ["apiVersion", 1], methods: [["setClipStatus"]] },
    "home.summary": { plugin: "siyuan-home", protocol: ["protocol", 1], methods: [["summary"]] },
    "home.memo": { plugin: "siyuan-home", protocol: ["protocol", 1], methods: [["addMemo"]] },
    "home.open": { plugin: "siyuan-home", protocol: ["protocol", 1], methods: [] },
    "exam.stats": { plugin: "siyuan-exam", methods: [["statsRead"]] },
    "exam.open": { plugin: "siyuan-exam", methods: [["statsRead"]] },
    "common.search": { plugin: "xiaolv-common", protocol: ["protocol", 1], methods: [["search"]] },
    "common.get": { plugin: "xiaolv-common", protocol: ["protocol", 1], methods: [["get"]] },
    "common.recent": { plugin: "xiaolv-common", protocol: ["protocol", 1], methods: [["getRecent"]] },
    "common.favorites": { plugin: "xiaolv-common", protocol: ["protocol", 1], methods: [["getFavorites"]] },
};

/** No business method, whenReady, model request, code loading, or persistence is called here. */
export async function checkOpPreflight(op: string, args: Record<string, unknown>, deps: PreflightDeps): Promise<OpPreflight> {
    const checks: PreflightCheck[] = [];
    const checkedAt = new Date((deps.now ?? Date.now)()).toISOString();
    const add = (condition: string, pass: boolean, message: string, repair?: PreflightCheck["repair"]) => {
        checks.push({ condition, state: pass ? "pass" : "blocked", blocking: !pass, message, repair });
    };
    const finish = () => ({ op, checkedAt, canInvoke: !checks.some((c) => c.blocking), checks });
    add("op", (ALL_OPS as readonly string[]).includes(op), "调用必须在公开 op 清单中。");
    const spec = getArgsSpec(op);
    for (const [name, field] of Object.entries(spec?.properties ?? {})) {
        const required = spec.required?.includes(name);
        const value = args[name];
        const absent = value === undefined || value === null || (required && typeof value === "string" && !value.trim());
        if (required && absent) add("input", false, `缺少必填参数：${name}`);
        else if (value !== undefined && !argMatchesType(value, field.type)) add("input", false, `参数 ${name} 类型不符：应为 ${field.type}`);
    }
    add("bridge", deps.bridgeAlive(), "命令面板调用需要运行中的外部命令桥；请在连接与通道核对。", "connection");
    if (checks.some((c) => c.blocking)) return finish();
    const req = requirements[op];
    if (!req) {
        checks.push({ condition: "scope", state: "unknown", blocking: false, message: "已检查输入与快门通道；该操作的目标和业务配置由执行层核验。" });
        return finish();
    }
    const installation = await readInstallation(deps.listInstalledPlugins, deps.now);
    const plugin = installationFor(installation, req.plugin);
    const notice = installationMessage(installation, req.plugin);
    add("installation", plugin.installed === true && plugin.enabled === true && plugin.incompatible !== true && !plugin.invalidReason,
        `${req.plugin}：${notice.label}。${notice.reason}`, "diagnostics");
    if (checks.some((c) => c.blocking)) return finish();
    try {
        const b = deps.getBridge(req.plugin) as Record<string, unknown>;
        add("public-bridge", Boolean(b), "公开桥缺席时，请检查该插件在当前前端的启用、加载与公开桥授权；不能由此推断未配置。", "diagnostics");
        if (!b) return finish();
        if (req.protocol) add("protocol", b[req.protocol[0]] === req.protocol[1], `公开协议需 ${req.protocol[0]}=${req.protocol[1]}；不兼容时请核对上游契约和插件版本。`, "diagnostics");
        const methods = req.methods.map((group) => [...group]);
        if (op === "checkin.record" && typeof args.occurredAt === "string" && args.occurredAt) methods.splice(0, methods.length, ["recordEventsBatch"]);
        if (op === "checkin.summary" && typeof b.getSummaryContext !== "function") methods.push(["getItems"], ["getStreaks"]);
        if (op === "home.open") methods.push([args.target === "reminders" ? "openReminders" : "openButler"]);
        if (op === "exam.open") methods.push([typeof args.target === "string" && ["practice", "wrongbook", "mock", "report"].includes(args.target) ? args.target : "practice"]);
        for (const group of methods) add("method", group.some((m) => typeof b[m] === "function"), `需要公开方法 ${group.join(" 或 ")}；请核对插件公开桥与版本。`, "diagnostics");
        if (req.capability) {
            const hasCapability = b.hasCapability;
            add("capability", typeof hasCapability === "function" && hasCapability.call(b, req.capability) === true, `需要公开能力 ${req.capability}；请核对插件公开桥授权。`, "diagnostics");
        }
        if (req.plugin === "siyuan-checkin" && typeof b.isReady === "function") {
            add("ready", b.isReady() === true, "公开 isReady 尚未就绪；请等待插件加载并重新检查。", "diagnostics");
        }
        checks.push({ condition: "business-config", state: "unknown", blocking: false, message: "业务配置与目标数据未核验；预检不调用业务读写方法，通过不代表执行成功。" });
    } catch (e) {
        add("public-probe", false, `公开桥检查失败：${e instanceof Error ? e.message : String(e)}`, "diagnostics");
    }
    // The bridge may have stopped while installation metadata was being read.
    if (!deps.bridgeAlive()) add("bridge", false, "检查期间桥已停止，请在连接与通道恢复后重检。", "connection");
    return finish();
}
