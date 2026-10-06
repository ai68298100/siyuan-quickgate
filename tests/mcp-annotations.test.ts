import { describe, expect, it } from "vitest";
import { buildToolDefs } from "../src/mcp/tools";

/** MCP 规范 annotations（R234 生态调研候选① · docs/10-生态调研-R2.md §2-①） */
describe("MCP 规范 annotations", () => {
    const defs = buildToolDefs();
    const byName = new Map(defs.map((d) => [d.name, d]));

    it("26 工具全部输出四注解且显式恒填（规范对 destructiveHint 缺省按 true 解读——不可依赖缺省）", () => {
        expect(defs.length).toBe(27);
        for (const d of defs) {
            const a = d.annotations;
            expect(typeof a.readOnlyHint).toBe("boolean");
            expect(typeof a.destructiveHint).toBe("boolean");
            expect(typeof a.idempotentHint).toBe("boolean");
            expect(typeof a.openWorldHint).toBe("boolean");
            if (a.readOnlyHint) expect(a.destructiveHint).toBe(false); // 只读⇒非破坏（规范 SHOULD）
        }
    });

    it("抽样语义：ping 幂等封闭 / checkin.record 非幂等 / plugin.api 破坏+开放世界", () => {
        expect(byName.get("bridge.ping")!.annotations).toEqual({
            readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
        });
        expect(byName.get("checkin.record")!.annotations.idempotentHint).toBe(false);
        expect(byName.get("checkin.record")!.annotations.readOnlyHint).toBe(false);
        expect(byName.get("plugin.api")!.annotations).toEqual({
            readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true,
        });
        expect(byName.get("favorites.add")!.annotations.idempotentHint).toBe(true); // upsert 语义
        expect(byName.get("config.discover")!.annotations.idempotentHint).toBe(false); // 有 opt-in 创建面
    });
});
