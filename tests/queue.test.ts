import { describe, expect, it } from "vitest";
import { compactCommands, capProcessed } from "../src/services/queue";

const cmd = (id: string) => JSON.stringify({ v: 1, id, op: "bridge.ping", args: {} });

describe("queue.compactCommands（阻断项1 修正）", () => {
    it("仅移除已处理 id 的行", () => {
        const text = [cmd("a"), cmd("b"), cmd("c")].join("\n");
        const out = compactCommands(text, new Set(["a", "c"]));
        expect(out).toBe(cmd("b"));
    });

    it("关键场景：压缩期间外部追加的新行不被丢失", () => {
        // 消费者处理了 a，随后外部在旧快照基础上追加了 b；
        // 无论谁先写回，包含 b 的内容都应被保留
        const text = [cmd("a"), cmd("b")].join("\n");
        const out = compactCommands(text, new Set(["a"]));
        expect(out).toBe(cmd("b"));
    });

    it("复活行（已处理 id 再次出现）被再次压缩", () => {
        const text = [cmd("a"), cmd("b")].join("\n");
        const once = compactCommands(text, new Set(["a"]));
        const resurrected = [once, cmd("a")].join("\n"); // 外部写回旧内容
        const twice = compactCommands(resurrected, new Set(["a"]));
        expect(twice).toBe(cmd("b"));
    });

    it("坏行默认保留（防静默丢数据），可选移除", () => {
        const text = ["{bad json", cmd("a")].join("\n");
        expect(compactCommands(text, new Set(["a"]))).toBe("{bad json");
        expect(compactCommands(text, new Set(["a"]), { dropBadLines: true })).toBe("");
    });
});

describe("queue.capProcessed（阻断项4 边界）", () => {
    it("超限按时间淘汰最旧", () => {
        const processed: Record<string, number> = { a: 3, b: 1, c: 2 };
        const out = capProcessed(processed, 2);
        expect(Object.keys(out).sort()).toEqual(["a", "c"]);
    });

    it("未超限原样返回", () => {
        const processed = { a: 1 };
        expect(capProcessed(processed, 10)).toBe(processed);
    });
});
