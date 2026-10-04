# C4 可靠执行合同（§18.2 R124-G1 · v0 草案）

> 目的：把幂等、超时、取消、迟到回执、冲突与诊断的规则合并为一份可靠执行合同；验收 = **写操作只保留一个重试/恢复规则**（即 result-contract.md §3 补救表，本文不重复定义、只引用）。
> 状态：v0 草案——仅收录已实现机制；未实现项标注 `planned` 并登记 TODO。

## 1. 幂等（已实现）

| 机制 | 规则 | 实现 |
|---|---|---|
| 台账 | processed-ids 持久化 `bridge-state.json`（500 LRU，时间淘汰最旧） | services/store.ts（D-0003） |
| 预留语义 | **同步 check+mark 后才 await 执行**——先到者执行、后到者按 id 跳过；NDJSON tick 与广播 SSE 共用台账（D-0012） | bridge-service executeAndRecord |
| 惰性压缩 | 消费时仅移除已处理行；外部并发写回造成的行复活按 id 跳过；**不存在丢失窗口**（D-0002） | 队列压缩 |
| 业务幂等 | `checkin.record`/`contacts.interaction` 的 externalRef 从信封 id 稳定派生；`source=api` | adapters |

## 2. 超时（已实现）

| 层 | 值 | 语义 |
|---|---|---|
| 信封 TTL | 默认 60s；`ttlMs` 可调 | 过期命令 → `expired` 回执，不执行 |
| 业务执行上限 | 15s（`commands.run`/`workflow.execute` 不受此限） | EXEC_TIMEOUT_MS（bridge-service） |
| 客户端等待 | 普通 op ≤8s；run/execute ≥35s（覆盖 30s 确认窗） | api.md/lv-cli/MCP 三客户端一致 |
| MCP 投影 | 同上；超时 → isError=true + 原始 timeout 回执文本（unknown 语义，result-contract §1） | mcp/server |

## 3. 取消（planned）

- 当前无取消 op。确认窗（30s）是唯一"否决点"；一旦开始执行不可中断。
- `planned`：`workflow.cancel(planId)`（仅未开始计划可取消）——登记 §18.2 后续；与"急停"（R82-P0 熔断）合并设计。

## 4. 迟到回执（已实现）

- 回执落 results.ndjson（200 行滚动窗口）；客户端超时后可按 id 回查（`lv-cli receipt --id`）。
- 台账已记 id 的迟到重复 → `duplicate`，无副作用。
- **禁改写**：未知（timeout）不得被客户端或 AI 改写为成功（result-contract §1 不变量 2）。

## 5. 冲突与多写方（已实现/边界）

| 冲突源 | 规则 |
|---|---|
| 多客户端同写 commands.ndjson | 台账按 id 收敛；外部写回包含其读到的全部未处理行（D-0002 无丢失窗口） |
| 多窗口同开（Web Lock） | 同一命令只执行一次（spike④ 待多窗口现场复验——唯一未现场实证的可靠项） |
| 设置文件并发 | 存量 normalize 兼容（R47 实证）；前端单写方 |

## 6. 诊断（已实现）

- `diagnostics.report`：协议/插件/桥状态/registry 来源/confirmExec/审计计数（脱敏，不含 Token/正文/个人路径）
- 审计日志：全量命令入 audit.json，跨重启恢复（bug#8 修复），设置页可查看/导出
- 验收数据集：`npm run verify:restart` 七类（③延迟/⑩路由/⑪计数/⑤存活/v1.5 延迟/MCP 路由/§10-10 日志读数）

## 7. 重试唯一规则（引用）

**唯一规则集 = result-contract.md §3 补救表**。任何新入口（Quicker 动作/MCP/AI）不得自行定义重试策略；违反即双执行风险。
