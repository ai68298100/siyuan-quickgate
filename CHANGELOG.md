# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## v0.2.0 · 2026-10-02（生态中枢 R1 第一批）

### Added
- `registry.list`：小驴七插件生态清单（src/assets/ecosystem-manifests.json 单一事实源）× `/api/petal/loadPetals` 实装状态合并
- `diagnostics.report`：脱敏诊断快照（桥/注册表/开关状态；不含 Token 与用户内容）
- `config.discover`：日记笔记本（getNotebookConf.dailynoteSavePath）与收集箱（名称约定）自动发现，失败降级
- `events.*` / `workflow.*` 设计态占位：明确回 `unsupported`（M2 实现）
- 设置页「清空命令队列」（commands/results/台账一并重置）
- 图标：gen-icon.mjs 小驴系视觉（蓝紫门框 + 速度线 + 橙点），icon 160 + preview 1024×768
- docs/architecture.svg 数据流图；e2e/e2e.mjs（对照 02 §8 的自动化验收子集，内核不可达时安全退出）

### Fixed
- `lsNotebooks`/`listDocsByPath` 响应形状适配（data.notebooks / data.files）

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
