# events.* / workflow.* 契约草案（v0.1 设计稿）

> 状态：**设计草案**——实现排期 M2，且依赖上游插件（闪卡/考试/拾遗/管家）公开事件面成形。
> 目的：先把契约写死，避免每个上游各自造轮子；上游按此对齐，快门按此实现。
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
| `checkin:event-recorded` | 打卡 v5（已有宿主事件） | itemId, value, occurredAt | source+externalRef |
| `lv-cards:reviewed` | 闪卡（design） | deckId, cardId, grade | sessionId+cardId |
| `lv-exam:session-finished` | 考试（design） | paperId, score, durationMs | sessionId |
| `lv-shiyi:captured` | 拾遗（unlocated） | docId, source | docId+capturedAt |

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
