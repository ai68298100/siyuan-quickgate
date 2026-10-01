import { describe, expect, it, vi } from "vitest";
import { SingleFlightPoller } from "../src/services/poller";

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("poller 单飞调度（阻断项5）", () => {
    it("慢 tick 期间不重入", async () => {
        let active = 0;
        let maxConcurrent = 0;
        const poller = new SingleFlightPoller({
            intervalMs: 1,
            backoffMaxMs: 10,
            tick: async () => {
                active += 1;
                maxConcurrent = Math.max(maxConcurrent, active);
                await new Promise((r) => setTimeout(r, 20));
                active -= 1;
            },
            shouldRun: () => true,
            delay: () => flush(),
        });
        poller.start();
        await new Promise((r) => setTimeout(r, 120));
        poller.stop();
        expect(maxConcurrent).toBe(1);
    });

    it("连续失败指数退避，成功后复位", async () => {
        let fail = true;
        const poller = new SingleFlightPoller({
            intervalMs: 10,
            backoffMaxMs: 50,
            tick: async () => {
                if (fail) throw new Error("down");
            },
            shouldRun: () => true,
            delay: () => flush(),
        });
        poller.start();
        await new Promise((r) => setTimeout(r, 60));
        expect(poller.consecutiveFailures).toBeGreaterThanOrEqual(2);
        expect(poller.currentInterval()).toBeGreaterThan(10);
        fail = false;
        await new Promise((r) => setTimeout(r, 60));
        expect(poller.consecutiveFailures).toBe(0);
        poller.stop();
    });

    it("stop 后循环退出，shouldRun=false 同样退出", async () => {
        let ticks = 0;
        const poller = new SingleFlightPoller({
            intervalMs: 1,
            backoffMaxMs: 5,
            tick: async () => { ticks += 1; },
            shouldRun: () => ticks < 3,
            delay: () => flush(),
        });
        poller.start();
        await new Promise((r) => setTimeout(r, 80));
        expect(ticks).toBe(3);
        expect(poller.isRunning).toBe(false);
    });
});
