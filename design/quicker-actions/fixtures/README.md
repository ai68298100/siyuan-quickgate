# fixtures/ — 动作测试固定样例（R109-P0）

> 验收口径：样例**可重复、脱敏、不依赖用户真实笔记**——捕获/查询/写入/联动/回执五类动作的
> 固定输入、空输入、错误输入和大输入。所有样例可直接粘贴进 Quicker 试运行或 lv-cli。

## 1. 桥命令样例（sample-commands.ndjson）

逐行信封，覆盖：正常捕获 / 空参数 / 缺 op（坏行）/ 大 args（接近 32KB 上限）/ 过期命令。
用 `node tools/lv-cli.mjs send --op xx --args '<json>'` 逐条发；整文件测试可复制到
`<工作区>/storage/petal/siyuan-quickgate/bridge/commands.ndjson` 后跑 `verify:restart`。

## 2. 只读 SQL 样例（查询动作 / p0-3 `sql:` 前缀）

```sql
-- 命中样例（应返回行）
SELECT id, content FROM blocks WHERE content LIKE '待办%' AND type='p' LIMIT 20
-- 零命中样例（应返回空，不等于失败）
SELECT id FROM blocks WHERE content LIKE '绝不存在的关键词xyzzy' LIMIT 20
-- 应被 GuardSql 拒绝（写关键词）
SELECT * FROM blocks; DROP TABLE blocks
-- 应被 GuardSql 拒绝（无 LIMIT）
SELECT id FROM blocks
-- 应被 GuardSql 拒绝（多语句）
SELECT 1; SELECT 2
```

## 3. 捕获输入四态（p0-1 / g2-capture）

| 态 | 样例 | 期望 |
|---|---|---|
| 正常 | `14:30 和客户确认了交付时间` | 今日日记新列表块 |
| 空输入 | （空串） | `❌ 内容为空`，不写 |
| 路由命中 | `#会议 定了三件事`（路由表含 `#会议=<docId>`） | 落会议文档 |
| 超长 | 5000 字 | 正常写入（不截断；截断只发生在 events/alt 场景并置 truncated） |

## 4. 错误输入（401/404/坏行）

- 错误 Token：`SY_TOKEN=wrong-token` → `❌ 令牌无效`（SY·内核请求 401 自愈一次后引导）。
- 不存在路径 getFile → 内核 202+错误信封 → 按缺失处理（bug#12 语义）。
- commands.ndjson 手工塞 `{"v":1,"id":"x"}`（缺 op）→ 坏行指纹回执一次后压缩（bug#11 语义）。

## 5. 事件样例（events.ndjson 消费端）

```jsonc
{"name":"checkin:event-recorded","source":"siyuan-checkin","emittedAt":"2026-10-04T00:00:00Z","payload":{"itemId":"fx","value":1,"unit":"次","source":"api"},"idempotencyKey":"fx:1"}
{"name":"checkin:event-deleted","source":"siyuan-checkin","emittedAt":"2026-10-04T00:01:00Z","payload":{"itemId":"fx","eventId":null},"idempotencyKey":"fx:1:deleted"}
{"name":"checkin:analytics-updated","emittedAt":"2026-10-04T00:02:00Z","idempotencyKey":"fx:a"} // observed：白名单外，events.pull 不返回
```
