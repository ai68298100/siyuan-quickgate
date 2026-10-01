# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## v0.6.5 · 2026-10-02（M2 尾巴：审计导出入口）

### Added
- 设置页新增**"导出审计 JSON"**：完整 auditLog（含 schemaVersion/exportedAt 包裹）一键复制到剪贴板——卸载提示里"审计随插件数据清理"的对应出口（此前只有"查看最近 20 条"）

### Housekeeping
- 同轮健康核查：CI 最近三跑全绿；发布资产可达；lv-cli fast 的 e2eMs 条件修正（回执字段=finishedAt）；上游三家（雷切/打卡/人脉）最新 release 与生态清单零漂移

## v0.6.4 · 2026-10-02（陈旧对冲注释清账）

### Changed
- registry 降级原因措辞更新（桥上用户可见）：~~"宿主注册表形状不符（spike ① 待实证）"~~ → "window.siyuan.ws.app.plugins 不可达（非桌面端或插件尚未加载）"——形状已实证，降级的真实原因只有可达性
- src 内五处"待实证/待校准"对冲注释按实证结论刷新（registry 头注/kernel-ops 自呼/daily.status SQL/PluginCommandInfo 类型注）——文档性变更，无行为改动

## v0.6.3 · 2026-10-02（registry 快捷键读宿主生效键 customHotkey）

### Fixed
- `commands.list/search` 的 accelerator 优先级改为 **customHotkey > hotkey > hotkeys[]**：3.8.5 bundle 实证宿主 `addCommand` 会以 langKey 解析快捷键后**就地回写** `hotkey`（解析默认）与 `customHotkey`（用户实际生效键），官方消费的就是 customHotkey——旧逻辑读不到用户自定义键；解析失败者会被宿主移出 commands 数组（诚实面：list 输出的就是活着的命令）
- Plugin 基类构造器实证挂载 `i18n/displayName/commands`（spike① 标题代取链成立）；`window.siyuan.ws.app.plugins` 遍历路径官方自证——WALKTHROUGH spike① ⬜→✅

### Verified
- spike② confirm API（bundle 实证）：回调式、void 返回、**无自动超时**，Esc/取消仅 destroy 不回调 → confirmWithFront 30s 自制超时是唯一兜底（契约一致，补证据注释）；WALKTHROUGH spike② ⬜→✅

## v0.6.2 · 2026-10-02（editor.context docId 主路径修复）

### Fixed
- **bug#7：`editor.context` 的 docId 主路径恒空**——`data-doc-id` 属性在思源 bundle 中不存在（只有 `data-doc-type`），旧主路径永远取 null、全靠 fallback 撑着。v0.6.2 改用 `.protyle` 容器自带的 `data-node-id`（Protyle 类加载路径写入 rootID，与 `fn__none` 切换同一方法）；`.protyle-title` 的 `data-node-id` 降为 fallback
- rootTitle 优先读官方 editElement（`.protyle-title__input`）再退 `.protyle-title` 整体 textContent

### Verified
- spike⑦ ⬜→◐（docId/rootTitle bundle 静态坐实；blockId 光标爬升留 DevTools 现场）——确立**"grep 本机安装编译产物"证据法**：前端 DOM 假设不必等 DevTools，实际运行的 bundle 比远端源码更硬

## v0.6.1 · 2026-10-02（config.discover 真机校准：非默认模板优先）

### Improved
- 日记笔记本发现新增**"非默认模板优先"层**（R25 真机实证驱动）：3.8.5 出厂默认模板为 `/daily note/{{now | date "2006/01"}}/…`，实测工作空间 17 个开着的笔记本中 16 个原封未动、1 个自定义——自定义者几乎必是日记笔记本。多候选时先按"路径 ≠ 默认模板"缩小范围，唯一直接命中（**无需等今日日记写出**）；缩不窄再走"今日日记文档存在性"消歧；仍不唯一则诚实回退手填
- 真机空跑验证：本工作空间（17 候选、自定义者=DailyNote、昨日日记在 `/2026/10/`）算法正确命中 DailyNote
- readDailyStatus 的 SQL（本地日期标题法）实测 code=0 正常工作；renderSprig/listDocsByPath 形状实证（listDocsByPath 对不存在路径返回 data:null——已空值防护）

## v0.6.0 · 2026-10-02（v1.5 广播快路径——毫秒级命令通道）

### Added
- **广播快路径**（spike⑤ 实证解锁）：设置新增独立开关 `broadcastEnabled`（**默认关**，新外部面红线）；开启后前端 SSE 订阅内核频道 `qg-cmd`，外部客户端 `POST /api/broadcast/postMessage {channel:"qg-cmd", message:<信封JSON>}` 推命令，**到达即执行（毫秒级）**，回执写回 results.ndjson
- **双通道防重复执行（预留语义）**：NDJSON tick 与广播 SSE 共用幂等台账，"同步 check+mark 后才 await"——先到者执行、后到者按 id 跳过；confirm 门控/黑名单/审计全部共用
- 断流指数退避重连（1s→30s）；AbortSignal 中断在读流，stop 即时生效
- BroadcastSubscriber 单测 5 组（SSE 解析/坏信封静默/退避重连/不建立连接/预留语义+device+expired）
- 单测 15 文件 84 用例；测试池统一 forks（threads 池下流式假件会挂起 worker）

### 依赖
- 内核广播接口（3.8.5 真机实证）：`POST /api/broadcast/postMessage` + `GET /es/broadcast/subscribe`，Token 头鉴权（外部推命令方）；前端同源订阅无需 Token
- 联调状态：实现+单测完成；真机联调待内核重启（kernel.js/前端插件加载后）——复测清单见 docs/WALKTHROUGH.md ③⑩⑪

## v0.5.9 · 2026-10-02（真内核实证：config.discover 修复 + spike 内核侧完成）

### 环境解锁
- 本机思源内核实证可达（**3.8.5 @ 127.0.0.1:6806 默认端口**；早前"1568 非默认端口"记录作废）；快门 v0.5.9 已部署进工作空间并 setPetalEnabled 启用（桥默认关）

### Fixed
- **bug#6：日记笔记本自动发现恒失败**——3.8.5 真机实证字段为 `conf.dailyNoteSavePath`（驼峰），旧代码读全小写 `dailynoteSavePath`；且**所有笔记本都带相同默认模板**，"非空即日记"启发式失效。两级消歧：恰一候选直接命中；多候选时 renderSprig 渲染当日 hpath + listDocsByPath 验证今日日记文档真实存在，恰一命中才判定（前端/kernel 两侧实现同步，测试覆盖）

### Verified（spike 内核侧，见 docs/WALKTHROUGH.md）
- ⑥ loadPetals 形状（name/version/enabled 与 registry.list 合并逻辑吻合 ✓；响应内嵌 js 源码体积大）
- ⑨ storage/local putFile/getFile 200 ✓（D-0006 迁移技术可行；多端隔离待第二设备）
- ⑩⓪ **无 Token → 401 ✓**（私有路由鉴权在基础设施层，CSRF 基线成立）；内核不热加载新 petal 的 kernel.js——路由功能面待内核重启复测（`lv-cli exec` 就绪）
- 工作空间实装与生态清单校准一致（雷切 0.44.1/打卡 18.16.0/人脉 0.4.1）

## v0.5.8 · 2026-10-02（命令注册表探测修复——langKey 身份）

### Fixed
- **`commands.*` 全部失效的探测缺陷**：思源官方 `ICommand` 的命令身份是 **`langKey`**（不存在 `command`/`id` 字段），registry.ts 此前读 `c.command ?? c.id`——langKey-only 注册的命令（普遍形态，如 `addCommand({langKey, langText, hotkey, callback})`）**全部被跳过**，commands.list 返回空、commands.run 报"命令不存在"。改为 langKey 优先（旧字段降级兜底）
- **只声明焦点相关回调的命令被静默丢弃**：ICommand 有五种回调（callback/globalCallback/execute/editorCallback/dockCallback/fileTreeCallback），且"更具体的回调存在时 callback 不会被宿主触发"——探测改为接受 callback/execute/globalCallback（可无焦点执行）；editor/dock/fileTree 形态标记 `focusOnly`，commands.run 对其诚实回 `unsupported`（不盲执行）
- **标题解析增强**：langText 缺省时按宿主行为从插件实例 `.i18n[langKey]` 代取；快捷键兼容 `hotkeys[]`（并入 accelerator）

### Added
- registry 单测 5 组：langKey 识别 / i18n 标题 / execute·globalCallback+hotkeys / focusOnly 标记与拒绝执行 / callback 优先与降级
- WALKTHROUGH spike① 同步：静态已钉住 langKey 形状，真机仍需实证 displayName/i18n 细节

## v0.5.7 · 2026-10-02（适配器签名全面审计）

### Fixed
- **`source:"quickgate"` 非法**：上游 source 白名单（manual/tomato/import/api/sireader/siplayer/weread/yeguif）外值被静默归一为 `api`——适配器改为显式传 `api`，身份由 externalRef 承担（幂等不受影响）；契约文档同步纠正
- **`occurredAt` 被单条接口静默忽略**：`recordEvent` 不接受 occurredAt（时间会记成"现在"）；带 occurredAt 时改路由 `recordEventsBatch` 并把 BatchEntryResult 映射回快门状态（recorded/duplicate→recorded（duplicate 带标记）、rejected/blocked/discarded→rejected+原因）；缺批量方法时诚实 `unsupported`
- **`getStreaks` 返回形状误判**：实际为数组 `{itemId,current,longest,milestones?}[]`（v0.5.6 误当映射透传）——归一为 `streaks:{itemId:当前}` + `streaksLongest:{itemId:最长}`，与文档一致
- 审计结论：`queryItems({includeArchived})`/`getItems`/`CheckinItem` 字段/人脉 `recordInteraction(ids,{ref,date,place,note})` 全部与上游一致，无需修改

### Added
- 回归测试：source=api 断言、occurredAt 四分支（recorded/duplicate/rejected/缺批量方法）、streaks 数组归一

## v0.5.6 · 2026-10-02（checkin.summary 静默空数据修复）

### Fixed
- **`checkin.summary` 静默返回空数据**：上游打卡 v18.16 公开面**没有 `getSummary` 方法**（summary.read 由 `getSummaryContext(range)`+`getStreaks(itemIds)` 承载），适配器的可选调用 `b.getSummary?.({})` 在方法缺失时返回 `recorded` + `data:undefined`——消费方收到成功状态却无数据。改为组合调用并返回结构化 `{today: SummaryContext, streaks}`；两方法均不可用时诚实回 `unsupported`
- 回归测试：桥无任何 summary 方法必须回 `unsupported`（不得静默 recorded）

### Changed
- api.md / 契约 JSON：`checkin.summary` data 形状明确为 `{today, streaks}`

## v0.5.5 · 2026-10-02（内核路由可测化 + plugin.api manifest 驱动）

### Added
- `src/kernel-ops.ts`：内核同步路由 op 逻辑抽出（依赖注入，可单测）；**补齐 `events.list` op**（v0.5.0 起文档声称支持但未实现，实际返回"未知 op"）；`events.pull` 对齐前端契约（idempotencyKey 去重 + 缺字段行跳过，此前内核版不去重）
- plugin.api 窗口桥映射改 manifest 驱动（`windowBridge` 字段），替换硬编码三元表达式——管家/闪卡等未来插件零代码接入透传
- 单测 +10：kernel-ops 七组（ping/registry 降级/events 白名单与去重/config.discover/template 链/前端专属 op 指引）+ plugin.api 四态（开关/名单/映射透传/方法缺失）

### Changed
- kernel.ts 瘦身为纯 goja 接线（kpost/getFileText + 路由挂载）

## v0.5.4 · 2026-10-02（event-deleted 订阅物化）

### Added
- 订阅 `checkin:event-deleted`：`event` 单条与 `deletedEvents` 批量均物化为删除标记行，幂等键加 `:deleted` 后缀与原 recorded 行共存（append-only 载体语义）；批量删除一次读改写合并落盘
- 决策 D-0011：`analytics-updated` **不订阅**——高频触发会挤占 200 行滚动窗口；数据变化信号由消费方轮询承担

## v0.5.3 · 2026-10-02（设置页生态清单版本对照）

### Added
- 设置页新增「生态清单版本」按钮：manifest 校准版本 × `/api/petal/loadPetals` 实装版本逐插件对照（不一致时提示可校准；内核不可达时降级为 manifest 口径）

## v0.5.2 · 2026-10-02（事件订阅通道修复 + 生态清单校准）

### Fixed
- **v0.4.1 事件桥订阅通道错误**：上游打卡的集成事件只走 `window.dispatchEvent(new CustomEvent(...))`（integrations.ts 实证；app.eventBus 仅承载思源内部事件），v0.4.1 误订 `app.eventBus` 导致物化**永不触发**。改订 window 事件；detail 为包裹形状 `{type:"event-recorded", event:{…}}`，归一化新增 `unwrapCheckinDetail` 兼容包裹/平铺（D-0009 勘误已记）

### Changed
- ecosystem-manifests 按各仓库远端 main 校准（2026-10-02）：雷切 0.40.0→**0.44.1**（+get-document-outline / home-adapter-diagnostics / restore-document-set 三能力）、打卡 18.9.0→**18.16.0**（契约 8 事件全量登记，calendar.read 能力）、人脉 0.1.0→**0.4.1**（桥 v1 不变）
- 打卡 apiVersion 实证仍为 5（checkin-api-v5.json），适配器无破坏性变更

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
