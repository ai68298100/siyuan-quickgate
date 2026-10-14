/** Public installation metadata only; never load plugin code or inspect private storage. */
export const INSTALLED_PLUGIN_ENDPOINT = "/api/bazaar/getInstalledPlugin";

export interface InstalledPlugin {
    name: string;
    version: string | null;
    enabled: boolean | null;
    incompatible: boolean | null;
    invalidReason: string | null;
}

export interface InstallationSnapshot {
    source: typeof INSTALLED_PLUGIN_ENDPOINT;
    checkedAt: string;
    status: "ok" | "failed";
    error: string | null;
    plugins: InstalledPlugin[];
}

export async function readInstallation(
    read: () => Promise<unknown>,
    now: () => number = Date.now,
    timeoutMs = 5000,
): Promise<InstallationSnapshot> {
    const checkedAt = new Date(now()).toISOString();
    let timer: ReturnType<typeof setTimeout>;
    try {
        const raw = await Promise.race([
            read(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("安装清单读取超时，请检查内核连接后重试。")), timeoutMs); }),
        ]) as { packages?: unknown };
        if (!raw || !Array.isArray(raw.packages)) throw new Error("安装清单响应异常：缺少 packages 数组");
        const names = new Set<string>();
        const plugins = raw.packages.map((item: unknown): InstalledPlugin => {
            const p = item as Record<string, unknown>;
            if (!p || typeof p.name !== "string" || !p.name || names.has(p.name)) throw new Error("安装清单响应异常：插件名缺失或重复");
            names.add(p.name);
            return {
                name: p.name,
                version: typeof p.version === "string" && p.version ? p.version : null,
                enabled: typeof p.enabled === "boolean" ? p.enabled : null,
                incompatible: typeof p.installedIncompatible === "boolean" ? p.installedIncompatible : null,
                invalidReason: typeof p.invalidReason === "string" && p.invalidReason ? p.invalidReason : null,
            };
        });
        return { source: INSTALLED_PLUGIN_ENDPOINT, checkedAt, status: "ok", error: null, plugins };
    } catch (e) {
        return { source: INSTALLED_PLUGIN_ENDPOINT, checkedAt, status: "failed", error: e instanceof Error ? e.message : String(e), plugins: [] };
    } finally {
        clearTimeout(timer);
    }
}

export function installationFor(snapshot: InstallationSnapshot, pluginId: string) {
    const p = snapshot.plugins.find((p) => p.name === pluginId);
    const installed = snapshot.status === "failed" ? null : Boolean(p);
    const state = installed === null ? "unknown" : !p ? "not-installed" : p.invalidReason ? "invalid"
        : p.incompatible === true ? "incompatible" : p.enabled === false ? "disabled" : p.enabled === true ? "enabled" : "unknown";
    return {
        installed, installedVersion: p?.version ?? null,
        enabled: p?.enabled ?? null, incompatible: p?.incompatible ?? null,
        invalidReason: p?.invalidReason ?? null, installationState: state,
    };
}

export function installationMessage(snapshot: InstallationSnapshot, pluginId: string) {
    const p = installationFor(snapshot, pluginId);
    switch (p.installationState) {
        case "not-installed": return { label: "安装清单未列出", reason: "请在思源 设置→集市→已下载 核对安装；本结果依据宿主安装清单。" };
        case "invalid": return { label: "安装包异常", reason: `宿主报告 ${p.invalidReason}；请在思源已下载插件页检查安装包。` };
        case "incompatible": return { label: "宿主不兼容", reason: "宿主报告当前版本或前端不兼容；请核对插件支持的思源版本与前端。" };
        case "disabled": return { label: "已安装停用", reason: "请在思源 设置→集市→已下载 启用该插件后重新检查。" };
        case "enabled": return { label: "已安装启用", reason: "安装/启用不代表公开桥或业务配置已就绪。" };
        default: return { label: snapshot.status === "failed" ? "读取失败" : "启用状态未核验", reason: snapshot.error ?? "公开安装元数据未提供启用状态；请在思源已下载插件页核对。" };
    }
}
