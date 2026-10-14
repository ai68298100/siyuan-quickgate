import { describe, expect, it } from "vitest";
import { parseTag } from "../design/scripts/todo-snapshot.mjs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

describe("账本优先级与泳道分开解析", () => {
    it.each(["R366-G3-P1·快速捕获·实现", "R366·G3·P1·快速捕获·实现"])("%s 使用显式 P1，泳道不占主题", (tag) => {
        expect(parseTag(tag)).toMatchObject({ round: "R366", priority: "P1", topic: "快速捕获", type: "实现" });
    });
    it("历史 R71-P0 与只有 G0 的条目保持兼容", () => {
        expect(parseTag("R71-P0·输入·开发")).toMatchObject({ round: "R71", priority: "P0", topic: "输入", type: "开发" });
        expect(parseTag("R123·G0·规范主线")).toMatchObject({ round: "R123", priority: "G0", type: "规范主线" });
    });
    it("无优先级的实测与状态标签不凭空补 P0", () => {
        expect(parseTag("实测·需Quicker")).toMatchObject({ priority: null, type: "实测", status: "需Quicker" });
    });
    it("CLI 从无 TODO 的临时目录运行仍解析本仓库账本，且不写文件", () => {
        const script = fileURLToPath(new URL("../design/scripts/todo-snapshot.mjs", import.meta.url));
        const output = execFileSync(process.execPath, [script], { cwd: tmpdir(), encoding: "utf8" });
        expect(output).toMatch(/条目 \d+\/\d+/);
        expect(output).toContain("R123 验收 A/B 通过");
        expect(output).not.toContain("已写入");
    });
});
