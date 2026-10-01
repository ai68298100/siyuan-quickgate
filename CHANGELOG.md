# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## v0.5.1 · 2026-10-02（可观测性补全 + 计时修正）

### Added
- BridgeService 累计统计（内存态，重载归零）：执行数/成功/拒绝/失败/过期分账、执行耗时累计、最近活动时间；设置页「队列状态」与「导出诊断包」均展示（含平均耗时）
- 单测 +2：注入时钟验证 elapsed 只含本条命令、分账口径（unsupported 归 failed 桶、过期不计执行）

### Fixed
- 多命令 tick 的 elapsedMs 计时基准从循环外移到循环内：此前第二条命令的耗时把前面命令的执行时间一并计入，回执与审计数据失真

## v0.5.0 · 2026-10-02（v2 内核同步通道 · 实验性）

### Added
- 内核插件私有路由 `POST /plugin/private/siyuan-quickgate/exec`（思源自带 Token+管理员鉴权）：**同步**处理无需前端的 op 子集——`bridge.ping / registry.list / diagnostics.report / events.list·pull / config.discover / template.new`；前端专属 op 回结构化 `unsupported`（指引 NDJSON 通道）
- 收益：外部客户端对这些 op 从「写文件+轮询」（~750ms）变为**单次同步 HTTP**（~100ms 级），且不依赖前端窗口在线
- 边界：实验性——spike⑤⑥⑧ 真机校准前不建议生产依赖；NDJSON 通道仍是默认主路径；前端中继（让内核路由也能执行 commands.*/checkin.*）评估中

## v0.4.1 · 2026-10-02（events 数据源桥接）

### Added
- events 数据源桥接（D-0009）：订阅打卡公开宿主事件 `checkin:event-recorded` → 物化到 `/storage/petal/siyuan-checkin/bridge/events.ndjson`（上游零改动产出事件流）；桥开关联动启停，onunload 退订
- 设置页可观测性：待处理命令数/迟到完成次数/台账规模一目了然（R2）
- 决策 D-0008：workflow 计划不持久化（评估结案）；D-0009：events 载体代物化
- e2e 扩展：events.list / workflow.plan 用例（execute 弹确认框，自动跑时跳过）

## v0.4.0 · 2026-10-02（M2：events/workflow 实现）

### Added
- `events.list`：白名单事件目录（manifest 驱动：stable 插件的 available 事件）
- `events.pull`：文件载体拉取（各来源 `/storage/petal/<plugin>/bridge/events.ndjson`），`names/since/limit` 过滤；spike⑤ 后可加 push 载体，契约不变
- `workflow.plan`：≤8 步受控计划（受控 op 白名单、写步骤确认标记、5 分钟过期），只出计划不执行
- `workflow.execute`：一次性总确认 → 逐步执行 → 单步失败即停止（已完成不回滚），每步独立回执
- manifest 增加 events 声明字段（checkin available；闪卡 design）

### Notes
- events 的真实数据源仍需上游插件按契约写 events.ndjson（打卡宿主事件桥接排 M2 后半）
- 4 组新测试（白名单/拉取/计划校验/失败停止），47 用例全绿

## v0.3.0 · 2026-10-02（可靠性收尾 + 模板）

### Added
- `template.new`：renderSprig 渲染（支持 `{{}}`）→ createDocWithMd；template/templatePath 二选一
- 业务执行可观测上限（15s，可配）：超时回 `failed` 放行轮询，底层继续运行，迟到完成仅记日志（`commands.run` 不受此限，确认窗口语义自行管理）
- 设备名持久化到 `data/storage/local`（不随同步，多设备 device 路由可用；local 不可用回退 settings）
- 设置页：最近回执（20 条）、插件黑名单编辑、导出诊断包（脱敏，到剪贴板）
- 卸载钩子提示；审计落盘 5s 节流（R2 写放大修正）
- events/workflow 契约草案：docs/contracts/events-workflow-draft.md

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
