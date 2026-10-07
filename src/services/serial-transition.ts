/**
 * 将异步生命周期动作串行化。
 *
 * 每个任务都接在上一个任务之后；任务失败只影响自身，后续任务仍会继续。
 * 适用于桥的 start/stop/restart，避免用户快速切换开关时旧停机和新启动交错。
 */
export class SerialTransitionQueue {
    private tail: Promise<void> = Promise.resolve();

    run<T>(task: () => Promise<T>): Promise<T> {
        const result = this.tail.then(task, task);
        this.tail = result.then(() => undefined, () => undefined);
        return result;
    }
}
