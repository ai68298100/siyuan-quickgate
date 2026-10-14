import type { KernelApi } from "./kernelApi";

export type CaptureTarget = "daily" | "inbox";
export interface CapturePlan {
    readonly target: CaptureTarget;
    readonly notebookId: string;
    readonly destination: string;
    readonly details: string;
    readonly body: string;
    readonly docId?: string;
    readonly checkedAt: number;
    readonly day: string;
    readonly identity: string;
}
export interface CaptureResult {
    ok: boolean;
    status: "recorded" | "failed" | "unknown";
    message: string;
    blockId?: string;
    docId?: string;
}
type Discovery = { diaryNotebookId: string | null; inboxDocId: string | null; notes: string[] };
type Notebook = { id: string; name: string; closed: boolean };
type Document = { id: string; box: string; hpath: string; content: string; type: string };
type Destination = Omit<CapturePlan, "body" | "checkedAt" | "day">;
const ID = /^\d{14}-[a-z0-9]{7}$/;
const PLAN_TTL_MS = 60_000;
const localDay = (ms: number) => new Date(ms).toLocaleDateString("sv-SE");
const failure = (message: string): CaptureResult => ({ ok: false, status: "failed", message });

/** 选择只读核验；确认后重检；单个预览只允许一次执行尝试。日记由内核按模板定位，未声称锁定某个路径。 */
export class QuickCaptureService {
    private readonly issued = new WeakSet<CapturePlan>();
    constructor(
        private readonly api: Pick<KernelApi, "post">,
        private readonly discover: () => Promise<Discovery>,
        private readonly now: () => number = Date.now,
    ) {}

    private async resolve(target: CaptureTarget): Promise<Destination> {
        if (target !== "daily" && target !== "inbox") throw new Error("未知的捕获去向");
        const found = await this.discover(); // 默认参数只读；不使用 createInboxIfMissing。
        const targetId = target === "daily" ? found.diaryNotebookId : found.inboxDocId;
        if (!targetId) {
            const guidance = target === "daily"
                ? "请检查笔记本的日记保存路径，多个候选时需先明确目标"
                : "请检查名为「收集箱」或「Inbox」的文档";
            throw new Error(`暂无法确认${target === "daily" ? "日记" : "收集箱"}目标；${guidance}。${found.notes.join("；")}`);
        }
        if (!ID.test(targetId)) throw new Error("目标 ID 无效，请重新检查配置");
        let doc: Document | undefined;
        if (target === "inbox") {
            const rows = await this.api.post<Document[]>("/api/query/sql", {
                // ID 在拼入 SQL 前已按内核 ID 格式校验；仅查明确目标，不从正文推断配置。
                stmt: `SELECT id, box, hpath, content, type FROM blocks WHERE id='${targetId}' AND type='d' LIMIT 1`,
            });
            if (!Array.isArray(rows)) throw new Error("收集箱核验返回格式异常，无法确认目标");
            doc = rows.find((row) => row.id === targetId && row.type === "d");
            if (!doc || !ID.test(doc.box)) throw new Error("收集箱文档不可用，请检查文档与笔记本");
        }
        const response = await this.api.post<{ notebooks?: Notebook[] } | Notebook[]>("/api/notebook/lsNotebooks", {});
        const notebooks = Array.isArray(response) ? response : response?.notebooks;
        if (!Array.isArray(notebooks)) throw new Error("笔记本列表返回格式异常，无法确认目标");
        const notebookId = doc?.box ?? targetId;
        const notebook = notebooks.find((nb) => nb.id === notebookId && !nb.closed);
        if (!notebook) throw new Error("目标笔记本已关闭或不可用，请重新选择");
        const name = notebook.name || notebook.id;
        let details: string;
        let identity: string;
        if (target === "daily") {
            const response = await this.api.post<{ conf?: Record<string, unknown> }>("/api/notebook/getNotebookConf", { notebook: notebookId });
            const conf = response?.conf;
            const savePath = conf?.dailyNoteSavePath ?? conf?.dailynoteSavePath;
            if (typeof savePath !== "string" || !savePath.trim() || savePath.trim() === "/") {
                throw new Error("日记保存路径未配置，请检查笔记本设置");
            }
            // renderSprig 不接收 notebook；不能将其输出冒充 CreateDailyNote 的笔记本模板渲染结果。
            details = `笔记本 ${notebookId}\n日记路径模板：${savePath}\n由思源按当前模板定位日记；不存在时会创建文档并应用日记内容模板。`;
            identity = JSON.stringify([target, notebookId, name, savePath, conf?.dailyNoteTemplatePath ?? ""]);
        } else {
            details = `笔记本 ${notebookId}\n文档 ${doc!.id}\n路径：${doc!.hpath || "（未返回）"}\n向该文档末尾追加 Markdown，不创建收集箱。`;
            identity = JSON.stringify([target, notebookId, name, doc!.id, doc!.hpath, doc!.content]);
        }
        return {
            target, notebookId, docId: doc?.id,
            destination: target === "daily" ? `${name} / 今日日记` : `${name} / ${doc!.content || "收集箱"}`,
            details, identity,
        };
    }

    async prepare(text: string, target: CaptureTarget): Promise<{ plan?: CapturePlan; message?: string }> {
        const clean = text.trim();
        if (!clean) return { message: "捕获内容为空" };
        try {
            const destination = await this.resolve(target);
            const checkedAt = this.now();
            const hhmm = new Date(checkedAt).toTimeString().slice(0, 5);
            const plan: CapturePlan = Object.freeze({
                ...destination, checkedAt, day: localDay(checkedAt),
                body: target === "daily" ? `- ${hhmm} ${clean}` : clean,
            });
            this.issued.add(plan);
            return { plan };
        } catch (e) {
            return { message: `目标核验未通过：${e instanceof Error ? e.message : String(e)}` };
        }
    }

    private current(plan: CapturePlan): boolean {
        const now = this.now();
        return now >= plan.checkedAt && now - plan.checkedAt < PLAN_TTL_MS && localDay(now) === plan.day;
    }

    async execute(plan: CapturePlan): Promise<CaptureResult> {
        if (!this.issued.has(plan)) return failure("该预览已经提交或无效，请重新核验目标");
        this.issued.delete(plan); // await 前消费：双击、超时后重试均不能复用本次预览。
        if (!this.current(plan)) return failure("预览已过期或日期已变化，请重新选择去向并预览");
        try {
            const destination = await this.resolve(plan.target);
            if (destination.identity !== plan.identity) return failure("目标或日记配置已变化，请重新选择去向并核对预览");
            if (!this.current(plan)) return failure("核验期间预览已过期或日期已变化，请重新预览");
        } catch (e) {
            return failure(`执行前目标核验未通过：${e instanceof Error ? e.message : String(e)}`);
        }
        try {
            const result = await this.api.post<Array<{ doOperations?: Array<{ id?: string; parentID?: string }> }>>(
                plan.target === "daily" ? "/api/block/appendDailyNoteBlock" : "/api/block/appendBlock",
                plan.target === "daily"
                    ? { notebook: plan.notebookId, dataType: "markdown", data: plan.body }
                    : { parentID: plan.docId, dataType: "markdown", data: plan.body },
            );
            const ops = Array.isArray(result) ? result.flatMap((tx) => tx.doOperations ?? []) : [];
            const last = ops[ops.length - 1];
            if (!last?.id || !ID.test(last.id)) {
                return { ok: false, status: "unknown", message: "请求已提交，但未获得可核对的块回执。请在目标文档检查，勿重复提交。", docId: plan.docId };
            }
            // appendDailyNoteBlock 的 parentID 来自 CreateDailyNote 的真实根 ID；不再全局按日期猜文档。
            const docId = plan.docId ?? (last.parentID && ID.test(last.parentID) ? last.parentID : undefined);
            return { ok: true, status: "recorded", message: `已追加到 ${plan.destination}`, blockId: last.id, docId };
        } catch {
            // 写请求抛错不证明内核没有执行；没有完整回执时不得自动重试。
            return { ok: false, status: "unknown", message: "写入结果未确认。请在目标文档核查后再决定下一步，勿重复提交。", docId: plan.docId };
        }
    }
}
