# api.md — 小驴快门外部契约 v1

> 人读版。机器可读：[contracts/quickgate-api-v1.json](./contracts/quickgate-api-v1.json)。
> 传输与信封规范见项目设计文档「02-小驴桥协议 v1.1」，此处只列 op 契约。

## 通道

| 通道 | 延迟 | 覆盖 | 状态 |
|---|---|---|---|
| NDJSON（默认） | ~750ms @500ms 轮询 | 全部 op | ✅ 稳定 |
| **内核同步路由**（v0.5.0 实验性） | ~100ms | 仅内核可处理子集：`bridge.ping / registry.list / diagnostics.report / events.list·pull / config.discover / template.new` | ⚠️ 实验性，spike 校准前不建议生产依赖 |
| **广播快路径 v1.5**（v0.6.0） | ~10-100ms | 全部前端 op（confirm/黑名单/审计共用） | ⚠️ 新增；设置 `broadcastEnabled` 默认关。用法：`POST /api/broadcast/postMessage {channel:"qg-cmd", message:"<与 NDJSON 同形的命令信封 JSON>"}`（需 Token）；快门前端 SSE 订阅即时执行，回执照常写 results.ndjson。**幂等与 NDJSON 共用台账**：同一信封两条通道先到者执行，后到者跳过——勿换 id 重试 |

内核通道用法：`POST {SY_URL}/plugin/private/siyuan-quickgate/exec`，头 `Authorization: Token <思源Token>`，体 `{"op":"…","args":{…}}`，响应 `data.data` 为与 NDJSON 同形状的回执。前端专属 op 回 `unsupported`。**无 Token 请求必须被 401/403 拒绝**（spike⑩⓪ 负向探针；该头是 localhost 通道唯一 CSRF 防线）。

**参考客户端**（tools/，零依赖）：`node tools/lv-cli.mjs <ping|send|run|events|exec>`（`events pull|list` 事件拉取、`exec --op` 内核路由直呼）；PowerShell `.\tools/Send-LvCommand.ps1 -Op <op> [-Exec]`。

## 通用

- 传输：`data/storage/petal/siyuan-quickgate/bridge/{commands,results}.ndjson`（NDJSON，UTF-8 无 BOM）
- 信封：`{v:1, id, op, args, createdAt, ttlMs?=60000, reply?=true, device?}`；`id` ≤64 位 `[A-Za-z0-9_-]`；`args` ≤32KB
- 回执：`{v:1, id, op, status, data, message, finishedAt, plugin, elapsedMs}`；`status ∈ recorded|duplicate|rejected|failed|unsupported|expired`
- 等待策略（客户端）：普通 op ≤8s；`commands.run` 需覆盖 30s 确认窗口（建议 ≥35s）；超时禁止换 id 重试同一语义（会产生重复副作用）
- 幂等：`checkin.record` / `contacts.interaction` 的 `source+externalRef` 由快门从信封 `id` 稳定派生（`source=quickgate`）

## op 表

| op | args | 成功 data | 说明 |
|---|---|---|---|
| `bridge.ping` | `{}` | `{protocol:1, plugin, version, pollMs, bridgeEnabled}` | 协商与健康探测 |
| `commands.list` | `{plugin?}` | `{plugins:[{name,displayName,commands[]}], source}` | 每插件 ≤100 条，总 ≤100 插件；黑名单插件不返回 |
| `commands.search` | `{keyword}` | `{commands:[…]}` | 内存过滤 ≤50 条 |
| `commands.run` | `{plugin, command}` | `{ok:true}` | 默认确认门控（30s 超时拒绝）+ 审计 |
| `checkin.items` | `{includeArchived?, limit?≤200}` | `{items:[{id,name,kind,unit,archived}]}` | 走打卡 v5 `items.read` |
| `checkin.record` | `{itemId, value?, unit?, note?, occurredAt?}` | 打卡桥返回；带 `occurredAt` 时走批量接口 | 走 `events.record`；`source=api`（v0.5.7——上游 source 白名单无 quickgate，会静默归一 api），幂等身份=externalRef；**occurredAt 单条接口不接受**（会被静默记成当前时间），带值时路由 `recordEventsBatch` |
| `checkin.summary` | `{}` | `{today:{range,startDate,endDate,items,totalEvents,completedItems,scheduledItems}, streaks:{itemId:当前连击}, streaksLongest:{itemId:最长连击}}` | 走 `summary.read`；由 `getSummaryContext("day")+getStreaks` 组合（v0.5.6——上游公开面无 getSummary，此前静默返回空数据的缺陷已修）；streaks 由上游数组行归一为映射（v0.5.7） |
| `contacts.search` | `{keyword?}` | `{people:[…]}` ≤50 | 走人脉 v1 `searchPeople` |
| `contacts.ensure` | `{name}` | `{docId,name,created}` | 走 `ensurePerson` |
| `contacts.interaction` | `{names?/docIds?, date?, place?, note?}` | `{recorded, people:[…]}` | names 兼容中英文逗号/顿号/分号/空白；`ref=信封 id` 幂等 |
| `doc.open` | `{id}` | `{ok:true}` | 受控导航，不改数据 |
| `daily.status` | `{}` | `{docId, exists}` | 只探测不创建 |
| `setting.open` | `{}` | `{ok:true}` | 打开思源设置 |
| `editor.context` | `{}` | `{docId,rootTitle,blockId,selectedText}` | 全 null 表示无编辑器焦点（M0⑦ 后字段语义可能校准） |
| `events.list` | `{}` | `{events:[{name,source,idempotency}]}` | 白名单事件目录（v0.4.0 实现；来源准入见 events-workflow-draft） |
| `events.pull` | `{names?, since?, limit?≤200}` | `{events:[HubEvent], files}` | 文件载体拉取；幂等键去重由调用方按 `idempotencyKey`。当前物化事件：`checkin:event-recorded`（v0.5.2 通道修正）与 `checkin:event-deleted`（v0.5.4，幂等键 `原键:deleted`，append-only 删除标记，与 recorded 行按键配对）；`analytics-updated` 不物化（D-0011） |
| `workflow.plan` | `{steps:[{op,args}≤8]}` | `{plan:{planId,steps[],expiresAt}}` | 受控 op 白名单；写步骤带 confirm 标记；只出计划不执行 |
| `workflow.execute` | `{planId}` | `{done, stoppedAt?, steps[]}` | 总确认（30s）→ 逐步执行 → 单步失败停止；计划一次性 |
| `registry.list` | `{}` | `{manifestVersion, plugins:[{pluginId,displayName,maturity,manifestVersion,installedVersion,installed,protocol,capabilities,hubIntegration}], registrySource}` | 生态七插件清单（v0.2.0）；maturity ∈ stable/design/unlocated |
| `diagnostics.report` | `{}` | `{protocol, plugin, version, bridge:{enabled,pollMs,basePath,commandsFileLines}, registry:{source,hostPlugins}, confirmExec, rawApiEnabled}` | 脱敏诊断快照（不含 Token/正文/个人路径） |
| `config.discover` | `{}` | `{diaryNotebookId, inboxDocId, notes[]}` | 自动发现（spike⑧ 校准前 best-effort；失败回 null + notes 说明） |
| `template.new` | `{notebook, hpath, template?\|templatePath?}` | `{docId}` | 内核 renderSprig 渲染（支持 `{{}}` 语法）后 createDocWithMd；templatePath 相对 `/templates/`（v0.3.0） |
| `events.*` / `workflow.*` | — | — | **设计态契约**（docs/09 R1）：M2 实现，当前回 `unsupported` |
| `plugin.api` | `{plugin, method, args}` | 桥返回 | 高级透传：默认关 + 允许名单 |

## 错误语义

- `unsupported`：op 未收录 / 目标插件缺席或能力缺失 / 能力被关闭（桥开关、plugin.api 开关）
- `rejected`：参数校验不过、用户拒绝确认、黑名单
- `failed`：执行抛异常（message 含中文原因）
- `expired`：`createdAt+ttlMs` 已过；仍会回执，便于审计
- 坏行（非法 JSON/字段）：以行指纹为占位 id 回执 `rejected`，不中断批次
