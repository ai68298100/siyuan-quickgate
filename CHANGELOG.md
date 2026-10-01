# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## v0.1.0 · 2026-10-02（脚手架，未发布集市）

### Added
- NDJSON 外部命令桥核心：信封解析校验、按 id 记账的命令队列（并发追加不丢失）、回执滚动窗口（200 条）、单飞轮询器（指数退避）
- op 面：`bridge.ping` / `commands.list|search|run`（30s 确认+审计）/ `checkin.items|record|summary` / `contacts.search|ensure|interaction` / `doc.open` / `daily.status` / `setting.open` / `editor.context` / `plugin.api`（默认关+允许名单）
- 适配器：小驴打卡 v5、小驴人脉 v1（能力协商、whenReady 5s 上限、幂等键派生）
- 设置页：桥开关（默认关）、轮询间隔、确认开关（默认开）、透传开关、审计查看
- 工具：`tools/lv-cli.mjs`（node CLI）、`tools/Send-LvCommand.ps1`（PowerShell）
- 测试：7 组单测（含队列竞态/TTL/device 路由/reply:false 等 tick 级集成用例），无需内核即可运行
- 文档：README 双语、docs/api.md、docs/contracts/quickgate-api-v1.json、DECISIONS（D-0001~D-0007）、ROADMAP、PROGRESS、WALKTHROUGH（spike 待实证清单）
- CI：push 跑 check+test+build

### Notes
- 集市暂缓上架；当前唯一分发渠道为 GitHub Release（手动导入 package.zip）
- M0 spike 九项待思源真机实证（docs/WALKTHROUGH.md）
