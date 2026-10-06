/**
 * 全量备份/恢复数据面（R9-A · G5 数据主权）：四载体（settings/favorites/audit/results）
 * + 处理台账拼装为单 JSON 备份；导入经既有 normalize* 校验链（schemaVersion 迁移复用），
 * 拒绝/合并策略=覆盖（导入前 UI 层确认）。纯逻辑独立导出供单测。
 */

export interface BackupComponents {
    settings: unknown;
    favorites: unknown;
    audit: unknown;
    processed: unknown;
    /** results.ndjson 原文（旧→新追加序） */
    resultsNdjson: string;
}

export interface BackupPayload {
    schemaVersion: 1;
    exportedAt: string;
    plugin: "siyuan-quickgate";
    settings: unknown;
    favorites: unknown;
    audit: unknown;
    processed: unknown;
    resultsNdjson: string;
}

export function buildBackupPayload(components: BackupComponents, exportedAt = new Date().toISOString()): BackupPayload {
    return {
        schemaVersion: 1,
        exportedAt,
        plugin: "siyuan-quickgate",
        settings: components.settings,
        favorites: components.favorites,
        audit: components.audit,
        processed: components.processed,
        resultsNdjson: components.resultsNdjson,
    };
}

export type ParseBackupResult =
    | { ok: true; payload: BackupPayload }
    | { ok: false; error: string };

/** 导入解析：JSON/结构校验（深形状由调用方走 normalize* 校验链） */
export function parseBackupPayload(text: string): ParseBackupResult {
    let o: unknown;
    try { o = JSON.parse(text); } catch { return { ok: false, error: "不是合法 JSON" }; }
    if (!o || typeof o !== "object") return { ok: false, error: "备份根不是对象" };
    const obj = o as Record<string, unknown>;
    if (obj.schemaVersion !== 1) return { ok: false, error: `不支持的备份版本：${String(obj.schemaVersion)}` };
    if (obj.plugin !== "siyuan-quickgate") return { ok: false, error: `不是快门的备份（plugin=${String(obj.plugin)}）` };
    if (typeof obj.exportedAt !== "string") return { ok: false, error: "缺少 exportedAt" };
    for (const key of ["settings", "favorites", "audit", "processed"] as const) {
        if (!(key in obj)) return { ok: false, error: `缺少 ${key} 段` };
    }
    if (typeof obj.resultsNdjson !== "string") return { ok: false, error: "缺少 resultsNdjson 段" };
    return {
        ok: true,
        payload: {
            schemaVersion: 1,
            exportedAt: obj.exportedAt as string,
            plugin: "siyuan-quickgate",
            settings: obj.settings,
            favorites: obj.favorites,
            audit: obj.audit,
            processed: obj.processed,
            resultsNdjson: obj.resultsNdjson,
        },
    };
}
