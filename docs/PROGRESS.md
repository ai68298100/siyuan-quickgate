# PROGRESS

> 迭代记录（最新在上）。与根目录 CHANGELOG 同步。

## 2026-10-02 · v0.5.6（checkin.summary 静默空数据修复）

- Fixed：适配器改组合 `getSummaryContext("day")+getStreaks`（上游 v18.16 无 getSummary，此前 recorded+undefined）；缺方法时诚实 unsupported；回归测试防再犯
- api.md/契约 JSON 同步 data 形状 `{today, streaks}`
- 单测 72 全绿；check/build 全绿

## 2026-10-02 · v0.5.5（内核路由可测化 + plugin.api manifest 驱动）

- kernel-ops.ts 抽出（依赖注入可单测）；补齐文档声称但缺失的 events.list op；events.pull 对齐前端去重契约
- plugin.api 窗口桥映射 manifest 驱动（windowBridge 字段）
- 单测 12 文件 67 用例全绿；check/build 全绿

## 2026-10-02 · v0.5.4（event-deleted 订阅物化）

- 订阅 `checkin:event-deleted`（event + deletedEvents 均物化，`:deleted` 幂等后缀）；materializeHubEvents 批量合并写
- D-0011：analytics-updated 不订阅（高频挤占滚动窗口，消费方出现再按需接）
- 单测 11 文件 57 用例全绿；check/build 全绿

## 2026-10-02 · v0.5.3（设置页生态清单版本对照）

- 设置页「生态清单版本」按钮：manifest × loadPetals 逐插件对照

## 2026-10-02 · v0.5.2（事件订阅通道修复 + 生态清单校准）

- Fixed：事件桥改订 window CustomEvent（上游唯一发射通道；v0.4.1 误订 app.eventBus 永不触发）；`unwrapCheckinDetail` 兼容上游包裹形状
- ecosystem-manifests 校准：雷切 0.44.1（+3 能力）、打卡 18.16.0（8 事件全登记）、人脉 0.4.1（桥不变）；打卡 apiVersion=5 实证无破坏
- 单测 11 文件 55 用例全绿；check 全绿

## 2026-10-02 · v0.5.1（可观测性补全 + 计时修正）

- BridgeService 累计统计：commands/ok/rejected/failed/expired/totalDispatchMs/lastActivityAt（内存态）；设置页队列状态弹窗与诊断包展示（含平均耗时）
- Fixed：多命令 tick 的 elapsedMs 基准移入循环内（此前第 2+ 条命令耗时叠加前面命令）
- 单测 11 文件 53 用例全绿（新增注入时钟计时与分账 2 例）；check/build 全绿

## 2026-10-02 · v0.2.0（生态中枢 R1 第一批）

- `registry.list`（manifest×loadPetals 合并）、`diagnostics.report`（脱敏）、`config.discover`（best-effort 自动发现）
- `events.*`/`workflow.*` 设计态占位回 unsupported
- 设置页「清空命令队列」；gen-icon 图标；architecture.svg；e2e/e2e.mjs 自动化验收子集
- 测试 8 组 38 用例全绿；check/build 全绿

## 2026-10-02 · v0.1.0 脚手架（M0.5 完成，M0 spike 待思源真机）

已完成（全部通过 `check`/`test`/`build`，无需内核）：
- 桥核心：信封解析/校验、命令队列（按 id 记账 + 压缩，阻断项1/4 修正）、回执滚动窗口（阻断项8 逐行解析）、单飞轮询器（阻断项5）
- op 分发：bridge.ping / commands.list/search/run（30s 确认+审计）/ checkin.* / contacts.* / doc.open / daily.status / setting.open / editor.context / plugin.api（默认关+允许名单）
- 适配器：打卡 v5、人脉 v1（能力协商、whenReady 5s 上限、幂等键从信封 id 派生）
- 设置页（b3 组件）：桥开关/轮询间隔/确认开关/透传开关/审计查看
- 单测 6 组：envelope / queue（含竞态复活）/ poller（单飞/退避）/ results（按字段匹配）/ adapters（能力协商）/ store（持久化记账）/ bridge-service（tick 级集成：并发追加不丢失、TTL、device 路由、reply:false）
- 工具：tools/lv-cli.mjs、tools/Send-LvCommand.ps1（协议客户端，跨客户端复用验证）
- 文档：README 双语、api.md、契约 JSON、DECISIONS、ROADMAP、WALKTHROUGH（spike 待做清单）

## 待办（接 M0 spike → M1 → M2）

见项目主仓库 TODO §5；本仓库不重复维护。
