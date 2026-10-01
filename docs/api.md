# api.md — 小驴快门外部契约 v1

> 人读版。机器可读：[contracts/quickgate-api-v1.json](./contracts/quickgate-api-v1.json)。
> 传输与信封规范见项目设计文档「02-小驴桥协议 v1.1」，此处只列 op 契约。

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
| `checkin.record` | `{itemId, value?, unit?, note?, occurredAt?}` | 打卡桥返回 | 走 `events.record`；`source=quickgate` |
| `checkin.summary` | `{}` | 打卡汇总快照 | 走 `summary.read` |
| `contacts.search` | `{keyword?}` | `{people:[…]}` ≤50 | 走人脉 v1 `searchPeople` |
| `contacts.ensure` | `{name}` | `{docId,name,created}` | 走 `ensurePerson` |
| `contacts.interaction` | `{names?/docIds?, date?, place?, note?}` | `{recorded, people:[…]}` | names 兼容中英文逗号/顿号/分号/空白；`ref=信封 id` 幂等 |
| `doc.open` | `{id}` | `{ok:true}` | 受控导航，不改数据 |
| `daily.status` | `{}` | `{docId, exists}` | 只探测不创建 |
| `setting.open` | `{}` | `{ok:true}` | 打开思源设置 |
| `editor.context` | `{}` | `{docId,rootTitle,blockId,selectedText}` | 全 null 表示无编辑器焦点（M0⑦ 后字段语义可能校准） |
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
