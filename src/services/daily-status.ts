import type { KernelApi } from "./kernelApi";

export interface DailyStatus { docId: string | null; exists: boolean }
const ID = /^\d{14}-[a-z0-9]{7}$/;

/** 对齐思源 CreateDailyNote 的 custom-dailynote-YYYYMMDD 属性；只探测，空结果才表示不存在。 */
export async function readDailyStatus(api: Pick<KernelApi, "post">, now: () => Date = () => new Date()): Promise<DailyStatus> {
    const today = now();
    if (!Number.isFinite(today.getTime())) throw new Error("系统日期无效，无法读取日记状态");
    const day = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const rows = await api.post<Array<{ id: string }>>("/api/query/sql", {
        stmt: `SELECT b.id FROM blocks b JOIN attributes a ON a.block_id=b.id WHERE b.type='d' AND a.name='custom-dailynote-${day}' AND a.value='${day}' ORDER BY b.id LIMIT 1`,
    });
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.id !== "string" || !ID.test(row.id))) {
        throw new Error("日记状态响应格式异常，无法判断文档是否存在");
    }
    const docId = rows[0]?.id ?? null;
    return { docId, exists: docId !== null };
}
