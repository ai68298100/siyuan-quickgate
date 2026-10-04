/**
 * 测试共享夹具（R256 去重：path-guard/favorites/search-alias 三处复制 MemKernel+makeService 已现漂移风险）。
 * 约定：只放「与被测行为无关」的基建；场景特化（registry 假件形状、audit 侦听）留在各自测试文件。
 */
import { BridgeService } from "../../src/services/bridge-service";
import { KernelApi } from "../../src/services/kernelApi";
import { BridgeStore } from "../../src/services/store";
import { AuditEntry, QuickGateSettings } from "../../src/types/bridge";

/** 内存文件系统 + 内存内核：模拟 commands/results/favorites 等文件与内核 JSON 端点 */
export class MemKernel {
    files = new Map<string, string>();
    /** 可选内核 JSON 端点脚本：endpoint → data（静态值或 (body)=>data 函数；code=0 包装） */
    jsonEndpoints = new Map<string, unknown>();
    api: KernelApi;
    constructor() {
        this.api = new KernelApi((async (url: RequestInfo | URL, init?: RequestInit) => {
            const u = String(url);
            const body = typeof init?.body === "string" && init.body.trim().startsWith("{") ? JSON.parse(init.body) : {};
            if (u.includes("/api/file/getFile")) {
                const text = this.files.get(body.path);
                return { ok: text !== undefined, status: text !== undefined ? 200 : 404, text: async () => text ?? "" } as Response;
            }
            if (u.includes("/api/file/putFile")) {
                const form = init?.body as FormData;
                this.files.set(String(form.get("path")), await (form.get("file") as File).text());
                return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: null }) } as Response;
            }
            for (const [endpoint, data] of this.jsonEndpoints) {
                if (u.includes(endpoint)) {
                    const value = typeof data === "function" ? (data as (body: unknown) => unknown)(body) : data;
                    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, msg: "", data: value }) } as Response;
                }
            }
            return { ok: false, status: 404, text: async () => "{}" } as Response;
        }) as unknown as typeof fetch);
    }
}

export const testSettings = () => ({
    schemaVersion: 1 as const, bridgeEnabled: true, pollMs: 500, backoffMaxMs: 10000,
    confirmExec: false, blacklist: [] as string[], auditMax: 200,
    rawApiEnabled: false, rawApiAllowlist: [] as string[],
    bridgeBasePath: "/bridge", deviceName: "dev-a",
});

export const testEnvelope = (id: string, op: string, args: object) =>
    JSON.stringify({ v: 1, id, op, args, createdAt: new Date().toISOString(), ttlMs: 60000 });

/** BridgeService 组装：registry/audit 经 overrides 注入，其余全默认假件 */
export function makeTestService(
    mem: MemKernel,
    overrides: {
        registry?: () => { source: string; plugins: Array<{ name: string; displayName?: string; commands: Array<{ title: string; id: string; plugin: string; callback?(): unknown }> }> };
        audit?: (e: AuditEntry) => void;
        settings?: () => QuickGateSettings;
    } = {},
) {
    const store = new BridgeStore({ load: async () => null, save: async () => {} });
    return new BridgeService({
        api: mem.api, store, settings: overrides.settings ?? testSettings,
        pluginName: "siyuan-quickgate", pluginVersion: "0.1.0",
        deviceName: () => "dev-a",
        registry: overrides.registry ?? (() => ({ source: "fallback", plugins: [] })),
        confirm: async () => true,
        audit: overrides.audit ?? (() => {}),
        editorContext: () => null,
        dailyStatus: async () => ({ docId: null, exists: false }),
        openDoc: () => {}, openSetting: () => {},
        getCheckin: () => undefined, getContacts: () => undefined,
    });
}

/** dispatch 私有方法的测试通道（类型安全出口，避免每处重复 as unknown as） */
export function dispatchOf(svc: BridgeService): (id: string, op: string, args?: object) => Promise<{ status: string; data: unknown; message: string }> {
    const d = (svc as unknown as { dispatch: (cmd: { id: string; op: string; args?: object }) => Promise<{ status: string; data: unknown; message: string }> }).dispatch.bind(svc);
    return (id, op, args) => d({ id, op, args });
}
