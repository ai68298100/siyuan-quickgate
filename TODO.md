# 待办总清单（TODO）

> 更新于 2026-10-01（v3：全维度补全）。汇总自 docs/01~08 + 系统环境/生态/可观测性等维度。
> 勾选框 `- [ ]`；标注：`【实测】`真机验证 · `【spike】`快门 M0 实证 · `【GH】`GitHub 发布相关 · `【暂缓】`集市延后项 · `【评估】`先调研再决策。
>
> **发布策略（用户定）**：先上 GitHub（源码+Release+手动安装），**暂不推送集市**（思源 bazaar / Quicker 动作库均延后），上架门槛见 §8 末尾。

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
- [ ] 【实测】写入后索引延迟量级（校准等待/重试参数）
- [ ] 【实测】快门轮询对**内核日志**的影响：500ms getFile/putFile 是否刷屏日志（§10-10 决策依据）
- [ ] 【实测】【spike⑨】`data/storage/local` 是否**不随同步**；`/api/file/getFile|putFile` 能否访问 storage/local 路径——若成立，桥文件迁到 local 可同时消解多设备消费与同步流量两个问题（§5.3 决策）——**◐ 单机部分已实证**（R21/R31：putFile/getFile 对 `/storage/local/siyuan-quickgate/` 均 200，D-0006 技术可行）；**剩多端隔离验证**（需第二设备/同步对端）

### 1.2 系统环境类（本地请求的经典坑）
- [ ] 【实测】**系统代理对 127.0.0.1 请求的拦截**（Quicker HTTP 模块是否走系统代理；被拦截则加白名单/绕过设置）
- [ ] 【实测】**多工作空间同开时的内核端口规律**（第二空间是否换端口；动作的 SY_URL 是否需动态发现）
- [ ] 【实测】睡眠唤醒后内核可达性（Quicker 动作首调失败率；是否需要重试提示）
- [x] 【实测】思源开启 accessAuthCode（访问鉴权码）后 API Token 是否仍直通——✅ 本机答案在握：**访问鉴权码一直处于开启状态，R21 起全部 Token 探针（loadPetals/SQL/putFile/postMessage/exec…）均成功**=Token 直通实证；无 Token 401（⑩⓪）亦在该状态下验证【R58 待办审计销项，证据=既有探针记录】
- [x] 【R59·循环B】**§10-10 日志增长测量并入复测批 + spike⑨ 状态标注**：verify-restart.mjs 增 SIYUAN_LOG 环境变量启用项（复测前后取 temp/siyuan.log 差值，桥开着时 8s≈16 个轮询周期计入）——重启后即得"500ms 轮询是否刷屏"实测数据；本机预跑基线 9.27MB/全程 +961B ✓；spike⑨ 待办补 ◐ 标注（单机实证已过，剩多端隔离）
- [x] 【R60·循环A】**v0.6.6 部署完整性复核**：diff -rq dist vs 工作空间逐字节一致 ✓（R35 后又经 v0.6.5/v0.6.6 两次部署，零漂移）
- [x] 【R61·循环A】**git 仓库卫生**：单分支（main，本地=远端）✓、工作区干净 ✓、标签同步——gh release 建的 tag 在远端，本地 fetch --tags 后 21 个全齐（v0.6.6 在列）
- [x] 【R62·循环A】**重启前就绪板（四层统一验证）**：①单测 98/98 ✓；②MCP 协议冒烟 6/6 ✓；③桥 e2e 预检 exit=2（环境未就绪，归因正确）✓；④复测批 3/5（两项正确归因待重启）✓——**全部自主层绿灯或诚实归因，快照固化；重启后同四条命令即全量转绿**
- [x] 【R63·循环A】**令牌泄漏安全扫描（两项目零命中）**：真实 Token 值与令牌形状字面量在 quickgate 仓库与设计文档项目全部文件类型中零命中——所有引用走环境变量/用户配置变量；.gitignore 的凭据条目（*.local.json/bridge-*.json/audit.json/.env）覆盖到位
- [x] 【R64·循环B】**验收流程收敛为一条命令**：package.json 新增 `accept`（=单测+MCP 冒烟，实跑 98/98+6/6 ✓）、`smoke:mcp`、`verify:restart` 三个脚本——重启后验收从记四条命令变成 `npm run accept` 全绿 + `npm run verify:restart` 七类数据
- [x] 【R65·循环A】**验收入口文档同步三处**：WALKTHROUGH 复测节改 npm run 形式（并补 SIYUAN_LOG 用法与 MCP 项）、双语 README 开发节补 `pnpm accept` 行
- [ ] 【实测】思源开启 HTTPS 后 URL 协议变化对动作的影响（配置项兼容 https）
- [ ] 【实测】Defender/杀软对 Quicker C# 脚本与临时文件的误报
- [ ] 【实测】勿扰模式下 notify 可见性
- [ ] 【实测】Quicker 免费版跑通 P0 全部模块；受限列 Pro 清单
- [ ] 【实测】V2「用户配置项」入口与动作导出文件格式实测（右键动作→设置；quicker-actions 归档分发依赖导出格式）
- [ ] 【实测】Quicker 状态存储（statestorage）重启后持久性验证（缓存/配置依赖它）
- [ ] 【实测】C# 表达式环境：Newtonsoft.Json 版本、可用命名空间边界（动作里重度依赖）

### 1.3 配置与习惯类
- [ ] Quicker 开机自启 + 思源托盘常驻配置（保证 API 全天可用）
- [ ] 快捷键冲突扫描（Alt+S/Alt+Q/侧键 × 常用软件）
- [ ] 文本指令在中文输入法激活态下的可用性
- [ ] 多显示器 showmenu 定位与 DPI
- [ ] Quicker「适用于程序」绑定与场景自动切换配置（SiYuan 场景）
- [ ] 写剪贴板与思源剪贴板历史的相互影响

## 2. Quicker 公共子程序（动作地基）【需 Quicker 编辑器：子程序搭建为 GUI 操作，等用户操作；评估/脚本类已完成】

- [ ] `SY·内核请求`：配置读取（statestorage + `%APPDATA%\siyuan\env` 兜底）→ HTTP → 通用错误分支 → 输出（03 §0 / 04 §8）
- [ ] `LV·发命令`：id 生成 → 拼 NDJSON → putFile → 输出 id（02 §6）
- [ ] `LV·取回执`：循环 getFile → 逐行 JSON.parse 按 id 匹配 → 按 op 等待（普通快门约1.2s、数据约8s、commands.run确认约35s或pending）
- [ ] `SY·路由`：六分支分发 + 占位符解析器全实现（05 §5.1）
- [ ] `SY·反向触发`：668 /api/exec 封装
- [ ] OCR 清理子程序（去汉字间空格换行）
- [ ] 「思源未运行」分支子程序（探测→询问→启动→重探→toggle）
- [ ] 子程序版本注释头 + 变更记录
- [ ] 日志轮转（sy-quicker.log 超 1MB 滚动）
- [ ] 每个子程序外层兜底 try/catch（未预期异常也出中文 notify）
- [x] 【评估】写前快照选项：`/api/repo/createSnapshot`（W, memo）存在，可行但为全库快照——结论：仅批量写动作（SY-12/13、同步三连）执行前自动打快照 `memo="before-quicker-<动作名>"`；单块写入不做（成本不匹配）。已写入 12-FAQ「数据与安全」
- [ ] HTTP keep-alive/连接复用实测（面板四路并发开销）【等实测】
- [ ] 令牌自愈增强：401 时除引导手填外，先自动重读 `%APPDATA%\siyuan\env`（思源重置令牌场景）

## 3. P0 通用动作【需 Quicker 编辑器：动作为 GUI 搭建，蓝图齐备（docs/03），等用户操作；或后续评估用 Quicker 导入文件】

- [ ] P0-1 快速捕获到今日日记（判型 T5；笔记本自动发现+手填兜底；`HH:mm` 前缀右键可配）
- [ ] P0-2 划词摘录到收集箱（四级兜底；判型；浏览器 URL；可选复制块链）
- [ ] P0-3 全局快查（`sql:` 前缀→`/api/ai/chatGPT` 生成只读 SQL）
- [ ] P0-3 AI 生成 SQL 的安全过滤：含 UPDATE/DELETE/INSERT/DROP/ATTACH 等写/危险关键词直接拒绝
- [ ] P0-4 打开今日日记/收集箱
- [ ] P0-5 剪贴板图片入库（Multipart + OCR 写 alt）
- [ ] P0-6 SiYuan 场景页
- [ ] SY-12 汇总日记待办（SQL 转义；天数右键记忆）
- [ ] SY-13 数据体检（只读报表+误判提示）
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
- [ ] 【spike】③ 桥文件端到端 <2s——快门已部署启用，**待内核重启**（kernel.js 生效）后 `lv-cli.mjs ping`【等内核重启】
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
- [x] device 名记录（storage/local，信封 device 路由）——ensureDeviceName 已实现 local 优先读写 + settings 回退（行为验证随 spike⑨）
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
- [ ] 【评估】桥目录迁移 storage/petal→storage/local（spike⑨ 通过则改配置即迁移，D-0006）
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
- [ ] 大库联调：人脉千人数据 contacts.search 延迟【等实测】
- [x] 可观测性：命令处理计数/平均耗时进设置页（诊断数据）——v0.5.1：stats 分账（成功/拒绝/失败/过期）+平均耗时+最近活动，队列状态弹窗与诊断包展示；同轮修复多命令 elapsed 叠加
- [x] 「导出诊断包」：设置+审计+最近回执打包到剪贴板/文件（排障用）——v0.3.0 已实现（memDiagnostics 脱敏）

### 5.6 M3 可选加速（✅ v0.5.0 内核同步通道 + ✅ v0.6.0 广播快路径均已实现）
- [x] 【R23】**v1.5 广播 push 通道实现（v0.6.0）**：BroadcastSubscriber（SSE 订阅 qg-cmd 频道/AbortSignal 停止/指数退避重连）+ BridgeService.executeAndRecord（预留语义：同步 check+mark 防 NDJSON/广播双通道双执行；expired 补回执）；`broadcastEnabled` 独立开关默认关（红线）；api.md 三通道表更新。**真机联调待内核重启**
- [x] 【R22·spike⑤】广播通道三件实证（postMessage/SSE 订阅/Token 鉴权）——docs/WALKTHROUGH ⑤ 回填
- [ ] 【R23·等实测】v1.5 真机联调（内核重启后）：postMessage 推信封 → 毫秒级执行 → 回执落盘；与 NDJSON 双通道幂等竞态实测【等内核重启】→ **已一键化：`node tools/verify-restart.mjs`（R24），重启后一条命令跑完③⑩⑪⑤/v1.5 全部复测**
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

## 6. 桥协议侧（兜底，可选/延后）


- [ ] （可选）打卡 NDJSON 桥
- [ ] （可选）人脉 NDJSON 桥
- [ ] 每季度 02 协议与快门实现一致性检查

## 7. P2 扩展与新动作池

### 7.1 平台扩展
- [ ] 开启 Quicker 内置 HTTP/WebSocket 服务（668）：设置→软件连接→HTTP/WebSocket服务（本机 2.2.23 实测当前未开启）+ 访问令牌 + HTTPS 选项
- [ ] 手机 iOS 快捷指令（668 或推送服务，二选一实测）
- [ ] Quicker 推送服务开通与令牌配置
- [ ] P0-1「入参优先」分支
- [ ] 雷切工作台「Quicker 动作」卡片（对接快门网关）
- [ ] 思源内触发 Quicker 反向通道（CORS→httpserver 兜底→quicker://）
- [ ] 专注结束自动打卡（失败落盘重试队列）

### 7.2 特定动作候选池（逐个评估后立项）
- [ ] 一键快照：`/api/repo/createSnapshot` memo 自动打标（评估结论：批量写动作的前置保险，R2 新增）
- [ ] 【R3·循环C】捕获多目标路由：目标集合（日记/收集箱/指定文档）+ 前缀路由（如 `#会议` 进会议笔记本）——docs/10 §2-①，落点 docs/03 P0-1 补充
- [ ] 【R3·循环C】快查 fallback 链：全文零命中→同名 SQL→提示 AI-SQL——docs/10 §2-④，落点 docs/03 P0-3
- [ ] 周报/月报生成：SQL 统计本周日记/打卡/待办完成率→汇总文档
- [ ] 笔记统计仪表盘：文档数/字数/今日新增→notify 或统计文档
- [ ] 网页剪藏增强：选区+页 URL+页标题+选区图片组合入库（快摘增强版）
- [ ] PDF 摘录：页码+文本+siyuan:// 双链（借鉴 Zotero PDF 的 T2 闭环）
- [ ] 视频时间戳摘录：B站/播放器当前时间+文案入库
- [ ] 微信/QQ 聊天记录摘录（窗口标题识别联系人→人脉 ensurePerson 联动）
- [ ] 窗口布局保存/恢复（快门 commands.run 雷切布局命令）
- [ ] 定期自动同步守护（长循环动作，借鉴智能备份的变更检测思路，仅 performSync 不做备份）

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
- [ ] 【GH】quicker-actions/ 动作导出文件归档 + 导入说明 + 版本对应表（待 Quicker 侧动作搭出后导出）
- [ ] 【GH】CI 全绿确认 + 后续版本 tag 发版流水线
- [ ] 【GH】发布预告帖（链滴/Quicker 社区，指向 GitHub，非集市）——建议等 M0 spike 完成后再发

### 8.2 隐私与许可
- [ ] 隐私说明文档：数据流向图（本机→思源同步→AI 端点；快门不外传任何数据）
- [ ] LICENSE 最终确认（MIT，顺延小驴系）
- [ ] Quicker 动作许可选项设置（暂缓分享，导出文件内注明「可自用可修改」）

### 8.3 集市（暂缓）
- [ ] 【暂缓】Quicker 动作库上架（面板+动作单）
- [ ] 【暂缓】快门 bazaar 上架（fork→plugins.txt→PR 一次一件事）
- [ ] 【暂缓】公共子程序单独分享

> **上架门槛（全满足才启动）**：①自用满 4 周无 P0/P1 bug ②验收矩阵全绿 ③文档齐全（安装/配置/卸载/隐私）④快门确认开关+审计稳定 ⑤Token 安全自查通过 ⑥至少 1 位外部测试者成功使用。

## 9. 文档与知识管理

- [x] README 项目状态区（与 TODO 同步）
- [ ] 快门 WALKTHROUGH.md（M0 九项实证全记录）
- [x] 快门 docs/api.md（op 契约：参数/回执/错误/限制表 + 机器可读 contracts JSON docs/contracts/quickgate-api-v1.json）
- [ ] 动作使用手册（安装→令牌→首跑→错误自检）
- [ ] 故障排查 FAQ（错误码/症状→原因→解法表：401、not exist、busy、timeout、桥积压…）
- [ ] 演示 GIF/短视频（面板呼出/一键打卡/记人脉）
- [ ] 季度追更：寒Orz、浅沧系列（07 §3）
- [ ] 版本三线分记（menu schema / 桥协议 / 动作包）
- [ ] 实测结论回写 05 §7
- [ ] 快门「使用说明」入插件设置页关于区（思源内自助排障）

## 10. 联调与验收矩阵

- [ ] 四态矩阵：每动作 ×（正常/未运行/令牌无效/目标文档被删）——P0 六动作先跑
- [ ] 桥四态：桥开/关 × 思源前台/后台（confirm 场景）
- [ ] 打卡真实数据全链（快门 `checkin.items→checkin.record→checkin.summary`；无快门时再测旧桥兜底）
- [ ] 人脉真实姓名收编（重名/生僻字/空格/超长）
- [ ] editor.context 三场景（有选区/无选区/思源外 null 回退）
- [ ] 连按 3 次防抖与幂等
- [ ] 混沌：思源重启期间命令堆积→恢复后消费；内核 busy 风暴；桥文件被外部误清空
- [ ] 思源升级回归（跑全矩阵+M0①复证）
- [ ] 多工作空间同开下的桥与动作行为记录（§1.2 端口实测结论落文档）

## 11. 安全与红线（持续）

- [ ] 分享/截图前 Token、个人 ID、工作空间/用户目录绝对路径泄露自查
- [ ] plugin.api 允许名单默认仅已完成公开契约审计的适配器；新插件逐个验收后加入
- [ ] 动作不执行外部传入代码；自由文本不进 SQL
- [ ] 快门确认开关/黑名单默认值不被后续版本关闭
- [ ] statestorage 配置导出备份（换机迁移）
- [ ] 快门卸载清理验证（bridge 目录删除/无残留进程）
- [ ] AI 生成 SQL 的只读强制（P0-3 白名单）复测纳入每次动作更新

## 12. 远期/备选（记录不排期）

- [ ] 面板热路径编译 DLL 提速
- [ ] 多工作空间感知启动器（loadPetals+窗口标题+快门 ping）
- [ ] 思源 Agent 技能发布（ai/agent/skills 一份「思源操作技能」）
- [ ] 快门适配器第三方注册约定（manifest）
- [ ] 雷切悬浮球 1-9 槽位联动
- [ ] 2Anki 通道（anki-connect）
- [ ] 与 task-note-management 等任务插件作者探讨经快门桥集成（人脉 BRIDGE.md 同款路径）
- [ ] 快门上架集市 / 动作库上架+生态页（门槛满足后）
- [ ] 快门国际化第二语言（en 之外的社区翻译）
- [ ] 桥协议 v2 设计评审（若 v1.5/v2 通道落地后信封需扩展）

---

**统计**：12 组 350 项，已完成 188（2026-10-02）。未完成 162 项构成：【等实测/等思源】约 38（**内核重启后一键复测批**（`npm run verify:restart` 已就绪，含 MCP 路由检查+§10-10 日志增长测量；手工单发用 `lv-cli fast` 或 PS `-Fast`；自主层门=`npm run accept`）③⑩功能面/⑪/v1.5/MCP 路由联调/轮询刷屏读数、前端 DevTools 现场（仅剩 ④多窗口/⑦blockId/⑪事件/①可选复核）、AI 写动作实测、C# 参考件真机编译（语法级已过✓，剩 Quicker API 成员面））·【需 Quicker 编辑器】约 38（含分拣收集箱搭建）·【等上游契约/数据源】约 8（含闪念速记文件源条件项）·【暂缓/门槛后】5 · 其余为 Quicker 侧搭建明细与评估项。**可自主完成的开发项持续清零**（v0.1.0→v0.6.6 二十二个版本，2026-10-02）；兜底循环已执行六十五轮（第六十五轮：**循环A 验收入口文档同步三处**）。
**关键路径**：§1 → §2 → §3+§4 = P0 全量（2~3 天）；§5 快门完全并行（M0 半天 → M1 2~3 天 → M2 2 天）。
**发布节奏**：代码即推 GitHub；集市等 §8 门槛。
**本轮新增关注点**：系统代理拦 127.0.0.1、多空间端口、storage/local 迁移（spike⑨，可能一举消解多设备+同步流量两问题）、内核日志刷屏、命令执行超时保护、诊断包、契约 JSON、混沌测试。
