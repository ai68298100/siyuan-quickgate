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

    /** 读工作空间文件文本；不存在（非 2xx，或 3.8.6 的 202+错误信封）返回 null */
    async getFileText(path: string): Promise<string | null> {
        const res = await this.fetchLike("/api/file/getFile", {
            method: "POST",
            body: JSON.stringify({ path }),
        });
        if (!res.ok) return null;
        const text = await res.text();
        // 3.8.6 真机实证（bug#12）：缺失文件返回 HTTP 202（res.ok=true）+ application/json
        // 错误信封 {"code":404,...}——按正文识别为缺失，防错误体被当文件内容
        //（曾把 404 JSON 写进 events.ndjson 首行）。正常文件内容不含错误信封。
        const ct = res.headers?.get?.("content-type") ?? "";
        if (ct.includes("application/json")) {
            try {
                const o = JSON.parse(text) as { code?: unknown };
                if (o && typeof o === "object" && typeof o.code === "number" && o.code !== 0) return null;
            } catch { /* 非 JSON 正文按内容返回 */ }
        }
        return text;
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
