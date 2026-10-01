# WALKTHROUGH — M0 spike 实证记录

> 状态标记：⬜ 待实证 · ✅ 已实证（含结论与日期） · ❌ 证伪（附替代方案）
> 规则：每一项实证后立即回填本文件与对应源码；未实证的代码路径必须保持"探测失败自动降级"。

## ① 命令注册表形状 ⬜
- 计划：DevTools 控制台遍历 `window.siyuan.ws.app.plugins`，console.table 输出命令结构
- 结论：（待填）
- 影响文件：src/services/registry.ts

## ② confirm API ⬜
- 结论：（待填）
- 影响文件：src/index.ts confirmWithFront

## ③ 桥文件端到端 ⬜
- 计划：`node tools/lv-cli.mjs ping`（需先在设置页开桥）
- 验收：<2s 收到 pong
- 结论：（待填）

## ④ Web Lock 多窗口单消费 ⬜
## ⑤ SSE/WS 广播可用性 ⬜
## ⑥ petal/loadPetals 形状 ⬜
## ⑦ editor.context 字段校准 ⬜
## ⑧ 日记笔记本自动发现字段 ⬜
## ⑨ storage/local 同步边界与文件 API 可达性 ⬜
- 结论：（待填）→ 决定是否执行 D-0006 迁移
