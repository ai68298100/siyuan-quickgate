/**
 * 思源内核 API 客户端（渲染进程同源调用，无需 Token）。
 * fetch 可注入（单测传 stub），putFile 用 FormData 走 multipart。
 */
import { classifyFileRead, fileReadLegacy, FileRead } from "./file-read";

export type FetchLike = typeof fetch;

export interface KernelJson<T = unknown> {
    code: number;
    msg: string;
    data: T;
}

/**
 * 文件读取分类计数（L653）：四类分账（ok/missing/auth/unreachable/unexpected），
 * 供诊断包与契约核对——"不得把异常显示成没有文件"的量化面。
 */
export class KernelApi {
    readonly readMetrics = { ok: 0, missing: 0, auth: 0, unreachable: 0, unexpected: 0 };
    constructor(private fetchLike: FetchLike = fetch) {}

    /** POST JSON 信封端点；code!=0 抛中文错误 */
    async post<T = unknown>(endpoint: string, payload: unknown = {}): Promise<T> {
        const res = await this.fetchLike(endpoint, {
            method: "POST",
            body: JSON.stringify(payload ?? {}),
        });
        const text = await res.text();
        let json: KernelJson<T>;
        try {
            json = JSON.parse(text) as KernelJson<T>;
        } catch {
            throw new Error(`内核响应不是 JSON：HTTP ${res.status}`);
        }
        if (json.code !== 0) {
            throw new Error(json.msg || `内核错误 code=${json.code}`);
        }
        return json.data;
    }

    /**
     * 读工作空间文件文本，带结果分类（L652）：缺失（404 / 3.8.6 的 202+错误信封）/ 鉴权 /
     * 不可达 / 异常信封各自可辨（bug#12 实证：缺失曾被误当文件内容混入数据）。
     */
    async getFileTextDetailed(path: string): Promise<FileRead> {
        let res: Response;
        try {
            res = await this.fetchLike("/api/file/getFile", {
                method: "POST",
                body: JSON.stringify({ path }),
            });
        } catch (e) {
            const fr = classifyFileRead(null, e);
            this.readMetrics[fr.kind === "missing" ? "missing" : fr.kind === "auth" ? "auth" : fr.kind === "unexpected" ? "unexpected" : "unreachable"] += 1;
            return fr;
        }
        const text = await res.text();
        const fr = classifyFileRead({ ok: res.ok, status: res.status, headers: res.headers, text });
        const key = fr.kind === "ok" ? "ok" : fr.kind === "missing" ? "missing" : fr.kind === "auth" ? "auth" : fr.kind === "unexpected" ? "unexpected" : "unreachable";
        this.readMetrics[key as keyof typeof this.readMetrics] += 1;
        return fr;
    }

    /** 旧契约薄封装：null 仅表示"确认不存在"；鉴权/不可达/异常信封抛 FileReadError（不再吞成 null） */
    async getFileText(path: string): Promise<string | null> {
        return fileReadLegacy(path, await this.getFileTextDetailed(path));
    }

    /** 写工作空间文件（multipart，思源要求 file 字段） */
    async putFileText(path: string, text: string): Promise<void> {
        const form = new FormData();
        form.append("path", path);
        form.append("isDir", "false");
        form.append("modTime", String(Math.floor(Date.now() / 1000)));
        form.append("file", new Blob([text], { type: "application/octet-stream" }), "file");
        const res = await this.fetchLike("/api/file/putFile", { method: "POST", body: form });
        if (!res.ok) throw new Error(`putFile 失败：HTTP ${res.status}`);
    }
}
