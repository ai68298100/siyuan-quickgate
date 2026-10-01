/**
 * 思源内核 API 客户端（渲染进程同源调用，无需 Token）。
 * fetch 可注入（单测传 stub），putFile 用 FormData 走 multipart。
 */

export type FetchLike = typeof fetch;

export interface KernelJson<T = unknown> {
    code: number;
    msg: string;
    data: T;
}

export class KernelApi {
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

    /** 读工作空间文件文本；不存在（非 2xx）返回 null */
    async getFileText(path: string): Promise<string | null> {
        const res = await this.fetchLike("/api/file/getFile", {
            method: "POST",
            body: JSON.stringify({ path }),
        });
        if (!res.ok) return null;
        return await res.text();
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
