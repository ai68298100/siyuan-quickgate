import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/services/store";

/** 混沌工程：故意注入恶劣输入验证系统韧性（不依赖 SiYuan 内核） */

describe("混沌工程：设置归一化恶劣场景", () => {
    it("normalizeSettings 为 null/undefined/数组/字符串 → 回默认", () => {
        expect(normalizeSettings(null).bridgeEnabled).toBe(false);
        expect(normalizeSettings(undefined).bridgeEnabled).toBe(false);
        expect(normalizeSettings([1,2,3] as unknown as Record<string,unknown>).bridgeEnabled).toBe(false);
        expect(normalizeSettings("string" as unknown as Record<string,unknown>).bridgeEnabled).toBe(false);
    });

    it("normalizeSettings 越界值 → 回默认", () => {
        const s = normalizeSettings({ pollMs: -1, backoffMaxMs: -1, auditMax: -1, bridgeBasePath: "../etc/passwd", deviceName: "x".repeat(200) });
        expect(s.pollMs).toBe(500);
        expect(s.backoffMaxMs).toBe(10000);
        expect(s.auditMax).toBe(200);
        expect(s.bridgeBasePath).toBe("/storage/petal/siyuan-quickgate/bridge");
        expect(s.deviceName.length).toBe(64);
    });

    it("normalizeSettings 正常值 → 保留", () => {
        const s = normalizeSettings({ bridgeEnabled: true, pollMs: 1000, confirmExec: false });
        expect(s.bridgeEnabled).toBe(true);
        expect(s.pollMs).toBe(1000);
        expect(s.confirmExec).toBe(false);
    });
});

describe("混沌工程：JSON 恶劣输入", () => {
    it("合法 JSON 解析不崩溃", () => {
        const valid = ['null', '{"a":1}', '[1,2]', '"string"', '123', 'true', 'false', '{}', '[]'];
        for (const input of valid) {
            expect(() => JSON.parse(input)).not.toThrow();
        }
    });

    it("无效 JSON 抛 SyntaxError（系统层 catch 处理而非阻止抛出）", () => {
        const invalid = ['{"a":}', '{"a":1,}', '[1,2,', '{', '}', '', '  '];
        for (const input of invalid) {
            expect(() => JSON.parse(input)).toThrow();
        }
    });

    it("prototype pollution 尝试不污染 Object.prototype", () => {
        const input = '{"__proto__":{"polluted":"yes"}}';
        const parsed = JSON.parse(input);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("超长 JSON 字符串（1MB）解析不崩溃", () => {
        const huge = JSON.stringify({ data: "x".repeat(1024 * 1024) });
        const parsed = JSON.parse(huge);
        expect(parsed.data.length).toBe(1024 * 1024);
    });
});
