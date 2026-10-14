import { describe, expect, it, vi } from "vitest";
import {
    discoverWorkspaceKernel, kernelPortsFromNetstat, pidsFromTasklist,
} from "../src/mcp/discover";

const NETSTAT = [
    "",
    "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234",
    "  TCP    0.0.0.0:6806           0.0.0.0:0              LISTENING       31220",
    "  TCP    [::]:6808              [::]:0                 LISTENING       31220",
    "  TCP    127.0.0.1:5993         0.0.0.0:0              LISTENING       69736",
    "  TCP    0.0.0.0:5993           0.0.0.0:0              LISTENING       69736",
    "  UDP    0.0.0.0:5353           *:*                                    69736",
    "  TCP    192.168.1.5:139        0.0.0.0:0              LISTENING       999",
    "  TCP    0.0.0.0:9999           0.0.0.0:0              ESTABLISHED     69736",
    "",
].join("\r\n");

const TASKLIST = [
    '"Image Name","PID","Session Name","Session#","Mem Usage"',
    '"System Idle Process","0","Services","0","8 K"',
    '"SiYuan-Kernel.exe","31220","Console","1","320,908 K"',
    '"SiYuan-Kernel.exe","69736","Console","1","531,432 K"',
    '"SiYuan.exe","22004","Console","1","137,852 K"',
    '"siyuan-glean-s1.exe","46156","Console","1","100,264 K"',
].join("\r\n");

describe("工作区内核端口自动发现（3.8.7-alpha 双内核，ai-clients §3.3）", () => {
    it("tasklist csv → 只取 SiYuan-Kernel.exe 的 PID（同名大小写敏感；UI/其他进程不混入）", () => {
        expect(pidsFromTasklist(TASKLIST)).toEqual(["31220", "69736"]);
        expect(pidsFromTasklist("")).toEqual([]);
    });

    it("netstat → 目标 PID 的 TCP LISTENING 端口去重升序（IPv4/IPv6 合并；UDP/非监听/他进程排除）", () => {
        expect(kernelPortsFromNetstat(NETSTAT, ["31220"])).toEqual([6806, 6808]);
        expect(kernelPortsFromNetstat(NETSTAT, ["69736"])).toEqual([5993]);
        expect(kernelPortsFromNetstat(NETSTAT, ["69736", "31220"])).toEqual([5993, 6806, 6808]);
        expect(kernelPortsFromNetstat(NETSTAT, [])).toEqual([]);
        expect(kernelPortsFromNetstat("garbage", ["1"])).toEqual([]);
    });

    it("discover：显式 url 原样返回（去尾斜杠，不探测）", async () => {
        let probed = 0;
        const found = await discoverWorkspaceKernel({
            url: "http://127.0.0.1:5993/", token: "t", probe: async () => { probed += 1; return true; },
        });
        expect(found).toBe("http://127.0.0.1:5993");
        expect(probed).toBe(0);
    });

    it("discover：6806 命中即返回（≤3.8.6 单内核快路径，不触发进程扫描）", async () => {
        const probed: string[] = [];
        const listProcesses = vi.fn(async () => { throw new Error("不应扫描进程"); });
        const listPorts = vi.fn(async () => { throw new Error("不应扫描端口"); });
        const found = await discoverWorkspaceKernel({
            token: "t",
            probe: async (u) => { probed.push(u); return u.endsWith(":6806"); },
            listProcesses,
            listPorts,
        });
        expect(found).toBe("http://127.0.0.1:6806");
        expect(probed).toEqual(["http://127.0.0.1:6806"]);
        expect(listProcesses).not.toHaveBeenCalled();
        expect(listPorts).not.toHaveBeenCalled();
    });

    it.each(["win32", "linux", "darwin"])("discover：%s 注入扫描依赖时按候选端口鉴权，不受宿主平台屏蔽", async (platform) => {
        const probed: string[] = [];
        const found = await discoverWorkspaceKernel({
            token: "good",
            platform,
            probe: async (u) => { probed.push(u); return u.endsWith(":5993"); },
            listProcesses: async () => TASKLIST,
            listPorts: async () => NETSTAT,
        });
        expect(found).toBe("http://127.0.0.1:5993");
        // 默认端口先探测一次，剩余候选按升序；不重复探测 netstat 中的 6806。
        expect(probed).toEqual(["http://127.0.0.1:6806", "http://127.0.0.1:5993"]);
    });

    it("非 Windows 缺少完整注入时不执行系统扫描，只探测默认端口", async () => {
        const listProcesses = vi.fn(async () => TASKLIST);
        const probe = vi.fn(async (_url: string) => false);
        expect(await discoverWorkspaceKernel({ token: "t", platform: "linux", probe, listProcesses })).toBeNull();
        expect(listProcesses).not.toHaveBeenCalled();
        expect(probe.mock.calls.map(([url]) => url)).toEqual(["http://127.0.0.1:6806"]);
    });

    it("discover：全部失败回 null（调用方回退 6806 让错误自然暴露）", async () => {
        const found = await discoverWorkspaceKernel({
            token: "t",
            probe: async () => false,
            listProcesses: async () => TASKLIST,
            listPorts: async () => NETSTAT,
        });
        expect(found).toBeNull();
    });

    it("discover：进程/netstat 副作用抛错不致命——退化为只试 6806", async () => {
        const found = await discoverWorkspaceKernel({
            token: "t",
            probe: async () => false,
            listProcesses: async () => { throw new Error("no tasklist"); },
            listPorts: async () => { throw new Error("no netstat"); },
        });
        expect(found).toBeNull();
    });
});
