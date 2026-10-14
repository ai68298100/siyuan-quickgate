/**
 * 工作区内核端口自动发现（v0.9.1 · ai-clients §3.3 端口痛点）：
 * 思源 ≥3.8.7-alpha 双内核架构下，6806 被启动器内核（无工作区）持有，工作区内核
 * 每次启动分配动态端口且 Token 不通用。本模块按「Token 鉴权通过」为唯一判据自动
 * 找到工作区内核：显式 SIYUAN_URL → 6806（≤3.8.6 单内核）→ SiYuan-Kernel 进程的
 * 监听端口逐个探测。副作用（进程表/netstat/HTTP 探测）全部可注入，纯函数单测。
 * 注意：思源未运行/Token 全部失败时返回 null——调用方回退默认 6806 让错误自然暴露。
 */

/** tasklist /fo csv /nh 输出 → SiYuan-Kernel.exe 的 PID 集合 */
export function pidsFromTasklist(text: string): string[] {
    const pids = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('"')) continue;
        const cols = line.split('","').map((c) => c.replace(/^"|"$/g, ""));
        if (cols[0] === "SiYuan-Kernel.exe" && cols[1]) pids.add(cols[1]);
    }
    return [...pids];
}

/** netstat -ano 输出 + PID 集合 → 这些进程的 LISTENING 端口（去重升序） */
export function kernelPortsFromNetstat(text: string, pids: string[]): number[] {
    const want = new Set(pids);
    const ports = new Set<number>();
    for (const line of text.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        // 形如 TCP 0.0.0.0:6806 0.0.0.0:0 LISTENING 31220（IPv6 同型；UDP 无 LISTENING 态）
        if (cols[0] !== "TCP" || cols[3] !== "LISTENING" || !want.has(cols[4] ?? "")) continue;
        const local = cols[1] ?? "";
        const port = Number(local.slice(local.lastIndexOf(":") + 1));
        if (Number.isInteger(port) && port > 0 && port < 65536) ports.add(port);
    }
    return [...ports].sort((a, b) => a - b);
}

export interface DiscoverDeps {
    /** 显式 URL（SIYUAN_URL）；给出则原样返回不探测 */
    url?: string;
    token: string;
    /** 探测某个候选 URL：true=该内核认这个 Token（即工作区内核）。默认 lsNotebooks code===0 */
    probe?: (url: string, token: string) => Promise<boolean>;
    /** tasklist CSV；注入依赖与系统平台无关，默认命令仅用于 win32 */
    listProcesses?: () => Promise<string>;
    /** netstat -ano 输出；注入依赖与系统平台无关，默认命令仅用于 win32 */
    listPorts?: () => Promise<string>;
    /** 单个候选探测超时 ms（默认 1200） */
    timeoutMs?: number;
    /** 默认扫描命令的运行平台；测试可注入，不限制显式提供的扫描依赖 */
    platform?: string;
}

async function defaultProbe(url: string, token: string, timeoutMs: number): Promise<boolean> {
    try {
        const r = await fetch(`${url}/api/notebook/lsNotebooks`, {
            method: "POST",
            headers: { Authorization: `Token ${token}` },
            body: "{}",
            signal: AbortSignal.timeout(timeoutMs),
        });
        const j = (await r.json().catch(() => null)) as { code?: number } | null;
        return r.status === 200 && j?.code === 0;
    } catch {
        return false;
    }
}

/**
 * 返回工作区内核 base URL（无尾斜杠），找不到返回 null。
 * 顺序：显式 url → 6806（老单内核）→ SiYuan-Kernel 监听端口升序。
 */
export async function discoverWorkspaceKernel(deps: DiscoverDeps): Promise<string | null> {
    if (deps.url) return deps.url.replace(/\/$/, "");
    const probe = deps.probe ?? ((u, t) => defaultProbe(u, t, deps.timeoutMs ?? 1200));
    const defaultUrl = "http://127.0.0.1:6806";
    if (await probe(defaultUrl, deps.token)) return defaultUrl;
    let ports: number[];
    try {
        let listProcesses = deps.listProcesses;
        let listPorts = deps.listPorts;
        if (!listProcesses || !listPorts) {
            if ((deps.platform ?? process.platform) !== "win32") return null;
            const { execFile } = await import("node:child_process");
            const command = (cmd: string, args: string[]) => new Promise<string>((resolve) => {
                execFile(cmd, args, { windowsHide: true, timeout: 4000 }, (err, stdout) => resolve(err ? "" : String(stdout)));
            });
            listProcesses ??= () => command("tasklist", ["/fo", "csv", "/nh"]);
            listPorts ??= () => command("netstat", ["-ano"]);
        }
        const pids = pidsFromTasklist(await listProcesses());
        if (pids.length === 0) return null;
        ports = kernelPortsFromNetstat(await listPorts(), pids);
    } catch {
        // 默认端口已探测；扫描失败不能认定任何动态端口有效。
        return null;
    }
    for (const port of ports) {
        const url = `http://127.0.0.1:${port}`;
        if (url === defaultUrl) continue;
        if (await probe(url, deps.token)) return url;
    }
    return null;
}
