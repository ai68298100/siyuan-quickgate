# 雷切 0.44 新能力 op 面评估（L327 · design note · R233）

> 对象：`siyuan-speed-switch` 0.44.x 新增三能力——`get-document-outline`（文档大纲）、`home-adapter-diagnostics`（主页适配器诊断）、`restore-document-set`（恢复文档集）。
> 问题：是否为它们开快门专用 op，或并入 `plugin.api` 允许名单即止。
> 状态：**裁定=不开新 op**（v0 裁定，可被触发条件推翻，见 §3）。

## 1. 现状可达性（三能力今天已经全部可用）

| 通道 | 可达性 | 说明 |
|---|---|---|
| `commands.run` | ✅ 既有 | 雷切命令面板条目天然暴露全部宿主命令（含三能力对应的命令面）；黑名单/确认/审计共用 |
| `plugin.api` 透传 | ✅ 既有 | `siyuan-speed-switch` 在默认允许名单（三个已完成契约审计插件之一，R228 校准）；agent-capabilities 面结构化可调 |
| 专用 op | ✗ 无 | 快门 op 面当前 26 个，无 `leiche.*` / `outline.*` 类 op |

## 2. 裁定理由（不开新 op）

1. **op 面纪律**（ops.ts 头注）：每个新 op = dispatch + 内核路由判定 + 契约 JSON + MCP schema + api.md 五处同步 + 双通道测试——成本固定而收益取决于使用频率；三能力尚无使用记录（§7 使用日志为空）。
2. **已有等价路径**：`commands.run` 覆盖命令面、`plugin.api` 覆盖结构化面——开专用 op 属于同一能力的第三条路径，违反「同能力单一 owner 入口」的简洁性（capability-registry 合同：写能力必须在 capabilities 可枚举，通道不重复建设）。
3. **kernel 路由无增益**：三能力均需宿主前端（雷切 UI/状态），内核侧直呼无意义——专用 op 只会是 FRONTEND_ONLY，与 `commands.run`/`plugin.api` 无差异。

## 3. 重开条件（满足其一再立项）

1. **高频+结构化**：某能力进入 §7 使用日志 ≥3 次/周，且调用方需要结构化返回（非命令式触发）——首查 `get-document-outline`（AI 上下文注入场景：大纲→意图上下文）；
2. **内核通道价值**：桥关闭态下仍需该能力（需上游把能力做成内核侧可查——目前不可能，纯前端插件）；
3. **跨插件复用**：≥2 个小驴插件暴露同形能力（如多插件都有 outline）——届时按能力（非插件）设计统一 op。

## 4. 追溯

- 触发：L327（R74 登记）；能力清单源=ecosystem-manifest v2（R228 真机校准，speed-switch 14 能力含三新能力）
- 关联：L611（新增联动必须同步 op 五处）、G5 治理（不为调研而立项；无用户证据不升级）
