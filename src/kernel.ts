/**
 * 小驴快门 · 内核插件（v2 预留位）。
 * 当前为最小桩：仅注册一个 ping RPC，证明 kernel 侧构建链路可用。
 * 私有路由 /plugin/private/siyuan-quickgate/exec（同步通道）按 TODO §5.6 在
 * P0/P1 契约稳定后实施；实施前重读模板 docs/kernel-plugin.md。
 */
import type * as kernel from "siyuan/kernel";

const api: kernel.ISiyuan = siyuan;

api.plugin.lifecycle.onload = async () => {
    await api.logger.info(`[${api.plugin.name}] kernel stub loading (v2 预留，未启用同步通道)`);
    await api.rpc.bind("ping", async () => {
        return { plugin: api.plugin.name, pong: true, at: new Date().toISOString() };
    }, "快门内核桩：连通性测试");
};
