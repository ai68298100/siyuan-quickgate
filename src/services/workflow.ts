/**
 * workflow.plan / execute（M2，契约草案 docs/contracts/events-workflow-draft.md）。
 * 语义：只出计划不执行 → 一次性总确认 → 逐步执行（单步失败即停止）→ 每步独立回执。
 * 补偿边界：停止+报告，不做自动回滚（人工用思源快照兜底）。
 * 纯逻辑：步骤执行器由注入传入（BridgeService 的 dispatch 包装）。
 */

export interface WorkflowStep {
    op: string;
    args: Record<string, unknown>;
}

export interface WorkflowPlan {
    planId: string;
    steps: Array<{ index: number; op: string; confirm: boolean; args: Record<string, unknown> }>;
    createdAt: string;
    expiresAt: string;
}

export const WORKFLOW_MAX_STEPS = 8;
export const PLAN_TTL_MS = 5 * 60 * 1000;

/** 允许进工作流的 op（受控集：数据透传与导航/读写，不含 commands.run/meta op） */
export const WORKFLOW_ALLOWED_OPS = new Set([
    "checkin.record", "checkin.items", "checkin.summary",
    "contacts.search", "contacts.ensure", "contacts.interaction",
    "doc.open", "daily.status", "template.new", "editor.context",
]);

/** 写影响面（需要确认标记） */
export const WRITE_OPS = new Set(["checkin.record", "contacts.ensure", "contacts.interaction", "template.new"]);

export type PlanResult =
    | { kind: "plan"; plan: WorkflowPlan }
    | { kind: "rejected"; message: string };

export function makePlan(
    steps: unknown,
    deps: { planId: string; now: number; whitelistOp: (op: string) => boolean }
): PlanResult {
    if (!Array.isArray(steps)) return { kind: "rejected", message: "steps 必须是数组" };
    if (steps.length === 0) return { kind: "rejected", message: "steps 为空" };
    if (steps.length > WORKFLOW_MAX_STEPS) return { kind: "rejected", message: `步骤超过上限 ${WORKFLOW_MAX_STEPS}` };
    const list: WorkflowPlan["steps"] = [];
    for (const [index, s] of steps.entries()) {
        const op = (s as { op?: unknown })?.op;
        const args = (s as { args?: unknown })?.args;
        if (typeof op !== "string") return { kind: "rejected", message: `第 ${index + 1} 步缺 op` };
        if (!deps.whitelistOp(op)) return { kind: "rejected", message: `第 ${index + 1} 步 op 不在受控白名单：${op}` };
        list.push({
            index,
            op,
            confirm: WRITE_OPS.has(op),
            args: (args && typeof args === "object" ? args : {}) as Record<string, unknown>,
        });
    }
    return {
        kind: "plan",
        plan: {
            planId: deps.planId,
            steps: list,
            createdAt: new Date(deps.now).toISOString(),
            expiresAt: new Date(deps.now + PLAN_TTL_MS).toISOString(),
        },
    };
}

export interface ExecuteDeps {
    confirmAll: (steps: WorkflowPlan["steps"]) => Promise<boolean>;
    runStep: (step: WorkflowPlan["steps"][number]) => Promise<{ status: string; data: unknown; message: string }>;
    now?: () => number;
}

export interface ExecutedStep {
    index: number;
    op: string;
    status: string;
    message: string;
    elapsedMs: number;
}

export type ExecuteResult =
    | { kind: "rejected"; message: string }
    | { kind: "expired"; message: string }
    | { kind: "denied"; message: string }
    | { kind: "done"; done: number; stoppedAt: number | null; steps: ExecutedStep[] };

export async function executePlan(
    plan: WorkflowPlan | undefined,
    deps: ExecuteDeps
): Promise<ExecuteResult> {
    if (!plan) return { kind: "rejected", message: "planId 不存在（或服务重启后计划丢失，请重新 plan）" };
    const now = deps.now?.() ?? Date.now();
    if (Date.parse(plan.expiresAt) < now) return { kind: "expired", message: "计划已过期（5 分钟），请重新 plan" };
    const ok = await deps.confirmAll(plan.steps);
    if (!ok) return { kind: "denied", message: "用户未确认整份计划" };
    const steps: ExecutedStep[] = [];
    let stoppedAt: number | null = null;
    for (const step of plan.steps) {
        const t0 = now;
        let status = "recorded";
        let message = "ok";
        try {
            const r = await deps.runStep(step);
            status = r.status;
            message = r.message;
        } catch (e) {
            status = "failed";
            message = e instanceof Error ? e.message : String(e);
        }
        steps.push({ index: step.index, op: step.op, status, message, elapsedMs: (deps.now?.() ?? now) - t0 });
        if (status !== "recorded" && status !== "duplicate") {
            stoppedAt = step.index; // 失败停止：已完成步骤不回滚，列入回执
            break;
        }
    }
    return { kind: "done", done: steps.filter((s) => s.status === "recorded" || s.status === "duplicate").length, stoppedAt, steps };
}
