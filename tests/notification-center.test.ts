/**
 * G5-02 通知中心数据面（R300）：聚合排序（err>warn>info）、动作指向、全绿单条。
 */
import { describe, expect, it } from "vitest";
import { buildNotifications } from "../src/notification-center";

const base = { recoveryCount: 0, pendingCommands: 0, lateCompletions: 0, consecutiveFailures: 0, bridgeRunning: true };

describe("buildNotifications（G5-02 通知聚合）", () => {
    it("全绿 → 单条『一切正常』", () => {
        const out = buildNotifications(base);
        expect(out).toHaveLength(1);
        expect(out[0].title).toBe("一切正常");
        expect(out[0].action).toBe("none");
    });

    it("按严重度排序：err（退避）在 warn（恢复）在 info（桥关）之前；恢复>2 项升级 err", () => {
        const out = buildNotifications({ ...base, bridgeRunning: false, recoveryCount: 1, consecutiveFailures: 2 });
        expect(out.map((n) => n.level)).toEqual(["err", "warn", "info"]);
        expect(out[0].title).toContain("轮询连续失败 2 次");
        expect(out[1].action).toBe("recovery");
        expect(out[2].action).toBe("connection");
        const heavy = buildNotifications({ ...base, recoveryCount: 3 });
        expect(heavy.find((n) => n.action === "recovery")!.level).toBe("err"); // >2 项升级
    });

    it("failed24h>0 → warn 聚合卡指向队列；0/缺省不产生", () => {
        const out = buildNotifications({ ...base, failed24h: 2 });
        const f = out.find((n) => n.title.includes("失败命令"));
        expect(f!.level).toBe("warn");
        expect(f!.action).toBe("queue");
        expect(buildNotifications({ ...base, failed24h: 0 }).some((n) => n.title.includes("失败命令"))).toBe(false);
    });

    it("积压/迟到完成各成一条且指向队列", () => {
        const out = buildNotifications({ ...base, pendingCommands: 5, lateCompletions: 1 });
        expect(out.filter((n) => n.action === "queue")).toHaveLength(2);
        expect(out.find((n) => n.title.includes("积压"))!.level).toBe("warn");
        expect(out.find((n) => n.title.includes("迟到"))!.level).toBe("info");
    });
});
