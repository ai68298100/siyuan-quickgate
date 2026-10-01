---
name: siyuan-lv-operations
description: 通过小驴快门（Lv QuickGate）的外部命令桥操作思源笔记与小驴生态：查/建文档、写入日记、打卡、记录人脉互动、搜索内容、跑工作流。当用户要求"记录到思源""打卡""查我的笔记""记一个人脉互动"等时使用。
---

# 思源小驴操作（经小驴快门外部命令桥）

## 前置

- 思源运行中；快门插件已启用且「外部命令桥」已开启（设置页确认，或先发 `bridge.ping` 探测）。
- 通道：向 `/storage/petal/siyuan-quickgate/bridge/commands.ndjson` 追加 NDJSON 命令（读旧内容+拼接+putFile 整写），从 `results.ndjson` 按 `id` 逐行 JSON.parse 匹配回执。
- 信封：`{"v":1,"id":"<唯一id>","op":"<op>","args":{…},"createdAt":"<ISO8601>"}`；`id` 全局唯一且不重试换新（超时=放弃或人工确认）。

## op 速查（完整契约 docs/contracts/quickgate-api-v1.json）

| 意图 | op | 关键 args |
|---|---|---|
| 探测 | `bridge.ping` | `{}` |
| 记一次打卡 | `checkin.record` | `{itemId, value?, note?}`（幂等） |
| 打卡事项列表 | `checkin.items` | `{includeArchived:false}` |
| 打卡连击/汇总 | `checkin.summary` | `{}` |
| 搜人 | `contacts.search` | `{keyword}` |
| 收编人名 | `contacts.ensure` | `{name}` |
| 记共同交集 | `contacts.interaction` | `{names:[…], place?, note?}`（幂等） |
| 追加到今日日记 | `checkin` 之外走内核 | 直接 POST `/api/block/appendDailyNoteBlock`（需 Token） |
| 打开文档 | `doc.open` | `{id}` |
| 今日日记状态 | `daily.status` | `{}` |
| 编辑器上下文 | `editor.context` | `{}` |
| 模板建文档 | `template.new` | `{notebook, hpath, templatePath}` |
| 组合任务 | `workflow.plan` → `workflow.execute` | steps ≤8，写操作会弹确认 |

## 硬规则

1. 所有写入自带幂等（信封 id 作 externalRef/ref）——**同一意图绝不生成第二个 id 重试**。
2. `commands.run` / `workflow.execute` 会弹思源确认框（30 秒不点=拒绝）；等待 ≥35s。
3. 自由文本不进 SQL；`events.pull` 消费方按 `idempotencyKey` 去重。
4. 未知 op / 插件缺席 → 回执 `unsupported`，如实告知用户，不要伪造成功。
