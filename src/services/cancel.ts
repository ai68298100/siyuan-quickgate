/**
 * 长任务取消通道（docs/36 · L572 规格 I1）：
 * cancel.json 与队列同范式（单写者=设置面板；执行器只读+用完即删）。
 * workflow.execute 循环每步开始前检查——命中同 planId 即停止（已完成步骤保留不回滚，
 * 回执标注 user-cancel）。检查与执行间存在毫秒级竞窗：当前步骤不可中断是硬边界（规格 §1）。
 */
import { KernelApi } from "./kernelApi";

export interface CancelRequest {
    schemaVersion: 1;
    planId: string;
    requestedBy: "user" | "external";
    requestedAt: string;
}

export function cancelPath(basePath: string): string {
    return `${basePath}/cancel.json`;
}

/** 读取取消请求；缺失/损坏/planId 不匹配返回 null（损坏按规格 §4 等同无请求） */
export async function readCancelRequest(api: KernelApi, path: string, planId: string): Promise<CancelRequest | null> {
    try {
        const raw = await api.getFileText(path);
        if (!raw) return null;
        const obj = JSON.parse(raw) as Partial<CancelRequest>;
        if (obj?.schemaVersion !== 1 || typeof obj.planId !== "string") return null;
        return obj.planId === planId ? { schemaVersion: 1, planId: obj.planId, requestedBy: obj.requestedBy === "external" ? "external" : "user", requestedAt: obj.requestedAt ?? "" } : null;
    } catch {
        return null;
    }
}

/** 写入取消请求（单写者：设置面板恢复向导/CLI） */
export async function writeCancelRequest(api: KernelApi, path: string, planId: string, requestedBy: "user" | "external" = "user"): Promise<void> {
    const req: CancelRequest = { schemaVersion: 1, planId, requestedBy, requestedAt: new Date().toISOString() };
    await api.putFileText(path, JSON.stringify(req));
}

/** 用完即删（docs/36 §7 开放问题 1：execute 结束即清理）；失败静默 */
export async function clearCancelRequest(api: KernelApi, path: string): Promise<void> {
    try { await api.putFileText(path, ""); } catch { /* 清理失败不影响主流程 */ }
}
