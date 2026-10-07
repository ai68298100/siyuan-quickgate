import { describe, expect, it } from "vitest";
import { SerialTransitionQueue } from "../src/services/serial-transition";

describe("SerialTransitionQueue", () => {
    it("按提交顺序等待异步任务，避免 start/stop 交错", async () => {
        const queue = new SerialTransitionQueue();
        const events: string[] = [];
        let release!: () => void;
        const first = queue.run(async () => {
            events.push("first:start");
            await new Promise<void>((resolve) => { release = resolve; });
            events.push("first:end");
            return 1;
        });
        const second = queue.run(async () => {
            events.push("second:start");
            return 2;
        });
        await Promise.resolve();
        expect(events).toEqual(["first:start"]);
        release();
        await expect(first).resolves.toBe(1);
        await expect(second).resolves.toBe(2);
        expect(events).toEqual(["first:start", "first:end", "second:start"]);
    });

    it("前一任务失败后仍继续后续任务", async () => {
        const queue = new SerialTransitionQueue();
        const first = queue.run(async () => { throw new Error("boom"); });
        const second = queue.run(async () => "ok");
        await expect(first).rejects.toThrow("boom");
        await expect(second).resolves.toBe("ok");
    });
});
