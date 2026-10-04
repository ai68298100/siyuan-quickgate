import { describe, expect, it } from "vitest";
import { createKernelOpHandler, type KernelDeps } from "../src/kernel-ops";
import type { EcosystemManifest } from "../src/services/bridge-service";
import { validateTemplatePath, validateTemplateContent } from "../src/services/path-guard";
import { AuditEntry } from "../src/types/bridge";
import { MemKernel, makeTestService, testEnvelope } from "./helpers/test-env";

/**
 * template.new 路径安全回归（safety-gate-contract §7 · TODO L628 R78-P0）。
 * 矩阵七用例逐条对齐合同；NDJSON 通道同时断言写 op 审计（safety-gate §6 差距① · TODO L446）。
 */

/** §7 回归矩阵：六个恶意路径 + 一个合法路径 */
const MATRIX: Array<{ p: string; why: string }> = [
    { p: "../conf/siyuan.json", why: ".. 回溯出目录" },
    { p: "a/../../storage/petal/x/bridge/results.ndjson", why: "多层回溯触及桥台账" },
    { p: "..\\windows", why: "反斜杠" },
    { p: "a\0b.md", why: "NUL 字符" },
    { p: "/data/templates/hello.md", why: "绝对路径" },
    { p: "a".repeat(301) + ".md", why: "超长（>200）" },
];

describe("path-guard（templatePath 白名单守卫）", () => {
    it("§7 恶意矩阵逐条拒绝且原因可读", () => {
        for (const { p, why } of MATRIX) {
            const r = validateTemplatePath(p);
            expect(r.ok, `${why}（${JSON.stringify(p.slice(0, 30))}）应被拒绝`).toBe(false);
            if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
        }
    });
    it("合法路径放行", () => {
        expect(validateTemplatePath("hello.md").ok).toBe(true);
        expect(validateTemplatePath("sub/dir_notes/file.txt").ok).toBe(true);
    });
    it("内容上限：>64KB 拒绝；不得截断执行", () => {
        expect(validateTemplateContent("x".repeat(64 * 1024)).ok).toBe(true);
        const r = validateTemplateContent("x".repeat(64 * 1024 + 1));
        expect(r.ok).toBe(false);
        expect(validateTemplatePath("a".repeat(196) + ".md").ok).toBe(true); // 200 字符上限内
    });
});

/** 内核假件（kernel 通道）：files 表 + kpost 脚本化 */
function makeKernelDeps(files: Map<string, string>) {
    const calls: Array<{ endpoint: string; payload: unknown }> = [];
    const deps: KernelDeps = {
        kpost: async (endpoint, payload = {}) => {
            calls.push({ endpoint, payload });
            if (endpoint === "/api/template/renderSprig") return `rendered:${(payload as { template: string }).template}` as never;
            if (endpoint === "/api/filetree/createDocWithMd") return "20260101110000-abc" as never;
            throw new Error(`unexpected kpost ${endpoint}`);
        },
        getFileText: async (path) => files.get(path) ?? null,
        manifest: { version: 1, plugins: [] } as unknown as EcosystemManifest,
        pluginName: "siyuan-quickgate",
    };
    return { deps, calls };
}

describe("template.new 内核通道（kernel route）", () => {
    it("§7 恶意矩阵：全部 rejected，且不触达任何内核写调用", async () => {
        for (const { p } of MATRIX) {
            const { deps, calls } = makeKernelDeps(new Map());
            const r = await createKernelOpHandler(deps)("template.new", { notebook: "nb", hpath: "/a.md", templatePath: p });
            expect(r.status, p.slice(0, 30)).toBe("rejected");
            expect(calls, `${p.slice(0, 30)} 不应触达内核`).toHaveLength(0);
        }
    });
    it("合法 templatePath：读取 /templates/ 下文件并渲染建文档", async () => {
        const files = new Map([["/templates/hello.md", "# hi"]]);
        const { deps, calls } = makeKernelDeps(files);
        const r = await createKernelOpHandler(deps)("template.new", { notebook: "nb", hpath: "/a.md", templatePath: "hello.md" });
        expect(r.status).toBe("recorded");
        expect(calls.map((c) => c.endpoint)).toEqual(["/api/template/renderSprig", "/api/filetree/createDocWithMd"]);
    });
    it("内容超限：拒绝且不渲染", async () => {
        const files = new Map([["/templates/big.md", "x".repeat(64 * 1024 + 1)]]);
        const { deps, calls } = makeKernelDeps(files);
        const r = await createKernelOpHandler(deps)("template.new", { notebook: "nb", hpath: "/a.md", templatePath: "big.md" });
        expect(r.status).toBe("rejected");
        expect(calls).toHaveLength(0);
    });
});

/** 内存文件系统（NDJSON 通道）——共享夹具 + renderSprig/createDocWithMd 函数值端点 */
const makeMem = () => {
    const mem = new MemKernel();
    mem.jsonEndpoints.set("/api/template/renderSprig", (body: { template: string }) => `rendered:${body.template}`);
    mem.jsonEndpoints.set("/api/filetree/createDocWithMd", "20260101120000-xyz");
    return mem;
};

const envelope = (id: string, op: string, args: object) => testEnvelope(id, op, args);

function makeService(mem: MemKernel, audits: AuditEntry[]) {
    const service = makeTestService(mem, { audit: (e) => audits.push(e) });
    return { service };
}

describe("template.new NDJSON 通道 + 写 op 审计", () => {
    it("§7 恶意矩阵：rejected 回执 + 失败审计留痕（不含路径值以外的内容）", async () => {
        for (const { p } of MATRIX) {
            const mem = new MemKernel();
            mem.files.set("/bridge/commands.ndjson", envelope("t1", "template.new", { notebook: "nb", hpath: "/a.md", templatePath: p }) + "\n");
            const audits: AuditEntry[] = [];
            const { service } = makeService(mem, audits);
            await service.tick();
            const results = mem.files.get("/bridge/results.ndjson") ?? "";
            expect(results.includes('"status":"rejected"'), p.slice(0, 30)).toBe(true);
            expect(audits.some((a) => a.command.startsWith("template.new args(")), `rejected 也须审计：${p.slice(0, 30)}`).toBe(true);
        }
    });
    it("合法路径：recorded + 审计；审计 command 只含 args 键名（零 PII）", async () => {
        const mem = makeMem();
        mem.files.set("/templates/hello.md", "# hi");
        mem.files.set("/bridge/commands.ndjson", envelope("t2", "template.new", { notebook: "nb", hpath: "/a.md", templatePath: "hello.md" }) + "\n");
        const audits: AuditEntry[] = [];
        const { service } = makeService(mem, audits);
        await service.tick();
        const results = mem.files.get("/bridge/results.ndjson") ?? "";
        expect(results.includes('"status":"recorded"')).toBe(true);
        expect(audits[0]?.command).toBe("template.new args(notebook,hpath,templatePath)");
        expect(audits[0]?.plugin).toBe("siyuan-quickgate");
        expect(audits[0]?.status).toBe("recorded");
    });
    it("读操作不进写审计面（bridge.ping 无审计条目）", async () => {
        const mem = new MemKernel();
        mem.files.set("/bridge/commands.ndjson", envelope("t3", "bridge.ping", {}) + "\n");
        const audits: AuditEntry[] = [];
        const { service } = makeService(mem, audits);
        await service.tick();
        expect(audits).toHaveLength(0);
    });
});
