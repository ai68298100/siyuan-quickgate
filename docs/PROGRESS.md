# PROGRESS

> 迭代记录（最新在上）。与根目录 CHANGELOG 同步。

## 2026-10-07 · R335（账本待办落地：状态图例 + 诊断预览 + 台账容量可见）

- L568 部分：回执中心「状态说明」折叠图例——七类状态各给含义/下一步/安全重试规则（unknown 明示禁止盲目换 id 重试副作用操作）；首版 flex 行内 `<b>` 拆段错位，文字包 span 修正。
- L593 部分：诊断包复制前脱敏预览——弹窗展示完整 JSON（滚动）+ 脱敏边界说明，确认后写剪贴板；剪贴板实测 3669 字节 ✓。
- L605 再部分：处理台账 KPI 显示 `X / 500`（PROCESSED_CAP），≥80% 预警色。
- TODO L568/L593/L605 三条注记更新。218 测全绿 + tsc 0 错。

## 2026-10-07 · R334（账本验证与补全：320px 零溢出验证 + 向导双路径 + 生态卡入口链接）

- L588 部分：**320px 全屏扫通过（负结果也是结果）**——11 界面 × 亮暗 scrollWidth 断言零横向溢出，既有 wrap/break-all 规则已覆盖，无需修改；200% 缩放等价窄视口。
- L565 部分：向导标题下双路径说明（①外部桥需向导开启 ②不开桥可用——MCP 只读/内核路由 7 只读 op，带链接）。
- L554 部分：生态目录 stable 插件卡补「仓库 / Releases」链接（按 pluginId 推导；design 态不显示——诚实边界）。
- TODO L588/L565/L554 三条注记更新。218 测全绿 + tsc 0 错。

## 2026-10-07 · R333（账本待办落地：环境预检 + 自检证据 + 重置撤销）

- L561 部分：诊断页「环境预检」卡——三档核对（SiYuan 版本 vs minAppVersion 3.8.0 / 前端形态 mobile 警示 / 桥目录可写性探针文件 `/storage/petal/siyuan-quickgate/preflight-probe.json`）；Quicker/Token 项诚实标注"无法在本面板检查"。
- L564 部分：向导自检「复制证据」按钮——JSON {time,result,executed,receipts,elapsedMs,channel,op}，成功/失败均可复制。
- L624 再部分：重置撤销——模块级 preResetSnapshot + 状态概览页撤销横幅（accent 卡，本会话内有效）；撤销按恢复的设置重启桥；靶场端到端断言 bridgeEnabled true→false→true ✓、横幅出现/消失 ✓。
- 靶场 mock 两处补齐：broadcastSub.stop 缺失（重置流程中断的真因）、__qgDebug.settings 别名（改暴露 settingsHost，面板覆写 host.settings 属性后读它才是真实值）。
- TODO L561/L564/L624 三条 ◐ 注记更新。218 测全绿 + tsc 0 错。

## 2026-10-07 · R332（账本待办落地：复制命令信封 + 队列最老待处理 + 空态链接）

- L552 部分：命令面板条目悬停「{} 复制命令信封」ghost 按钮——宿主命令→`commands.run` 信封、能力动作→自身 op 信封（args 待填）；剪贴板实测正确（打通面板↔lv-cli/Quicker/MCP 客户端的最后一米）。scss 补 qg-palette-copy（悬停显形 ghost）。
- L605 部分：队列页 KPI 增「最老待处理」格——从 commands.ndjson 解析最早 createdAt，≥1 分钟（缺省 TTL）橙色警示「超 TTL」；靶场旧数据演示警示态 ✓。
- L590 部分：审计无匹配/收藏空态补「上手指南」链接。
- TODO 三条行内 ◐ 注记（L552/L605/L590 剩余范围明示）。
- 218 测全绿 + tsc 0 错。

## 2026-10-07 · R331（账本待办落地：重置防线索份 + 焦点回归 + role 标注）

- 快照重跑：1447 条目 / done 1235 / pending 144（全部 dev 层）——筛取与 UI 面同质可自主落地三项（L624/L585/L586 各部分，TODO 行内 ◐ 注记不虚销）。
- L624 部分：`downloadFullBackup` 抽为共享实现（队列页导出按钮补 pending 态）；「恢复默认设置」确认后先自动下载全量备份，导出失败中止重置并给手动备份指引。
- L585 部分：六个对话框面（设置/面板/恢复/审计/收藏/宿主 openDialog）全部 destroyCallback 焦点回归触发元素；靶场实测关闭后 activeElement 回到触发按钮 ✓。
- L586 部分：最近回执 role=status、通知/恢复列表 role=region、面板执行消息 role=status。
- 验证：218 测全绿 + tsc 0 错 + 零控制台错误门 44 loads + 焦点回归实测通过。

## 2026-10-07 · R330（焦点管理 + 零控制台错误门 + 交互流验证 + 重新部署）

- 焦点管理（键盘流补全）：设置面板打开即聚焦搜索条（首跑向导语境不抢焦点）；通知中心容器 tabindex=-1 并聚焦——修复键盘导航打开后收不到按键的真实缺陷；恢复中心打开聚焦刷新按钮；回执中心重复 `qInput.focus()` 清理。
- 通知容器聚焦出现黑色 outline → `#qg-notify:focus { outline:none }`（容器有蓝色边框高亮语言，outline 多余）。
- 回执中心 640 宽度头部三按钮溢出裁切 → 内容 `min-width:min(640px,92vw)` 与容器同宽致 padding 溢出撑破（nhead wrap 不触发），去 min-width 后自然容纳；`qg-dlg-head` 加 flex-wrap 兜底。
- **零控制台错误门**：22 页面 × 亮暗 44 次加载 pageerror/console.error 全零。
- 交互流截图验证：通知键盘导航（高亮跳过信息卡正确移动）、结果中心筛选（failed+doc→1 条）、审计筛选——全部符合预期。
- 218 测全绿 + tsc 0 错 + 生产构建双门过 + 重新部署主工作区（diff 逐字节一致）。

## 2026-10-07 · R329（微打磨收尾 + 生产构建部署主工作区）

- 微打磨：回执中心行补悬停反馈（`qg-card.hoverable` 规则收编进共享块）；恢复中心「已处置记录」summary 链接化（去内联样式，hover 变主色）。
- **生产构建 + 部署**：`npm run build`（clean+app+kernel）→ check-release（无 Token/路径泄露）+ check-package（kernels/双 js/zip 断言）双门过 → 部署主工作区 data/plugins/siyuan-quickgate → `diff -rq` 逐字节一致；顺带清掉工作区两个旧版残留（ecosystem-manifests-*.cjs 旧构建物 / README.zh-CN.md，新构建无引用）。**重启思源（tools/restart-siyuan.bat）后生效。**
- 218 测全绿 + tsc 0 错 + 回归截图（主批+子界面 15 张）无恙。

## 2026-10-07 · R328（交互 pending 态 + 宽度一致性 + 错误态验证）

- 按钮 pending 态：`withPending` 助手（禁用+文案切换+finally 恢复）用于桥自检三处；向导自检运行中禁用两颗按钮；命令面板执行派发期间禁用、失败恢复可重试——补齐质感规则里的 loading/disabled 态（防连点重复派发）。
- 四中心对话框宽度统一 640（openDialog/notify 容器覆写/results min-width/eco 四处），命令面板保持 620（面板惯例偏窄）。
- 错误态截图验证三例：向导自检失败、面板必填校验（红框+禁用执行）、设置搜索空态——全部符合设计语言，无需再修。
- 218 测全绿 + tsc 0 错。

## 2026-10-07 · R327（状态页主次重构 + 首跑语境 + 暗色子界面验证）

- 状态页「下一步」五钮平铺换行孤行 → 通知/恢复中心收进卡头右侧小按钮（带计数徽章），主行只留主动作；原型 ① 同步该排布。
- 首跑向导期间隐藏顶部搜索条（show() 挂 qg-firstrun 类，跳过向导即恢复）。
- 靶场补 `&off=1` 桥关闭态与向导开启态（点开关）截图：关闭态卡片「已停止/关/未接」灰点语义、KPI 占位、下一步文案切换均正确；暗色子界面全批（审计/收藏/生态/捕获/确认）可读性达标。
- 218 测全绿 + tsc 0 错。

## 2026-10-07 · R326（捕获链路/窄屏/恢复中心收敛 + 靶场扩展）

- 靶场扩展（subshots.mjs）：捕获去向/成功卡链路、恢复中心已处置折叠块、悬停态（nav/行/面板条目）、窄屏 420px（设置+面板）、暗色子界面批。
- 修复：捕获去向选择加内容说明与去向语义脚注；捕获成功卡主次颠倒（#qg-capture* 补入 qg 作用域——思源 .b3-button 裸默认即蓝实心，「再记一条」改唯一主按钮）；窄屏设置行两段式（ctrl 通栏+图标收起，修 label 竖排断行）。
- 排障：恢复中心「已处置记录」未显示系靶场 mock 契约错（宿主 loadData 返回已解析对象，mock 返回字符串被 normalize* 回落空——同时解释台账假 0）；mock 修正后折叠块/过滤双态实证正常，生产代码无恙。
- 218 测全绿 + tsc 0 错；通知中心全净空态确认有「一切正常」兜底条目（无需另修）。

## 2026-10-07 · R325（子对话框观感收敛：审计/收藏/生态目录/面板表单态）

- 子界面首轮截图评估（tmp/ui-harness/subshots.mjs：审计/收藏/能力目录/面板表单态/空态兜底/设置搜索/确认框）——审计与收藏两对话框是最大洼地（完整 ISO UTC 串、无样式语义、行结构松散）。
- 修复：审计行重排（`fmtLocalStamp` 本地时间戳/状态 chip/等宽耗时/悬停复制）；收藏重排（★↺ 着色、标题主行、时间本地、清空 danger 化）；生态目录 `stripDevNotes` 净化维护者注记（R2xx/Lxxx）+ 卡片排版；面板表单字段样式移入 #qg-palette 块胜出大搜索框特异性 + 切表单 scrollTop 重置；空态「捕获」主色化；清空队列预览时间本地化。
- 218 测全绿 + tsc 0 错；主界面回归截图无恙。

## 2026-10-07 · R324（UI 原型对齐第二轮：靶场截图收敛 + 原型补新屏 + 提交轮）

- 独立靶场 `tmp/ui-harness/`（gitignored，不混入插件产物）：esbuild 打包真实 UI 代码 + siyuan 模块替身（Dialog DOM 对齐真机 bundle）+ 内存 mock host + 本机安装真实 base.css/daylight/midnight 主题；Playwright 亮暗全量截图逐项比对原型。
- 修复九项（原型 vs 现状）：qg 作用域 border-box 缺失（真机必现的 KPI 第 5 格爆版）；回执时间 UTC 错位五处（`fmtReceiptTime`/`fmtElapsedMs` 落 src/results-center.ts 供四中心复用）；命令面板星钮/分组头补样式 + 行密度 32px；通知中心键盘高亮错位（信息卡排除出序列）；队列回执表补 thead；暗色 chip 对比度（混 on-background 双主题自适应）；连接页首开关 focus 环；「关闭中」→「未开启」；L471 内部标注泄漏。
- 原型 mvp1.html 补 ⑤命令面板/⑥通知中心/⑦恢复中心/⑧回执中心四屏；既有四屏同步搜索条/快速捕获/备份卡/按钮组。
- 顺手拆弹：results-center.test.ts `since` 用例固定时钟——本地午夜后 1h 内运行 today 断言必挂（R47 同型，00:04 实爆）。
- README 双语补「插件内 UI」节 + 路线行 + 测试数 218；CHANGELOG Unreleased 聚合 R288~R324 UI 批。
- 218 测全绿 + tsc 0 错 + 版本/manifest/文档数字三门过；视觉验收 18/18 pass（2 minor 判定优于原型保留）。

## 2026-10-06 · R323（UI 质感打磨：原型对齐收敛）

- 图标 fill 修复（思源全局 svg{fill:currentcolor} 压过 fill="none"）；按钮体系 quiet/primary/danger/ghost 对齐原型；共享组件提升到根级（修复结果中心无样式裸奔）；开关 36×18；搜索条降权；四中心统一 qg-dlg-head；动效 token 统一。新增 e2e/ui-preview.mjs 截图基线（19 张）。
- 218 测全绿；主工作区已部署。

## 2026-10-06 · R322（R9-A 全量备份/恢复接入）

- 队列页备份卡：导出五载体 JSON / 导入 normalize* 校验链 + 确认覆盖 + 桥重启；接线 bug 修复。e2e/backup-roundtrip.mjs 10 项硬门全绿（破坏现场→导入→恢复→桥自愈→内核路由 ping）。踩坑：petal 写入触发前端插件重载瞬态；exec 路由无 /api 前缀。
- 218 测全绿；主工作区已部署。

## 2026-10-06 · R307（搜索跳转 + 表单 Enter）

- 设置搜索分组头「进入分组 →」跳转（groups 携 id）；能力动作表单文本字段 Enter 直执行。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R311（面板收藏闭环）

- 命令面板条目 ★/☆ 切换收藏（favorites.add/remove 完整簿记 + 本地即时更新）；真机闭环。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R310（L553 广播观测指标）

- BroadcastSubscriber metrics（connects/reconnects/received/lastEventAt）；状态页广播卡显示已收条数；诊断包含 broadcast 段。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R309（跨面交互细节批）

- 恢复中心「复制原命令」；通知中心刷新按钮；结果中心聚焦搜索；能力表单错误字段红框高亮 + Enter 执行。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R321（JSON 导出 + 再记一条 + 调研 R9）

- 结果中心 CSV/JSON 双格式导出；捕获成功卡「再记一条」重开面板；调研 R9（数据备份范式）立项 R9-A 全量导出/导入。
- 213 测全绿；主工作区已部署。

## 2026-10-06 · R321（JSON 导出 + 再记一条 + 调研 R9）

- 结果中心 CSV/JSON 双导出（exportAs 统一）；捕获成功卡「再记一条」；调研 R9（数据备份范式）立项 R9-A 全量导出/导入。
- 214 测全绿；主工作区已部署。

## 2026-10-06 · R320（通知失败聚合卡）

- 通知中心「最近 24h 失败命令」聚合卡（warn→审计队列）；+1 测；真机内存注入验证。
- 214 测全绿；主工作区已部署。

## 2026-10-06 · R319（依赖维护 + 回归验证）

- 同主版本安全更新（vite 8.3.2/sass/js-yaml/@types/node/svelte-plugin/livereload）；typescript 7/coverage-v8 5/siyuan SDK 1.2.9 三个 major 暂缓专项验证。
- 更新后全门绿（tsc/210 测/check 链/数字门禁）+ 靶场状态页截图复验；主工作区已部署。

## 2026-10-06 · R308（循环 A 全局巡查）

- pnpm audit 零漏洞；无面上 console.log；yaml-plugin.js 确认为活跃 i18n 插件保留。
- 清理：bundle-err.txt 删除；e2e-report.json（e2e-bg 运行时产物）untrack+gitignore。
- 210 测全绿；check 链通过。

## 2026-10-06 · R306（G0-02 数字门禁脚本化）

- scripts/check-doc-numbers.mjs：op/工具/只读三类声明以代码为事实源自动核对（内核子集白名单、→ 历史数字不误报）；接入 pnpm check 链。

## 2026-10-06 · R305（R8-A 恢复中心批处理）

- 候选复选框+全选+批量放弃（逐条台账）；已处置记录折叠可回溯（GitHub Done 语义）。
- 踩坑三连：裸 checkbox 被思源样式隐藏（显式恢复可见性）；select-all 包 label 双 toggle；minified TDZ（改函数声明提升）。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R304（捕获目标显式设置 + 调研 R8）

- 连接与通道页增「快速捕获默认去向」下拉，与面板选择器共享字段双向同步（实测）。
- 循环 C 调研 R8（通知/收件箱范式）→ 立项 R8-A 恢复中心批处理；静默时段不立项。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R303（G4-02 移动宽度修复）

- 8 类对话框宽度改 min(Npx, 92vw)（含 min-width），修复移动端固定宽度溢出；Pixel 7 仿真 settings/palette/recovery 零横溢。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R302（G5-01 结果中心）

- results-center.ts 数据面（解析/筛选/分页/枚举）+ results-center-ui.ts 对话框（状态下拉/关键词防抖/每页 50/逐条复制）；入口=队列页按钮。
- 210 测全绿（+10）；主工作区已部署。

## 2026-10-06 · R317（一致性终检）

- 全局扫描：色值/文案/死导出；结果中心改新→旧展示（pageNewestFirst 启用，真机时间序实证）。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R316（搜索兜底 + 通知最近成功）

- 设置搜索无匹配 fallback 按钮行（诊断包/上手指南）；通知中心「最近成功」信息卡；deps 类型收紧 BridgeServiceDeps。
- 213 测全绿；主工作区已部署。

## 2026-10-06 · R315（G0-01 状态页 + 通知键盘导航）

- scripts/current-status.mjs → docs/current-status.md 自动快照（git/dist/版本/通道/入口，离线聚合，npm status:snapshot）；通知中心 ↑↓/Enter 键盘导航。
- 213 测全绿；主工作区已部署。

## 2026-10-06 · R314（查询深化三件）

- 结果中心时间范围筛选（filterReceipts since 参数 +5 测，CSV 同源）；恢复中心刷新按钮；审计「导出筛选」。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R313（审计分页 + 文档数字同步）

- 审计对话框「加载更多（+20）」递进展开 + 命中/显示计数常显；README×2/AGENTS/mcp README 陈旧测试数同步 210。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R312（结果 CSV 导出 + 移动面板收尾）

- 结果中心导出当前筛选 CSV（UTF-8 BOM、引号转义，下载真机实证）；移动端面板 ≤640px 收起副标题/快捷键。
- 210 测全绿；主工作区已部署。

## 2026-10-06 · R301（捕获目标记忆）

- settings.captureTarget（枚举校验 +1 测）；面板选择器按上次选择排序标注，选择回写落盘。
- 204 测全绿；主工作区已部署。

## 2026-10-06 · R300（G5-02 通知中心 MVP）

- notification-center.ts 聚合五源（退避/待恢复/积压/迟到/桥关，严重度排序）+ notification-center-ui.ts 通知对话框（动作跳转恢复中心/队列/连接设置）+ 状态页计数徽章。
- openQuickGateSettings 支持初始页直达；QuickGatePlugin 公共面补齐。
- 203 测全绿；主工作区已部署。

## 2026-10-06 · R299（捕获目标二选一 + 诊断分账）

- 捕获目标二选一（今日日记/收集箱）：captureQuick + 面板去向选择器 + 原文操作复用；bash curl 编码坑（UTF-8 经 GBK 双编码）实测记录。
- L653 收尾：readMetrics 五分类进诊断包。
- 200 测全绿；主工作区已部署。

## 2026-10-06 · R298（R7-A 原文操作 + 搜索防抖）

- 捕获成功结果卡：块 id/文档 id 展示 + 打开今日日记（openTab 实测）+ 复制块引用；appendDailyNoteBlock 返回形状真机实证。
- 设置搜索 150ms 防抖（逐键全量重建四分组页的可省开销）。
- 200 测全绿；主工作区已部署。

## 2026-10-06 · R297（设置搜索 + 面板默认热键 + 调研 R7）

- 设置跨分组搜索（构建-抽取式，行监听器保留；首版漏清残留被截图抓出即修）。
- 命令面板默认热键 Ctrl+Alt+P；循环 C 调研 R7（快速捕获范式，立项 R7-A 原文操作）。
- 200 测全绿；主工作区已部署。

## 2026-10-06 · R296（命令面板参数化二段式）

- 能力动作分组（9 精选 op）+ schema 驱动参数表单（ARGS 单一事实来源）+ dispatchOp 完整簿记执行；真机诚实回执实证（G3-02）。
- 踩坑：Mimosa 对 execute( 调用行误报 SQL 注入拦截——改名 runEntry；列表渲染改 DOM API 免转义。
- 200 测全绿；主工作区已部署。

## 2026-10-06 · R295（快速捕获进面板 + 移动端布局修复）

- G3-04：面板无匹配兜底首位=快速捕获到今日日记（discoverConfig+appendDailyNoteBlock，失败保留文本）；真机捕获成功实证。
- G4-02：修 .qg-main 窄屏横向 flex 挤压 + 下一步按钮行 wrap；Pixel 7 仿真无横溢。
- 197 测全绿；主工作区已部署。

## 2026-10-06 · R294（G5 恢复中心 MVP）

- recovery.ts 数据面（候选合成/重试信封）+ recovery-center.ts UI（查询/重试换新 id/放弃并记录/复制）+ resolved.json 处置台账；入口=设置状态页（计数徽章）与队列页。
- 实机端到端验证（含"活桥立即消费注入命令"的语义正确性观察）；197 测全绿；主工作区已部署。

## 2026-10-06 · R293（L653 契约 + G3-01 命令面板 MVP）

- L653：kernel-http.md 契约文档（信封/202 怪癖/五分类表/分账/写路径纪律）+ KernelApi.readMetrics 分类计数。
- G3-01 命令面板 MVP：command-palette.ts（别名过滤/收藏最近置顶/键盘导航/fallback 三兜底/确认门控复用）；启动竞态自动重探；191 测全绿。

## 2026-10-06 · R292（MCP 加固批：L562/L560/L555/L553）

- 参数校验前置：schema 驱动 validateArgs，-32602 与执行失败分离（不再消耗队列槽位）。
- stdio 并发闸（上限 4，超限 -32000）；ReceiptHub 共享回执监视器替换逐调用轮询；客户端通道指标。
- MCP README 三节同步；29 文件 186 测全绿；build:mcp 通过。

## 2026-10-06 · R291（G1 运行时正确性批 + 循环 C 调研）

- L655 执行状态机：ProcessedStore v2（pending/done，v1 自动迁移）+ reserve 落盘预约 + 假死扫描发 unknown 回执（不重放不静默，附人工核对路径）；BridgeStatus 增 unknown；4 组新测试。
- L654 核对销账（确认窗与执行上限已分离）；L549 队列载体占用显示；L554 统计跨重启快照（bridge-stats.json，tick 节流回写 + onunload 兜底）；L548 论证销账（cap 即保留策略）。
- 循环 C 调研 R6（命令面板范式）→ 立项 2 条【评估】；179 测全绿。

## 2026-10-06 · R290（原型↔实机逐页审计修复）

- 全矩阵截图审计（六页×亮暗+向导）后修复：对话框头部品牌化（logo+版本胶囊，首跑变体）、壳层常驻页脚（帮助+隐私）、安全页名单通栏等宽编辑、去版本冗余、aria-current、状态卡悬停阴影、KPI 字号对齐。
- 暗色排障记录：modeOS（跟随系统）会覆盖 setAppearanceMode，需 setAppearance 关闭。
- 175 测全绿；主工作区已部署。

## 2026-10-06 · R289（设置面板微观质感精修）

- 无闪烁刷新（内容差分）、开关行整行点击、语义色回执徽章、复制按钮悬停显现、骨架屏、状态点呼吸、导航激活指示条+品牌块、各页副标题、危险区淡染、细滚动条。
- 动效全体系并尊重 prefers-reduced-motion（G4-04）；暗色由 b3 令牌结构自适配。
- 靶场实机截图复验；175 测全绿；主工作区已部署。

## 2026-10-06 · R288（MVP-1 原型图 + 分层设置面板）

- 高保真原型：design/ui-prototype/mvp1.html（四屏、b3 实测令牌、亮暗切换、可交互演示）。
- 实现：设置面板重写为 settings-panel.ts 分层面板（状态概览/首跑向导/连接/安全/队列/诊断/关于），样式入 index.scss；既有行为与可达性基线全保留。
- 修复：内核路由探针在重写中丢失已补回（L505）；store.firstRun 判定修正（loadData 缺失返回空串非 null，+2 单测）。
- 靶场实机亮暗截图与原型比对通过；175 测全绿；主工作区已部署。

## 2026-10-06 · R287（e2e 内核防呆 + 隔离靶场）

- 按小驴考试同款约定加固：scripts/lib/smoke-kernel.mjs（目标参数化/防呆/清扫/AI 开关）+ 三脚本分类改造 + scripts/smoke-range.mjs 靶场启动器（独立 workspace、只装快门、可带前端载体）。
- 踩坑入册：优雅退出会写回 conf 覆盖 trust 补丁（先强杀再改文件）；新工作区 petals.json 缺条目插件不装载；思源空库自动补建 My Notebook 且删后即重建（列中性样板豁免）；隐藏页定时器节流把桥轮询拖到分钟级（载体禁三类节流）。
- 验收 a/b/c/d 全过；AGENTS.md 增「冒烟/e2e 内核防呆与隔离靶场」运行约定。

## 2026-10-06 · R285~R286（独立 e2e 走查 + G1 开发批）

- 入口修复（R284 openSetting 覆写）经独立 e2e 实证：hasPluginSetting 判据翻转、设置面板渲染、顶栏插件菜单含快门项。
- M2 视觉走查落地：e2e/visual-walkthrough.mjs（playwright chromium 直连内核 serve 模式，锁屏 loginAuth 过闸，暗色 setAppearanceMode 翻转复原）——R270 疑问闭环：独立 Chromium 可完整启动思源 Web；硬门 6/6、7 截图、移动结构达标（dialog 390 无横溢、switch 44×24）。
- G1 批：L652 错误分类（共享分类器 file-read.ts，前端+内核同口径，内核侧 bug#12 同型洞一并堵上）+ L657 planId 并发唯一；173 测全绿。
- bug#15 补充实证：web 前台无插件热重载路径（变更字节部署 18s 无 reload），死桥为 Electron 模块缓存特有。
- 跨插件发现：siyuan-exam 在 browser-desktop boot 抛 TypeError；siyuan-home 的 settings.json 磁盘损坏（各自仓库线跟进）。

## 2026-10-05 · v0.7.5（当前源码/候选发布线）

- 发布链补强：package.zip 解包断言、Agent 集成指南、重启工具、版本/包结构检查。
- 当前本地验证：`pnpm check` 通过；26 个测试文件、163 个测试通过；协议冒烟在无思源有效 Authorization 时为 6/7，真实 `bridge.ping` 需鉴权环境，不能记为全绿。
- 远端 v0.7.5 为 prerelease；v0.7.2 仍是当前正式 Latest。开发分支、tag Release 和本地未发布构建分开记录。
- 详细产品取舍与后续执行泳道见 [产品评审与执行路线](../design/docs/31-产品评审与执行路线-2026-10-05.md)。

## 2026-10-03 · v0.7.3（R69 池清账八处修复 + 真机批 10/10 全绿 + bug#11/12/13）

- R69/R70 池清账 13 条：超时重复派发、workflow 单步超时、外层超时竞争、events.pull 双路径、过期信封台账、诊断包统计、广播订阅创建、事件订阅生命周期、plugin.api args 契约、single-flight、死代码 api.ts 删除、版本门禁 check-version.mjs
- **真机批**（思源全自动重启×4 + 部署）：verify:restart **10/10**——③桥 289ms/⑩路由/MCP 路由 621ms/**⑪事件物化闭环**（checkin.record→events.ndjson→events.pull 11ms）/**v1.5 快路径 146ms**/MCP 冒烟 6/6
- **bug#11** 信封不完整行凭 id 逃过压缩（真机 33 条重复回执）→ compactCommands 按信封完整性分类
- **bug#12** 3.8.6 缺失文件返回 HTTP 202+错误信封 → getFileText 正文识别
- **bug#13** vite CJS JSON 动态 import 裸 require 渲染进程必炸（前端 manifest 路径长期潜伏）→ 静态 import 内联，chunk 消除
- 114 单测（+8）；版本门禁进 CI check 链；PLUGIN_VERSION 三处一致性

## 2026-10-03 · v0.7.2（bug#10：广播订阅断连自愈）

- 退避上限 5s + MCP 快路径 3s 无回执同 id NDJSON 补发（预留语义防双执行）；99 单测

## 2026-10-02 · v0.7.0（MCP stdio 代理 + 三通道定位，面向发布）

- src/mcp/ 四件（tools/client/server/main）+ 参数 schema + 内核路由通道 + mcp-smoke 冒烟；README 双语三通道重写；repo desc/topics 更新
- 验收入口收敛 npm run accept / verify:restart；98 单测 + 冒烟 6/6；发版同轮 CHANGELOG+PROGRESS

## 2026-10-02 · v0.6.6（审计历史跨重启恢复 + 测试定时炸弹拆除）

- bug#8：audit.json 只写不读 → onload loadAudit 恢复（逐条校验+截尾），消除重启后历史静默销毁
- workflow 两用例补固定时钟（现实时间越过测试内硬编码 expiresAt 时误爆）
- 存量 settings 兼容性实证（缺字段回落默认，广播=关）；97 单测全绿；发版同轮 CHANGELOG+PROGRESS

## 2026-10-02 · MCP stdio 代理两个增量（Unreleased，随仓库分发）

- 第一增量：src/mcp/ 四件（tools/client/server/main）；23 op→tools 契约映射（只读13/写10）；默认只读+LV_MCP_WRITE 门控；8 单测+裸 Node 烟测（握手/写拒绝）
- 第二增量：逐 op 参数 schema（ARGS 表 23 项全登记+纪律测试强制）；写模式烟测 required 穿透
- 95 单测全绿；e2e（真 AI 客户端+插件消费）待复测批

## 2026-10-02 · v0.6.5（M2 尾巴：审计导出入口）

- 设置页"导出审计 JSON"：完整 auditLog → 剪贴板（schemaVersion/exportedAt 包裹）
- 同轮健康核查：CI 三跑全绿、发布资产可达、上游三版本零漂移
- 86 单测全绿；发版同轮更新 CHANGELOG+PROGRESS

## 2026-10-02 · v0.6.4（陈旧对冲注释清账）

- src 五处"待实证/待校准"注释按实证结论刷新；registry 降级原因（桥上可见）改为真实可达性措辞
- 纯文档性变更；86 单测全绿；发版同轮更新 CHANGELOG+PROGRESS（R28 教训执行）

## 2026-10-02 · v0.6.3（registry 快捷键读宿主生效键 customHotkey）

- bundle 静态核实（本机 3.8.5 安装产物）：Plugin 基类挂载 i18n/displayName/commands ✓；addCommand 以 langKey 解析后回写 hotkey=默认/customHotkey=生效，解析失败者移出 commands
- accelerator 优先级修复 customHotkey > hotkey > hotkeys[]（+1 测试）；spike② confirm 30s 兜底必要性坐实
- WALKTHROUGH ①② ⬜→✅；86 单测全绿；已部署工作空间 + GitHub pre-release

## 2026-10-02 · v0.6.2（editor.context docId 主路径修复）

- bug#7：data-doc-id 在 bundle 中不存在（仅 data-doc-type）→ docId 主路径改 `.protyle` 容器自带 `data-node-id`（rootID），`.protyle-title` 降为 fallback；rootTitle 优先 `.protyle-title__input`
- spike⑦ ⬜→◐；确立"grep 本机安装编译产物"前端假设证据法

## 2026-10-02 · v0.6.1（config.discover 真机校准）

- 非默认模板优先层（3.8.5 出厂默认模板字面量比对；实测 17 笔记本 16 默认+1 自定义 → 自定义者直接命中，无需等今日日记）
- 只读实测：readDailyStatus SQL ✓、renderSprig ✓、listDocsByPath 形状 ✓（data:null 已防护）
- 单测 15 文件 85 用例全绿；check/build 全绿；已重新部署工作空间

## 2026-10-02 · v0.6.0（v1.5 广播快路径）

- BroadcastSubscriber：SSE 订阅 qg-cmd 频道 → executeAndRecord 毫秒级执行；AbortSignal 停止；指数退避重连；broadcastEnabled 独立开关默认关
- 预留语义：tick 与广播共用幂等台账，check+mark 同步原子防双执行；expired 分支补回 receipt 返回
- 测试池统一 forks（threads 下流式假件挂起 worker，根因=假件零延时 sleep 饿死宏任务）；84 用例全绿

## 2026-10-02 · v0.5.9（真内核实证 + config.discover 修复）

- 内核 3.8.5 @6806 实证可达；快门部署进工作空间并启用（桥默认关）
- Fixed bug#6：dailyNoteSavePath 驼峰 + 默认模板歧义两级消歧（前端/kernel 同步，测试覆盖）
- spike 内核侧完成：⑥⑧⑨⑩⓪ 实证回填 WALKTHROUGH（安全基线 401 ✓）
- 单测 79 全绿；check/build 全绿

## 2026-10-02 · v0.5.8（命令注册表探测修复）

- Fixed：ICommand 身份=langKey（旧读 command/id → 全部命令被跳过、列表为空）；多回调形态支持（callback/execute/globalCallback 可执行，editor/dock/fileTree 标 focusOnly 诚实拒绝）；标题 i18n 代取；hotkeys[] 兼容
- registry 单测 +5；全仓 14 文件 78 用例全绿；check/build 全绿
- WALKTHROUGH spike① 同步（静态已钉，真机校准 displayName/i18n 细节）

## 2026-10-02 · v0.5.7（适配器签名全面审计）

- 审计记录 vs 上游 v18.16 源码：queryItems/getItems/CheckinItem/人脉 recordInteraction 一致；三处不符已修（source 非法归一→显式 api、occurredAt 单条被忽略→路由 recordEventsBatch+BatchEntryResult 映射、getStreaks 数组形状→归一映射+streaksLongest）
- 人脉 v1 侧审计干净
- 单测 13 文件 76 用例全绿；check/build 全绿

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
