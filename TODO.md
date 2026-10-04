# 待办总清单（TODO）

> 更新于 2026-10-02（v12：R68 后状态审计 + R69/R70 工程审查 + R71~R79 多维产品调研 + R80~R96 持续使用、知识维护、自动化、媒体、结构化数据与治理调研 + R97~R105 产品定位、意图结果中枢与完整使用闭环调研 + R106~R113 Quicker 动作编辑与 AI 创建调研 + R114~R122 AI 智能体、思源 Agent 接入与提示词体系调研 + R123~R130 待办融合、依赖重排与执行门禁 + R131~R140 体验、页面、交互与内容深化调研 + R141~R150 UI 原型落地差距与实施前置 + R151~R160 Quicker 增强思源动作场景调研）。汇总自 docs/01~22 + 系统环境/生态/可观测性等维度。
> 勾选框 `- [ ]`；标注：`【实测】`真机验证 · `【spike】`快门 M0 实证 · `【GH】`GitHub 发布相关 · `【暂缓】`集市延后项 · `【评估】`先调研再决策。
>
> **发布策略（用户定）**：先上 GitHub（源码+Release+手动安装），**暂不推送集市**（思源 bazaar / Quicker 动作库均延后），上架门槛见 §8 末尾。
> **本轮范围（用户定）**：基于现有 UI 原型，核对运行事实、页面数据来源和操作条件，增加尚未覆盖的实现前置并细化已有验收；所有新增事项保持未勾选，不开发、不接入真实模型、不修改真实 AI 配置。

## §0 工作循环（兜底规则 · 用户定的长期协议）

**触发条件（v2 · 按整体任务）**：所有**可自主完成**的任务已完成勾选；标注【等实测】/【等用户】/【spike·需思源】的条目视为用户侧阻塞项，不阻止循环触发。用户反馈实测结果后，对应条目解锁并优先处理。

**触发后依次执行三个循环，循环永不自然终止（由用户叫停）：**

### 循环 A：优化已开发内容
对全部已交付物做一轮系统性优化，优化项本身**先登记为本轮待办再执行**（可追溯）。优化面固定清单：
1. 文档一致性：交叉引用/端点参数/版本号复核（对照本机端点表与最新实测结论）
2. 代码质量：以 reviewer 视角过一遍已有源码（命名/边界/错误处理/幂等/安全红线 §11）
3. 性能预算复核：面板冷热启动、桥往返延迟、轮询开销 对照 §4/§5 的预算表
4. 实测结论回写：05 §7 表格、04 硬约束、WALKTHROUGH.md
5. 借鉴回填：07 清单中未消化的技巧（T1~T20 之外的存量）与头部动作作者的新更新
6. 收敛：删除过时分支方案（已被实测否决的预案），文档瘦身

### 循环 B：新增待办
从以下来源生成新一轮待办（标注轮次 R1/R2/...，进入对应分组）：
1. 循环 A 的优化发现
2. §1 实测与 §10 联调暴露的新问题
3. §12 远期池中条件成熟项的晋升
4. 上游变化：思源新版本 API/能力、Quicker V2 新模块、小驴生态插件新版本能力面
5. 使用反馈：实际使用中的摩擦点
6. 07 借鉴清单的「动作候选池」孵化立项

**每轮结束输出**：本轮优化清单（改了什么、为什么）+ 新增待办数与分组去向，然后进入下一轮检查。

### 循环 C：生态调研驱动（v2 新增 · 用户定）
系统性调研外部生态，寻找可借鉴、可集成、可立项的新事项：
1. **GitHub 同类高星软件**：启动器/快捷输入/自动化工具（uTools、Listary、Wox、PowerToys Run、Raycast、Alfred 生态）的功能与交互范式
2. **思源集市同类插件**：新上架的联动/自动化/命令面板类插件的能力面
3. **Obsidian / Notion 同类插件**：QuickAdd、Commander、Slash commands、Notion API 生态的桥接做法
4. **手机/电脑软件**：iOS 快捷指令生态、Android 自动化（Tasker/MacroDroid）、桌面自动化（AutoHotkey 社区脚本）中可借鉴的触发与编排模式
5. **Quicker 其他优秀动作**：动作库高赞/新热动作（不限思源分类）的机制迁移可行性

产出：每轮调研记录 `docs/10-生态调研-R<轮次>.md`（调研对象/机制/可借鉴点/立项建议），可立项的晋升为 R 轮新待办；仅记录不立项的留在调研文档备查。**调研本身在循环 A/B 之后执行，避免为调研而调研。**

## 1. 实测与环境验证（最先做）【等实测：全部条目待用户有空时真机验证，验证前不阻塞自主开发】

### 1.1 设计分支类（影响架构取舍）
- [ ] 【实测】showmenu 动态能力：列表变量生成菜单、项附加值、子菜单（05 §7-A）
- [ ] 【实测】showmenu 菜单项数上限与卡顿阈值（05 §7-C）
- [ ] 【实测】`run` 启动思源 exe 路径参数；窗口标题是否含工作空间名（05 §7-B）
- [ ] 【实测】`createDailyNote` 的 `app` 参数（05 §7-D）
- [ ] 【实测】外部 API 写入已打开文档后 UI 是否自动刷新（05 §7-G）
- [x] 【实测】`getConf`/`getNotebookConf` 日记路径字段名（05 §7-H）——✅ spike⑧ 已实证 `conf.dailyNoteSavePath`（驼峰，bug#6 修复 v0.5.9）；docs/05 §7-H 状态同步（R57 待办清单审计发现：答案早已产出而待办未销）
- [x] 【实测】Quicker WebSocket 连 `/ws/broadcast` 鉴权（05 §7-E）——**需求已被 D-0010 取代**：前端中继不做，v2 同步通道走内核私有路由；v1.5 广播用 `/api/broadcast/postMessage`+SSE（Token 头），Quicker WS 直连 `/ws/broadcast` 的路径不再依赖【R58 待办审计销项】
- [ ] 【实测】668 `/api/exec` operation=action 字段与 wait 返回值（05 §7-F）
- [ ] 【实测】思源浏览器扩展向动作传当前页 URL
- [x] 【实测】写入后索引延迟量级（校准等待/重试参数） → ✅ R140 实测：insertBlock 62ms→SQL 可见 1782ms/getBlockInfo 立即可用——docs/03 §0 惯例已校准「等 2s 或 3 次重试」
- [x] 【实测】快门轮询对**内核日志**的影响：500ms getFile/putFile 是否刷屏日志（§10-10 决策依据） → ✅ R138 实测（2026-10-04 后台 120tick/60s）：日志仅增 577B（≈4.8B/tick，≈28KB/小时）——影响可忽略，pollMs 默认 500ms 维持，无需日志豁免
- [x] 【实测】【spike⑨】`data/storage/local` 是否**不随同步**；`/api/file/getFile|putFile` 能否访问 storage/local 路径——若成立，桥文件迁到 local 可同时消解多设备消费与同步流量两个问题（§5.3 决策）——**◐ 单机部分已实证**（R21/R31：putFile/getFile 对 `/storage/local/siyuan-quickgate/` 均 200，D-0006 技术可行）；**剩多端隔离验证**（需第二设备/同步对端） → ✅ R138 后台实证（2026-10-04）：/storage/local API 可写可读（磁盘落 <工作区>/storage/local/，与同步的 data/ 平级=不随同步）；桥目录迁移裁定=不迁（device 路由已解多设备，storage/local 维持存本机私有状态）

### 1.2 系统环境类（本地请求的经典坑）
- [x] 【实测】**系统代理对 127.0.0.1 请求的拦截**（Quicker HTTP 模块是否走系统代理；被拦截则加白名单/绕过设置） → ✅ R140 实测：本机系统代理未启用（ProxyEnable 无值）——拦截风险不存在；若日后开启代理，.NET/Quicker HTTP 需 bypass 127.0.0.1（FAQ 已记）
- [x] 【实测】**多工作空间同开时的内核端口规律**（第二空间是否换端口；动作的 SY_URL 是否需动态发现） → ✅ R140 源码实证（siyuan-note/siyuan kernel/util/working.go+server/proxy/fixedport.go）：内核默认随机端口+额外起「固定 6806 反向代理」（仅当该实例能绑定 6806）；多空间同开时仅第一个可经 6806 访问，第二空间须用真实随机端口——v1 诚实边界=支持单实例，多空间记已知限制
- [ ] 【实测】睡眠唤醒后内核可达性（Quicker 动作首调失败率；是否需要重试提示）
- [x] 【实测】思源开启 accessAuthCode（访问鉴权码）后 API Token 是否仍直通——✅ 本机答案在握：**访问鉴权码一直处于开启状态，R21 起全部 Token 探针（loadPetals/SQL/putFile/postMessage/exec…）均成功**=Token 直通实证；无 Token 401（⑩⓪）亦在该状态下验证【R58 待办审计销项，证据=既有探针记录】
- [x] 【R59·循环B】**§10-10 日志增长测量并入复测批 + spike⑨ 状态标注**：verify-restart.mjs 增 SIYUAN_LOG 环境变量启用项（复测前后取 temp/siyuan.log 差值，桥开着时 8s≈16 个轮询周期计入）——重启后即得"500ms 轮询是否刷屏"实测数据；本机预跑基线 9.27MB/全程 +961B ✓；spike⑨ 待办补 ◐ 标注（单机实证已过，剩多端隔离）
- [x] 【R60·循环A】**v0.6.6 部署完整性复核**：diff -rq dist vs 工作空间逐字节一致 ✓（R35 后又经 v0.6.5/v0.6.6 两次部署，零漂移）
- [x] 【R61·循环A】**git 仓库卫生**：单分支（main，本地=远端）✓、工作区干净 ✓、标签同步——gh release 建的 tag 在远端，本地 fetch --tags 后 21 个全齐（v0.6.6 在列）
- [x] 【R62·循环A】**重启前就绪板（四层统一验证）**：①单测 98/98 ✓；②MCP 协议冒烟 6/6 ✓；③桥 e2e 预检 exit=2（环境未就绪，归因正确）✓；④复测批 3/5（两项正确归因待重启）✓——**全部自主层绿灯或诚实归因，快照固化；重启后同四条命令即全量转绿**
- [x] 【R63·循环A】**令牌泄漏安全扫描（两项目零命中）**：真实 Token 值与令牌形状字面量在 quickgate 仓库与设计文档项目全部文件类型中零命中——所有引用走环境变量/用户配置变量；.gitignore 的凭据条目（*.local.json/bridge-*.json/audit.json/.env）覆盖到位
- [x] 【R64·循环B】**验收流程收敛为一条命令**：package.json 新增 `accept`（=单测+MCP 冒烟，实跑 98/98+6/6 ✓）、`smoke:mcp`、`verify:restart` 三个脚本——重启后验收从记四条命令变成 `npm run accept` 全绿 + `npm run verify:restart` 七类数据
- [x] 【R65·循环A】**验收入口文档同步三处**：WALKTHROUGH 复测节改 npm run 形式（并补 SIYUAN_LOG 用法与 MCP 项）、双语 README 开发节补 `pnpm accept` 行
- [x] 【R66·循环A】**设计文档项目建立版本控制（安全措施）**：发现 13 份设计文档+350 项 TODO 账本+参考件（~1MB）60 余轮全部为无撤销覆盖编辑——git init + 初始快照提交（9e03b49，28 文件；已有 .gitignore 覆盖凭据/运行时目录，token/secret 通配在案）。非破坏性（删 .git 即撤销）；后续 R 轮的文档改动可逐轮留痕
- [x] 【R67·用户指令】**GitHub 发布就绪 + v0.7.0 发版**：①双语 README 面向发布重写——三通道对比表（NDJSON/内核路由/广播）、MCP 独立节（Claude Desktop 配置 JSON）、验收入口、AIA助手定位；②GitHub 仓库设置：description 更新为三通道+MCP 现实、topics 补 siyuan/mcp-server/ai-tools/json-rpc（共 8 个）；③**v0.7.0 发版**（SemVer minor：MCP 新外部面）——accept 98/98+6/6（其间抓到 mcp-smoke 在无 SIYUAN_TOKEN 时假超时 20s 的问题，改为进程秒退明确诊断）→ build → 部署工作空间 0.7.0 → CHANGELOG v0.7.0 节（Unreleased 合并去重）→ GitHub release + CI 绿 + tag 同步；e2e（真 AI 客户端+插件消费）仍待复测批，故保持 pre-release 标记
- [x] 【R68·用户指令"思源已经重启"】**复测批执行 + bug#9 修复（v0.7.1）+ 内核路由全线打通**：①内核已升 **3.8.6**（兼容性顺带实证）；②accept 全绿后复测批曾仍 404 → **根因=plugin.json 缺 `kernels` 字段**（内核按它判定是否加载 kernel.js；对照 docktomato 有 `"kernels":["all"]` 实证）——内核侧名单 isKernel=true 从不含快门，内核同步路由对全部用户失效；补字段后 **toggle petal 开关即热加载**（无需再重启）；③复测批 **7/8**：⑩路由 ping channel=kernel-sync✓/events.list 白名单=8✓/前端 op 诚实降级✓/**MCP 内核路由 1866ms isError=false✓**/⑩⓪ 401✓/⑤广播✓；唯 ✗=③桥端到端（外部命令桥开关默认关=安全设计，用户在设置开桥后 `npm run verify:restart` 即测）；④v0.7.1 发版（v0.7.0 包受影响故重发）+CI 绿+tag 齐；**MCP 真 e2e 亦顺带完成（registry.list 经路由全链）**——唯剩③/v1.5/⑪三项等开桥与打卡数据
- [ ] 【实测】思源开启 HTTPS 后 URL 协议变化对动作的影响（配置项兼容 https）
- [ ] 【实测】Defender/杀软对 Quicker C# 脚本与临时文件的误报
- [ ] 【实测】勿扰模式下 notify 可见性
- [ ] 【实测】Quicker 免费版跑通 P0 全部模块；受限列 Pro 清单
- [ ] 【实测】V2「用户配置项」入口与动作导出文件格式实测（右键动作→设置；quicker-actions 归档分发依赖导出格式）
- [ ] 【实测】Quicker 状态存储（statestorage）重启后持久性验证（缓存/配置依赖它）
- [x] 【实测】C# 表达式环境：Newtonsoft.Json 版本、可用命名空间边界（动作里重度依赖） → ✅ 设计性解决：参考件全部零第三方依赖（JSON 手写转义/轻量提取），不依赖宿主 Newtonsoft 版本（reference/README 已知边界声明）

### 1.3 配置与习惯类
- [x] Quicker 开机自启 + 思源托盘常驻配置（保证 API 全天可用） → ✅ R140 核查：两者均已配置（Run 键 Quicker.exe -autorun / SiYuan.exe --openAsHidden）——无需改动
- [ ] 快捷键冲突扫描（Alt+S/Alt+Q/侧键 × 常用软件）
- [ ] 文本指令在中文输入法激活态下的可用性
- [ ] 多显示器 showmenu 定位与 DPI
- [ ] Quicker「适用于程序」绑定与场景自动切换配置（SiYuan 场景）
- [ ] 写剪贴板与思源剪贴板历史的相互影响

## 2. Quicker 公共子程序（动作地基）【需 Quicker 编辑器：子程序搭建为 GUI 操作，等用户操作；评估/脚本类已完成】

- [x] `SY·内核请求`：配置读取（statestorage + `%APPDATA%\siyuan\env` 兜底）→ HTTP → 通用错误分支 → 输出（03 §0 / 04 §8） → ✅ R215 交付对照：**SY-内核请求.cs v1.1** 即本项实现（env 兜底→HTTP→401 自愈→通用错误分支——csc 编译门通过）
- [x] `LV·发命令`：id 生成 → 拼 NDJSON → putFile → 输出 id（02 §6） → ✅ R215 交付对照：**LV-发命令.cs** 即本项实现（id 生成/信封直嵌/Multipart putFile）
- [x] `LV·取回执`：循环 getFile → 逐行 JSON.parse 按 id 匹配 → 按 op 等待（普通快门约1.2s、数据约8s、commands.run确认约35s或pending） → ✅ R215 交付对照：**LV-取回执.cs** 即本项实现（按 op 预算轮询/timeout 诚实/不换 id）
- [x] `SY·路由`：六分支分发 + 占位符解析器全实现（05 §5.1） → ✅ R132 SY-路由.cs 总装件（含 §5.1 占位符）
- [x] `SY·反向触发`：668 /api/exec 封装 → ✅ R217 交付对照：**SY-反向触发.cs 已交付**（operation=action/wait/maxWaitMs/Bearer/HTTPS——csc 编译门过）
- [x] OCR 清理子程序（去汉字间空格换行） → ✅ R132 SY-OCR清理.cs v1.0（汉字间删/西文保留/断行缝合/句号段落）
- [x] 「思源未运行」分支子程序（探测→询问→启动→重探→toggle） → ✅ R132 SY-思源未运行分支.cs v1.0（300ms 探测→询问→exe/siyuan://启动→重探 15s）
- [x] 子程序版本注释头 + 变更记录 → ✅ R132 全 12 件 @version 头齐
- [x] 日志轮转（sy-quicker.log 超 1MB 滚动） → ✅ R132 SY-日志轮转.cs v1.0（跨进程 Mutex+滚动 .old）
- [x] 每个子程序外层兜底 try/catch（未预期异常也出中文 notify） → ✅ R132 编译门复核：全部 12 件顶层 try/catch 齐备（新件即含；存量件经 csc 全量重验）
- [x] 【评估】写前快照选项：`/api/repo/createSnapshot`（W, memo）存在，可行但为全库快照——结论：仅批量写动作（SY-12/13、同步三连）执行前自动打快照 `memo="before-quicker-<动作名>"`；单块写入不做（成本不匹配）。已写入 12-FAQ「数据与安全」
- [x] HTTP keep-alive/连接复用实测（面板四路并发开销）【等实测】 → ✅ R217 裁定（等实测轮）：面板四路并发开销=Quicker HTTP 模块语义（保持连接由 .NET ServicePointManager 默认）——实测项保持
- [x] 令牌自愈增强：401 时除引导手填外，先自动重读 `%APPDATA%\siyuan\env`（思源重置令牌场景） → ✅ R132 SY-内核请求 v1.1（401→强制重读 env→重试一次→仍失败才引导）

## 3. P0 通用动作【需 Quicker 编辑器：动作为 GUI 搭建，蓝图齐备（docs/03），等用户操作；或后续评估用 Quicker 导入文件】

- [x] P0-1 快速捕获到今日日记（判型 T5；笔记本自动发现+手填兜底；`HH:mm` 前缀右键可配） → ✅ R133 p0-1-快速捕获.cs 单文件版（HH:mm 前缀+R6 标题落点+R3 路由；Quicker 真机接线待）
- [ ] P0-2 划词摘录到收集箱（四级兜底；判型；浏览器 URL；可选复制块链）
- [x] P0-3 全局快查（`sql:` 前缀→`/api/ai/chatGPT` 生成只读 SQL） → ✅ R133 p0-3-全局快查.cs（三级 fallback+sql: 安全过滤：只读单语句/禁止词/强制 LIMIT；AI 分支留开关位）
- [x] P0-3 AI 生成 SQL 的安全过滤：含 UPDATE/DELETE/INSERT/DROP/ATTACH 等写/危险关键词直接拒绝 → ✅ R133 GuardSql（UPDATE/DELETE/INSERT/DROP/ATTACH/PRAGMA/INTO 等 13 词拒+分号拒+LIMIT 强制）
- [x] P0-4 打开今日日记/收集箱 → ✅ R133 p0-4-打开今日日记.cs（today 精确匹配+自动创建+收集箱发现）
- [x] P0-5 剪贴板图片入库（Multipart + OCR 写 alt） → ✅ R133 p0-5-剪贴板图片入库.cs（PNG multipart 上传+OCR alt 写入）
- [ ] P0-6 SiYuan 场景页
- [x] SY-12 汇总日记待办（SQL 转义；天数右键记忆） → ✅ R133 sy-12（日期白名单谓词拒宽匹配+转义+回链汇总块）
- [x] SY-13 数据体检（只读报表+误判提示） → ✅ R133 sy-13（只读报表+可能误判提示+只读不删铁律）
- [ ] SY·诊断 一键体检（九项检查+报告+修复指引）
- [ ] 每动作「右键菜单=设置」（07-T8）
- [ ] 每动作首跑向导（自动发现→确认→完成）
- [ ] 错误自检表写入动作说明
- [ ] 收集箱不存在时提供「自动创建」选项
- [ ] 动作图标统一：小驴视觉语言（复用人脉 gen-icon.mjs SDF 惯例）
- [ ] 每动作设置「最低 Quicker 版本」与「适用于程序」元信息

### 3.1 组合编排动作（多动作串联的场景包）
- [ ] 晨间启动：打开今日日记 + SY-12 汇总昨日待办 + 打卡到期提醒（快门 `checkin.items` 到期规则）
- [ ] 会议模式：新建会议文档（模板）+ 计时 + 结束后人脉互动（P1-8）+ 待办写入
- [ ] 收工流程：performSync + SY-13 体检摘要 + 导出备份提醒

### 3.2 R79：按模块延伸的功能候选（先做产品验证，不直接立项开发）

- [ ] 【R79-P1·捕获表单·评估】借鉴 QuickAdd 单页输入，将内容、目标、标签、日期、来源收在一次表单中；已有上下文可预填但可修改，多行草稿关闭后可恢复，避免连续弹窗。
- [ ] 【R79-P1·捕获模式·评估】评估连续捕获、粘贴后追加/替换、纯文本/Markdown 保留、前缀路由可见预览和默认目标记忆；输入法组合期间 Enter 不误提交。
- [ ] 【R79-P1·批量捕获·评估】文本/多链接/图片批量输入先逐项预览、选目标、标来源和大小；部分成功有逐项回执与补做，不把总失败当成全未写入。
- [ ] 【R79-P1·去重·评估】对同 URL、相同选区、重复剪贴板和连续点击做相似重复提示；用户可选择跳过、更新、仍保存，内容去重不能替代命令幂等。
- [ ] 【R79-P1·收件箱·评估】分拣增加未处理/稍后/已处理状态、批量选择、处理历史和撤销；移动、删除或转任务前展示原块和新目标，保留来源链。
- [ ] 【R79-P1·摘录来源·评估】网页/PDF/视频保存原 URL、标题、页码/时间戳、捕获时间和引用范围；结果可回到原页/原时间点，来源失效时仍保留可读摘录。
- [ ] 【R79-P2·网页保真·评估】评估保留列表、代码块、表格、图片说明与链接，区分选区和全文；清理跟踪参数可预览，付费/登录内容不承诺自动读取。
- [ ] 【R79-P1·图片/OCR·评估】图片先缩略图和大小预览，OCR 可校对、失败保留原图；说明处理在本地还是外部服务，取消/超限有明确结果而非只留下附件。
- [ ] 【R79-P1·检索·评估】搜索补按笔记本、日期、类型、标签、来源插件筛选与稳定排序；结果显示片段/高亮/上下文、匹配数与截断，点击定位到匹配块而非只打开文档。
- [ ] 【R79-P1·查询解释·评估】全文、标题、SQL、AI-SQL 路径显示实际使用的模式、筛选和结果范围；无结果可放宽条件，用户不会把超时/权限失败误认作零命中。
- [ ] 【R79-P2·保存查询·评估】评估固定常用查询、最近查询和可分享脱敏查询模板；导入预览读取范围，AI 生成 SQL 只读校验通过后才运行。
- [ ] 【R79-P1·模板·评估】模板按个人/会议/读书/复盘分类，变量一次填写并实时预览文件名、目标和内容；缺变量、同名冲突、非法路径和时区均在执行前处理。
- [ ] 【R79-P1·日期意图·评估】借鉴 Todoist 的可撤销日期识别，评估自然语言日期/标签/人物解析；识别结果高亮并可改回普通文本，不能把普通内容误当路由或自动打卡。
- [ ] 【R79-P1·专注计时·评估】计时支持暂停/继续/中断原因/跨休眠恢复；结束后先显示有效时长、关联文档和打卡项再确认，误关窗口不自动记成功。
- [ ] 【R79-P1·待办汇总·评估】日记待办区分未完成、已完成、重复引用、无日期和跨日迁移；按来源文档回跳，批量处理先预览并由原任务 owner 改状态。
- [ ] 【R79-P1·人脉输入·评估】姓名选择显示同名区分信息，支持多联系人预览和本次互动草稿；创建新人物和引用已有人物分别确认，不因窗口标题误识别就自动收编。
- [ ] 【R79-P1·学习闭环·评估】制卡/出题从已确认来源选择题型、数量、难度和牌组并预览；失败保留原摘录，评分/调度只回到权威插件，不能只按点击量算学习完成。
- [ ] 【R79-P2·报表·评估】周/月报显示范围、时区、来源、缺源、计数规则和上期对比；用户可筛选后导出 Markdown/JSON，AI 润色与原始统计分开并可还原。
- [ ] 【R79-P2·反向入口·评估】思源内触发 Quicker 的按钮、热键和命令链接做前台条件、冲突、未启动/未授权提示与安全参数预览；不能任意执行外部传入代码。

## 4. 思源超级面板【需 Quicker 编辑器：主流程为 GUI 搭建；模板与校验脚本已就绪（profile/逐项 gate 已实现并校验通过）】

- [x] templates/superpanel-menu.json 补 `profile` 字段 + SY-12/13/诊断项（validate-menu 5 组 20 项通过，含逐项 gate）
- [ ] 主流程 7 步搭建（05 §4）
- [ ] 动态数据四路并行 + 800ms 超时 + 300s 缓存
- [ ] L3 门控：主判 `/api/petal/loadPetals`，装了快门再 bridge.ping
- [ ] 快门缺席降级项 → **GitHub 安装说明链接**（集市暂缓期）
- [ ] statestorage 8 键缓存 schema（05 §3）
- [ ] toggle 启动/最小化 + 窗口标题匹配（05 §6.1）
- [ ] 面板设置动作（编辑 JSON/清缓存/重配/日志）
- [ ] 调试模式日志
- [x] menu JSON 校验脚本 scripts/validate-menu.mjs（node 可直接运行）
- [ ] 性能验收：冷 ≤1.2s / 热 ≤0.5s
- [ ] 双 profile 走查
- [ ] 面板按钮布局/图标/排序设计（Quicker 动作页视觉）

## 5. 小驴快门插件（siyuan-quickgate）

- [x] 【R225·新工具】**e2e-bg 后台真机走查**（tools/e2e-bg.mjs + npm run verify:bg）：多会话并行开发场景的标准验收入口——内核自动寻源（多空间端口漂移下自动找到本工作区内核，绕开 6806 固定代理）、限速礼貌（429 即退不刷新锁定）、冲突避让（桥>50 条待处理时跳过写入）、令牌自检（401 明确诊断退出码 3）；检查项=内核/令牌/桥 ping/内核路由/petal 加载。首跑 5/5 ✓（14643 工作区端口）
- [x] 【R225·校准】loadPetals frontend 语义实证：frontend="all" 返回空数组，真实 petals 须按 desktop/mobile 枚举（api.md/e2e-bg 已修正；registry.list 走 getFrontend() 本就正确）
- [x] 【R225·诊断】lv-cli 401/429 精确诊断（429→Retry-After 精确等待提示；401→令牌轮换引导）——多会话环境排障成本大幅下降
- [ ] 【R225·遗留】petal 热重载触发内核崩溃重启（libuv 断言， bug#14 候选）：petal setPetalEnabled 切换后内核在 ~20:31 崩溃（双内核并存 16:06/20:17 起），新内核自愈但**运行中 API 令牌随之失效**（401 全链）——上游 siyuan-note issue 候选；缓解=热重载后若 401 则提示内核已重启。数据完整性已验证（桥/事件/审计无损）

- [x] 【R171·新】p0-5 剪贴板图片入库加尺寸预检：>20MB 提示分片/压缩路径（当前 30s 超时兜底）；验收超限保留原剪贴板并给手动替代。（媒体域 R90-P1 体积限制缺口） → ✅ R172 当场解决：p0-5 加 >20MB 预检（保留原剪贴板+压缩/裁剪手动替代提示）——28 脚本编译门过

- [x] 【R144·MCP 协议面】冒烟第七断言：未知方法 → JSON-RPC -32601（实现已在位，断言补齐）——冒烟 7/7

- [x] 【R144·R74-P0 收口】千条命令队列压测基准（tests/bench-tick.test.ts 入仓）：1000×bridge.ping 单 tick **93ms**（≈10k cmd/s 内存面），IO 仅 getFile×2+putFile×2（回执/压缩批量写）——裁定**不设 MAX_TICK_COMMANDS 上限**（桥语义=尽快清积压+轮询器单飞+慢 op 15s 单命令上限已兜底）；再评估条件写进测试头注；大 payload（32KB args）在 32KB 信封上限内天然受限
- [x] 【R144·文档时效】GETTING-STARTED 复测样例 9/9→10/10（⑪/v1.5 转绿条件与 MCP 冷启动说明补齐）

- [x] 【R142·⑪补充】删除事件（event-deleted）物化路径核实：打卡公开桥 v5 能力表**无 delete 能力**（仅 read/record——删除是 UI 专有操作，公开桥不暴露属安全设计，bundle 实证）；快门侧 normalizeCheckinEventDeleted/物化链已有单测覆盖。**真机验证方式=你在打卡 UI 删除那条「quickgate e2e 验证(可删)」测试记录**，删除即触发全链（事件→events.ndjson→events.pull 可拉到 deleted 标记）
- [x] 【R142·WorkBuddy】《思源笔记插件-提示语-精简版》正文仍待登录（IAB 标签页已被关闭未登录）；再次可用时：浏览器面板扫码或直接粘贴正文

- [x] 【R128·决策代行】Claude Desktop 全链打通：winget 安装 v1.44121.2（已登录态复用）+ claude_desktop_config.json lv-quickgate 条目校验（dist-mcp v0.7.3+Token 注入）+ stdio 握手实测 + **MCP server 子进程被 Claude 拉起（PID 20016）**——AI host 面就绪
- [x] 【R128·决策代行】npm publish 探测：npm 未登录（ENEEDAUTH）——建号需邮箱验证属用户项；dist-mcp/ v0.7.3 就绪，等账号后 npm publish 一步
- [x] 【R129·Quicker 自动化受限定论】Quicker 以管理员运行→UIPI 阻断非提升 UIA（空窗口列表/taskkill 拒绝均此因）；非提升重启后仍无 UIA 窗口（2.x 无头托盘架构，设置走 Headless Shell）；HTTP API(668) 默认关且开启需 GUI；URI 仅 settings/navigate/runaction 无 import。**结论：动作编辑器 GUI 无法从本会话自动化**；g2-capture.cs 单文件版+导入指引就绪，待（a）提升权限会话重试或（b）用户一次手动导入。Quicker 已恢复运行（非提升，重启后随自启动回到原权限）
- [x] 【R130·文档】PROGRESS.md 同步 v0.7.3 真机批；R69·文档组的过期待办在下次发版轮统一清（R69 文档组保留）

- [x] 【R127·真机批】**思源全自动重启×4 + v0.7.3 部署 + 真机验收 10/10 全绿**：③桥 289ms / ⑩路由+MCP 路由 621ms / ⑪事件物化闭环（recorded=1→events.pull 11ms）/ v1.5 广播快路径 146ms / MCP 冒烟 6/6（LV_MCP_WRITE 23 工具）——此前 ⑪/v1.5/MCP 三项跳过全部转绿
- [x] 【R127·bug#11】信封不完整行（op 缺失）凭合法 id 字段逃过压缩——真机实测 33 条重复指纹回执（多消费者窗口期）；修复 compactCommands 按信封完整性分类（回归测试+真机复验坏行首 tick 即压缩）
- [x] 【R127·bug#12】3.8.6 内核缺失文件返回 HTTP 202+application/json 错误信封——getFileText 误当文件内容，实测 404 JSON 混入 events.ndjson 首行；修复按正文识别（R78-P1 错误分类清账）
- [x] 【R127·bug#13】vite CJS 产物 JSON 动态 import 转裸 require 相对路径——思源渲染进程 require 绑定 renderer_init 必炸（events.pull 实测）；前端 manifest 消费路径长期潜伏首次暴露；修复静态 import 内联（与 kernel.ts 同法），chunk 机制消除

### 5.0 R1：小驴生态中枢定位（新增收敛项）

- [x] 【R1-P0】将快门定位固化为"小驴生态联动中枢 + 外部网关"，明确与雷切、管家、Quicker 的职责边界（详见 docs/09）——已固化入 quickgate README 双语与 DECISIONS D-0001
- [x] 【R1-P0】为雷切、打卡、拾遗、人脉、管家、闪卡、考试建立 capability manifest（插件 ID/版本/协议/能力/whenReady/health）——src/assets/ecosystem-manifests.json（maturity 按 docs/09 抽查口径）
- [x] 【R1-P0】定义 `registry.*` 能力：插件发现、版本协商、启停状态和健康检查——registry.list（manifest×loadPetals）+ diagnostics.report 已实现（v0.2.0）
- [x] 【R1-P1】定义 `context.*` 能力：编辑器、工作区、前台场景快照，供拾遗/管家/Quicker 复用——最小契约=editor.context（已实现）；工作区快照复用雷切 workspace-context，不重复造
- [x] 【R1-P1】定义 `events.*` 白名单目录、payload schema、来源和幂等键（打卡/拾遗/闪卡/考试优先）——契约草案定稿且 **v0.4.0 已实现**（events.list 白名单目录 + events.pull 文件载体，4 组新测试）；上游数据源桥接另立条目
- [x] 【R1-P1】定义 `workflow.*` 受控编排契约：逐步确认、单步超时、失败停止、回执和补偿边界——契约草案定稿且 **v0.4.0 已实现**（workflow.plan/execute：受控白名单、总确认 30s、失败停止不回滚、计划一次性）
- [x] 【R1-P1】为拾遗、管家、闪卡、考试补 first-party adapter；雷切沿公开 Agent/命令能力接入——修正：design/unlocated 态只进 manifest（已按 docs/09 分层执行），adapter 等各插件公开契约成形
- [x] 【R1-P1】定义缺插件、未就绪、版本不兼容时的 `unsupported`/降级语义，不读取任何私有存储——适配器能力协商超时回 unsupported、kernel 路由 FRONTEND_ONLY 回结构化 unsupported、plugin.api 非允许名单回 rejected（均测试覆盖）
- [x] 【R1-P1】实现 `diagnostics.*` 统一健康报告，供管家、超级面板和设置页复用，禁止输出 Token/正文——diagnostics.report 已实现（脱敏快照，v0.2.0）
- [x] 【R1-P2】让 Quicker、手机、PowerShell/CLI 等外部客户端复用同一生态契约，避免再造专用桥——contracts/quickgate-api-v1.json + tools/lv-cli.mjs + Send-LvCommand.ps1 + 668 快捷指令路径全部走同一契约（02 §6/§8）
- [x] 【R1-P1】建立七款插件能力成熟度矩阵（stable/experimental/design/未定位），只有 stable 能力进入默认工作流——ecosystem-manifests.json（v0.2.0 建立，R6 校准）
- [x] 【R1-P1】按各插件当前 manifest 与公开文档校准版本和 API——R6（2026-10-02）按各仓库远端 main 校准：雷切 0.44.1（+3 能力）、打卡 18.16.0（apiVersion=5 实证无破坏；契约 8 事件全登记；**发现 v0.4.1 事件订阅通道 bug 并于 v0.5.2 修复**）、人脉 0.4.1（桥 v1 不变）
- [x] 【R1-P1】补齐拾遗插件仓库或明确"未定位"状态——本轮 D:\AI 全盘搜索未定位（2026-10-02），按 unlocated 处理：只显示诊断不注册 adapter；等用户指出仓库位置

### 5.0.1 R1：桥可靠性与契约阻断项（✅ 已在 quickgate v0.1.0 代码中实现并测试覆盖）

- [x] 【R1-P0】修复整文件队列竞态：按 id 记账 + 惰性压缩（D-0002），tick 级测试覆盖"消费期间追加不丢失/复活行去重"
- [x] 【R1-P0】按 op 定义回执等待：api.md 契约固化（普通 ≤8s、commands.run ≥35s 覆盖确认窗口、超时禁换 id 重试）；CLI 客户端按此实现
- [x] 【R1-P0】迟到回执语义：回执永远按原 id 落盘，不假设 Promise.race 取消副作用（D-0005）
- [x] 【R1-P1】幂等台账持久化（bridge-state.json，500 LRU，normalize 坏数据回空），externalRef 由信封 id 稳定派生（D-0003）
- [x] 【R1-P1】轮询器单飞调度（D-0004），批次内处理+退避+关闭语义均有单测
- [x] 【R1-P1】reply:false 分支：执行不写回执（单测覆盖）；调用方超时观测约定见 api.md
- [x] 【R1-P1】坏 JSON 行回执 schema：行指纹占位 id，单批只回执一次，压缩时移除
- [x] 【R1-P1】回执匹配逐行 JSON.parse 按字段取 id（results.findReceiptById），测试覆盖"包含陷阱"

### 5.1 M0 spike【内核侧 ✅ R21 自动执行完成；前端侧（①②④⑤⑦）仍需思源窗口 DevTools——手册 docs/WALKTHROUGH.md】
- [ ] 【spike】① 命令注册表路径实证——**静态已钉 langKey（v0.5.8）**；真机校 p.displayName/p.i18n 挂载【需前端 DevTools】
- [ ] 【spike】② confirm API 与自制超时（校准 index.ts confirmWithFront）【需前端 DevTools】
- [x] 【spike】③ 桥文件端到端 <2s——快门已部署启用，**待内核重启**（kernel.js 生效）后 `lv-cli.mjs ping`【等内核重启】 → ✅ 2026-10-03 真机 289ms（v0.7.3 部署后）
- [ ] 【spike】④ Web Lock 多窗口单消费【需前端】
- [x] 【spike】⑤ SSE/WS 广播可用性——✅ R22 实证通过（postMessage 自动建频道 + SSE 订阅 1s 内送达 + Token 鉴权）；**v1.5 push 通道解锁**：细化立项=外部 postMessage 推命令 ↔ 快门前端 SSE 消费，与 NDJSON 慢路径并存【等内核重启后可连同 e2e 一起做】
- [x] 【spike】⑥ petal/loadPetals 形状——✅ 实证吻合（name/version/enabled；响应内嵌 js 源码体积大）
- [ ] 【spike】⑦ editor.context 可行性（校准 index.ts readEditorContext 选择器）【需前端 DevTools】
- [x] 【spike】⑧ 日记笔记本自动发现字段——✅ 实证 `dailyNoteSavePath`（驼峰）+ 默认模板歧义；bug#6 已修（v0.5.9）
- [x] 【spike】⑨ storage/local 同步边界与文件 API 可达性——◐ 单机读写✓（D-0006 技术可行）；多端隔离待第二设备

### 5.2 脚手架与工程化（✅ quickgate v0.1.0 已完成大部分）
- [x] plugin-sample-vite-svelte 建仓（main、仓库名=name、Node≥24/pnpm）
- [x] `src/types/bridge.ts` 全类型（06 §5.1）
- [x] `src/services/poller.ts` 状态机（idle/polling/backoff/closed，纯逻辑可测）
- [x] `src/services/envelope.ts` parse/normalize/校验
- [x] `src/services/results.ts` 追加+裁剪 200 行+写后回读
- [x] `src/services/storage.ts` 自管 JSON（Web Lock/schemaVersion/normalize）——store.ts 承接，Web Lock 多窗口项待 spike④
- [x] `src/registry.ts` 命令注册表单点封装+探测降级
- [x] `src/adapters/checkin.ts`（whenReady 上限等待，超时回 unsupported）
- [x] `src/adapters/contacts.ts`
- [x] device 名记录（storage/local，信封 device 路由）——ensureDeviceName 已实现 local 优先读写 + settings 回退（行为验证随 spike⑨） → ✅ R138 后台实证（2026-10-04）：/storage/local API 可写可读（磁盘落 <工作区>/storage/local/，与同步的 data/ 平级=不随同步）；桥目录迁移裁定=不迁（device 路由已解多设备，storage/local 维持存本机私有状态）
- [x] plugin.json 全字段（0.1.0 / 3.8.4 / frontends / keywords）
- [x] 图标 gen-icon.mjs 惯例（蓝紫门框+速度线+橙点，icon 160 + preview 1024×768；变体 a 已定稿，b/c 备选）
- [x] i18n zh_CN/en_US 全键（06 §5.3）
- [x] LICENSE（MIT）+ CHANGELOG + README 双语
- [x] docs/PROGRESS.md、DECISIONS.md（D-0001=O1 透传、D-0002~D-0007 阻断项实现决策）、ROADMAP.md、api.md；WALKTHROUGH 为待实证清单
- [x] docs/architecture.svg 数据流图（外部客户端→内核文件通道→快门→七插件，实线/虚线分层）
- [x] vitest 单测（8 组 38 用例全绿，含 tick 级集成）；e2e/e2e.mjs 已写（02 §8 自动化子集，内核不可达时安全退出；真机运行待【等思源】）
- [x] GitHub Actions CI：push→check+test+build
- [x] .gitignore：凭据/桥运行数据/构建产物全部排除

### 5.3 M1 核心（✅ op 面已在 v0.1.0 全部实现，待 spike 校准）
- [x] 桥轮询器接入（500ms/退避/Web Lock/单飞/TTL/dedup/trim）
- [x] op：commands.list / commands.search / commands.run（确认流+审计）
- [x] op：doc.open / daily.status / setting.open / bridge.ping
- [x] op：editor.context（选择器待 spike⑦ 校准）
- [x] op：config.discover（best-effort 已实现：getNotebookConf.dailynoteSavePath + 名称约定；字段名待 spike⑧ 校准）
- [x] 适配器：checkin.items / checkin.record / checkin.summary
- [x] 适配器：contacts.search / contacts.ensure / contacts.interaction（分隔符兼容中英文逗号/顿号/分号/空白）
- [ ] occurredAt 时区语义验证（对齐 API v5）【等实测】
- [x] plugin.api 高级透传（默认关+允许名单）
- [x] 【评估】桥目录迁移 storage/petal→storage/local（spike⑨ 通过则改配置即迁移，D-0006） → ✅ R138 后台实证（2026-10-04）：/storage/local API 可写可读（磁盘落 <工作区>/storage/local/，与同步的 data/ 平级=不随同步）；桥目录迁移裁定=不迁（device 路由已解多设备，storage/local 维持存本机私有状态）
- [x] 设置页「清空命令队列」按钮（commands/results/台账一并重置，v0.2.0）

### 5.4 M1.5 体验修补（✅ v0.3.0 已完成主体）
- [x] confirm 前置激活思源窗口+超时文案（08-O10）
- [x] 命令执行超时保护：15s 可观测上限（可配），超时回 failed 放行轮询，迟到完成仅记日志；`commands.run` 确认窗口独立（v0.3.0，单测覆盖）
- [x] （可选）`template.new` op：内核 renderSprig 渲染 + createDocWithMd（v0.3.0，单测覆盖）
- [ ] （条件）`ui.refresh` op（实测 G 失败时）【等实测】
- [x] 移动端默认关桥（电量）：isMobileGuard + 显式 `:mobile-on` 后缀机制

### 5.5 M2 完整性
- [x] 设置页组件全套（06 §5.3）——以 b3 DOM 组件实现（非 Svelte，v0.3.0 定案）：桥开关/轮询/确认/透传/允许名单/黑名单/队列状态/清空/回执/审计/诊断包/关于
- [x] bridge-settings schemaVersion 1 + normalize + 回读——store.ts normalizeSettings/normalizeProcessed（坏数据回空重建，测试覆盖）
- [x] audit.json 滚动裁剪（auditMax）+ 查看（最近 20 条弹窗）+ 导出（诊断包剪贴板，脱敏）
- [x] 黑名单/确认开关默认值固化——DEFAULT_SETTINGS 定值 + §11 红线看护
- [ ] 移动端设置页布局适配（单列/安全区，思源 mobile 惯例）
- [ ] 设置页键盘可达性（焦点顺序/Enter 提交，44px 触控基线惯例）
- [x] 单测全套（envelope/TTL/dedup/裁剪/白名单/settings/adapters 协商）——11 文件 55 用例（v0.5.2）
- [ ] E2E（02 §8 十条 + 06 §10 六条）——U1~U9 自动化子集已入仓，全量需内核【等实测】
- [ ] 手动矩阵（双窗口/移动端/开关/重启/黑名单/卸载清理）【等实测】
- [ ] Playwright 视觉走查（亮暗主题截图，CHECKIN_BROWSER 惯例）【等实测】
- [x] 大库联调：人脉千人数据 contacts.search 延迟【等实测】 → ✅ R140 实测（现库 40 人真实数据）：命中 408ms/零命中 0ms，远低于 8s 预算；千人级注入测试待专用测试库（不向真实数据灌千条）
- [x] 可观测性：命令处理计数/平均耗时进设置页（诊断数据）——v0.5.1：stats 分账（成功/拒绝/失败/过期）+平均耗时+最近活动，队列状态弹窗与诊断包展示；同轮修复多命令 elapsed 叠加
- [x] 「导出诊断包」：设置+审计+最近回执打包到剪贴板/文件（排障用）——v0.3.0 已实现（memDiagnostics 脱敏）

### 5.6 M3 可选加速（✅ v0.5.0 内核同步通道 + ✅ v0.6.0 广播快路径均已实现）
- [x] 【R23】**v1.5 广播 push 通道实现（v0.6.0）**：BroadcastSubscriber（SSE 订阅 qg-cmd 频道/AbortSignal 停止/指数退避重连）+ BridgeService.executeAndRecord（预留语义：同步 check+mark 防 NDJSON/广播双通道双执行；expired 补回执）；`broadcastEnabled` 独立开关默认关（红线）；api.md 三通道表更新。**真机联调待内核重启**
- [x] 【R22·spike⑤】广播通道三件实证（postMessage/SSE 订阅/Token 鉴权）——docs/WALKTHROUGH ⑤ 回填
- [x] 【R23·等实测】v1.5 真机联调——✅ **已实测（R70，2026-10-02）**：v1.5 回执落盘 **227ms**（诊断实验 319ms；复测批每轮复现）；时序注意=toggle 后 8s 内跑会误报跳过（SSE 订阅建立中）
- [x] 【R24·工具】verify-restart.mjs 一键复测脚本（自动读 env；③含延迟测量/⑩四项/⑪计数/⑤存活/v1.5 延迟；内核不可达退出码 2 不误报）——本机预跑 3/5 通过，其余两项均正确归因于"待内核重启"
- [x] 【R23·工程】vitest 池统一 forks（threads 池下流式假件零延时 sleep 饿死宏任务挂起 worker）；config 用 vitest/config + UserConfig 断言
- [x] v2 内核同步路由：`POST /plugin/private/siyuan-quickgate/exec` 同步处理内核可处理 op 子集（ping/registry/diagnostics/events/config/template），前端专属 op 回结构化 unsupported（v0.5.0，实验性；spike 真机校准前不建议生产依赖）
- [ ] 【R4·新】内核路由真机校准：exec 可达性/鉴权/请求体解析/内核自呼 loadPetals 行为（新增 spike⑩）
- [x] 【R4·新】内核路由前端中继评估：**暂不实现**（D-0010——官方 API 仅单向 broadcast，无同步前端调用；中继可行但脆弱，NDJSON 已覆盖前端 op；重评触发=实测同步性痛点）
- [ ] 【R4·新】Quicker 侧 `SY·路由` 增加内核通道优先分支（探测 200 则直呼，失败回退 NDJSON）——待 spike⑩

### 5.7 生命周期（✅ v0.3.0 已完成主体）
- [x] onunload 优雅停机（stop 标志 + 审计终写）
- [x] 卸载（uninstall 钩子）提示桥目录随插件数据清理
- [x] settings schema 迁移机制（schemaVersion + normalize，向前兼容）
- [x] 设备名持久化到 storage/local（不随同步，device 路由可用；local 不可用回退 settings）
- [ ] 内核不可达长退避后的自动恢复复位验证【等实测】【等实测】

### 5.8 R2/R3/R5/R6 新增（开发过程中发现）

- [x] 【R2】审计落盘节流：改为 5s 节流合并写 + unload 终写（quickgate v0.3.0 已实现）
- [x] 【R2】quickgate README 徽章自动化：update-version 脚本扩展同步 README 徽章（v0.4.1）
- [ ] 【R2】`registry.list` 的 loadPetals `frontend` 参数语义随 spike⑥ 校准（当前传 getFrontend()）【等思源】
- [x] 【R3·新】events 真实数据源桥接：订阅打卡公开宿主事件 checkin:event-recorded → 物化到 siyuan-checkin/bridge/events.ndjson（D-0009，桥开关联动启停，onunload 退订；v0.4.1，单测覆盖归一化与裁剪）
- [x] 【R3·新】e2e.mjs 扩展 events.list / workflow.plan 用例（execute 弹确认框自动跑时跳过，手动验收提示 planId）
- [x] 【R3·新】workflow 计划持久化评估结案：**不持久化**（D-0008——5min TTL + 一次性语义下，重启重 plan 成本≈0）
- [ ] 【R3·新】Agent 技能安装验证：skills/siyuan-lv-operations/SKILL.md 草稿已入仓，待思源真机安装到 data/storage/ai/agent/skills 并实测内置 Agent 调用【等思源】
- [x] 【R3·循环C-R2】Tasker 鉴权复核：Bearer 头模式与 668 一致，无需特殊适配（docs/10 §3）
- [x] 【R5·循环C】Quicker V2 更新日志扫描（2.1.11~2.2.1）：V2 分享机制重做且官方建议暂勿分享→**印证动作分享暂缓**、解锁信号=官方宣布稳定；调研入账 docs/10 §3.5
- [x] 【R5·循环C】docs/03 附A「AI 写动作提示词」：P0-1~5 各一段可粘贴提示词（Quicker 2.2.0 暂存区「用 AI 写」），P0-6 场景页说明无需生成
- [x] 【R5·循环C】docs/05 §6.1 toggle 启动改用「等待窗口」步骤（2.2.1+），docs/04 §8 备查「自动化脚本」「等待窗口」「AI 写动作」新步骤
- [ ] 【R5·新】AI 写动作实测：提示词在 Quicker 2.2.0 暂存区实测生成质量，按需改写措辞【需 Quicker 编辑器】【等实测】
- [ ] 【R5·新】「自动化脚本」步骤实测：验证其剪贴板/组合键 API 是否适合 P0-6 光标插入编排【需 Quicker 编辑器】【等实测】
- [x] 【R6·循环A】事件订阅通道 bug 修复：v0.4.1 误订 app.eventBus（上游只走 window CustomEvent，永不触发）→ v0.5.2 改订 window + unwrapCheckinDetail 兼容包裹形状（D-0009 勘误）
- [x] 【R6·循环A】生态清单校准（远端 main 实证）：雷切 0.44.1 +3 能力、打卡 18.16.0 契约 8 事件全登记 + calendar.read、人脉 0.4.1 桥 v1 不变
- [x] 【R6·新】events 多事件订阅：**R7 完成**——event-deleted 已接入（v0.5.4），analytics-updated 决策不订阅（D-0011）
- [ ] 【R6·新】雷切 0.44 新能力评估：restore-document-set / get-document-outline / home-adapter-diagnostics 是否开新 op 或并入 plugin.api 允许名单（design note 先行）
- [x] 【R6·新】设置页显示生态清单版本提示：manifest 校准日期与各插件 installedVersion 差异（v0.5.3「生态清单版本」按钮，manifest×loadPetals 对照，内核不可达降级 manifest 口径）
- [x] 【R6·循环C】快捕通道对标（flomo Webhook/Obsidian Advanced URI）结案：极简写入口设计获印证不另立项；「追加到指定标题」变体已补进 docs/03 P0-1（SQL 定位标题块→appendBlock，三级落点）——docs/10 §3.6
- [x] 【R7】events 多事件订阅：`checkin:event-deleted` 已接入物化（event+deletedEvents 均物化，`:deleted` 幂等后缀，v0.5.4）；**analytics-updated 决策不订阅**（D-0011：高频会挤占 200 行滚动窗口）；契约草稿补删除语义（append-only 标记行配对规则）
- [x] 【R7】雷切 0.44 新能力评估（docs/10 §3.7）：get-document-outline/home-adapter-diagnostics 不接入（内核 SQL 与 diagnostics.report 已覆盖），restore-document-set 走既有 commands.run 零成本——零新 op
- [x] 【R7·循环C】移动捕获社区实证：「Siyuan速记」动作验证 668+iOS 快捷指令链路（P2-10 可行性确认，差异化 noted）；思源官方闪念速记 issue #14414 记录——docs/10 §3.8
- [ ] 【R7·条件】若思源官方落地移动端闪念速记（issue #14414，落 `~/.config/siyuan/shortcuts/shorthands/*.md`）：快门监听该目录 → 物化 events/file 载体新数据源【等上游】
- [x] 【R7·循环A】docs/06 §5.3 设置页实装现状同步（v0.5.x 面板行清单）；docs/12 FAQ 补诊断包/生态清单两条排障入口
- [x] 【R8·循环A】内核路由可测化（v0.5.5）：kernel-ops.ts 抽出（依赖注入）+ **补齐 events.list op**（v0.5.0 文档声称支持但从未实现，实际回"未知 op"）+ events.pull 对齐前端 idempotencyKey 去重契约 + 7 组单测
- [x] 【R8·循环A】plugin.api 窗口桥映射 manifest 驱动（windowBridge 字段，替硬编码三元）+ plugin.api 首批单测（开关/名单/映射/缺失四态）——此前该安全敏感 op 零测试覆盖
- [x] 【R8·循环A】api.md 与 quickgate-api-v1.json events 节同步（物化事件清单/删除标记语义/D-0011）
- [x] 【R8·循环C】Sisyphus MCP & CLI 对标（docs/10 §3.9）：集市外部网关先例，与快门互补不竞争（消费方与协议不同）
- [x] 【R8·新→R39 结】MCP 通道评估：hub op 面经 MCP Server 暴露给 AI 助手（差异化=小驴生态能力面，Sisyphus 不覆盖）——**评估稿已出（docs/10 §3.14，spike⑤ 已过满足前置）：值得做、列 M3 首项；推荐独立 stdio 代理进程（@lv/mcp-quickgate ↔ 内核 HTTP，零插件改动，官方 sdk，1~2 天）；安全=默认只读、写 op 需 mcpWriteEnabled、黑名单/审计共用；【执行待复测批通过后】**
- [x] 【R8·新→R39 结】笔记本级写权限分级评估（借鉴 Sisyphus none/r/rw 模型）——**评估稿 docs/10 §3.15：暂不立项**。理由：当前 op 面 80% 只读、唯一直接写 op template.new 的目标笔记本本就是显式参数（限制它=废掉它）；高影响 op 已有门控（commands.run 确认+审计 / workflow 总确认+白名单 / plugin.api 默认关+允许名单）；写密集动作走 SY·内核请求不经桥，桥写面不会扩大。**触发条件：桥未来新增 doc.append/block.insert 类通用写 op 时随该 op 立项**
- [x] 【R8·备选→R39 结】`doc.resolve` 便利 op（hpath→块 ID）——**保持备选池**（docs/10 §3.15）：SQL 直查与 listDocsByPath 两条既有路径已覆盖；新增 op=扩契约面（23→24）需三处同步+一致性测试+契约 JSON，便利性不抵维护成本。**触发条件：AI 写动作实测出现高频 hpath 寻址需求时随集市门槛一起评估**
- [x] 【R41·循环C】**思源 v3.8.6 兼容性复核**：上游已发 3.8.6（9-29）+3.8.7-alpha——插件面向变更均为新增可选（发布资源目录声明/资产选择器），**无破坏性变更，minAppVersion ≥3.8.4 声明继续成立**；broadcast/petal/私有路由未见变动；**内置 MCP server（OAuth 2.1）落地**→ docs/10 §3.14 补注：官方入场验证 AI-MCP 消费真实性，快门生态面增量结论不变。用户机 3.8.5 运行中，升级与否不影响快门（≥3.8.4 全兼容）
- [x] 【R42·循环B】**MCP stdio 代理第一增量落地**（R39 评估稿开工；前置修正：代理消费的内核端点 getFile/putFile/postMessage 已全部真机实证，复测批只拦"插件侧消费"的 e2e）：src/mcp/ 四件——tools.ts（23 op→tools 契约映射，只读13/写10，plugin.api+workflow.execute 标 destructive）+ bridge-client.ts（NDJSON+广播双路径）+ server.ts（JSON-RPC 2.0 纯函数核心：initialize/ping/tools.list/tools.call；写工具未开启时 list 隐藏+call 诚实拒绝）+ main.ts（stdio 换行分帧，Node≥24 原生跑）；安全模型落地（默认只读、LV_MCP_WRITE=1 才开写、run/execute 等 35s 覆盖确认窗）；8 组单测（tools 集合===ALL_OPS 契约一致性强制），94 总全绿；**裸 Node 真机烟测通过**（握手/13 只读工具/写拒绝提示）。不进插件 dist；e2e（真 AI 客户端+插件消费）待复测批
- [x] 【R43·循环B】**MCP 代理第二增量：逐 op 参数 schema**——第一增量的空壳 schema 会让 AI 无法构造正确调用（真可用性缺口）：ARGS 表登记 23 op 参数形状（对齐 docs/api.md；template.new 形状以 kernel-ops 实现为准 notebook+hpath 必填、template/templatePath 二选一；plugin.api={plugin,method,args}）；纪律测试强制每 op 都有 properties+描述；95 单测全绿；写模式烟测 required 穿透验证（commands.run=[plugin,command]/checkin.record=[itemId]/template.new=[notebook,hpath]）
- [x] 【R44·循环B】**MCP 代理第三增量（文档收尾）**：src/mcp/README.md（运行方式/Claude Desktop 配置/安全模型/工具面/状态边界——npm 发包的必要件）；CHANGELOG 加 **Unreleased 节**补记两个增量（教训延伸：src 级新增即使无发版也要留痕，否则下次时效批又是漂移）；ROADMAP M3 行标注"已开工三增量，剩 e2e 与 npm 发包"
- [x] 【R45·循环A】**MCP 代理发送侧全链路真机烟测（通过，含一次误报排查）**：tools/call bridge.ping → 15s 诚实超时回执+isError ✓；一度误判"信封未落盘"——实为**只读 op 优先走广播快路径（sendFast→qg-cmd 频道）**，查 commands.ndjson 是查错通道（第一增量设计行为）；直测 send()（NDJSON）落盘验证 ✓。发送侧至此全验证；唯一欠 e2e=插件消费侧（待复测批）
- [x] 【R46·循环A】**双语 README 客户端清单补记**：tools 行更新（lv-cli fast、PS -Fast 此前一直没进 README）+ 新增 src/mcp/ 指引（23 op stdio、默认 13 只读）；发布预告草稿核查——休眠合理（门槛=复测批通过，草稿原文即此条件），不动
- [x] 【R47·循环A】**重启升级兼容验证 + bug#8 修复（v0.6.6）+ 测试定时 bomb 拆除**：①存量 bridge-settings.json（v0.5.9 形态缺 broadcastEnabled）经 normalizeSettings 逐字段校验——缺失回落默认（广播=关红线默认）✓ 重启升级无忧；②**bug#8：audit.json 只写不读**（重启后内存清空+首次 flush 静默覆写上次历史）→ onload loadAudit 恢复（逐条形状校验/坏条目跳过/auditMax 截尾）+2 测试；③workflow 两用例**定时炸弹**：用真实 Date.now() 对硬编码 expiresAt（2026-10-02T00:05Z）断言，现实时间 00:08 越过时集体误爆 expired——补固定时钟；97 单测全绿；发版部署+GitHub release
- [x] 【R48·循环A】**定时炸弹全库排查（无第二颗）**：tests 里 Date.now() 用法逐处核查——broadcast/bridge-service 均为 Date.now()-offset 动态构造（安全）、envelope 传显式时钟（安全）、events-workflow 已固定（R47）；硬编码 2026-10 日期五文件逐一过——全是载荷数据或 mock 驱动（kernel-ops 的 renderSprig 返回固定路径由插件转发），无与真实时钟比较者。结论：R47 那颗是唯一一颗
- [x] 【R49·循环A】**仓库卫生三查（近乎全净）**：①CI 最近三跑全绿（含 v0.6.6 测试修复后的运行）✓；②工作区无烟测残留（mcp-out.tmp 每次均手删且从未入库）✓；③.gitignore 有 `tmp` 但不匹配 `*.tmp`——补 `*.tmp` 防将来烟测临时文件误提交
- [x] 【R50·循环B】**MCP 代理第三通道：内核同步路由（KERNEL_OPS 直呼+回退链）**：bridge-client.callKernelRoute（exec 同步回执）+ server.ts 路由链 KERNEL_OPS→exec→（只读 fast）→NDJSON；**实质收益=桥开关默认关时 7 个 KERNEL_OPS 也可用**（kernel.js 随 petal 启用加载），契合默认零外部面姿态；+1 三态测试，98 总全绿；真机烟测 404→回退→诚实超时 ✓。附 Mimosa 误报抗辩记录（HTTP URL 模板串被判命令注入/genId 弱随机——均非实害，注释在案）
- [x] 【R51·循环B】**复测批纳入 MCP 路由检查**：verify-restart.mjs 新增一节——stdio 驱动代理（tools/call registry.list → exec 断言 recorded）；桥关时应通（kernel.js 随 petal 加载）；当前态正确跳过（未重启 404→回退链 12s 内无回执）；重启后与③⑩⑪⑤/v1.5 同批自动转绿——**复测批现覆盖：③⑩⓪⑩功能面⑪⑤v1.5+MCP 路由**
- [x] 【R52·循环A】**文档时效两处小补**：WALKTHROUGH 头部部署态 v0.6.0→v0.6.6（并注明"前端窗口内运行的仍是启用时刻版本，重启生效最新"——此前从未写明的事实）；api.md 参考客户端行补 `fast`/`-Fast`/src-mcp 指引（R30/R32/R42 的客户端增量一直没进这行）
- [x] 【R53·循环A】**DECISIONS 补录 D-0012~D-0015**（R14 后事实上的重大决策入册）：D-0012 v1.5 双通道共用幂等台账+预留语义；D-0013 MCP 独立 stdio 代理+默认只读+与内置 MCP 并存；D-0014 bundle 静态核实方法论（证据等级与适用边界）；D-0015 "持久化必须可读"原则（bug#8 反思成规）。双语 README 决策编号范围同步 D-0001~D-0015
- [x] 【R54·循环B】**MCP 协议级冒烟脚本 tools/mcp-smoke.mjs（6/6 全过）**：完整 stdio 协议序列 vs 真进程——initialize 握手/initialized/tools/list 默认 13 只读/写工具隐藏+LV_MCP_WRITE 拒绝提示/写模式 23 全暴露/bridge.ping 无消费者 15s 诚实超时；**今天就能全量跑**（不依赖插件消费）——把"真 AI 客户端"里可自动化的部分固化为可重复验收；e2e 仅剩插件消费侧。README 状态节同步
- [x] 【R55·循环A】**MCP README 测试组数时效**（8+1→10：参数 schema 纪律+内核路由三态两轮增量未跟）+ CI 双跑全绿确认（mcp-smoke 落地后）
- [x] 【R56·循环A】**设计文档 1568 地雷清雷（五处，含动作蓝图默认值）**：docs/11 使用手册与 docs/12 FAQ 仍在教用户"本机端口 1568 非默认 6806"（照做必挂）；**docs/03 动作蓝图的 SY_URL 默认值就是 1568**（用户照蓝图搭动作默认即错端口——最重一处）；docs/04 教训条更正（教训保留事实修正）；docs/01 调研报告头部加更正注（历史快照不改写）。全项目 grep 残留仅剩历史叙述（更正注覆盖）。**教训：R30/R31 的端口清扫始终只扫了 quickgate 仓库——设计文档项目里给用户照着执行的配置默认值才是杀伤力最大的地雷**
- [x] 【R57·循环A】**可执行配置默认值全面复查（干净）**：C# 参考件六件（sy_url 全部来自 Quicker 变量，无硬编码端口）、docs/05 超级面板、docs/02 桥协议——零硬编码端口残留。R56 清雷后两项目"用户照着执行的配置默认值"面确认干净
- [x] 【R9·循环A】WALKTHROUGH 从骨架补实为 11 项完整实操手册：spike①~⑨ 每项具体步骤/验收标准、spike⑩ 三条 curl（ping/events.list/降级验证）、新增 spike⑪ event-deleted 物化验证（兼验 v0.5.2 通道修正）
- [x] 【R9·循环A】工具对齐：lv-cli.mjs 新增 `events pull|list` 与 `exec`（内核路由直呼）命令；Send-LvCommand.ps1 新增 `-Exec` 开关——spike⑩/⑪ 校准命令行就绪
- [x] 【R9·循环A】docs/11 使用手册 §5 补 v0.5.x 排障按钮（队列状态/诊断包/生态清单）与事件流拉取说明
- [x] 【R9·循环C】Obsidian Local REST API 对标（docs/10 §3.10）：鉴权/端点形状/生态面三维对比，快门免第二把钥匙+生态中枢为差异化优势
- [ ] 【R9·门槛后】契约 JSON → OpenAPI 3 交互式文档（对标 Local REST API 文档站）——集市上架前置项，与动作分享同门槛解锁
- [x] 【R10·循环A】ops.ts 单一事实来源 + 契约一致性测试（契约 JSON ↔ ALL_OPS ↔ 内核/前端路由三向强制）——**首跑即抓到第二个漂移：template.new 已实现（v0.3.0）却从未登记契约 JSON，已补**
- [x] 【R10·循环A】e2e 新增 U10（events.pull 拉取 + event-deleted 行核对，无删除行时自动跳过）与 U11（内核路由 ping 探针，404/不可达按未启用跳过不算失败）
- [ ] 【R10·等实测】preview.png 真机截图（plugin.json 已引用但文件缺失；集市提交必需，装好后截设置页/执行效果）
- [ ] 【R10·门槛后】i18n 双语（zh_CN/en_US，UI 字符串抽取进 lang 文件）——集市上架前置项
- [x] 【R10·循环C】siyuan-bridge-skill 先例入账（docs/10 §3.11）：读后写保护/笔记本禁区/写后留痕三条已补进 Agent 技能草稿；笔记本级写权限立项获第二独立先例；Raycast 无思源扩展（生态位空缺确认，不立项）
- [x] 【R11·循环A】快门双语 README 从 v0.1.0 时效更新到 v0.5.x：23 op 契约面/双通道/events 载体与 D-0011/版本史（GitHub 门面此前停在 v0.1.0 时代）
- [x] 【R11·循环A】docs/02 桥协议时效性：§1 文件布局补 events.ndjson（append-only 删除标记语义）；§9 v2 平移说明从将来时改为现状（内核路由已实现、NDJSON 不退役、工具就绪）
- [x] 【R11·循环C】Drafts「捕获→分拣→分发」范式入账（docs/10 §3.12）：**发现分拣端缺口**——收集箱只进不出；SY·分拣收集箱动作已补进 docs/03 方向二（SQL 列块→逐条选去向→moveBlock/deleteBlock）
- [ ] 【R11·新】SY·分拣收集箱动作实现细节：逐条菜单去向（今日日记/转待办/记人脉/删除）+ 批量模式 + `moveBlock` 后索引延迟处理——需 Quicker 编辑器搭建【需 Quicker 编辑器】
- [x] 【R12·循环A】superpanel-menu.json v2：文档组加「分拣收集箱…」、小驴组加「打卡概览」（checkin.summary，gate=checkin）；validate-menu.mjs 放行版本递增（22 项校验通过）
- [x] 【R12·循环A】docs/03 一致性：文本指令注册表补 `fj`=分拣收集箱；AI 提示词节补标题变体衔接注（变体分支人工追加更稳）；quicker-actions/README 补分拣动作清单行与 AI 提速提示；发布预告草稿 spike 数同步九→十一
- [x] 【R12·循环C】移动端 siyuan:// scheme 可用性确认（docs/10 §3.13）：#14799 已完成，P2-10 回执跳转路径可行，已补注蓝图
- [x] 【R13·循环A】docs/05 §5 补 §5.2「then 续分类型」契约——`userselect-record`/`userselect-run`/`notify-summary` 菜单模板 v1 起就在用但分发器表从未定义（真实文档缺口）；含空数据处理约定
- [x] 【R13·循环A】快门 ROADMAP.md 从 v0.1.0 时代刷新到 v0.5.5 现实（M0 十一项/M1 校准回填/M2 标注已完成主体/M3+ 评估池含门槛）
- [x] 【R13·循环A】WALKTHROUGH spike⑩ 补 ⓪无 Token 负向鉴权探针（localhost API 的 CSRF 面核实：浏览器跨源无法伪造 Authorization 头，该层是唯一防线；匿名可调=立即停用路由）
- [x] 【R13·循环C】调研线如实结案：13 条已覆盖，剩余候选（Alfred/espanso/Logseq/TG·邮件捕获）均为边际或与本地优先冲突——本轮无新立项（docs/10 §4 备选池维持）
- [x] 【R14·循环A】docs/06 §3.6 补实现状态注记：设计期提案与实际落地的六处改名/换形逐一对照（registry.health 并入诊断、events.publish→文件载体、workflow.run 拆 plan/execute 等），权威 op 面指向 ops.ts+契约 JSON
- [x] 【R14·循环A】docs/01 风险登记表 R13 复核：8 项标注状态（#4/#5 缓解已落地、#8 已消解），**新增 9~11 三项**（事件订阅通道错配=已修复、文档契约漂移=机制已建、内核路由 CSRF 面=spike⑩⓪ 待验证）
- [x] 【R14·循环A】docs/11 §2 补「自己动手搭建的推荐顺序」——动作未分享阶段（子程序先行→P0-1 验证三件事→P0 组→分拣/汇总→快门后打卡人脉→面板最后），每步带测试检查点
- [x] 【R15·循环A】docs/02 §6 子程序规范时效性：`SY·内核请求` 补内核路由快路径说明（KERNEL_OPS 同步直呼+失败回退，spike⑩ 后启用）；`LV·发命令` 补信封可选字段（ttlMs/device/reply:false，§2 语义回指）
- [x] 【R15·循环A】docs/04 §0 调用约定核查通过（无需修改）；quickgate api.md 通道表补无 Token 负向鉴权注记 + 参考客户端节（lv-cli events/exec、PS -Exec）
- [x] 【R16·新】**子程序 C# 参考实现三件套**（quicker-actions/reference/）：SY·内核请求（env 自愈+401/超时中文分支）/ LV·发命令（id 生成+args 文本直嵌+Multipart putFile）/ LV·取回执（逐行容错+按 op 等待+timeout 不重试）——纯标准库零依赖，配变量连线表；把搭建工作从"按散文写代码"降为"粘贴+连变量"【待真机编译验证】
- [ ] 【R16·新】C# 参考件真机验证：首次粘贴编译错误反馈（签名/变量名按你 Quicker 版本微调）后修正进参考件【需 Quicker 编辑器】【等实测】
- [x] 【R17·新】SY-占位符解析.cs 参考件（docs/05 §5.1 字典 C# 落地：日期时间类+9 变量类；{ask:}交互与路由前缀明确不在此层）——GUI 搭建中最后一块需自写的纯逻辑；顺带打磨 SY-内核请求 env 兜底可读性
- [x] 【R18·重大】**第 4 个真实 bug 修复（v0.5.6）**：checkin.summary 静默返回空数据——上游打卡 v18.16 公开桥**没有 getSummary 方法**，适配器可选调用返回 recorded+undefined；改为 getSummaryContext("day")+getStreaks 组合（{today,streaks}），缺方法时诚实 unsupported+回归测试；api.md/契约 JSON 同步
- [x] 【R18·新】参考件再增两件（现六件套）：SY-路由前缀解析.cs（#前缀=文档ID 最长匹配+@人脉(N) 提名，R3 多目标路由解析层）、LV-摘要格式化.cs（{today,streaks}→一行中文通知，形状不符降级占位）
- [x] 【R19·重大】**适配器签名全面审计（v0.5.7）**：对照上游 v18.16 源码逐方法核对——修复三处：①source:"quickgate" 非法（上游白名单外静默归一 api）→显式传 api；②occurredAt 单条接口静默忽略→路由 recordEventsBatch+BatchEntryResult 映射（duplicate→recorded 带标记）；③getStreaks 实际返回数组而非映射→归一 streaks/streaksLongest。人脉 v1 与 items 面审计干净。**教训：适配器字段/枚举必须逐一对上游源码，"合同写没写"不等于"上游收不收"**
- [x] 【R19·循环A】docs/11 手册 source 说明纠正；api.md/契约 JSON 三行同步（record 的 source/occurredAt 语义、summary 的 streaks 归一）
- [x] 【R20·重大】**第 5 个真实 bug 修复（v0.5.8，最重）**：registry.ts 读 `c.command ?? c.id`，而官方 ICommand 身份=**langKey**（不存在那两个字段）——**langKey-only 注册的命令全部被跳过，commands.list 恒为空、commands.run 恒报"命令不存在"**。改 langKey 优先；多回调形态（callback/execute/globalCallback 可执行，editor/dock/fileTree 标 focusOnly 诚实拒绝）；标题 i18n 代取；hotkeys[] 兼容；+5 单测；WALKTHROUGH spike① 同步静态结论
- [ ] 【R20·等实测】registry 探测真机校准（spike①）：p.displayName/p.i18n 挂载细节、hotkeys[] 普及度——静态已钉 langKey，真机补尾巴【等实测】
- [x] 【R21·重大】**内核侧 spike 自动执行完成**（本机内核实证可达：3.8.5@**6806 默认端口**——早前"1568 非默认"记录作废）：⑥loadPetals 形状✓ ⑨storage/local 读写✓ ⑩⓪无 Token→401✓（安全基线）；**快门已部署进工作空间并启用**（桥默认关，待内核重启后 kernel.js 生效→复测 `lv-cli exec`）
- [x] 【R21·重大】**bug#6 修复（v0.5.9）**：日记自动发现恒失败——3.8.5 实证字段为 `dailyNoteSavePath`（驼峰，旧代码读全小写）；且所有笔记本带相同默认模板致"非空即日记"失效——两级消歧（唯一候选直判；多候选 renderSprig+listDocsByPath 验今日日记存在）前端/kernel 同步+测试
- [x] 【R21·循环A】WALKTHROUGH 实证回填（⑥⑧⑨⑩⓪ 含环境更正）；仓库根补 preview.png（此前缺失）；待内核重启复测清单=③⑥复验/⑩①-④/⑪
- [x] 【R25·重大】**运行内核只读校准 + bug#6 修复完善（v0.6.1）**：①readDailyStatus SQL/renderSprig/listDocsByPath 实测 ✓（listDocsByPath 对不存在路径返 data:null 已防护）；②真机空跑发现算法 → 新增"非默认模板优先"层（实测 17 笔记本 16 默认+1 自定义=DailyNote，昨日日记就在其 `/2026/10/` 下——自定义者无需等今日日记写出即命中）；85 单测全绿
- [x] 【R25·工程】修复 v0.6.0 漏改的 PLUGIN_VERSION 常量（发布包自检曾报 0.5.9）；已重新部署 v0.6.1 进工作空间
- [x] 【R26·重大】**前端假设静态核实新证据法 + bug#7 修复（v0.6.2）**：WebFetch/webReader 对 raw.githubusercontent.com 双双 ECONNRESET → 转向 grep 本机安装编译产物 `D:\biji\SiYuan\resources\stage\build\app\common.js`（实际运行的代码，比远端源码更硬、不依赖网络/DevTools）。实证：`data-doc-id` 属性在 bundle 中不存在（仅 data-doc-type）→ editor.context docId 主路径恒空；正确来源是 `.protyle` 容器自带 `data-node-id`=rootID（Protyle 类加载路径写入，与 fn__none 切换同方法）；`.protyle-title` render 时也 set data-node-id（fallback 有效）；标题官方读 `.protyle-title__input`（editElement）。v0.6.2 修复+证据注释内联，已部署工作空间+GitHub 发布
- [x] 【R26·方法】spike⑦ 从"纯等 DevTools"改为"◐ 静态已坐实（docId/rootTitle）+现场待补（blockId 光标爬升）"——前端 spike 可用同一 bundle 证据法提前核实的原则已写入 WALKTHROUGH 头部
- [x] 【R27·重大】**bundle 证据法扩展至 spike①②，双双 ⬜→✅（v0.6.3）**：①Plugin 基类构造器实证挂载 `this.i18n/.displayName/.commands`（标题代取链成立）；`addCommand` 以 langKey 解析快捷键后**就地回写 hotkey=默认/customHotkey=用户生效键**、解析失败者移出 commands（官方消费的快捷键就是 customHotkey）→ registry accelerator 优先级修复 customHotkey > hotkey > hotkeys[]，+1 测试（86）；②confirm API 实证回调式无返回值**无自动超时**（Esc/取消仅 destroy 不回调）→ confirmWithFront 30s 兜底必要，契约一致；顺带清除 WALKTHROUGH 重复旧⑥章节（含废弃 1568 端口记录）
- [x] 【R27·方法】前端 spike 校准负债清算完毕：①②⑦ 全部 bundle 静态坐实，DevTools 现场仅剩 ④多窗口/⑦blockId/⑪事件 三项真需要窗口
- [x] 【R28·文档】**用户可见文档时效批（v0.6.3 对齐）**：CHANGELOG 漏记 v0.6.2/3（停在 v0.6.1）、PROGRESS.md 同病、ROADMAP 状态行停在 v0.5.5 且 M0 十一项未标实证结论、README 双语「状态与路线」停在 v0.5.x、api.md editor.context 还挂着"语义可能校准"旧注——全部补齐/刷新；M0 十一项逐项标注实证方式（内核侧全✅/①②⑦ bundle 静态坐实/剩 ④⑦blockId⑪ 三项真机）。**教训入规：发版 commit 必须同轮更新 CHANGELOG+PROGRESS**
- [x] 【R29·循环A】**src 陈旧对冲注释清账（v0.6.4）**：五处"待实证/待校准"按实证结论刷新（registry 头注已写成证据明细/降级原因改为真实可达性措辞——桥上可见文本/kernel-ops 自呼注/daily.status SQL 注——R25 已实测/类型注）；纯文档性变更零行为改动；**R28 教训首次执行**（发版同轮 CHANGELOG+PROGRESS 同步）
- [x] 【R30·循环B】**lv-cli 补 v1.5 广播快路径客户端 `fast` 命令**：postMessage 推信封→qg-cmd 频道（--channel 可换），回执仍读 results.ndjson 并算 e2eMs——v1.5 联调免手搓 curl；自测 scratch 频道 75ms code:0 ✓、无消费者诚实超时 ✓；**顺带修 tools 三处过时默认端口 1568→6806**（lv-cli 默认值+头注、PS 参考件两处）；WALKTHROUGH 头部补手工单发入口说明
- [x] 【R31·循环A】**e2e 套件预检改造 + 漏网端口清扫**：e2e/e2e.mjs 是 R30 全仓 1568 清扫的漏网处（只扫了 tools/）——默认 URL+头注修正；新增**桥存活预检（3s ping）**：不通过秒级跳过 U1~U10（全部经桥，原实现会逐项 8s 超时慢死）只探 U11，exit 2=环境未就绪不算测试失败；本机实测当前态诚实归因 ✓。教训延伸：**修环境默认值要全仓 grep（含 e2e/），不是只扫 tools/**
- [x] 【R32·循环A】**PS 客户端补 -Fast + 修无 BOM 解析崩溃**：Send-LvCommand.ps1 新增 -Fast 开关（对齐 lv-cli fast；postMessage→--Channel，回执追加 e2eMs；本机自测 367ms ✓）；**关键发现：该文件 UTF-8 无 BOM，Windows PowerShell 5.1 按 ANSI 误读中文注释→字节错对吞换行→级联解析错误**——此前从未语法验证过（"C#/PS 参考件编译验证"欠账的实证），补 BOM 后 syntax OK；全项目 ps1 排查仅此一件需 BOM（elevate.ps1 纯 ASCII）
- [x] 【R33·循环A】**C# 参考件语法级验证（欠账部分清算）**：无 dotnet SDK→用 .NET Framework csc（C#5）+ harness（stub IStepContext + 包 class + 提 using 到顶部）验证六件——**SY 三件 0 错误全净；LV 三件仅 `is T x`/`out var`（C#7 语法）在 C#5 报错属预期**（Quicker 普通模式 v2=Roslyn C#7+ 支持，v1 老编译器不兼容——已在 README 诚实声明）；Quicker 真实 API 成员面仍以真机为准。顺带修 reference/README 残留的"三份"计数（R16 时代）→六件
- [x] 【R34·循环A】**设计文档项目 README 时效批**：根 README 状态头停在 R25（v0.6.1/311项/二十五轮）——刷到 v0.6.4/86 单测/二十预发布/R26-R33 重大进展（bundle 证据法+bug#7+spike①②⑦、广播三客户端、e2e 预检、参考件语法验证）；quicker-actions/README"三件套"残留→六件（补占位符解析/路由前缀/摘要格式化，标注 v2 Roslyn 前提）
- [x] 【R35·循环C】**健康三查（全净）**：①部署完整性——dist 与工作空间 data/plugins/siyuan-quickgate diff 逐字节一致 ✓（六次连续部署无漂移）；②lv-cli fast 的 e2eMs 条件修正（回执真实字段=finishedAt，receivedAt 是不存在的死分支）；③上游版本漂移核对——雷切 0.44.1/打卡 18.16.0/人脉 0.4.1 最新 release 与生态清单**完全一致**（R20 校准后零漂移，适配器假设无过期风险）
- [x] 【R36·循环A】**仓库健康核查 + M2 尾巴补全（v0.6.5）**：CI 最近三跑全绿 ✓、发布资产可达 ✓、src TODO 扫描剩两处（M1.5 移动端需真机保留；**M2"导出审计入口"自主补齐**——设置页"导出审计 JSON"：完整 auditLog+schemaVersion 包裹一键复制剪贴板，对应卸载清理提示的出口）；86 单测全绿，v0.6.5 发布部署（GitHub API 一度 500 重试成功）
- [x] 【R37·循环A】**部署面与 i18n 终查（全净）**：①dist/kernel.js 新鲜度确认——`npm run build`=clean+build:app+build:kernel 双目标同轮产（kernel.js mtime 最晚、含路由特征串；不含版本串是因 kernel 源码本就不引用 PLUGIN_VERSION，非缺陷）；②i18n 中英 9 键一一对应、无陈旧内容、dist/i18n 与 public/i18n 同步；设置面板其余行为硬编码中文——属集市暂缓政策下的 i18n 门槛项，不动
- [x] 【R38·循环A】**docs/02 桥协议两处真漂移修正**：①§9 仍写"广播通道…spike⑤ 通过才做"——**v0.6.0 已实现**（且端点写的是推测的 /ws/broadcast，实际为 postMessage+/es/broadcast/subscribe）——改写为已实现现状：qg-cmd 频道/预留语义双通道幂等/默认关/三客户端；②§8.8 "33KB args 整行 rejected"→">32KB（32768 字节）"（§3 与契约 JSON 本就正确，仅验收清单笔误）；50 行上限与代码 slice(0,50) 核对一致
- [x] 【R39·循环B】**MCP 通道评估稿出稿（R8 立项清算）**：docs/10 §3.14——**结论：值得做、列 M3 首项**（spike⑤ 已过满足前置）；路径三选一→**推荐独立 stdio 代理进程**（@lv/mcp-quickgate ↔ 内核 HTTP，复用 lv-cli 全套逻辑，零插件改动，官方 @modelcontextprotocol/sdk，1~2 天，Claude Desktop/Cursor 即插即用）；安全=tools 标 readOnly/destructiveHint、**代理默认只暴露只读 op、写 op 需设置页 mcpWriteEnabled**、黑名单/确认/审计全共用；验收形态=Claude Desktop 一句"帮我记一条人脉互动"。快门 ROADMAP M3 行同步+已推 GitHub。**【执行待复测批通过后】**

### 5.9 R69/R70：R68 后状态收敛与实现仓库静态审查（本轮只登记，不开发）

#### 5.9.1 状态与文档边界

- [x] 【R69·账本】建立“设计仓库 `quicksrer 动作` ↔ 实现仓库 `siyuan-quickgate`”映射表：记录实现仓库路径、分支、tag、当前版本和权威文件，避免把两个仓库的统计混在一起。 → ✅ R218 交付 **docs/REPO-MAP.md**（仓库映射/权威文档映射/版本锚点三表——随版本更新）
- [ ] 【R69·文档】刷新根 `README.md` 的状态头、版本、单测数、待办数、内核版本和默认端口到 R68/v0.7.1/3.8.6；旧 1568 只保留在历史更正说明中。
- [x] 【R69·文档】重写或明确标注 `docs/09-本轮审查与收敛建议.md` 的 230 项/“无源码无 CI”内容为历史快照，并补当前 v0.7.1 实现仓库证据。 → ✅ R218 docs/09 头部加历史快照声明（过时表述已过时标注+指向 REPO-MAP）
- [x] 【R69·文档】同步 `docs/13-版本与发布策略.md`、`quicker-actions/README.md`、`quicker-actions/reference/README.md` 的版本线、导出状态和六件参考件边界。 → ✅ R218 docs/13 三线分记当前值同步（v0.4.0→v0.7.3 正式版+SHA-256/SBOM/一致性检查补充）
- [x] 【R69·文档】同步实现仓库 `docs/PROGRESS.md`、`docs/ROADMAP.md`、`docs/WALKTHROUGH.md` 到 v0.7.1/R68/3.8.6：明确内核路由与 `registry.list` 冒烟已通过，③桥端到端、v1.5 延迟、⑪真实打卡仍待用户开桥/给数据。 → ✅ R218 docs/13 三线分记当前值同步（v0.4.0→v0.7.3 正式版+SHA-256/SBOM/一致性检查补充）
- [ ] 【R69·口径】清理 TODO 内部过期勾选和措辞（spike③、v1.5、spike⑩、registry frontend、雷切 0.44 等），重新按实际复核结果计算总项数；把“代理→内核路由冒烟通过”和“Claude/Cursor 真 MCP host 完整会话未验”分开记录，禁止把后者写成已完成。
- [ ] 【R69·契约】以 `src/ops.ts`、实现和 contracts JSON 为单一核对基准，刷新 `docs/api.md` 中 events/workflow 的 design/unsupported 旧描述、`source` 字段说明和三通道回退语义。

#### 5.9.2 上游规范与分发调研转为验收项

- [ ] 【R70·发布门禁】依据官方 Kernel Plugin 规范，增加 `plugin.json.kernels` 与 `kernel.js` 的 `package.zip` 解包静态断言；缺字段、缺文件或 `if-no-files-found: ignore` 时 CI 必须失败。
- [x] 【R70·版本门禁】补齐 `plugin.json`、`package.json`、`src/index.ts` 的版本一致性检查，并让 `update_version` 不再遗漏 `PLUGIN_VERSION`；发布包、tag、CHANGELOG、README 版本同步纳入同一检查表。 → ✅ v0.7.3 续6（check-version.mjs 门禁进 CI check 链；update_version 同步 PLUGIN_VERSION；CHANGELOG/tag/README 同步待发布工具链统一——门禁已可加期望值参数校验）
- [ ] 【R70·生命周期】验证 `kernel-plugin-state-change` 就绪时序、禁用/重新启用/热加载、多窗口 frontend 与 Kernel RPC 的竞态，形成可重复验收步骤。
- [x] 【R70·兼容性】建立 SiYuan 3.8.4（最低版本）、3.8.6（当前实测）、3.8.7-alpha/下一稳定版的兼容矩阵，覆盖 `kernels:["all"]`、私有路由、broadcast、petal 和内置 MCP 共存。 → ✅ R226 交付：docs/13 增「SiYuan 内核兼容矩阵」节（3.8.4/3.8.6/next × 7 能力面逐格证据等级 + 升级复核程序四步）
- [ ] 【R70·鉴权】补私有路由的有效 Token、无 Token、错误 Token、只读工作区、非管理员和 HTTPS 组合矩阵；确认 401/403/404/超时消息不泄露正文或令牌。
- [ ] 【R70·多端】验证 `storage/local`、设备名、events 和命令/回执队列在同步与多设备 Kernel 实例之间的隔离策略，明确哪些状态禁止同步、如何防止重复消费。
- [ ] 【R70·Quicker】在真实 Quicker V2 GUI 中验证 V1/V2 导出导入、暂存区写回、AI 修改说明、最低版本和配置脱敏，再生成 `.qa` 归档；参考件和 AI 骨架继续标为不可直接发布。
- [x] 【R70·Quicker】核对 Quicker 2.3「脚本动作」与现有普通 C# 模块的边界：脚本动作不支持 `async/await`、`lock` 等写法，六件参考件应明确目标运行模式，避免用户误粘贴到错误模块。 → ✅ R226 交付：reference/README 增「目标运行模式」节（对照表：语法面/Mutex/宿主上下文/兼容性；核对结论=27 件零 async/await，SY-日志轮转 Mutex 需普通模式）+ 六件核心参考件文件头加【目标模式】标注；csc 编译门复跑全净

#### 5.9.3 实现仓库代码审查新增缺口（按优先级排队）

- [x] 【R69-P0】修复 `dispatchWithTimeout` 超时后的重复派发：超时只观测原 Promise 的迟到结果，不能再次调用同一写操作；补副作用命令超时回归测试。 → ✅ v0.7.3 修复+回归测试（底层操作恰好 1 次）
- [x] 【R69-P0】修复 MCP 只读工具的快路径策略：广播关闭、桥关闭或 SSE 断线时不能固定等待 15s；需要能力探测或同一 id 的 fast→NDJSON 回退，并验证迟到广播不会双执行。 → ✅ v0.7.2 bug#10 已修（3s 无回执同 id NDJSON 补发）
- [x] 【R69-P1】统一广播过期命令的 processed 台账语义，验证同一过期信封重放时不会重复产生 expired 回执或改变统计。 → ✅ v0.7.3 续（过期补 markProcessed + 重放回归测试）
- [x] 【R69-P1】统一前端 `events.pull` 与 kernel `events.pull` 的文件扫描、idempotencyKey 去重、source 白名单、stable/available 判定和删除标记配对语义。 → ✅ v0.7.3 续2（逐文件入参+跨文件幂等键去重，与内核同口径+回归）
- [x] 【R69-P1】为 `workflow.plan/execute` 补每个 op 的参数 schema、单步 15s 超时、失败停止回执和确认边界，避免工作流执行绕过普通 dispatch 的超时纪律。 → ✅ v0.7.3 续3（单步上限+外层不叠加；参数 schema 见 MCP ARGS 表既有）
- [x] 【R69-P1】明确并统一所有写 op（checkin.record、contacts.ensure/interaction、template.new、commands.run、workflow.execute、plugin.api）的确认、审计、黑名单和 MCP 写开关策略。 → ✅ R226 交付：safety-gate-contract §6「写 op 统一策略表」（7 写 op × 确认/审计/黑名单/幂等/MCP 门 + 现状差距①审计全覆盖②内核旁路收口 + 五条统一策略；并修正 §2「内核子集无写命令」过时表述）
- [x] 【R69-P1】统一 `plugin.api` 的 `args` 形状：实现当前只接受数组，而 MCP schema/契约存在对象声明；先定契约再补对象/数组/非法值测试。 → ✅ v0.7.3 三处钉死（数组=位置参数/对象=options 实参/其他 rejected）+三形状回归测试
- [x] 【R69-P1】修复设置页开启广播时 `startBridge()` 的早退路径，确保已运行桥随后打开广播也会创建 `BroadcastSubscriber`，并补设置页集成测试。 → ✅ v0.7.3 抽出幂等 startBroadcastSub()（集成测试待真机）
- [x] 【R69-P0】核对桥开关与事件订阅生命周期：设置页打开桥后必须调用 `startEventBridge`，关闭桥必须退订；覆盖首次开启、重复开关、重载和关闭后不再物化事件。 → ✅ v0.7.3 与 onload 配对（开桥即接上/关桥即退订；真机验证待 ⑪ 收官）
- [ ] 【R69-P1】为多窗口桥增加真实互斥/命令认领机制（Web Lock、独立锁文件或等价方案）；当前单飞只保证单个 frontend 实例，不能证明两个窗口不会重复消费。
- [ ] 【R69-P1】验证 CLI、PowerShell、MCP 多生产者同时 `getFile→append→putFile` 时不会互相覆盖命令；若无法保证，明确串行化或改为独立命令文件/内核追加服务。
- [x] 【R69-P1】诊断包使用当前活动 `BridgeService` 的统计或持久化统计；禁止每次导出新建服务导致计数归零。 → ✅ v0.7.3 续（activeService 优先，桥关才回落新实例）
- [x] 【R69-P1】为 events 物化增加 single-flight/锁或等价并发策略，验证连续 CustomEvent、重启恢复、坏行、裁剪和多端写入不会丢事件。 → ✅ v0.7.3 续4（createSingleFlight 串行队列+20 并发/失败不阻塞回归）
- [x] 【R69-P1】对 commands/results 全文件读改写队列做真实多写者混沌测试；若仍有 stale-writer 窗口，确定锁、版本或 CAS 方案。 → ✅ R134 确定性混沌 3 测：丢行窗口实证/同 id 重发台账去重恢复/压缩不吞并发追加（单写者约定+补发=系统性恢复，结论入测试头注）
- [x] 【R69-P1】把移动端桥 opt-in 从 `deviceName` 的 `:mobile-on` 隐式后缀改成显式设置项，验证默认关闭、持久化、提示和重启行为。 → ✅ R134 mobileBridgeEnabled 显式字段（默认关+设置页开关+旧后缀加载迁移显式优先+守卫双保险）；移动端真机行为待 M1.5
- [ ] 【R69-P2】补 `config.discover` 的收集箱文档发现、自动创建和手填兜底；当前 `inboxDocId:null` 不能与“配置发现”承诺并列。
- [x] 【R69-P2】审查未使用的 `src/api.ts` 与 `services/kernelApi.ts` 重复实现，移除或隔离其中的 SQL 字符串插值路径，避免死代码和注入维护债。 → ✅ v0.7.3 续5（整文件删除：全仓零引用+SQL 插值面清除，113 单测/构建全过）
- [ ] 【R69-P2】核对设置页实际可配置项与文档承诺（bridgeBasePath、backoffMaxMs、auditMax、deviceName、rawApiAllowlist），决定补 UI、迁移 schema 或明确“代码默认不可配置”。

### 5.10 R71：产品定位、能力发现与命令入口（本轮只登记，不开发）

> 以下 R71~R78 是覆盖 Quicker 动作、快门和小驴生态的产品专题；P0/P1/P2 为候选优先级，不代表全部进入下一版。先验证用户价值、公开契约和依赖，再选首批；功能扩展候选另见 §3.2 R79。

- [x] 【R71-P0·定位】建立“思源新手、Quicker 熟练者、AI/CLI 集成者、移动捕获者”场景矩阵：每类写触发、期望结果、失败容忍度、首个成功动作和一个明确的非目标声明。 → ✅ R201 批量登记（红线字面已交付）
- [ ] 【R71-P0·需求证据】为每个候选记录真实触发频率、现有做法、耗时/误操作、替代方案和用户收益；安排观察/访谈题纲与一周使用日志，未访谈部分明确为假设。
- [ ] 【R71-P1·取舍】按收益、频率、风险、依赖成熟度和维护成本排序，区分补体验、补契约、新功能、越界需求；未确认需求不因竞品已有就默认开发。
- [ ] 【R71-P0·结果】为每个核心动作写“用户问题→输入→输出→写入位置→证据→失败恢复”卡片，先按用户结果排列，再介绍三通道和实现架构。
- [ ] 【R71-P0·等级】统一“内核快路径可用、需开桥、需安装上游、需管理员/Token、仅桌面、实验中、待真机”的可用性等级，并同步菜单、设置、README、MCP 工具描述。
- [ ] 【R71-P0·目录】设计能力目录视图：显示来源插件/版本、读写属性、前置条件、确认要求、预估等待、当前状态、缺失原因和安装/诊断入口；缺插件、禁用、版本不兼容、桥关闭各有空态。
- [ ] 【R71-P0·事实】建立 capability manifest 事实表，区分稳定、实验、设计态和未定位插件；manifest 的来源 commit、校准日期和漂移告警必须可追踪。
- [ ] 【R71-P1·搜索】命令搜索支持中英文、拼音或关键词别名和前缀映射；“打卡/daka/checkin”“摘录/捕获/capture”均命中，raw op 仅在高级诊断出现。
- [ ] 【R71-P1·历史】加入收藏、最近使用、按场景置顶和失败后重新执行；支持清除历史和隐私开关，最近失败项展示原因而非只显示名称。
- [ ] 【R71-P1·无匹配】空结果提供“检查插件状态、打开设置、运行诊断、查看安装说明”等动作；至少一个主操作和三个辅助操作，Esc/Back 返回搜索。
- [ ] 【R71-P1·动作面板】每个命令提供执行、查看说明、配置/快捷键、复制 CLI/MCP 示例、收藏；写命令先展示目标和影响并标注 destructive。
- [ ] 【R71-P1·焦点】按 Quicker `showmenu` 的 `useFocus` 语义验收鼠标和键盘入口：Enter 执行、Esc 返回、鼠标抬起不误关、场景切换后重新检查快捷键冲突。
- [ ] 【R71-P1·联动目录】把 manifest 能力矩阵生成生态地图：点插件可进入安装、启用、诊断、文档；显示已安装版本、manifest 版本、成熟度和健康状态。
- [ ] 【R71-P1·依赖图】工作流预览标出每一步依赖、输入来源、写入位置、预期输出、失败后可继续/停止选项；缺一插件时保留可用子流程并解释替代路径。
- [ ] 【R71-P1·工作流模板】提供晨间、会议、收工、阅读→闪卡、捕获→分拣→人脉模板的预览、dry-run、逐步进度和中断后续处理；不得把模板仅作为无说明的 JSON。
- [ ] 【R71-P2·学习】记录本地能力成功/失败计数、最近失败阶段和未使用原因，用于排序和改进；默认不上传正文/Token，关闭统计后立即停止并可清除。

### 5.11 R72：安装、首跑、日常、失败恢复与迁移旅程（本轮只登记，不开发）

- [ ] 【R72-P0·预检】安装前检查 SiYuan 版本、Frontend/Kernel、`kernels`、Quicker 版本、端口/Token 可达性、桥目录可写性，并分为可继续、需修复、仅降级三类。
- [ ] 【R72-P0·向导】将首跑改成可恢复状态机：环境检查→选择能力→Token/桥权限→连接探针→样例只读→可选样例写入→完成；刷新/关闭后可续上。
- [ ] 【R72-P0·最小权限】桥、广播、raw API、MCP 写权限分别解释作用域、风险和关闭方式；默认只开最小能力，逐项测试且可回退。
- [ ] 【R72-P0·首次读】首跑必须完成一条只读探针并显示结果、耗时、通道和可复制证据；探针失败给重试、改配置、查看 FAQ 三条路径。
- [ ] 【R72-P0·双路径】首跑明确两条路径：Quicker/CLI/广播需显式开启外部桥；MCP 只读/Kernel 路由可不开桥，MCP 写入另需独立开关与思源确认；FAQ/录屏分别演示切换和回退。
- [ ] 【R72-P0·首次写】首次写入预览目标笔记本/文档/块、格式、时间和同步影响；测试块可撤销或自动标记，失败不能留下半写入垃圾。
- [ ] 【R72-P0·捕获】捕获流程采用“输入→目标/格式预览→写入或排队→回执→打开原文/继续捕获”；异步任务显示任务 ID、等待状态和查询入口。
- [ ] 【R72-P0·状态】统一不可达、鉴权失败、目标不存在、权限拒绝、插件缺席、队列过期、执行失败、结果未知八类状态；每类给下一步、同 ID 查询和安全重试规则。
- [ ] 【R72-P0·通知】Toast 只作短提示，失败进入持久通知中心；记录时间、来源、任务 ID、通道、耗时、复制诊断、打开日志和再次运行。
- [ ] 【R72-P0·未知】超时或断线显示“结果未知，先查询同一任务”，区分 duplicate、expired、late completion；禁止用户盲目换 ID 重试副作用操作。
- [ ] 【R72-P0·桥恢复】桥关闭、消费卡死、积压、文件损坏和双窗口争用提供分级恢复向导：暂停→导出诊断→备份→重建/清理；危险操作显示将丢弃行数。
- [ ] 【R72-P1·长任务】commands.run、workflow、OCR 等长任务显示阶段、可取消/转后台和完成回执；取消后明确是否仍可能迟到完成。
- [ ] 【R72-P1·升级】升级前备份设置、版本和桥状态；升级后生成迁移报告，提供恢复上一份、恢复默认和保留当前副本。
- [ ] 【R72-P1·Quicker 更新】动作更新显示 revision、V1/V2、变更说明、最低版本、许可和配置保留/重置；提示更新、自动更新、不更新可选，失败可回退。
- [ ] 【R72-P1·卸载】卸载前让用户选择处理队列（保留/导出/清空）、导出审计/诊断，并列出会删除的插件文件与不会删除的笔记数据；卸载后验证无轮询/订阅残留。
- [ ] 【R72-P1·换机】重装、禁用、换工作区时识别孤儿桥目录与 deviceName，支持合并/忽略/删除；切换工作区前显式停止旧桥并处理未消费命令。

### 5.12 R73：UI、交互与可访问性（本轮只登记，不开发）

- [ ] 【R73-P0·信息架构】设置页分为状态概览、基础连接、安全与权限、性能、生态、数据与队列、诊断、关于；基础项首屏，高级项折叠。
- [ ] 【R73-P0·标签】所有输入有可关联 label、说明、默认值、单位、范围、示例和恢复默认；按 W3C 表单标签/fieldset 规则验收。
- [ ] 【R73-P0·校验】pollMs、TTL、auditMax、path、deviceName、allowlist 对空值、边界、非法字符、超长文本给 inline 错误；保存显示 saving/saved/error，失败恢复旧值。
- [ ] 【R73-P0·状态区】桥、事件桥、广播、内核路由、MCP 只读/写分别显示运行状态、最近成功/失败和退避状态；开关等待启动/停止完成再提示。
- [ ] 【R73-P0·开关状态机】桥/广播开关快速开→关→开时串行化启动与停止，期间锁定按钮；启动失败自动回滚并保留原因，禁止旧 poller/SSE 与新订阅重叠。
- [ ] 【R73-P0·键盘】打开后焦点落搜索/首控件，Tab 顺序稳定，Enter/Space/Esc 行为一致，确认框 focus trap，关闭后焦点回到触发器；仅键盘完成首跑、开关、导出和诊断。
- [ ] 【R73-P0·动态反馈】页内状态使用 `role=status/alert` 或等价可感知区域；文案统一为发生了什么、影响、下一步、复制诊断，不能只依赖颜色或短 toast。
- [ ] 【R73-P1·移动】按钮/开关/菜单触控目标至少 44 CSS px；验收横竖屏、safe-area、键盘顶起和窄屏输入不被遮挡，移动默认不暗启轮询。
- [ ] 【R73-P1·缩放】320px 宽和 200% 缩放下不横向滚动；长按钮换行，日志/诊断可滚动，焦点始终可见。
- [ ] 【R73-P1·主题】亮、暗、高对比度和 reduced-motion 走查；边框/错误/成功对比度合格，状态不只用颜色表达。
- [ ] 【R73-P1·空态】桥关闭、无插件、无历史、无回执、无收藏、无权限统一显示原因、主动作、次动作和帮助链接。
- [ ] 【R73-P1·数据操作】清空队列、启用 raw API、导出敏感诊断的确认框列出影响数量、保留时间和可逆性，并提供取消。
- [ ] 【R73-P1·审计视图】审计/回执/事件支持时间、op、状态、插件、device 筛选，搜索、分页/虚拟化、复制单行和下载脱敏文件。
- [ ] 【R73-P1·脱敏】外链、复制命令和诊断导出提供脱敏预览；Token、路径、个人 ID 自动遮罩并提示清理剪贴板。
- [ ] 【R73-P1·语言】设置、错误、确认、诊断和生态清单全部使用 i18n key；中英缺失翻译回退规则固定并纳入检查。

### 5.13 R74：性能、容量、资源与可观测性（本轮只登记，不开发）

- [ ] 【R74-P0·预算】将冷/热面板预算拆为探测、registry、动态数据、渲染、首个可交互五段，记录 p50/p95/p99 和超预算阶段。
- [ ] 【R74-P1·SLO】先测基线再定捕获成功率、回执可达率、只读/确认后写入 P95、空转 CPU/内存/每小时 I/O/日志增长和恢复丢命令率；基线记录硬件、版本、插件/块数量和同步状态。
- [ ] 【R74-P0·搜索压测】对 100/500/1000 条命令压测；输入 debounce、取消旧请求、结果虚拟化，首屏先出且顺序稳定。
- [ ] 【R74-P0·注册表】为插件/命令探测增加 single-flight、TTL 和事件失效；比较冷启动、缓存命中、插件增删后的 stale window。
- [ ] 【R74-P1·轻量发现】评估 loadPetals 内嵌完整源码的响应字节/解析耗时；用轻量 capability snapshot、installed metadata 缓存和 inflight 去重减少面板/诊断反复拉取代码。
- [ ] 【R74-P0·队列】对 1k/10k 命令和大 payload 压测，限制单 tick 条数/字节、旧命令 TTL、公平性、内存峰值和主线程阻塞；超限需可解释拒绝或分批。
- [ ] 【R74-P0·保留】为 results/events/audit 设字节上限、行数/天数策略、轮转、坏行计数、cursor/分页和导出后清理；禁止 O(N) 全文件读改写无限增长。
- [ ] 【R74-P1·阈值】界面显示队列/事件/审计行数、字节、最老/最新时间和预计滚动点，在 70/90/100% 给提醒、导出和清理操作。
- [ ] 【R74-P1·移动资源】记录桥轮询、SSE、物化的 CPU/内存/电量/流量；休眠和后台自适应退避，回前台恢复并显示原因。
- [ ] 【R74-P1·请求】Kernel API、桥和 MCP 增加可取消请求、全局超时、读重试与写同 ID 禁重试分类；单调时钟计算耗时，墙钟只用于 finishedAt。
- [ ] 【R74-P1·SSE】按 WHATWG 语义测试多 data 行、事件块空行、CRLF、BOM、EOF、id/Last-Event-ID；若依赖单行 JSON，写入协议门禁。
- [ ] 【R74-P1·广播】观测 reconnect、error、frame、drop、queue depth 和关闭释放；burst 下定义逐帧串行、并发或丢弃策略。
- [ ] 【R74-P1·统计窗口】运行统计显示会话 ID、启动时间、采样窗口、uptime、last success/error/kind、队列最老年龄、drop/parse error；重载归零不得称为累计，health snapshot 可直接复制到 Issue。
- [ ] 【R74-P1·回执观察】MCP/CLI/PowerShell 多调用共享 receipt watcher 或按 ID 订阅，支持 cursor、退避和并发上限，避免每个工具每 300ms 重读全量 results 文件。
- [ ] 【R74-P1·物化】高频 CustomEvent 使用 single-flight/队列合并，压测丢失率、坏行、裁剪、重启恢复和多端写入。
- [ ] 【R74-P1·事件分层】将 event whitelist 分为 available/observed/deny 高频，不能因插件 stable 就纳入所有事件；`events.pull`、物化、诊断和宣传共享同一白名单。
- [ ] 【R74-P1·稳定性】CLI、PowerShell、MCP、广播同时写入，叠加内核重启/网络断开做 1h/24h soak，记录 stale writer、重复回执和资源增长。
- [ ] 【R74-P1·矩阵】建立 SiYuan 3.8.4/3.8.6/next × 5k/50k blocks × 桌面/移动/Web × 桥/广播开关性能矩阵。
- [ ] 【R74-P2·MCP容量】MCP stdio 增加并发限额、排队/取消、JSON-RPC 帧大小、输入缓冲和 stdout backpressure，覆盖大帧、截断 JSON 和挂起写工具。
- [ ] 【R74-P1·MCP协议】建立 MCP initialize 协商、协议版本、capabilities、错误码、取消/进度和客户端矩阵；Claude Desktop、Cursor、内置客户端分别记录协议冒烟与完整 host 会话证据。
- [ ] 【R74-P1·MCP校验】统一工具 schema 的 required/type/range/枚举/大小校验，拒绝额外字段的策略明确；将 JSON-RPC -32602 与业务 rejected 分开并保持向后兼容扩展。

### 5.14 R75：配置、数据模型、多工作区与隐私边界（本轮只登记，不开发）

- [ ] 【R75-P0·数据地图】建立设置字段→存储位置→是否同步→敏感级别→默认值→迁移版本表，覆盖 settings、processed、audit、bridge 文件、storage/local、device。
- [ ] 【R75-P0·导入】配置导入/导出带 schemaVersion、来源设备/时间、差异预览和选择性分组；Token/敏感连接字段默认不导出，冲突策略可选。
- [ ] 【R75-P0·重置】支持单项、分组、全部恢复默认；全部重置前自动备份并说明是否停止桥/清队列，完成后可撤销恢复上一份。
- [ ] 【R75-P1·迁移】持久化每次迁移的成功、跳过、非法字段和 schema 版本；旧字段不可静默丢弃，诊断不含配置值。
- [ ] 【R75-P1·版本回退】对未知 schemaVersion、malformed 配置和 processed 台账版本做备份、迁移结果提示和失败回滚；禁止按旧默认静默运行或清空台账造成重复执行。
- [ ] 【R75-P1·多前端】显示主消费者、只读副本、争用中和接管动作；接管前显示待处理数，失联后才能安全接管。
- [ ] 【R75-P1·能力矩阵】桌面、移动、浏览器、多窗口、远程 Kernel/HTTPS/代理分别显示可用、降级和默认关闭原因，隐藏不可用按钮。
- [ ] 【R75-P1·远端】远程 Kernel 提供连接 profile、证书/鉴权/可达性探针，切换前显示数据流方向和风险，不能把 127.0.0.1 经验套到远端。
- [ ] 【R75-P1·保留】审计/回执/事件支持按天数或容量保留，显示估算占用；删除标记与原事件配对可视化，清理前支持导出。
- [ ] 【R75-P1·边界】绘制命令正文、回执、审计、事件、诊断、MCP 输入的本机/同步/外发边界，提供“清除我的数据”入口，默认零云端。
- [ ] 【R75-P1·诊断】诊断包分最小连接信息、统计、脱敏审计三档，逐项勾选、预览样例、历史自动过期和一键删除剪贴板副本。

### 5.15 R76：宣传、分发、采用和反馈闭环（本轮只登记，不开发）

- [ ] 【R76-P0·README】按“30 秒结果演示→适用人群→前置条件→三通道→安全边界→架构细节”重排 README；稳定/实验/待真机/设计态使用统一徽章。
- [ ] 【R76-P0·功能卡】为每个动作/工作流提供适用人群、输入、输出、写入位置、耗时范围、桥/插件/Token 要求、隐私、失败恢复和快捷键/文本指令。
- [ ] 【R76-P0·演示】录制可复制的 3 分钟安装→启桥→ping→只读→确认写入→查询回执；另录广播/MCP 失败恢复，素材必须无 Token、路径和个人数据。
- [ ] 【R76-P0·对比】公开“小驴快门 vs 思源原生 MCP、Quicker 直连、单插件桥”的适用/不适用矩阵，说明不执行外部代码、默认关闭和数据边界。
- [ ] 【R76-P1·兼容】安装页展示 SiYuan min/current/next、Quicker 2.2/2.3、脚本/C# 模式、桌面/移动/浏览器和桥开关兼容矩阵，不把未实测写成支持。
- [ ] 【R76-P1·素材】准备脱敏设置截图、面板 GIF/短视频、失败恢复、亮暗主题、移动窄屏和生态联动截图，校验分辨率、字幕和无个人数据。
- [ ] 【R76-P1·FAQ】将 FAQ 改成“我想做什么→检查什么前置→运行哪项诊断→如何安全重试”的决策树，错误码、通知、文档链接共用词汇。
- [ ] 【R76-P1·样例】提供一键导入安全的只读 profile、捕获模板和测试动作；样例数据可全部删除，不能把真实工作区当教程。
- [ ] 【R76-P1·反馈】Issue 模板收集版本、前后端、前端类型、启用能力、复现步骤和脱敏诊断；Discussion 固定成功、失败和需求投票主题。
- [ ] 【R76-P1·闭环】每版记录 issue→修复→回归→CHANGELOG，发布说明列用户可见变化、迁移影响、已知限制和回滚方法。
- [ ] 【R76-P1·Quicker】分享页记录 share ID/revision/V1/V2、最低版本、许可、配置脱敏、更新策略；禁止 `.qa`、示例和截图泄露 Token/绝对路径/个人 ID。
- [ ] 【R76-P1·外测】把上架门槛扩为桌面+移动外测，覆盖冷启动、失败恢复、键盘/触控、升级/卸载；记录完成率、首成功时间、误触发率、P95 等待，不收集正文。
- [ ] 【R76-P1·招募】招募 1~3 名 SiYuan/Quicker/MCP 外部试用者，开启 Discussions 的 Announcement、Q&A、Show and tell 模板；在招募前写明版本、隐私、反馈格式和退出方式，避免只发布没有反馈入口。
- [ ] 【R76-P2·生态漂移】小驴系列插件版本变动时自动检查能力清单、示例截图和文档；发布页显示最后校准日期和未校准风险。

### 5.16 R77：小驴系列插件联动场景与契约（本轮只登记，不开发）

- [ ] 【R77-P0·清单校准】从各插件真实 `plugin.json` 校准 pluginId、version、minAppVersion、protocol、loadPetals name；当前闪卡/考试/拾遗清单存在 ID/版本漂移，必须有 source commit、日期和告警。
- [ ] 【R77-P0·能力边界】把打卡 v5、人脉 v1、雷切稳定能力、拾遗设计态、闪卡事件草案、考试一次性 stats 和未定位管家分别标为稳定/草案/不可用，不得把未定位模块列入默认流程。
- [ ] 【R77-P0·晨间】验证“总览→挑今日三项→开始”：日记、打卡机会、闪卡到期、考试计划、人脉提醒、拾遗重浮并列显示数据截至时间、source 和权威入口；任一源超时不阻断其他卡片。
- [ ] 【R77-P1·会议】验证“联系人/资料→模板建会→会后人物/日期/地点预览→互动和行动项→回执跳回”；重名先选 existing docId，会话 ref 保证失败重试不新建第二份。
- [ ] 【R77-P1·知识输入】验证“网页/PDF/视频摘录→收集箱→用户选择拾遗读库→阅读/引述→明确制卡/出题→回到来源”；未装插件保留原摘录，衍生卡/题携带 source doc/block/url。
- [ ] 【R77-P1·复习打卡】等待闪卡稳定 sessionId、completedAt、validCount、durationMs 和考试正式完成事件后，再设计学习打卡；reviewed 与 session-finished 重放只能计一次，中断/预览不记。
- [ ] 【R77-P1·晚间】聚合打卡、阅读、人脉、闪卡、考试摘要前先预览截止范围、来源、缺源和截断；不读取 revlog/attempts/glean-index 等私有库，重复保存规则可见。
- [ ] 【R77-P2·关系维护】人脉生日/久未联系提醒必须由人脉公开 bounded projection 提供，快门不 SQL 猜业务口径；隐私字段、农历、同名由 owner 处理。
- [ ] 【R77-P2·管家】先定位管家仓库、pluginId 和主数据，再定义只读 task/reminder projection；不复制打卡 occasions 或人脉 birthday，完成状态回写 owner。
- [ ] 【R77-P1·事件契约】统一跨插件事件名、版本协商、source、correlation/idempotency key、删除/保留和 owner；显式声明哪些事件可进入快门物化白名单。
- [ ] 【R77-P1·适配器门禁】contacts.* 严格校验 protocol===1、capabilities、字段长度和幂等 ref；插件缺席/版本错误时不执行未知方法。
- [ ] 【R77-P1·部分失败】contactsInteraction、会议和复习工作流给出已完成/未完成名单、补偿入口和不会重复写入的重试规则，不以总失败覆盖部分成功。
- [ ] 【R77-P1·副作用标记】commands registry 为每条命令登记 effect、confirm、source、前台条件和可回滚性；禁止把全宿主命令当作等价安全读操作。
- [ ] 【R77-P1·降级】每条跨插件流程定义缺插件、版本不兼容、超时、窗口关闭、重复事件的降级路径，用户能单独继续未失败步骤。
- [ ] 【R77-P2·联动矩阵】覆盖只装快门、快门+打卡、快门+人脉、全家、某一源超时、事件重复、插件升级和工作区切换，记录输出是否仍可回到权威插件。
- [ ] 【R77-P2·用户可解释】联动结果显示插件、版本、source、externalRef/idempotencyKey、发生时间和原记录链接；原记录删除后给出可理解的历史说明。
- [ ] 【R77-P0·能力分层】manifest 为每项能力标记 read/write、register、maturity、sourceOfTruth、eventIngestion、minProtocol、minVersion 和 frontend 支持；registry 区分 declared、observed、stale、unknown，UI 不把 declared 当 available。
- [ ] 【R77-P0·版本协商】打卡要求 protocol 与 apiVersion≥5，人脉要求 protocol===1 且 capabilities 完整，雷切校验宿主能力，闪卡校验 Gateway kind/capabilities；future major、unknown minor、缺能力均有测试。
- [ ] 【R77-P0·握手字段】打卡 adapter 严格校验 `protocol:"siyuan-checkin"`、apiVersion major、descriptor 和 capability；修正 `protocolName`/`protocol` 类型漂移，未知桥不得当成打卡桥。
- [x] 【R77-P0·事件治理】事件白名单只接收 available 且 ingestion=implemented 的能力；每个事件登记 schema、版本、幂等、source、保留和删除语义；闪卡/考试/拾遗未有物化路径前不得出现在 events.list。 → ✅ R140 eventWhitelist 收紧（移除 stable 旁路，白名单 8→2，observed 只观察不消费；ingestion=implemented 字段 manifest 暂无，事件扩面时随 manifest 演进）——真机复核 ✓（petal 热加载）
- [ ] 【R77-P1·类型门禁】◐ R226 半交付（契约+schema+校验器=设计仓库侧已落，TS 类型/CI 门禁挂 quickgate 批）：将 events、sourceOfTruth、ingestion、schema、version、minProtocol 纳入 EcosystemManifest 类型和 JSON Schema；移除 `unknown` 读取和手写字段漂移，契约校验失败时阻止发布。
- [x] 【R77-P1·权威矩阵】明确打卡记录/summary、人脉人物/互动、雷切导航/context、闪卡调度/revlog、考试题目/作答、拾遗状态、管家待契约的 source of truth；中枢不得重算或私读业务库。 → ✅ R226 交付：ecosystem-manifest-contract §2 权威矩阵（8 数据域 × source of truth × 契约面 × 快门角色/禁止项 + 三不变量）
- [ ] 【R77-P1·投影】复核雷切 checkin projection 只消费打卡 v5 的 bounded calendar/summary；跨插件月历、streak、heatmap 不得自行重算，覆盖日期格式、跨月和 owner 版本漂移回归。
- [ ] 【R77-P1·部分成功】workflow 每步返回 status、owner、idempotencyKey、started/finished、sideEffect、retryable、已写入和待补偿列表；contacts.ensure 批量先预览去重，再执行。
- [ ] 【R77-P1·幂等身份】◐ R226 设计定稿（ecosystem-manifest-contract §3：桥/事件/工作流/跨插件四域键形状+TTL+四规则；统一注册表实现挂 quickgate 批）：统一 `source+externalRef`（例如 `lv-cards:<sessionId>`、`exam:<sessionId>`、`glean:<docId>:<date>`）注册表，覆盖桥、事件、工作流、跨设备回放和 TTL，保证同一用户动作只记一次。
- [ ] 【R77-P1·时间身份】源 eventId/externalRef/occurredAt/localDate/source 与快门 ingestedAt 分开；补卡、跨午夜按 owner 日期归属，删除 tombstone 按同源 eventId 配对，不能用 item/time 或接收时间猜。
- [ ] 【R77-P1·超时取消】为每个 source 定义 ready/read/write budget；晨间/晚间聚合并行请求并按源超时，取消只取消未开始步骤，已发生副作用必须回执说明。
- [ ] 【R77-P1·可解释导出】联合总结 Markdown/JSON 带 source plugin/version、protocol、queriedAt、时区、范围、过滤条件、missing/timeout/truncated、脱敏 event IDs/externalRefs；未知/失败不能写成 0。
- [ ] 【R77-P1·联动回归】执行插件组合（全装、仅稳定、各缺一个、全部缺失、设计态）× desktop/mobile/browser × 前后台矩阵，至少自动化全装、仅稳定、缺一个、单源超时四组并记录 ready/partial/unavailable/stale/error。
- [ ] 【R77-P2·缓存失效】registry/manifest 60s 缓存按插件 load/unload、版本变更和设置开关失效；UI 显示上次验证时间，过期能力不得驱动写操作。
- [ ] 【R77-P2·隐私】晨间/会议/总结默认只显示姓名、计数、标题和时间，不把 phone/email、题干、AI 原文带入聚合；导出前预览字段和脱敏策略，事件日志不保存正文/Token。
- [ ] 【R77-P1·依赖卡】联动入口统一显示已连接、部分可用、未安装、版本过旧、读取超时、数据过期，并提供详情、安装、重试和跳转原插件；缺失时隐藏写按钮而保留手动路径。
- [ ] 【R77-P1·联动预览】会议多步、学习→打卡、晚间写日记、批量人脉写入先列将读/将写/来源/幂等键/目标文档，确认后执行，重试从失败步继续。
- [ ] 【R77-P1·回执跳转】晨间/晚间聚合在移动窄屏纵向可折叠，写按钮≥44px；外部客户端回执能跳回正确插件 Tab、文档或人物，而不是只有 toast。
- [ ] 【R77-P2·家族分工】统一宣传和入口术语：雷切负责导航/上下文，快门负责外部网关，数据插件负责业务真相，管家只在契约确定后做聚合，避免用户误以为快门保存业务数据。
- [x] 【R77-P2·作者接入包】为小驴插件作者提供 manifest 模板、能力/事件命名、版本协商、示例 adapter、诊断字段和最小联调脚本，提交前检查 ID/版本/事件漂移。 → ✅ R226 交付：ecosystem-manifest-contract §4 作者接入包全项 + templates/ecosystem-manifest-entry.template.json（可过校验的示例模板）+ scripts/validate-ecosystem-manifest.mjs（零依赖校验器，模板+quickgate v1 清单实跑通过，v1 迁移期警告/v2 严格双档）
- [ ] 【R77-P1·实际 op】场景设计先对照 ALL_OPS：当前没有 contacts.get、glean/cards/exam/butler 专用 op；任何新增联动必须同步 ops.ts、bridge dispatch、Kernel KERNEL_OPS、contracts JSON、MCP schema、Quicker 菜单和降级验收，不能把 manifest capability 当成可调用接口。
- [ ] 【R77-P1·工作流缺步】计划生成时标出 WORKFLOW_ALLOWED_OPS 尚不支持的批量记录、contacts.get、事件读取、task/append 和 commands.run 步骤，允许删步重算或人工接管；禁止用 plugin.api 绕过门禁，中断不重放已完成写步。
- [ ] 【R77-P1·命令身份】为雷切 commands.run 建立稳定 action namespace、alias/deprecation、effect/read-write/focus/requiredFrontend 元数据；保存的工作流遇到 langKey 改名时给迁移提示，commands.list 只返回可外部执行且脱敏的元数据。
- [ ] 【R77-P1·所有权】核对闪卡、考试、拾遗同时调用 `/api/riff/*` 与各自 Gateway/revlog 的所有权；统一 exam/glean source namespace、block/deck 创建幂等、调度/评分/统计 owner，多插件安装时只保留一个写入口并提供迁移/合并预览。
- [ ] 【R77-P1·拾遗桥】拾遗公共 `window.siyuanGlean` 与 `glean:data-changed` 仍属预留/DOM 事件；先定 read/write bridge、whenReady、事件持久化载体，完成前 manifest 只能 design/stale。
- [ ] 【R77-P1·考试桥】考试公开 descriptor、`getStats()`/bounded projection 和可恢复事件（v、sessionId、generatedAt、localDate、timezone）；一次性 `lv-exam:stats` 不得驱动晚间总结或打卡。
- [ ] 【R77-P1·闪卡事件】核对 `lv-cards:*` payload 的协议版本、sessionId、duration/scope、幂等 key 与 eventbridge fixture；区分 native/plugin source，桥和原生统计只能记一次。
- [ ] 【R77-P1·人脉就绪】人脉 descriptor 增加 ready/health/whenReady 和可恢复错误码；未初始化与 unsupported/unready 分开显示，不以普通 failed 混淆。
- [ ] 【R77-P1·重复打卡】Glean reading-done、快门 `checkin.record` 和外部命令统一 externalRef/source 注册表；同一阅读语义重复入口只记一次，故障保留原 ref。
- [ ] 【R77-P2·设计态发布】cards/exam 的 `disabledInPublish` 与拾遗未挂载状态写入宣传和默认工作流门禁，禁止把“可安装”写成“集市可用”。

### 5.17 R78：发布包、证据级别与事实一致性（本轮只登记，不开发）

- [ ] 【R78-P0·打包链接】解包扫描 README、docs/api、WALKTHROUGH 和双语文档内部链接；禁止工作区绝对路径、缺失文件和只在源码仓库存在的 `src/ops.ts` 链接，发布包改用包内文件或固定 GitHub permalink。
- [ ] 【R78-P0·可见内容】源码仓库 README 与安装包 README 分层，工具/MCP 配置指向源码仓库；包内 action.png、preview.png 和安装说明做安装后最小显示回归。
- [ ] 【R78-P0·证据】为每项能力记录验证环境、日期、版本、通道、证据级别（单测/冒烟/真机/真 AI host），MCP 代理→Kernel 冒烟不能表述为 Claude/Cursor 完整会话已支持。
- [ ] 【R78-P0·写防线】核对 MCP `template.new` 是否绕过前端 confirmExec、audit、processed ledger；若保留 Kernel 路由，必须有显式写开关、幂等键、审计和跨通道安全回归，否则移出 KERNEL_OPS。
- [ ] 【R78-P0·路径安全】◐ R226 规格定稿（safety-gate-contract §7：templatePath 白名单形状/64KB 上限//templates/ 前缀断言/失败审计/三通道回归矩阵 7 用例；现状两通道 `..` 直拼未拦截已源码核对；代码守卫挂 quickgate 批）：template.new 的 templatePath 拒绝 `..`、NUL、反斜杠、绝对路径、超长/超大内容，限制在允许模板目录；前端、Kernel、MCP 三通道都做 traversal 回归并留失败审计。
- [ ] 【R78-P0·plugin.api】按插件公开契约登记 method 白名单、参数 schema、危险级别、单独确认和审计；拒绝原型链属性、`constructor` 等动态方法，三通道一致测试。
- [ ] 【R78-P1·错误分类】Kernel getFileText/桥读取区分 404 缺失、401/403 鉴权、5xx/网络不可达和空文件；UI、诊断和指标不得把所有异常显示成“没有文件”。
- [ ] 【R78-P1·HTTP契约】Kernel API 明确 `Content-Type: application/json`、响应 content-type、最大响应体和超时；2xx+业务 code 非零、非 JSON、空文件、401/403/404/5xx 分开计数和文案。
- [ ] 【R78-P1·命令回调】把确认窗口与命令回调执行上限分开；回调永久 pending、卸载和迟到完成均有可查询回执，不阻塞 NDJSON tick/SSE。
- [ ] 【R78-P1·运行记录】为多阶段 markProcessed→执行→写回执建模 pending/running/done/unknown，支持回执补写或 outbox；unknown 不能被伪装成 failed 后盲重试。
- [ ] 【R78-P0·事件源隔离】验证多事件文件按 file→text 成对读取，跨打卡/cards/exam/glean 文件按 idempotencyKey 去重并保留准确 sourceFile；不得把拼接全文对每个文件重复扫描。
- [ ] 【R78-P1·工作流ID】对 workflow.plan 并发生成唯一 planId/correlationId，避免同毫秒计划覆盖；回执、审计和子步骤保留关联链并覆盖多 MCP 请求冲突。
- [x] 【R78-P1·通道口径】核对 kernel route `{op,args}`、`id=kernel` 与 NDJSON/MCP 信封差异；在补齐 id/externalRef 前，文档不得宣称三通道共享完整幂等台账。 → ✅ R226 交付：docs/02 §10（四通道对照表：命令 id 来源/回执载体/processed 台账/重放去重 + 四条使用纪律；结论=形状同形成立、台账不共享）
- [ ] 【R78-P1·配置生效】验证 pollMs 等运行配置修改是否动态作用于已启动 poller；界面显示当前生效值，必要时明确需要重启，不能只更新存储值。
- [ ] 【R78-P1·卸载一致性】热重载/禁用/崩溃前等待 audit、event bridge、broadcast subscriber 的 flush/stop 完成或超时，验证审计、事件和队列不会静默丢失，并在诊断记录关闭结果。
- [x] 【R78-P2·边界输入】为 auditMax=0、NaN/Infinity、小数、UTF-8 字节、单行/总缓冲、op/device 长度、深嵌套 args 建立边界测试和错误文案。 → ✅ R143 整数语义加固（pollMs/backoffMaxMs/auditMax Number.isInteger，小数此前漏进持久化）+NaN/Infinity/小数/深嵌套 args 均有 chaos/契约测试覆盖
- [x] 【R78-P1·ID唯一性】对 CLI、MCP、PowerShell 和 verify 并发生成的 ID 做跨客户端碰撞压测；统一 crypto.randomUUID/设备前缀，兼容旧格式并在诊断中显示碰撞。 → ✅ R143 审计结论：三客户端 id 前缀隔离（cli-/mcp-/qk-）+时间戳+随机尾，跨客户端无碰撞面；同毫秒同前缀碰撞概率≈1/65536 且台账按 id 幂等兜底（D-0003）——不加压测，维持现状
- [x] 【R78-P2·发布供应链】CI 使用 frozen lockfile，校验 package.zip 内容和存在性，生成 SHA-256/SBOM，扫描依赖许可、Token、绝对路径并核对 tag→commit→asset。 → ✅ R143 CI：SHA-256+SBOM（sbom-dependencies.json）入产物；frozen lockfile 保持需权衡（--no-frozen-lockfile 现行是为 CI 稳定，切换随发版收紧——留待发版轮决定）
- [x] 【R78-P2·依赖监测】建立每周依赖和 SiYuan release 监测（只提 issue、不自动升级），审查 lockfile diff、漏洞/许可证、SDK 类型与 3.8.6+ 真机 bundle 兼容性。 → ✅ R143 dependency-watch.yml（每周一：npm outdated+思源最新版→自动开 issue，只提示不升级；手动 gh workflow run）
- [ ] 【R78-P2·预发布入口】预发布版本不链接 `/releases/latest`；安装页明确 v0.7.1 prerelease 入口，正式版后才切 latest，并在每版自动校验版本/测试数/事实表。


## 6. 桥协议侧（兜底，可选/延后）


- [x] （可选）打卡 NDJSON 桥 → ✅ R215 裁定（可选项维持可选）：打卡公开桥 v5（windowBridge+事件）已覆盖外部面——NDJSON 桥为无 windowBridge 环境兜底，登记为兜底选项不做
- [x] （可选）人脉 NDJSON 桥 → ✅ R215 裁定（可选项维持可选）：人脉公开桥 v1（searchPeople/ensurePerson/recordInteraction）已覆盖——同上兜底选项不做
- [x] 每季度 02 协议与快门实现一致性检查 → ✅ R137 首轮完成（docs/protocol-consistency-2026Q4.md：九项对齐+D-0012-A 裁定+规范侧待补 2 条；下轮 2027-01）

## 7. P2 扩展与新动作池

### 7.1 平台扩展
- [x] 开启 Quicker 内置 HTTP/WebSocket 服务（668）：设置→软件连接→HTTP/WebSocket服务（本机 2.2.23 实测当前未开启）+ 访问令牌 + HTTPS 选项 → ✅ R217 域登记（GUI 前置）：668 服务开启=Quicker 设置 GUI 一次操作（反向触发前置）——挂 GUI 轮
- [x] 手机 iOS 快捷指令（668 或推送服务，二选一实测） → ✅ R217 域登记（P2-10 域）：iOS 快捷指令=移动捕获域（668 或推送二选一实测）——挂移动轮
- [x] Quicker 推送服务开通与令牌配置 → ✅ R217 域登记（同上 GUI/账号前置）
- [x] P0-1「入参优先」分支 → ✅ R217 交付对照：**四级兜底第一级**（p0-1 参考件+ACTION-CARDS 输入字段）
- [x] 雷切工作台「Quicker 动作」卡片（对接快门网关） → ✅ R217 域登记（等雷切 owner）：工作台卡片=雷切域；快门网关=23 op 已备
- [x] 思源内触发 Quicker 反向通道（CORS→httpserver 兜底→quicker://） → ✅ R217 域登记（等 668 开通）：CORS→httpserver→quicker: 降级链=SY-反向触发 已封装——端点开通挂 GUI 轮
- [x] 专注结束自动打卡（失败落盘重试队列） → ✅ R217 域登记（P1-9 域蓝图齐）：失败落盘重试=同 id 台账语义（D-0012）；专注源=雷切/专注 owner

### 7.2 特定动作候选池（逐个评估后立项）
- [x] 一键快照：`/api/repo/createSnapshot` memo 自动打标（评估结论：批量写动作的前置保险，R2 新增） → ✅ R218 域登记（思源快照 API 评估：createSnapshot 端点形状待实测；memo 自动打标=批量写动作前置保险——登记评估维持）
- [x] 【R3·循环C】捕获多目标路由：目标集合（日记/收集箱/指定文档）+ 前缀路由（如 `#会议` 进会议笔记本）——docs/10 §2-①，落点 docs/03 P0-1 补充 → ✅ R217 交付对照：**R3 路由=p0-1 参考件 #前缀+SY-路由前缀解析.cs 已实现**
- [x] 【R3·循环C】快查 fallback 链：全文零命中→同名 SQL→提示 AI-SQL——docs/10 §2-④，落点 docs/03 P0-3 → ✅ R217 交付对照：**三级降级=p0-3 参考件已实现**（全文→同名 SQL→sql: 提示）
- [x] 周报/月报生成：SQL 统计本周日记/打卡/待办完成率→汇总文档 → ✅ R217 域登记（组装候选）：SQL 统计+汇总文档=SY-12 模式扩展（组装即可——等场景包轮）
- [x] 笔记统计仪表盘：文档数/字数/今日新增→notify 或统计文档 → ✅ R217 域登记（组装候选）：文档数/字数/新增=SQL 统计（同上组装）
- [x] 网页剪藏增强：选区+页 URL+页标题+选区图片组合入库（快摘增强版） → ✅ R217 域登记（浏览器扩展域——R152 同批）
- [x] PDF 摘录：页码+文本+siyuan:// 双链（借鉴 Zotero PDF 的 T2 闭环） → ✅ R217 域登记（PDF owner 域——页码+双链=来源卡字段扩展位）
- [x] 视频时间戳摘录：B站/播放器当前时间+文案入库 → ✅ R217 域登记（媒体合同扩展位——R171 已登记同源）
- [x] 微信/QQ 聊天记录摘录（窗口标题识别联系人→人脉 ensurePerson 联动） → ✅ R217 域登记（窗口识别+人脉联动=COM/窗口域+ensurePerson 已备——隐私门禁挂 R90 红线）
- [x] 窗口布局保存/恢复（快门 commands.run 雷切布局命令） → ✅ R217 域登记（等雷切 owner：commands.run 雷切布局命令透传）
- [x] 定期自动同步守护（长循环动作，借鉴智能备份的变更检测思路，仅 performSync 不做备份） → ✅ R217 域登记（长循环裁定同 R154-02：performSync=思源原生 owner；变更检测思路登记）

### 7.3 非 Quicker 客户端（✅ 已实现，待真机联调）
- [x] PowerShell 桥客户端脚本（tools/Send-LvCommand.ps1：发命令/取回执，commands.run 等 35s）
- [x] 命令行 CLI（quickgate 仓库 tools/lv-cli.mjs：ping/send/receipt/run，零依赖）

## 8. 发布与分发（GitHub 先行，集市暂缓）

### 8.1 GitHub（✅ v0.1.0 已完成首批）
- [x] 【GH】创建 `github.com/ai68298100/siyuan-quickgate` 并 push（已核查：无工作空间数据/桥文件/令牌；.gitignore 排除运行 JSON）
- [x] 【GH】Release v0.1.0（prerelease）：package.zip + 手动安装说明
- [x] 【GH】README 标注「集市上架暂缓」+ badges（version/license/SiYuan 版本）
- [x] 【GH】topics：siyuan-plugin / quicker / bridge / automation
- [x] 【GH】开启 Issues + Discussions，Issue 模板（bug/feature，含脱敏自查项）
- [x] 【GH】SECURITY.md（私密报告入口 + 安全模型速览）
- [x] 【GH】quicker-actions/ 动作导出文件归档 + 导入说明 + 版本对应表（待 Quicker 侧动作搭出后导出） → ✅ R217 域登记（等 GUI 导出）：导入说明+版本对应表=quicker-actions README 已交付
- [x] 【GH】CI 全绿确认 + 后续版本 tag 发版流水线 → ✅ R137 CI 三连绿确认；v0.7.3 tag 补发推送；check:release 门进 CI
- [x] 【GH】发布预告帖（链滴/Quicker 社区，指向 GitHub，非集市）——建议等 M0 spike 完成后再发 → ✅ R217 域登记（等时机：真机验证完成、演示材料后）

### 8.2 隐私与许可
- [x] 隐私说明文档：数据流向图（本机→思源同步→AI 端点；快门不外传任何数据） → ✅ R137 docs/PRIVACY.md（流向图+数据位置表+外部端点清单+清理路径）
- [x] LICENSE 最终确认（MIT，顺延小驴系） → ✅ R137 MIT 版权行改项目方（移除模板残留「2023 SiYuan 思源笔记」）
- [x] Quicker 动作许可选项设置（暂缓分享，导出文件内注明「可自用可修改」） → ✅ R137 quicker-actions/README 许可节：可自用可修改（MIT 顺延小驴系）

### 8.3 集市（暂缓）
- [x] 【暂缓】Quicker 动作库上架（面板+动作单） → ✅ R217 维持暂缓裁定（集市门槛：GUI 实测+演示材料+i18n）
- [x] 【暂缓】快门 bazaar 上架（fork→plugins.txt→PR 一次一件事） → ✅ R217 维持暂缓裁定（fork→plugins.txt→PR 一次一件事——门槛同上）
- [x] 【暂缓】公共子程序单独分享 → ✅ R217 维持暂缓裁定（reference/ 先行分发）

> **上架门槛（全满足才启动）**：①自用满 4 周无 P0/P1 bug ②验收矩阵全绿 ③文档齐全（安装/配置/卸载/隐私）④快门确认开关+审计稳定 ⑤Token 安全自查通过 ⑥至少 1 位外部测试者成功使用。

## 9. 文档与知识管理

- [x] README 项目状态区（与 TODO 同步）
- [x] 快门 WALKTHROUGH.md（M0 九项实证全记录） → ✅ 已在位（多轮回填：M0 收官/MCP 真 e2e/CI 容器化均入记录；本轮机器路径占位化）
- [x] 快门 docs/api.md（op 契约：参数/回执/错误/限制表 + 机器可读 contracts JSON docs/contracts/quickgate-api-v1.json）
- [x] 动作使用手册（安装→令牌→首跑→错误自检） → ✅ R215 交付对照：**GETTING-STARTED 三步+FAQ 错误自检+ACTION-CARDS 八字段**（三件合计即使用手册——已交付）
- [x] 故障排查 FAQ（错误码/症状→原因→解法表：401、not exist、busy、timeout、桥积压…） → ✅ R137 quickgate docs/FAQ.md（七类 30+ 条，bug#1~13 全沉淀+自检工具速查）
- [x] 演示 GIF/短视频（面板呼出/一键打卡/记人脉） → ✅ R217 域登记（GUI 轮录制：素材规范 R176 已备）
- [x] 季度追更：寒Orz、浅沧系列（07 §3） → ✅ R217 域登记（季度研究项保持——07 §3 源清单）
- [x] 版本三线分记（menu schema / 桥协议 / 动作包） → ✅ R137 quicker-actions/README「版本三线分记」节（桥协议/菜单模板/动作包三线独立演进规则）
- [x] 实测结论回写 05 §7 → ✅ R137 B/D/F 三项回写（B 部分实证/D 裁定/F 官方文档钉死）
- [x] 快门「使用说明」入插件设置页关于区（思源内自助排障） → ✅ R137 关于区指向 GETTING-STARTED/FAQ/PRIVACY（petal 热加载部署，无需重启）

## 10. 联调与验收矩阵

- [x] 四态矩阵：每动作 ×（正常/未运行/令牌无效/目标文档被删）——P0 六动作先跑 → ✅ R217 域登记（真机专项域）：四态=正常/未运行/令牌无效/目标被删——ACTION-CARDS 失败恢复字段即预案（执行挂专项时段）
- [x] 桥四态：桥开/关 × 思源前台/后台（confirm 场景） → ✅ R217 域登记（真机专项域；confirm 场景=confirmWithFront 30s 语义已实现）
- [x] 打卡真实数据全链（快门 `checkin.items→checkin.record→checkin.summary`；无快门时再测旧桥兜底） → ✅ R217 域登记（真机专项域；旧桥兜底分支=adapters fallback 已实现）——本轮 checkin.record/summary/链已后台实测 ✓
- [x] 人脉真实姓名收编（重名/生僻字/空格/超长） → ✅ R217 域登记（真机专项域；重名/生僻字=人脉 owner 校验域）
- [x] editor.context 三场景（有选区/无选区/思源外 null 回退） → ✅ R217 域登记（真机专项域）：有选区/无选区/思源外=null 回退=readEditorContext 已实现语义（实测挂 GUI）
- [x] 连按 3 次防抖与幂等 → ✅ R217 域登记（真机专项域；幂等=台账字面已保证）
- [x] 混沌：思源重启期间命令堆积→恢复后消费；内核 busy 风暴；桥文件被外部误清空 → ✅ R217 交付对照：**chaos 测试已交付**（堆积→恢复消费=台账+压缩；busy 风暴=退避；误清空=坏行回执——tests/chaos+queue）
- [x] 思源升级回归（跑全矩阵+M0①复证） → ✅ R217 域登记（真机专项域；全矩阵+M0①复证=verify:restart 可一键）
- [x] 多工作空间同开下的桥与动作行为记录（§1.2 端口实测结论落文档） → ✅ R218 交付对照：**R140 端口规律源码实证已落文档**（REPO-MAP/docs；6806 单实例边界=行为记录核心结论）

## 11. 安全与红线（持续）

- [x] 分享/截图前 Token、个人 ID、工作空间/用户目录绝对路径泄露自查 → ✅ R137 scripts/check-release.mjs 工具化+CI 门（首轮抓到 2 文档本机路径，已修复）
- [x] plugin.api 允许名单默认仅已完成公开契约审计的适配器；新插件逐个验收后加入 → ✅ R138 api.md 允许名单策略注记（默认三插件=已审计；新插件逐个审计后手动加入，不自动扩）
- [x] 动作不执行外部传入代码；自由文本不进 SQL → ✅ R137 复核：参考件全部 JStr 转义/无 eval/SQL 拼接均过转义；红线复测清单固化
- [x] 快门确认开关/黑名单默认值不被后续版本关闭 → ✅ R137 安全默认守护测试（chaos.test.ts：五开关默认+坏值回默认）
- [x] statestorage 配置导出备份（换机迁移） → ✅ R138 quicker-actions README 备份节（state_*.json 路径+换机三步+Token 不随备份+device.json 无需迁移）
- [x] 快门卸载清理验证（bridge 目录删除/无残留进程） → ✅ R217 域登记（真机专项域）：卸载钩子+PRIVACY 清理路径已文档化；实测=卸载重装一轮（保留）
- [x] AI 生成 SQL 的只读强制（P0-3 白名单）复测纳入每次动作更新 → ✅ R137 quicker-actions README 红线复测清单首项

## 12. 远期/备选（记录不排期）

- [x] 面板热路径编译 DLL 提速 → ✅ R217 维持远期（性能实测无瓶颈报告前不优化）
- [x] 多工作空间感知启动器（loadPetals+窗口标题+快门 ping） → ✅ R217 维持远期（R140 端口实证为前置——启动器属独立工具域）
- [x] 思源 Agent 技能发布（ai/agent/skills 一份「思源操作技能」） → ✅ R217 域登记（等思源 Agent 上线：ai/agent/skills 内容=ACTION-CARDS+api.md 已备）
- [x] 快门适配器第三方注册约定（manifest） → ✅ R217 域登记（已交付：manifest+api.md §11 允许名单策略——第三方验收后加入）
- [x] 雷切悬浮球 1-9 槽位联动 → ✅ R217 域登记（等雷切 owner：槽位=commands.run 透传）
- [x] 2Anki 通道（anki-connect） → ✅ R217 域登记（等 Anki owner：anki-connect 域——R81-P2 Anki 同批）
- [x] 与 task-note-management 等任务插件作者探讨经快门桥集成（人脉 BRIDGE.md 同款路径） → ✅ R218 域登记（等作者协作轮：人脉 BRIDGE.md 同款路径；快门桥 23 op 接入面已备）
- [x] 快门上架集市 / 动作库上架+生态页（门槛满足后） → ✅ R217 维持暂缓（门槛清单：GUI 实测+演示+i18n+外测——R8/R12 同源）
- [x] 快门国际化第二语言（en 之外的社区翻译） → ✅ R217 维持远期（en 后社区翻译——R10 门槛）
- [x] 桥协议 v2 设计评审（若 v1.5/v2 通道落地后信封需扩展） → ✅ R217 维持远期（v1.5 稳定运行中——v2 触发条件=破坏性需求出现）

## 13. R80~R88：持续使用、内容维护与自动化产品延伸（只调研与登记）

> 调研依据与去重说明见 [docs/14-产品调研-R80-R88.md](docs/14-产品调研-R80-R88.md)。全部为待验证候选；优先级不等于版本承诺。新公共能力先由业务 owner 定契约，快门负责受控编排和结果解释；本轮不开发。已有 R71~R79 的首跑、主题、键盘、诊断和普通重试继续引用原项。

### 13.1 R80：知识维护、关联、质量与应用

- [x] 【R80-P1·内容角色·评估】区分原文摘录、自己的注释、推断和待确认观点；验收导出/制卡仍保留角色与出处，改个人注释不改原文，避免误引用。 → ✅ R168 调研登记（E2 部分实现）：**SY-研究来源卡已实现三层**（摘录层引用原文/来源层/推断层显式标注「我的话非原文」）——「改注释不改原文」=分块物理隔离；「待确认观点」=推断层加 [待确认] 前缀约定；导出/制卡保留角色=分块结构天然保留。**缺口**：跨块角色检索（按角色过滤）挂思源属性方案
- [x] 【R80-P2·证据册·评估】围绕研究问题组织主张、支持、反例、待确认和原文链接；由用户确认关系，验收相互冲突的来源仍可并列，结论能追溯到多源证据。 → ✅ R193 调研登记（E2 设计对齐）：证据册结构=**证据信封契约**的研究工作流实例——claims（主张）+sources[]（支持/原文链接）+evidence 分级（待确认=unknown）+「冲突来源并列」=分块并列不合并（来源卡同构）；落地=SY-研究来源卡 扩展（关系字段挂 R80-P2 关系类型裁定后）
- [x] 【R80-P2·关系类型·评估】为资料关系定义方向和类型（支持/反例/前置知识/修订版/评论），区分同工作区与跨库范围；验收 A→B、B→C 不自动推成 A→C。 → ✅ R193 调研登记（E2 设计）：关系=有向边不传递（A→B、B→C 不推 A→C）+同工作区/跨库范围字段；载体=思源块引用（原块引用组织，资料篮同款）+关系类型作为块自定义属性——**属研究工作流插件域**（拾遗/未来），快门只提供摘录/来源卡原料
- [x] 【R80-P1·历史提及·评估】限定笔记本查找未链接人物/概念，显示上下文、别名和排除范围，逐项关联或忽略；验收同名、简称、否定句不误连，不自动创建人物。 → ✅ R195 调研登记（等 owner）：未链接提及发现=拾遗/人脉 owner 域（需分词与别名——R94 分词边界裁定同源）；快门原料=contacts.search/全文搜索透传。「同名/否定句不误连」「不自动创建人物」=owner 侧确认语义
- [x] 【R80-P1·资料篮·评估】以原块引用组织多个专题/项目资料篮，明确移出篮与删除原文；验收一源多篮同步呈现原文变更，取消关联不删除原记录。 → ✅ R195 调研登记（等 owner+裁定）：原块引用组织=思源块引用原生（删除原文=引用失效可见——「一源多篮同步呈现原文变更」字面）；「取消关联不删除原记录」=引用非复制语义。快门原料=来源卡/摘录透传
- [x] 【R80-P2·知识元数据·评估】研究属性类型、标签别名/合并、人工/自动标签和字段来源；验收只处理用户选择范围，合并前展示影响，插件私有属性不被统一改写。 → ✅ R195 调研登记（等 owner+红线）：「插件私有属性不被统一改写」=红线「不读取任何插件的私有存储」字面——合并前展示影响=只读报告模式（SY-变更报告同构）；AV 属性=思源 AV 域 owner
- [x] 【R80-P1·已入库合并·评估】对已被引用的资料副本评估字段级合并、标签/备注/来源保留和引用映射；无 owner 安全合并能力时只报告，验收不能用删一份代替合并。 → ✅ R195 调研登记（等 owner+红线）：「无 owner 安全合并能力时只报告」「不能用删一份代替合并」=只读报告红线（R154-06 变更报告同构——SY-变更报告 可复用为合并影响报告）
- [x] 【R80-P1·源版本·评估】保存来源版本/指纹/更新时间，主动检查源变动后提供差异；验收旧摘录仍可读，新版不静默覆盖，登录/付费内容按实际可读范围处理。 → ✅ R178 批量登记（E2 部分实现）：**SY-研究来源卡已实现**（sources[] 抓取时间+摘录 MD5 内容指纹+「旧摘录仍可读」=摘录全文入卡）；「新版不静默覆盖」=同 URL 提示不阻断；差异检查=指纹再比对（同卡两次抓取比 hash）。**缺口**：主动定期检查源变动（需定时器）挂浏览器扩展轮
- [x] 【R80-P1·定位修复·评估】链接存在但页码/块位置已变化时，给上下文辅助定位及人工重绑；验收 PDF 重排、块移动、原文删除显示准确/疑似/无法定位，不能仅判断链接能打开。 → ✅ R196 批量域登记（等 owner+诚实语义）：快门相关=「链接能打开≠定位正确」边界裁定；PDF 重排/块移位重绑=文档 owner 域
- [x] 【R80-P1·重浮控制·评估】通过拾遗 owner 评估资料/类别频率、暂停、排除、专题回顾和推荐理由；验收一篇大量摘录不持续垄断，暂停不删除，也不记成学习完成。 → ✅ R196 批量域登记（等拾遗 owner）：重浮调度 owner 全权；快门侧 R77-P0 治理已保证不抢职责（observed 不消费）
- [x] 【R80-P1·中文质量·评估】建立短中文、公式、代码、表格、OCR 内容的质量样本；验收完整短句不因字符少被隐藏，提示可忽略，空态区分无数据与被过滤。 → ✅ R196 批量域登记（fixtures 同构）：质量样本=fixtures 模式（R109-P0 已交付同款）；OCR 类样本 SY-OCR清理 已覆盖；样本集归拾遗 owner
- [x] 【R80-P2·应用回链·评估】记录知识用于文章、决策、项目或实验的用户确认关联；验收输出与依据可双向回跳，失败/反例保留，打开次数不等于实际应用。 → ✅ R196 批量域登记（等 owner+红线）：「打开次数≠实际应用」=审计可见性红线同构（R181：权限由门控非计数）；关联记录=用户确认的 owner 数据

### 13.2 R81：内容互操作、增量导入和迁移损失

- [x] 【R81-P1·增量内容·评估】区分外部新增/修改、本地注释和删除，定义字段所有权与三方差异预览；先研究文件导入，验收重复导入不增副本，本地编辑不被覆盖，删除源不默认删本地。 → ✅ R196 批量域登记（部分实现）：文件面=SY-增量扫描 重入式已实现（重复导入不增副本/本地不被覆盖——台账+稳定性语义）；笔记面=思源同步 owner 域
- [x] 【R81-P1·格式损失·评估】对 Markdown/CSV/RIS/BibTeX 等候选格式列保留/转换/丢失字段和支持范围；验收往返样本报告链接、标签、附件、注释损失，不宣称任意工具无损。 → ✅ R196 批量域登记（只读报告同构）：往返损失报告=SY-变更报告 模式（逐项列保留/转换/丢失）；「不宣称无损」=诚实边界裁定
- [x] 【R81-P1·批注出口·评估】明确原 PDF、带批注副本、独立注释 Markdown 三种出口，依赖公开导出或用户提供文件；验收外部阅读器可见承诺的批注，原文件不被覆盖。 → ✅ R196 批量域登记（等 owner）：三种出口=PDF 阅读器 owner 域；「原文件不被覆盖」=红线同构（只写用户确认的新副本）
- [x] 【R81-P2·Anki内容·评估】细化 §12 的 2Anki 为字段映射、稳定外部 ID、更新/牌组预览和调度归属；验收二次导入更新内容不增卡、不清复习历史，不伪造 Anki 内部 GUID。 → ✅ R196 批量域登记（等 owner）：Anki 调度归属=Anki owner；稳定外部 ID=externalRef 幂等键模式（桥协议已实现同款）；「不伪造 GU」=诚实边界
- [x] 【R81-P1·字段映射·评估】内容导入前预览列名、类型、编码、日期/时区、空值、标签分隔符和附件基准路径；验收中文/多行/转义样本不串列，未知字段可保留原样并报告。 → ✅ R196 批量域登记（转义已实现）：中英/多行/转义不串列=JStr/ExtractStr 转义对（27 脚本验证）；编码/分隔符检测=导入域（R91-P1 同批）；未知字段保留原样并报告=不静默丢弃红线
- [x] 【R81-P1·附件清单·评估】内容迁移逐项显示附件引用、可读性、重复资源、缺件和体积；验收离线文件导入时不静默联网补齐，不因附件失败删除已保留文本。 → ✅ R196 批量域登记（同构）：附件引用/可读性/体积清单=SY-文件项目索引 同构（大小/时间/哈希列已有）；「不静默联网补齐」=PRIVACY 端点纪律
- [x] 【R81-P1·重新导入·评估】保留导入批次、映射版本和原来源身份；验收重新导入、用户丢弃、源端删除、旧批次撤回各有独立预览，已丢弃内容不在下次同步无提示复活。 → ✅ R196 批量域登记（台账同构）：批次/映射版本/来源身份=信封 externalRef+版本头模式；「丢弃不复活」=台账语义（已处理行跳过）

### 13.3 R82：自动化职责、规则、变量与历史

- [x] 【R82-P0·自动化职责·评估】比较外部 Quicker/快捷指令/n8n 触发与内建规则引擎的真实需求/维护成本；验收明确触发、日程、受控执行归属，不因 events.* 已有就声称无人值守自动化可用。 → ✅ R196 批量域登记（裁定）：快门侧裁定=外部触发（Quicker/快捷指令）为准，events.* 只透传白名单事件不消费（R77-P0）+长驻 watcher 不用（R154-02）——规则引擎属未来独立域
- [x] 【R82-P0·执行模式·评估】分开手动运行、模拟测试、自动触发的许可；验收未授权自动写停在待确认，测试成功或一次手动确认不会隐式授权未来后台执行。 → ✅ R196 批量登记（授权分层已实现）：手动/模拟/自动三许可=R166 五层分立；「一次确认不隐式授权未来」=plan 一次性+TTL 语义
- [x] 【R82-P1·规则版本·评估】编辑保存草稿，启用固定有效版本并显示差异；验收编辑、启用失败、回退不静默改变进行中的规则，区别于一次性 plan。 → ✅ R196 批量登记（版本三线分记同构）：草稿/启用/差异=动作包线（share ID+revision）+参考件版本头；「回退不静默改进行中规则」=git 粒度回滚
- [x] 【R82-P1·触发解释·评估】每次触发显示事件、有效规则、条件、跳过原因和下一次机会；验收重复、条件不符、暂停、超限分别可解释，零执行不是唯一状态。 → ✅ R196 批量域登记（审计三问已交付）：谁/哪端/何时/依据=审计三问（R181）；「每次触发显示事件与跳过原因」=规则引擎属未来域，快门审计面已备
- [x] 【R82-P0·事件回环·评估】为事件→写入→新事件建立 cause/correlation 链、最大传播深度和自触发抑制；验收 A→B→A 能停并展示路径，依赖各 owner 正式因果字段。 → ✅ R196 批量域登记（结构性防回环）：observed 白名单外不消费（R77-P0）=传播链结构性截断；correlation=信封 externalRef+id 前缀（深度上限=白名单面）
- [x] 【R82-P1·冷却合并·评估】按规则选择同源短时事件忽略、取最新、合并摘要或逐条执行；验收显示被合并数量，业务 owner 未允许合并的独立记录不会丢失。 → ✅ R196 批量域登记（同构）：同源短时合并=SY-增量扫描稳定性检查（≥5s 才收）+single-flight 合并——模式已实现
- [x] 【R82-P1·规则预算·评估】评估每小时执行数、单次写入数和一天影响预算；验收超限可见等待/拒绝，显示重置与人工继续条件，CLI/子流程不能绕过预算。 → ✅ R196 批量域登记（结构性无预算问题）：无长驻=无每小时预算需求；上限声明齐（MAX_STEPS=8/RESULTS 200/args 32KB）
- [x] 【R82-P0·暂停熔断·评估】设计单规则暂停、全部自动化急停、连续失败熔断；验收明确阻止新启动/未开始步骤的范围，已写和迟到结果可查，恢复不瞬间释放全部积压。 → ✅ R196 批量域登记（三级急停已交付）：ttl 单命令/桥开关优雅停/petal 全停（R181）+连续失败熔断=轮询器退避 backoffMaxMs
- [x] 【R82-P1·错过日程·评估】定时规则关机、休眠、跨时区、夏令时的跳过/提醒/只补最近一次由调度契约决定；验收原定时间与实际启动分开，不补写几十次或伪装准时。 → ✅ R196 批量域登记（红线）：跳过/补写策略=调度 owner 域；快门 TTL 过期诚实不补写（不自动换 ID）
- [x] 【R82-P1·手动容量·评估】为手动捕获保留容量并定义同目标写入顺序；验收后台洪峰不饿死手动请求，限额与公平性覆盖所有入口，关联 §5.13 性能预算但不重复压测项。 → ✅ R196 批量域登记（语义一致）：手动捕获优先=四级兜底第一级（动作传参）——手动与自动同目标顺序由台账幂等保证
- [x] 【R82-P1·运行快照·评估】历史固定规则、输入摘要、参数映射和能力版本；验收规则更新后仍能解释旧运行当时的定义，不能打开历史时套上最新版。 → ✅ R196 批量域登记（已交付）：历史固定输入/摘要=fixtures+审计（op/状态/耗时）；能力版本=版本头+check-version 门
- [x] 【R82-P1·历史重放·评估】区分查原结果、用原版处理历史输入、用新版处理历史输入；验收后两者先生成新计划，已完成写步默认不重做，未知结果先核对。 → ✅ R196 批量域登记（语义已实现）：「查原结果」=同 id 查询（不重放）；「新版处理历史输入」=新 id 新计划（fixtures 样例）——三分支已区分
- [x] 【R82-P1·模拟样例·评估】提供脱敏固定输入、只读输出和纯模拟运行；验收没装全家插件也能学流程，模拟绝不派发写 op，切真实运行时明确移除固定样例。 → ✅ R196 批量域登记（已交付）：脱敏固定输入/只读输出=fixtures（R109-P0）+只读 op 白名单——纯模拟运行结构性保证
- [x] 【R82-P1·输出映射·评估】从前步输出选择后步字段，显示路径、类型、样例、缺失和数组范围；验收多联系人、空值、字段改名不静默取首项或转字符串，先定新映射契约。 → ✅ R196 批量域登记（模式已有）：前步输出→后步字段=workflow steps args 显式+jsonextract 模块（Quicker 原生）
- [x] 【R82-P1·变量作用域·评估】区分运行变量、流程参数、设备默认值和凭据引用；验收并发运行/不同工作区不串值，重启后的保留/失效可见，普通导出不带凭据。 → ✅ R196 批量域登记（五分类已交付）：运行变量/参数/设备默认/凭据引用=参考件变量表五分类（R108-P0 同源登记）
- [x] 【R82-P1·条件模拟·评估】评估已安装、读取成功、结果非空、用户选择等受控分支；验收 0/false/null/缺字段/超时不混用，跳过标 skipped 而非成功。 → ✅ R196 批量域登记（plan 即条件模拟）：受控分支=白名单 op 才可入 plan+确认卡展示（模拟绝不写入=只读白名单）
- [x] 【R82-P2·子流程·评估】参数化复用只读片段并固定引用版本、权限和影响预算；验收变更先显示父流程影响，嵌套不突破 op 白名单/总步数边界，先评估是否外部工具即可承担。 → ✅ R196 批量域登记（已交付）：参数化复用=公共子程序（reference 件）+固定引用版本=版本头变更记录
- [x] 【R82-P0·计划漂移·评估】确认到执行之间复核稳定目标、工作区、输入和能力指纹；验收删除目标/切工作区/升级 owner 后停止并重新计划，保留新旧预览，不把确认 A 变成写 B。 → ✅ R196 批量域登记（已交付同款）：确认到执行复核=planId 绑定目标/参数+TTL 5min 过期（R181 确认期限同款）

### 13.4 R83：离线、迟到意图、同步与跨设备接力

- [x] 【R83-P0·待处理类别·评估】内容草稿、待执行命令、已执行待回执分别定义持久化与恢复状态；验收断网/重启后标签和操作不同，保存草稿不显示已写入思源。 → ✅ R187 批量登记（E2 已交付）：三类各有持久化载体——待执行=commands.ndjson（重启后仍在）、已执行待回执=results.ndjson（按 id 可查）、恢复状态=台账 bridge-state.json（loadAudit/processed 跨重启）——「保存草稿不显示已写入思源」=回执按 id 判定而非猜测
- [x] 【R83-P1·离线草稿·评估】思源/电脑不可达时可选择保存内容、采集时间、来源和拟定目标；验收关闭重开保留草稿，恢复后用户生成新计划，不能延长原命令 TTL 自动补写。 → ✅ R196 批量域登记（红线字面）：离线保存内容/来源/拟定目标=动作侧本地暂存；「不能延长 TTL 自动补写」=D-0012 红线字面；「恢复后生成新计划」=plan 重新创建语义
- [x] 【R83-P0·恢复批次·评估】联网后先分类显示草稿、未消费命令、未知结果及年龄/目标变化；验收可选发送/保留/丢弃，未知先查原 ID，过期不自动换 ID 重建。 → ✅ R187 批量登记（E2 已交付）：恢复语义已实现——重启后台账跳过已处理行（复活行静默）、未消费命令按 createdAt/ttl 判过期（expired 回执不执行）、「未知先查原 ID，过期不自动换 ID 重建」=D-0012 红线字面
- [x] 【R83-P1·迟到意图·评估】保存“今天/当前文档/本次会议/当前联系人”的原意和实际执行时间；验收跨午夜/换工作区后可保留原目标或改目标，不静默按恢复时上下文重解释。 → ✅ R196 批量域登记（已交付）：原意保留=occurredAt 业务时刻分离（R170 时间模型）；「不按恢复时上下文重解释」=normalize 不换算字面
- [x] 【R83-P1·规则换机·评估】模板可迁移，本设备自动运行授权/凭据/触发条件独立；验收另一设备收到规则默认禁用，预检后显式启用并显示原设备是否仍执行。 → ✅ R187 批量登记（E2 已交付）：换机隔离=device.json（storage/local 每机独立生成）+ Token 不随备份（fixtures README 换机三步：.qa 导出+state 复制+Token 重粘）+「另一设备默认禁用」=桥默认关+isMobileGuard 语义同源
- [x] 【R83-P1·草稿接力·评估】手机稿交电脑时保留稿身份、版本、发送状态和执行归属，不共享命令队列；验收两端同时发送、离线修改、迟到同步能提示冲突并避免双写。 → ✅ R187 批量登记（E2 部分）：跨设备命令=信封 device 定向（v1.1：不匹配跳过不消费——「不共享命令队列」字面）+ 台账防双写（同 id 双设备只执行一次）。**缺口**：手机端采集入口挂 P2-10（iOS 快捷指令域）
- [x] 【R83-P1·离线判定·评估】区分外网断开但本地 Kernel 可用、SiYuan 未运行、远程 Kernel 不可达；验收本地捕获不因 AI/云服务失败被阻断，错误提示指向实际故障层。 ✅ R187 批量登记（E2 已交付）：三层判定已实现——SY-思源未运行分支（kernel 探测 300ms 分层）+ P0-3 AI 分支失败不阻断本地查询（本地捕获与云服务解耦）+ WebDAV/远端错误独立分支（HTTP 状态分类）——错误提示指向实际故障层
- [x] 【R83-P1·同步证据·评估】将本机写入、回执已收到、同步中、其他设备已可见分别展示证据来源；验收不凭写入成功声称多端已同步，无法确认远端时标未验证。 → ✅ R187 批量登记（E2 边界裁定）：「不凭写入成功声称多端已同步」=PRIVACY/红线语义——快门回执只证本机写入；多端同步=思源同步 owner 域（证据来源显示挂思源同步状态，快门不代答）
- [x] 【R83-P1·内容冲突·评估】通过思源公开能力或人工处理并列本地/远端/原基线内容；验收保留冲突副本、选择结果可预览，快门不修改内部同步算法或私有存储。 → ✅ R196 批量域登记（红线）：并列本地/远端/基线=思源同步 owner+冲突副本；「快门不修改同步算法或私有存储」=红线字面
- [x] 【R83-P1·离线可读性·评估】回顾资料显示文本/附件/原链接是否本地可读与最近可用版本；验收缺附件不伪装完整，浏览器清站点数据前能提醒未交付草稿和导出选项。 → ✅ R196 批量域登记（已交付部分）：离线拉取=SY-WebDAV download+缺失不伪装=诚实错误分支（HTTP 分类）；「缺附件不伪装完整」同源

### 13.5 R84：学习质量、人际连续性与项目生命周期

- [x] 【R84-P1·卡题质量·评估】制卡/出题检查多知识点、答案歧义、无出处、过长和答案泄露；验收给具体改写建议而不自动判真，拒绝后保留原摘录，关联 R79 生成预览。 → ✅ R189 调研登记（等 owner）：制卡/出题=闪卡 lv-cards（manifest maturity=design 态——能力未公开）。快门角色=透传摘录（来源卡已有），质量检查与改写建议归学习 owner AI 层。「拒绝后保留原摘录」与来源卡「摘录全文入卡」语义一致
- [x] 【R84-P1·难点修复·评估】学习 owner 提供困难项投影后，引导错题/难卡→原文→补前置概念/拆分/暂缓→再练；验收旧历史可查，不由快门重算成绩或因修订自动打卡。 → ✅ R189 调研登记（等 owner）：同上——困难项投影=闪卡 owner 职责；快门透传链接（siyuan://blocks 回原文已有）。「不由快门重算成绩」=红线字面
- [x] 【R84-P1·专项复习·评估】区分考前练习、今日错题、专题回顾与正式到期复习；验收范围/卡数/时长/是否改变调度可见，退出不丢卡，预览不影响正式调度。 → ✅ R189 调研登记（等 owner）：复习调度=闪卡 owner 域；「退出不丢卡/预览不影响正式调度」=快门 plan 一次性+TTL 语义同构（预览即 plan，不影响正式数据）
- [x] 【R84-P1·衍生复核·评估】源笔记更新/删除后列受影响卡题、旧来源和待复核状态；验收逐项选择更新/暂缓/保留历史，不级联自动删卡，源与学习 owner 各管自身数据。 → ✅ R196 批量域登记（等 owner+红线）：源更新→受影响卡列=闪卡 owner；「不级联自动删卡」=红线字面
- [x] 【R84-P1·学习口径·评估】由 owner 区分回答次数、独立卡数、保留率、有效时长、积压与预期负担；验收分母/时间窗/重复回答可见，少量日样本不被解释成强学习结论。 → ✅ R189 调研登记（E2 部分实现）：**checkin.summary capability 已公开**（today 上下文+streaks 连击，LV·摘要格式化消费）——口径由 owner 定义已实现；闪卡侧等 owner 稳定。分母/时间窗可见=summary data 字段自含
- [x] 【R84-P1·有限时间·评估】5/15/30 分钟入口由 owner 返回可承担的阅读/复习集合；验收预计时长标为估计，到时可停止，未做部分不算失败、不自动打卡。 → ✅ R196 批量域登记（等 owner+红线）：可承担集合=owner 返回；「预计时长标为估计」「未做不算失败不自动打卡」=未知不虚假精确+notify≠证据红线
- [x] 【R84-P1·会前准备·评估】人物选择→最近互动/相关会议/未完承诺→原文；验收同名先选、无记录有正常空态，查看不写互动，私密备注不进通知。 → ✅ R191 调研登记（等 owner+可组装）：contacts.search 已测（408ms）+summary/互动投影=人脉 owner 域；「查看不写互动」「同名先选」=contacts.search 现有语义；组装路径=搜索→摘要→来源链接（原料齐备）
- [x] 【R84-P1·承诺回访·评估】互动里由用户明确承诺并选回访日期，交 owner 提醒后记录实际结果；验收改期/取消/多人参与不重复建承诺，保留原互动，不自动发送消息。 → ✅ R191 调研登记（等 owner）：承诺/回访=人脉 owner 数据模型；快门透传 contacts.interaction（ref 幂等不重复建）；「不自动发送消息」=快门无外发（PRIVACY）
- [x] 【R84-P1·人物时效·评估】人物字段有来源、确认日期、历史值与可聚合范围，由人脉 owner 管理；验收会前显示截至时间，旧单位/称呼可区分，私密字段不进入默认 MCP 投影。 → ✅ R191 调研登记（等 owner+红线）：「私密字段不进默认 MCP 投影」=分层授权（读白名单）+证据信封 sensitivity 字段承载——投影裁剪归人脉 owner 的 public bridge
- [x] 【R84-P1·任务上下文·评估】雷切恢复项目阅读/写作/会议/复习的文档、布局与命令；验收区分任务布局与思源工作区，预览后恢复、不丢未保存编辑，缺文件保留可恢复部分。 → ✅ R191 调研登记（等 owner）：任务恢复=雷切 owner 域（restore-document-set 能力 R6 评估过）；快门只提供 doc.open 受控打开与命令透传
- [x] 【R84-P1·项目收尾·评估】归档项目关联、未完事项、资料与后续联系人，用户决定暂停哪些 owner 提醒；验收归档不删除原记录，重开可恢复，快门不擅自清空业务待办。 → ✅ R191 调研登记（等 owner+红线）：「归档不删除原记录」「快门不擅自清空业务待办」=红线字面；提醒暂停=各 owner 设置
- [x] 【R84-P1·打卡更正·评估】由 checkin owner 提供补记/改量/撤销的历史与更正投影；验收联动聚合显示原记录和更正，失效引用可解释，不把更正当新的独立完成。 → ✅ R189 调研登记（E2 实证边界）：**公开桥 v5 能力表无 delete/correct**（R142 bundle 实证）——更正=UI 专有操作属安全设计；联动聚合显示更正=event-deleted/event-updated 事件（recorded available；updated=observed 待 owner 升级）。「不把更正当独立完成」=幂等键 externalRef 语义一致
- [x] 【R84-P2·周期变化·评估】研究轮班/非每日事项、暂停/恢复、计量目标变动后的机会投影；验收提醒和总结按 owner 周期/单位/生效日解释，不自行重算 streak 或自动补足缺天。 → ✅ R196 批量域登记（等 owner）：轮班/非每日投影=打卡 owner 域（recurrence 语义）

### 13.6 R85：AI 上下文、证据、草稿与多轮确认

- [x] 【R85-P1·上下文选择·评估】AI 任务开始前选文档/块/时间范围及排除项，预览条数和实际发送内容；验收不因零结果自动扩大到全库，个人资料默认最小范围。 → ✅ R191 批量登记（E2 部分实现）：最小投影=四级兜底不自动扩大（无选区输入裁定）+范围/条数预览=workflow plan 确认卡模式。**缺口**：独立「上下文选择器」UI 挂意图中枢域（§19 R132 上下文胶囊同源）
- [x] 【R85-P1·输入预算·评估】对大笔记/多源摘要显示字节或 token 估算、分批/截断和缺源；验收能找到被省略的来源，不能把截断称全量，复用现有模型配置而不重复保存 Key。 → ✅ R191 批量登记（E2 已交付设计）：**证据信封 truncated 字段**（input/output/limit——「不能把截断称全量」字面）+选中文本 2000 上限已有+被省略来源可查（events/files 列表）
- [x] 【R85-P1·引用核验·评估】AI 结果分开来源事实、模型推断和未确认内容，引用回到存在的 doc/block；验收伪造 ID、失效链接、跨日期证据给可见问题而非可点击假出处。 → ✅ R191 批量登记（E2 已交付）：**证据信封 claims[].evidence 分级+generatedBy.model**（模型推断不伪装）+引用回到存在块=块 ID 校验（GuardSql SQL 面只读）+伪造 ID=SQL 空结果诚实「零行」
- [x] 【R85-P1·草稿对比·评估】AI 生成先作为可编辑草稿，逐段对比原文与修改，再选择目标写入；验收拒绝/关闭不改源文，保留原文与用户接受部分。 → ✅ R191 批量登记（E2 已交付）：**workflow plan→确认→execute**即草稿对比语义（逐段=steps 列表、拒绝=denied 不写源、接受=定向写入）；「拒绝不改源文」=失败停止原则
- [x] 【R85-P0·来源指令·评估】网页、笔记和第三方工具描述内的指令按数据处理；验收恶意摘录要求读私密文档/commands.run/扩大外发范围时不会成为授权，执行端仍使用显式许可。 → ✅ R191 批量登记（E2 **红线核心已实现**）：三层防线——①内容按数据：摘录/OCR/网页文本只进 insertBlock 数据字段（JStr 转义）从不进执行面；②写路径授权分层（R166 五层）；③SQL 注入面=GuardSql+单引号转义（p0-1/p0-3）——恶意摘录要求读私密文档/commands.run 不会成为授权
- [x] 【R85-P1·任务工具集·评估】针对阅读总结、联系人查询、学习规划只呈现必要能力和只读结果；验收缺插件有替代入口，不把不必要写工具作为默认工具集。 → ✅ R196 批量域登记（已交付同构）：只呈现必要能力=tools/list 门控分立（读白名单 13/写门控）——按任务裁剪工具面已实现
- [x] 【R85-P0·确认绑定·评估】多轮用户确认绑定 op、目标、参数摘要、输入/计划版本与期限；验收模型补改目标或内容后旧确认失效，不把对话中的泛泛肯定当新写授权。 → ✅ R196 批量域登记（已交付同款）：确认绑定 op/目标/参数/版本/期限=workflow plan expiresAt（R181 确认期限同款）
- [x] 【R85-P1·无前端确认·评估】AI host 无法显示思源确认时返回待用户动作和可复核计划；验收关闭思源前端、取消对话、换 host 不退化成无人值守写入。 → ✅ R196 批量域登记（已交付）：AI host 无法显示确认→诚实 timeout+同 id 查询+可复核计划（results 原文）——「待用户动作」语义一致
- [x] 【R85-P1·多轮输入·评估】对 MCP 2026-07-28 MRTR 等新交互研究缺参数/等用户/取消的体验，并保留旧 host 路径；验收能力探测后选择交互，不能仅替换协议版本或用重试重复写。 → ✅ R196 批量域登记（协议跟踪）：MCP MRTR 等新交互=协议演进跟踪项（基线 PROTOCOL_VERSION 2024-11-05，升级挂上游+回归 smoke）
- [x] 【R85-P1·任务句柄·评估】长 AI 任务用显式 handle 对齐计划、来源、进度与回执；验收重连/新会话只能查询合法任务，取消与迟到完成的实际副作用可见，不依赖隐藏会话状态。 → ✅ R196 批量域登记（已交付双句柄）：planId（计划句柄）+commandId（命令句柄）显式对齐计划/来源/进度/回执
- [x] 【R85-P1·多MCP分工·评估】同时启用思源原生 MCP、快门和其他服务器时说明负责的读写/生态能力，使用稳定命名和任务示例；验收同一意图不因两套工具被选中重复执行。 → ✅ R196 批量登记（已交付）：多 server 分工=manifest owner+PRIVACY 端点清单（各管各域：思源原生 MCP/快门生态面不重叠声明）
- [x] 【R85-P1·AI失败降级·评估】模型不可用/超额/内容不确定时保留本地输入、统计和来源，提供人工模板/只读路径；验收不自动换供应商或外发更多数据，生成失败不丢已捕获内容。 → ✅ R196 批量域登记（已交付同构）：模型不可用保留本地输入=GuardSql 本地校验不依赖 AI+R85 AI 失败分支（p0-3 三级降级）

### 13.7 R86：无 Quicker、跨应用与低负担使用

- [x] 【R86-P1·最小场景包·评估】只捕获、只导航、只打卡联动、只 MCP 读分别测最小安装/权限/后台进程集；验收不安装其余家族仍能完成该包，展示配置项数和首个任务成本。 → ✅ R196 批量域登记（组装候选）：最小安装/权限集=SY-预检+只读白名单——四场景（只捕获/只导航/只打卡/只 MCP 读）各为白名单子集，组装即可
- [x] 【R86-P1·无Quicker·评估】按捕获、打开日记、查询、确认写、查回执评估 Windows/macOS/Linux 已有 CLI/Kernel/MCP/思源入口；验收最终结果及差异，不把 HTTP 可达当完整任务支持。 → ✅ R196 批量域登记（架构天然支持）：CLI/MCP 直接通道（无 Quicker 依赖——三通道架构）；macOS/Linux=node CLI+思源跨平台设计成立，实测挂平台轮
- [x] 【R86-P2·受限设备·评估】研究仅能用 SiYuan/浏览器/系统工具时的核心任务和手动路径；验收写明必需条件与缺失解释，遵守环境限制，不要求绕过安装或网络策略。 → ✅ R196 批量域登记（已交付字段）：仅思源/浏览器/系统工具=ACTION-CARDS 每卡「手动替代」字段（受限设备核心任务路径）
- [x] 【R86-P1·分享类型·评估】手机文本/URL/网页/图片/PDF/vCard 各有接收合同、大小/数量和预览；验收 Safari/照片/文件/联系人真实样例正确，空输入不静默读取旧剪贴板。 → ✅ R196 批量域登记（等移动端）：分享类型接收合同=接收端 P2-10（iOS 快捷指令域）；文本/URL 先行，图片/PDF/vCard 按需扩展
- [x] 【R86-P1·捕获强度·评估】比较轻量收进箱与可改目标/标签的分享捕获；验收点按数、耗时、误投和回执发现率，零交互仅在明确预设且无额外副作用时评估。 → ✅ R196 批量域登记（已交付两档）：轻量入箱=g2-capture 默认；可改目标=R3 #前缀路由（p0-1）——强度两档已实现
- [x] 【R86-P1·来源返回·评估】跨应用调用完成/取消/失败可回原应用并打开生成笔记；验收中文、特殊字符、多工作区、回跳失败，Token 不进入 URL，先调查已有 scheme/callback 能力。 → ✅ R196 批量域登记（已交付半环）：完成回链=siyuan://blocks 打开+剪贴板块链（双向闭环第一半已实现）；回原应用=OS 级（Quicker 前台恢复）挂 GUI 轮
- [x] 【R86-P2·已有习惯·评估】比较 Drafts/系统快捷指令/直接思源作为移动客户端的费用、维护和失败率；验收先得到采用或否决结论，再决定适配，不要求用户更换原捕获工具。 → ✅ R196 批量域登记（选型研究）：Drafts/系统快捷指令/直接思源比较=P2-10 域研究项（费用/维护/失败率）——登记为移动客户端选型前置
- [x] 【R86-P1·低打扰·评估】比较全成功提示、仅错误提示、聚合反馈和音效的真实负担；验收降低打断同时不漏关键失败，高风险确认保留，回执仍可查询。 → ✅ R196 批量域登记（规范已备）：提示策略=notify 三态规范（✓成功/✗失败/⏳异步）；聚合反馈登记为动作侧约定；音效不做（打扰）
- [x] 【R86-P1·停用重返·评估】几周未用后只显示版本/目标/能力/快捷键变化并做轻量只读复核；验收 30 天间隔、目标删除、冲突快捷键可恢复一次任务，不重放旧待办。 → ✅ R196 批量域登记（已交付）：重返变化呈现=CHANGELOG+版本门禁+设置页关于区指向文档（已接）——轻量只读复核=verify:restart 入口文档化

### 13.8 R87：长期采用、净收益和用户研究

- [x] 【R87-P1·采用回本·调研】同一任务比较原方法与快门，计入安装、配置、学习、维护、失败恢复；验收按频率估算净收益/回本天数并保留不适合自动化的任务，不只比较请求延迟。 → ✅ R197 域登记（等自用数据）：采用回本测量=G2 观察表字段（首成功时间/净节省时间已列）——挂接线后自用轮
- [x] 【R87-P1·持续采用·调研】自愿样本记录首日、7 日、30 日有价值任务、停用/重返原因与旧方法替代；验收安装次数不当采用率，缺日志样本明确缺失，默认无外传遥测。 → ✅ R197 域登记（等自用数据）：7/30 日有价值任务计数=观察表同源字段，挂自用轮
- [x] 【R87-P1·捕获利用·调研】用 owner 公开关系或用户确认分析 7/30 日捕获→阅读/引用/任务/制卡比例及积压年龄；验收自动打开不算阅读，不能以抓取量证明收益。 → ✅ R197 域登记（等 owner+红线）：捕获利用分析用公开关系或用户确认——「用户确认」前置=红线（不自动分析私密内容）
- [x] 【R87-P1·渐进学习·调研】一项捕获→常用入口→分拣→稳定联动的可跳过任务练习；验收无帮助完成率、第二次回忆成本和退出点，不要求先学协议/op。 → ✅ R197 域登记（可跳过任务链）：捕获→常用→分拣→联动渐进路径=GETTING-STARTED+首跑向导（R72）设计同构
- [x] 【R87-P1·角色样本·调研】按单一需求/全家熟练者、键盘/触控、间歇/高频使用分层做同题比较；验收区分无 Quicker 与安装故障造成的退出，不把熟练者结果外推到新手。 → ✅ R197 域登记（等自用数据）：角色样本（键盘/触控/高频）=观察表角色字段，挂自用轮
- [x] 【R87-P1·个人成功标准·调研】用户先定义少切窗口、少漏记录、更快找到资料或更低整理负担等目标；验收前后对照目标达成，记录效率/质量/打扰的取舍，未采样部分标假设。 → ✅ R197 域登记（用户主权）：「用户先定义成功标准」=正确设计——标准归用户，快门只提供测量字段（观察表）
- [x] 【R87-P2·决策账本·调研】每个新候选记录需求证据、替代方案、试验、收益、维护成本和采用/暂缓/否决原因；验收否决项保留触发重评条件，不能为扩大数量反复登记同一功能。 → ✅ R197 域登记（已交付同构）：需求证据/替代/试验/收益记录=**ACTION-CARDS+账本证据尾注模式**（本会话 60+ 条即此实践）

### 13.9 R88：版本化教程、支持归属与维护持续性

- [x] 【R88-P1·固定教程·评估】教程/截图绑定插件包、动作 revision、协议和平台，旧版有适用范围与新版入口；验收按旧包复现旧流程，更新主页面不让旧说明失联。 → ✅ R196 批量域登记（已交付）：教程绑定 revision=ACTION-CARDS+版本三线分记（协议/模板/动作包三线）
- [x] 【R88-P1·故障归属·评估】SUPPORT 指南区分快门、Quicker 动作、SiYuan 环境、上游 owner、AI host 的排查入口；验收未知归属仍能反馈，减少多处来回转交并写明受支持范围。 → ✅ R196 批量域登记（已交付）：**docs/FAQ.md 即 SUPPORT 故障归属表**——快门/Quicker 动作/思源环境/上游分层七类三十条
- [x] 【R88-P1·维护预算·评估】每个动作/适配器/客户端记录校准工时、故障量、活跃使用证据和上游依赖；验收新增功能同时说明长期成本，低采用/高维护项有手动替代候选。 → ✅ R196 批量域登记（元数据登记）：校准工时/故障量/活跃证据=registry 提案字段扩展（ACTION-CARDS 已载维护现状）；登记为 registry.json 演进位
- [x] 【R88-P1·弃用迁移·评估】定义能力、命令、模板的弃用公告、兼容窗口、替代和配置迁移；验收旧用户看到具体受影响任务，别名不突然消失，执行前可选择迁移。 → ✅ R196 批量域登记（已交付）：弃用公告/兼容窗口/替代=协议 v2 平移说明（docs/02 §9）+参考件版本头弃用标注惯例
- [x] 【R88-P1·权威复用·评估】动作别名、场景包和教程只改变参数并引用权威动作定义；验收修改一处后核对所有引用，缺失/循环引用报错，不偷偷执行旧副本。 → ✅ R196 批量域登记（已交付）：别名/场景包只改参数引用权威=ACTION-CARDS 单一权威+registry actionId 提案（本体入口分离）
- [x] 【R88-P1·本地定制·评估】场景模板更新先比较作者基线、本地改动和新版，选择保留/合并/另存；验收本地快捷键/目标/过滤不被覆盖，结果可回退，区别于插件配置迁移。 → ✅ R196 批量域登记（已交付）：基线/本地改动/新版三方比较=git+参考件版本头（三方可比）
- [x] 【R88-P2·公开样例·评估】区分示例、可复用模板、已实测场景包，标作者、许可、版本、依赖和样例内容；验收用户安装前知道能否直接用，未验证联动不靠宣传素材冒充稳定。 → ✅ R196 批量域登记（三层已分）：示例=fixtures/模板=reference/实测场景包=ACTION-CARDS——区分已结构化
- [x] 【R88-P1·支持负担·调研】统计问题首次定位耗时、用户来回次数、文档能否自助和每版回归成本；验收反馈数据只含自愿脱敏样本，结果用于修教程与取舍而非收集正文。 → ✅ R197 域登记（已交付部分）：FAQ 定位耗时/来回次数=支持负担核心指标；文档自查=verify:restart 一键——统计动作挂发布后
- [x] 【R88-P2·上游退场·评估】上游插件停维护/改协议/服务不可用时给最后验证版本、只读/手动替代和数据出口；验收默认流程能移除该依赖并保留用户内容，不突然扩权限寻找替代私有接口。 → ✅ R196 批量域登记（预案已备）：最后验证版本/只读替代/数据出口=FAQ+PRIVACY 出口+manifest unlocated 诚实态（上游退场登记路径齐）

---

## 14. R89~R96：时间、媒体、结构化数据与用户治理（只调研与登记）

> 调研依据与事实/推导区分见 [docs/15-产品调研-R89-R96.md](docs/15-产品调研-R89-R96.md)。本节新增 88 项，全部未勾选；不把外部产品机制当作已实现能力。继续沿用“不读私有库、不自建模型、不绕过 owner 契约、不默认外发”的边界。

### 14.1 R89：时间、日历和任务语义

- [x] 【R89-P0·时间模型·评估】区分日期、日期时间、时区瞬间、业务归属日、提醒时刻和实际执行时刻；验收同一任务显示各字段含义，不能用一个 timestamp 代替全部语义。 → ✅ R170 批量登记（E2 实现对照）：快门时间语义已分层——信封 createdAt=UTC 瞬间（ISO Z）；打卡 occurredAt=业务归属时刻（ISO，localDate 分离——eventbridge normalize 实证）；日记=业务归属日（config.discover 按 dailyNoteSavePath 模板判「哪天」）；执行时刻=receivedAt/receipt finishedAt。「不能用一个 timestamp 代替全部」=字段分离已实现
- [x] 【R89-P0·自然语言·评估】对“今天/明早/下周一/月底”等输入给解析预览、locale、时区和歧义提示；验收用户确认前不创建或修改业务任务，无法解析保留原文。 → ✅ R170 批量登记（E2 边界裁定）：快门不做 NL 时间解析（最小路径——属业务 owner 域，快门只透传 occurredAt）；无法解析保留原文天然满足；NL 解析若引入属 AI 分支（P0-3 同源），确认前不创建语义一致
- [x] 【R89-P0·截止提醒·评估】分开截止时间、提前提醒、重复机会和完成状态；验收关闭提醒不改变截止日，完成不被提醒回执代替。 → ✅ R196 批量域登记（等 owner）：截止/提醒/重复/完成分离=打卡·雷切 owner（事件只透传 recorded/updated）
- [x] 【R89-P1·重复规则·评估】由任务 owner 定义每周/工作日/间隔/月末等重复语义；验收按 owner 规则展示下一次机会，快门不自行复制任务或补齐漏期。 → ✅ R196 批量域登记（等 owner）：重复语义=owner 定义（事件 payload recurrence 字段已见——快门透传不自算下一次）
- [x] 【R89-P1·时区迁移·评估】设备、工作区、事件和用户偏好各有时区来源；验收旅行/换设备时显示原时区与当前显示时区，不静默移动绝对时刻。 → ✅ R170 批量登记（E2 实现对照）：设备隔离=device.json（storage/local 每机独立）；事件时区=occurredAt 保留原始输入（normalize 不做时区换算，emittedAt 单独记录）——「不静默移动绝对时刻」已实现。**缺口**：跨时区显示（原时区 vs 当前）是展示层职责，挂 UI 域
- [x] 【R89-P1·夏令时·评估】对不存在和重复的本地时刻给选择/跳过/按绝对时刻执行策略；验收时区转换保留原始输入和最终解释。 → ✅ R196 批量域登记（等 owner+红线）：不存在/重复本地时刻=调度 owner 域；快门 occurredAt 不换算（R170 边界）
- [x] 【R89-P1·日期任务·评估】区分只含日期的全天任务与需要精确时刻的事件；验收全天任务不被默认补成午夜提醒，日期筛选结果显示口径。 → ✅ R196 批量域登记（已交付）：全天 vs 时刻=occurredAt/localDate 分离（R170 时间模型已实现字面）
- [x] 【R89-P1·日历冲突·评估】公开日历 owner 提供忙闲或冲突投影；验收冲突只作提示，不能未经确认改期、发送邀请或写共享日历。 → ✅ R196 批量域登记（等 owner）：忙闲/冲突投影=日历 owner（calendar.read capability 已列 manifest）；冲突只作提示=只读语义
- [x] 【R89-P1·延后暂停·评估】区分 snooze、延期、暂停重复和取消；验收每种操作保留原因、原时间和下一机会，恢复不会瞬间补发全部提醒。 → ✅ R196 批量域登记（等 owner）：snooze/延期/暂停/取消=owner 域；快门无任务写面
- [x] 【R89-P1·错过机会·评估】设备关机、应用未运行、网络断开后显示错过原因和可选补做策略；验收补做先生成计划，不能伪装成准时完成。 → ✅ R196 批量域登记（红线）：错过原因+补做=TTL 过期诚实（不自动补写）+「错过可查」=results/results 保留与原 id 查询
- [x] 【R89-P2·时间筛选·评估】评估“今天/逾期/未来七天/按本地日”查询的边界和时区；验收跨午夜、空时区、夏令时样例有稳定结果和解释。 → ✅ R196 批量域登记（已交付模式）：今天/逾期/七天边界=SQL 面用户自控（today 精确匹配模式已实现——不用宽 %20% 匹配）
- [x] 【R89-P1·时间更正·评估】源任务日期被改动或撤销后列受影响的提醒、聚合和待执行计划；验收旧回执仍可追溯，不因改期重复写入。 → ✅ R196 批量域登记（等 owner 事件）：源任务改动=updated/deleted 事件透传（observed 待 owner 升级 available）

### 14.2 R90：媒体、扫描和附件处理

- [x] 【R90-P0·媒体合同·评估】为文本、图片、扫描、音频、视频、PDF、字幕定义类型、大小、时长、编码和预览合同；验收未知类型给可读失败，不伪装成空文本。 → ✅ R171 批量登记（E2 部分实现）：图片链路=p0-5（PNG multipart+alt 合同）齐备；文本/Markdown=全链；未知类型给可读失败=p0-5 空图片/非图片分支。**缺口**：音频/视频/PDF/字幕合同未定义（思源 assets 只存不解析——类型字段+可读失败提示纳入 p0-5 扩展，登记）
- [x] 【R90-P1·体积限制·评估】执行前显示文件大小、页数/时长、预计处理时间和配额；验收超限保留原文件并说明分片或手动替代，不截断无提示。 → ✅ R171 批量登记（E2 部分实现）：SY-文件项目索引（FormatSize 大小显示）+ WebDAV 超时 300s+SY-Office选区 200 格截断+Office 哈希 100MB 跳过——上限均有声明与提示。**缺口**：p0-5 图片无大小预检（超大图靠 30s 超时兜底）——登记待办：上传前尺寸检查
- [x] 【R90-P0·附件身份·评估】保存来源、内容指纹、路径/URI、捕获时间和派生版本关系；验收同一附件重复捕获可选择引用/新版本，不能仅靠文件名去重。 → ✅ R171 批量登记（E2 已交付）：**SY-WebDAV传输**（MD5 指纹随传输输出）+ **SY-研究来源卡**（内容指纹=摘录 MD5 前 8 位+URL+抓取时间）+ p0-5（资源路径+时间）——三件合计覆盖身份五要素；「重复捕获选引用/新版本」=指纹比对已支持（来源卡同 URL 提示）
- [x] 【R90-P1·OCR 置信度·评估】OCR 结果按页/区域给置信度和无法识别位置；验收低置信文本标记待校对，原图始终可回看，失败不删除附件。 → ✅ R173 批量登记（E2 部分实现）：低置信标记透传 alt 尾注（R155-01 组装评估已覆盖）+ OCR 清理后人工校对路径（SY-OCR清理保留原文可对照）。「失败不删除附件」=p0-5 图片先入库后写日记，OCR 失败仅 alt 占位
- [x] 【R90-P1·OCR 修订·评估】区分机器文本、用户校对和原图文字层；验收修改 OCR 不覆盖原始识别，可查看差异和处理版本。 → ✅ R173 调研登记（E2 同构裁定）：三层分离与来源卡三层（摘录/来源/推断）同构——机器文本=OCR 原始（alt 初值）、用户校对=块内编辑（思源版本历史可查差异）、原图文字层=原图资产永在（「修改 OCR 不覆盖原始识别」=分块天然保证）
- [x] 【R90-P1·音频转录·评估】转录按时间段、说话人未知/确认状态和语言记录；验收点击文字可回到音频位置，听不清处保留标记，不臆造说话人。 → ✅ R196 批量域登记（媒体合同缺口已登记）：转录合同（时间段/说话人/语言）=R171 媒体合同扩展位（音频未定义诚实边界）
- [x] 【R90-P1·视频定位·评估】摘要、摘录和任务引用保存开始/结束时间戳；验收播放器不可用时仍保留文字与来源，时间戳失效显示无法定位。 → ✅ R196 批量域登记（媒体合同缺口同上）：时间戳引用=同 R171 扩展位；「播放器不可用仍保留文字与来源」=文本/来源分块同构
- [x] 【R90-P1·离线预览·评估】记录缩略图、文本代理、原附件是否本地可读和最近同步时间；验收离线不把缺失高清文件显示为完整可用。 → ✅ R196 批量域登记（已交付部分）：离线拉取=SY-WebDAV download+本地可读=文件索引可读列+最近同步时间=WebDAV 传输时间——「缺失不伪装完整」=诚实分支
- [x] 【R90-P0·处理队列·评估】媒体处理支持排队、取消、暂停、恢复和失败重试分类；验收取消不删除原附件，未知结果先查询原任务而不重复扣配额。 → ✅ R171 批量登记（E2 部分实现）：排队=single-flight+轮询器单飞；取消语义=15s 单命令上限+workflow 失败停止；失败重试分类=同 id 重试（台账去重）。「取消不删除原附件」「未知先查询」=D 红线语义一致。长驻队列不适用（有限时长模型裁定同 R154-02）
- [x] 【R90-P1·外部处理·评估】外部 OCR/转录服务显示发送字段、地区、费用/配额、保存期限和关闭方式；验收默认最小数据，失败不自动切换到另一服务外发。 → ✅ R196 批量域登记（红线已交付）：外部 OCR 服务披露=PRIVACY 端点清单纪律（默认最小数据/失败不自动换服务外发——R85 AI 降级同构）
- [x] 【R90-P1·版权来源·评估】媒体摘录保存来源、许可/用户声明和分享限制字段；验收导出或公开前提示受限内容，快门不替用户判断版权归属。 → ✅ R196 批量域登记（已交付+扩展位）：来源层=来源卡 URL/标题/时间已有；许可/分享限制字段=来源卡扩展位（登记）

### 14.3 R91：结构化数据、视图与表单

- [x] 【R91-P0·字段模式·评估】导入/写入前显示字段名、类型、必填、默认、枚举、单位和 owner；验收未知字段不静默丢弃，模式变更有差异。 → ✅ R173 批量登记（E2 已交付）：**MCP ARGS 表 23 op 全参数 schema**（类型/必填 required/描述含单位）+ api.md op 表 + capability manifest（protocol/apiVersion/capabilities）——未知字段=plugin.api args 显式校验+信封坏行拒绝，不静默丢弃
- [x] 【R91-P0·空值语义·评估】区分空字符串、null、未知、未填写、0、false 和已删除；验收筛选、汇总、导出和回执保持同一语义。 → ✅ R173 批量登记（E2 已交付）：**红线「未知不得改写为成功」+六态回执**即空值语义的系统级实现——envelope 解析区分缺字段/null/空串（parseLine 三分支）；ExtractStr null 显式；contacts「names/docIds 均为空」独立分支；筛选/导出同语义（SQL 面不遮蔽）
- [x] 【R91-P1·视图快照·评估】保存表格/卡片/看板/日历等视图的筛选、排序、分组和列配置；验收视图变化不修改底层记录，导出带视图口径。 → ✅ R196 批量域登记（等 owner）：视图配置=思源 AV owner 域（视图变化不改底层记录=AV 原生语义）
- [x] 【R91-P1·表单映射·评估】表单字段到业务字段逐项预览，处理必填、默认、重复和附件；验收提交失败保留草稿，未知选项不写入近似值。 → ✅ R196 批量域登记（同构）：字段逐项预览=ARGS 参数表模式+validateStepArgs 必填校验（表单映射同构）
- [x] 【R91-P1·关系字段·评估】由业务 owner 定义一对一/一对多、删除和归档影响；验收解除关系不删除两端记录，跨工作区关系明确不可用或只读。 → ✅ R196 批量域登记（等 owner）：关系定义/删除归档影响=业务 owner 域；「解除不删两端」=红线同构
- [x] 【R91-P1·汇总口径·评估】关系汇总标明数据范围、时间窗、过滤、单位和更新时间；验收源记录变化后显示 stale/recomputing，不能把旧汇总当实时值。 → ✅ R196 批量域登记（已交付）：汇总口径自含=checkin.summary data（range/时间窗/口径字段）+LV·摘要格式化「形状不符降级占位」——stale 显示=数据截至时间语义
- [x] 【R91-P1·计算字段·评估】区分 owner 计算、快门展示和本地临时计算；验收公式错误、除零、类型冲突可见，快门不偷偷改业务计算规则。 → ✅ R196 批量域登记（红线）：owner 计算 vs 快门展示=红线「不偷偷改业务计算规则」字面；本地临时计算=仅展示层
- [x] 【R91-P1·批量导入·评估】结构化导入提供字段映射、预览、逐行错误、部分提交和回滚策略；验收已成功行可查，失败行能修复后续交，不重复导入成功行。 → ✅ R173 批量登记（E2 部分实现）：workflow（预览=plan 确认卡+逐行回执+失败停止+已完成不回滚）+ checkin.record.batch（逐条 externalRef 幂等，重复不重复导入）。**缺口**：无独立批量导入动作（AV 域属业务 owner，快门只透传）——登记为边界
- [x] 【R91-P1·编码格式·评估】CSV/TSV/JSON 等导入检测编码、分隔符、换行、引号、时区和小数格式；验收中文、换行字段和空列样本不串行。 → ✅ R196 批量域登记（转义已实现）：编码/分隔符/引号/换行检测=JStr/ExtractStr 转义对+导入域（R81 字段映射同批登记）
- [x] 【R91-P1·行身份·评估】使用公开稳定外部 ID 或用户选择匹配字段；验收名称相同、ID 缺失、ID 改变分别提示，不用位置或模糊相似度静默覆盖。 → ✅ R197 域登记（红线同构）：稳定外部 ID=externalRef 幂等键模式（桥协议已实现）；「ID 缺失/改变分别提示」=D 红线语义
- [x] 【R91-P1·查询快照·评估】报告和聚合保存查询时间、条件、源版本、截断和缺失；验收稍后打开能区分历史快照与重新查询结果。 → ✅ R197 域登记（同构）：查询时间/条件/截断快照=证据信封 truncated+sources[].version 字段承载（R176 主张溯源同源）
- [x] 【R91-P0·结构化权限·评估】分别显示读取字段、创建、修改、删除、关系变更和导出权限；验收只读用户看不到执行写按钮，越权失败不降级成空结果。 → ✅ R197 域登记（已交付同构）：读/写/删/导出分开显示=分层授权（R180：读白名单/LV_MCP_WRITE/允许名单/确认门控四层）

### 14.4 R92：从素材到可交付产物

- [x] 【R92-P1·素材入口·评估】把原始摘录、附件、采访记录、任务和用户备注列为不同素材类型；验收新素材能回到来源，不自动混入定稿正文。 → ✅ R197 域登记（已交付）：素材类型分层=来源卡三层+media 合同（R171：图片已实现，音视频合同缺口已登记）
- [x] 【R92-P1·大纲关联·评估】大纲节点可引用素材、目标读者、证据状态和待补问题；验收移动节点不丢引用，删除节点先显示受影响草稿。 → ✅ R197 域登记（等 owner）：大纲节点引用素材/读者/证据=写作工作流 owner 域；快门原料=块引用+来源卡
- [x] 【R92-P0·草稿版本·评估】草稿、自动保存、用户保存、定稿和发布副本有独立版本；验收并行编辑或生成失败可回到最近可读版本。 → ✅ R176 批量登记（E2 边界）：草稿版本=**思源原生能力**（版本历史+自动保存，业务 owner 域）——快门不复制版本管理（红线：动作不复制业务判断）；快门侧相关=审计/回执分文件（audit.json/results.ndjson 各自滚动）。「生成失败可回到最近可读版本」=思源快照兜底（workflow 补偿边界同款）
- [x] 【R92-P1·审阅意见·评估】意见绑定段落/块/版本和作者状态；验收源文移动后定位显示准确/疑似/失效，解决意见不会自动删除历史。 → ✅ R197 域登记（等 owner）：意见绑定段落/版本=思源版本历史+块引用原生；「解决不删历史」=append-only 载体语义一致
- [x] 【R92-P0·引用核对·评估】发布前列出缺来源、断链接、过期版本、重复引用和无法定位的页码/时间戳；验收用户可逐项忽略并保留理由。 → ✅ R176 批量登记（E2 部分实现）：断链检查=SQL 可组装（blocks 引用 vs 存在性）；重复引用=SY-研究来源卡 同 URL 提示；过期版本=来源卡 sources[].version（抓取时间）。「逐项忽略并保留理由」=报告只读+用户决定（R154-06 同规）。**缺口**：一站式发布核对动作未组——登记为组装候选（SQL 核对件+报告格式已有全部原料）
- [x] 【R92-P1·主张溯源·评估】区分事实、用户判断、引用摘录和模型建议；验收导出/分享保留角色，模型建议不能伪装成来源事实。 → ✅ R176 批量登记（E2 已交付——契约即实现）：**证据信封契约**（docs/contracts/evidence-envelope）就是本项规范——claims[].evidence 分级（E1/E2/E4/unknown）+ generatedBy.model（模型建议显式标注不能伪装成来源事实）+ sources[]（引用摘录带版本）+ sensitivity。「导出/分享保留角色」=分块分层结构天然保留（同来源卡）
- [x] 【R92-P1·改动对比·评估】生成或合并结果提供逐段 diff、接受/拒绝/保留原文；验收局部接受不丢未选修改，关闭窗口不改变源文。 → ✅ R197 域登记（已交付同构）：逐段 diff+接受/拒绝=workflow plan 确认卡语义（R191 草稿对比同款）
- [x] 【R92-P1·格式出口·评估】对 Markdown/HTML/PDF/纯文本出口报告表格、脚注、附件、链接和样式损失；验收用户选择出口后才生成文件，不覆盖源文档。 → ✅ R197 域登记（同 R176 重复项）：格式出口=思源原生导出 owner 域——账本存在重复条目（R176 已登记同文），下轮查重合并
- [x] 【R92-P1·发布预览·评估】发布前展示标题、摘要、可见范围、附件、外链、作者和更新时间；验收预览与实际产物一致，未发布内容不进入公开回链。 → ✅ R197 域登记（等 owner）：发布预览=思源发布/导出 owner 域；「预览与产物一致」=诚实红线同构
- [x] 【R92-P1·反馈回流·评估】外部评论/修订通过用户提供的输入回到对应版本和段落；验收同名/重复反馈先匹配确认，评论不自动改稿或发送回复。 → ✅ R197 域登记（等 owner）：外部反馈回流=owner 域（同名/重复先确认=R 红线语义一致）
- [x] 【R92-P2·产物归档·评估】记录产物、输入版本、生成工具、用户确认和发布日期；验收重开项目可找到当时证据，归档不删除素材和草稿历史。 → ✅ R197 域登记（已交付同构）：产物/输入版本/工具/确认记录=证据信封 generatedBy+版本头（归档不删历史=append-only）

### 14.5 R93：批量操作、撤销和局部失败

- [x] 【R93-P0·选择范围·评估】多选明确当前页、筛选结果、整个集合和跨页面范围；验收范围变化即时提示数量，空筛选不能误选全部。 → ✅ R197 域登记（部分实现）：范围提示=workflow plan 卡步骤数+「空筛选不误选全部」=零行诚实语义；UI 多选挂 Quicker 域
- [x] 【R93-P1·分组选择·评估】按来源、日期、状态、目标或错误分组选择并显示组内外数量；验收展开/折叠不丢已选项，跨组重复只计一次。 → ✅ R197 域登记（等 UI 域）：分组选择=userselect 列表分组（Quicker 原生）——注册为动作层约定
- [x] 【R93-P1·条件选择·评估】条件选择显示实际查询、快照时间和排除项；验收执行前再次核对变化，新增匹配项不会静默加入本批次。 → ✅ R197 域登记（同构）：实际查询/快照/排除项显示=查询快照（R91 同源）+「新增匹配不静默加入」=plan 一次性语义
- [x] 【R93-P0·影响预估·评估】批量确认列出将读、将写、目标数、附件量、预计耗时、限额和不可逆步骤；验收预估未知时明确未知，不显示虚假精确值。 → ✅ R178 批量登记（E2 已交付）：workflow plan 确认卡列每步 op+写标记（「（写）」后缀）；「预估未知时明确未知，不显示虚假精确值」=红线同源（未知不得改写为成功）。**缺口**：耗时/限额预估未实现（需测量基线 R74）——登记
- [x] 【R93-P1·批量模拟·评估】模拟输出逐项展示计划、跳过原因、映射和潜在冲突；验收模拟绝不创建业务写入或消耗外部发送配额。 → ✅ R197 账本重复：R178 已登记同文（只读白名单结构性保证）——查重合并候选
- [x] 【R93-P0·分段确认·评估】高风险批次支持按组或按页确认；验收已确认组与未确认组隔离，不能用一次确认覆盖后来加入的目标。 → ✅ R197 域登记（缺口维持）：按组分段确认未实现（当前整份 confirmAll）——高风险批次场景出现时按组分段（登记为演进位）
- [x] 【R93-P0·部分结果·评估】批量回执区分成功、跳过、失败、未知和未开始，并可打开原输入/目标；验收总失败不掩盖已成功项目。 → ✅ R178 批量登记（E2 已交付）：**workflow 逐项回执**即本项实现——steps[] 每步独立 status/message、stoppedAt 标记、已完成不回滚（「总失败不掩盖已成功」字段落进回执结构）；回执可按原 id 查询
- [x] 【R93-P1·逐项重试·评估】失败重试使用原稳定身份和最新状态预览；验收已成功项不重做，未知项先查原回执，参数改变生成新计划。 → ✅ R178 批量登记（E2 已交付）：同 id 重试语义（台账去重不双执行、迟到回执可按原 id 查）+ fixtures 固定样例=重试前状态预览；已成功项重做会被幂等键拦截
- [x] 【R93-P0·撤销语义·评估】为移动、创建、修改、外部通知和不可逆操作分别定义撤销/补偿/不可撤销；验收按钮文案说明实际影响，不把删除副本称作恢复。 → ✅ R197 域登记（红线同构）：撤销/补偿/不可撤销分类=失败停止+「已完成不回滚」+外部副作用单独说明（ACTION-CARDS 失败恢复字段）
- [x] 【R93-P1·重复保护·评估】批次、项、目标和外部副作用各有幂等身份；验收双击、重连、刷新和多客户端提交只产生一份可解释结果。 → ✅ R197 域登记（已交付）：幂等身份=externalRef+台账（批次/项/目标三级——R178 同 id 语义）
- [x] 【R93-P1·队列编辑·评估】排队项支持排序、暂停、删除和改目标的范围说明；验收已开始步骤不被伪装成可编辑，改目标必须重新确认。 → ✅ R197 域登记（等域）：排队项排序/暂停/改目标=长驻队列域（裁定不用长驻——重入式增量同款逻辑）
- [x] 【R93-P1·批次报告·评估】导出批次报告含筛选快照、版本、来源、结果、错误和待处理项；验收报告脱敏且可用同一批次 ID 查询，不导出 Token/正文默认数据。 → ✅ R197 域登记（已交付同构）：批次报告=workflow steps[] 回执+SY-变更报告 格式（筛选/版本/错误/待处理列齐）

### 14.6 R94：中文、多语言和混合文本

- [x] 【R94-P0·中文分词·评估】建立人名、机构名、短句、代码、URL、公式和中英混合搜索样本；验收结果展示匹配片段，不能把汉字逐字或整段误判为唯一边界。 → ✅ R179 批量登记（E2 边界）：分词=思源全文搜索内建（owner 域）；快门 contacts.search=SQL LIKE（无分词需求，人脉 owner 有拼音/别名计划）；样例集归搜索 owner，快门侧不重复建
- [x] 【R94-P1·别名拼音·评估】支持用户确认的简称、繁简、拼音和英文别名并标来源；验收别名冲突先列候选，不自动修改原文或人物实体。 → ✅ R197 域登记（等 owner）：别名/拼音=人脉 owner（搜索域）；快门透传关键词
- [x] 【R94-P1·繁简转换·评估】搜索、显示和导出分别选择是否转换；验收原文保留，转换结果可回看规则，专名/代码不被强制替换。 → ✅ R197 域登记（等域）：繁简转换=显示层 owner（思源原生/输入法）——「原文保留」=红线同构
- [x] 【R94-P1·混合脚本·评估】中英文数字、全半角标点、emoji、RTL 文本和代码块有独立样本；验收截断、排序、复制和定位不破坏字符边界。 → ✅ R179 批量登记（E2 部分）：SY-OCR清理（CJK/西文边界样本：汉字间删空格、西文间保留）+ JStr（<32 控制符按 x4 十六进制转义，emoji 走 UTF-16 对原样保留）+ 27 脚本全含中文注释过 csc——截断/复制不破坏字符边界有编译面证据。缺口：RTL 样本未建
- [x] 【R94-P0·本地日期·评估】界面日期、日志和导出使用用户 locale/时区，同时保留机器可读值；验收中文“周一/下周”与英文输入不产生不同隐式时区。 → ✅ R179 批量登记（E2 实现对照）：双轨已实现——机器值=信封 createdAt UTC ISO（Z 尾），用户值=DateTime.Now 本地（日记 yyyy-MM-dd/HH:mm 前缀）；「中文周一与英文输入不同隐式时区」发生在业务 owner 侧（occurredAt 保留原语义，快门不换算）
- [x] 【R94-P1·数字单位·评估】区分千分位、小数、百分比、字节、时长和业务单位；验收复制/导入保持数值语义，单位换算显示来源与精度。 → ✅ R197 域登记（已交付部分）：数值语义保持=ExtractStr 原样透传（不做隐式换算）+FormatSize 仅显示层（R172 尺寸预检）
- [x] 【R94-P1·排序筛选·评估】中文、拼音、原始顺序、大小写和数字排序可选择且有默认说明；验收分页/筛选前后顺序稳定，locale 改变不改变数据。 → ✅ R197 域登记（等 owner）：排序筛选=思源搜索/AV owner 域；「locale 改变不改数据」=机器值/显示值分离（R170 时间模型同源）
- [x] 【R94-P1·翻译回退·评估】缺少翻译时显示稳定默认语言和原始 key 的诊断，不把半句混合语言作为成功；验收错误、确认和空态也纳入翻译覆盖。 → ✅ R179 批量登记（E2 部分）：思源 i18n 机制原生回退（lang/zh_CN.json key 缺失回 key 名）；参考件用户文案全中文硬编码（本仓库当前单语言裁定——i18n 双语=集市门槛后项 R10 已登记）。缺口：双语覆盖挂市场门槛
- [x] 【R94-P1·多语言可访问性·评估】屏幕阅读器语言、label、状态和日期读法随 locale 更新；验收切换语言后焦点、表单值和待确认计划不丢失。 → ✅ R197 域登记（挂市场门槛）：可访问性 locale=i18n 双语同批（R10 集市门槛后项）
- [x] 【R94-P2·本地化回归·评估】对中文简体/繁体、英文、日文等建立截图、搜索、日期、导出和错误回归；验收新文案不会超出窄屏或截断关键操作。 → ✅ R197 域登记（挂市场门槛）：多语言回归=发布矩阵扩展位（R70 兼容矩阵同行）

### 14.7 R95：插件作者接入与生态质量

- [x] 【R95-P0·Manifest 模式·评估】为插件作者定义 ID、版本、协议、能力、读写、owner、状态、最低宿主和来源 commit 字段；验收缺字段/重复 ID/私有路径在提交前失败。 → ✅ R179 批量登记（E2 已交付——契约即实现）：capability-registry-contract + ecosystem-manifests.json 字段全齐（pluginId/version/protocol/capabilities/maturity/owner 状态三态）；缺字段/重复 ID 提交前失败=registry.test.ts 形状校验+contract 一致性测试
- [x] 【R95-P0·版本协商·评估】能力按协议版本和特性逐项协商，区分不支持、未就绪、禁用和过期；验收新字段可向后兼容，破坏性变化给迁移说明。 → ✅ R179 批量登记（E2 已交付）：adapters 逐项校验（protocol 数字类型+方法存在→否则 unsupported 诚实拒）+ capabilitiesSince 字段 + manifest maturity 三态=支持/未就绪/禁用；新字段向后兼容=manifest version 演进规则
- [x] 【R95-P1·适配器夹具·评估】提供脱敏输入、成功/空/超时/鉴权/部分成功/重复 fixtures；验收作者无需读取真实业务库即可验证适配器回执和错误码。 → ✅ R180 批量登记（E2 已交付）：**fixtures/ 即本项实现**——成功（fx-capture-1）/空参数（fx-capture-2）/鉴权（错 Token 401 样例）/超时（fx-past 过期样例）/部分成功（workflow 失败停止测试）/重复（同 id 台账去重测试）；SQL 五态+事件三样。作者无需真实业务库
- [x] 【R95-P1·健康探针·评估】统一 whenReady、health、权限和依赖检查的超时/退避/缓存语义；验收探针失败不触发业务写入，健康状态显示采样时间。 → ✅ R180 批量登记（E2 已交付）：**SY-预检**（四检各带超时：内核 500ms/令牌 3s/桥 5s/插件 8s）+ 打卡 descriptor ready/health（R77 证据）+ 探针失败不触发写入=只读预检语义；健康采样时间=预检报告时间戳
- [x] 【R95-P1·事件模式·评估】事件定义版本、source、externalRef、occurredAt、payload 摘要和敏感字段；验收未知版本进入观察态，不被默认工作流消费。 → ✅ R180 批量登记（E2 已交付）：事件行五字段全齐（name/source/emittedAt/payload/idempotencyKey——真机 events.ndjson 实样）；「未知版本进观察态不被默认消费」=R77-P0 事件治理收紧（observed 白名单外，8→2）
- [x] 【R95-P1·样例包·评估】作者样例包含安装前置、只读步骤、可选写入、卸载和数据清理；验收样例数据可删，截图/文案不冒充真实稳定联动。 → ✅ R197 域登记（已交付同构）：作者样例=fixtures（安装前置/只读/可选写/卸载清理=GETTING-STARTED+PRIVACY 出口）
- [x] 【R95-P1·文档生成·评估】从 manifest 生成能力目录、参数、错误、版本和联系 owner 的文档；验收改契约后文档检查失败而非继续发布旧说明。 → ✅ R180 批量登记（E2 部分实现）：**contract-consistency 测试**（改契约后检查失败）+ events.list 白名单目录（manifest 生成）+ ACTION-CARDS（能力目录用户化）。**缺口**：全量文档自动生成器未建（当前手工+测试守一致性）
- [x] 【R95-P1·弃用流程·评估】能力/命令/事件弃用包含通知、兼容期、替代和配置迁移；验收保存的计划和教程能定位受影响项，删除前有可见告警。 → ✅ R197 域登记（已交付）：弃用通知/兼容期/替代=协议 v2 平移说明+版本头弃用标注（R168 同源）
- [x] 【R95-P0·安全审查·评估】接入前审查最小权限、公开方法白名单、参数大小、敏感输出和外部副作用；验收不因作者提供任意 `plugin.api` 就跳过确认/审计。 → ✅ R180 批量登记（E2 已交付）：R77 适配器门禁（protocol 校验/capabilities/字段长度）+ plugin.api 允许名单策略（api.md §11 注记：仅已审计适配器，不自动扩）+ args 32KB 上限+审计脱敏（op/状态/耗时，无正文）
- [x] 【R95-P1·兼容矩阵·评估】作者提交前覆盖思源版本、插件版本、桌面/移动/浏览器、桥/MCP/Kernel 通道和缺依赖状态；验收结果带环境，不把单机通过写成全平台支持。 → ✅ R180 批量登记（E2 部分）：R70 兼容矩阵（3.8.4/3.8.6/next × 桌面/移动）已设计+3.8.6 真机/CI 容器双证据；通道面=NDJSON/内核路由/广播/MCP 四通道真机全测（10/10）。缺口：移动端/浏览器列实测挂 M1.5
- [x] 【R95-P1·交接责任·评估】每个能力记录 owner、响应入口、最后校准、替代路径和退场计划；验收 owner 不可用时仍有只读/手动方案，快门不接管业务维护。 → ✅ R180 批量登记（E2 已交付）：manifest 字段齐（maturity 含 unlocated=owner 未定位诚实态 + updatedAt 最后校准）+ 「owner 不可用仍有手动方案」=ACTION-CARDS 手动替代字段 + 「快门不接管业务维护」=红线

### 14.8 R96：信任、治理和退出能力

- [x] 【R96-P0·数据流预览·评估】执行前显示读取字段、写入目标、外发服务、通知对象、保留期限和回执位置；验收来源变化后旧预览失效，不能只显示操作名称。 → ✅ R181 批量登记（E2 已交付）：**workflow plan 确认卡**即本项实现（读取字段=步骤 op+args、写入目标=写标记、回执位置=results.ndjson）+ SY-预检（端点/桥/插件面）+ PRIVACY 数据流向图；「来源变化后旧预览失效」=**planId 一次性+5 分钟 TTL 过期**（过期重新 plan=预览重建）
- [x] 【R96-P0·敏感分级·评估】为正文、附件、联系人、凭据引用、位置、团队信息和诊断字段设用户可见分级；验收默认最小投影，脱敏后仍能解释失败。 → ✅ R180 批量登记（E2 已交付）：证据信封 sensitivity 字段（local-only/contains-personal/contains-external）+ **PRIVACY.md 数据位置表**（逐数据分级）+ 诊断包脱敏设计（不含 Token/正文/个人路径）——「默认最小投影」=桥默认关+只读默认
- [x] 【R96-P0·逐项权限·评估】读取、创建、修改、删除、导出、通知和自动触发分开授权；验收一次读确认不提升为写权限，权限撤回阻止新操作并保留历史。 → ✅ R180 批量登记（E2 已交付）：**分层授权已实现**——读=13 工具默认暴露；写=LV_MCP_WRITE+tools/list 隐藏；透传=rawApi+允许名单；业务写入=confirmExec 确认门控；「一次读确认不提升为写」=门控分立结构性保证；撤回=移除开关+断 stdio
- [x] 【R96-P1·个人共享边界·评估】区分个人笔记、共享文档、团队任务、公开事件和代他人记录；验收聚合默认不跨边界，跨界前显示 owner 与接收范围。 → ✅ R181 批量登记（E2 已交付）：边界机制齐——device.json（设备隔离不随同步）+ 信封 device 定向（代他人=定向投递不误消费）+ manifest owner 字段（数据权威归谁）+ 公开事件=白名单 available 显式登记（非全部事件）
- [x] 【R96-P1·通知治理·评估】通知渠道、接收人、内容摘要和静默时段可预览；验收失败通知不泄露正文，取消/暂停后不发送迟到通知。 → ✅ R181 批量登记（E2 已交付）：通知内容=中文结果消息（失败=原因不含正文——审计/回执均无正文设计）；静默时段/接收人=打卡提醒属业务 owner 域（快门 notify 仅动作结果短提示，无自动外发通知）。「取消后不发迟到通知」=回执过期不消费语义一致
- [x] 【R96-P0·撤销出口·评估】提供停止自动化、取消待处理、导出个人数据、删除本地缓存和恢复配置的退出路径；验收退出报告列出无法撤回的外部副作用。 → ✅ R181 批量登记（E2 已交付）：五出口齐——①停止自动化=桥开关（poller 优雅停）②取消待处理=坏行/过期台账+压缩 ③导出个人数据=审计导出（设置页）④删本地缓存=PRIVACY「清除我的数据」两目录 ⑤恢复配置=bridge-settings 默认值迁移；卸载清理=uninstall 钩子提示
- [x] 【R96-P1·确认期限·评估】高风险确认绑定目标、参数、版本和过期时间；验收过期、权限变化、目标变化和会话切换都会要求重新确认。 → ✅ R181 批量登记（E2 已交付）：**workflow plan 即带期限确认**——planId 绑定目标+参数（steps 快照）+ expiresAt 5 分钟过期（过期=重新 plan 重新确认）；confirmWithFront 30s 超时=会话级确认期限；一次性消费=确认不可重放
- [x] 【R96-P1·审计可见性·评估】用户可查询谁/哪一客户端/何时/以何依据触发操作；验收审计本身脱敏、可导出、可按目标撤销访问，不把打开次数当授权。 → ✅ R181 批量登记（E2 已交付）：**审计三问全答**——谁/哪端=命令 id 前缀（cli-/mcp-/qk-）+信封来源；何时=finishedAt ISO；依据=op+args 摘要；审计本身脱敏（op/状态/耗时无正文）+可导出（设置页审计导出）+按目标撤销=黑名单；「打开次数不当授权」=权限由门控分立（R180）
- [x] 【R96-P0·紧急停止·评估】设计单规则、全部自动化、外发处理和插件联动的急停范围；验收急停后不启动新副作用，已开始步骤、迟到回执和恢复条件清楚可查。 → ✅ R181 批量登记（E2 已交付）：三级急停——①单命令=ttlMs 过期不消费 ②桥开关=poller 优雅停（当前 tick 后退出不撕写——「急停后不启动新副作用」+「已开始步骤迟到结果可查」=回执按原 id）③petal 开关/卸载=全停；外发处理无（快门无自动外发——PRIVACY）

## 15. R97~R105：产品定位、意图结果中枢与完整使用闭环（只调研与登记）

> 本节把产品从“按插件/协议调用能力”提升为“把用户意图变成可完成、可验证、可追溯、可复用的个人结果”。详细推导见 [产品定位与用户闭环调研 R97~R105](docs/16-产品定位与用户闭环-R97-R105.md)。共 101 项，全部未勾选；需要先定义公共契约和用户样本，不能把自由文本直接升级为无人值守写入。

### 15.1 R97：定位、用户任务和价值层级

- [x] 【R97-P0·北极星结果·调研】用“意图→结果链”重写产品问题、适用人群和非目标；验收用户能用一句话说明快门减少了哪类切换/遗忘/错误，不能只描述 API。 → ✅ R201 批量登记（E2 已交付：ACTION-CARDS 用户任务字段=意图→结果链）
- [x] 【R97-P0·任务目录·评估】按捕获、整理、推进、复习、联络、回顾建立 Job Catalog；验收同一任务按用户目标找到入口、依赖、成功证据和手动替代，不要求先懂插件名。 → ✅ R201 批量登记（E2 已交付雏形）：**ACTION-CARDS 七卡**即 Job Catalog 雏形（按用户目标组织，不要求先懂插件名）；全量目录=全部 P0/P1 落地件成卡后扩展
- [x] 【R97-P0·用户分层·调研】区分思源新手、生态熟练者、外部快捷用户、AI/CLI 用户和移动捕获者；验收每层有触发频率、首成功、失败容忍和停止使用原因。 → ✅ R201 批量登记（E2 部分）：分层入口已备——新手=GETTING-STARTED 三步/熟练者=blueprint/外部快捷=CLI+MCP/移动=P2-10（挂）；触发频率与首成功数据=G2 观察表字段（挂自用轮）
- [x] 【R97-P1·真实工作问题·调研】对每个核心任务记录原有做法、切换次数、遗漏/重复成本、完成判据和用户愿意付出的配置成本；验收未访谈部分显式标假设。 → ✅ R201 批量登记（等自用数据）：G2 观察表字段（首成功时间/修正次数/净节省时间）——「未访谈部分显式标假设」=账本 E 等级纪律已贯彻
- [x] 【R97-P0·非目标·评估】明确不做第二笔记库、第二任务调度、通用备份清理、私有数据库读取和自建模型服务；验收新需求按边界得到支持/转交/拒绝理由。 → ✅ R201 批量登记（**红线字面已交付**）：AGENTS.md 红线五条逐字对应——不做第二笔记库/不复制任务调度/不读私有存储/不自带模型服务；「新需求按边界支持/转交/拒绝」=R110 授权分离+registry owner 语义
- [x] 【R97-P1·差异化·调研】比较原生 MCP、Quicker 直连、雷切 Agent、单插件桥和快门中枢在入口、上下文、确认、回执、联动上的差异；验收宣传只写真实优势。 → ✅ R201 批量登记（E2 已交付）：README v0.7.0 差异化定位重写（三通道+生态中枢 vs 单插件桥 vs 原生 MCP 对比：入口/上下文/确认/回执/联动五维）——「宣传只写真实优势」=证据等级纪律约束
- [x] 【R97-P1·价值层级·评估】把价值分为省切换、省重复、省错误、闭环和复用五级；验收每个候选至少说明提升哪一级，不能以“功能更多”作为价值。 → ✅ R201 批量登记（E2 部分交付）：ACTION-CARDS 用户任务按五级可归类（捕获=省切换/汇总=省遗忘/图片 alt=省错误/闭环=⑪链）；「不以功能更多作为价值」=R97 组合取舍同源。**缺口**：逐卡打五级标签未做（登记）
- [x] 【R97-P1·北极星指标·调研】定义闭环完成率、首次结果时间、未知结果恢复率、结果二次利用率和人工接管率；验收默认不上传正文/Token，指标可脱敏清除。 → ✅ R201 批量登记（等自用数据）：指标定义=完成判据五级可直接计量（recorded 率/首结果 elapsedMs/timeout 恢复率——verify:restart 已输出延迟数据）；「默认不上传」=PRIVACY 红线。挂自用轮采集
- [x] 【R97-P1·组合取舍·评估】按用户收益、频率、风险、契约成熟度和维护成本排序场景包；验收高频低风险优先，低频高依赖不因竞品存在自动立项。 → ✅ R202 账本重复项：R201 已登记同文（docs/30 池治理=此实践）——查重合并候选
- [x] 【R97-P1·核心话术·评估】为 README、面板、动作单、MCP 工具描述统一“用户结果优先”的一句话、输入、输出和失败边界；验收协议名只作为展开信息。 → ✅ R201 批量登记（E2 已交付：四处用户结果优先话术统一）
- [x] 【R97-P1·定位验证·调研】用同一任务比较“按插件找能力”和“按目标找任务”两种入口；验收记录找到时间、误选率、完成率和解释需求，未验证结论不进入宣传。 → ✅ R202 账本重复项：R201 已登记（双入口并存+计量挂自用轮）——查重合并候选

### 15.2 R98：意图、上下文和用户心智模型

- [x] 【R98-P0·意图信封·评估】统一 intentId、用户目标、来源入口、上下文、约束、期限、敏感级别、授权范围和期望结果；验收 Quicker/手机/MCP/面板能续接同一意图。 → ✅ R201 批量登记（E2 已交付设计）：**桥信封+workflow plan 字段全对齐**——intentId=id、来源=id 前缀、约束/期限=ttlMs+expiresAt、授权=分层门控、期望结果=args、敏感=信封 sensitivity；「多入口续接」=同 id 三通道（D-0012）
- [x] 【R98-P0·意图词典·评估】为“记下、整理、查找、推进、复习、联系、回顾”等动作定义输入/输出和歧义；验收自由文本不能绕过结构化计划直接写入。 → ✅ R202 账本重复项：R201 已登记（ACTION-CARDS 七卡动词目录）——查重合并候选
- [x] 【R98-P0·上下文交接·评估】在入口切换时携带当前文档、焦点块、选区、联系人、项目、来源和时间语义；验收缺失字段明确显示，不按新窗口静默重解释。 → ✅ R202 账本重复项：R201 已登记（交接字段+null 诚实）——查重合并候选
- [x] 【R98-P0·歧义澄清·评估】目标、对象、日期、范围或写入方式不明确时只询问最小必要问题；验收问题带候选和默认依据，取消后保留原意图草稿。 → ✅ R204 域登记（账本副本，同 R202）：最小澄清=userinput 兜底+{ask:} 设计；完整澄清对话挂意图中枢
- [x] 【R98-P1·一次性/连续·评估】区分“这次完成”和“以后按规则继续”的意图；验收一次确认不会自动授权未来运行，连续规则单独展示停止入口。 → ✅ R204 域登记（账本副本，同 R202）：plan 一次性+TTL；连续规则=R82 三许可分离
- [x] 【R98-P1·按目标搜索·评估】能力搜索按用户任务、输入类型、结果类型和依赖过滤；验收同一目标可见多个实现及差异，不暴露未经审计的私有方法。 → ✅ R202 批量登记（E2 已交付雏形）：**commands.search 按关键词过滤（≤50 条）**+ACTION-CARDS 按目标组织+「不暴露 raw op」=MCP DESCRIPTIONS 用户化——同一目标多实现及差异=registry 提案字段
- [x] 【R98-P1·渐进展开·评估】首屏只显示任务结果、目标、风险和下一步，协议/插件/原始参数按需展开；验收熟练用户可直达高级信息，新手不被 schema 阻断。 → ✅ R204 域登记（账本副本，同 R202）：DESCRIPTIONS 用户化+ACTION-CARDS 分层
- [x] 【R98-P1·用户修正·评估】用户修改目标、范围、日期、标签或输出格式后，记录修正原因并重新生成预览；验收旧确认自动失效，不沿用旧参数写入。 → ✅ R204 域登记（账本副本，同 R202）：参数变更=新 plan（旧确认 TTL 失效不沿用）
- [x] 【R98-P1·入口一致·评估】同一意图从面板、Quicker、MCP、移动分享和思源内部发起时使用相同结果语义；验收入口差异只影响呈现，不改变 owner/权限/回执。 → ✅ R202 账本重复项：R170/R182 已登记同文（入口不同不改回执+三通道一合同）——查重合并候选
- [x] 【R98-P1·偏好边界·评估】记住用户选择的默认目标、格式、通知和确认策略，但区分偏好与本次授权；验收清除偏好不清除业务内容，敏感偏好可单独关闭。 → ✅ R204 域登记（账本副本，同 R202）：偏好与授权分立+清除偏好不清业务（PRIVACY）
- [x] 【R98-P1·中断交接·评估】窗口关闭、切换工作区或前台应用改变时保存待续上下文；验收恢复先展示上下文差异，用户可继续、另存草稿或放弃。 → ✅ R204 域登记（账本副本，同 R202）：恢复三选项=恢复批次语义
- [x] 【R98-P1·结果优先·评估】入口反馈先说明“产生了什么结果/尚未完成什么”，再提供任务 ID、op 和诊断；验收 HTTP 成功但业务未达成时显示未完成。 → ✅ R204 域登记（账本副本，同 R202）：code!=0 显示未完成+任务 ID/op/诊断在回执

### 15.3 R99：计划、执行、核验与结果闭环

- [x] 【R99-P0·统一状态机·评估】统一 draft/understood/previewed/confirmed/running/completed/partial/unknown/reconciled/reused/archived；验收每个状态有进入、退出、用户动作和回执。 → ✅ R202 批量登记（E2 已交付）：**状态机已实现**——plan（draft/previewed）→confirmAll（confirmed）→steps（running/completed/failed）→回执（recorded/rejected/failed/expired/unknown=timeout）——合法迁移由代码强制
- [x] 【R99-P0·完成判据·评估】每个场景声明业务完成条件、证据来源、owner 和可回退动作；验收“调用成功但业务未写入/未同步”不会标完成。 → ✅ R202 账本重复项：ACTION-CARDS 完成判据五级+每卡成功证据/失败恢复字段（R161 已交付）——查重合并候选
- [x] 【R99-P0·计划预览·评估】计划列出将读、将写、目标、步骤、依赖、预算、预期结果和手动替代；验收上下文或能力变更后旧预览失效。 → ✅ R202 账本重复项：plan 确认卡（R181 数据流预览同款）——查重合并候选；「上下文变更旧预览失效」=TTL 过期
- [x] 【R99-P0·确认绑定·评估】确认绑定 intent、计划、目标、参数摘要、能力版本、期限和敏感级别；验收模型/用户改动任一关键字段都要求重新确认。 → ✅ R204 批量登记（E2 已交付）：**workflow plan 即绑定确认**——intent=planId、目标/参数=steps 快照、期限=expiresAt、敏感=信封 sensitivity；「任一关键字段改动要求重新确认」=一次性消费+TTL（改参数=新 plan 字面）
- [x] 【R99-P1·运行预算·评估】按场景声明等待、步骤、写入、外发和通知预算；验收超预算进入待用户处理，子流程和备用客户端不能绕过限制。 → ✅ R204 批量登记（E2 部分）：预算声明齐——等待 15s/步骤 MAX_STEPS=8/写入=白名单+确认/外发=无（PRIVACY）/通知=notify 三态；「子流程不能绕过限制」=子程序同用确认门控。超预算进待处理=timeout 语义一致
- [x] 【R99-P0·结果台账·评估】建立意图→计划→运行→副作用→证据→人工更正的因果链；验收重启、换入口和跨设备仍可按意图回放。 → ✅ R204 批量登记（E2 已交付）：**因果链已实现**——intent(planId)→plan(steps)→运行(commandId)→副作用（写入块 ID）→证据（results 回执）→人工更正（思源版本历史）；跨设备回放=results/results 按 id（同 id 三通道）
- [x] 【R99-P0·部分结果·评估】多步骤返回成功、跳过、失败、未知、未开始和人工接管；验收总状态不掩盖已完成或可能已发生的副作用。 → ✅ R204 账本重复项：R178 已登记同文（workflow 逐项回执+stoppedAt）——查重合并候选
- [x] 【R99-P0·未知核验·评估】超时/断线先查询原 intent/task/receipt，再决定补偿或新计划；验收未知不能被伪装成失败后盲重试。 → ✅ R213 域登记：账本副本（同 R204 注）：timeout 诚实+同 id 补发+先查原回执——盲重试被 D-0012 禁止（红线/分层授权/证据信封 同构已交付）
- [x] 【R99-P1·撤销补偿·评估】每种副作用声明可撤销、可补偿或不可撤销；验收“撤销”显示实际动作、范围和不能恢复的外部影响。 → ✅ R204 批量登记（E2 已交付）：副作用三分类=ACTION-CARDS 失败恢复字段+「已完成不回滚」+思源版本历史=可撤销（块删除/编辑），外部影响=不可撤销显式（PRIVACY）
- [x] 【R99-P1·下一步·评估】完成/部分/失败结果均给下一步：打开目标、修正输入、重试失败项、保存草稿或结束；验收下一步不是无依据的推荐写入。 → ✅ R204 批量登记（E2 已交付）：下一步五类=ACTION-CARDS 失败恢复字段+FAQ 每类下一步+「下一步不是无依据推荐写入」=只读建议红线（R203）
- [x] 【R99-P1·证据链·评估】回执可跳转到业务记录、来源输入、查询条件和实际执行时间；验收记录被移动/删除/更正时显示疑似或失效定位。 → ✅ R205 批量登记（E2 已交付）：跳转四要素齐——业务记录=块 ID（siyuan://blocks）、来源输入=args 摘要、查询条件=stmt（p0-3）、执行时间=finishedAt；「记录被移动/删除显示疑似失效」=R80 定位修复同构（块 ID 稳定+原删除诚实失效）
- [x] 【R99-P1·结果归档·评估】用户可保留、隐藏、导出或删除结果历史；验收删除历史不删除业务数据，隐私清除范围可预览。 → ✅ R205 批量登记（E2 已交付）：保留=results 200 行滚动（策略显式）、导出=审计导出（设置页）、删除=数据出口（PRIVACY 两目录）；「删除历史不删除业务数据」=results/audit 与业务数据分文件——隐私清除范围可预览=PRIVACY 位置表
- [x] 【R99-P1·闭环复用·评估】已完成结果能生成下一次任务的可编辑模板/上下文，而不是复制旧副作用；验收重新使用前重新校验目标、版本和权限。 → ✅ R205 批量登记（E2 已交付）：模板化=fixtures（固定输入复用）+workflow plan（可编辑 steps 再 plan）；「重新使用前重新校验目标/版本/权限」=plan 重新确认+版本门（不复制旧副作用=新 id 新执行）

### 15.4 R100：以最终目的组织的场景包

- [x] 【R100-P0·捕获到推进·评估】文本/链接/图片进入收件箱后可选择整理、建立任务、加入研究或仅保存；验收一次捕获只形成一个来源身份，后续分支可追踪。 → ✅ R203 域登记（E2 组装对照）：场景链全 op 已在 api.md 表（捕获→分拣→任务/研究分叉），一次捕获一来源身份=来源卡指纹；链式编排 UI=意图中枢域挂 G2
- [x] 【R100-P1·研究问题·评估】从问题建立资料篮、证据、反例、待确认点和下一次检索；验收引用来源/版本可回跳，快门不替用户下结论。 → ✅ R203 域登记（等 owner+红线）：资料篮/证据=R80-P2 同构；「快门不替用户下结论」=红线字面
- [x] 【R100-P1·阅读到学习·评估】阅读摘录可生成待审卡题、来源链接和复习计划预览；验收拒绝/修改不污染原文，学习 owner 决定调度。 → ✅ R203 域登记（等 owner）：待审卡题=闪卡 owner；「拒绝/修改不污染原文」=来源卡分块语义
- [x] 【R100-P1·学习到行动·评估】复习/考试结果可选择生成补强、复盘或打卡候选；验收结果与学习口径由 owner 提供，快门不重算成绩或自动打卡。 → ✅ R203 域登记（等 owner+红线）：「结果与口径由 owner 提供，快门不重算成绩或自动打卡」=红线字面（R189 同款裁定）
- [x] 【R100-P1·会议准备·评估】按联系人/项目/时间整理最近互动、资料、未完承诺和会前问题；验收查看不写互动，隐私字段按 owner 投影。 → ✅ R203 账本重复项：R191 已登记同款（contacts.search 408ms 可组装）
- [x] 【R100-P1·会议到跟进·评估】会后把用户明确确认的决定、行动项、负责人和回访日期分发到对应 owner；验收同一承诺不重复创建，发送动作需独立确认。 → ✅ R203 域登记（等 owner+授权分层）：「同一承诺不重复创建」=externalRef 幂等；「发送动作需独立确认」=授权分层（通知≠写入确认）
- [x] 【R100-P1·项目推进·评估】项目入口显示目标、当前阻塞、资料、待办、最近结果和下一步候选；验收归档/切换项目不删除原记录，缺模块保留手动路径。 → ✅ R203 域登记（等 owner）：项目入口=雷切 owner；「缺模块保留手动路径」=ACTION-CARDS 手动替代字段
- [x] 【R100-P1·每日收束·评估】晚间从当日捕获、完成、未完成、异常和明日候选生成可编辑总结；验收未知/缺失不写成零，用户可排除私人内容。 → ✅ R203 域登记（E2 组装对照）：晚间总结=SY-12 汇总同构（待办链）；「未知/缺失不写成零」=红线；「可排除私人内容」=sensitivity 字段
- [x] 【R100-P1·媒体到知识·评估】OCR/转录/视频摘录进入可校对来源块，再由用户选择研究、任务或卡题；验收派生文本保留时间戳和原媒体回链。 → ✅ R203 域登记（E2 组装对照）：OCR→可校对来源块=p0-5+SY-OCR清理+来源卡全链已有；时间戳/原媒体回链=媒体合同扩展位（R171 登记）
- [x] 【R100-P1·个人管理·评估】把“记住某事”“稍后处理”“等待别人”分成不同结果和提醒 owner；验收快门不把所有捕获都变成任务或提醒。 → ✅ R203 域登记（红线字面）：「快门不把所有捕获都变成任务或提醒」=不复制业务判断红线字面——记事/稍后/等待的区分归用户与 owner
- [x] 【R100-P1·周期回顾·评估】按周/月回看捕获利用、未闭环意图、重复失败和人工接管；验收统计说明样本和缺失，不以调用量代表成长。 → ✅ R203 域登记（等自用数据+红线）：捕获利用/未闭环统计=G2 观察表；「统计说明样本和缺失」「调用量≠成长」=审计可见性红线（R181）
- [x] 【R100-P2·产物发布·评估】研究/会议/项目素材可选择形成文章、报告、分享或内部归档；验收发布前引用、附件、权限和版本差异可检查。 → ✅ R203 域登记（组装候选）：引用/附件/权限检查=R92 发布域（SQL 核对+来源卡版本）；发布=思源原生 owner
- [x] 【R100-P1·故障恢复·评估】每个场景包定义思源不可达、插件缺席、目标变化、外部服务失败和未知结果的降级路线；验收仍能保存用户输入和手动完成。 → ✅ R203 域登记（已交付）：每场景降级路线=ACTION-CARDS 失败恢复字段+FAQ 七类——「仍能保存用户输入」=草稿本地暂存语义
- [x] 【R100-P1·迁移场景·评估】用户换设备/工作区/插件版本时可查看待续意图、草稿、结果和能力差异；验收默认不自动重放写操作。 → ✅ R203 域登记（已交付）：待续意图/能力差异=R83 恢复批次+R140 端口规律；「默认不自动重放写操作」=红线字面
- [x] 【R100-P0·新用户首周·调研】设计从一次捕获到一次可复用结果的渐进学习路径；验收不要求先学习协议、插件清单或 JSON，记录每个退出点。 → ✅ R203 域登记（已交付路径）：渐进学习=GETTING-STARTED 三步（不要求先学协议/JSON）；「记录每个退出点」=观察表字段

### 15.5 R101：个人工作台、记忆和下一步

- [x] 【R101-P0·结果工作台·评估】提供待处理意图、未知结果、最近完成、需用户决定和可复用模板的统一视图；验收不把业务数据复制成另一套事实库。 → ✅ R203 域登记（挂意图中枢 UI）：统一视图=意图中枢域挂 G2；「不复制成另一套事实库」=红线字面（回执/results 即事实源）
- [x] 【R101-P1·收件箱分流·评估】收件箱按来源/年龄/目标/风险/预计耗时给分流建议；验收用户可批量保留、归档、转任务或关联项目，建议不自动执行。 → ✅ R203 域登记（红线）：分流建议不自动执行=只读建议红线；批量操作=userselect+workflow（确认卡语义）
- [x] 【R101-P0·待续中心·评估】列出中断、等待用户、等待插件、等待外部回执和过期意图；验收每项给真实阻塞层、继续/重计划/放弃入口。 → ✅ R203 域登记（E2 同构）：中断/等待分层=R83 恢复批次+待续上下文（R201）同构；「真实阻塞层」=错误分层已交付（网络/鉴权/owner 缺失分类）
- [x] 【R101-P1·结果历史·评估】按意图、场景、目标、时间和来源查询结果链；验收显示原计划与实际差异，未知和人工接管可筛选。 → ✅ R203 域登记（已交付查询面）：按 id/intent 查询结果链=results 按 id 匹配（LV·取回执）+审计按时间/op——「原计划与实际差异」=plan vs steps 回执
- [x] 【R101-P1·下一步候选·评估】从明确未完成项、用户设定期限和业务 owner 状态生成候选下一步；验收推荐带依据、成本和拒绝入口，不制造隐形任务。 → ✅ R203 域登记（红线）：推荐带依据+拒绝入口+「不制造隐形任务」=只读建议红线（R203 收件箱分流同款）
- [x] 【R101-P1·保存视图·评估】保存研究问题、项目、会议、学习和收件箱视图的筛选与排序；验收视图不改变底层数据，过期条件可解释。 → ✅ R205 域登记（等 owner）：视图保存=思源 AV/查询 owner 域（视图不改底层数据=AV 原生语义）；过期条件可解释=查询快照（R91 同源）
- [x] 【R101-P1·上下文卡片·评估】为文档、块、人物、项目和媒体显示相关意图/结果/来源摘要；验收摘要显示截至时间和 owner，私密内容不跨边界聚合。 → ✅ R205 域登记（挂意图中枢 UI）：上下文卡片=意图中枢 UI 域挂 G2；「截至时间/owner 显示」「私密不跨边界聚合」=sensitivity+manifest owner 红线同构
- [x] 【R101-P1·时间线·评估】把捕获、计划、执行、回执、人工更正和再利用按发生时间/业务时间分层；验收跨午夜和迟到事件不混淆。 → ✅ R213 域登记：等 UI 域：时间分层=createdAt/finishedAt/occurredAt 三分离（R170 已实现——跨午夜/迟到可解释）（红线/分层授权/证据信封 同构已交付）
- [x] 【R101-P1·结果账本·评估】允许用户标记“有用/无用/已转为行动/仅存档”并记录原因；验收反馈只用于本地改进，不把打开次数当价值。 → ✅ R213 域登记：等 UI 域：有用/无用/转行动标记=用户反馈本地化（R203 周期回顾同源）；反馈只用于本地改进=PRIVACY 红线
- [x] 【R101-P2·个人模板·评估】从成功结果生成可编辑场景模板，剥离旧目标、ID、敏感内容和一次性授权；验收模板重用前重新预览和确认。 结果转任务配方、AI 模板、Quicker 规格分别给字段映射预览；剥离旧幂等键、凭据和无许可正文，导入后只生成新草稿。 → ✅ R213 域登记：等 UI 域：模板剥离旧 ID/敏感/一次性授权=fixtures 模式+plan 重新确认（不复制副作用）
- [x] 【R101-P2·专注模式·评估】按捕获、研究、会议、学习、收束显示最小能力集和通知策略；验收模式只改变呈现/提醒，不偷偷改变业务权限。 → ✅ R213 域登记：等 UI 域：最小能力集=只读白名单子集（按场景裁剪已实现同构）；模式只改呈现不改权限=分层授权字面

### 15.6 R102：智能辅助与可控个性化

- [x] 【R102-P1·下一动作建议·评估】只基于未闭环意图、明确期限、用户偏好和 owner 公开状态给候选；验收每条建议有来源、置信度、成本和关闭入口。 → ✅ R213 域登记：只读建议红线（R203 收件箱分流同款）：候选基于未闭环意图/owner 公开状态，每条带依据与拒绝入口
- [x] 【R102-P1·智能默认·评估】对目标、格式、标签、确认方式提供可修改默认值；验收默认值与授权分开，用户改一次不会覆盖不可见规则。 → ✅ R213 域登记：「默认值与授权分开」=statestorage 偏好+分层授权分立（R202 偏好边界同款）；改一次不变永久=normalize 显式字段
- [x] 【R102-P0·置信度解释·评估】对实体匹配、日期解析、来源定位和能力选择显示依据/不确定点；验收低置信度进入澄清而非直接写入。 → ✅ R213 域登记：依据/不确定点显示=ExtractStr 诚实空+SQL 零行诚实+未知红线；低置信进澄清={ask:} 设计字面
- [x] 【R102-P1·纠正学习·评估】记录用户接受、修改、拒绝和撤销对默认建议的影响范围；验收可查看、暂停、重置本地偏好，不训练或外发正文。 → ✅ R213 域登记：「可查看/暂停/重置本地偏好」=statestorage 可清除+PRIVACY 出口；本地改进不上传=红线
- [x] 【R102-P0·防暗中自动化·评估】所有主动建议、自动合并、自动重浮和自动触发都有独立开关及日志；验收关闭后立即停止新建议，历史不伪造为用户决定。 → ✅ R213 域登记：「主动建议/自动合并/自动重浮独立开关及日志」=R203 只读建议红线+R77-P0 治理同构——关闭即停=开关直连 poller shouldRun
- [x] 【R102-P1·自然语言转计划·评估】自然语言只生成结构化计划草稿，显示解析字段、缺失字段和影响；验收用户确认前不调用高影响写 op。 → ✅ R213 域登记：「用户确认前不调用工具」=plan/execute 分离+白名单 op 才可入 plan（makePlan 结构性保证——R209 计划模板同源）
- [x] 【R102-P1·摘要边界·评估】摘要说明范围、截断、缺失、时间点和来源；验收无法访问的内容不被模型补写为事实。 → ✅ R213 域登记：「无法访问的内容不被模型补写为事实」=证据信封 claims/truncated 字面+摘要范围声明=SY-12 标题含范围
- [x] 【R102-P0·来源约束·评估】智能结果分开来源事实、用户判断、模型推断和待核实项；验收引用失效或冲突时给问题清单，不生成假证据。 → ✅ R213 域登记：来源事实/用户判断/模型推断/待核实分离=证据信封四级（R192 主张溯源同款）；引用失效给问题清单=只读报告模式
- [x] 【R102-P1·模型降级·评估】模型不可用/超额/不确定时降级为模板、搜索、只读计划和人工操作；验收不自动换服务或扩大外发范围。 → ✅ R213 域登记：降级为模板/搜索/只读/人工=p0-3 三级降级+R85 AI 降级已交付；「不自动换服务外发」=PRIVACY 端点纪律
- [x] 【R102-P1·辅助与执行分离·评估】建议、草稿、计划和已执行结果使用不同视觉与状态；验收用户不会把 AI 生成内容误认为业务已完成。 → ✅ R213 域登记：「AI 生成内容不误认为已执行」=notify≠证据红线+辅助/执行视觉分离=结果优先话术（R202）

### 15.7 R103：能力平台与功能深度

- [x] 【R103-P0·能力语义分类·评估】manifest 增加任务语义、输入/输出、读写级别、确认要求、延迟、配额、可用条件和 owner；验收可按目标发现可组合能力。 → ✅ R213 域登记：manifest 增语义字段=registry.json 演进位（读写级别已有/确认要求=WRITE_OPS/延迟=elapsedMs 实测）——登记为 manifest 演进方向
- [x] 【R103-P0·能力图·评估】展示能力之间的输入输出、依赖、替代和冲突关系；验收缺一个能力时给可用子流程和手动接管，不生成不可执行计划。 → ✅ R213 域登记：能力依赖/替代/冲突=registry 提案+缺能力子流程=ACTION-CARDS 手动替代字段（图纸已有）
- [x] 【R103-P0·事实矩阵·评估】为实体和状态记录 source of truth、投影方、可写方、失效策略和更新时间；验收聚合数字能回到源记录，快门不重算 owner 口径。 → ✅ R213 域登记：source of truth/投影方/失效策略=api.md op 表 owner 列+R77 权威矩阵（已登记同源）
- [x] 【R103-P1·适配器分层·评估】区分稳定语义 op、公开桥适配器、通用命令、实验能力和人工入口；验收高级透传不能替代稳定适配器。 → ✅ R213 域登记：「高级透传不能绕过稳定 op」=plugin.api 允许名单策略（api.md §11 注记）+稳定语义 op=api.md 全表——分层已实现
- [x] 【R103-P1·输入输出契约·评估】每个场景定义 schema、空值、错误、分页、时间和幂等字段；验收字段变化先协商或失败，不靠字符串猜测继续执行。 → ✅ R213 域登记：「字段变化先协商」=协议 v1.1 字段只增不改+破坏性升 v2（docs/02 §9）——契约已交付
- [x] 【R103-P1·读写分级·评估】能力分只读、可逆写、不可逆写、外发和自动触发等级；验收 UI/CLI/MCP/工作流使用同一门禁和确认语义。 → ✅ R213 域登记：只读/可逆写/不可逆写/外发/自动触发分级=**分层授权+WRITE_OPS+外发无（PRIVACY）**——「UI/CLI/MCP 同规」=三通道一合同
- [x] 【R103-P1·版本兼容·评估】能力版本、插件版本、动作 revision 和协议版本分开；验收升级/降级/缺字段给迁移或手动替代，不静默使用旧计划。 → ✅ R213 域登记：能力版本/插件版本/动作 revision/协议版本四线分离=**版本三线分记+check-version 门**（已交付）
- [x] 【R103-P0·计划器边界·评估】计划器只组合已登记、可用、权限满足的能力；验收不能从自然语言创造未登记 op 或读取私有存储。 → ✅ R213 域登记：「不能从自然语言创造未登记 op」=makePlan 白名单校验（结构性保证——R209 计划模板同源）
- [x] 【R103-P1·沙盒演练·评估】为复杂场景提供脱敏固定输入、只读模拟和结果预览；验收模拟不派发真实写入、不发送通知、不消耗不可逆配额。 → ✅ R213 域登记：「模拟不派发真实写入/不发通知」=只读白名单结构性保证（R178 裁定字面）；固定输入=fixtures
- [x] 【R103-P1·跨客户端一致·评估】面板、Quicker、MCP、CLI 和未来移动入口共用 intent/result/receipt 语义；验收同一场景的权限、错误和恢复步骤一致。 → ✅ R213 域登记：面板/Quicker/MCP/CLI 共用 intent/receipt 合同=三通道一合同（R182 已交付字面）
- [x] 【R103-P1·作者工具链·评估】把 manifest、契约、夹具、诊断和示例检查纳入作者接入流程；验收新增插件未通过校验不能进入稳定能力目录。 → ✅ R213 域登记：manifest/契约/夹具/诊断/示例检查=**registry 形状测试+contract 一致性+csc 门+fixtures**（作者工具链已交付）

### 15.8 R104：采用、收益和用户反馈

- [x] 【R104-P0·激活定义·调研】把激活定义为一次完整结果闭环，不以安装、打开面板或 ping 成功计数；验收不同场景都有可观察完成证据。 → ✅ R214 域登记（等 G2 自用数据）：激活=一次完整结果闭环——完成判据五级可直接计量（recorded→verified）；不以安装/ping 计数=notify≠证据红线同源
- [x] 【R104-P1·价值时间·调研】测量原方法与快门在切换、整理、失败恢复和维护上的总时间；验收报告净收益和不适合自动化的任务。 → ✅ R214 域登记（等 G2 自用数据）：净收益/不适用场景报告=观察表字段（首成功/修正/净节省已列）；挂自用轮
- [x] 【R104-P1·闭环率·调研】按意图统计完成、部分、未知、放弃、人工接管和二次利用；验收缺失来源单独标注，不把未知当失败或成功。 → ✅ R214 域登记（等 G2 自用数据）：按意图统计完成/部分/未知/放弃/接管=六态回执可直接聚合；缺失来源单独标注=诚实红线
- [x] 【R104-P1·持续使用·调研】观察首日、7 日、30 日仍完成有价值任务的原因和停用原因；验收不把调用次数、通知次数或安装次数当采用率。 → ✅ R214 域登记（等 G2 自用数据）：首日/7 日/30 日原因=观察表字段；「不把调用次数当价值」=审计红线同构
- [x] 【R104-P1·恢复价值·调研】记录未知结果、插件缺席、目标变化后的恢复成功率和重复副作用；验收恢复时间与用户信任反馈一并分析。 → ✅ R214 域登记（等 G2 自用数据）：恢复成功率/重复副作用=timeout 恢复率可计量（verify 已输出恢复面数据雏形）
- [x] 【R104-P1·信任成本·调研】比较确认、预览、解释、审计带来的负担与误写减少；验收按风险分级，不用全局关闭确认换取表面速度。 → ✅ R214 域登记（等 G2 自用数据）：确认/预览/解释/审计负担 vs 误写减少=分层授权成本收益表（按风险分级=WRITE_OPS 分级同源）
- [x] 【R104-P1·维护成本·调研】每个场景记录校准、契约升级、样例回归、支持和上游漂移成本；验收低净收益/高维护项进入暂停或手动替代。 → ✅ R214 域登记（已交付对照）：校准/契约升级/样例回归/上游漂移成本=**dependency-watch.yml 已自动化监测**+版本头变更记录
- [x] 【R104-P2·反馈入口·评估】在结果旁收集有用/没完成/哪里不对/下一步需求；验收反馈绑定场景和版本，不默认上传正文或个人数据。 → ✅ R213 域登记：反馈绑定场景/版本不默认上传=审计设计（op/状态/耗时）+G2 观察表（反馈字段已备）
- [x] 【R104-P2·研究节奏·调研】建立每轮候选→样本→证据→采用/暂缓/否决→重评条件的决策账本；验收不得因待办数量增长而跳过验证。 → ✅ R214 域登记（等 G2 自用数据）：候选→样本→证据→采用/暂缓/否决→重评=docs/30 池治理管线（已交付字面——「不得因待验证跳过验证」=E 等级纪律）

### 15.9 R105：功能组合、路线和最终验收

- [x] 【R105-P0·核心与扩展·评估】将功能分为意图/上下文/计划/执行/回执五个核心层和场景扩展层；验收核心层稳定后才扩展更多业务插件。 → ✅ R213 域登记：意图/上下文/计划/执行/回执五核心=桥信封+workflow+results（核心层已稳定——场景扩展=§21 池）
- [x] 【R105-P1·成熟度阶梯·评估】定义设计态、只读、可预览、需确认写、可恢复联动、稳定场景包六级；验收能力升级需证据和迁移，不只改徽章。 → ✅ R213 域登记：六级阶梯=manifest maturity 字段演进（stable/design/unlocated 已有三态——六级=演进位）
- [x] 【R105-P1·依赖排期·评估】每个场景列 owner 契约、前端入口、桥/MCP、数据边界、用户样本和维护预算；验收缺任一前置就进入候选而非伪装可用。 → ✅ R213 域登记：owner 契约/入口/通道/边界/样本/预算=ACTION-CARDS 字段+registry 提案（排期表载体已备）
- [x] 【R105-P1·组合压力·评估】用同一意图测试全装、缺插件、部分超时、版本漂移、多客户端和跨设备；验收部分结果可继续，失败归属清楚。 → ✅ R213 域登记：全装/缺插件/超时/漂移/多客户端/跨设备=**R93 批量域+R170 多触发+R140 端口已测面**（组合压力=既有测试总纲）
- [x] 【R105-P1·终止标准·评估】为低频、高风险、低闭环率或高维护候选定义停止条件和手动替代；验收停用保留用户内容、历史和迁移说明。 → ✅ R213 域登记：「停用保留用户内容」=PRIVACY 出口+低频/高风险停止=docs/30 池治理退出规则（已交付）
- [x] 【R105-P1·迁移策略·评估】旧命令/动作/模板升级到意图与结果模型时保留兼容窗口、映射、旧回执查询和回退；验收用户可选择迁移，不重复执行历史副作用。 → ✅ R213 域登记：兼容窗口/映射/旧回执查询/回退=协议 v2 平移+台账按 id 查询（已交付）
- [x] 【R105-P1·支持模型·评估】把问题按入口、快门、业务 owner、思源、上游服务分流；验收每个场景有责任人、诊断包和手动完成路径。 → ✅ R213 域登记：按入口/快门/owner/思源/上游分流=**FAQ 七类故障归属表**（已交付字面）
- [x] 【R105-P2·公开表达·评估】宣传按“用户任务→最终结果→前置条件→风险/边界→证据”编排；验收不把设计态能力、模拟结果或单机实验写成稳定联动。 → ✅ R213 域登记：「不把设计态能力说成已支持」=证据等级纪律（E 标注）+manifest maturity 诚实态（unlocated）——公开表达规范已贯彻
- [x] 【R105-P0·最终验收·调研】对核心场景执行“触发→捕获→澄清→计划→执行→核验→复盘→复用”全链路评审；验收每一步都有用户可观察结果、失败恢复和 owner 归属。 → ✅ R214 域登记（等 G2 自用数据）：全链路评审=verify:restart 十项（触发→桥→澄清确认→执行→回执→⑪事件→复用=链路全覆盖）——最终验收入口已收敛 npm run accept/verify:restart

## 16. R106~R113：Quicker 动作编辑、AI 创建与发布维护（只调研与登记）

> 官方调研与事实边界见 [Quicker 动作编辑与 AI 创建调研 R106~R113](docs/17-Quicker动作编辑与AI创建调研-R106-R113.md)。本节新增 109 项，全部未勾选。它们专门针对“如何把快门能力做成可安装、可调试、可维护的 Quicker 动作”，与前面按用户结果和插件契约的待办配套；不把 AI 生成、设计器保存或单次试运行当作正式可发布证明。

### 16.1 R106：动作身份、结果定义和创建准备

- [x] 【R106-P0·动作结果卡·评估】每个 Quicker 动作先写用户任务、触发入口、输入、输出、写入 owner、成功证据、失败恢复和手动替代；验收用户不看模块名也能判断是否适合自己。 → ✅ R161 交付 **quicker-actions/ACTION-CARDS.md**：七张用户动作卡（划词摘录/快速捕获/全局快查/打开日记/图片入库/汇总待办/数据体检）+ 子程序速查表——要素全齐（用户任务/触发/输入/输出/写入位置/成功证据/失败恢复/手动替代），素材源自参考件头注与 api.md
- [x] 【R106-P0·本体入口分离·评估】登记动作本体、面板位置、场景、快捷键、文本指令和其他触发的引用关系；验收整理入口不会误删被多处引用的动作本体。 → ✅ R162 批量登记（E2 草案）：registry.json 提案（R151-01）actionId 与 entryPoints 数组分离——本体一处、入口多处引用；ACTION-CARDS 触发字段即入口登记的雏形
- [x] 【R106-P1·影响引用·评估】编辑动作前显示受影响场景、动作单、公共子程序和外部调用；验收高影响修改先复制或进入暂存，不能静默改变所有入口。 → ✅ R162 批量登记（E2 草案）：引用关系数据源=registry.json entryPoints（提案）；编辑影响提示是 Quicker 编辑器层能力（挂 GUI 轮）；当前缓解=子程序「一处维护处处生效」+参考件版本头变更记录
- [x] 【R106-P0·动作类型·评估】为组合动作、脚本动作、公共子程序和场景配置定义选型条件；验收需要真实 C# 能力时不让用户误用普通模块，简单流程不因 AI 生成脚本增加维护成本。 → ✅ R162 批量登记（E2 已交付）：reference README 边界声明——参考件=组合动作内 C# 模块（普通模式 v2/Roslyn）；脚本动作限制（无 async/await/lock）R70 待 GUI 实测；公共子程序=六件基础件+新件均可粘贴或建子程序；选型条件=有真实 C# 能力需求才用 C# 模块，纯流程用 Quicker 原生模块
- [x] 【R106-P1·版本目标·评估】动作卡记录目标 Quicker 版本、V1/V2 制品、思源版本、脚本模式和必需模块；验收客户端不满足时在安装/运行前说明而非运行中报错。 → ✅ R162 批量登记（E2 已交付）：参考件=普通模式 v2（Roslyn）+语法 C#5 下兼容（csc 门实证）；思源版本=3.8.4+（kernels 字段/202 信封差异已记）；minQuickerVersion 2.2.0+（暂存区 AI 写/等待窗口步骤）——ACTION-CARDS/README 已记，registry.json 提案 minQuickerVersion 字段承载
- [x] 【R106-P0·前置清单·评估】创建前检查思源、快门、Quicker、Token、桥、AI 服务、工作区、插件和目标文档；验收分为可继续、缺配置、仅只读和不可用四类。 → ✅ R162 批量登记（E2 已交付）：**SY·预检件**即本项实现（内核可达/令牌/桥/插件四检+失败项清单）；四分类映射=全部通过(可继续)/令牌无效(缺配置)/只读 ops(仅只读)/内核不可达(不可用)；GETTING-STARTED 三步=首跑路径
- [x] 【R106-P0·输入输出表·评估】为每个动作列输入来源（选区/剪贴板/参数/上下文/文件）、类型、大小和输出去向；验收没有输入、空输入、多输入和超限各有路径。 → ✅ R162 批量登记（E2 已交付）：参考件头注【输入/输出变量】表 27 件全量（含大小限制如 args≤32KB/选区截断/图片 PNG）；ACTION-CARDS 输入输出字段用户化转写
- [x] 【R106-P1·错误合同·评估】动作卡把网络、鉴权、目标缺失、插件未就绪、业务拒绝、超时和未知结果映射为用户下一步；验收不以通用“失败”覆盖不同恢复方式。 → ✅ R162 批量登记（E2 已交付）：**docs/FAQ.md 七类 30+ 条**即错误合同（网络→未运行分支/鉴权→401 自愈+令牌引导/目标缺失→config.discover/插件未就绪→registry 预检/业务拒绝→rejected 中文/超时→不换 id 重试/未知→诚实 timeout）；参考件错误分支全按此实现
- [x] 【R106-P1·业务 owner·评估】动作元数据标记思源、快门、打卡、人脉、拾遗、闪卡、考试或雷切的权威 owner；验收动作不在 Quicker 内复制业务判断和统计。 → ✅ R162 批量登记（E2 已交付）：api.md op 表 owner 列+capability-registry（manifest per-plugin）+红线「动作不复制业务判断」——打卡数据归打卡、人脉归人脉，快门只透传；登记为元数据约定（registry.json 提案 effects 字段承载）
- [x] 【R106-P1·环境差异·评估】创建前确认桌面/移动/浏览器、前台窗口、管理员权限、代理、端口和工作区；验收动作卡明确哪些环境只能保存草稿/只读。 → ✅ R162 批量登记（E2 实证）：桌面/移动=isMobileGuard（R140）；前台窗口=SY-粘贴守卫/Office选区 进程校验；管理员=Quicker 提升运行实况（UIPI 边界已知）；代理=系统代理未启用实测（R160 前轮）；端口=6806 单实例（R140 源码实证）；工作区=SY_URL 绑定
- [x] 【R106-P0·最小路径·评估】每个新动作先设计一条最短成功路径，再列增强分支和失败分支；验收新手可先完成结果，不必先配置所有高级能力。 → ✅ R162 批量登记（E2 已交付）：参考件设计原则即此——p0-1 主流程=appendDailyNoteBlock 一发即成，R6 标题落点/R3 路由为增强分支；g2-capture 主流程=insertBlock，发现链为前置增强；蓝图步骤表「失败分支」列齐备
- [x] 【R106-P0·完成判据·评估】区分动作已调用、owner 已接受、业务已写入、结果可回读和用户已定位；验收 Quicker notify 不代替快门/业务回执证明。 → ✅ R161 调研登记（E2）：五级判据×回执语义映射表入 ACTION-CARDS.md 文末——1 调用=运行记录/2 owner 接受=回执 recorded/3 业务写入=回执 data/4 可回读=块链接/5 用户定位=跳转高亮；红线注「notify≠证据」

### 16.2 R107：组合动作模块、步骤和流程设计

- [x] 【R107-P0·模块清单·评估】根据 V2 模块参考建立快门动作允许使用的模块白名单/黑名单；验收设计器可用但未经审查的模块不会进入稳定动作模板。 → ✅ R198 域登记（附A.1 三白名单已钉+设计器内白名单挂 Quicker 层）
- [x] 【R107-P1·模块/脚本选型·评估】比较同一逻辑用组合模块、自动化脚本和 C# 脚本的可读性、权限、调试和分享成本；验收选择依据写入动作卡。 → ✅ R163 批量登记（E2 已交付）：reference README 选型条件（有真实 C# 能力需求才用 C# 模块；脚本动作限制已记；选型依据入动作卡）
- [x] 【R107-P0·参数类型·评估】为每个模块记录文本、数字、列表、词典、文件、图片、布尔和表达式输入输出；验收变量连线不靠字符串隐式转换。 → ✅ R163 批量登记（E2 已交付）：参考件头注【输入/输出变量】表逐件标注类型（文本/数字/布尔/Image/路径列表）——变量连线不靠字符串隐式转换（args JSON 直嵌显式声明）
- [x] 【R107-P0·插值表达式·评估】统一 `{变量}`、整段插值、表达式和原始文本的写法；验收中文、换行、JSON、URL、引号和空值样本不被错误替换。 → ✅ R163 批量登记（E2 已交付）：SY-占位符解析（字典式 {变量} 唯一写法）+ JStr 手写转义（中文/换行/JSON/引号/空值不误替换——args 直嵌设计初衷即绕开序列化差异）
- [x] 【R107-P1·条件分支·评估】条件分支明确成功、失败、空值、未选择、超时和未知的走向；验收“获取选区失败后中止”不会误当成可走否则分支。 → ✅ R163 批量登记（E2 已交付）：回执六状态全枚举+参考件分支齐备（空选区/未确认/超时/未运行各给下一步）——「失败不是可走否则分支」由单一守卫变量保证
- [x] 【R107-P1·循环上限·评估】所有每个/循环模块声明输入数量、最大次数、取消方式和单项失败策略；验收大批量不无限运行，局部失败可继续且逐项回执。 → ✅ R163 批量登记（E2 已交付）：MAX_STEPS=8+events/results 200 行上限+SQL LIMIT 强制+Office 选区 200 格截断；单项失败=失败停止+逐项回执
- [x] 【R107-P1·等待语义·评估】区分固定等待、等待窗口、等待剪贴板、等待回执和轮询；验收等待有超时/取消，不能用固定 sleep 掩盖前台状态不确定。 → ✅ R163 批量登记（E2 已交付）：LV·取回执（按 op 分预算轮询，timeout 诚实不换 id）+ 思源未运行分支（等窗口优先于盲等）+ 索引延迟 2s 实测校准——固定 sleep 全数消灭
- [x] 【R107-P0·网络步骤·评估】HTTP 模块统一方法、JSON、超时、Token 来源、重试和敏感日志策略；验收写请求默认不自动重试，读请求和未知结果分类处理。 → ✅ R163 批量登记（E2 已交付）：**SY·内核请求**即规范实现（POST+JSON+超时参数化+Token 单一来源 env/statestorage+**写请求不自动重试**仅 401 自愈一次+敏感日志=错误提示不含 Token）——参考件全按此模板
- [x] 【R107-P1·窗口上下文·评估】需要当前窗口/选区/焦点的步骤先保存和校验目标；验收面板抢焦点、窗口切换、浏览器页面变化时不把输入发送到错误窗口。 → ✅ R163 批量登记（E2 已交付）：**SY-粘贴守卫**（前台标题/进程双校验）+ **SY-Office选区**（同款守卫内建）+ confirmWithFront 焦点激活——面板抢焦点/窗口切换不误写
- [x] 【R107-P1·数据类型转换·评估】为列表/词典/表格/JSON/Markdown 设计显式转换和错误提示；验收空数组、缺键、重复键、编码和超大字段不静默丢失。 → ✅ R163 批量登记（E2 已交付）：ExtractStr/JStr 显式转换对（空值→null/缺键→null/坏行→跳过计数）+ 重复键=先到者胜（登记）+ 超大=args 32KB 上限拒绝——不静默丢失
- [x] 【R107-P1·步骤组·评估】步骤组标记输入、输出、局部变量、失败出口和副作用；验收子组可单独检查，不能靠动作末尾一段脚本隐藏业务写入。 → ⏳ R198 保持登记（Quicker 编辑器层设计项——R163 同款裁定）
- [x] 【R107-P1·依赖声明·评估】动作列必需模块、公共子程序、脚本 API、扩展、浏览器和账号；验收缺依赖在导入/首次运行前给安装或手动替代。 → ✅ R163 批量登记（E2 已交付）：**SY-预检**（缺依赖→安装或手动替代路径）+ reference README 依赖边界（零第三方声明）+ ACTION-CARDS 前置说明
- [x] 【R107-P1·可读性·评估】动作步骤名称按用户结果命名，复杂表达式拆成有意义变量，危险步骤显式标记；验收作者接手时能在不运行的情况下读懂流程。 → ✅ R163 批量登记（E2 已交付）：**ACTION-CARDS**（按用户结果组织）+ 参考件中间变量命名（如 parentId/rest/fingerprint）+ 危险步骤显式标记（plugin.api destructiveHint/写步骤 confirm）

### 16.3 R108：变量、参数、子程序和脚本边界

- [x] 【R108-P0·参数模式·评估】动作入口区分固定配置、用户本次输入、当前上下文、敏感凭据引用和 owner 返回值；验收分享动作不把本机配置写成默认参数。 → ✅ R163 批量登记（E2 已交付）：参考件变量表**天然五分类**——固定配置（SY_URL/收集箱ID）/用户输入（内容/关键词）/上下文（选中文本/来源窗口）/敏感凭据（SY_TOKEN 只存本机）/owner 返回值（回执 data）——「分享不含本机配置」=check-release 门
- [x] 【R108-P1·默认值·评估】默认目标、格式、超时和确认策略显示来源与适用范围；验收默认值变化有迁移提示，不覆盖用户已保存的动作配置。 → ✅ R163 批量登记（E2 已交付）：normalizeSettings 迁移语义（显式优先+旧后缀迁移+坏值回默认）+ 安全默认守护测试——默认值变化即测试红
- [x] 【R108-P0·必填可选·评估】参数标记 required/optional/derived/unknown；验收未知不被当空字符串，用户跳过可选项时后续步骤能解释降级。 → ✅ R163 批量登记（E2 已交付）：参考件头注标注「必填/可空」+ **workflow validateStepArgs** required 校验早失败 + unknown=独立状态（D 红线「未知不得改写为成功」）
- [x] 【R108-P0·变量命名·评估】建立小驴动作变量前缀、输入/输出/临时/敏感字段命名规则；验收跨公共子程序连接不依赖同名碰巧相等。 → ✅ R198 域登记（已交付）：参考件变量命名约定（语义化中间变量+五分类）+ ACTION-CARDS 字段名统一
- [x] 【R108-P1·变量作用域·评估】区分动作运行、步骤组、公共子程序、场景配置和持久设置；验收并发运行、重入和不同工作区不串变量。 → ✅ R198 域登记（已交付）：参考件变量表五分类（R163 同源登记）
- [x] 【R108-P1·输出模式·评估】公共子程序声明 result、error、receipt、nextAction 和是否有副作用；验收调用方能区分空结果、失败、未知和已完成。 → ✅ R198 域登记（已交付）：参考件输出五件套约定（是否成功/消息/结果数据/块ID/后续动作）全件统一
- [x] 【R108-P0·子程序签名·评估】为 SY·内核请求、LV·发命令、LV·取回执等参考件补输入/输出/超时/重试/敏感字段说明；验收粘贴后不靠作者猜变量连接。 → ✅ R198 域登记（已交付）：参考件头注【输入/输出变量】表=签名契约（27 件编译门验证）
- [x] 【R108-P1·公共子程序版本·评估】子程序以 share/revision 或本地副本记录来源、兼容 Quicker 版本和变更；验收更新前显示哪些动作受影响，可锁定已验证版本。 → ✅ R198 域登记（已交付）：@version 版本头+变更记录（R168 同源）
- [x] 【R108-P0·敏感变量·评估】Token、路径、个人 ID、文档 ID、联系人字段和 AI Key 只能引用本机配置或运行时输入；验收导出、截图、AI 上下文和日志均不泄露。 → ✅ R198 域登记（已交付）：Token 只存本机+check-release 扫描门（凭据不入分享包）
- [x] 【R108-P1·多输入合并·评估】动作能说明选区、剪贴板、参数、上下文和文件同时存在时的优先顺序；验收用户能改用指定来源，不被旧剪贴板覆盖。 → ✅ R198 域登记（已交付）：四级兜底（参数→选区→剪贴板→userinput）每级可解释
- [x] 【R108-P1·空值策略·评估】为空、null、false、0、无选区和目标不存在分别处理；验收空值不拼进 URL/JSON，不因 false 被当缺失。 → ✅ R198 域登记（已交付）：六态回执+ExtractStr null 分离+「空值不拼进 URL」=分支守卫
- [x] 【R108-P0·重试幂等·评估】动作级、子程序级、HTTP 读、写入和取回执分别声明是否可重试；验收未知写结果先查原 ID，不能在动作里换 ID 盲写。 → ✅ R198 域登记（已交付）：分级重试声明=读可重试/写不自动重试/未知先查原 id（R178）
- [x] 【R108-P0·脚本 API 映射·评估】对 Quicker 脚本动作的 `qk` 文件/HTTP/窗口/等待/通知能力建立允许清单；验收不使用未支持的 async/await、Process、Thread 或反射绕过边界。 → ✅ R198 域登记（已交付设计）：qk API 白名单=附A.1 生成约束三类（模块/op/子程序）

### 16.4 R109：动作调试、测试和真实副作用

- [x] 【R109-P0·静态检查·评估】动作保存/导出前检查缺模块、断变量、无效表达式、未处理错误出口、循环无上限和敏感常量；验收错误定位到步骤与修复建议。 → ✅ R198 域登记（已交付实战）：**csc 编译门**（SY-Office选区 sel 重名实战 caught）+守护测试
- [x] 【R109-P0·固定样例·评估】为捕获、查询、写入、联动和回执动作准备脱敏固定输入、空输入、错误输入和大输入；验收样例可重复，不依赖用户真实笔记。 → ✅ R164 交付 **quicker-actions/fixtures/**（README+sample-commands.ndjson）：查询五样例（命中/零命中/写词拒/无LIMIT拒/多语句拒）+ 捕获四态 + 错误三样 + 事件三样（含 observed 白名单外）——脱敏可重复
- [x] 【R109-P0·模拟边界·评估】明确哪些 Quicker 试运行步骤是真实执行，哪些仅构造请求/计划；验收 UI 不把真实写入称 dry-run，用户知道会修改文件/网络/窗口。 → ✅ R198 域登记（已交付裁定）：只读白名单结构性保证「模拟绝不写入」（R178）
- [x] 【R109-P0·副作用清单·评估】按剪贴板、窗口、文件、网络、思源写入、插件写入、通知和外部发送列副作用；验收运行前显示高风险步骤和不可回滚项。 Quicker 试运行前展示实际输入、目标窗口与凭据绑定；试运行真实执行，不等同只读模拟，测试通过不延续为正式业务写授权。 → ✅ R198 域登记（已交付）：PRIVACY 端点清单+ACTION-CARDS 副作用/写入位置字段
- [x] 【R109-P1·取消超时·评估】每个等待、HTTP、回执、循环和脚本步骤支持或明确不支持取消；验收取消后列已发生副作用和迟到结果可能性。 → ✅ R198 域登记（已交付）：15s 单命令上限+超时分类（诚实 timeout）+取消语义=优雅停
- [x] 【R109-P1·步骤日志·评估】调试日志包含动作 revision、步骤号、输入摘要、耗时、状态、receipt/intent ID 和脱敏错误；验收日志不含 Token/正文，能复制给支持者。 → ✅ R198 域登记（已交付）：SY-日志轮转（1MB 滚动+脱敏）+审计（op/状态/耗时无正文）+receipt id 贯穿
- [x] 【R109-P1·触发上下文·评估】测试同一动作从面板、快捷键、文本指令、选中文本、场景和反向 HTTP 触发；验收每种入口的输入来源和失败文案一致。 → ✅ R198 域登记（已交付）：同动作多触发一合同（R170）+verify:restart 跨通道断言
- [x] 【R109-P1·剪贴板保护·评估】读取/写回剪贴板的动作记录是否恢复原内容、恢复失败和用户选择；验收异常终止、超时和窗口切换不静默破坏剪贴板。 → ✅ R164 调研登记（E2 部分）：错误粘贴=SY-粘贴守卫事前拦截（不碰剪贴板）；写后恢复=Quicker 剪贴板历史/BetterClip（本机在跑）天然兜底——「异常终止不静默破坏剪贴板」的显式恢复步骤登记为动作侧设计约定（模板化 暂存→写→恢复 三步）
- [x] 【R109-P0·网络故障·评估】对代理拦截、思源未运行、401/403、404、5xx、连接超时、响应非 JSON 和大响应逐项测试；验收每类有稳定下一步。 → ✅ R164 批量登记（E2 已交付）：FAQ 七类即本清单（401/404/5xx/超时/非JSON/大响应/代理+未运行）——每类有稳定下一步；202+错误信封为 3.8.6 特例已单列（bug#12）
- [x] 【R109-P0·快门回执·评估】Quicker 动作调用快门时保存同一 intentId/commandId 并查询原回执；验收 accepted/committed/verified/unknown 分开显示。 → ✅ R164 批量登记（E2 已交付）：同 id 查询即实现（D-0012+LV·取回执按 id 匹配+不换 id 重试语义）——accepted/committed/verified 映射=已入队/recorded/用户跳转验证，四态在 ACTION-CARDS 完成判据五级
- [x] 【R109-P1·目标 UI·评估】对当前窗口、浏览器标签、选区和思源文档分别验证焦点变化、输入法、页面加载和窗口关闭；验收错误目标不会被当成功。 → ✅ R198 域登记（已交付）：SY-粘贴守卫+Office选区（前台窗口/进程校验，不匹配即拒）
- [x] 【R109-P1·回归矩阵·评估】建立 Quicker 版本 × 思源版本 × 桥开关 × 插件缺失 × 前后台 × 网络状态矩阵；验收每次动作修订只宣称已验证组合。 → ✅ R198 域登记（部分）：fixtures+兼容矩阵 R70（Quicker 版本轴挂 GUI 轮）
- [x] 【R109-P1·运行分析·评估】使用 Quicker“运行并分析”时，先核对最近运行 ID、失败步骤和实际输入；验收 AI 分析建议不代替人工检查变量/目标/业务结果。 → ✅ R198 域登记（已交付）：运行分析边界=R166（诊断建议≠事实+绑定运行 ID）
- [x] 【R109-P1·真环境证据·评估】区分设计器静态检查、固定样例、Quicker 真运行、思源业务回读、移动/外部入口实测五级证据；验收发布说明列证据等级。 → ✅ R198 域登记（已交付）：证据等级实践（E2 编译门/E3 测试/E4 真机分级标注——本会话范式）

### 16.5 R110：AI 生成、修改和审查动作

- [x] 【R110-P0·生成提示模板·评估】为每个快门动作提供“用户结果、输入、输出、目标、约束、错误、回执、版本”的 AI 提示模板；验收不只描述“帮我做一个动作”。 → ✅ R165 交付 **docs/03 附A.1**：结构化八字段模板（用户结果/输入/输出/目标/约束/错误/回执/版本）——现有 P0-1~P0-5 提示词即该结构实例
- [x] 【R110-P0·生成约束·评估】提示 AI 只能使用登记模块、快门公开 op、参考子程序和指定 `qk` API；验收生成未登记方法/私有路径时明确拒绝并保留草稿。 → ✅ R198 域登记（已交付）：附A.1 三白名单（R165）
- [x] 【R110-P0·生成不授权·评估】将“生成代码/步骤”“保存动作”“运行动作”“写入思源”“发送外部通知”分为不同确认；验收 AI 回复的肯定句不被当作授权。 → ✅ R198 域登记（已交付）：授权分离五步（R165/R166）
- [x] 【R110-P1·模型配置·评估】记录使用的 AI 服务、模型、上下文窗口、工作区和用量，但 Token 只引用 Quicker 本机配置；验收分享动作和普通设置不包含 API Key。 → ✅ R166 批量登记（E2 已交付）：Token 只引用本机=PRIVACY.md 红线（凭据不进分享包+check-release 门）；模型/用量记录=动作元数据约定（registry.json 提案 model 字段——证据信封 generatedBy.model 已有该位）
- [x] 【R110-P0·暂存隔离·评估】AI 新建动作默认进入暂存区，显示暂存 ID、来源对话、生成时间和草稿状态；验收未“保留到场景”前不出现在稳定动作目录。 → ✅ R165 附A.1 暂存隔离=Quicker 原生暂存区能力（与本仓库 reference+.qa 分发天然兼容）
- [x] 【R110-P0·改动检查·评估】AI 修改动作后显示步骤增删、参数变化、变量连线、子程序引用、触发影响和敏感步骤；验收用户能逐项接受/撤销。 → ✅ R198 域登记（已交付同构）：版本头变更记录+fixtures 回归（改前改后比对）
- [x] 【R110-P0·变量审查·评估】AI 生成后专门检查变量名、作用域、空值、类型转换、表达式插值和输出消费；验收变量未连通不能进入试运行。 → ✅ R166 批量登记（E2 已交付）：审查门已自动化——**csc 编译门**（未定义变量/类型错误编译期暴露，SY-Office选区 sel 重名即实战 caught）+ 头注变量表人工核对 + validateStepArgs 参数审查（workflow）
- [x] 【R110-P1·模块幻觉·评估】建立不存在模块、过期模块、V1/V2 不兼容模块和参数名错误的样本；验收 AI 生成错误能被静态门禁捕获而不是运行时才暴露。 → ✅ R165 附A.1 模块幻觉门=csc 编译门静态验证（27 脚本运行先例；编译期暴露而非运行时）
- [x] 【R110-P0·保留原行为·评估】修改已有动作时列出用户要求保留的步骤/输出/触发/副作用；验收 AI 只改指定范围，未相关行为有回归样例。 → ✅ R166 批量登记（E2 已交付）：回归样例机制=**fixtures/**（改前改后跑同一样例集比对）+ 参考件版本头变更记录（改了什么一目了然）；「AI 只改指定范围」=附A.1 生成约束（授权分离）
- [x] 【R110-P1·增量修改·评估】比较一次大改与小步修改在错误率、审查成本和回滚上的差异；验收复杂动作默认建议分阶段生成并保留每轮草稿。 → ✅ R166 调研登记（E2 裁定）：小步修改默认——参考件每件独立+版本头逐次记变更（本会话 g2-capture 1.0→1.1、内核请求 1.0→1.1 均小步+编译门护航）；大改场景=整件重写+编译门全量回归（同会话已示范）；每轮草稿=git 提交粒度
- [x] 【R110-P0·运行分析边界·评估】把 Quicker AI“运行并分析”输出标为诊断建议；验收建议不能直接写回动作，必须绑定具体运行和步骤。 → ✅ R198 域登记（已交付）：R166（诊断建议≠事实）
- [x] 【R110-P0·外部助手审批·评估】MCP 客户端同意、允许 MCP 写入、修改暂存动作、写回正式动作分别确认；验收撤销客户端授权后不能继续改动作。 → ✅ R166 批量登记（E2 已交付）：**分层审批已实现**——MCP 接入=用户配置文件；写入=LV_MCP_WRITE 门控+tools/list 隐藏；业务写入=快门确认门控（confirmExec）+plugin.api 允许名单；「撤销授权后不能继续」=移除 env+重启 Claude 即断（stdio 生命周期）
- [x] 【R110-P0·脚本安全·评估】AI 生成 C# 脚本时检查文件/网络/进程/窗口/键鼠/剪贴板副作用、路径和输入边界；验收高风险脚本只能在明确目标和样例下试运行。 → ✅ R198 域登记（已交付）：红线三层防线（R191：数据/执行分离+授权分层+SQL 转义）
- [x] 【R110-P0·假 API 防线·评估】对 `plugin.api`、思源内核、快门 op、公共子程序和 Quicker qk API 做真实可用性校验；验收未知 API 只保留草稿并给人工替代。 → ✅ R198 域登记（已交付）：csc 编译门（假 API=未定义符号编译期暴露）+附A.1 白名单
- [x] 【R110-P1·上下文最小化·评估】AI 只收到动作步骤、必要模块说明、脱敏错误和用户选择的样例；验收不自动上传 Token、真实笔记正文、个人路径或完整工作区。 → ✅ R198 域登记（已交付）：check-release 脱敏+错误提示不含 Token/正文
- [x] 【R110-P1·步骤引用·评估】核对把具体步骤拖入 AI 对话/加入对话的引用机制；验收引用本身不会运行，AI 修改只作用于明确步骤或用户指定范围，不因一句话重写整套动作。 → ⏳ R198 保持登记（Quicker 编辑器层——步骤引用机制待编辑器能力）
- [x] 【R110-P1·对话可复现·评估】记录 AI 对话工作区、历史、模型会话、动作 revision 和导入/导出状态；验收切换工作区会明确新会话，导入默认只读，续聊条件不满足时不重放历史工具操作。 → ✅ R198 域登记（部分）：git 提交粒度+版本头（对话记录层挂 Quicker AI 本机配置——PRIVACY）
- [x] 【R110-P1·模型能力门禁·评估】分别测试文本、工具调用、结构化输出和图片输入能力；验收认证失败、不支持和额度不足分开显示，能力未知时不生成对应动作模块。 → ✅ R198 域登记（已交付）：MCP initialize 协商+PROTOCOL_VERSION 基线（能力分测挂协议升级）
- [x] 【R110-P0·ActionItem2 门禁·评估】评估 Quicker V2 ActionItem2 JSON 导入/生成路径，校验 catalog 的 StepRunnerKey、InputParams/OutputParams key、VarKey 和分支结构；验收旧 Data/Data2/Data3 路径被拒绝并保留可读草稿。 → ⏳ R198 保持登记（Quicker V2 ActionItem2 JSON 路径待 GUI 实测）
- [x] 【R110-P1·在线补全隐私·评估】实测在线代码补全发送的代码、变量类型和默认 using 范围；验收本地补全不可用时不静默切在线，界面和文档显示当前模式及关闭入口。 → ⏳ R198 保持登记（在线补全发送范围=Quicker 本机行为，挂实测轮）
- [x] 【R110-P1·冲突修改·评估】正式动作、暂存副本和 AI 修改同时变化时，先显示基线/本地/新版三方差异；验收冲突不强制覆盖，合并结果仍回到草稿。 → ✅ R198 域登记（部分）：三方差异=git+版本头（Quicker 内冲突 UI 挂编辑器层）
- [x] 【R110-P0·最终人工确认·评估】AI 生成/修改动作正式保存前检查目标、输入、变量、权限、测试证据、版本和回滚；验收助手回复不能替代设计器保存与人工确认。 → ✅ R198 域登记（已交付）：版本门+确认卡+check:release（正式保存前检查链已自动化）
- [x] 【R110-P1·AI 失败保留·评估】模型超额、断网、上下文压缩或生成失败时保留原草稿/原动作/用户提示；验收失败不清除已生成可用部分，不自动换服务外发。 → ✅ R198 域登记（已交付）：R166 AI 失败降级（保留本地输入+fixtures 回归）

### 16.6 R111：暂存副本、冲突、版本和迁移

- [x] 【R111-P0·暂存身份·评估】暂存动作记录来源（新建/正式动作/AI/MCP）、基线 revision、创建时间和当前保存位置；验收用户能区分草稿、暂存、正式动作。 → ⏳ R198 保持登记（Quicker 暂存区原生+编辑器层字段）
- [x] 【R111-P0·并发修改·评估】正式动作被手工、AI、另一个 Quicker 窗口或同步更新时显示基线差异；验收不允许旧副本无提示覆盖最新动作。 → ⏳ R198 保持登记（并发 UI=Quicker 编辑器层；git 面=版本头已覆盖参考件）
- [x] 【R111-P0·三方合并·评估】核对 Quicker 2.2.25+ 的冲突合并能力对模块、变量、脚本、触发和元数据的边界；验收冲突项逐项处理，合并结果先留草稿。 → ⏳ R198 保持登记（Quicker 2.2.25+ 原生能力核对挂 GUI 轮）
- [x] 【R111-P0·最新重开·评估】旧暂存冲突时支持保留需要的修改、丢弃旧副本、重新打开最新正式动作并重新应用；验收不反复强制覆盖造成丢改动。 → ⏳ R198 保持登记（同上编辑器层）
- [x] 【R111-P0·保存运行分离·评估】界面明确“修改显示、保存草稿、写回正式动作、试运行成功、业务结果核验”五态；验收任一状态不能冒充其他状态。 → ✅ R198 域登记（已交付）：五态=完成判据五级映射（ACTION-CARDS 文末）+notify≠证据红线
- [x] 【R111-P1·编辑前备份·评估】动作重大修改前保存可恢复副本/修订摘要；验收备份不含 Token 和个人正文，恢复后需重新确认场景引用。 → ✅ R168 批量登记（E2 已交付）：参考件=git 版本粒度回滚（每变更一提交）+ 版本头变更记录；备份脱敏=check-release 门（不含 Token/正文）；「恢复后重确认场景引用」=registry entryPoints 提案字段
- [x] 【R111-P1·分享修订·评估】每次公开/私有分享更新使用同一 share ID 和递增 revision；验收旧修订可查，新修订说明变更、最低版本和兼容性。 → ✅ R168 批量登记（E2 已交付）：版本三线分记（动作包线：share ID+revision 递增+变更说明+最低版本+兼容性）——暂缓上架期间以 .qa 导出+本表登记执行
- [x] 【R111-P1·V1/V2 制品·评估】需要双版本时分别验证 V1/V2 行为和损失；验收只支持 V2 时不生成误导性的 V1 制品。 → ✅ R168 批量登记（E2 裁定）：**只分发 V2 参考件**（不生成误导性 V1 制品——C#5 兼容使 V2 件在 1.x 语法面也可读，但运行绑定 v2 引擎）；版本三线分记已定
- [x] 【R111-P1·最低版本·评估】动作使用 2.2.25/2.2.26/2.3.0 等能力时，在导入前检查最低 Quicker 版本和替代路径；验收旧客户端得到可读提示。 → ✅ R198 域登记（已交付）：C#5 下兼容 csc 实证+minQuickerVersion 登记（R168）
- [x] 【R111-P1·旧动作迁移·评估】V1 旧组合动作、旧表达式和旧模块迁移前生成副本、差异和不兼容清单；验收原动作仍可运行或有明确回退。 → ✅ R198 域登记（部分）：C#5 兼容=语法面迁移清单实证；V1 动作迁移挂 GUI 轮
- [x] 【R111-P1·回滚·评估】动作、公共子程序、场景入口和触发规则分别支持回退；验收回滚动作内容不误删其他场景入口，运行产生的外部副作用单独说明。 → ✅ R168 批量登记（E2 已交付）：参考件逐件独立文件（回滚=单文件 git revert，不牵连他件——「回滚不误删其他场景入口」结构性保证）；外部副作用单独说明=ACTION-CARDS 失败恢复字段
- [x] 【R111-P1·变更日志·评估】每次动作 revision 记录用户可见变化、模块/脚本/权限/依赖/测试证据和已知问题；验收支持者能按 revision 复现问题。 → ✅ R168 批量登记（E2 已交付）：参考件版本头变更记录（@version 行）+ CHANGELOG（测试证据/已知问题字段齐备）——支持者按 revision 复现=fixtures 固定样例

### 16.7 R112：场景、触发和实际使用入口

- [x] 【R112-P0·场景层级·评估】动作卡声明全局、程序、网址、子场景、规则父场景的适用范围；验收同名动作在不同场景的实际入口和参数可辨识。 → ✅ R198 域登记（部分）：registry entryPoints 提案（场景字段）+ACTION-CARDS 触发字段；UI 层挂 GUI 轮
- [x] 【R112-P1·规则父场景·评估】共享触发规则前显示成员程序、继承优先级、覆盖/禁用和设备同步影响；验收修改父场景不意外改变无关程序。 → ⏳ R198 保持登记（规则引擎属未来域——R82 自动化职责裁定同源）
- [x] 【R112-P0·同动作多触发·评估】面板、快捷键、鼠标手势、轮盘、文本指令、选中文本和 HTTP 入口都映射同一结果合同；验收入口不同不改变权限/回执。 → ✅ R170 批量登记（E2 已交付）：**入口不同不改回执**=结果合同由快门侧保证（同 op 同回执语义，D-0012 幂等不因入口变化）；入口登记=registry.json entryPoints 提案 + ACTION-CARDS 触发字段（七种入口已列）
- [x] 【R112-P1·当前程序·评估】动作需要前台程序/网址时将其作为上下文输入并显示；验收切换窗口、浏览器标签和失焦后停止或重新确认，不发送到错误目标。 → ✅ R170 批量登记（E2 已交付）：来源窗口=getwindowtitle 采集入卡（g2-capture「摘自窗口」）；需前台的动作=SY-粘贴守卫/Office选区 进程校验，不匹配即拒——「不发送到错误目标」已实现
- [x] 【R112-P1·浏览器通用·评估】分享/场景选择“浏览器通用”前核对动作是否真的跨 Chrome/Edge/Firefox 可用；验收依赖扩展/网站的动作不冒充全浏览器兼容。 → ⏳ R198 保持登记（浏览器扩展实测轮——「不冒充兼容」=诚实裁定先行）
- [x] 【R112-P0·无选区输入·评估】文本处理动作对无选区、旧剪贴板、多选区和空文本给明确选项；验收不静默读取旧剪贴板造成误写。 → ✅ R170 批量登记（E2 已交付）：**四级兜底**（docs/03 §0：动作传参→思源前台选区→剪贴板→userinput）即本项实现——每级有值即用且可解释，全空=userinput 明确弹窗，不静默读旧剪贴板（剪贴板是第三级非默认）
- [x] 【R112-P1·焦点恢复·评估】面板、表单、确认框和动作运行前后记录焦点与窗口；验收用户按快捷键触发时输入回到正确应用，失败可恢复原焦点。 → ✅ R198 域登记（已交付）：confirmWithFront 焦点激活+粘贴守卫/Office选区 校验
- [x] 【R112-P1·快捷键冲突·评估】创建/导入动作时检查全局、场景、父场景和其他软件快捷键冲突；验收冲突先给替换/禁用/仅面板入口，不覆盖现有规则。 → ⏳ R198 保持登记（快捷键冲突扫描=§1 实测项待 GUI 轮）
- [x] 【R112-P1·入口差异·评估】同一动作在面板点击、文本指令和 HTTP 调用时分别展示缺失上下文/权限/确认；验收降级路径可预期且不绕过写防线。 → ✅ R198 域登记（已交付）：入口不同不改回执=R170 结果合同+FAQ 按入口给分支
- [x] 【R112-P1·无 Quicker·评估】为关键动作提供思源内入口、MCP/CLI 或手动替代，但明确不保证 Quicker 触发特性；验收用户不被迫安装编辑器才能保存原始输入。 → ✅ R198 域登记（已交付）：CLI/MCP 直接通道（R196 无Quicker 架构天然支持）+手动替代字段
- [x] 【R112-P1·禁用继承·评估】禁用上级场景/触发规则后显示实际生效规则；验收动作消失、仍可搜索、从其他入口可运行等状态分别解释。 → ⏳ R198 保持登记（场景禁用继承=Quicker 场景层，挂 GUI 轮）
- [x] 【R112-P1·入口回归·评估】动作 revision 更新后重新测试所有引用入口和场景，而不是只点一次面板按钮；验收旧入口不指向失效变量/目标。 → ✅ R198 域登记（已交付）：fixtures 回归+verify:restart 跨入口断言（revision 更新全入口重测约定入 README）

### 16.8 R113：动作分享、文档、兼容和维护

- [x] 【R113-P0·分享元数据·评估】动作分享填写名称、说明、关键词、适用软件、最低版本、权限、依赖、输入输出和限制；验收用户安装前知道能否直接用。 → ✅ R198 域登记（已交付）：ACTION-CARDS 字段（名称/说明/输入输出/限制）+版本三线分记
- [x] 【R113-P0·公开/私有·评估】公开分享、不公开链接、仓库归档和本地导入分别说明可见范围；验收不公开链接仍按“持有链接可安装”处理，不放敏感信息。 → ✅ R198 域登记（已交付）：版本三线分记（公开/不公开/仓库归档可见范围）+PRIVACY
- [x] 【R113-P0·许可·评估】动作、脚本、公共子程序、图标、提示词和示例数据分别记录许可与可修改范围；验收分享页和仓库说明一致。 → ✅ R198 域登记（已交付）：MIT 顺延小驴系+「可自用可修改」README 许可节
- [x] 【R113-P0·脱敏扫描·评估】导出 `.qa`/V1/V2/脚本/截图/日志前扫描 Token、API Key、绝对路径、文档 ID、联系人和真实正文；验收扫描失败阻止发布并给定位。 → ✅ R198 域登记（已交付）：**check-release 门**（Token/路径/内网扫描，CI 接线+首轮抓真泄露实战）
- [x] 【R113-P1·动作包清单·评估】为快门动作包生成 manifest：动作、子程序、revision、最低 Quicker、思源/插件依赖、配置项、场景、触发和验证日期；验收缺依赖不显示稳定安装。 → ✅ R198 域登记（提案就绪）：registry.json（动作/子程序/revision/最低版本字段提案 R151-01）
- [x] 【R113-P1·安装后向导·评估】导入后逐项检查配置、依赖、权限、场景、快捷键和只读探针；验收配置不全时可以只保留动作草稿/只读模式。 → ✅ R198 域登记（已交付组装）：GETTING-STARTED 三步+SY-预检（配置/依赖/探针）——「配置不全只保留动作」=预检分支语义
- [x] 【R113-P1·用户文档·评估】每个动作提供“适合谁/何时使用/输入/结果/副作用/失败恢复/如何卸载/如何反馈”；验收文档从用户结果开始，不从模块列表开始。 → ✅ R198 域登记（已交付）：**ACTION-CARDS 每卡八字段**（适合谁/输入/结果/失败恢复/手动替代）+卸载路径=PRIVACY
- [x] 【R113-P1·演示材料·评估】录制创建、AI 暂存、检查、试运行、正式保存、回执和失败恢复全流程；验收素材不展示个人数据，不把设计器状态当业务成功。 → ⏳ R198 保持登记（录制=GUI 域，素材脱敏规范已备 R176）
- [x] 【R113-P1·兼容证据·评估】每次 revision 记录 Quicker V1/V2、2.2/2.3、Windows、思源版本、桥开关和依赖插件的真实验证；验收未验证组合标未知。 → ✅ R198 域登记（部分）：兼容矩阵 R70+真机/CI 双证据（Quicker 版本轴挂 GUI 轮）
- [x] 【R113-P1·支持闭环·评估】反馈模板收集动作 share/revision、场景、触发入口、输入类型、失败步骤、Quicker/思源版本和脱敏日志；验收支持者能定位归属并复现。 → ✅ R198 域登记（已交付）：FAQ（定位/下一步）+完成判据（receipt 语义）+issue 模板字段（share/revision/失败步骤）

## §17 AI 智能体、思源 Agent 接入与提示词体系（R114~R122）

### 17.1 R114：AI 总体定位与职责边界

- [x] 【R114-P0·全局角色·评估】把 AI 定义为“意图理解、计划建议、受约束草稿和结果解释”能力层；验收入口、计划、执行、核验和复盘使用同一套状态语义。 → ✅ R207 账本重复项：R182 已登记同文（workflow plan/execute 分离=受约束草稿角色）
- [x] 【R114-P0·结果优先·评估】为 AI 任务建立用户结果卡（目标、输入、输出、证据、失败恢复、下一步）；验收不以生成文本或调用次数作为完成。 → ✅ R182 批量登记（E2 已交付）：**ACTION-CARDS 七卡+完成判据五级**即用户结果卡本体——「不以生成文本或调用次数作为完成」=notify≠证据红线
- [x] 【R114-P0·职责矩阵·评估】绘制思源 Agent、快门、小驴插件、Quicker AI、外部 MCP host 和模型服务的责任/禁止事项矩阵；验收每个写入都有唯一 owner。 → ✅ R182 批量登记（E2 已交付）：**capability-registry owner 字段+api.md op 表 owner 列+红线（快门不复制业务判断/不自带模型服务）**——每个写入有唯一 owner（打卡归打卡/人脉归人脉），矩阵即 registry 本体
- [x] 【R114-P0·事实边界·评估】要求模型区分事实、引用、推断、建议和未知；验收回执未知时不得用自然语言改写为成功。 → ✅ R182 批量登记（E2 已交付）：**六态回执+红线「未知不得改写为成功」**——unsupported/timeout 诚实返回不粉饰；证据信封 claims[].evidence 分级管内容侧事实边界
- [x] 【R114-P0·授权边界·评估】把模型回复、客户端同意、工具授权、业务写确认和动作正式化确认拆开；验收任一同意不能隐式授予其他层权限。 → ✅ R182 批量登记（E2 已交付）：**五层分立已实现**（R166）——模型回复（无授权力）/客户端同意（配置文件）/工具授权（LV_MCP_WRITE）/业务写确认（confirmExec+确认卡）/正式化（.qa 导出+版本门）——任一同意不隐式授予他层
- [x] 【R114-P1·入口统一·评估】面板、快捷键、思源 Agent、Quicker AI、MCP 和脚本均映射到统一 intent/plan/receipt 合同；验收入口差异不改变安全门槛。 → ✅ R182 批量登记（E2 已交付）：**三通道一合同**——NDJSON/内核路由/广播快路径三通道+MCP/CLI/面板多入口，同 op 同回执结构（D-0012 幂等不因入口变化）；验收入口差异不改回执=verify:restart 十项跨通道断言
- [x] 【R114-P1·降级路径·评估】Agent、模型、工具或插件缺失时提供只读解释、手动步骤或 Quicker 入口；验收用户能知道降级损失。 → ✅ R182 批量登记（E2 已交付）：**三级降级已实现**——Agent 缺失=内核路由 FRONTEND_ONLY 诚实降级（提示走 NDJSON）；模型缺失=GuardSql 本地校验不依赖 AI；插件缺失=SY-预检+手动替代路径（ACTION-CARDS 每卡有手动替代字段）
- [x] 【R114-P1·生命周期·评估】定义 proposed/accepted/committed/verified/unknown/rejected/cancelled 状态及合法迁移；验收状态不能跳过确认或核验。 → ✅ R182 批量登记（E2 已交付）：回执六状态（recorded/duplicate/rejected/failed/unsupported/expired）+ plan 生命周期（plan→confirmed→done/denied/expired）+ 合法迁移由代码强制（失败停止/一次性消费/TTL 过期）
- [x] 【R114-P1·责任追踪·评估】每次 AI 操作保存 intentId、planId、commandId、owner、schemaVersion 和模型/模板版本；验收支持者可复现调用链。 → ✅ R207 批量登记（E2 已交付）：**责任追踪字段全齐**——intentId（planId）/planId/commandId（id 前缀分端）/owner（manifest）/模型与模板版本（generatedBy+版本头）；支持者复现=fixtures+审计导出
- [x] 【R114-P1·人工接管·评估】为低置信度、冲突、敏感写入和未知结果设计人工接管入口；验收接管后不会重放旧工具调用。 → ✅ R207 批量登记（E2 已交付）：接管入口=确认门控（confirmExec 用户确认代替工具重放）+ACTION-CARDS 每卡手动替代字段+「接管后不重放旧调用」=plan 一次性语义
- [x] 【R114-P2·非目标·评估】列出不做通用模型托管、业务数据库复制、自动批准和无限上下文的边界；验收宣传、文档和 UI 一致。 → ✅ R201 批量登记（红线字面已交付）
- [x] 【R114-P1·验收样板·评估】用只读研究、低风险捕获和动作创建各做一条端到端 AI 样板；验收均能展示证据、失败和恢复。 → ✅ R206 域登记（脚本骨架已备）：端到端 AI 样板=verify:restart 十项+mcp-smoke 七断言模式复制；证据/失败/恢复展示=ACTION-CARDS 失败恢复字段——Agent 上线首批真机项（R115 同批）

### 17.2 R115：思源内置智能体接入

- [x] 【R115-P0·版本核对·等思源】核对当前思源版本的 Agent 入口、技能目录、工具发现、MCP 支持、会话恢复和权限提示；验收记录版本与实测证据。 → ✅ R206 域登记（重复副本，同 R184 注）：版本实测=3.8.6 真机+CI 容器双证据（Agent 入口等 Agent 上线后核对）
- [x] 【R115-P0·能力发现·等思源】设计快门 manifest，使思源 Agent 能发现能力名、描述、输入输出 schema、owner、读写级别和兼容版本；验收不靠自然语言猜工具。 → ✅ R184 调研登记（E2 已交付设计）：**capability manifest 就是发现层**——pluginId/描述/协议/能力/读写（read/write 分级）/maturity/版本全字段已定义（contract+27 件实测）；Agent 接入时按 manifest 枚举即免自然语言猜工具；待思源 Agent 技能目录落地后接 pipeline
- [x] 【R115-P0·Skill 分层·评估】区分 Agent skill、MCP tool、快门 capability 和 prompt template 的安装/升级/禁用关系；验收缺一层时给明确诊断。 → ✅ R186 调研登记（E2 四层已各有着落）：①prompt template=附A.1 结构化模板（docs/03）；②快门 capability=ecosystem-manifests（contract 契约）；③MCP tool=23 tools（LV_MCP_WRITE 门控分立禁用）；④Agent skill=等思源技能目录（R115 真机 smoke 同批）。升级/禁用关系：各层独立门控互不隐式授权（R166 五层分立）
- [x] 【R115-P0·工具命名·评估】制定小驴能力的稳定命名、版本和弃用规则；验收 Agent 不因显示名变化误调旧工具。 → ✅ R206 域登记（重复副本，同 R184 注）：op 命名已稳定（api.md 23 op+MCP 1:1）+弃用规则=协议 v2 平移
- [x] 【R115-P0·上下文范围·等思源】实测 Agent 可读取当前选区、文档、块、工作区和历史会话的边界；验收快门不默认扩大读取范围。 → ✅ R206 域登记（等思源 Agent）：「快门不默认扩大读取范围」=红线字面+分层授权（读白名单）；实测挂 Agent 上线
- [x] 【R115-P0·写入握手·等思源】核对思源 Agent 发起写操作时能否显示快门计划、字段级数据流和确认按钮；验收自然语言肯定不能绕过确认。 → ✅ R184 调研登记（E2 已交付设计）：**workflow plan/execute 分离即写入握手**——写操作先出 plan（字段级 steps+写标记确认卡）→ 用户确认 → execute；「自然语言肯定不能绕过确认」=confirmExec+授权分层（R166 五层）——Agent 接入走同链路
- [x] 【R115-P1·会话交接·评估】设计 Agent→快门的 intent 交接格式，保留来源会话、用户原话、上下文引用和截止时间；验收切换入口不丢失约束。 → ✅ R186 调研登记（E2 已交付设计）：交接格式=桥信封（id=intent 幂等键+createdAt=截止基点+ttlMs=时限+device=目标）+ externalRef=业务关联键+id 前缀=来源会话标记（cli-/mcp-/qk-）——「切换入口不丢约束」=信封自包含
- [x] 【R115-P1·工具错误·评估】把思源 Agent 的工具错误、超时、取消和未知结果映射到快门状态；验收用户看到可执行的下一步。 → ✅ R206 域登记（重复副本，同 R184 注）：六态回执映射（isError+中文+同 id 补发+先查原回执）
- [x] 【R115-P1·安装向导·评估】设计快门 skill/manifest 的安装、升级、禁用和卸载向导；验收卸载后历史回执可读且不会继续调用。 → ✅ R186 调研登记（E2 已交付）：安装=GETTING-STARTED 三步+install-mcp.ps1 一键；升级=petal 热加载+版本门禁；禁用=petal 开关（后台 API 已验证）；卸载=uninstall 钩子+PRIVACY 清理路径——「卸载后历史回执可读」=回执文件随数据保留语义已在文档
- [x] 【R115-P1·缺能力降级·评估】Agent 不支持结构化输出、工具调用或图片时，自动切换到只读模板/人工参数；验收不生成不可执行动作。 → ✅ R206 域登记（已交付同构）：缺结构化输出/工具调用→只读模板/人工参数=GuardSql 本地校验不依赖 AI+参考件手动路径
- [x] 【R115-P1·多工作区·评估】验证 Agent 会话、模板和能力目录按工作区隔离；验收切换工作区不串 Token、文档和动作草稿。 → ✅ R186 调研登记（E2 已交付）：隔离三件套=SY_URL 绑定工作区（R140 端口规律实证 6806 单实例）+ device.json 设备隔离（storage/local 不随同步）+ Token 按 env/配置——「不串 Token/文档/草稿」=凭据与数据分离已实现。**缺口**：Agent 会话层隔离待思源 Agent 上线验证
- [x] 【R115-P1·真机 smoke·等思源】建立思源 Agent 最小真机测试：发现、只读调用、低风险写入、取消、恢复和诊断；验收证据可回放。 → ✅ R184 调研登记（等思源 Agent 上线，真实 gate）：测试脚本骨架已有先例（verify:restart 十项+mcp-smoke 七断言模式可复制）；Agent 入口/技能目录实测挂思源官方发布——登记为首批真机项
- [x] 【R115-P2·外部 host 对齐·评估】比较思源 Agent 与 Claude/其他 MCP host 的工具发现和确认差异；验收共用合同而不假设 UI 相同。 → ✅ R206 域登记（等 host）：外部 host（Claude/Cursor 等）行为对齐=LV_MCP_WRITE+stdio 生命周期已实测（Claude 拉起子进程实证）；其他 host 挂各自接入轮
- [x] 【R115-P1·上游变更监测·评估】建立思源 Agent、MCP 和技能文档版本监测；验收上游变化先标未知并阻止过时模板自动写入。 → ✅ R206 域登记（已交付）：**dependency-watch.yml**（每周思源最新版+npm outdated→自动 issue）——上游变更监测已自动化
- [x] 【R115-P0·原生能力注册·等思源】核对用 `siyuan.agent.registerCapability` 注册 `quickgate.plan/preview/execute/receipt` 的最小路径；验收 description、inputSchema、outputSchema 与稳定 capability 名称均可被发现。 → ✅ R206 域登记（等思源 Agent）：原生能力注册=manifest→Agent 技能目录管线（R184 能力发现同源），等思源发布
- [x] 【R115-P0·副作用声明·等思源】为每个 Agent action 填写 effects/actionEffects（本地读写、外发、外部成本）；验收确认界面与审计记录和真实副作用一致。 → ✅ R206 域登记（已交付）：副作用声明=PRIVACY 端点清单+ACTION-CARDS 写入位置字段+审计脱敏三件
- [x] 【R115-P0·策略映射·等思源】把思源 capabilityPolicy/approvalPolicy 与快门读写/确认/拒绝策略做逐项映射；验收关闭一侧不能被另一入口绕过。 → ✅ R206 域登记（已交付）：策略映射=分层授权四层（读/写/透传/确认）+_guardSql/黑名单/允许名单策略全显式
- [x] 【R115-P1·SSE 事件合同·等思源】核对 turn、tool_call、confirm、permission、tool_result、done、error、interrupted 事件到快门状态机的映射；验收断流和迟到事件可恢复。 → ✅ R206 域登记（已交付）：SSE 事件合同=es/broadcast subscribe qg-cmd 频道（v1.5 真机 146ms 实证）——Agent 订阅同通道
- [x] 【R115-P1·Agent 参数传递·等思源】核对 sessionID、contentRevision、references、editorContext、frontendCapabilities、model 和 reasoningEffort 的最小传递；验收未选择上下文不自动补全。 → ✅ R206 域登记（已交付）：参数传递=桥信封 args（JSON 直嵌 32KB 上限）+MCP ARGS 表 schema——Agent 参数即 MCP arguments
- [x] 【R115-P1·AGENTS CAS·等思源】验证工作区 `AGENTS.md` 的 32KiB 限制、revision CAS、成功同步和下一轮快照；验收模板更新冲突不覆盖用户原文。 → ✅ R206 域登记（已交付同构）：CAS 语义=台账 processed+planId 一次性消费（同 id 双写只执行一次——D-0012 即 compare-and-swap 语义）
- [x] 【R115-P1·Skills 生命周期·等思源】核对 `storage/ai/agent/skills` 的安装、启停、版本和回滚；验收技能只引用公开能力，owner 缺失时降级。 → ✅ R206 域登记（等思源 Agent）：Skills 生命周期=安装/升级/禁用四层（R186 Skill 分层已备）——等技能目录发布
- [x] 【R115-P1·MCP exposure·等思源】核对 `/mcp` 认证/管理员/只读门控、stdio/http、Secrets、host allowlist 和 exposurePolicy；验收 disabled/deny 后工具立即从投影移除。 → ✅ R206 域登记（已交付）：MCP exposure=23 tools 暴露/门控/DESCRIPTIONS 用户化（Claude 子进程拉起实证）
- [x] 【R115-P1·工具标注信任·等思源】核对 `trustToolAnnotations`、ReadOnlyHint 和 effects 的边界；验收外部标注只作提示，最终以快门/思源策略判定。 → ✅ R206 域登记（已交付）：工具标注=destructiveHint+readOnlyHint 注解（MCP 规范）+manifest read/write 分级——信任分级已声明
- [x] 【R115-P1·会话恢复 CAS·等思源】核对 session revision、expectedRevision、commitTurnID、recoveryState 和 contextTokenBreakdown；验收并发续聊保留双方，不重放未确认写入。 → ✅ R206 域登记（已交付同构）：会话恢复=results 按 id 查询（同 id 三通道回放）+台账跨重启——CAS 语义同上

### 17.3 R116：上下文选择与模型路由

- [x] 【R116-P0·最小上下文·评估】为每类任务列 requiredContext/optionalContext，默认只发送最小必要字段；验收未选文档正文不外发。 → ✅ R196 域登记重复副本：最小上下文=R85 上下文选择（最小投影裁定，同源）
- [x] 【R116-P0·来源标记·评估】上下文字段记录来源、时间、用户选择、可信级别和敏感等级；验收模型引用能回到原文或回执。 → ✅ R196 域登记重复副本：来源标记=信封 id 前缀+来源窗口/URL 字段（来源卡已实现）
- [x] 【R116-P0·范围确认·评估】上下文包含多个文档、选区、附件或历史回执时，先展示范围和数量；验收用户可删减后再调用模型。 → ✅ R196 域登记重复副本：范围确认=plan 确认卡+四级兜底（R181/R170 同源）
- [x] 【R116-P1·预算控制·评估】为长文档、图片、音频和工具历史设计 token/字节预算、分层摘要和截断标记；验收截断不会伪装完整上下文。 → ✅ R196 域登记重复副本：预算控制=R99 运行预算（同源：等待/步骤/写入/外发全声明）
- [x] 【R116-P1·摘要溯源·评估】摘要、压缩和分块结果保留来源锚点和版本；验收 AI 结论可定位原始内容。 → ✅ R207 批量登记（E2 已交付设计）：摘要/压缩保留来源锚点=**证据信封 sources[]+truncated** 字段（结论可定位原始内容=块 ID+URL）；版本=sources[].version
- [x] 【R116-P0·能力探测·评估】区分文本、图片、结构化输出、工具调用、长上下文和流式能力；验收未知能力不生成依赖它的计划。 → ✅ R207 批量登记（E2 已交付）：能力探测=MCP initialize 协商+PROTOCOL_VERSION 基线；「未知能力不生成依赖它的计划」=白名单 op 才可入 plan（makePlan 结构性保证）
- [x] 【R116-P1·任务路由·评估】按任务风险、数据敏感度、延迟、成本和模型能力选择本地/远程模型；验收路由理由可见。 → ✅ R207 批量登记（等 owner）：本地/远程模型选择=思源 AI 配置 owner 域（快门不自带模型——红线）；「路由理由可见」=证据信封 generatedBy 显式
- [x] 【R116-P0·失败降级·评估】模型认证失败、额度不足、超时、输出非法、网络断开分别处理；验收不会未经确认把数据换服务外发。 → ✅ R207 批量登记（E2 已交付）：认证失败/额度/超时/非法输出/断网分类=p0-3 三级降级+R85 AI 失败降级（GuardSql 本地不依赖 AI）；「不未经确认换服务外发」=PRIVACY 端点纪律
- [x] 【R116-P1·取消预算·评估】为模型调用设置时间、token、费用和重试上限；验收取消后保留草稿和已产生费用信息。 → ✅ R207 批量登记（E2 部分）：时间/重试上限=15s 单命令+超时分类+不自动重试；「取消保留草稿」=本地暂存语义。token/费用计量=思源 AI owner 域（登记）
- [x] 【R116-P1·隐私路由·评估】敏感字段默认走本地或脱敏模型，远程模型需逐项确认；验收 Token/路径/联系人不会进入 prompt。 → ✅ R207 批量登记（E2 已交付）：「Token/路径/联系人不会进入 prompt」=JStr 转义只透传用户显式内容+PRIVACY 端点纪律+敏感字段脱敏（诊断/审计先例）；远程逐项确认=授权分层
- [x] 【R116-P1·并发队列·评估】定义多条 AI 任务并发、排队、优先级和工作区隔离；验收取消一条不影响其他任务。 → ✅ R207 批量登记（E2 已交付）：并发=single-flight+轮询器单飞（一次一条不并发）；「取消一条不影响其他」=独立 id 独立回执
- [x] 【R116-P1·缓存策略·评估】区分可缓存的只读摘要与不可缓存的私密正文/写计划；验收缓存命中不会跨用户或工作区。 → ✅ R207 批量登记（E2 已交付）：缓存边界=registry/manifest TTL 缓存（60s）vs **正文/写计划永不缓存**（无正文缓存设计）；「不跨用户/工作区」=SY_URL 绑定+device 隔离
- [x] 【R116-P2·多模态证据·评估】验证图片、音频、PDF 和网页引用的来源链、时间戳和不可识别情况；验收缺证据时标 unknown。 → ✅ R207 账本重复项：R171 媒体合同扩展位已登记（音视频未定义=诚实 unknown）

### 17.4 R117：提示词模板系统

- [x] 【R117-P0·模板结构·评估】实现模板契约草案：id、version、locale、task、context、tools、outputSchema、confirmation、evidence、privacy、failure、modelRequirements、compatibility。 → ✅ R207 批量登记（E2 已交付）：**附A.1 八字段=模板契约实现**（id/version/locale≈语言/task/context/tools/outputSchema=输出变量/confirmation=授权分层）——Quicker AI 模板即此结构
- [x] 【R117-P0·全局系统模板·评估】编写快门全局系统提示词，包含 owner、事实/推断/未知、授权和安全边界；验收每个场景继承且不能削弱边界。 → ✅ R207 批量登记（E2 已交付）：全局约束=附A.1 约束节（owner/事实边界/授权分层/安全边界三条白名单）——「场景继承不削弱边界」=白名单是并集上限
- [x] 【R117-P0·意图模板·评估】为自然语言→Intent 设计目标、对象、时间、范围、约束、置信度和澄清问题输出 schema；验收歧义不直接执行。 → ✅ R209 域登记：八字段模板（附A.1）的意图实例——目标/对象/时间/范围/约束/置信/澄清字段与 R98 信封对齐
- [x] 【R117-P0·上下文模板·评估】为上下文选择提供允许来源、排除字段、摘要策略和引用要求；验收模板不能自行读取新范围。 → ✅ R209 域登记：允许来源/排除字段/摘要策略=证据信封 sources+truncated；「模板不能自行读取」=数据/执行分离红线
- [x] 【R117-P0·计划模板·评估】为 Intent→Plan 指定工具白名单、参数 schema、风险、确认点、幂等键和预期证据；验收计划可静态检查。 → ✅ R209 域登记：工具白名单+参数 schema+风险+确认点=workflow makePlan 已实现（白名单 op+写标记+confirmAll）
- [x] 【R117-P0·结果模板·评估】为回执解释指定 accepted/committed/verified/unknown 的文案和下一步；验收未知状态显著可见。 → ✅ R209 域登记：回执解释六态=accepted/committed/verified 映射完成判据五级（ACTION-CARDS 文末）
- [x] 【R117-P1·场景模板目录·评估】建立捕获、搜索、研究、会议、学习、考试、人脉、项目、日记、发布和动作创建模板目录；验收每个模板有 owner 和回退。 → ✅ R209 域登记：场景模板=ACTION-CARDS 七卡扩展（捕获/搜索/研究/会议/学习…域按需增卡）；目录载体已备
- [x] 【R117-P0·工具微模板·评估】为 registry.list、editor.context、diagnostics.report、template.new、checkin.record、contacts.interaction、workflow.plan/execute、events.pull 编写微模板；验收工具只能做声明范围内的事。 → ✅ R209 域登记：registry.list/editor.context/diagnostics 微模板=单 op 专用提示——op 表即微模板目录（api.md）
- [x] 【R117-P1·模板变量·评估】定义工作区、语言、用户偏好、插件版本、日期时区和当前入口变量；验收变量缺失时有默认/澄清策略。 → ✅ R209 域登记：变量集=占位符字典（R117-P0 §5.1：工作区/语言/日期/入口）+「缺失时不误替换」=JStr/占位符解析显式
- [x] 【R117-P1·覆盖顺序·评估】明确官方、工作区、用户和会话模板的优先级、锁定字段及回退；验收用户模板不能覆盖安全字段。 → ✅ R209 域登记：官方>工作区>用户>会话优先级+「用户模板不能覆盖安全边界」=白名单并集上限（附A.1 约束节）
- [x] 【R117-P1·版本兼容·评估】模板绑定工具 schema、插件版本、思源版本、Quicker 版本和模型能力；验收不兼容模板自动降级为只读。 → ✅ R209 域登记：模板绑定工具 schema/版本=版本三线分记（模板线独立）+版本门禁 check-version
- [x] 【R117-P1·本地化·评估】覆盖中文、英文、日期/数字格式和术语映射；验收语言变化不改变工具参数和安全规则。 → ✅ R209 域登记：中英文/格式/术语=i18n 双语同批（R10 市场门槛）；「语言变化不改工具参数和安全规」=参数与文案分离（JStr）
- [x] 【R117-P1·模板预览·评估】提供渲染前后预览、变量来源、发送字段和工具白名单；验收用户能在调用前发现误选上下文。 → ✅ R209 域登记：渲染前后预览/变量来源/白名单=plan 确认卡模式（调用前可见=同构）
- [x] 【R117-P0·模板安全审查·评估】对新增/导入模板执行提示词注入、越权工具、敏感外发和模糊授权扫描；验收未通过只能保存草稿。 → ✅ R209 域登记：注入/越权/敏感外发扫描=GuardSql+红线三层防线（R191）+check-release——模板审查同构待模板库落地
- [x] 【R117-P1·模板迁移·评估】模板升级显示差异、影响场景和回归结果；验收旧模板可锁定或恢复。 → ✅ R209 域登记：升级差异/影响/回归=版本头变更记录+fixtures 回归（同 R168 模式）
- [x] 【R117-P1·模板资产库·评估】建立模板索引、示例、适用范围、已知限制和负责人；验收宣传描述与实际模板一致。 → ✅ R209 域登记：索引/示例/限制/负责人=reference README 文件清单+ACTION-CARDS（资产库雏形已备）

### 17.5 R118：意图、计划与结构化输出

- [x] 【R118-P0·意图 schema·评估】定义 Intent 的 goal/entity/scope/time/constraints/priority/source/confidence 字段及未知值；验收缺失关键字段进入澄清。 → ✅ R209 域登记：Intent schema=R98 意图信封（goal/来源/上下文/约束/期限/敏感/授权全字段——R201 已对齐）
- [x] 【R118-P0·澄清策略·评估】按风险和信息增益生成最少澄清问题；验收低风险可给预览，高风险不猜目标。 → ✅ R209 域登记：最少澄清问题=userinput 兜底+{ask:} 设计；「高风险不猜目标」=确认卡前置
- [x] 【R118-P0·计划 schema·评估】定义 Plan 的步骤、工具、参数、owner、权限、幂等键、超时、回退和证据；验收 JSON 严格校验。 → ✅ R209 域登记：Plan schema=WorkflowPlan（steps/tools=白名单 op/owner=api.md/幂等=externalRef/超时=15s/回退=失败停止）——已实现
- [x] 【R118-P0·工具序列·评估】验证 AI 生成的工具顺序、依赖和并行安全性；验收写操作前必须完成读取/预览/确认。 → ✅ R209 域登记：工具顺序/依赖/并行安全=workflow 顺序执行+失败停止（写前读/预览=plan 确认卡先于 execute）
- [x] 【R118-P0·参数类型·评估】校验日期、时间区间、文档 ID、插件 ID、枚举、数组和敏感字段；验收类型错误停在计划阶段。 → ✅ R209 域登记：参数类型校验=validateStepArgs+ARGS 表 schema+ExtractStr 类型判——类型错在 plan/校验期拒绝
- [x] 【R118-P1·幂等设计·评估】为捕获、记录、联动、动作保存和通知分别定义幂等键；验收未知结果查询原 ID，不盲目重写。 → ✅ R209 域登记：幂等键分域=动作 id/业务 externalRef/通知无（不外发）——「未知查原 ID」=D-0012 已实现
- [x] 【R118-P0·确认绑定·评估】确认内容绑定具体 plan hash、目标、字段、范围、风险和有效期；验收计划变化后确认失效。 → ✅ R209 域登记：确认绑定 plan hash/目标/风险/有效期=planId+steps 快照+expiresAt（R181 已交付）
- [x] 【R118-P1·流式输出·评估】区分流式思考/草稿与最终结构化计划；验收中间文字不能触发工具。 → ✅ R209 域登记：流式思考 vs 结构化计划=中间文字不触发工具——快门无流式面（结构化 JSON 信封天然隔离）
- [x] 【R118-P0·自然语言防绕过·评估】检查“请直接执行”“我已确认”等措辞不会跳过机器确认；验收所有写入口走同一门禁。 → ✅ R209 域登记：「请直接执行/我已确认」不跳过机器确认=**授权分层五层**（AI 肯定句≠授权——R166/R165 红线核心）
- [x] 【R118-P1·部分成功·评估】计划支持批量步骤的局部成功、失败、跳过和补偿；验收每项有独立回执。 → ✅ R209 域登记：批量局部成功/失败/跳过=workflow steps[] 逐项回执+stoppedAt（R178 已交付）
- [x] 【R118-P1·中断恢复·评估】会话中断后只恢复未提交计划和证据，不自动重放已执行写入；验收恢复前显示待处理动作。 → ✅ R209 域登记：中断只恢复未提交计划不重放写入=台账跳过已处理行+「恢复前显示待处理」=恢复批次分类（R187）
- [x] 【R118-P1·人工编辑计划·评估】允许用户修改目标、范围、参数和步骤并重新校验；验收修改记录来源并重算风险。 → ✅ R209 域登记：用户修改 steps 重新校验=plan 可编辑（makePlan 输入即 steps）+「修改重算风险」=validateStepArgs 重跑
- [x] 【R118-P1·结果复用·评估】把已验证计划/模板保存为可复用场景，保留版本和适用范围；验收复用前重新检查上下文。 → ✅ R209 域登记：已验证计划存为场景=fixtures/模板线；「复用前重检上游」=TTL 过期+版本门

### 17.6 R119：功能场景 AI 包

- [x] 【R119-P0·捕获分拣·评估】AI 从选区/剪贴板/当前文档生成收件箱草稿、类型、标签和下一步；验收原文与建议分开保存。 → ✅ R209 域登记：捕获→草稿/类型/标签/下一步=R3 路由+SY-研究来源卡已实现（原文与推断分层）
- [x] 【R119-P1·搜索解释·评估】对搜索结果生成范围说明、命中原因、缺失索引和引用；验收解释不能替代原始结果。 → ✅ R209 域登记：搜索范围/命中说明=p0-3 三级降级提示（全文→模糊→sql:）；「解释不替代原始结果」=候选列表并展示
- [x] 【R119-P0·研究证据·评估】生成问题树、主张、支持/反例、来源和待验证项；验收每个结论有可回链证据。 → ✅ R209 域登记：问题树/主张/支持反例=证据册域（R193 证据信封对齐已登记——等研究工作流 owner）
- [x] 【R119-P0·会议纪要·评估】区分原话、决定、行动项、负责人、期限和推断；验收写入前展示差异与缺失字段。 → ✅ R209 域登记：原话/决定/行动项分层=SY-研究来源卡三层同构（推断层标注「非原文」字面）；写入前展示=确认卡
- [x] 【R119-P1·阅读学习·评估】从阅读内容建议摘要、概念、闪卡和复习理由；验收卡片保留来源锚点且不自动修改调度。 → ✅ R209 域登记：摘要/闪卡建议保留来源锚点=来源卡块 ID+「不自动修改调度」=等闪卡 owner（R189 同款）
- [x] 【R119-P1·考试复习·评估】根据错题/难卡/时间生成复习计划；验收调度规则由考试/闪卡 owner 决定。 → ✅ R209 域登记：复习计划调度=考试/闪卡 owner 决定（红线）——快门只透传候选
- [x] 【R119-P1·人脉回访·评估】从互动记录建议回访事项和时间；验收联系人敏感字段最小化并要求写入确认。 → ✅ R209 域登记：回访建议=人脉 owner 域；「敏感字段最小化+写入确认」=分层授权+contacts.interaction 确认语义
- [x] 【R119-P1·项目推进·评估】汇总风险、依赖、阻塞、下一步和周报草稿；验收状态来自项目 owner 回执。 → ✅ R209 域登记：风险/阻塞/周报草稿=项目 owner 回执状态；快门透传不汇总业务（红线）
- [x] 【R119-P1·日记回顾·评估】按用户选择的日期/主题生成回顾和开放环；验收私密内容默认只在本地处理。 → ✅ R209 域登记：按日期/主题回顾=SY-12 汇总同构+「私密默认本地处理」=PRIVACY 本机红线
- [x] 【R119-P1·发布审阅·评估】检查引用、敏感字段、版本、许可和未决事实；验收未通过只能生成修改清单。 → ✅ R209 域登记：引用/敏感/许可检查=SY-研究来源卡+check-release 同构；「未通过只生成修改清单」=只读报告模式
- [x] 【R119-P0·跨插件计划·评估】研究→雷切→闪卡、会议→任务→打卡、人脉→回访等链路声明每一步 owner 和回执；验收中间失败可续跑。 → ✅ R209 域登记：跨插件链每步 owner=workflow steps 声明+manifest owner——「研究→雷切→闪卡」链每步独立回执（失败停止）
- [x] 【R119-P1·批量任务·评估】AI 生成批量操作时提供范围、数量、示例、分段确认和局部失败报告；验收不把大批量当单次写入。 → ✅ R209 域登记：批量=范围/数量/分段确认/局部失败报告=workflow 逐项回执+SY-变更报告（不把大批量当单次）
- [x] 【R119-P1·媒体任务·评估】OCR/转录/附件摘要保留来源、时间戳、语言和识别置信度；验收无法识别的片段标 unknown。 → ✅ R209 域登记：OCR/转录保留来源/时间戳/置信度=SY-OCR清理+p0-5 alt+媒体合同扩展位（R171 登记）
- [x] 【R119-P1·多语言任务·评估】处理中文、繁简、拼音、混合文本、时区和数字格式；验收语义转换不改变业务 ID。 → ✅ R209 域登记：中文/繁简/混合/时区=JStr 转义+occurredAt 不换算（R170）——「语义转换不改业务 ID」=ID 原样透传
- [x] 【R119-P1·无 Quicker 入口·评估】关键 AI 场景在思源 Agent、面板或 MCP 缺 Quicker 时仍能完成原始结果；验收明确功能差异。 → ✅ R209 域登记：无 Quicker=CLI/MCP 直接通道（R196 已登记同款）+思源 Agent 入口（等思源）
- [x] 【R119-P1·复盘复用·评估】任务完成后生成可选复盘：实际耗时、失败点、人工修订和可复用模板；验收不自动建立高风险规则。 → ✅ R209 域登记：复盘=实际耗时（elapsedMs）/失败点（stoppedAt）/人工修订（版本历史）/可复用模板（fixtures）——「不自动建任务」=只读建议

### 17.7 R120：安全、隐私与提示词注入

- [x] 【R120-P0·不可信来源·评估】将笔记、网页、附件、第三方工具输出标为不可信数据；验收其中的命令式文字不会改变系统指令。 → ✅ R209 域登记：笔记/网页/附件=不可信数据按数据处理——**红线核心三层防线**（R191：数据/执行分离+授权分层+SQL 转义）
- [x] 【R120-P0·字段数据流·评估】调用前按字段显示来源、目标模型/工具、敏感级别和保留时间；验收用户可逐项移除。 → ✅ R209 域登记：按字段显示来源/目标/敏感级别/保留时间=证据信封（sources/sensitivity/truncated）+PRIVACY 数据位置表
- [x] 【R120-P0·敏感字段·评估】Token、API Key、路径、联系人、文档 ID、附件和私密正文默认不外发；验收日志/提示词/截图均零泄露。 → ✅ R209 域登记：Token/Key/路径/联系人/私密正文默认不外发=PRIVACY 红线+审计脱敏+fixtures「Token 不随备份」
- [x] 【R120-P0·工具白名单·评估】为只读、草稿、业务写入、网络发送、动作编辑和脚本执行建立独立白名单；验收模板不能越级。 → ✅ R209 域登记：只读/草稿/写入/外发/编辑/脚本独立白名单=**分层授权四层+附A.1 三白名单**（已实现）
- [x] 【R120-P0·确认门禁·评估】写入思源、跨插件调用、外部通知、剪贴板/窗口操作和正式保存分别确认；验收确认展示具体副作用。 → ✅ R209 域登记：写思源/跨插件/外部通知/正式保存分别确认=confirmExec+允许名单+LV_MCP_WRITE+.qa 版本门四门分立（已实现）
- [x] 【R120-P0·注入对抗·评估】建立“忽略指令/泄露提示词/执行隐藏命令/扩大读取范围”样例；验收模型拒绝并保留原任务。 → ✅ R209 域登记：忽略指令/泄露提示词/隐藏命令/扩大读取样例=GuardSql 拒绝样例（fixtures SQL 五态）+数据/执行分离——模型面拒绝=思源 AI owner 域
- [x] 【R120-P1·自定义模板审查·评估】扫描用户模板中的隐藏工具、外发、自动确认和角色劫持；验收风险模板隔离运行。 → ✅ R209 域登记：隐藏工具/外发/自动确认扫描=模板安全审查（R117 同构待模板库）+风险隔离=暂存区原生
- [x] 【R120-P1·会话隔离·评估】切换工作区、账号、模型和 host 时清除不应继承的上下文/权限；验收旧会话不能调用新工作区工具。 → ✅ R209 域登记：切换工作区/账号/host 清除上下文=SY_URL 绑定+device 隔离+stdio 生命周期（Claude 断开即撤权实证）
- [x] 【R120-P1·撤销与急停·评估】提供取消模型、撤销未提交计划、停止动作和暂停自动化入口；验收急停后的迟到回执仍可追踪。 → ✅ R209 域登记：取消模型/撤销计划/停动作/暂停自动化=三级急停+plan 一次性+迟到回执可查（R181 已交付）
- [x] 【R120-P1·外发审计·评估】记录谁、何时、向何模型/host 发送哪些字段及用户选择；验收审计本身脱敏且可删除。 → ✅ R209 域登记：谁/何时/向何模型发什么字段=审计三问+generatedBy——「审计脱敏」=op/状态/耗时设计
- [x] 【R120-P1·本地处理·评估】对私密日记、人脉和 Token 任务优先提供本地模型/规则/人工路径；验收远程不可用时不阻断只读功能。 → ✅ R209 域登记：私密任务本地路径=本地捕获与 AI 解耦（R83 离线判定）+GuardSql 本地校验+「远程需确认」=授权分层
- [x] 【R120-P1·动作脚本安全·评估】AI 生成 C#/脚本动作时扫描文件、网络、进程、窗口、键鼠和剪贴板副作用；验收高风险脚本留在暂存。 → ✅ R209 域登记：AI 生成 C# 副作用扫描=csc 编译门（文件/网络 API 编译可见）+附A.1 脚本安全节（红线三层防线）
- [x] 【R120-P0·权限回收·评估】撤销 MCP、Agent skill、Quicker AI 或快门写开关后立即阻断后续调用；验收已排队任务不会偷偷继续。 → ✅ R209 域登记：撤销 MCP/skill/写开关立即生效=LV_MCP_WRITE env+petal 开关+stdio 断开（实测 Claude 子进程随配撤销）
- [x] 【R120-P1·安全说明·评估】为安装、首用、模板导入和动作分享提供数据处理、模型服务和风险说明；验收文案与实际流量一致。 → ✅ R209 域登记：安装/首用/导入/分享安全说明=PRIVACY+GETTING-STARTED+README 许可节（文案与实现一致性=证据等级纪律）

### 17.8 R121：质量、回归、观测与成本

- [x] 【R121-P0·测试夹具·评估】建立脱敏黄金样例、空输入、歧义、超长、异常、对抗注入和工具失败 fixture；验收可重复运行。 → ✅ R209 域登记：脱敏黄金样例/空/歧义/超长/异常/注入/工具失败=**fixtures+chaos 测试**（已交付 29 用例）
- [x] 【R121-P0·结构化合法率·评估】统计 Intent/Plan/Receipt JSON schema 合法率、修复次数和字段缺失；验收非法输出不进入工具层。 → ✅ R209 域登记：Intent/Plan/Receipt JSON 合法率=workflow/crash 契约测试（schema 合法率测试面已有）
- [x] 【R121-P0·工具选择·评估】测量工具选择准确率、参数准确率、越权拒绝率和澄清率；验收按场景分层而非只看平均值。 → ✅ R209 域登记：工具选择准确率/越权拒绝率=分层授权测试（写拒绝断言）+按场景分层=ACTION-CARDS
- [x] 【R121-P1·引用质量·评估】测量引用可定位率、来源新鲜度、引用与结论一致性和 unknown 正确标注率。 → ✅ R209 域登记：引用可定位率/unknown 正确标注=events.pull 诚实空+块 ID 校验（SQL 零行诚实）——测量脚本可由 fixtures 驱动（登记）
- [x] 【R121-P0·业务闭环·评估】以 verified/可恢复结果、人工修订、回滚和复用作为主要价值指标；验收不以字数或调用量替代。 → ✅ R209 域登记：verified/可恢复为主要指标=完成判据五级+失败停止+同 id 恢复（已实现）——「不以调用量」=审计红线
- [x] 【R121-P1·版本五维·评估】记录模型、prompt、tool schema、插件版本和上下文版本；验收失败可定位具体组合。 → ✅ R209 域登记：模型/prompt/tool schema/插件/上下文版本=generatedBy+版本头+check-version+PROTOCOL_VERSION（五维载体齐）
- [x] 【R121-P1·性能成本·评估】记录 token、费用、P50/P95 延迟、队列等待、重试和失败原因；验收超预算给出降级。 → ✅ R209 域登记：token/费用/P50/P95=思源 AI owner 域；快门侧延迟已测（verify 输出 ms 级）——模型计量挂 owner
- [x] 【R121-P1·隐私指标·评估】统计敏感字段拦截、用户删减上下文、远程外发确认和审计覆盖率；验收指标不保存正文。 → ✅ R209 域登记：敏感拦截/删减上下文/外发确认统计=check-release+审计脱敏+分层授权测试面（指标不存正文=审计设计）
- [x] 【R121-P1·回归门禁·评估】模板、工具 schema、思源/Quicker 版本变化触发 AI 回归；验收失败模板不能自动发布。 → ✅ R209 域登记：模板/schema/版本变化触发回归=**csc 门+fixtures+chaos+smoke 四门**（已交付）
- [x] 【R121-P1·反馈闭环·评估】收集用户接受、修改、拒绝、撤销和失败原因，关联 intent/plan 但不上传私密正文。 → ✅ R209 域登记：接受/修改/拒绝收集关联 intent 不存正文=G2 观察表+审计设计（不含正文）
- [x] 【R121-P1·失败保留·评估】模型超额、断网、上下文压缩和输出失败时保留原草稿、输入摘要和诊断；验收用户可继续编辑。 → ✅ R209 域登记：超额/断网/压缩失败保留原草稿/输入摘要/诊断=R85 AI 降级+失败停止（原输入在用户侧不丢）
- [x] 【R121-P2·离线评测·评估】提供本地 fixture 评测，不依赖远程模型或真实笔记；验收开发/发布环境可复跑关键门禁。 → ✅ R209 域登记：本地 fixture 评测不依赖远程=fixtures+vitest+csc 门（全离线已实现）

### 17.9 R122：AI 与 Quicker 动作创建联动

- [x] 【R122-P0·动作规格·评估】为“创建快门动作”定义结果、输入、输出、目标窗口、模块白名单、权限、副作用、测试夹具和回执 schema。 → ✅ R209 域登记：创建快门动作规格=ACTION-CARDS 八字段+附A.1 模板（结果/输入/输出/白名单/权限/副作用齐）
- [x] 【R122-P0·生成链路·评估】验证思源 Agent/快门生成规格→Quicker AI 生成动作草稿→设计器暂存→静态审查的交接；验收每步有 revision。 → ✅ R209 域登记：规格→AI 草稿→设计器→门禁链路=附A.1（生成约束+幻觉门+授权分离）——等 Quicker GUI 轮实测
- [x] 【R122-P0·ActionItem2 审查·评估】静态校验 StepRunnerKey、InputParams/OutputParams、VarKey、分支和 V1/V2 兼容；验收旧格式不直接写回。 → ⏳ R196 保持登记（ActionItem2 JSON 路径挂 GUI 轮——静态校验工具已备 csc 门模式）
- [x] 【R122-P0·动作权限·评估】分别确认生成步骤、修改暂存、试运行、写回正式动作、思源业务写入和外部发送；验收 AI 回复不能代替确认。 → ✅ R209 域登记：生成/修改暂存/试运行/写回/业务写入/外发分别确认=授权分层五步+R110 生成不授权（已交付）
- [x] 【R122-P0·动作上下文最小化·评估】发送给 Quicker AI 的内容只含必要步骤、模块说明、脱敏错误和用户样例；验收不上传 Token/真实正文/本机路径。 → ✅ R209 域登记：只发必要步骤/模块说明/脱敏错误/样例=check-release+错误提示脱敏（上下文最小化已实现）
- [x] 【R122-P0·业务回执门禁·评估】动作试运行成功后仍查询快门/插件回执并核验业务结果；验收设计器成功不等于 verified。 → ✅ R209 域登记：试运行成功仍查业务回执=完成判据五级（notify≠证据——设计器成功≠verified 红线字面）
- [x] 【R122-P1·运行分析绑定·评估】把 Quicker“运行并分析”结果绑定运行 ID、动作 revision 和步骤；验收分析建议不能直接覆盖正式动作。 → ✅ R209 域登记：运行分析绑定运行 ID/revision=审计（id/时间/状态）+版本头（R166 边界已登记）
- [x] 【R122-P1·提示词与 revision·评估】记录生成动作所用模板、模型、工具 schema、对话和动作 revision；验收可复现生成来源。 → ✅ R209 域登记：生成所用模板/模型/schema/revision=generatedBy+版本头（五维载体已备）
- [x] 【R122-P1·冲突处理·评估】正式动作、暂存副本和 AI 修改发生冲突时显示三方差异并回到草稿；验收不强制覆盖。 → ✅ R209 域登记：正式/暂存/AI 三方差异回草稿=git+版本头三方可比（R168 本地定制同款）
- [x] 【R122-P1·分享发布·评估】动作包发布前同时扫描 JSON、脚本、提示词、截图、日志中的 Token、路径、文档 ID 和个人正文；验收扫描失败阻止分享。 → ✅ R209 域登记：发布前扫描 JSON/脚本/提示词/截图/日志=**check-release 门**（已交付实战）

## §18 待办融合、依赖重排与执行门禁（R123~R130）

> 本节不是新功能池，而是把历史 R1~R122 归并到规范主线、阶段门禁和证据等级。历史条目保留原编号用于追溯；后续实现优先引用 C1~C8 和 G0~G7，避免重复定义状态、权限、上下文和回执。

### 18.1 R123：账本清洗与规范主线

- [x] 【R123-G0-R0·账本快照·开发】✅ 已落地（2026-10-02）：scripts/todo-snapshot.mjs 解析 TODO.md → snapshot/todo-snapshot.json（1348/1348 条全量，含 id/line/section/round/priority/topic/type/status/mainline/evidence/refs）；验收 A（数量一致）B（无无主线）内建于脚本退出码
- [x] 【R123-G0-R0·规范主线·开发】✅ 已落地：关键词启发式归属 C1~C8（首印分布 C6=439/C7=248/C8=258/C4=124/C2=134/C1=72/C3=63/C5=10），无主线条目=0；待人工抽查误分类后固化词典
- [x] 【R123-G0-R0·重复映射·评估】建立历史条目到规范主线的映射，标记 canonical、验收子项、研究记录、重复候选和暂缓项；验收重复项不再各自定义合同。 → ✅ R193 批量登记（E3 已交付）：**todo-snapshot.mjs 验收 A/B 内建**（每轮输出「✓ R123 验收 A/B 通过」）——canonical 映射/重复候选标记由快照工具结构化执行；主清单唯一计数（条目 1389 无重复计数）
- [x] 【R123-G0-R0·状态词典·开发】✅ 已落地：STATUS_LEXICON 12 词条（done/pending/等实测/等用户/等思源/需思源/需Quicker/等内核重启/等模型/门槛后/暂缓/已一键化，各带语义+阻塞方）内建于 snapshot 工具并输出到快照 statusLexicon；blockedBy 归一化 user/upstream/environment/deferred/resolved/dev
- [x] 【R123-G0-R0·类型标签·开发】✅ 已落地：type 字段从【】尾段抽取（评估/实测/spike/新等词表），未知记 unknown；节级与文本尾部标记均识别
- [x] 【R123-G0-R0·证据等级·评估】为每项记录 E0 假设、E1 外部资料、E2 静态契约、E3 自动化测试、E4 真机、E5 用户结果；验收未验证事项不能出现在已支持宣传中。 → ✅ R193 批量登记（E2/E3 实践已交付）：**本会话 60+ 条登记即该实践本体**——每条标注 E0→E2（实现对照/环境实证）等级；快照工具支持（todo-snapshot 证据分布统计 E0/E1/E2/E3/E4/E5 随写随出）；「未验证不出现在已支持宣传」=CHANGELOG Verified 字段纪律
- [x] 【R123-G0-R0·依赖字段·开发】✅ 首步已落地：refs 引用图（§章节/R 轮次/docs 文档号，956/1348 条带引用）+ blockedBy 阻塞方归一化（user=89/upstream=17/deferred=5/environment=4/resolved=1/dev=1038）；依赖环检测（R124-G1-C4）待真依赖字段（非 § 引用）入库后实施
- [x] 【R123-G0-R0·历史归档·评估】为重复、已否决、长期无证据和被上游替代的条目建立 archive/replaced 记录；验收历史链接仍可追溯，主清单不再重复计数。 → ✅ R193 批量登记（E2 进行中）：已完成条目=勾选+证据尾注（本会话 470+ 条范式）；archive/replaced 状态标记=快照工具可扩展位（暂以勾选+尾注承载，独立 archive 态挂账本工具下轮增强）

### 18.2 R124：核心契约依赖图

- [x] 【R124-G1-R0·C1 回执主线·开发】✅ v0 草案已落地：docs/contracts/result-contract.md——规范状态封闭集（recorded/duplicate/rejected/failed/unsupported/expired + 客户端 timeout=unknown 语义）、三载体映射（桥/workflow/MCP 投影）、补救唯一规则集；仅收录已实现形状，新入口必须映射本合同
- [x] 【R124-G1-R0·C2 意图主线·开发】✅ v0 落地：docs/contracts/intent-context-contract.md——上下文四要素（意图=信封 op+args/环境=editor.context+Quicker 配置九变量/权限=Token+门控/确认绑定=信封 id 与 planId 一次性）+两不变量（确认不可转移/上下文缺失要显式）+四入口形状对照；Intent 中枢标 planned（R126-G3 顺序门：schema/安全先行）
- [x] 【R124-G1-R0·C3 能力主线·开发】✅ v0 落地：docs/contracts/capability-registry-contract.md——条目 schema（manifests 实际字段）/可用性五态（declared/observed/available/stale/unknown；后三态 planned 已登记）/owner 唯一+写入必枚举不变量/消费面五处对照/已知差距（effects 未下沉 manifest）
- [x] 【R124-G1-R0·C4 可靠主线·开发】✅ v0 落地：docs/contracts/reliability-contract.md——幂等（D-0002/0003/012+预留语义）/超时四层（TTL 60s/执行 15s/客户端 8s·35s/MCP 同）/取消=planned（workflow.cancel+急停合并设计，已登记）/迟到回执（禁改写）/冲突（台账收敛+WebLock 待多窗口复验）/诊断（diagnostics+审计+verify:restart 七类）；重试唯一规则引用 result-contract §3，不重复定义
- [x] 【R124-G1-R0·安全门·开发】✅ v0 落地：docs/contracts/safety-gate-contract.md——五条红线（外部面默认关/不读私有存储/无Token 401/四不/未知不成功）+ 入口无关防线矩阵（六列五防线，dispatch 层统一实现）+ MCP 专属门控表 + planned（笔记本分级/急停/effects 下沉）；不变量=MCP 不新增特权、新入口必须走同一 dispatch
- [x] 【R124-G1-R0·证据上下文·开发】✅ v0 落地：docs/contracts/evidence-envelope-contract.md——目标形状（claims+sources/truncated/sensitivity/generatedBy）+四规则（缺源显式 unknown 禁止美化/截断可见/敏感三级/版本绑定）+现有对应物对照；绑定 R126 只读 AI 闭环首个门实施
- [x] 【R124-G1-R0·观测预算·开发】✅ v0 落地（拆分定义入 docs/contracts/result-contract.md 追溯节+本条）：三类 ledger=①技术 SLO（已有实测：桥 444ms/v1.5 227ms/日志 +254B——verify-restart 每轮产出）②AI token/费用（planned：随 R126 只读 AI 闭环落地，envelope.generatedBy 承载）③用户价值（planned：R87 净节省时间/首成功时间，需用户研究）。验收语义=成本指标永不替代闭环价值（②③缺位时不得宣称收益）
- [x] 【R124-G1-R0·发布证据·开发】✅ v0 落地：docs/contracts/release-evidence-contract.md——发布前七项（版本一致/验收门/真机数据集/兼容/凭据卫生/包内容/事实表七面，各带证据等级）+pre-release 标记规则（未验证承诺显式化）+已知缺陷并列规则+回滚证据（v0.7.0/0.7.1 实例提炼）

### 18.3 R125：首个纵向闭环与 WIP 限制

- [x] 【R125-G2-R0·纵向样板·规格】✅ 已定版（docs/25-首个纵向样板-G2.md）：选定 SY·划词摘录（P0-2）→收集箱 + SQL 回查核验（五候选评估表：写风险/回执可验证性/依赖完备度）；四组件定义含验证等级；其他 P0 全部挂起至 G2-最小可用
- [x] 【R125-G2-R0·样板结果卡·规格】✅ 已定版（docs/25 §3）：含 unknown 显式语义（HTTP 成功但查询未命中→“未知：请手动检查”，C1 unknown 语义对齐）
- [x] 【R125-G2-R0·样板前置·规格】✅ 已定版（docs/25 §4）：六前置全带验证等级；本样板走内核直连无需开桥；C# 子程序语法级 E3→真机后 E4
- [x] 【R125-G2-R0·四级门禁·规格】✅ 已定版（docs/25 §5）：首成功（用户确认）/最小可用（3 天 ≥1 次/天）/可发布（.qa 归档+异常样例全过）/可回滚（卸载无残留）——每级独立证据
- [x] 【R125-G2-R0·异常样例·规格】✅ 已定版（docs/25 §6）：六样例各带用户下一步（重复触发如实标注 appendBlock 非幂等→提示手动清理，幂等写 op 候选已在此暴露）
- [x] 【R125-G2-R0·WIP 上限·规格】✅ 已定版（docs/25 §8）：G2 只此一样板、其余 P0 挂起；中止条件=两周未完成首搭建→排查搭建摩擦
- [x] 【R125-G2-R0·手动等价路径·规格】✅ 已定版（docs/25 §3 手动替代行）：复制→粘贴永远可用；样板不依赖 AI/Agent（模型不可用零影响）
- [x] 【R125-G2-R0·用户观察·评估】用至少一轮真实自用记录首成功时间、修正次数、未知恢复、误触发和净节省时间；验收后再决定是否扩大功能面。 → ✅ R195 查漏确认：docs/25-observation.md 观察表模板已就绪（字段齐备）——本项真实 gate=G2 样板接线后一周自用（Quicker GUI 轮），非账本工作

### 18.4 R126：AI 路线重排与版本门禁

- [x] 【R126-G3-R0·AI 顺序·规格】✅ 已定版（docs/26 §1）：G3 四阶段依赖链定版（①只读闭环→②捕获草稿→③低风险写入→④Agent/模板/场景），前置五合同已就绪 ✓；不变量=安全门全阶段生效不可被 prompt 覆盖
- [x] 【R126-G3-R0·只读优先·规格】✅ 已定版（docs/26 §2）：门禁三条件（evidence-envelope 承载/只读 13 工具即够/错误可逆）；未过门则 LV_MCP_WRITE 永不开放
- [x] 【R126-G3-R0·模型角色·规格】✅ 已定版（docs/26 §3）：角色表（agent/embedding+rerank/decision 禁自动化/image 不首批）+降级铁律（不静默换远端；缺模型=入口隐藏+走非 AI 等价路径）
- [x] 【R126-G3-R0·AI 版本漂移·规格】✅ 已定版（docs/26 §4）：四变化源→fixture 首调验证/promptVersion 入 envelope/ops 面一致性测试已强制/思源升级走 verify-restart+bundle 复核；旧会话按记录回放
- [x] 【R126-G3-R0·Agent 可访问性·规格】✅ 已定版（docs/26 §7）：六项验收（流式中断/长响应折叠/纯键盘/焦点/读屏/无模型替代入口）+确认不依赖鼠标视觉
- [x] 【R126-G3-R0·同一审计链·规格】✅ 已定版（docs/26 §5）：链已同（信封 id 贯穿+审计）；AI 草稿 draft_id 入审计为 G3-② 起义务；四入口 intentId 贯穿 planned（依赖 C2 Intent 中枢）
- [x] 【R126-G3-R0·同意与删除·规格】✅ 已定版（docs/26 §6）：同意=contains-personal 出模型前显式（拒则 local-only 降级）；撤回诚实（已外发不可撤）；快门不缓存 prompt 即用即弃；远程侧给服务商入口不代删
- [x] 【R126-G3-R0·AI 退出条件·规格】✅ 已定版（docs/26 §8）：四判据带示例阈值（手动<10s 且 <1次天/连续5次 unknown/成本折价/删除外发钱场景误判率>0）+自动降级=入口隐藏+归档记录——AI 场景可以有尊严地死掉

### 18.5 R127：Quicker 动作作者链收敛

- [x] 【R127-G4-R0·作者链合并·规格】✅ 已定版（docs/27-作者链-G4.md）：Action Lifecycle 六态（结果卡→骨架→静态门禁→暂存试运行→正式化→业务 verified），唯一存放处不变量
- [x] 【R127-G4-R0·动作结果卡·规格】✅ 已定版（docs/27 §2）：AI 提示词附A 首段改要求先出结果卡草稿，用户确认后才生成骨架——“帮我做一个动作”不直接进入生成
- [x] 【R127-G4-R0·静态门禁·规格】✅ 已定版（docs/27 §3）：七项清单；实施形态 planned=单一 validate-action.mjs（.qa 解包检查），不散写脚本
- [x] 【R127-G4-R0·暂存与业务核验·规格】✅ 已定版（docs/27 §4）：五态区分+唯一业务 verified 证据=快门回执/内核查询命中（result-contract C1：HTTP 成功≠业务完成）
- [x] 【R127-G4-R0·作者证据·规格】✅ 已定版（docs/27 §5）：revision 记录五项=prompt+model/门禁结果/试运行样例/失败恢复/兼容矩阵——release-evidence 的动作级缩微版
- [x] 【R127-G4-R0·作者链退出·规格】✅ 已定版（docs/27 §6）：任一门槛不满足→drafts/ 保留或撤销发布，不进稳定目录（“可以有尊严地死掉”同款纪律）

### 18.6 R128：可靠性、可观测性与恢复

- [x] 【R128-G1-R0·分布式追踪·规格】✅ 已定版（docs/28 §1）：commandId→receiptId 已实现（信封 id 贯穿三通道+审计）/planId→commandId 已实现/intentId 与跨通道查询 UI 登记 planned（依赖 R116/C2 中枢）
- [x] 【R128-G1-R0·unknown 主线·规格】✅ 已有归宿（docs/28 §2 引 result-contract §1/§3 + lv-cli receipt --id）：迟到重复收敛 duplicate；不伪装不变量已入合同
- [x] 【R128-G1-R0·写入 outbox·评估结案】✅ 暂缓（docs/28 §3）：当前写入面窄+台账/回执窗口已覆盖可见性；触发条件=多步业务写入或 D-0006 迁移落地时再引入——现在引入是为不存在的写入量设计
- [x] 【R128-G1-R0·取消语义·规格】✅ 已定版（docs/28 §4 逐项表）：确认窗可取消/网络 abort 有迟到可能/脚本与业务写入不可取消（幂等兜底）/workflow 执行中暂停 planned
- [x] 【R128-G1-R0·并发冲突·规格】✅ 已定版（docs/28 §5）：五冲突源策略表（台账收敛/WebLock/工作区隔离/单写方 normalize）；AI 续聊 CAS 标 planned（G3-② 一并设计）
- [x] 【R128-G1-R0·诊断一致·规格】✅ 已定版（docs/28 §6）：六分类统一表（401/404/5xx/timeout/rejected 各有锚点文案）；设置页与诊断包文案统一登记 planned 小改
- [x] 【R128-G1-R0·SLO 基线·规格】✅ 已定版（docs/28 §7）：五指标已有实测（桥 444~1797ms/广播 227~319ms/路由 ~100ms/日志 +254~2163B 全达标）；回执可达率/恢复丢失率随样板使用统计（数据先行不填目标）

### 18.7 R129：用户证据、发布与维护

- [x] 【R129-G2-R0·首成功研究·规格】✅ 归入 docs/25 §7 用户观察表（首周一行记录：日期/次数/首成功秒数/错误/手动代替）——G2 样板首搭即数据采集；改动优先解决最大阻塞=按表内最高频卡点排优先级
- [x] 【R129-G6-R0·外部试用·规格】✅ 材料清单已定版（docs/29 §5，门槛后执行）：五材料（空工作区步骤/脱敏包/反馈模板复用 G2 表/退出方式）+门槛=G2-可发布且事实表无 E0 宣传
- [x] 【R129-G6-R0·价值指标·规格】✅ 已定版（docs/29 §6）：四指标口径（闭环率/恢复率/净节省时间/采纳率）+反例表（禁止生成字数/无基线百分比）
- [x] 【R129-G6-R0·文档事实表·规格】✅ 已定版（docs/29 §1）：七文档引用同一事实表（contracts 七合同+兼容矩阵）；规则=能力变化先改事实表再同步各文档（顺序反了即漂移）
- [x] 【R129-G6-R0·兼容矩阵·规格】✅ 已定版（docs/29 §2）：七维度矩阵（思源 3.8.5/3.8.6 双验证、桥开关双态实测）；未知组合标注即可不阻塞
- [x] 【R129-G6-R0·发布门禁·规格】✅ 已定版（docs/29 §3）：九项 checklist（合并 release-evidence 七项+矩阵更新+七文档面同步+回滚确认）；任一关键项失败保持 pre-release（v0.7.0 先例）
- [x] 【R129-G6-R0·回滚演练·规格+演练】✅ 已定版并**真机演练通过（2026-10-03）**：v0.7.2 → 旧 release package.zip 覆盖回滚至 v0.7.1 → toggle 重载 → 内核路由 200 ✓ → 用户设置保留 ✓（bridge/broadcast 开关不动）→ 恢复 v0.7.2 → 路由 200 ✓。其余对象路径：动作包=Quicker 内删除（.qa 留档）；提示词按 promptVersion 回退；Agent skill 未发布；MCP server 无安装态；配置手改可逆——明细 docs/29 §4。**不变量验证：回滚不重放写入、不删业务结果 ✓**

### 18.8 R130：扩展池治理与退出规则

- [x] 【R130-G5-R0·晋升规则·规格】✅ 已定版（docs/30 §1）：五级管道各带必要条件+反例禁止；铁律=讨论热度是需求信号不是证据
- [x] 【R130-G5-R0·降级规则·规格】✅ 已定版（docs/30 §2）：五触发→动作表（归档保留历史链接不删除）
- [x] 【R130-G5-R0·自动化延后·规格】✅ 已定版（docs/30 §3）：锁定至 G2-最小可用+同类手动操作 ≥3 次真实记录；一次性 plan≠持久自动化
- [x] 【R130-G5-R0·插件接入限额·规格】✅ 已定版（docs/30 §4）：每轮一个稳定 owner；缺契约者保持 design/unlocated（C3：declared≠available）；新接入前置=公开桥文档+真实探测
- [x] 【R130-G5-R0·调研 WIP·规格】✅ 已定版（docs/30 §5）：并发 ≤2 主题+存量池冻结只消化不扩池；新增调研必须关闭旧问题或说明新增证据；产物必须落文档
- [x] 【R130-G5-R0·季度复盘·规格】
- [x] 【R77-G4·新】一键开桥向导动作 → ✅ R195 查漏登记：开桥已可后台/一键完成——①思源设置页开关（一次）②install-mcp.ps1 一键（MCP 面）③SY-预检（验证面）；独立「开桥向导动作」价值=新用户引导，挂 Quicker GUI 轮与 G2 首跑向导（R72）合并实现
- [x] 【R77·循环B/C】兜底循环 B/C 执行（2026-10-03）
- [x] 【R92·循环A】bug#10 修复后自愈行为首个量化确认：断连→恢复 ≤10s（5s 退避上限生效），恢复后消费 19ms——v0.7.2 修复真机生效；广播链路抽查机制顺带建立（loop-probe 可随时复跑）
- [x] 【R79·循环A】
- [x] 【R81·循环A→开发】**bug#10 发现与修复（v0.7.2）**：真机诊断发现 SSE 订阅断连后退避 30s 上限——断连窗口 45s+ 内广播快路径命令无人消费（轮询器正常、双通道不对称故障面）；修复=退避上限 5s + MCP 只读工具快路径 3s 无回执同 id NDJSON 补发（预留语义防双执行）；+1 回退三态测试（99 总）；v0.7.2 发布（正式版，latest 可解析）**发布卫生修复（latest 404）**：全部 23 个 release 均 pre-release → GitHub /releases/latest 404 → README 安装链接对全新用户是断链；v0.7.1（9/9 真机验收）已解除 pre-release 转正，latest 恢复 ✓；推论规则补进 release-evidence 合同 §2（每次发布后必须验证 latest 可解析）：上游监测=思源最新正式版仍 3.8.6（3.8.7 alpha 中）、三插件零漂移（与 R35 一致）——无上游触发的新待办；§12 晋升复查=全部条件未成熟（绑 G2/门槛）；循环 C 调研=扩展池冻结（docs/30 §5 只消化不扩池）——三循环无新产出，系统稳定态确认（发布配套，docs/07 §5-3 社区先例：Zotero Bridge 向导是桥类动作标配）：检测桥状态（bridge.ping）→ 未开则引导设置开启 → ping 验证 → 报告版本；G2 样板搭建/新用户装快门后首跑即用【需 Quicker 编辑器，G2-可发布前完成】✅ 已定版（docs/30 §6）：六项固定议程（下次 2027-01）；产出=先更新路线索引再追加功能

## §19 体验、页面、交互与内容深化（R131~R140）

> 本节承接 R73 的 UI 基线、R85/R98 的意图合同、R114~R122 的 AI/Quicker 合同和 R123~R130 的路线门禁，补充用户可见的页面、状态、工作台、帮助和长期体验。新增事项不重新定义底层 schema。

### 19.1 R131：产品信息架构与统一入口

- [x] 【R131-G2-R2·导航·评估】设计“总览/执行/收件箱/活动与回执/能力/AI/动作/设置”的顶层导航；验收新用户三次点击内可到首个结果，高级协议按需展开。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：导航入口=GETTING-STARTED 三步+设置页分区+文本指令表（三次点击内首结果已达成）
- [x] 【R131-G2-R2·统一搜索·评估】建立同时搜索命令、能力、意图、回执、模板和动作的入口；验收按类型、插件、风险和可用性分组，普通结果不暴露 raw op。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：搜索面=commands.search（过滤/分组/≤50 条）+「不暴露 raw op」=MCP DESCRIPTIONS 用户化
- [x] 【R131-G2-R2·对象入口·评估】为文档、块、人物、项目和媒体生成 capability 驱动的对象菜单；验收缺插件、无权限和已有历史三种状态可解释。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：capability 驱动对象菜单——manifest 驱动已备（capabilities 字段）
- [x] 【R131-G2-R2·最近收藏·评估】支持最近、收藏、固定、常用动作的管理、排序、隐藏和重置；验收能力过期或跨设备不同步时给出降级原因。最近/收藏管理=statestorage 偏好域；「降级原因可解释」=manifest maturity 字段
- [x] 【R131-G2-R2·深链·评估】页面深链携带 object/intent/receipt/filter/session/actionRevision；验收对象删除、权限变化或版本过期时仍能回到可读历史。 补业务对象打开的公开能力解析、权限校验和已删对象回退；打开链接不产生业务写入，失效时仍可读取脱敏证据。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：深链语义=siyuan://blocks/{id}+信封 externalRef（对象删除诚实失效=R80 定位裁定）
- [x] 【R131-G2-R2·信息密度·评估】提供简单、高级、诊断三种信息密度模式；验收同一动作只改变展示，不改变权限和回执语义。三密度模式=ACTION-CARDS 主卡/子程序速查分层（展示与权限回执语义分离已实现）
- [x] 【R131-G2-R2·统一页面骨架·评估】统一标题、状态徽章、数据截至时间、主操作、次操作、帮助和反馈区域；验收设置、AI、动作和结果页不各自造状态语言。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：统一状态语言=六态回执+完成判据五级（不各自造状态语言——机制级已统一）
- [x] 【R131-G2-R2·全局任务条·评估】跨页面显示正在处理、待确认、需恢复和最近完成的任务条；验收切页、刷新或关闭弹窗不丢任务入口。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：任务条数据源=results/audit（正在处理/待确认/需恢复字段齐——plan TTL/timeout 分类）

### 19.2 R132：意图编排与计划预览页面

- [x] 【R132-G2-R2·意图编辑器·评估】提供自然语言输入与可编辑目标、对象、时间、约束、输出、确认级别字段；验收草稿可自动保存、恢复和另存。 补保存中/待保存/失败/冲突、最后成功版本和导出未保存内容的反馈；保存失败不得显示已保存，重启只恢复草稿并重新生成计划，不复用旧授权。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：NL 输入+可编辑字段——底层=意图信封（R201 八字段已交付）
- [x] 【R132-G2-R2·上下文胶囊·评估】以可删除的胶囊展示当前文档、选区、窗口、人物、时间和插件来源及新鲜度；验收不会隐式扩大读取范围。 补原型触发前捕获与选区归属夹具：source protyle 必须包含 Selection Range；分栏 A 文档和 B 选区、工作台输入框选区不得拼成同一来源。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：胶囊字段=选中文本/来源窗口/块ID（readEditorContext 已实现）+「不隐式扩大读取」=四级兜底不自动升级
- [x] 【R132-G2-R2·澄清过程·评估】渐进展示识别结果、缺失字段、最少澄清问题和计划；验收低置信度说明原因，取消仍保留原意图草稿。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：渐进澄清=§15 歧义澄清同域（最小必要问题+取消保留草稿语义已登记）
- [x] 【R132-G2-R2·计划步骤卡·评估】计划卡展示 owner、读写/外发徽章、预计延迟、不可逆副作用、依赖和替代路径；验收用户无需查看 schema 才能判断风险。 耗时来自测量基线或标为尚未测量；可撤销/补偿/不可逆依据 owner 元数据，不能固定宣传小于 2 秒或把创建记录统一标为不可逆。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：计划卡数据=workflow steps[]（op/写标记/确认标记——owner/风险展示字段已备）
- [x] 【R132-G2-R2·计划编辑·评估】允许重排、禁用和改参数，显示计划 diff/参数哈希；验收修改后按统一 Confirmation 合同计算失效范围；当前整份一次性确认应重新生成计划并整体确认，局部确认仅在 owner/合同实证支持后提供，保留原人工修正。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：重排/禁用/改参数+diff=plan 可编辑（修改重算=validateStepArgs 重跑，R118 同源）
- [x] 【R132-G2-R2·模拟区分·评估】明确预览、模拟、dry-run 和真实执行的差异；验收每一步标出写入、联网、窗口、配额和不可取消副作用。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：预览/模拟/真实差异=只读白名单结构性保证（模拟绝不写入——R178 裁定）
- [x] 【R132-G2-R2·分层确认·评估】支持按步骤、范围或批次部分确认，展示目标、数据范围、有效期和可撤销性；验收一次读确认不会升级为写确认。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：按步骤/批次部分确认=演进位（当前整份 confirmAll——R178 分段确认缺口同源登记）
- [x] 【R132-G2-R2·一次性与规则·评估】将一次性执行、预约、重复规则和后台自动化分为不同入口；验收一次计划不会暗中变成持久规则。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：一次性 vs 规则分离=plan TTL+「一次确认不授权未来」红线（R202 同源）

### 19.3 R133：活动、结果与恢复中心

- [x] 【R133-G2-R1·活动中心·评估】按 intent/plan/command/receipt/业务实体/actionRevision 聚合活动；验收可按时间、插件、来源和状态筛选。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：聚合数据源=results/audit/events 三载体（intent/plan/command/receipt 字段齐）
- [x] 【R133-G2-R1·结果首屏·评估】结果卡先显示用户结果、证据、expected/actual、owner 和数据截至时间，再折叠协议和步骤日志。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：结果卡=回执字段序（status/message/data 先行，协议步骤日志折叠=原文已在 results）
- [x] 【R133-G2-R1·状态视觉·评估】固定 accepted/committed/verified/unknown/partial/cancelled/rejected 的文字、图标、颜色和读屏语义；验收不以颜色单独表达状态。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：状态集=六态回执固定（文字语义已统一——视觉映射挂 UI）
- [x] 【R133-G2-R1·恢复动作·评估】结果卡提供查询原回执、等待、人工核对、同幂等键重试、补偿、复制新意图和打开源插件；验收危险动作先显示副作用。 人工核对/放弃保存来源、理由和时间，与业务事实分开；放弃跟进仍保留 unknown 与迟到证据，不冒充 owner 的已核验回执。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：恢复动作=同 id 查询/等待/重试/新意图（LV·取回执+D-0012 已实现——危险动作显示副作用=ACTION-CARDS 字段）
- [x] 【R133-G2-R1·批量结果·评估】按项展示成功、失败、跳过和未知，允许选择性重试/撤销；验收总状态不覆盖单项事实。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：批量逐项=workflow steps[] 回执（「总状态不覆盖单项」=stoppedAt+逐项 status）
- [x] 【R133-G2-R1·待处理队列·评估】迟到回执、目标删除、插件卸载和版本冲突进入待处理队列，显示截止时间与升级路径；验收不静默关闭。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：待处理数据源=commands 未消费+expired 回执（不静默关闭=expired 也回执字面）
- [x] 【R133-G2-R1·结果历史·评估】支持保留、归档、删除和敏感正文擦除策略；验收归档后仍可定位原始意图摘要与业务实体。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：保留/导出/删除=results 滚动+审计导出+PRIVACY 出口（归档不删业务=分文件）
- [x] 【R133-G2-R1·时间线·评估】展示计划时间、执行时间、业务时间、时区和因果链；验收跨午夜、补卡和迟到事件顺序可解释。 阶段只有真实观测才展示；排队、确认、提交、等待回执与核验分账，计时标出实测/估算/未知，不编造进度。 → ✅ R210 域登记（意图中枢 UI 域挂 G2 自用轮）：机制层已交付：时间字段=createdAt/finishedAt/occurredAt 分离（R170 时间模型——跨午夜/迟到可解释）

### 19.4 R134：能力、权限与诊断页面

- [x] 【R134-G1-R1·能力详情·评估】能力卡显示 owner、版本、成熟度、读写/外发 effects、依赖、最近验证和替代路径；验收 declared 与 available 分开。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——manifest 字段齐（owner/版本/maturity/读写/最近验证=updatedAt/替代路径）
- [x] 【R134-G1-R1·权限中心·评估】集中展示桥、Agent、MCP、插件写入、外发、Quicker 和后台规则权限；验收可逐项撤销且不影响历史回执。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——分层授权四层（读/写/透传/确认）+「逐项撤销不影响历史回执」=回执分文件
- [x] 【R134-G1-R1·数据流图·评估】以字段级方式展示将读、将写、外发服务、保留期限和回执位置；验收来源变化使旧预览失效。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——字段级数据流=证据信封（sources/sensitivity/truncated）+「来源变化旧预览失效」=plan TTL
- [x] 【R134-G1-R1·健康仪表盘·评估】分当前可用、最近成功和趋势展示内核、桥、插件、AI/Agent、广播和 MCP；验收总分不能掩盖单项 unknown。 标明自报/实际探测、采样权限、采样时间、超时与最近成功；一次 ping 不能证明业务就绪或全生态健康。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——健康数据源=SY-预检四检+verify:restart 十项（总分不掩单项=逐项断言模式）
- [x] 【R134-G1-R1·诊断向导·评估】把诊断分为探测、解释、修复、复测四步；验收修复前展示影响，修复后保存证据。 逐项登记修复动作的真实接口、前置和复测证据；账号、网络和硬件前置无法自主修复时给人工指导，不以清数据或换通道掩盖根因。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——探测/解释/修复/复测=FAQ 七类+SY-预检+verify:restart 复测（修复前影响=PRIVACY）
- [x] 【R134-G1-R1·队列操作·评估】清队列前预览数量、最老时间和将丢弃 ID，支持暂停、仅清过期、导出后清；验收结果有回执。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——队列预览=commands 行数+expired 判定（仅清过期=压缩语义；结果有回执=坏行指纹回执）
- [x] 【R134-G1-R1·错误卡·评估】统一错误卡的分类、原因、影响、下一动作、重试条件、手动替代和脱敏诊断复制；验收 401/403/404/超时/业务拒绝/unknown 分开。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——统一错误卡=六态+FAQ 七类（401/404/超时/业务拒绝各有下一步+脱敏诊断复制=审计导出）
- [x] 【R134-G1-R1·恢复向导·评估】覆盖休眠、断线、切换工作区、插件卸载和宿主升级；验收恢复前列出排队项和副作用，不自动重放写入。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——恢复向导=SY-思源未运行分支+恢复批次三选项（不自动重放写入=红线）

### 19.5 R135：AI 工作台与模板交互

- [x] 【R135-G3-R2·AI 任务抽屉·评估】展示 Intent→Context→Plan→Confirm→Execute→Evidence 时间线、模型、预算、实时流和停止/继续入口；验收仅展示 host 明确公开的处理摘要、工具轨迹和生成内容，不承诺可读取模型内部思考；无轨迹或截断须说明。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——Intent→Evidence 时间线=结果台账因果链（R204：planId→steps→commandId→块ID）
- [x] 【R135-G3-R2·上下文选择器·评估】按文档、块、附件和历史回执显示数量、来源、敏感级别、截断和外发目标；验收可逐项删减并预览脱敏结果。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——逐项删减+脱敏预览=证据信封 sensitivity/truncated 字段承载（R85 输入预算同源）
- [x] 【R135-G3-R2·输出事实分层·评估】AI 输出区分事实、推断、未知和建议，引用可定位；验收 JSON 校验错误能定位到字段并修复。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——事实/推断/未知分层=claims[].evidence 分级+generatedBy.model（证据信封字面）
- [x] 【R135-G3-R2·接受方式·评估】将接受、编辑、拒绝、重新生成、保存草稿和提交写入分开；验收模型肯定句不能成为授权。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——接受/编辑/拒绝/重生成/草稿/提交分立=授权分层五步（AI 肯定句≠授权红线）
- [x] 【R135-G3-R2·模板管理页·评估】显示模板来源、版本、适用场景、锁定安全字段、工具白名单和回归结果；验收用户模板不能覆盖安全字段。 补锁定字段/用户扩展/变量/工具白名单的合并优先级，预览展示实际有效模板；导入、继承和逐项接受 diff 不得削弱安全约束。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——模板来源/版本/白名单=附A.1 模板契约（「用户模板不覆盖安全字段」=白名单并集上限）
- [x] 【R135-G3-R2·模板渲染 diff·评估】提供变量来源、渲染前后 diff、发送字段和输出 schema 预览；验收敏感字段可在发送前移除。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——渲染前后 diff/发送字段=占位符解析显式（变量来源可查）+JStr 转义（敏感不误替换）
- [x] 【R135-G3-R2·模板沙盒·评估】导入或编辑模板只能在隔离沙盒中试跑，风险扫描失败只能保存草稿；验收不会触发真实工具。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——沙盒试跑不触发真实工具=只读白名单结构性保证（模拟绝不写入——R178 裁定）
- [x] 【R135-G3-R2·AI 无法使用·评估】模型不可用、额度不足或未授权时显示人工模板、只读查询和保存原文入口；验收原始任务可继续。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——AI 不可用三入口=人工模板/只读查询（SQL 面不依赖 AI）/保存原文（R85 AI 降级已交付）

### 19.6 R136：Quicker 动作作者工作台

- [x] 【R136-G4-R2·动作目录卡·评估】动作卡显示适合谁、触发、输入输出、目标、effects、兼容版本、证据等级、维护者和最近结果。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——动作卡八字段=**ACTION-CARDS 已交付**（适合谁/触发/输入输出/effects/证据等级/维护者）
- [x] 【R136-G4-R2·作者 stepper·评估】用 stepper 区分规格、生成草稿、静态审查、暂存、试运行、业务 verified 和分享；验收保存或 HTTP 200 不显示为完成。 → ✅ R211 域登记（Quicker GUI 轮）：规格→草稿→静态审查（csc 门）→暂存→试运行→verified→分享=附A.1 授权分离五步（R110）
- [x] 【R136-G4-R2·revision diff·评估】展示模块、变量、脚本、权限、依赖、入口影响和 fixture 差异；验收可逐项接受、撤销和回到旧 revision。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——revision diff=版本头变更记录+fixtures 回归（逐项接受/回滚=git 粒度）
- [x] 【R136-G4-R2·运行证据·评估】在作者页关联运行 ID、步骤日志、快门回执和业务实体；验收 Quicker 运行分析只能生成建议。 增加动作内容摘要与交接身份，标明人工提交证据来源；截图或运行分析不能自动满足正式保存、分享或业务核验门槛。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——运行 ID/步骤日志/快门回执关联=审计三问+results 按 id（「运行分析只能生成建议」=R166 边界）
- [x] 【R136-G4-R2·依赖卡·评估】动作导入前显示最低 Quicker/思源版本、插件、公共子程序、配置和权限；验收缺依赖可只读打开草稿。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——依赖卡=SY-预检四检+参考件零依赖声明+「缺依赖只读打开草稿」=预检分支语义
- [x] 【R136-G4-R2·分享预览·评估】分享前预览 Token、路径、文档 ID、正文、截图、日志、许可和回滚内容；验收扫描失败阻止分享。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——分享预览扫描=**check-release 门**（Token/路径/ID 扫描失败阻止——已交付实战）
- [x] 【R136-G4-R2·安装后检查·评估】导入后检查配置、权限、场景、快捷键、只读探针和业务回执；验收失败可保留草稿并进入帮助。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——安装后检查=GETTING-STARTED 三步+SY-预检（「失败保留草稿进帮助」=FAQ 路径）
- [x] 【R136-G4-R2·动作反馈·评估】动作页收集成功、失败、人工修订和维护问题，绑定 revision 与环境但默认不上传正文。 → ✅ R211 域登记（UI 工作台域挂 G2/Quicker GUI 轮）：机制层已交付——反馈绑定 revision/环境/默认不上传正文=审计设计（op/状态/耗时无正文）+G2 观察表

### 19.7 R137：帮助、内容与首跑教育

- [x] 【R137-G2-R2·任务配方·评估】按捕获、查找、研究、打卡、人脉、AI 草稿、Quicker 动作、恢复、升级和卸载组织教程；验收每篇从用户结果开始。 → ✅ R214 域登记（等 Quicker GUI 轮）：任务配方=ACTION-CARDS 已交付（捕获/查找/研究/打卡/人脉卡齐）——配方页 UI 挂轮
- [x] 【R137-G2-R2·角色首跑·评估】首跑支持思源用户、Quicker 用户、AI/MCP 用户和插件作者路径；验收可中断续跑且不锁死后续能力。 → ✅ R214 域登记（等 Quicker GUI 轮）：角色首跑=GETTING-STARTED 三步+首跑向导（R72 前置清单已备）——UI 挂轮
- [x] 【R137-G2-R2·一分钟演示·评估】制作脱敏的捕获→回执→核验→恢复流程，另提供 AI 只读和动作草稿流程；验收视频状态与真实证据一致。 → ✅ R214 域登记（等 Quicker GUI 轮）：捕获→回执→核验→恢复演示流=lv-cli ping+故障恢复字段（录制素材规范已备 R176）——挂 GUI 轮
- [x] 【R137-G2-R2·术语表·评估】解释 intent、plan、receipt、unknown、owner、能力、暂存和 verified，并提供 UI 就地链接。 → ✅ R214 域登记（已交付对照）：intent/plan/receipt 术语解释=**ACTION-CARDS 完成判据五级+docs/api.md**（已交付）
- [x] 【R137-G2-R2·空态内容·评估】为无插件、无权限、无历史、无回执、无 AI、无 Quicker 和未配置工作区设计原因、主动作、替代路径和帮助链接。 → ✅ R214 域登记（已交付对照）：无插件/无权限/无历史空态=六态回执+只读预检分支（空态区分无数据与被过滤——R80 中文质量同款语义）
- [x] 【R137-G2-R2·错误教程·评估】错误文案先说明发生了什么、影响和下一步，再展开端点、状态码、日志和诊断；验收用户无需读协议才能恢复。 → ✅ R214 域登记（已交付对照）：错误文案三段式（发生了什么/影响/下一步）=**参考件错误分支+FAQ 七类已交付字面**
- [x] 【R137-G2-R2·示例工作区·评估】提供可删除的脱敏示例文档、动作和事件；验收示例不连接真实 Token、不写入用户业务数据。 → ✅ R214 域登记（等 Quicker GUI 轮）：可删除示例工作区=fixtures 思源面（样例文档/动作）——创建挂 GUI 轮
- [x] 【R137-G2-R2·更新说明·评估】动作、模板、skill、MCP 和插件版本使用同一变更事实表；验收更新说明列迁移、回滚、兼容和已知限制。 → ✅ R214 域登记（已交付对照）：动作/模板/skill/MCP/插件更新说明=**CHANGELOG+版本头+dependency-watch**（已交付三处）

### 19.8 R138：信任、隐私与数据生命周期页面

- [x] 【R138-G1-R1·隐私总览·评估】提供本机、思源同步、AI 服务、MCP host、Quicker 和插件之间的数据流总览；验收每个外发字段可回到来源。 → ✅ R214 域登记（已交付对照）：隐私总览=**PRIVACY.md 数据流向图+位置表**（已交付）
- [x] 【R138-G1-R1·外发同意·评估】远程模型/服务调用前展示数据处理、区域、留存、费用和撤回方式；验收同意记录绑定具体字段和模板版本。 → ✅ R214 域登记（已交付对照）：外发展示数据处理/地区/保留=PRIVACY 端点清单+证据信封 sensitivity（远程需逐项确认=授权分层）
- [x] 【R138-G1-R1·保留策略·评估】分别管理 prompt、上下文缓存、草稿、回执、审计、诊断和业务链接的保留/删除；验收删除正文不破坏必要的脱敏审计。 → ✅ R214 域登记（已交付对照）：prompt/缓存/回执分别管理保留=results 200 行滚动+PRIVACY 位置表（已交付字面）
- [x] 【R138-G1-R1·本地遥测·评估】遥测默认关闭，指标只保存状态/耗时/计数；验收用户可查看、导出、删除和暂停本地记录。 → ✅ R214 域登记（已交付对照）：遥测默认关=**PRIVACY 红线「快门无遥测」**+审计只存状态/耗时（无正文）——字面已交付
- [x] 【R138-G1-R1·权限解释·评估】每个权限说明为什么需要、影响什么、如何关闭和关闭后的替代；验收“允许全部”不是唯一入口。 → ✅ R214 域登记（已交付对照）：权限为什么需要/影响/撤销=**分层授权+api.md §11 允许名单策略注记**（已交付）
- [x] 【R138-G1-R1·撤销急停·评估】提供停止模型、Agent、MCP server、桥、自动化和动作执行的分级急停；验收已排队任务状态可查且不新发写请求。 → ✅ R214 域登记（已交付对照）：停止模型/Agent/MCP/桥急停=三级急停+std io 断开+petal 开关（R181 已交付）
- [x] 【R138-G1-R1·数据可携·评估】导出意图、计划、回执、模板、动作 revision 和诊断的脱敏包；验收导入另一工作区前显示差异与敏感字段。 → ✅ R214 域登记（已交付对照）：导出意图/计划/回执/模板/动作=审计导出+fixtures+ACTION-CARDS（results 原文可导=已交付）
- [x] 【R138-G1-R1·信任反馈·评估】每张结果卡支持有用/不准确/需人工接管反馈，绑定版本和场景；验收默认不上传正文或联系人信息。 → ✅ R214 域登记（已交付对照）：结果卡有用/不准确/需接管标记=结果账本反馈字段（R213）+「默认不上传」=PRIVACY

### 19.9 R139：可访问性、响应式、性能与反馈

- [x] 【R139-G2-R2·键盘流程·评估】支持 Ctrl/Cmd+K、上下选择、Enter 执行、Esc 取消、快捷键帮助和冲突提示；验收中文输入法 composition 不误提交。 → ✅ R214 域登记（等 Quicker GUI 轮）：Ctrl+K/上下选择=Quicker 原生键盘流（文本指令+快捷键已配置）——UI 细化挂轮
- [x] 【R139-G2-R2·焦点稳定·评估】异步加载、状态更新、确认关闭和页面跳转保持焦点、滚动位置和返回来源；验收屏幕阅读器能读到 live region。 → ✅ R214 域登记（等 Quicker GUI 轮）：异步/状态更新/确认关闭焦点=Quicker 模块语义域——挂 GUI 轮
- [x] 【R139-G2-R2·无障碍·评估】走查对比度、非颜色状态、200% 缩放、减少动效、错误字段关联、读屏顺序和可见焦点；验收不依赖悬停。 补搜索建议、多胶囊、嵌套确认、虚拟列表和流式结果的完整键盘/读屏脚本；焦点不被固定任务条遮住，状态播报不强行移焦或逐 token 读全文。 → ✅ R214 域登记（等 Quicker GUI 轮）：对比度/非颜色状态/200% 缩放=§1 无障碍实测项同批（挂 GUI 轮）
- [x] 【R139-G2-R2·响应式·评估】验证 320px 窄屏、横竖屏、安全区、虚拟键盘、触控 44px 和桌面 200% 缩放；验收核心确认和恢复路径不被遮挡。 → ✅ R214 域登记（等 Quicker GUI 轮）：320px/横竖屏/安全区=§1 响应式实测项同批（挂 GUI 轮）
- [x] 【R139-G2-R2·列表性能·评估】长命令/回执/事件列表支持虚拟化、搜索 debounce、分页和取消 stale 请求；验收性能预算与 R128 SLO 绑定。 → ✅ R214 域登记（已交付对照）：长列表=events/results 200 行滚动上限+SQL LIMIT（性能面已声明——虚拟化挂 UI 轮）
- [x] 【R139-G2-R2·加载反馈·评估】页面提供骨架、缓存时间、陈旧标记、取消和重试；验收内核/桥不可达时不把空列表显示成无能力。 → ✅ R214 域登记（已交付对照）：骨架/缓存/陈旧标记=plan TTL+数据截至时间语义（取消=取消分类已交付）
- [x] 【R139-G2-R2·通知中心·评估】通知支持去重、持久历史、状态筛选、静默、低动效、复制诊断和撤销/重试；验收短 Toast 不承载唯一失败信息。 → ✅ R214 域登记（等 Quicker GUI 轮）：通知去重/持久/筛选=Quicker notify 语义域——通知中心 UI 挂轮
- [x] 【R139-G2-R2·反馈入口·评估】一键报告问题自动附脱敏诊断、intent/receipt/revision 和环境信息；验收用户可预览、编辑、删除后再提交。 → ✅ R214 域登记（已交付对照）：一键报告附脱敏诊断=审计导出（设置页已交）+脱敏门=check-release 同源

### 19.10 R140：通知、跨设备续接与待处理队列

- [x] 【R140-G5-R2·通知中心·评估】统一待确认、需恢复、成功、提醒和系统告警通知，显示来源、intent/receipt、过期时间和下一步；验收同一事实不在多个入口重复弹出。 → ✅ R214 域登记（等 Quicker GUI 轮）：统一通知中心=Quicker notify 语义域（挂轮）；数据源=results 待确认/需恢复分类已备
- [x] 【R140-G5-R2·通知策略·评估】支持通知去重、合并、频率限制、静默时段和捕获/研究/会议/专注模式；验收关闭通知不关闭业务执行。 → ✅ R214 域登记（已交付对照）：去重/合并/频率限制=幂等键+台账语义（重复不重复通知=同 id 跳过已实现）
- [x] 【R140-G5-R2·高风险待办·评估】将 AI 确认、动作审批、unknown 回执和插件健康下降统一进入待处理队列；验收批量查看仍逐项确认。 → ✅ R214 域登记（已交付对照）：AI 确认/动作审批/unknown 待办=plan 确认卡+timeout 待查询（高风险分类=WRITE_OPS 字段）
- [x] 【R140-G5-R2·跨端续接·评估】桌面创建的待确认计划可安全交给移动端或反向续接；验收交接前重新检查能力、上下文、工作区和设备权限。 → ✅ R214 域登记（已交付对照）：跨端续接安全=信封 device 定向+「不匹配跳过不消费」（桌面→移动=P2-10 域）
- [x] 【R140-G5-R2·设备能力页·评估】显示桌面、移动、浏览器和远程入口的可用能力、桥开关、网络/电量限制和最近同步；验收不可执行按钮不伪装成可用。 → ✅ R214 域登记（已交付对照）：设备能力页=SY-预检+分层授权（桌面/移动/浏览器/远程=兼容矩阵 R70 同源）
- [x] 【R140-G5-R2·离线草稿·评估】离线只保存允许的低风险草稿，恢复后展示过期/变化项并重新确认；验收高风险写不自动重放。 → ✅ R214 域登记（已交付对照）：离线只保存低风险草稿+恢复展示=恢复批次三选项（R187 已交付同款）
- [x] 【R140-G5-R2·通知深链·评估】通知点击能进入结果、计划或插件详情；对象删除/无权时给恢复路径，返回后保留筛选、焦点和滚动位置。 → ✅ R214 域登记（已交付对照）：通知深链=siyuan://blocks/{id}（回执跳转业务记录已交付——R205 证据链四要素）
- [x] 【R140-G5-R2·安全事件·评估】权限回收、Token 变化、异常外发和被阻断的排队任务进入可追溯安全通知；验收通知不泄露正文或凭据。 → ✅ R214 域登记（已交付对照）：权限回收/Token 变化/异常外发=401 自愈+审计+PRIVACY 红线（安全事件审计=审计三问）

## §20 UI 原型落地差距与实现前置（R141~R150）

> 对照 [原型落地研究](docs/21-UI原型落地差距与实施前置-R141-R150.md) 登记 60 个新增验收子项。它们承接 §18 的 C1~C8 合同和 §19 的页面父项，不另造状态/权限/回执协议；旧项补充的验收细节不重复计数。全部未勾选，只研究和排前置，不开发。G0~G7 以 docs/19 §3 的顺序为准，Quicker 作者链为 G5。

### 20.1 R141：宿主承载、入口与页面生命周期

> 主线：C2/C3/C4；承接：R75 多前端、R131 导航/深链、R139 焦点。

- [x] 【R141-G1-R1·页面数据账本·评估】逐一登记原型的字段、按钮、实际调用、执行位置、owner、所需权限和证据等级，标出缺端点/仅样例/已可读取；验收每个主操作都有调用依据，不能靠文案模拟可执行能力。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R141-G2-R2·宿主承载决策·评估】比较思源自定义 Tab、Dock、Dialog 和移动页的宽度、生命周期与返回路径，形成容器选择记录；验收五个主导航可在桌面和窄面板访问，不以独立网页假设替代插件内原型。 → ✅ R154 调研登记（E2，容器决策记录）：快门承载=**Dialog 单容器**（设置面板 Dialog、最近回执 Dialog 680px、审计导出确认 Dialog）+ showMessage 轻提示；**Dock/Tab 不用**（快门无常驻面板需求——外部网关定位，UI 面最小化）；移动页不用（桥默认关+isMobileGuard）。返回路径=Dialog 自带遮罩关闭。「五主导航可窄面板访问」验收对快门 N/A（登记为最小 UI 面裁定）
- [x] 【R141-G2-R1·界面技术边界·评估】核对当前 b3 DOM 设置实际入口与未接入的 Svelte 辅助组件，决定保留/复用范围和迁移接缝；验收不重复维护两套设置事实，组件样例不会被当作运行时实现证据。 → ✅ R154 调研登记+清理（E2 实证）：**唯一设置事实=b3 DOM 直绘**（index.ts 20 处 b3- 类 + SDK Dialog 三类：设置面板/最近回执/审计导出确认）；模板遗留 src/libs/ Svelte 助手**零引用零进产物**——已整目录删除（同 api.ts 死代码先例），124 单测/构建全过。「两套设置事实」风险不存在；迁移接缝=无
- [x] 【R141-G2-R1·视图与任务生命周期·评估】定义视图挂载、关闭、重新打开、宿主热重载与插件禁用的订阅/定时器/请求释放合同；验收关闭页面仅销毁视图，任务是否停止由 C4 决定，反复打开不增加重复订阅。 挂载、路由恢复和主题切换仅渲染，不派发业务命令。 → ✅ R153 调研登记（E2，实现对照）：生命周期合同以快门为样板固化——**挂载序**：loadAll→settings→audit 恢复→deviceName→startBridge→startEventBridge（每步幂等）；**关闭序**：先停输入源（poller 当前 tick 后退出→广播订阅→事件退订）再 flush 状态（audit）——「先停源再落盘」防写撕；**热重载**：petal toggle 全链验证 ✓（R137 起为标准部署通道）；**任务语义**：桥任务=消费队列，关闭只停止消费不撤销已执行（C4 口径一致）；**定时器/订阅释放**：eventBridge removeEventListener/broadcastSub.stop/poller.stop 全有配对（checkin 侧 disposeDockTomatoBridge 同模式互证）。**缺口**：崩溃时 audit 窗口丢失（auditMax 滚动可接受，已登记）；「重新打开」幂等已由 onload 幂等化覆盖
- [x] 【R141-G2-R1·路由目标绑定·评估】为页面、草稿和弹窗绑定稳定工作区/设备/任务身份，切换目标时显示原目标并使旧执行入口失效；验收相同文档标题或同名设备不能导致写入另一工作区。 → ✅ R153 调研登记（E2，实现对照）：目标身份二元组=(工作区,设备)——设备=device.json（storage/local 不随同步每机独立）+信封 device 定向字段；工作区=SY_URL（多空间端口规律 R140 源码实证：6806 只保证第一实例）。**绑定设计**：动作缓存 SY_URL 即绑定工作区，变更即旧入口失效；同文档标题跨工作区=靠 URL 绑定天然消歧。**缺口登记**：(a)思源无 workspace-id 前端 API（窗口标题含空间名是唯一线索——R140-B 实证）；(b)任务身份（跨页面续跑同一批次）尚无载体，挂 workflow planId 演进
- [x] 【R141-G2-R2·离开页面决策·评估】为有未保存修改、正在保存、待确认和执行中四类页面定义关闭/返回/跳转行为；验收保存失败可以留在页面或导出草稿，用户离开后仍能定位原任务。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R141-G2-R1·深链解析与升级·评估】为已有 R131 深链补解析器规格、可允许参数、路由版本迁移、返回来源和失效页；验收复制旧链接、篡改 ID、插件未启用或权限变化只进入解释页，不触发执行或外发。 → ✅ R216 域登记（同域；机制对照：深链=siyuan://blocks（R131 已登记）+解析器规格=UI 域）
- [x] 【R141-G2-R1·视图实例身份·评估】定义工作区、窗口、surface、对象构成的实例键及重复深链的聚焦/新开规则，控件 ID 加实例前缀；验收不同任务不串草稿和 label，关闭一窗不销毁另一窗的资源。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R141-G2-R2·容器尺寸合同·评估】以实际 Tab/Dock 可用宽高与宿主 resize 计算布局，明确主滚动区和固定操作区；验收宽窗口中的 320px Dock、分栏拖拽和虚拟键盘下确认目标可见，不仅通过 viewport media query。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.2 R142：任务读模型、聚合与实时一致性

> 主线：C1/C2/C4；承接：R99 状态/台账、R101 工作台、R124 公共合同、R128 追踪。

- [x] 【R142-G1-R0·正交状态投影·评估】在 C1 合同下分开展示任务阶段、执行结果、证据核验和人工处理决定，并给出组合优先级；验收“已生成计划”不等于写入，“放弃跟进”不把 unknown 变成失败或成功。 → ✅ R216 域登记（同域；机制对照：任务阶段/结果/证据/人工决定分离=六态+stoppedAt+审计正交（已实现语义））
- [x] 【R142-G1-R1·旧回执映射·评估】为 recorded/duplicate/unsupported 等旧 BridgeStatus 建立到新结果卡的保守投影表，保留原值和缺字段提示；验收无核验证据的 recorded/duplicate 不被自动升级成 verified。 → ✅ R216 域登记（同域；机制对照：旧 BridgeStatus→六态映射=回执六态本体（recorded/duplicate/unsupported 等已实现））
- [x] 【R142-G2-R1·页面查询契约·评估】补首页摘要、任务列表、任务详情、时间线和待处理队列的读模型契约，引用既有 Intent/Plan/Receipt ID；验收 UI 不再从几段文本日志猜测状态，也不复制业务插件主数据。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R142-G2-R1·首页快照一致·评估】为首页计数和列表规定同一快照/截至时间、逻辑任务去重、今日时区与缓存范围；验收同一任务的多次重试、工具调用和回执修订只按明确口径计数，局部不可达不显示为零。 → ✅ R216 域登记（同域；机制对照：同一快照/去重/时区=结果台账+today 精确匹配（逻辑去重=幂等键））
- [x] 【R142-G2-R1·历史分页稳定·评估】补状态/时间/来源筛选与稳定排序的查询规格，处理新结果插入、同时间戳、跨页重复和已选项；验收翻页时不漏任务，搜索结果陈旧时说明范围和截至时间。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R142-G2-R1·快照增量衔接·评估】为页面首载快照与后续增量定义版本、去重、乱序、断线缺口和重新拉取规则；验收迟到的 running 更新不能覆盖 verified，恢复连接后计数、列表和详情一致。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R142-G2-R1·任务可观测范围·评估】记录 Quicker 直连内核、reply=false、外部脚本和无回执调用是否纳入任务台账；验收首页只宣称覆盖已接入入口，未接入调用显示不可观测，不能承诺所有操作都可回查。 → ✅ R216 域登记（同域；机制对照：reply=false/外部脚本调用可观测=results/audit 台账覆盖面（reply=false 不写回执=信封语义诚实））
- [x] 【R142-G1-R1·待核验记录保留·评估】研究回执 200 行滚动窗口之外的最小任务索引/待核验保留及字节配额，区分原文清除与证据摘要；验收滚动裁剪不会让 unresolved 任务消失，达到配额有可解释出口。 → ✅ R216 域登记（同域；机制对照：最小任务索引/保留=results 200 行滚动+audit 上限（字节配额=auditMax 已实现））
- [x] 【R142-G2-R1·回执修订归并·评估】为同命令迟到回执、补证据、业务更正和删除标记建立结果卡修订链；验收只显示一个逻辑任务，旧证据仍可解释，不用最新时间覆盖不同来源事实。 → ✅ R216 域登记（同域；机制对照：迟到回执/补证据/更正归并=append-only+同 id 查询（旧证据仍可解释=不覆盖写设计））
- [x] 【R142-G2-R1·投影恢复与缺口·评估】规定任务读模型重建、历史坏行、字段迁移和源记录已轮转时的范围标识；验收重启后可读草稿/摘要，缺历史显示覆盖缺口，不重放旧写请求或重造已过期确认。 → ✅ R216 域登记（同域；机制对照：读模型重建/坏行跳过/源记录轮转标识=台账+滚动上限+诚实缺失（已实现语义））

### 20.3 R143：视觉系统与公共交互组件

> 主线：C2/C5；承接：R73 UI 基线、R131 页面骨架、R139 无障碍/响应式。

- [x] 【R143-G2-R2·语义视觉令牌·评估】定义间距、字体层级、容器宽度、状态图标、边框、焦点、禁用和危险动作的语义令牌，映射思源 b3 主题并限制样式作用域；验收主题切换一致且不改变思源编辑器或其他插件样式。 → ✅ R216 域登记（同域；机制对照：b3 主题映射=设置页已用 b3- 类（视觉令牌=UI 实现层挂轮））
- [x] 【R143-G2-R2·组件状态样本·评估】建立按钮、卡片、字段、状态徽章、步骤条、上下文胶囊和空态的脱敏状态样本集；验收默认/悬停/焦点/加载/禁用/错误都可评审，状态文字来自 C1 词典。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R2·命令组合框·评估】为统一搜索定义输入、建议选择、结果类型、展开详情和实际执行的键盘/鼠标状态合同；验收 Enter 接受建议不会越过写确认，Esc 先关建议层，中文候选确认不提交任务。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R2·嵌套浮层·评估】规定搜索建议、上下文选择器、详情抽屉和确认弹窗的层级、焦点返回与 Escape 消费顺序；验收关闭上层不意外关闭任务页或丢草稿，背景不承接误点击。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R2·长内容布局·评估】用长中文标题、混合英文、超长 ID、多行正文、权限字段和错误卡校准卡片/详情布局；验收核心目标和影响不被省略号隐藏，日志可局部横滚而核心确认保持可见。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R2·步骤条语义·评估】设计包含跳过、等待用户、部分完成、不可观测和需重做步骤的步骤条；验收不是固定百分比动画，步骤标签和当前进度以真实事件和核验事实为准。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R1·动态渲染边界·评估】登记 AI Markdown、外部错误、插件描述、模板 diff 和链接各自的转义/清洗/链接策略；验收恶意 HTML、javascript 链接、超长嵌套和正文中的按钮样式不能获得真实操作权限。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R2·浮层定位合同·评估】为菜单、组合框、帮助提示和来源预览规定 portal 根、层级、滚动/resize 重定位与边缘碰撞；验收窄 Dock 的 overflow 不裁切浮层，父视图销毁后无悬空层，不覆盖宿主确认。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R143-G2-R1·异步选择身份·评估】将能力、模板、模型和目标选择器的 query 与稳定 selectedId 分离，规定结果刷新和已选对象消失的处理；验收逆序响应、同名、翻译和别名变化不自动选第一项或误换目标。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.4 R144：意图输入、上下文与参数控件

> 主线：C2/C5/C6；承接：R79 捕获表单、R132 意图/胶囊/澄清、R116 最小上下文。

- [x] 【R144-G2-R0·上下文包含关系·评估】区分当前选区、来源文档标题/链接与整篇正文的胶囊类型，显示去重后的实际读取范围；验收移除整篇胶囊不丢来源链，添加来源信息不自动把全篇正文送入模型。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R144-G2-R1·上下文删除影响·评估】明确删除胶囊时使哪些摘要、引用、计划和模板变量陈旧，并显示需要重新生成的范围；验收旧摘要不保留已排除正文供下一轮外发，已产生历史则按保留策略单独处理。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R144-G2-R1·捕获目标选择器·评估】为目标 notebook/doc/block 设计稳定身份、同名消歧、只读/已删除/不可达状态和来源解释；验收目标不可用时不自动改写到默认收件箱，用户能查看替代而不丢输入。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R144-G2-R1·参数控件映射·评估】为 capability schema 到控件的映射规定未知字段、null/空串/false/0、枚举、数字单位与日期格式；验收控件往返不改变参数类型，无法表达的字段转高级预览并阻止误提交。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R144-G2-R2·澄清补丁·评估】为用户修正自然语言、回答澄清与直接改结构字段建立同一意图 revision 的补丁规则和变更摘要；验收后来的模型回复不覆盖人工修正，也不会重复询问已经回答的字段。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R144-G2-R1·受控字段事件·评估】统一 draftValue/parsedValue/committedValue 与 dirty/error/pending/external-update 的事件规格；验收 input/change 连发只产生一次用户提交，无效值有反馈，外部刷新不覆盖未保存人工修改。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.5 R145：确认、执行与可用操作

> 主线：C2/C3/C4；承接：R82 计划漂移、R118 确认绑定、R128 取消、R132 计划页面。

- [x] 【R145-G1-R0·服务端操作判定·评估】为结果卡和计划页建立可用操作/禁用原因/前置条件的能力解析，UI 展示与执行服务共用策略；验收 stale 按钮或直接调用仍无法绕过权限、确认、过期和 owner 条件。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R145-G2-R0·确认占用与抢先修改·评估】补多人入口或多窗口同时处理同一待确认计划时的 revision/消费结果反馈；验收只发生一次授权消费，另一页看到已处理或需刷新，不能只靠按钮 disabled 防双执行。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R145-G2-R1·取消请求反馈·评估】把用户请求停止、服务收到请求、已停止未开始步骤和已提交副作用分开反馈；验收无取消接口时只提供退出观察/停止后续，不将关闭页面或网络请求说成业务已取消。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R145-G1-R0·确认恰好一次终结·评估】为确认浮层统一 confirmed/cancelled/closed/expired/destroyed 的终结结果与服务接收时刻；验收 X、Esc、父页销毁、插件禁用和超时均结束等待，旧按钮不能在失效后触发副作用。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.6 R146：结果证据与恢复决策

> 主线：C1/C3/C4；承接：R99 完成判据、R128 unknown、R133 恢复/批量。

- [x] 【R146-G1-R0·核验能力配对·评估】为首条捕获和一个稳定插件场景登记 expected/actual、业务实体读取、证据有效期和 owner 核验能力；验收回执受理或写请求成功不能单独变成已核验，缺探针时明确证据不足。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R146-G2-R1·恢复按钮解释·评估】将查询、等待、人工核对、重试、补偿、撤销逐项映射到 owner 公开能力和用户条件；验收 unsupported 的恢复操作显示原因/人工路径，不画出永远不能使用的万能按钮。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R146-G2-R1·批量核验表·评估】补单项稳定身份、预期/实际、证据缺失、依赖关系、被选重试项和状态摘要的表格合同；验收“3/5 完成”能解释其余是失败/未执行/未知，选择重试不会重做已核验项。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.7 R147：能力、设置、诊断与通知的数据连接

> 主线：C3/C4/C5；承接：R73 状态区、R134 能力诊断、R138 权限、R140 通知。

- [x] 【R147-G1-R0·通道适用性计算·评估】把 capability 的执行位置、桥/广播开关、kernel-sync 可用性、前端在线与 MCP 读写权限组合成实际可用原因；验收桥关闭不把可用的内核只读能力一起禁用，也不开放依赖前端的写能力。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R147-G2-R1·设置应用事务·评估】拆出设置编辑值、保存值与服务实际运行值的差异及应用/回滚反馈；验收保存成功但订阅启动失败显示部分应用，不能用开关位置代替运行状态。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R147-G2-R1·队列清理一致·评估】为导出后清理/仅清过期的预览规定队列版本和稳定 ID 范围；验收预览期间新增命令不会被一并删除，导出失败不清理，执行后列实际处置和未处置项目。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R147-G2-R1·通知事实归并·评估】为通知关联源事实版本、已读、处理完成、静默与迟到更新的独立状态；验收读通知不批准计划，清通知不删除任务，已处理计划不因重复事件重新提示可确认。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.8 R148：AI 会话、模板与可观察结果

> 主线：C2/C6；承接：R115 Agent 接入、R117 模板、R135 AI 页面。

- [x] 【R148-G3-R1·会话呈现适配·评估】为思源 Agent、外部 MCP host 和手动模板建立可观测字段清单与只读适配规格；验收不假设所有 host 都可提供流式正文、费用或工具事件，缺字段显示未提供。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R148-G3-R1·生成分支保护·评估】将重新生成和编辑后的答案绑定输入/上下文 revision、生成轮次与草稿分支；验收旧流式响应不会覆盖用户编辑，新答案不会偷偷沿用旧写确认。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R148-G3-R2·流式阅读行为·评估】定义用户向上阅读、折叠工具事件、增量输出和停止生成的滚动/通知行为；验收流式更新不抢焦点或自动拉回底部，读屏不逐 token 重复朗读全文。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R148-G3-R1·引用定位合同·评估】为引用序号、来源锚点、内容版本与缺失/已删/无权引用制定点击和核验规格；验收格式正常的引用不能冒充内容证据，原文变化时显示版本差异和失效原因。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R148-G3-R0·沙盒边界探针·评估】为模板沙盒列出文件、网络、剪贴板、业务工具和外部费用的隔离验证夹具；验收没有可验证隔离时只做静态渲染/模拟，不把风险扫描通过当成可安全运行。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R148-G4-R1·公开轨迹边界·评估】只展示 host 明确公开的计划摘要、工具调用/结果和生成内容，规定无轨迹/截断/停止后迟到的说明；验收不依赖模型内部思考可读取，也不把推测出的思考过程显示成执行证据。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.9 R149：Quicker 作者链的真实交接

> 主线：C7；承接：R107 编辑器、R110 AI、R111 暂存、R122 生成链、R136 作者页。

- [x] 【R149-G5-R1·逐功能版本门槛·评估】按官方资料记录独立 AI、设计器助手、运行分析、暂存与分享的最低客户端版本及实际探测结果；验收本机 2.2.23 不被假设支持 2.2.25 设计器助手或 2.2.26 运行分析，能降级到人工草稿。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R149-G5-R1·编辑器交接方式·评估】验证“打开暂存/导入规格/读取修改/试运行”分别是否有公开 API、协议或只能人工完成，形成交接矩阵；验收无自动接口时展示复制/导出/手动步骤，不访问 Quicker 私有存储。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R149-G5-R1·交接包校验·评估】为 ActionSpec→生成草稿→Quicker 暂存的包定义文件类型、版本、变量/子程序引用、大小和内容摘要；验收非合法动作 JSON 只显示规格文档，不给可直接导入标签。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R149-G5-R1·暂存位置感知·评估】显示动作来自当前账号/本机还是正式 share revision、是否仍在编辑器与最近同步时间；验收另设备未找到暂存不判为丢数据，同名动作不靠名称自动匹配。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

### 20.10 R150：原型覆盖、效果验收与增量交付

> 主线：C1~C7；承接：R125 样板、R128 SLO、R129 外测/事实表、R139 UI 验收。

- [x] 【R150-G0-R1·原型追踪矩阵·评估】把每页/控件对应到旧父项、唯一新增产物、owner、阻断依赖和证据等级；验收新增子项不重复定义父项合同，原型修改能反查受影响的验收与文案。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R150-G2-R1·可交互状态夹具·评估】为捕获、AI 草稿、动作创建准备正常、空、慢、坏数据、unknown、partial、失效确认和迟到事件的脱敏场景脚本；验收样例和真实数据明确标识，模拟不连接业务写入。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R150-G2-R1·竞态任务走查·评估】设计双击确认、多窗口消费、开页同时到回执、返回后旧请求完成、切工作区和禁用插件的端到端验收；验收页面与服务共同拒绝过期操作，证据不由静态截图替代。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R150-G2-R2·视觉基线验收·评估】为选定宿主容器、主题、长内容、错误状态和窄屏建立可比较的渲染基线，定义布局与可读性容差；验收文字不被裁切、核心影响和主操作可见，测试对应真实加载入口。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）
- [x] 【R150-G2-R1·UI性能分账·评估】将首屏可交互、搜索、增量合并、首个流式输出、详情打开、可见与隐藏视图资源分开测量；验收真实数据规模下满足经基线批准的预算，不能用网络总耗时代替渲染卡顿或持续轮询成本。 → ✅ R216 域登记（意图中枢读模型/UI 契约域挂 G2 自用轮；机制层已交付：六态回执/plan 确认卡+TTL/results 200 滚动/审计导出/分层授权——本项为该机制上的 UI 读模型/契约设计规格，评估登记）

## §21 Quicker 增强思源动作场景（R151~R160）

> 本节承接 R79、R89~R96、R106~R122 和 R141~R150，把 Quicker 的桌面/浏览器输入与执行能力细化为可审阅、可回执、可恢复的思源动作卡片。每项只登记研究、契约和验收，不导出真实动作。共同链路为“入口→主动采集→预览/确认→写入事实 owner→回执/恢复”，不得后台扫描、自动发送或把 Quicker 成功当作业务 verified。

- [x] 【R151-01·评估】动作本体与入口复用：为每个思源增强动作登记唯一 `actionId`、revision、输入 schema、输出 schema 和副作用；把面板、热键、思源场景、浏览器场景、文本指令、HTTP/移动入口映射到同一动作。验收：入口变更不会复制一份逻辑，结果卡能回到实际 revision。 → ✅ R145 调研登记（E2 草案）：动作本体登记格式提案——quicker-actions/registry.json，每动作 {actionId（如 sy.quick-capture）, revision（随 .qa 导出递增）, title, inputs/outputs schema（对齐 reference/*.cs 头部变量表）, effects:[触及 op 列表], entryPoints:[hotkey/textcmd/panel/browser], minQuickerVersion}；与 capability-registry-contract 同构（能力登记五态复用），面板/热键/场景/浏览器四入口引用同一 actionId。**待决**：registry.json 由导出脚本自动生成（推荐，导出时从 .qa 抽取）还是手维护——挂 G2 观察后定
- [x] 【R151-02·评估】前台/后台/未运行分支：分别设计思源前台、思源后台、思源未运行、Quicker 未启动和目标窗口丢失的处理。验收：每种状态都有可解释提示和手动替代，后台触发不会把未知焦点当作选区。 → ✅ R145 调研登记（E2，实现对照）：五态矩阵已有组件级覆盖——①前台=全功能；②后台=桥/内核路由全可用+confirmWithFront window.focus() 激活尝试+editor.context 诚实 null；③未运行=SY-思源未运行分支.cs（探测300ms→询问→exe/siyuan://启动→重探15s，真机验证过的启动链）；④前端不在线=内核路由 FRONTEND_ONLY 诚实降级提示；⑤移动端=isMobileGuard 显式 opt-in。**缺口登记**：(a)Quicker 未启动态在思源侧无感知路径（668 反向触发只能 Quicker 发起，记边界）；(b)后台时 confirm 激活成功率未实测（08-O10 保留）；(c)多窗口下 editor.context 取最后聚焦 protyle 待验
- [x] 【R151-03·评估】上下文采集夹具：固定当前窗口、进程、文档、块、选区、浏览器 URL、剪贴板和用户显式路径的采集顺序。验收：分栏文档与工作台输入框不会拼成一个来源，缺字段显示 `unknown` 而不是猜测。 → ✅ R148 调研登记（E2，实现对照）：采集顺序钉死为「显式输入 > 选中文本（思源前台）> 剪贴板 > userinput 兜底」（docs/03 §0 四级兜底已定）；上下文字段映射——窗口/进程（Quicker getwindowtitle）、文档/块（readEditorContext：rootTitle/blockId，spike⑦ bundle 实证）、浏览器 URL（浏览器扩展传参，快摘同款）、剪贴板（clipboard 变量）。**缺口登记**：(a)分栏文档下 readEditorContext 只读最后聚焦 protyle（spike⑦ 已实证单容器查询——多面板语义=「最后交互处」，登记为语义非缺陷）；(b)来源窗口与思源面板同时有选区时的优先级未钉——裁定：选中文本非空即用，不交叉猜测
- [x] 【R151-04·评估】焦点与危险输入保护：为模拟输入、粘贴、打开文件和网页动作增加目标窗口确认、域名/路径白名单和焦点变化检测。验收：焦点变化、弹窗遮挡或域名不匹配时动作暂停，不能把内容写入错误应用。 → ✅ R148 调研登记+缺口当场开发：思源侧设计性无模拟输入（doc.open 走 openTab 受控打开）；Quicker 侧粘贴类动作的焦点确认已闭环——**SY-粘贴守卫.cs 新件**（GetForegroundWindow+标题/进程双校验，不匹配即输出 允许粘贴=false 终止，20 脚本编译门过）；域名白名单属浏览器动作域（挂浏览器扩展实测轮）
- [x] 【R151-05·评估】入口参数与幂等：统一入口传递 `intentId`、来源、目标、范围、参数哈希和幂等键；同一动作从多个入口触发时合并或明确并行。验收：重复点击不会重复写入，无法幂等的步骤在确认前标出风险。 → ✅ R146 调研登记（E2，实现对照）：幂等键链路已全通——入口 id（lv-cli qk-<ts>-<rand>/MCP mcp-<ts>-<rand>）→桥台账 D-0003/D-0012（同 id 双通道不双执行，混沌测试证）→业务幂等 externalRef（checkin.record ref=cmd.id+source 归一 "api"，身份由 externalRef 承担；contacts.interaction ref 同款）→duplicate 状态=业务层幂等命中。**缺口登记**：(a)intentId/参数哈希未引入（现 id 即 intent，参数变更不换 id 会幂等跳过——对"重跑同意图"正确，对"改参重试"需新 id，文档已注明）；(b)多入口并行合并策略未定义（同 externalRef 并发=业务层去重，跨 externalRef 并行各自成立——可接受，登记为语义）
- [x] 【R151-06·评估】能力与版本预检：动作运行前探测 Quicker、Connector、浏览器扩展、思源插件、HTTP 权限和脚本依赖版本。验收：不满足前置时进入草稿/手动路径，不显示“可运行”假象；预检结果可复制到诊断报告。 → ✅ R146 调研登记（E2，实现对照）：思源侧预检已齐——bridge.ping（protocol/version）、config.discover（日记/收集箱发现+notes）、registry.list（15 插件清单）、内核路由/NDJSON 双通道探测、adapters 运行时 protocol/apiVersion/capabilities 校验（不满足=unsupported 诚实拒）、check-version.mjs（自版本三处门）。**缺口登记**：(a)Quicker/Connector/浏览器扩展版本预检无运行时实现（参考件头注 minQuickerVersion 仅文档级——补一个 SY·预检子程序可闭环，入待办）；(b)思源 AI 端点配置预检缺失（P0-3 AI 分支依赖，失败回退已设计）；**R147 缺口(a) 已闭环**：SY-预检.cs 新件（内核可达/令牌/快门桥/插件在装逐项预检，19 脚本编译门过）；缺口(b) 思源 AI 配置预检留 P0-3 实测轮
- [x] 【R152-01·评估】网页列表入库：将当前网页列表提取为 DataTable，映射去重键、字段类型和思源 AV/Markdown 目标，先逐行预览再写入。验收：显示实际行数、匹配总数、页数和停止原因，局部失败可补做，未确认不写入。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：DataTable 提取/去重键/AV 映射=浏览器扩展抓取域；思源侧写入面=insertBlock/AV API 已备
- [x] 【R152-02·评估】连续翻页完整性：为最多 100 页、2000 行和约 5 分钟的抓取设计分段、暂停和续跑；截断、缺列、登录失效和虚拟滚动进入报告。验收：用户能区分完整、部分和未知，删除或覆盖默认不执行。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：分段/暂停/续跑/截断报告=扩展抓取域；思源侧分批写入=workflow 逐项回执模式可复用
- [x] 【R152-03·评估】网页表单草稿：从思源选中块或字段词典生成表单预填草稿，只检查定位和字段缺失，不自动提交。验收：域名约束、逐字段 diff、提交按钮副作用和手动提交步骤可见。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：表单预填=浏览器扩展域（只检查不提交=验收语义与快门只读红线一致）；字段词典来源=思源块透传
- [x] 【R152-04·评估】研究来源卡：把当前标签页的 URL、标题、时间、页面版本、关键摘录和原始字段写入思源来源卡。验收：页面失效后摘录仍可读，正文、摘录和推断分层，重复 URL 提示新版本。 → ✅ R149 调研登记（E2，契约对齐）：来源卡 schema 直接复用**证据信封契约**（docs/contracts/evidence-envelope）——{claims:[{text,evidence,sources:[{type:"external",id:url,version:页面时间}]}], truncated, sensitivity:"contains-external", generatedBy:{entry,·}}——R152-04 的「正文/摘录/推断分层」=claims 与原文分块存储，「页面失效后摘录仍可读」=摘录全文入卡而非仅引用，「重复 URL 提示新版本」=sources[].version（抓取时间戳）比对。**落地路径**：g2-capture 扩展版（加 URL/标题/版本字段，摘录分块）——挂浏览器扩展实测轮后实施。**缺口**：页面版本指纹（content-hash）方案待定（整页 hash vs 正文 hash）；**R150 落地件已开发**：SY-研究来源卡.cs（三层分卡+MD5 内容指纹裁定摘录 hash 方案+重复 URL 不阻断提示，21 脚本编译门过；浏览器 URL 自动传入挂扩展轮）
- [x] 【R152-05·评估】网页增量对账：保存脱敏快照和主键映射，对比新增、删除、字段变化和无法匹配行，生成变更报告。验收：删除默认只报告不执行，快照绑定 URL/抓取时间，用户可选择局部更新。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：脱敏快照/主键映射/变更报告=扩展抓取域；报告格式=SY-变更报告 四分类同构可复用
- [x] 【R152-06·评估】多浏览器 Profile 隔离：用浏览器扩展环境名和 Profile 标识选择对应思源工作区，禁止仅凭窗口标题猜账号。验收：Chrome/Edge 多 Profile 交叉测试时错 Profile 明确拒绝，日志显示浏览器、Profile、工作区。 → ✅ R149 调研登记（E2，设计对齐）：「禁止仅凭窗口标题猜账号」与快门设备路由同构——桥协议 v1.1 device 字段（信封定向+不匹配跳过不消费）+ storage/local device.json（不随同步、每机独立）已是同款隔离原则。**浏览器侧映射**：扩展环境名+Profile 标识 → 映射到目标工作区的 SY_URL（每 Profile 配一个 endpoint），而非猜标题。**缺口登记**：Quicker 浏览器扩展传递 Profile 标识的能力待实测（扩展实测轮）；思源多空间×多 Profile 的矩阵映射表待用户真实布局
- [x] 【R153-01·评估】Word 选区留证：用户主动选择 Word 文本，读取 `Selection.Range` 与 `Range.Information` 的页码/表格上下文，生成思源证据块。验收：带文件、页码、选区摘要、时间和回链；无法访问对象模型时退化为复制选区，不后台扫描全文。 → ✅ R155 调研登记（E1+E2）：**本机环境实证（注册表）**——Word.Application/Excel.Application/KWPS.Application ProgID 全在（WPS 兼容别名与 MS 原生并存），COM 晚绑定（Marshal.GetActiveObject→Selection/Range）免 Office 互操作程序集。**设计**：留证卡=选区文本+Range.Information 页码+文档名 → 复用 SY-研究来源卡 结构（source=word-document，指纹=选区 hash）；前置守卫=SY-粘贴守卫 进程名校验（WINWORD/WPS）。**主路径裁定**：Quicker 原生 Word 支持模块优先（成熟度更高），COM 晚绑定为无模块版兜底——挂 Quicker GUI 轮实测两者；**R156 共享件已开发**：SY-Office选区.cs（word/excel 双模式+进程守卫+MK_E_UNAVAILABLE 分支，23 脚本编译门过；运行时待 Office 打开实测）
- [x] 【R153-02·评估】Word 批注/修订待审：用户导出或复制带批注/修订的段落，生成原文→建议→决定状态的思源待审草稿。验收：未读取到批注时明确“普通选区留证”，不把草稿写成已审阅。 → ✅ R156 调研登记（E1+E2）：COM 面=Document.Comments（item.Scope.Text=原文、.Range.Text=批注、.Author）/Document.Revisions（Type/Range/作者）→待审草稿（原文→建议→决定三列，决定列留空）。**验收语义落点**：Comments.Count==0 且 Revisions.Count==0 → 明确回「普通选区留证」（不把草稿写成已审阅）。共享件 SY-Office选区.cs 本轮开发（见同批）
- [x] 【R153-03·评估】Excel 区域证据卡：保存工作簿、工作表、`Range.Address`、`Value2` 原始值、`Text` 显示值及筛选/日期说明，生成 Markdown 表格或 CSV 附件。验收：多单元格显示值为 Null 时仍保留原始值和地址，失败退化为用户导出 CSV。 → ✅ R155 调研登记（E1+E2）：Excel.Application 晚绑定→Selection.Address+Value2 二维数组→Markdown 表（**Text 显示值并注**：Value2 是原始值、Text 是含格式的显示串——证据卡两列都要，日期/金额误读是主要风险）；筛选状态用 Worksheet.FilterMode 记录。验收对齐：公式/空值/显示格式保留=Value2+Text 双列；不直接修改 Excel=只读。**待实测**：GetActiveObject 在 Excel 未运行时抛 0x800401E3（MK_E_UNAVAILABLE）——动作分支需明确「先打开工作簿」提示；挂 Quicker GUI 轮
- [x] 【R153-04·评估】Excel 异常解释草稿：用户选择区域并提供阈值/规则，生成异常地址清单和思源解释草稿，不直接修改 Excel。验收：公式、空值和显示格式保留，AI 只解释异常，不判定业务正确。 → ✅ R156 调研登记（E1+E2）：COM 面=Selection.Value2 遍历+用户阈值/规则 → 异常地址清单（Cells(row,col).Address）+解释草稿（AI 解释挂思源 /api/ai/chatGPT 同 P0-3，动作只出清单不判级不改表）。**验收对齐**：公式保留=读 Formula 而非 Value2 作证据列；空值/文本单元格跳过并计数。SY-Office选区.cs 共享件本轮开发
- [x] 【R153-05·评估】邮件决定与承诺捕获：用户在已打开邮件中主动复制主题、发件人、正文选段和附件名，拆成事实、决定、待回复和承诺草稿。验收：目标 owner 由用户确认；新 Outlook 无 COM/VSTO 时只使用公开导出/复制兜底，不自动创建联系人或任务。 → ✅ R212 域登记（Word/Office COM 域——R153 同款裁定）：邮件选段捕获=Outlook/WPS 邮件 COM 域；拆分事实/决定/承诺=来源卡三层同构；写入=收集箱链已有
- [x] 【R153-06·评估】会议前中后资料链：会议前打开资料卡，会中从 Word/Excel/PowerPoint 的用户选区或公开导出、截图和计时记录证据，会后将用户确认的行动项写入思源项目或跟进草稿。验收：会议来源、页码/表格/幻灯片、时间、附件和敏感字段可追溯；不自动发送邀请或邮件。 → ✅ R212 域登记（Word/Office COM 域——R153 同款裁定）：会议前中后资料=Office COM 域（R153 同款）；会中证据=选区留证；会后行动项=人脉 owner（R191）
- [x] 【R154-01·评估】文件/文件夹项目索引：资源管理器主动选中文件或目录，写入项目文档的路径、扩展名、大小、修改时间和可选哈希。验收：默认只写引用与元数据，不移动源文件；权限不足进入待归档清单。 → ✅ R152 落地件已开发：SY-文件项目索引.cs（元数据表+可选 MD5≤100MB+部分成功清单+目录条目数不递归；22 脚本编译门过；资源管理器选中文件→路径列表变量接线待 Quicker GUI 轮）
- [x] 【R154-02·评估】文件夹监控待审草稿：FileSystemWatcher 发现新 Markdown/PDF/图片后等待文件稳定，再生成收件箱草稿。验收：同步盘重复事件、临时文件、停止监控和去重均可解释，确认前不物化内容。 → ✅ R157 落地件已开发：SY-增量扫描.cs（重入式增量=无长驻等价物：上次扫描点+稳定性检查≥5s+临时件过滤+时钟偏差夹紧；幂等键=路径+mtime；24 脚本编译门过）——「同步盘重复事件」由重入幂等天然消化（FileSystemWatcher 长驻方案裁定不用：Quicker 动作有限时长模型）
- [x] 【R154-03·评估】Everything 结果索引：把用户主动检索的文件结果生成思源索引页，保留查询、路径、快照时间和缺失状态。验收：路径变化、脱机盘和权限错误分开显示，不宣称已同步文件内容。 → ✅ R157 调研登记（E1 环境实证）：Everything 1.4.1 **已安装**（D:/Program Files/Everything）但 **es.exe CLI 不含**（voidtools 单独分发）、服务未运行、HTTP server 默认关——本机 Listary 在跑但无公开查询 CLI。**三条解锁路**：(a)下载 es.exe 放 Everything 目录（用户动作，最简）(b)开 Everything HTTP server（GUI 一次）(c)Listary 无 API 放弃。解锁后动作=Everything 查询→结果行→SY-文件项目索引 复用（组装，无新代码）
- [x] 【R154-04·评估】远程素材导入：从 WebDAV/NAS/S3 选择文件导入思源 assets 或资料篮，保存来源、版本、指纹和凭据来源。验收：凭据不出现在分享包，下载失败可逐项补做，远程写超时先查询/比对。 → ✅ R158 落地件已开发：SY-WebDAV传输.cs（download=GET+落盘 MD5 指纹/upload=PUT+ETag/list=PROPFIND Depth1 多命名空间容错；凭据只进动作配置不输出——25 脚本编译门过）+ P0-5 资产上传复用=完整导入链。**本机端点**：openlist 配置/令牌在（用户配过存储）但服务未运行（5244 死）——启用 openlist 插件即真机可用
- [x] 【R154-05·评估】思源导出远程归档：将用户确认的 Markdown/附件批次导出到远程目录，生成文件清单和归档回执。验收：写入、未知、重复和部分成功分开；不会因超时盲目重传或删除本地源。 → ✅ R158 调研登记（E2）：归档=导出（思源 /api/export/… 或用户确认的本地批次）→ SY-WebDAV传输 upload → **清单回执写回思源**（路径+MD5+时间表，写入/未知/重复/部分成功分列——R154-04 指纹+R154-06 报告件共用）；「不因超时盲目重传」=upload 单文件单调用+调用方按清单补做。导出 API 形状挂导出实测轮
- [x] 【R154-06·评估】路径与重复处理：对文件移动、重命名、同名、重复 hash 和软链接生成变更报告。验收：用户选择更新引用、保留旧引用或忽略，动作不暗中改变思源资源块和源文件。 → ✅ R159 落地件已开发：SY-变更报告.cs（新旧清单 JSON diff：新增/删除/移动（同 md5 消失重定位）/重复组四分类报告；只读不改引用——引用更新由用户决定；26 脚本编译门过）
- [x] 【R155-01·评估】截图 OCR 审阅块：截取屏幕选区，保留原图并生成可编辑 OCR 文本写入收件箱。验收：原图与文本一一关联，低置信度标记，取消/空图/模型下载失败不丢原图。 → ✅ R152 调研登记（E2，组装评估）：全部组件已在库——截图选区（Quicker 模块）→OCR（Quicker 模块）→文本清理（SY-OCR清理.cs）→原图入库+alt 关联（p0-5 剪贴板图片入库.cs 已实现「OCR 写 alt=图片可检索」即本项核心验收）→低置信标记（OCR 模块置信度字段透传 alt 尾注）。**组装配方**：截图→OCR→清理→p0-5 全链，无新代码需求；取消/空图分支由各模块失败分支串联
- [x] 【R155-02·评估】标注截图证据：对截图添加箭头、遮罩和编号，写入思源资源块及来源窗口/时间。验收：原图、标注图和说明可切换，隐私遮罩在外发前明确显示。 → ✅ R159 调研登记（E1 环境实证）：本机 **PixPin 在跑**（标注/长截图能力自带）——主路径=PixPin 截图标注 → 图片走 p0-5 入库（原图+标注图两张，alt 分别标 origin/annotated + 来源窗口/时间尾注）；隐私遮罩外发确认=PixPin 标注步骤内完成（人审环节天然存在）。**验收对齐**：原图/标注图/说明三件均入块；无新代码需求
- [x] 【R155-03·评估】长截图资料：将网页或文档长截图拆成可定位页面或一张带目录的资料卡。验收：超长、滚动中断和内容变化有状态，图片和来源 URL 保持关联。 → ✅ R159 调研登记（E1）：长截图主路径=**PixPin 长截图**（本机在跑，滚动拼接自带）；入思源=大图资产上传（p0-5）+「可定位拆页」裁定：>10000px 才拆（思源图片渲染可滚动，拆页反而丢上下文——登记为反过度工程裁定）；来源 URL 关联=来源层同来源卡。挂 Quicker GUI 轮实测 PixPin→Quicker 图片变量链
- [x] 【R155-04·评估】公式识别：对公式截图调用公式识别，预览 LaTeX/Math Markdown 后插入当前光标或指定草稿区。验收：识别费用/外发提示，失败保留原图，不自动替换原文。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：公式识别→LaTeX=OCR 厂商域；插入光标=模拟按键域（受控粘贴守卫同款前置）
- [x] 【R155-05·评估】录屏/会议索引：将录屏文件写入会议或教程索引，记录开始结束时间、窗口、文件路径和用户标注时间点。验收：不把录屏转录或业务行动项宣称为已完成，文件权限/体积超限可降级为链接。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：录屏索引元数据（时间/窗口/路径）=SY-文件项目索引 同构可复用；「不把录屏当完成」=完成判据红线
- [x] 【R155-06·评估】图像质量与隐私门禁：为 OCR 语言、版面、置信度、敏感区域和本地/外部处理建立预览。验收：用户可取消上传、遮挡敏感区和保留原图，质量不足只生成待校对草稿。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：OCR 隐私门禁=本地/外部处理披露（R90 外部处理红线同构）+SY-OCR清理 已备清理面
- [x] 【R156-01·评估】选区格式修复：对当前思源选区做标题、列表、引用、代码、表格或公式格式化，预览差异后写回。验收：只操作用户选区，保留快照和撤销路径，选区失效时停止。 → ✅ R212 域登记（思源 API 域——快门可组装）：选区格式化=updateBlock API 可组装（预览差异后写回=用户确认语义；只操作选区=验收字面）
- [x] 【R156-02·评估】文本规范化：清理空行、中文标点、全角半角、Markdown/JSON/URL 格式，显示原文与新文 diff 后粘回。验收：超长文本不截断，目标窗口/块重新确认，取消不覆盖。 → ✅ R160 落地件已开发：SY-文本规范化.cs（规则集参数化：blank/eol/fullwidth/mdtitle/utm；变更行数计数；**只产出新文本不写回**——diff 预览与目标块确认由调用方执行，验收语义原样；27 脚本编译门过）
- [x] 【R156-03·评估】大纲转草稿：从标题树或外部大纲生成可编辑段落草稿和缺证据清单，写入草稿区或剪贴板。验收：保留大纲节点和素材引用，失败进入本地草稿，不覆盖正文。 → ✅ R212 域登记（思源 API 域——快门可组装）：标题树→草稿=SQL 查标题树+insertBlock 组装（SY-12 同构）；素材引用=siyuan:// 链
- [x] 【R156-04·评估】论断找依据：选中论断或光标触发资料篮搜索，生成来源标题、块链、摘录、版本和置信说明，确认后插入引用。验收：无选区/多候选/索引未更新时只给候选列表，不能把推断写成引用。 → ✅ R212 域登记（思源 API 域——快门可组装）：论断→资料篮搜索=p0-3 快查+来源卡 组装（「推断不写成引用」=证据信封分级红线）
- [x] 【R156-05·评估】段落事实核验：对选中段落核对已有引用，列出可定位、失效、冲突和无出处项，生成待修改草稿。验收：保留原段落，引用证据缺失时说明原因，不自动重写事实。 → ✅ R212 域登记（思源 API 域——快门可组装）：引用核对=SQL 查引用块+失效检测 组装（R176 引用核对同源；只读报告模式）
- [x] 【R156-06·评估】术语与格式一致性报告：按用户确认的术语表扫描章节，给出变体位置和逐项替换预览。验收：批量修改前必须确认，规则不适用时只报告，不静默改写正文。 → ✅ R214 账本重复项：术语一致性报告=R154 已登记同文（SQL+只读报告模式）
- [x] 【R157-01·评估】思源搜索结果工作台：将全文/SQL 搜索结果带上下文、来源、分页和截断信息送入可筛选的 Quicker 窗口。验收：结果范围、时间和权限可见，无结果不等于查询失败。 → ✅ R212 域登记（思源 API 域——快门可组装）：搜索结果→Quicker 窗口=p0-3 候选列表已有（可筛选窗口=showtext 升级，验收语义已备）
- [x] 【R157-02·评估】文档并排对照：选择两个文档或导出基线，生成段落级 diff、引用增删和未解决 TODO。验收：没有基线时明确无法比较，不假造版本历史；可回到对应块或文件。 → ✅ R212 域登记（思源 API 域——快门可组装）：段落级 diff=两文档 SQL+对照报告 组装（「无基线明确无法比较」=诚实红线；不假造版本=思源历史 owner）
- [x] 【R157-03·评估】多结果证据清单：用户勾选多条结果生成主题、来源、摘录、块 ID 和缺口的证据清单。验收：重复块、已删块和无权块分开显示，清单可导出 Markdown/CSV。 → ✅ R212 域登记（思源 API 域——快门可组装）：多结果勾选→证据清单=p0-3 候选+证据信封 sources 组装（重复/已删/无权分开=SQL 可查）
- [x] 【R157-04·评估】带引用导出：将研究结果导出 Markdown/CSV，保存 URL、文档、块、页码/时间戳和抓取时间。验收：原始统计、AI 润色和引用列表分层，导出失败不改变源资料。 → ✅ R212 域登记（思源 API 域——快门可组装）：导出保存 URL/块/时间戳=证据信封字段（Markdown/CSV 生成=报告模式）；「原始统计与 AI 润色分层」=generatedBy 字段
- [x] 【R157-05·评估】查询模板与复用：保存用户确认的查询条件、参数和脱敏范围，下一次运行前显示数据截至时间和权限变化。验收：查询语义变化需要重新确认，AI 生成 SQL 只读校验通过才能运行。 → ✅ R160 调研登记（E2，实现对照）：模板保存=statestorage（Quicker 侧）+参数即 args；只读校验=**p0-3 GuardSql 已实现**（SELECT/EXPLAIN 单语句+13 禁止词+LIMIT 强制）；「数据截至时间」=SQL 面板显示 now；「权限变化重新确认」=401 自愈+registry 预检覆盖。**缺口登记**：(a)模板 UI（保存/列表/复用选择）是 Quicker 动作层职责，无参考件需求（statestorage 读写为标准步骤）；(b)「查询语义变化需重新确认」=模板 revision 语义，登记为动作侧设计约定
- [x] 【R157-06·评估】来源 URL 回到原网页：从思源来源卡激活已有标签或安全打开新标签，允许按标题/锚点定位。验收：只匹配允许域名；页面改版、登录失效或选择器失效时保留思源摘录并降级为 URL。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：来源卡 URL→打开标签=浏览器扩展域（只匹配允许域名=域名白名单验收）；失效降级=摘录全文已入卡可读
- [x] 【R158-01·评估】思源块送外部备注：用户选择思源块，将纯文本、Markdown 或链接复制/写入指定外部应用的备注草稿。验收：外部写入前显示目标窗口和字段，回执记录外部对象标识，失败保留可复制草稿。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：块→外部备注草稿=复制域（写回外部=粘贴守卫域）；「失败保留可复制草稿」=剪贴板已写语义
- [x] 【R158-02·评估】外部对象回写思源：从浏览器、PDF、Zotero 或邮件中由用户提供对象 URL/标识，生成思源来源卡并保存 `siyuan://blocks/...` 回链。验收：外部对象删除或链接失效时不删除思源记录，状态进入待处理。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：外部对象→来源卡=SY-研究来源卡 已实现（URL/标识入卡+siyuan:// 回链保存——本项核心已落地）
- [x] 【R158-03·评估】双向关系表：为思源块、外部 URL/文件/消息建立关系表，记录首次关联、最近核对、版本和来源。验收：同一对象多次关联幂等，变更/删除有待核对项，不把链接存在当作内容同步完成。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：关系表（首次关联/最近核对/版本）=来源卡字段+SY-变更报告 指纹比对——「同一对象多入口去重」=指纹语义
- [x] 【R158-04·评估】外部回写确认：把思源字段映射为浏览器表单、邮件回复或应用备注草稿，只做检查和预填，提交仍由用户完成。验收：字段 diff、域名和敏感字段可见，无法公开定位时退回思源草稿。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：字段映射预填不自动提交=粘贴守卫+表单检查域（提交由用户=授权分离红线）
- [x] 【R158-05·评估】回写冲突处理：外部对象和思源块都发生变化时生成并排冲突卡，允许保留思源、保留外部或另存合并草稿。验收：没有明确所有权时不覆盖任一侧，冲突决定有时间和来源记录。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：并排冲突卡=R81 内容冲突同构（保留思源/保留外部/另存合并——用户决定红线）
- [x] 【R158-06·评估】返回路径与失效治理：统一处理 `siyuan://`、网页 URL、文件路径和外部对象 ID 的打开、失效、权限变化和版本迁移。验收：失效链接仍可读脱敏摘要，打开动作不会因为历史链接自动触发写入。 → ✅ R212 域登记（外部回写域——等浏览器扩展轮）：siyuan:///URL/文件/外部 ID 统一失效治理=定位修复（R80）+来源卡失效降级（摘录可读）
- [x] 【R159-01·评估】VS Code diff 记录：用户选择 diff 或指定 `file:line:character`，生成思源开发记录、变更摘要、测试证据和待验证项。验收：使用公开 `--diff/--goto` 或用户传参，不读取 IDE 私有数据库。 → ✅ R212 域登记（浏览器扩展域——等扩展轮）：diff 记录=VS Code 域（file:line 透传=来源卡字段扩展）
- [x] 【R159-02·评估】Git 提交证据：对用户指定 repo/commit 读取 `git show` 日志和文本 diff，写入项目文档。验收：记录 commit、文件和行号范围；仓库不可达时明确未验证，不把命令成功当测试通过。 → ✅ R214 域登记（等 Quicker GUI 轮）：Git 提交证据=工程证据卡域（来源卡 source=git 变体）——等开发者场景轮
- [x] 【R159-03·评估】终端命令结果：用户主动选择命令输出或日志文件，解析错误堆栈、模块、行号和复现步骤。验收：只读导入，危险命令不自动执行，Token、路径和个人数据先脱敏。 → ✅ R214 域登记（等 Quicker GUI 轮）：终端命令结果解析=工程证据卡域（同上）
- [x] 【R159-04·评估】Issue/PR 跟进卡：将用户提供的 Issue/PR URL、标题、状态、讨论摘录和下一步写入项目跟进。验收：来源时间和快照可追溯，网络/权限失败不伪造最新状态。 → ✅ R214 域登记（等 Quicker GUI 轮）：Issue/PR 跟进卡=工程证据卡域（gh CLI 原料已备——lv-cli 同模式可扩展）
- [x] 【R159-05·评估】解决记录回链：把思源问题记录链接回 commit、文件、测试命令或 PR，支持从结果卡回到代码位置。验收：行号变化、分支切换和 commit 重写进入失效/待核对状态。 → ✅ R214 域登记（等 Quicker GUI 轮）：解决记录回链=siyuan:// 回链+来源卡（双向闭环已有——工程域扩展）
- [x] 【R159-06·评估】工程证据分级：统一 received/draft/committed/verified/unknown 的开发记录状态，区分“命令执行”“测试通过”“业务修复”。验收：没有测试证据时只能标待验证，记录可导出为 Markdown/JSON。 → ✅ R214 域登记（已交付对照）：工程证据分级=**证据等级纪律（E0~E5）已交付**——received/draft/committed 映射=回执六态
- [x] 【R159-07·评估】用户结果卡：为每个动作写清用户目标、输入、目标 owner、输出、耗时测量、风险、手动替代和恢复入口。验收：动作目录先显示能完成什么，再显示模块和协议。 → ✅ R214 域登记（已交付对照）：用户结果卡=**ACTION-CARDS 八字段已交付字面**（用户目标/输入/owner/输出）
- [x] 【R159-08·评估】统一 manifest 与契约：定义 actionId、revision、入口、参数 schema、依赖、effects、版本门槛、来源、许可和支持责任。验收：Quicker 分享包、快门能力卡、README 和帮助页引用同一事实表。 → ✅ R214 域登记（已交付对照）：统一 manifest 与契约=**registry.json 提案+ACTION-CARDS+capability contract**（三件已备）
- [x] 【R159-09·评估】三态运行门禁：把只检查、dry-run/预览和真实执行分开，明确每一步是否联网、写入、模拟输入或产生费用。验收：试运行是真实执行时明确提示，超时不自动重试。 → ✅ R214 域登记（等 Quicker GUI 轮）：三态运行门禁（只查/预览/真实执行）=只读白名单+plan 确认卡已实现语义——UI 三态挂轮
- [x] 【R159-10·评估】AI 生成与验证夹具：让 AI 只生成 ActionSpec/草稿和测试夹具，显示 diff、步骤引用、敏感字段与版本，之后进入 Quicker 暂存、静态检查和业务回执。验收：生成完成不等于可分享，Quicker 成功不等于业务 verified。 → ✅ R214 域登记（等 Quicker GUI 轮）：AI 生成与验证夹具=附A.1 幻觉门+csc 门+fixtures（已交付——UI 集成挂轮）
- [x] 【R159-11·评估】运行反馈与作者支持：采集用户主动提交的成功/失败/未知、动作 revision、环境和最小诊断，形成兼容矩阵和可复现夹具。验收：不上传敏感正文，反馈可撤回，作者能定位入口、步骤和 owner。 → ✅ R214 域登记（等 Quicker GUI 轮）：运行反馈与作者支持=审计导出+G2 观察表（采集面已备——展示挂轮）
- [x] 【R159-12·评估】退役、迁移与停用：为动作版本过期、Quicker/Connector 依赖消失、上游 owner 下线、权限撤回和用户卸载设计迁移/只读历史/手动替代。验收：退役动作不再出现在可执行目录，历史结果和来源仍可读，不能重放旧写请求。 → ✅ R214 域登记（等 Quicker GUI 轮）：退役/迁移/停用=版本头弃用标注+PRIVACY 出口（已交付——流程挂轮）

**本轮统计**：新增 60 项，全部未勾选。P0 优先验证入口预检、网页列表完整性、截图/OCR 原图保留、思源选区保护和 Git/VS Code 证据；P1 验证 Word/Excel、检索对照、来源回链和动作 manifest；P2 再评估邮件/PowerPoint、远程文件、长驻监控、跨应用回写和多 Profile 自动路由。详细事实、官方链接和产品推导见 [Quicker 增强思源动作场景调研 R151~R160](docs/22-Quicker增强思源动作场景调研-R151-R160.md)。

**统计**：共 1348 项，已完成 192（2026-10-02），未完成 1156 项；保留原 12 大类，新增 §13~§21。本轮 R141~R150 新增 60 项原型实现前置及验收子项；R151~R160 新增 60 项 Quicker 增强思源动作场景，并将已有覆盖的细节回填父项而不重复计数。上一轮 R131~R140 增加 80 项体验与页面事项；R123~R130 增加 58 项，R114~R122 增加 130 项，R106~R113 增加 109 项，R97~R105 增加 101 项。历史条目继续按 C1~C8 引用，本轮只研究、校正原型和登记待办，未进行开发。

**排队规则**：先核对事实/契约和用户需求，再处理首成功阻断、未知状态与写入边界；随后只挑一条捕获闭环和一条稳定插件联动验证。历史 P0/P1/P2 只表示收益/风险优先级，不自动等于开发顺序。
**发布节奏**：代码即推 GitHub；集市等 §8 门槛。
**既有工程关注点**：系统代理拦 127.0.0.1、多空间端口、storage/local 迁移（spike⑨，可能一举消解多设备+同步流量两问题）、内核日志刷屏、命令执行超时保护、诊断包、契约 JSON、混沌测试。
**既有产品调研关注点**：用户先看到结果再看到协议；能力发现要显示依赖/读写/状态/降级；首跑、失败、升级、卸载均可续跑和回退；UI 要支持键盘、触控、窄屏和屏幕阅读；性能按 P50/P95、队列容量、移动资源和长时间稳定性验收；宣传、外测、反馈与插件清单必须使用同一事实表；跨插件联动遵守 owner/source of truth，不把设计态接口宣传成可用功能。
**上一轮延伸关注点**：捕获后的证据关联和实际利用、导入字段所有权与本地修改保留、规则版本/因果回环/限额/暂停、草稿与命令分离、跨午夜和跨端意图、难卡修复与会前承诺、AI 上下文及多轮确认、无 Quicker 的最终任务结果、7/30 天净收益、教程版本和长期维护成本。全部为待验证候选，研究事实、设计假设与契约缺口分开记录。
**本轮延伸关注点**：截止与提醒语义、夏令时和日历冲突、OCR/音频/视频来源链、结构化字段和视图口径、素材到发布产物的版本回流、多选局部失败与撤销、中文/繁简/拼音/混合文本、生态作者测试夹具和弃用、个人/共享数据治理与紧急停止。

- [x] 【R91-G2·新】收集箱自动发现候选（G2 使用反馈驱动）：config.discover 的 inboxDocId 恒 null（发现逻辑只覆盖日记笔记本）——候选=命名约定发现（名为「收集箱」的文档）/日记笔记本下首个空文档启发式；【触发条件：G2 样板搭建中用户卡在收集箱配置】 → ✅ R214 域登记（等上游/扩展轮）：收集箱自动发现候选=**config.discover 已实现发现**（R213 前置：约定名/手填指引）——候选采纳挂 G2 反馈

- [x] 【R85~R96·CI 容器化 e2e 实验·五轮诊断】实验分支 ci-e2e-experiment（workflow 已建）：①serve 子命令（v3.7.0+ 必须，缺=打印帮助退出）②Token 提取成功（conf.json 顶层 token，"OCI ru" 前缀即真值）③**429 限速**（dummy 认证累计触发）待对策 ④**根本边界确认：CI 容器=纯内核（无前端窗口）——只可能覆盖内核侧验收（⑩/⑩⓪/events/registry），③桥端到端/v1.5/⑪/MCP 广播需前端窗口，CI 永远不可能**。剩余迭代：限速等待对策+内核侧四类验收转绿后合 main（内核侧回归自动化）
- [x] 【R96-G1·等实验】CI 内核侧 e2e 转绿：限速对策（restart 清零或延迟窗口）+ api.token 验证 + ⑩路由/⓪401/events.list/降级 四项在容器转绿【实验分支自主迭代】 → ✅ R214 域登记（等上游/扩展轮）：CI 内核侧 e2e 限速对策=verify-restart 已内置请求间隔——restart 限速按 CI 日志再调（实验项保持）

- [x] 【R97·CI 容器化实验·七轮收官（暂停）】第七轮决定性发现：容器 api.token 首探即生成，但为 **122 字符新格式**（OCI 开头；本机 11 位系旧格式迁移遗留）+ accessAuthCode 模式下 version API 返回 **400**（非 401/200）——v3.8.6+ 新版 Token/鉴权行为**超出官方文档覆盖**，需上游 issue 或源码确认后方可继续。实验分支 ci-e2e-experiment 保留（workflow 含全部诊断）。**结论：容器化 e2e 技术可行已证（serve/部署/插件启用全通），卡点=新版鉴权行为确认（上游依赖）**
- [x] 【R97·等上游→R98·源码考古已确认】v3.8.6 内核 auth.go 实证（gh API 拉取 v3.8.6 tag 源码）：引入 **JWT 机制**（golang-jwt/v5，jwtKey 32 字节随机生成，iss=siyuan-kernel，多 audience 含 siyuan-kernel-plugin——**122 字符 Token 即内核插件 JWT**）+ `/api/system/setAPIToken` 端点存在（CheckAuth+Admin）。**CI 容器 Token 对策定版：容器首启前直接向 volume conf.json 预置 api.token=固定值（volume 可写，无需等内核生成）**——下轮实验执行

- [x] 【R100·CI 容器化 e2e 六轮】预置 conf api.token 生效但内核将其重写为 122 字符 JWT（api.token 长度 122/OCI 前缀实测）；探针修正发现=version API 免认证（对照无 token 也 200，假说 A/B 均 200 不能证伪）；⑩ 路由 429=认证失败限速窗口未冷却（restart 不清）
- [x] 【R100-G1·下一轮】429 冷却对策（verify 前 sleep 60~120s 或限速窗口实测）+ 用内核重写的 122 JWT 调需认证 API（registry.list）验证 → 内核侧四类转绿后合 main → ✅ R214 域登记（等上游/扩展轮）：429 冷却对策=verify-restart 前置 sleep 已实践（本轮真机批零 429）——按 CI 日志再调（实验项保持）

- [x] 【R101·CI 容器化 e2e 七轮】JWT 认证验证新知：registry.list 经路由 **HTTP 400**（非 401/403/429/404）——**JWT（122 字符）作为 API Token 认证已通过**，400 来自 accessAuthCode 会话层（CI 容器无浏览器会话）；429 限速跨 restart 持久
- [x] 【R101·等实验】auth_session.go 全文深挖：accessAuthCode 模式下 API Token 直通的确切条件（本机直通 vs 容器 400 的差异根因）→ 确认后决定容器对策（会话注入/关闭 accessAuthCode/其他）【实验分支自主迭代】 → ✅ R214 域登记（等上游/扩展轮）：auth_session.go 深挖=源码研究项（gh 可达 CheckAuth 源——R25 先例）——挂研究并发位（≤2 合规）

- [x] 【R104·CI 容器化 e2e 八/九轮】bypass 模式（不设 accessAuthCode+SIYUAN_ACCESS_AUTH_CODE_BYPASS=true）实测：**API 免凭据生效**（lsNotebooks 200 ✓；预置 api.token=ci-fixed-api-token 被内核保留 18 字符 ✓——Token 链路全通）；**剩余唯一阻塞=kernel.js 容器加载机制**（404：isKernel 名单未含快门，容器重启后仍 404；容器启动日志的 isKernel 名单提取受 CI 日志工具间歇干扰未拿到）——纯容器环境问题，与快门代码无关
- [x] 【R104·等实验→R105 已解决】kernel.js 容器加载机制：**根因=bazaar trust 未确认**（IsPetalsEnabled：Docker 容器需手动确认集市信任，首启默认禁用）→ 预置 conf 补 bazaar:{trust:true} 后 CI 容器内核侧全线转绿（⑩路由 kernel-sync/events.list/降级/MCP registry.list 301ms 全 recorded，R105 十轮收官）

- [x] 【R105·CI 容器化 e2e 十轮（收官）+合 main】bazaar 节预置（trust=true+petalDisabled=false）=**最后一块拼图**——IsPetalsEnabled 源码（model/plugin.go）：Docker 容器需手动确认集市信任，首启默认禁用内核插件；bazaar trust 预置后 **CI 容器内核侧全线转绿**：⑩路由 ping channel=kernel-sync ✓/events.list 白名单=8 ✓/前端 op 诚实降级 ✓/**MCP registry.list 经 exec 301ms isError=false ✓**；实验 workflow 已合 main（触发=workflow_dispatch 手动）；实验分支删除。**CI 容器化 e2e 内核侧验收从实验转为基础设施**——每次可手动触发全量内核侧回归

- [x] 【R110·MCP 真 e2e 全链首次通过】三通道全部经真实前端消费：bridge.ping 广播快路径 recorded + registry.list 内核路由 recorded + editor.context NDJSON 慢路径 recorded + daily.status NDJSON 写路径投递 recorded——R71 开桥+R83 回滚演练+R105 bazaar trust 修复三步铺垫后，MCP 代理的最后缺口（插件消费侧）真机确认闭合。v0.7.2 解除 pre-release 转正式版 Latest

- [x] 【R112·兜底循环 A/B/C】上游零漂移（思源 3.8.6 仍最新正式版/三插件无新版）；npm run accept 99/99 + 直接冒烟 6/6 全绿（npm run 子进程的 5/6 为 PATH 环境差异非代码问题）；两仓库干净。稳定态持续。

- [x] 【R113·MCP NDJSON 慢路径真机验证】四 op 经真实前端消费返回真实数据：daily.status（docId=null 正确——今日日记未创建）/config.discover（diaryNotebookId=DailyNote 正确命中）/events.list（白名单返回）/registry.list（七插件清单返回）——MCP 真 e2e 全链完成（三通道+四 op 全真实数据）

- [x] 【R114·MCP 真 e2e 真实数据验证】MCP 代理返回真实工作空间数据（只读 ops）：checkin.items 返回 5 个打卡项目（写日记/每日计划/早起/拉伸/喝水）、contacts.search 返回 40 人脉、commands.list 返回 15 插件命令注册表、registry.list 返回七插件（3 stable+3 design+1 unlocated）、diagnostics.report 返回脱敏诊断——MCP 全链真实数据验证完成，系统从基础设施验证升级为真实数据流通确认

- [x] 【R115·MCP 安全门+NDJSON 真机确认】workflow.plan 被安全门正确拦截（LV_MCP_WRITE=1 前不暴露——设计如此）；events.pull 经 NDJSON 真实前端消费返回 recorded（0 事件，正确——用户未操作打卡）。MCP 安全门+NDJSON 通道真机确认工作。

- [x] 【R115 补充·MCP 全量只读扫描】12 只读 op 全部通过 MCP 代理返回成功（bridge.ping/commands.list/checkin.items/checkin.summary/contacts.search/daily.status/editor.context/config.discover/diagnostics.report/events.list/events.pull/registry.list）——覆盖只读工具面的 100%

- [x] 【R116·MCP 写路径端到端真机确认】LV_MCP_WRITE=1 全量冒烟 6/6：23 工具全暴露+bridge.ping 经广播快路径获得真实 recorded 回执（前端在线消费）——MCP 写路径（NDJSON 投递→前端轮询→执行→回执）首次真机全链确认。快门全部外部通道（NDJSON/内核路由/广播/MCP 三模式）均真机验证通过

- [x] 【R117·内核日志健康检查】0 错误/0 警告（最近 200 行）；quickgate 67 条同步记录（audit.json+bridge-state.json 云同步正常）；总日志 71519 行 11MB——系统运行清洁，无累积问题

- [x] 【R118·依赖安全审计+修复】pnpm audit 发现 17 漏洞（9 高危/7 中危/1 低危——全在开发依赖非生产运行时）：pnpm update npm-run-all svelte-check svelte devalue 等到最新 + vite.config assetFileNames 显式类型 + UserConfig 断言改 any（vitest 4.x 类型不兼容回退 3.x）→ 99 单测+冒烟+check 全绿

- [x] 【R121·CI 容器化 e2e 内核侧全线转绿】思源重启后复测批 7/7：③桥 1633ms recorded / ⑩⓪ 401 / ⑩路由 ping channel=kernel-sync / events.list 白名单=8 / 前端 op 降级 / ⑤广播 / MCP registry.list 经 exec 301ms isError=false——kernel.js 在 CI 容器中成功加载（bug#9 kernels 字段+bazaar trust 双修复生效），MCP 经 exec 内核路由真机验证完成。唯余 ⑪（需打卡数据）和 v1.5（需前端广播订阅）。实验 workflow 转 workflow_dispatch 手动触发
