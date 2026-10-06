/**
 * 文件读取分类（L652/L653 · R78-P1 错误分类清账）：
 * 缺失 ≠ 鉴权失败 ≠ 内核不可达 ≠ 空文件——UI、诊断和指标不得把异常显示成"没有文件"。
 * 教训（bug#12，R127 实证）：3.8.6 缺失文件返回 HTTP 202 + application/json 错误信封，
 * 曾被当文件内容混入 events.ndjson 首行；该防御此前只在前端 KernelApi，内核 goja 侧同型漏洞。
 * 本分类器为纯函数，前端 KernelApi 与内核 kernel.ts 共用（两侧 Response 取最小公共面）。
 */

export type FileRead =
    | { kind: "ok"; text: string }
    | { kind: "missing" }
    | { kind: "auth"; detail: string }
    | { kind: "unreachable"; detail: string }
    | { kind: "unexpected"; detail: string };

/** fetch Response 的最小公共面（浏览器 Headers 与 goja 响应头都可能缺省，全部可选） */
export interface FileReadResponseLike {
    ok: boolean;
    status: number;
    headers?: { get?: (name: string) => string | null } | null;
    text: string;
}

const AUTH_STATUSES = new Set([401, 403]);

function envelopeCode(text: string): number | null {
    try {
        const o = JSON.parse(text) as { code?: unknown };
        if (o && typeof o === "object" && typeof o.code === "number") return o.code;
    } catch { /* 非 JSON 正文 */ }
    return null;
}

export function classifyFileRead(res: FileReadResponseLike | null, networkError?: unknown): FileRead {
    if (networkError !== undefined) {
        return { kind: "unreachable", detail: networkError instanceof Error ? networkError.message : String(networkError) };
    }
    if (!res) return { kind: "unreachable", detail: "空响应" };
    if (AUTH_STATUSES.has(res.status)) return { kind: "auth", detail: `HTTP ${res.status}（Token 或访问鉴权码不匹配）` };
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable", detail: `HTTP ${res.status}` };
    // 2xx：按正文识别错误信封（bug#12 的 202 形态；200+信封体同样防御）
    const ct = res.headers?.get?.("content-type") ?? "";
    if (res.status === 202 || ct.includes("application/json")) {
        const code = envelopeCode(res.text);
        if (code !== null && code !== 0) {
            if (code === 404) return { kind: "missing" };
            if (AUTH_STATUSES.has(code)) return { kind: "auth", detail: `错误信封 code=${code}` };
            return { kind: "unexpected", detail: `HTTP ${res.status} + 错误信封 code=${code}` };
        }
        // JSON 正文但非错误信封 → 按文件内容对待（快门自持载体均为 ndjson/平面文本）
    }
    return { kind: "ok", text: res.text };
}

/** 带分类的读取失败：调用方不得当"文件不存在"吞掉（favorites 等回退路径按 kind 放行） */
export class FileReadError extends Error {
    constructor(path: string, private readonly read: Extract<FileRead, { kind: "auth" | "unreachable" | "unexpected" }>) {
        const reason = read.kind === "auth" ? `鉴权失败（${read.detail}）`
            : read.kind === "unreachable" ? `内核不可达（${read.detail}）`
            : `异常响应（${read.detail}）`;
        super(`读取 ${path} 失败：${reason}`);
        this.name = "FileReadError";
    }
    get kind() { return this.read.kind; }
}

/**
 * 分类结果 → 旧契约（string | null）：ok→正文（空文件为 ""）；missing→null；真异常→抛 FileReadError。
 * 调用方 `?? ""` 与 `=== null` 判断保持不变；未接住的上抛由轮询器/派发包装计为失败并带原因。
 */
export function fileReadLegacy(path: string, fr: FileRead): string | null {
    if (fr.kind === "ok") return fr.text;
    if (fr.kind === "missing") return null;
    throw new FileReadError(path, fr);
}
