import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const readSource = (name: string) => readFileSync(join(root, "src", name), "utf8");

describe("生产构建导入边界", () => {
    it("诊断复制路径使用静态设置面板导入，避免 Vite 无效动态导入警告", () => {
        const index = readSource("index.ts");
        const settingsPanel = readSource("settings-panel.ts");
        const dynamicSelfImport = /import\(\s*["']\.\/settings-panel["']\s*\)/;

        expect(index).not.toMatch(dynamicSelfImport);
        expect(settingsPanel).not.toMatch(dynamicSelfImport);
        expect(index).toMatch(/import\s*\{[^}]*memDiagnostics[^}]*\}\s*from\s*["']\.\/settings-panel["']/);
    });

    it("设置面板搜索框具有可访问名称，设置行控件绑定视觉标题", () => {
        const settingsPanel = readSource("settings-panel.ts");
        expect(settingsPanel).toMatch(/data-role="qg-search"[^>]*aria-label="搜索设置"/);
        expect(settingsPanel).toContain("aria-labelledby");
    });
});
