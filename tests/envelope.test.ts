import { describe, expect, it } from "vitest";
import { parseLine, splitLines, isExpired, fingerprintLine } from "../src/services/envelope";

describe("envelope.parseLine", () => {
    it("解析合法命令", () => {
        const line = JSON.stringify({ v: 1, id: "qk-20261001-153000-ab12", op: "bridge.ping", args: {} });
        const r = parseLine(line, 0);
        expect(r.kind).toBe("ok");
        if (r.kind === "ok") {
            expect(r.command.id).toBe("qk-20261001-153000-ab12");
            expect(r.command.ttlMs).toBe(60000);
            expect(r.command.reply).toBe(true);
        }
    });

    it("拒绝坏 JSON / 非对象 / 缺 id / 坏 id / 缺 op / 版本不符 / args 超限", () => {
        const cases: Array<[string, string]> = [
            ["{not json", "JSON"],
            ["\"text\"", "对象"],
            [JSON.stringify({ v: 1, op: "x" }), "id"],
            [JSON.stringify({ v: 1, id: "bad id!", op: "x" }), "id"],
            [JSON.stringify({ v: 1, id: "abc" }), "op"],
            [JSON.stringify({ v: 2, id: "abc", op: "x" }), "协议版本"],
            [JSON.stringify({ v: 1, id: "abc", op: "x", args: { big: "x".repeat(40000) } }), "32KB"],
        ];
        for (const [line, reasonPart] of cases) {
            const r = parseLine(line, 3);
            expect(r.kind).toBe("bad");
            if (r.kind === "bad") {
                expect(r.line).toBe(3);
                expect(r.reason).toContain(reasonPart);
                expect(r.fingerprint).toMatch(/^[0-9a-f]{12}$/);
            }
        }
    });

    it("空行返回 empty", () => {
        expect(parseLine("   ", 0).kind).toBe("empty");
    });
});

describe("envelope.splitLines / isExpired", () => {
    it("CRLF 与裸 CR 归一", () => {
        expect(splitLines("a\r\nb\rc\nd")).toEqual(["a", "b", "c", "d"]);
    });

    it("过期判定：缺 createdAt 即过期；窗口内不过期", () => {
        const base = { v: 1, id: "a", op: "x", args: {} };
        expect(isExpired({ ...base })).toBe(true);
        const now = Date.now();
        expect(isExpired({ ...base, createdAt: new Date(now - 1000).toISOString(), ttlMs: 60000 }, now)).toBe(false);
        expect(isExpired({ ...base, createdAt: new Date(now - 61000).toISOString(), ttlMs: 60000 }, now)).toBe(true);
    });

    it("指纹稳定且对内容敏感", () => {
        expect(fingerprintLine("abc")).toBe(fingerprintLine("abc"));
        expect(fingerprintLine("abc")).not.toBe(fingerprintLine("abd"));
    });
});
