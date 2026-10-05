# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## Unreleased（R283：P0 安全加固 + 路线索引）

### Security
- **plugin.api 原型链防护（TODO L651）**：`method` 此前直接索引桥对象——`constructor`/`hasOwnProperty` 等原型链成员可经透传调用；现要求**自有属性**（hasOwnProperty 检查），四成员回归测试（tests/plugin-api-guard.test.ts）

### Fixed
- **pollMs 热生效（TODO L659）**：修改轮询间隔此前只存设置、旧间隔持续到下次桥重启；现保存后自动重启轮询循环（Web Lock 认领重走防双窗口竞态），UI 提示即时生效

### Added
- **TODO §0.5 开发路线索引**：144 条 pending 按 P0 自主/P1 用户动作/P2 环境/P3 上游/P4 产品级五层重组；本轮核对销账 6 条（L298/L447/L488/L557/L566/L615）

## v0.7.5 · 2026-10-05（v0.7.4 后增量：发布链补强 + Agent 集成指南 + 运维工具）

### Added
- **package.zip 解包静态断言**（check-package.mjs 入 check:release 链）：kernels 字段回归门（bug#9 预防）+ zip 内容三件套核验；跨平台（powershell→pwsh 探测，双无则显式跳过 zip 级）
- **docs/agent-integration.md**：思源内置 Agent 集成指南——路径 A 原生三能力（零配置）/ 路径 B `ai.mcp.servers` 字段级 stdio 挂法 / 审批策略配置 / 四行排障表（README 双语与 GETTING-STARTED 已链接）
- **tools/restart-siyuan.bat**：部署后一键安全重启思源（优雅终止→等待→重启→验证）——bug#15 的用户操作负担解除
- 真机活体验证扩展至 20+ 项（收藏全链/别名搜索/workflow 计划/事件拉取/审计留痕/editor.context/contacts.search 等，v0.7.4 前端全量生效后完成）

### Fixed
- **bug#17 登记**（功能零影响）：内核 plugin.go:884 对 onrunning/onunload 可选钩子报「not bound」噪音（日志 62+ 条）——R245 noop 修复无效已回退（内核读取的 lifecycle 绑定路径与本 bundle 设置不同，goja 上下文差异），根因需 goja DevTools
- 使用手册 §5 两处漂移：排障工具列全（审计/收藏管理/恢复默认/能力目录）+ MCP 14 只读/26 总 + Agent 指南链接

### Docs
- **README 双语重写**：修复 MCP/Agent 两节结构断裂（R246 插入错位）、op 清单补 favorites.*、安装节改 Releases 链接（prerelease 不链 /releases/latest，L643）+ 完全退出重启提示、状态段改里程碑表（补 v0.7.4/v0.7.5）、开发节补 verify:bg 与重启工具、测试数 155→162
- REPO-MAP 重写为合并后单仓格局（运维事实表含部署纪律）；AGENTS.md 数字时效 + verify:bg 入口
- 使用手册「搭建顺序 × 参考件速查表」+「参数化 siyuan:// 链接集」附录；ROADMAP 刷新至当前事实；M2 视觉走查注记（IAB webview 无法启动思源 Web——需桌面端/独立 Playwright）

## v0.7.4 · 2026-10-05（R231~R258：安全修复 + 收藏全链 + 思源 Agent 原生集成 + 并发正确性）

> 十四个 R 轮的聚合发布。头两项为安全修复，建议所有用户更新；完整明细见下方分级清单与 docs/10-生态调研-R2~R5。

### Security
- **P0·template.new 路径穿越（TODO L628 / safety-gate §7）**：前端与内核两通道此前把 `templatePath` 仅去前导斜杠后直拼进 `/templates/` 读取——`..` 回溯、反斜杠、NUL、绝对路径均可触达模板目录之外。新增 `src/services/path-guard.ts` 白名单守卫（形状 `^[A-Za-z0-9][A-Za-z0-9/_-]*\.(md|txt)$`、≤200 字符、内容 ≤64KB 不截断执行），NDJSON（bridge-service）与内核同步路由（kernel-ops）双入口共用（MCP 经由这两通道=全覆盖）。回归：tests/path-guard.test.ts 按 safety-gate §7 矩阵七用例×双通道。

### Docs
- REPO-MAP 重写为合并后单仓格局（运维事实表含部署纪律 bug#15 口径）
- docs/13 发布节奏沉淀部署纪律；docs/02 §1 上限口径对齐实现（50 行截断从未实现，删除虚构声明）
- 使用手册：参数化 siyuan:// 链接集附录（R1 收口）+ 搭建顺序 × 27 件参考件速查表
- 调研 R2~R5（MCP 规范/上游速记/内置 Agent/v3.8.7-alpha——含 R244-A 版本要求与审批语义）

### Fixed
- **CI 红转绿（R258）**：①pnpm 版本双指定（workflows version 输入 vs packageManager 字段）——删除 version 输入，单一事实源=package.json；②行删除遗留空 with 块致 YAML 无效（0s 失败）；③mcp-smoke 计数断言 13/23 未随 favorites 更新（第四处计数遗漏）→14/26。CI 于 39 提交推送后转绿。

### Added
- **设置页「收藏与最近使用管理」（TODO L472 消费面 · R250）**：收藏列表（移除）/ 最近使用列表（单条移除 + 一键清空）——favorites.json 的完整 UI 管理入口，不再只有 CLI。
- **favorites.remove 支持 `clearRecent:true`（TODO L472 清除历史 · R241）**：一次清空全部最近使用、无需逐条 plugin/command；契约 JSON/api.md/MCP schema 同步。
- **调研追加（docs/10-生态调研-R3.md §6 · R241）**：思源内置 CLI `serve` 安全评估（旗标齐全无后门，自托管场景不立项）；uTools-siyuan 同类对照（跨宿主泳道需求验证，单目的客户端，快门差异化守住编排层）。
- **私有路由鉴权七格矩阵 E4 实测（TODO L434）**：思源 3.8.6 真机——有效 Token/Bearer/query token 均 200 回执；无 Authorization/错误 Token 均 401（消息只泄露失败位置不泄露令牌）；未知 op 结构化回执；畸形 JSON 400。七格全部零泄漏（响应不含令牌本体/工作区路径）。剩余格（只读工作区/非管理员/HTTPS）需专用环境，挂后续轮。
- **可用性等级口径表（TODO L470）**：docs/api.md 六级口径（随插件可用/需开桥/需广播开关/需上游插件/需授权/仅桌面·待真机）+ 逐级覆盖映射；与设置页实时状态区的优先级关系明确（实时态优先于静态表）。
- **MCP 规范 annotations 输出（R234 生态调研候选① · docs/10-生态调研-R2.md）**：tools/list 四注解显式恒填——readOnlyHint（14 只读）/destructiveHint（plugin.api/workflow.execute）/idempotentHint（16 天然幂等 op；config.discover 有 opt-in 创建面故不入列）/openWorldHint（commands.run/plugin.api 开放世界）。关键发现：MCP 规范对 destructiveHint 缺省按 true 解读——此前只读工具省略该字段会被宿主确认 UI 误判破坏性。注解只是宿主 UI 投影，安全仍以服务端门控为准。新增 tests/mcp-annotations.test.ts。
- **设置页 UX 批（R234）**：状态概览新增内核路由探针 badge 与轮询退避显示；plugin.api 允许名单行内校验（pluginId 形状不符剔除并列出）；黑名单/名单保存轻提示；桥开关等待 Web Lock 认领完成再如实提示（他窗占用≠已开启）；触控基线 CSS（开关 44×24/按钮 ≥32 高/:focus-visible 描边）。
- **桥消费权认领（TODO L452 · 多窗口互斥）**：`services/bridge-claim.ts`（Web Locks，三态=认领/占用/无 API）——startBridge 先认领 `siyuan-quickgate-bridge`，被另一思源窗口持有时拒绝启动轮询并提示（双窗口各自 processed 台账独立，无认领=同 id 双执行写副作用）；stopBridge/onunload 释放。无 Locks 环境按单窗口假设放行+日志声明。
- **多生产者追加竞态缓解（TODO L453）**：真机实测 4 写者×25 条并发裸写**丢 66/100 行**；三个内置客户端（lv-cli / Send-LvCommand.ps1 / MCP bridge-client）加写后读回校验+重试 ≤5——同参数实测 **0 丢失**（残留重复行由消费端 processed 台账按 id 去重兜底）；边界与建议写入 docs/02 §1（高频多写者建议广播通道/串行；协议 v2 候选=按写者分文件）。顺带：三客户端命令 id 改 crypto UUID 段（Math.random 同毫秒碰撞会触发幂等误判跳过命令）。
- **config.discover 收集箱发现双通道对齐（TODO L456）**：前端通道补齐内核版同口径的约定名 SQL 根文档发现（收集箱/Inbox + `inboxName` 自定义），消除「笔记本名匹配 only」的双通道差距；`createInboxIfMissing=true` 显式授权自动创建（默认不建——v0.7.3 最小惊讶决策保留），双通道一致。E4：内核路由真机 config.discover（日记笔记本命中 DailyNote，收集箱零命中+手填指引）。回归：tests/kernel-ops.test.ts +3（零命中/创建/自定义名命中）。
- **收藏与最近使用 ops（TODO L474）**：新增 `favorites.list/add/remove`（前端专属，载体=快门存储 favorites.json）——收藏 ≤100 去重前移、最近 ≤20 去重前移；`commands.run` 成功自动记最近使用（只记 plugin/command/title 元数据，title 取自注册表）；`favorites.remove scope=recent` 即隐私清除。全链同步：ops.ts/契约 JSON（23→26 op）/MCP tools（14 只读/26 总）/api.md/README 计数。回归：tests/favorites.test.ts 6 条（纯逻辑+dispatch 集成）。裁剪：按场景置顶挂超级面板轮（L472 关联）。
- **安装包 README 分层（TODO L625）**：新增 `docs/package-readme.md`（安装导向），经 vite 拷贝为包内 `README.md`（`rename:{stripBase,name}`——踩坑：vite-static-copy 的 rename 保留源相对目录，缺 stripBase 时会误覆盖包内 docs/README.md）；开发者版双语 README 不再进包；`check-links.mjs` 增 icon/preview.png 资产回归（存在性+PNG magic 头）；FAQ「错误语义」链接改指 api.md 真实锚点。
- **热重载接管布防（bug#15 候选防御层）**：插件构造器设全局所有权令牌（新实例接管时停旧实例轮询与 SSE）+ 3s 延迟自检「onload 是否执行」，未执行则加载设置并按开关自愈启动桥循环；onunload 置 tornDown 防停用后复活。实测接管尚未被 push_reload 路径触发（需 DevTools 确认实例语义），作为防御层保留。
- **设置面板验收补齐（TODO L502/L503/L513/L514 · R73 快赢批）**：①「恢复默认设置」按钮（列出影响+确认；保留 deviceName 本机身份，恢复后重开面板反映默认值）；②plugin.api 启用前确认框（列出将授权的名单/留痕/可逆性，取消回滚开关）；③审计对话框升级——关键词(op/状态/插件)+日期双筛选、单条复制 JSON（20 条窗口内不做分页/虚拟化：数据量不支撑，裁剪声明；审计条目无 device 字段=该筛选不适用）。
- **命令搜索别名映射（TODO L471）**：`services/search-alias.ts` 中英/拼音别名表 + `expandSearchKeyword`——「打卡/daka/checkin」「摘录/捕获/capture」「人脉/contacts」「闪卡/review」等互达；交叉命中即设计行为（跨语言广撒网）。裁剪声明：不做全量拼音引擎（依赖重收益薄，高频词走别名表）；raw op 本就不进命令注册表，仅诊断面可见。回归：tests/search-alias.test.ts 5 条。
- **plugin.api 允许名单设置页编辑器（TODO L458）**：设置项审计结论落地——13 个设置字段中 7 个已有 UI；允许名单此前无编辑入口但文档承诺「新插件由用户手动加入」（承诺无法履行），现补 textarea 编辑器（默认=三个已完成契约审计的插件）；`backoffMaxMs`/`auditMax`/`bridgeBasePath`/`deviceName` 裁定为代码默认/自动管理，设置页不暴露（类型注释与 api.md 已注记）。
- **事件域幂等注册表（TODO L599 / C9 合同 §3）**：`IdempotencyRegistry`（idempotency.json，键=`<pluginId>:<idempotencyKey>`，TTL 30 天 + LRU 2000）接入事件物化写入侧——events.ndjson 滚动裁剪（cap=200）后的重放事件此前会被重复追加，现按注册表去重，「同一用户动作只记一次」跨滚动窗口成立。纪律：先写后记账（putFile 失败不 mark，避免事件永久丢失）；持久化 fail-open（坏形状重建，重启重放至多重复一行）。回归：tests/idempotency.test.ts 8 条（TTL/LRU/往返/坏形状/去重计划）。
- **写 op 统一审计面（TODO L446 差距① / safety-gate §6）**：`checkin.record`、`contacts.ensure/interaction`、`template.new`、`workflow.execute`、`plugin.api` 出口统一落 audit（NDJSON tick 与广播快路径共用；rejected 也留痕）；`command` 字段只记 args 键名（零 PII），commands.run 维持原自审计不双写。
- **生态清单类型门禁（TODO L595 / C9 合同）**：`EcosystemManifest` 接口补齐 v2 字段（events/sourceOfTruth/ingestion/minProtocol/eventNamespace/capabilitySchemas/updatedAt），六处 `as unknown as` 断言移除；`scripts/validate-manifest.mjs` 以 `check:manifest` 入 check 链（CI 首步=契约违规阻断发布）。v1 迁移期警告、manifest 升 v2 后全强制。
- **发布包链接检查门（TODO L624）**：`scripts/check-links.mjs` 扫描发布包全部 Markdown——相对链接须落包内真实文件、禁止盘符绝对路径泄露、禁止指向源码专属目录（src/tools/tests/e2e/scripts）的相对链接；挂入 `check:release` 链（CI 构建后阻断）。首轮扫描抓出 10 处违规并修复：README 双语 6 处（LICENSE/tools/src-mcp 改 GitHub permalink、移除指向设计仓库工作区的跨仓库相对链接）、契约 JSON 改为随包分发（vite 补 docs/contracts 拷贝）。

### Changed
- **manifest 升 v2（R228 E4 真机校准，2026-10-05）**：修正三处 ID/版本漂移——闪卡 `siyuan-flashcards`→`siyuan-lv-cards` 0.154.0、拾遗 `siyuan-shiyi`(未定位)→`siyuan-glean` 1.1.0（unlocated→design）、管家 `siyuan-butler`→`siyuan-home` 0.2.0；考试真机未安装；stable 三件（雷切/打卡/人脉）零漂移。v2 字段（minProtocol/sourceOfTruth/ingestion/eventNamespace）全量填充；minProtocol 强制面收敛为 stable∧`window.*` 协议（命令面插件=null）。
- 内核路由 `template.new` 拒绝路径现在返回结构化 `rejected` 回执（中文原因）；内核通道无 audit 载体，留痕由同步回执承担（内核侧审计载体随 TODO L627 收口）。

## v0.7.3 · 2026-10-03（R69 待办池 P0/P1 清账：八处正确性修复）

### Fixed
- **P0·超时重复派发**：`dispatchWithTimeout` 超时分支误将 `dispatch(cmd)` **再次调用**——写操作（如 checkin.record）执行超 15s 会**执行两遍**（重复打卡/重复写入），且与"迟到完成仅记日志"注释自相矛盾。修复：超时后只观测原 Promise 的迟到结果，绝不二次调用（回归测试：底层操作恰好调用 1 次）
- **P0·外层超时与单步超时竞争**：workflow.execute 外层 15s 上限与内部单步上限同源同额，外层先到会把整个 envelope 判 failed 而工作流仍在底层迟到执行后续步。修复：workflow.execute 与 commands.run 一样自管超时（单步上限已覆盖），外层不叠加
- **P1·workflow 单步超时缺失**：runStep 直呼 dispatch 无上限——挂起步（如人脉桥挂起）卡死整个工作流且永不回执。修复：复用 dispatchWithTimeout（含单次派发保证），挂起步在该步回 failed 并停止（回归测试：stoppedAt=0、步级 failed）
- **P1·events.pull 前端路径双缺陷**：①多文件时合并文本按 files 数量**重复解析**（多源时每事件重复 N 次且 source 归属错乱）②缺 idempotencyKey 去重（内核路径有，双路径口径不一致）。修复：入参改逐文件 {file,text}+跨文件去重，与 kernelEventsPull 同口径（回归测试：多文件不重复、source 归属真实文件、跨文件重复键只留先到者）
- **P1·广播过期信封重复回执**：executeAndRecord 过期分支未入 processed 台账——同一过期信封重放（SSE 重投/NDJSON 补扫）会重复回 expired 回执且重复计数。修复：过期同样 markProcessed（回归测试：重放 receipt=undefined、计数不变）
- **P1·诊断包统计归零**：导出诊断每次 `new BridgeService()`——计数全零失真。修复：优先用当前活动实例（桥关时才回落新实例）
- **P1·广播订阅无法创建**：桥已运行时在设置页打开广播开关，`startBridge()` 早退导致 `BroadcastSubscriber` 永不创建——开关显示"已开启"但快路径死路。修复：抽出幂等 `startBroadcastSub()`
- **P1·事件订阅生命周期缺口**：设置页开桥只调 `startBridge()` 漏 `startEventBridge()`（事件物化须重启插件才生效）；关桥漏 `stopEventBridge()`（桥关了物化还在继续写）。修复：与 onload 配对——开桥即接上、关桥即退订
- **P1·事件物化并发丢更新**：materializeHubEvents 读→改→写无串行化——两个快速连续事件同读旧文本，后写覆盖前写（事件丢失）。修复：createSingleFlight 串行队列，前一任务落定才启动下一任务，单任务失败不阻塞（回归测试：20 并发全保留有序 / 失败不阻塞）
- **P1·plugin.api args 形状**：实现只接受数组，对象会被**静默丢弃参数后照常调用**（违反"未知不得改写为成功"）；MCP schema 却声明 object。修复：契约三处钉死（实现/MCP schema/api.md）——数组=位置参数原样、对象=单一 options 实参、其他形状显式 `rejected`（回归测试三形状）

### Docs
- api.md：`events.*`/`workflow.*` 过期的"设计态/当前回 unsupported"表述更正为 v0.7.x 已实现

### Verified
- 113 单测（+7 回归）；tsc 零错误；构建通过

## v0.7.2 · 2026-10-03（bug#10：广播订阅断连自愈）

### Fixed
- **bug#10（真机联调暴露）**：SSE 订阅断连后退避重连上限 30s——断连窗口（实测可达 45s+）内广播快路径命令全部无人消费。两处修复：①退避上限 30s→**5s**（本地回环重连成本极低）；②MCP 只读工具快路径 **3s 无回执即同 id 走 NDJSON 补发**（D-0012 预留语义防双执行）——订阅缺口 3s 内自愈，毫秒级场景不受影响
- 另：mcp-smoke 无 SIYUAN_TOKEN 时子进程秒退会假超时 20s，改为进程退出明确诊断

### Verified
- 99 单测（+1 快路径回退三态）；真机：轮询器活/订阅断连窗口实测 45s+ 后自愈

## v0.7.1 · 2026-10-02（bug#9：kernel.js 加载前提——plugin.json 缺 kernels 字段）

### Fixed
- **bug#9（内核路由对全部用户失效）**：plugin.json 缺少 **`kernels`** 字段——思源内核按该字段判定是否加载插件的 kernel.js（对照 siyuan-plugin-docktomato 实证：其有 `"kernels": ["all"]` 而被内核加载；快门缺字段即从未进内核侧名单 `isKernel=true`）。补 `"kernels": ["all"]` 后内核同步路由即刻可用（toggle petal 开关即可热加载，无需重启）。v0.7.0 的发布包同样受影响，故以此版本重发

### Verified（3.8.6 真机复测批）
- ⑩ 内核路由 ping `channel=kernel-sync` ✓ / events.list 白名单=8 ✓ / 前端专属 op 诚实降级 ✓
- **MCP 内核路由打通**：tools/call registry.list 经 exec 1866ms（含 node 启动）isError=false ✓
- ⑩⓪ 无 Token 401（3.8.6 下复确认）✓；③桥端到端/v1.5 联调待用户开启「外部命令桥」开关后 `npm run verify:restart` 即测

## v0.7.0 · 2026-10-02（MCP stdio 代理 + 内核路由通道 + 面向发布的三通道定位）

### Added
- **src/mcp/ MCP stdio 代理**：23 op 一比一映射为 MCP tools，AI 客户端（Claude Desktop/Cursor）可执行思源命令、记打卡、记人脉互动、跑受控工作流——内置 MCP server 未覆盖的小驴生态面（差异化论证 docs/10 §3.14）
- **安全模型**：默认只暴露 13 个只读工具；写工具需 `LV_MCP_WRITE=1`（tools/list 隐藏+tools/call 诚实拒绝）；`plugin.api`/`workflow.execute` 标 destructiveHint；快门侧防线（确认门控/黑名单/审计/允许名单）全共用
- **逐 op 参数 schema**（ARGS 表对齐 api.md；template.new 形状以 kernel-ops 为准）；纪律测试强制每 op 登记 properties+描述
- **MCP 内核路由通道（R50）**：KERNEL_OPS 优先走 `/plugin/private/<plugin>/exec` 直呼——**外部命令桥默认关时 7 个内核 op 对 MCP 也可用**；失败回退只读广播快路径→NDJSON
- **tools/mcp-smoke.mjs 协议级冒烟**：完整 stdio 序列 vs 真进程（握手/列表/隐藏/拒绝/写模式/诚实超时）
- **npm 验收入口**：`accept`（单测+MCP 冒烟）/ `verify:restart`（七类真机数据）/ `smoke:mcp`
- verify-restart 扩容：MCP 内核路由检查 + §10-10 内核日志增长测量（SIYUAN_LOG）

### Docs
- 双语 README 升级为三通道定位（对比表）+ MCP 独立节 + 验收入口；GitHub 仓库 description/topics 同步

### Verified
- 98 单测 + MCP 协议冒烟 6/6；裸 Node 真机烟测（内核路由 404→回退→诚实超时）；e2e（真 AI 客户端+插件消费）待思源重启复测批

## v0.6.6 · 2026-10-02（审计历史跨重启恢复 + 测试定时炸弹拆除）

### Fixed
- **bug#8：审计历史跨重启静默销毁**——audit.json 一直"只写不读"：onload 从不加载历史，且重启后首次 flushAudit 会用新条目**整个覆写**上次历史。现在 onload 经 store.loadAudit 恢复（逐条形状校验、坏条目跳过、按 auditMax 截尾）
- **测试定时炸弹**：workflow 两用例（denied/失败停止）用真实 Date.now() 对固定 expiresAt（2026-10-02T00:05Z）断言——现实时间越过该点时集体误爆为 expired；改传固定时钟 now:()=>now，从此确定性

### Verified
- 存量 bridge-settings.json（v0.5.9 形态，缺 broadcastEnabled）经 normalizeSettings 逐字段校验：缺失字段回落默认（广播=关，红线默认）——重启升级兼容性实证无忧

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

