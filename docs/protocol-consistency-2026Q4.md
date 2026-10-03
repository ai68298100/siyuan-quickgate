# 协议一致性检查 · 第一轮（2026-10-04）

> §6 项「每季度 02 协议与快门实现一致性检查」首轮。基准：`docs/02-小驴桥协议-v1.md`（协议 v1.1）vs
> 实现 `src/services/envelope.ts` / `queue.ts` / `results.ts` / `bridge-service.ts`（v0.7.3，119 单测）。
> 结论：**九项全对齐，一项有意分歧（已裁定），两项规范侧待补**。

## 一、逐项核对

| # | 规范条款 | 实现 | 判定 |
|---|---|---|---|
| 1 | 信封字段 v/id/op/args/createdAt/ttlMs/reply/device | `BridgeCommand` 全量支持；ttlMs 缺省 60s（`isExpired`） | ✅ |
| 2 | id ≤64 字符 `[A-Za-z0-9_\-]` | `ID_RE` 同款；违规行以坏行指纹回执 rejected 一次后压缩（bug#11 修复） | ✅ |
| 3 | args ≤32KB | envelope.ts:47 超限回 rejected（坏行指纹） | ✅ |
| 4 | createdAt 语义（缺失/非法=过期） | isExpired: 缺失或 Date.parse 失败 → expired | ✅ |
| 5 | reply:false = 只执行不写回执 | bridge-service 4 处 `cmd.reply !== false` 门 | ✅ |
| 6 | device 非空且不匹配 → 跳过不消费不回执 | tick 与 executeAndRecord 双路径同规 | ✅ |
| 7 | 回执六状态 recorded/duplicate/rejected/failed/unsupported/expired | 全量实现；六语义与 §3 定义一致 | ✅ |
| 8 | 回执字段 v/id/op/status/data/message/finishedAt/plugin/elapsedMs | makeReceipt 全量（plugin/elapsedMs v1.1 冗余字段齐） | ✅ |
| 9 | results 治理：裁剪最近 200 行、外部取走不删 | `RESULTS_MAX_LINES=200` 滚动裁剪；只追加不删 | ✅ |

## 二、有意分歧（裁定：实现正确，规范侧补记）

**D-0012-A「重复投递回 duplicate」**：规范 §2 称同 id 重复投递回 `duplicate`；实现为**静默跳过**（预留语义：
同步 check+markProcessed，后到者不产生第二条回执）。

裁定理由：首到者已产生含该 id 的完整回执；若二次投递再回 duplicate，会造成「同 id 双回执」——破坏
`LV·取回执` 按 id 匹配恰好一条的工具契约，也让 results 200 行窗口的有效容量减半。调用方语义由
「再发一次看 duplicate」改为「按 id 查回执（拿到的就是首执行结果）」。`duplicate` 状态保留给
**业务层幂等命中**（如 checkin.record 的 externalRef 撞已有记录，adapters.ts:125）。

→ 行动：docs/02 §2 补记（见下「规范侧待补」）。

## 三、规范侧待补（下轮修订 docs/02 时落）

1. §2「重复投递」表述按 D-0012-A 改写：同 id 重投不新增回执，按 id 查询即得首执行结果。
2. §3 补一行：回执信封在内核路由（exec）通道下包一层 `{code:0,data:<回执>}` HTTP 信封（3.8.6 实测形状）。

## 四、实现侧顺带发现

- 无新增缺陷。本轮一致性检查同时覆盖了 bug#11（坏行压缩）与 bug#12（202 错误信封）两处修复后的行为面。
- 下轮检查（2027-01）新增核对点：事件信封（events.ndjson 行格式）与 docs/contracts/events-workflow-draft.md 的对齐。
