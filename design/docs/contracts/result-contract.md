# C1 统一 Result/Receipt 合同（§18.2 R124-G1 · v0 草案）

> 目的：把 NDJSON/内核路由/广播三通道回执、workflow 计划结果、MCP tools/call 投影的**结果状态合并为一份合同**；验收=所有入口引用同一 schema、同一状态词典、同一 unknown/补救语义（§18.2 C1 条）。
> 状态：v0 草案——仅收录**已实现**形状（实现为准，本文是归一化描述）；新增入口必须映射到本合同，不得另造状态词。

## 1. 规范状态词典（封闭集）

| status | 语义 | 业务完成？ | 允许的后续动作 |
|---|---|---|---|
| `recorded` | 已执行且业务操作成功 | ✅ | 无需动作；消费方按幂等键去重 |
| `duplicate` | 同 id 重复到达，按台账跳过 | ✅（等同 recorded） | 无需动作；禁止换 id 重试 |
| `rejected` | 请求被拒（校验/黑名单/确认拒绝/白名单） | ❌ | 按 message 修正请求；**不得**原样重试 |
| `failed` | 执行中失败（上游插件错误/异常） | ❌ | 可在修正后重试；连续失败按指数退避 |
| `unsupported` | op 未收录 / 目标不可达 / 能力关闭 / 需前端 | ❌ | 换通道（kernel↔NDJSON）或换 op；不重试 |
| `expired` | TTL 超时未消费 | ❌ | 可换新 id 重发；**禁止**复用旧 id |
| `timeout`（客户端视角） | 客户端等待窗口内未收到回执 | ⚠️ **未知** | **不得**换 id 重试同一语义（可能双执行）；先 receipt 查询，再决定补救 |

不变量：
1. 状态是封闭集；新增状态必须先改本表。
2. `unknown`（timeout）不是第六种服务端状态——它是客户端对"结果未知"的诚实表达，禁止改写为成功（docs/10 §R114-P0 事实边界）。
3. 幂等：`checkin.record` / `contacts.interaction` 的幂等身份 = 信封 id 派生的 externalRef；重试必须携带原 id 语义或显式放弃。

## 2. 各载体的映射

### 2.1 桥回执（NDJSON / 内核路由 / 广播共用同形）

```json
{ "v": 1, "id": "…", "op": "…", "status": "recorded|duplicate|rejected|failed|unsupported|expired",
  "data": {}, "message": "人读说明（中文）", "finishedAt": "ISO-8601", "plugin": "siyuan-quickgate" }
```

- 三通道产出**同一形状**；广播回执照常写 results.ndjson（消费方对通道无感，D-0012）。
- 内核路由把回执包在 `data.data`（HTTP 信封 `{code:0,msg,data:<receipt>}`）。

### 2.2 workflow 结果（计划面）

```json
{ "kind": "plan|denied|expired|done", "planId": "…", "steps": [...], "expiresAt": "ISO",
  "done": 0, "stoppedAt": null|1, "message": "…" }
```

映射到规范状态：`plan` → 前置态（非结果）；`denied` → `rejected`（确认拒绝）；`expired` → `expired`；`done` → 逐步 `recorded`/`rejected` 序列（`stoppedAt` 指失败步）；单步失败即停、已完成不回滚。

### 2.3 MCP tools/call 投影

```json
{ "content": [{ "type": "text", "text": "<回执 JSON 或诊断>" }], "isError": true|false }
```

- `isError = !(status ∈ recorded|duplicate)`；timeout/unknown → isError=true（未知即失败呈现，文本携带原回执）。
- 写工具未授权 → isError=true + 指引（LV_MCP_WRITE），**不产生桥命令**。

## 3. 补救语义（唯一规则集）

| 场景 | 规则 |
|---|---|
| timeout（客户端） | ① 先 `receipt --id` 查询；② 确认未消费后**换新 id** 重发；③ 已消费则停止。禁止盲重试。 |
| expired | 换新 id 重发（旧 id 语义作废）。 |
| rejected | 修正请求后重发；确认拒绝（commands.run 30s）视为用户否决，不得自动重试。 |
| failed | 修正后可重试；同 op 连续 3 次 failed → 停止并出诊断。 |
| duplicate | 停止；视为成功。 |
| unsupported | 换通道/op；不重试。 |

## 4. 合并来源（追溯）

- 桥回执形状：src/types/bridge.ts `BridgeReceipt`（v1 协议 §3）
- 内核路由包装：src/kernel.ts（`data.data` 信封）
- workflow：src/services/workflow.ts（kind 四值）
- MCP 投影：src/mcp/server.ts（isError 规则 + 35s 确认窗口）
- 客户端等待策略：docs/api.md（普通 ≤8s；commands.run ≥35s；超时禁止换 id）
