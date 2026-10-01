import { describe, expect, it } from "vitest";
import { probeCommandRegistry, runCommand } from "../src/services/registry";

function fakeWindow(plugins: unknown[]) {
    return () => ({ siyuan: { ws: { app: { plugins } } } });
}

describe("registry 探测（v0.5.8 审计：ICommand.langKey 身份/多回调形态）", () => {
    it("langKey-only 命令被识别（旧逻辑读 command/id 会漏掉全部命令）", () => {
        const probe = probeCommandRegistry(fakeWindow([
            {
                name: "siyuan-speed-switch", displayName: "小驴雷切", i18n: {},
                commands: [{ langKey: "openSwitcher", langText: "打开切换器", hotkey: "", callback: () => 1 }],
            },
        ]));
        expect(probe.source).toBe("host");
        expect(probe.plugins[0].commands[0].id).toBe("openSwitcher");
        expect(probe.plugins[0].commands[0].title).toBe("打开切换器");
    });

    it("langText 缺省时从插件 i18n 解析标题", () => {
        const probe = probeCommandRegistry(fakeWindow([
            {
                name: "p1", i18n: { doThing: "做这件事" },
                commands: [{ langKey: "doThing", hotkey: "", callback: () => 1 }],
            },
        ]));
        expect(probe.plugins[0].commands[0].title).toBe("做这件事");
    });

    it("execute-only / globalCallback 命令可外部执行；hotkeys[] 并入 accelerator", () => {
        const probe = probeCommandRegistry(fakeWindow([
            {
                name: "p1", i18n: {},
                commands: [
                    { langKey: "ex", execute: () => 2, hotkeys: ["Ctrl+1", "Ctrl+2"] },
                    { langKey: "gb", globalCallback: () => 3 },
                ],
            },
        ]));
        const cmds = probe.plugins[0].commands;
        expect(cmds[0].callback).toBeDefined();
        expect(cmds[0].accelerator).toBe("Ctrl+1,Ctrl+2");
        expect(cmds[1].callback).toBeDefined();
        expect(cmds[0].focusOnly).toBeUndefined();
    });

    it("editorCallback-only → focusOnly 标记；runCommand 诚实 unsupported（不盲执行）", async () => {
        const probe = probeCommandRegistry(fakeWindow([
            {
                name: "p1", i18n: {},
                commands: [{ langKey: "ed", editorCallback: (protyle: unknown) => protyle }],
            },
        ]));
        const cmd = probe.plugins[0].commands[0];
        expect(cmd.focusOnly).toBe(true);
        expect(cmd.callback).toBeUndefined();
        const r = await runCommand(probe, "p1", "ed", { confirmExec: false, confirm: async () => true });
        expect(r.status).toBe("unsupported");
        expect(r.message).toContain("焦点");
    });

    it("callback 优先于更具体回调存在与否均可用；非数组 plugins → fallback 降级", () => {
        const probe1 = probeCommandRegistry(fakeWindow([
            { name: "p1", i18n: {}, commands: [{ langKey: "both", callback: () => 1, execute: () => 2 }] },
        ]));
        expect(typeof probe1.plugins[0].commands[0].callback).toBe("function");
        const probe2 = probeCommandRegistry(() => ({ siyuan: { ws: { app: { plugins: "not-array" } } } }));
        expect(probe2.source).toBe("fallback");
        expect(probe2.reason).toContain("降级");
    });
});
