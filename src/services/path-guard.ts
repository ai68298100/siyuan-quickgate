/**
 * templatePath / 模板内容白名单守卫（safety-gate-contract §7 · TODO L628 R78-P0）。
 * NDJSON 前端通道与内核同步路由共用；MCP 经由这两条路径，无需独立实现。
 * 规则改动必须同步 docs/contracts/safety-gate-contract.md §7 的回归矩阵与 tests/path-guard.test.ts。
 */

export const TEMPLATE_PATH_MAX = 200;
export const TEMPLATE_CONTENT_MAX = 64 * 1024;

/**
 * 扁平结果（reason 恒存）：本项目 tsconfig strict=false，判别联合的真值收窄不可靠，
 * 调用方一律 `if (!r.ok) return r.reason` 形式使用；不变量：ok=false 时 reason 必非空。
 */
export interface PathGuardResult {
    ok: boolean;
    reason: string;
}

/** 白名单形状：字母数字开头，仅 字母数字/_/- 与一层后缀 .md/.txt——`..`、`\`、NUL、前导 `/`、`%`、控制字符均不可能匹配 */
const ALLOWED = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(md|txt)$/;

export function validateTemplatePath(p: unknown): PathGuardResult {
    if (typeof p !== "string" || p.length === 0) return { ok: false, reason: "templatePath 缺失或非字符串" };
    if (p.length > TEMPLATE_PATH_MAX) return { ok: false, reason: `templatePath 超长（> ${TEMPLATE_PATH_MAX} 字符）` };
    if (p.includes("\\")) return { ok: false, reason: "templatePath 含反斜杠（仅允许 / 分隔）" };
    if (p.includes("\0")) return { ok: false, reason: "templatePath 含 NUL 字符" };
    if (p.startsWith("/")) return { ok: false, reason: "templatePath 须为相对路径（不带前导 /）" };
    if (!ALLOWED.test(p)) return { ok: false, reason: "templatePath 不在白名单形状内（仅 字母数字/_-，后缀 .md/.txt；.. 段被拒绝）" };
    return { ok: true, reason: "" };
}

export function validateTemplateContent(c: string): PathGuardResult {
    if (c.length > TEMPLATE_CONTENT_MAX) return { ok: false, reason: `模板内容超限（> ${TEMPLATE_CONTENT_MAX} 字节），拒绝执行（不截断）` };
    return { ok: true, reason: "" };
}
