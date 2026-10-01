# events.* / workflow.* 契约（v0.1 设计稿 → v0.4.0 已实现文件载体版）

> 状态：**文件载体版已实现**（v0.4.0：events.list/pull、workflow.plan/execute，单测覆盖）。广播载体（spike⑤）与上游真实数据源按契约逐步接入；本稿即现行契约，变更需过 DECISIONS。
> 原则继承：只消费公开注册能力；白名单事件；一切可审计；缺席降级为 `unsupported`。

## events.*（白名单本地事件总线）

### events.list
- args: `{}`
- data: `{events:[{name, source, payloadSchema, idempotencyKey, since}]}` —— 仅白名单事件
- 白名单准入：上游插件在 manifest 中声明 `events:[{name:"lv-cards:reviewed", schema:…, idempotency:"(sessionId,cardId)"}]`，快门审核后收录

### events.pull
- args: `{names?: string[], since?: ISO8601, limit?≤200}`
- data: `{events:[{name, source, emittedAt, payload, idempotencyKey}]}`
- 语义：拉取式（避免常驻订阅的复杂度）；`since+limit` 有界；跨重启按 `idempotencyKey` 去重
- 实现载体（择一，spike⑤ 决策）：内核 storage 快照 / 广播频道留痕 / 上游插件自写桥文件

### 首批白名单（上游对齐后生效）
| 事件 | 来源 | payload 要点 | 幂等键 |
|---|---|---|---|
| `checkin:event-recorded` | 打卡 v5（**已订阅物化**，v0.5.2 通道修正：window CustomEvent） | itemId, value, occurredAt | source+externalRef |
| `checkin:event-deleted` | 打卡 v5（**已订阅物化**，v0.5.4） | itemId, eventId | source+externalRef+`:deleted` 后缀 |
| `lv-cards:reviewed` | 闪卡（design） | deckId, cardId, grade | sessionId+cardId |
| `lv-exam:session-finished` | 考试（design） | paperId, score, durationMs | sessionId |
| `lv-shiyi:captured` | 拾遗（unlocated） | docId, source | docId+capturedAt |

**删除语义（append-only 载体）**：events.ndjson 只追加不修改；删除以独立标记行表达（`name=checkin:event-deleted`，幂等键=原事件键+`:deleted`）。消费方按幂等键配对：同键 `recorded` 行在前、`:deleted` 行在后=该记录已删除；无 recorded 行的 `:deleted`（如窗口外记录被删）按忽略处理。载体重压缩/多源合并时**必须保留删除标记**直至对应 recorded 行一并滚出窗口。`analytics-updated` 不进白名单物化（D-0011：高频会挤占滚动窗口）。

## workflow.*（受控跨插件编排）

### workflow.plan
- args: `{steps:[{op, args}...≤8], memo?}` —— steps 中的 op 必须全部来自已注册白名单
- data: `{planId, steps:[{index, op, confirm:bool}], expiresAt}` —— 只出计划不执行
- 校验：单步 op 白名单、参数 schema、影响面分级（read/write/external），任一不通过 → `rejected`

### workflow.execute
- args: `{planId}`
- 语义：
  1. 一次性总确认（列出全部步骤与影响面；30s 超时=拒绝）
  2. 逐步执行，单步失败即**停止后续**（失败停止原则），已完成步骤不回滚但列入回执
  3. 每步独立回执：`{index, op, status, data, elapsedMs}`；整体回执 `{planId, done, stoppedAt?}`
  4. 单步超时同业务上限（15s，`commands.run` 30s 确认窗口例外）
- 补偿边界：M2 只做「停止 + 报告」，不做自动补偿（自动回滚的风险大于收益；人工用思源快照兜底）

### 明确不做
- 后台常驻工作流（无人的自动编排）——一切编排必须由外部客户端显式发起并确认
- 跨插件事务（原子性）——各步落各自插件的既有幂等语义

## 里程碑
- M2：events.pull（载体按 spike⑤）+ workflow.plan/execute + 单测/E2E
- 前置：spike⑤ 广播可用性；闪卡/考试 manifest 升 stable
