# Changelog

所有显著变更记录于此。格式参考 Keep a Changelog；版本遵循 SemVer。

## v0.9.0 · 2026-10-08（UI 全面打磨 · 真机交互回归 · 撤销误报修复）

### Fixed
- 捕获撤销写入在内核删除成功后仍误报「撤销失败」（靶场 E4 实测抓出）：撤销处理器把 kernelApi.post 的返回（成功时为解包 data）误当 `{code}` 信封判定，`undefined!==0` 恒判失败——用户会以为撤销没生效而手动残留测试块。修复为按 then/catch 判定成败；网络拦截断言 deleteBlock code=0 且块真删，交互 e2e I6b 转绿。
- 窄屏（≤520px）走查（R131 清单 320/375px 项首次实测）发现并修复四处破损：①状态概览通道卡在两列网格下卡名/徽章竖排断字——窄屏改单列；②通知中心动作按钮溢出右缘裁切——卡片改类承载并窄屏两行化（首行徽章+按钮、次行正文；body 自我压缩不触发换行的坑一并处理）；③恢复中心按钮组溢出——按钮组可换行右对齐；④恢复中心/桥恢复向导内容 `min-width:min(560px,92vw)` 在窄屏等于视口宽，叠加宿主 padding 直接顶出容器（右缘裁切根因）——移除（桌面端 dialog width 本就 ≥560，行为不变）。另：设置面板窄屏回执/载体明细表改横向滚动替代 mono 文件名 mid-word 破字；向导步骤标签窄屏缩一档。
- 设置对话框直接关闭时，状态页的 3 秒轮询定时器不随销毁清理（只在切页路径清理）——留下每 3 秒空转的泄漏定时器；destroyCallback 现在统一停表。
- 设置搜索结果补命中高亮（与命令面板同语言）：行标签内命中片段主题色加粗，用户能看出每条结果为何命中；只拆分标签首个文本节点，chips 与读屏绑定不受影响。
- 对比度证据化巡检（新工具 tmp/ui-preview/contrast.mjs：解析亮/暗主题真实变量，按 SCSS color-mix 配方合成后算 WCAG 比值）：5 项文字/背景配对不达标已修——chip 三色文字/底配方重定（60/56/70%，底降至 10/10/9%）、主色强调文字（面板活动行/命中高亮/导航活动项/chip.info）收敛为 --qg-accent-text（primary 62%→on-background）、错误文字收敛为 --qg-error-text（error 76%→on-background）。修正后两主题全部文字配对 ≥4.5:1；主按钮 4.24:1 为宿主全局样式（保持全生态一致，记录为平台继承项）。
- 对比度巡检补漏（第二轮）：primary 作为文字色的残留用法全部收敛到 --qg-accent-text——向导当前步文字与球内数字、步骤球 hover、页脚链接、面板活动行收藏星、qg 根内宿主 b3-link 链接（向导/生态/审计等处的内联链接）、向导「全部设置」跳转（暗色 primary 文字 3.57:1 不达 4.5）；边框/焦点环/色点等非文字用法保留原生 token（≥3:1 达标）。
- 命令面板与参数表单：中文输入法组字中的 Enter/Esc 不再误触发执行/关闭（isComposing 守卫）——此前用输入法确认候选词会连带执行命令或提交表单。
- 回执中心「导出 JSON」按钮未绑定处理器（点击无响应的死按钮）——补齐：按当前筛选导出 JSON 文件，与 CSV 同源。

### Changed
- 交互 e2e 补全覆盖：I7 能力动作二段式真机执行（接管消费权 → daily.status → recorded，并实证只读 op 无确认门控）与 I8 inbox 路径捕获+撤销闭环——至此面板全部核心交互（键盘/两段 Esc/二段式/捕获双路径/撤销）均有真机断言。
- 新增 e2e/ui-interactions.mjs（隔离靶场专用写型 e2e，guardScratch 拒共享内核）：真机行为验证近几轮交互改动——两段式 Esc（真机确认 stopPropagation 拦截成立）、面板键盘导航 + aria 同步、设置搜索命中高亮、「已自定义」边标实时刷新（同节点探针证明无整页重渲染）、通道卡下钻、捕获全链。首轮真机 10/10 硬断言通过；并据此发现既有缺陷「捕获撤销 daily 路径失效」已登记 design/TODO.md（非本轮引入）。
- 术语统一（用户可见口径）：「结果中心」按钮与提示文字统一为「回执中心」——原型 ⑧ 定名即回执中心，此前同一界面两个名字（点「结果中心」进去标题却是「回执中心」）；代码内标识符（results-center 等）不变。
- 设置行「已自定义」标记实时刷新：改动保存后该行边标当次立现/消退，不再需要重进页面（经确认框放行的危险开关除外）。
- 捕获成功卡去除维护者台账行号泄漏（「L566：」）——与 docs/33 同类的文案口径治理；全仓扫描确认其余台账引用均在代码注释内。
- 上手指南（GETTING-STARTED）顶部嵌入当前 UI 预览图（../preview.png，GitHub 与发行包路径均可达），并修正文档漂移：入口「设置 → 小驴快门 → 基础连接」实为「连接与通道」。
- 无障碍基线自动巡检落地（预览 harness 新增 a11y.mjs：15 个屏静态扫无名按钮/无标签输入件），修掉巡检发现：审计日期输入补 aria-label、隐藏备份文件输入件命名。
- 首跑向导已完成步骤球补键盘可达（role=button + tabindex + Enter/Space 回跳）；状态概览回执表补视觉隐藏表头（读屏可读列语义）；清理导航品牌块死 CSS。
- 状态概览通道卡可点击下钻（外部命令桥/广播→连接与通道，事件物化→队列与数据，内核路由→诊断与生态）：hover 显形 → 箭头，role=button + Enter/Space 键盘同效（Raycast「万物可导航」）。
- 市场预览图 preview.png 更新为当前 UI 真实渲染（2200×1640 @2x，脱敏样例数据）——此前为旧版界面截图。
- 设置行「已自定义」指示（VS Code Modified 范式）：与默认不同的行左侧主色细杆 + 悬停说明，覆盖连接/安全页全部 9 个设置项；关于页恢复默认卡动态显示「N 项设置与默认不同」，重置前知道会丢什么。
- 队列页 KPI 与载体明细卡骨架先行，数据就绪原位填充——消除异步两段内容突然下移；明细统计失败给原因与出路而非永远转骨架。
- 设置搜索「进入分组 →」跳转后回焦搜索框（键盘流不中断）；审计筛选行窄屏换行；环境预检结果补 aria-live。
- 命令面板融合启动器范式（依 10-生态调研-R6 的 Raycast/Alfred 锚点补表面质感）：搜索命中片段主题色高亮（DOM 分段构建免注入，最长关键词优先）；底部上下文键位提示条随列表/空态/参数三阶段联动（同时让 ☆ 收藏与 {} 复制信封有恒定可发现的入口）；键帽加下缘一档厚度；截断标题/副标题补原生 tooltip。
- 命令面板：匹配高亮扩展到副标题（op/插件名）——英文搜索词只命中 op 或插件名时同样可见匹配原因；两段式 Esc（有词先清词并拦住宿主关闭，空词才关面板，Raycast 同款）。
- 首跑向导补后退路径：步骤 2~6 常驻「上一步」，已完成步骤的圆球可点击回跳（未到步骤不可跳，保持步骤依赖）。
- 设置侧导航支持 ↑↓/Home/End 方向键漫游（Tab 到导航后无需连打 Tab 扫分组）。
- 首跑向导步骤 6「写入测试块」补 pending 态防连点（真实写入，双击会双写）。
- 命令面板参数表单：校验失败时聚焦并滚动到问题字段（长表单下错误信息在底部不可见）；字段 label 改 label/for 关联，点标签即聚焦；执行中字段内 Enter 不再重复派发（防重入）。
- 防连点：恢复中心重试/放弃（写动作）处理中按钮失效；面板收藏星簿记在途忽略重复点击。
- 按实际行为命名：剪贴板类按钮由「导出审计 JSON/导出筛选」更名「复制审计 JSON/复制筛选 JSON」，消除「导出=下载」预期落差（回执中心 JSON/CSV 为真文件导出，维持「导出」）。
- 加载语言补齐：回执中心与通知中心初次载入补骨架屏（与状态概览/恢复中心一致）。
- 命令面板对齐原型行语言：宿主命令行快捷键移到插件名之前；列表区加水平内边距，行高亮块不再贴容器边缘。
- 设置面板：回执表数字/时间列右对齐（含载体明细）；开关两态旋钮统一白色+微阴影；状态概览「下一步」中 op 标识改等宽字体；首跑向导副标题去除维护者行话。
- 命令面板参数二段式：表单阶段搜索框转为只读降透明并改占位文案，明示「返回后可重新搜索」。
- 子对话框头部统一 logo 语言：审计日志（附条数胶囊）/ 收藏与最近使用 / 生态能力目录；内边距统一 14/16；生态目录状态行由彩色圆点文本改为状态徽章。
- 桥恢复向导去除双标题（原生头留空随宿主隐藏，保留内容区单一头部）。
- 裸复选框统一 15px + 主色 accent（R305 从恢复中心扩展到向导能力勾选与备份导入分组）。
- 触屏（pointer: coarse）无 hover：悬停显形的复制/信封按钮改为常显，功能可发现。
- 通知中心新增全空态文案（一切正常时不再显示空白面板）；队列页最近回执表补载入骨架屏。
- 原型 mvp1.html 补录 ⑨ v0.8.x 新增件（载体明细 / 回执状态图例 / 环境预检 / 桥恢复向导），spec-note 同步 v0.8.x 口径。

## v0.8.8 · 2026-10-07（桥生命周期竞态与设置页无障碍）

### Fixed
- 串行化桥的 start/stop/restart，避免快速关开或修改轮询间隔时旧消费锁尚未释放导致桥永久停机。
- 接管超时后若 Web Lock 迟到授予，立即释放迟到锁，避免消费权永久被占用。
- 停止事件桥时使排队中的事件物化任务失效；设置页搜索框和行内控件补齐读屏名称关联。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.7 · 2026-10-07（命令面板键盘执行与构建清理）

### Fixed
- 命令面板超过 100 条命令时，能力动作和空态 fallback 的 Enter 执行偏移改用实际渲染数量；键盘和读屏导航可执行已显示动作。
- 移除设置面板自引用动态导入，生产构建不再报告无效动态导入警告。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.6 · 2026-10-07（生命周期停机与热重载一致性）

### Fixed
- 停止桥时等待正在执行的 poller tick 完成后再释放消费锁，避免热重载期间旧实例继续写回。
- 卸载时等待桥停止和审计 flush，再保存运行统计；失败 tick 不会阻塞释放消费权。
- 热重载旧实例完成释放后补偿启动新实例，并以 `tornDown` 防止停用实例复活。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.5 · 2026-10-07（SSE 断流边界与空态无障碍）

### Fixed
- 修复 SSE 在 EOF 前没有换行时最后一条 `data:` 命令被丢弃的问题，并避免显式停止时误消费残留尾帧。
- 修正广播连接指标：只把成功取得可读 SSE body 的连接计入 connects。
- 命令面板空态 fallback 补齐 `role`、稳定 id、`aria-selected` 与 `aria-activedescendant`，让键盘活动项对读屏可见。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.4 · 2026-10-07（广播可观测性与 E2E 隔离）

### Added
- 广播快路径记录连接、帧、丢弃、错误、重连和最近事件/错误时间；消费回调异常不会中断后续 SSE 帧。
- 健康快照加入 SSE 丢帧数，并按当前会话过滤审计事件；设置页和命令面板诊断均可复制健康快照。
- 命令面板空态按钮支持 ↑/↓ 选择与 Enter 执行。

### Changed
- 容器 E2E 每次运行使用独立 Docker volume，诊断资产上传后始终清理容器和临时卷。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.3 · 2026-10-07（健康快照与命令面板可访问性）

### Added
- 诊断包新增本会话 health snapshot：会话 ID、启动/采样时间、uptime、最近成功/失败、队列深度、最老命令年龄和坏 JSON 行统计；不输出命令参数或正文。

### Fixed
- 修复命令面板无匹配后按 Enter 可能执行上一条结果的问题。
- 补齐命令面板 combobox/listbox/option ARIA 关联，并修正超过 100 条命令时的键盘导航边界。
- 修复容器 E2E 在带 Token 的内核上误判健康状态，以及重启后私有路由尚未注册就开始验收的问题。

本版本不上思源集市，GitHub Releases 为分发渠道。

## v0.8.2 · 2026-10-07（运行时版本一致性与 E2E 门禁）

### Fixed
- 设置页标题和诊断包不再显示滞后的 `v0.7.5`；入口、设置页和诊断包统一读取 `src/version.ts`。
- 版本检查与升版脚本改为校验、更新唯一运行时版本源，避免后续发版再次漂移。

### Changed
- 容器 E2E 改为手动触发、可选镜像输入、冻结依赖安装、重启后健康探测和 Token 脱敏。
- 部署、JWT、内核路由和 MCP 协议失败会使实验流程失败；前端缺席项只在 `VERIFY_PROFILE=kernel` 下明确跳过，并上传容器诊断日志。
- ROADMAP 与当前状态快照同步到 v0.8.2 开发线；本版本仍不上思源集市。

## v0.8.1 · 2026-10-07（GitHub 发布链与契约计数修复）

### Fixed
- 修复 MCP 协议冒烟仍按 26 个工具断言、实际契约已为 27 个的问题；工具总数改为从 `src/ops.ts` 的 `ALL_OPS` 单一事实来源读取。
- 将 `vitest` 依赖声明提升到已修复安全问题的 `^4.1.11`，并改用 frozen lockfile 验证安装。

### Changed
- CI 收紧为只读权限、可取消陈旧运行、严格 frozen lockfile，并在发布包缺失时失败。
- 依赖监测固定更新同一 Issue，增强上游版本抓取失败的可见性。
- 新增 Dependabot、PR 模板和 Issue 必填校验；刷新双语 README、MCP/Agent 指南、安全策略与自动状态快照。

### Release
- GitHub Releases 提供 `package.zip`、SHA-256 校验文件和依赖清单；本版本不上思源集市。

## v0.8.0 · 2026-10-07（插件内 UI 层 + 首跑七步状态机 + 失联接管 + 取消通道；R283~R354 聚合）

> 二十余轮迭代聚合发布，四条主线：①插件内 UI 成型（观感对齐 mvp1 原型）；②首跑七步可恢复状态机；③失联检测与消费权接管；④workflow.cancel 取消通道。逐轮明细见 [docs/PROGRESS.md](docs/PROGRESS.md)。

### Added（插件内 UI 层，R288~R323 各轮聚合，逐轮明细见 docs/PROGRESS.md）
- **分层设置面板**（R288 起）：状态概览健康首页（通道卡片/KPI/下一步/最近回执）· 首跑向导（真状态四步）· 连接与通道 · 安全与权限 · 队列与数据 · 诊断与生态 · 关于；顶部搜索条跨分组过滤（R297）；行内校验/危险开关确认/清空预览等行为纪律保留
- **命令面板**（G3-01，`Ctrl+Alt+P`）：中英/拼音别名搜索、收藏★/最近置顶与切换（R311）、能力动作二段式参数执行、空结果兜底=快速捕获今日日记/收集箱（G3-04）
- **通知中心 / 恢复中心 / 回执中心**（G5-01/02 · R294/R300/R302）：事态聚合跳转 · unknown/失败/过期人工处置（重试/放弃/批量）· 回执查询（筛选/搜索/分页/CSV·JSON 导出）
- **全量备份/恢复**（R9-A · R322）：设置+收藏+审计+回执+台账拼装单 JSON，导入走 normalize* 校验链 + 确认覆盖 + 桥自动重启

### Fixed（UI 打磨收敛，R324 · 原型 vs 现状截图比对）
- **KPI 五格换行爆版**：思源 base.css 无全局 border-box，qg 作用域补齐后 flex 尺寸计算恢复正常（真机必现的布局缺陷）
- **回执时间五处 UTC 错位**：`slice(11,19)` 直切 ISO 串 → 一律经 `fmtReceiptTime` 转本地时区；耗时 ≥10s 升秒显示（30.0s），数字等宽对齐
- 命令面板收藏星钮/分组头补样式（原为无样式裸按钮）；行密度收敛至命令面板惯例（32px 行高）
- 通知中心键盘高亮错位（无动作信息卡被计入序列）；队列回执表补表头；暗色主题 chip 对比度提亮（对齐原型 dark 分支）；连接页首开关自动聚焦环移除；用户可见文案去除内部行号标注
- **测试定时炸弹拆除**：results-center `since` 用例固定时钟——本地午夜后 1 小时内运行 `today` 断言必挂（R47 同型）

### Fixed（子对话框观感收敛，R325 · 靶场子界面截图比对）
- **审计日志行重排**：完整 ISO UTC 串 → 本地 `MM-dd HH:mm:ss`；状态列 chip 语义着色；等宽耗时；复制按钮悬停显形；空态文案化
- **收藏与最近使用重排**：★/↺ 单色字形着色、标题主行 + `plugin/command` 等宽副行、时间本地化；「清空全部最近使用」danger 语义化
- **生态能力目录**：维护者调研注记（R2xx 轮次 / Lxxx 账本行号）经显示层净化不再面向用户；卡片排版（名称+id+maturity 徽章 / 状态版本行 / 说明行）
- **命令面板参数表单**：字段输入框密度独立于大搜索框样式（等宽 12px）；切换表单清除列表残留滚动（标题不再被裁）；空态兜底「捕获」按钮主色化（唯一主动作）
- 清空队列确认预览的「最早提交」时间本地化

### Fixed（捕获链路 / 窄屏 / 恢复中心，R326 · 靶场扩展截图比对）
- **捕获去向选择**：裸按钮空面板 → 内容说明（捕获文本预览 + 去向语义脚注「今日日记=追加 HH:mm 行；收集箱=纯文本」+ 默认值指引）
- **捕获成功卡主次颠倒**：四颗蓝色实心按钮 → 「已写入」绿徽章 + 「再记一条」唯一主按钮，其余中性描边（根因：`#qg-capture*` 不在 qg 样式作用域，思源 `.b3-button` 裸默认即蓝色实心）
- **窄屏（≤640px）设置行**：ctrl `max-width:46%` 把 label 挤成竖排断行 → 两段式布局（标题/说明通栏、控件通栏、图标收起）
- 恢复中心「已处置记录」折叠块实测正常（此前靶场未显示系 mock 契约错误：宿主 loadData 返回已解析对象，mock 误返回字符串被 normalize* 防线回落空——靶场修正，生产代码无恙）

### Fixed（状态页主次与首跑语境，R327）
- **「下一步」按钮区重构**：五钮平铺换行孤行 → 通知/恢复中心收进卡头右侧作小按钮（带计数），主行只留 桥自检（主）/ 查看能力目录 / 命令面板——每屏至多一个主按钮的语言回归
- **首跑向导隐藏搜索条**：欢迎语境下顶部跨组搜索是噪音（`qg-firstrun` 类随 show() 切换，跳过向导即恢复）；向导开启态/桥关闭态/暗色子界面靶场截图验证通过

### Fixed（交互 pending 态与一致性，R328）
- **按钮异步 pending 态**：桥自检（状态页/连接页/队列页三处）执行期间禁用+「自检中…」（`withPending` 助手，防连点重复执行）；向导「发 bridge.ping / 下一步：连通自检」自检期间禁用；命令面板「执行」派发期间禁用、失败后恢复可修正重试
- **四中心对话框宽度统一 640**：通知/回执此前 600、生态目录 620（`openDialog`/容器覆写/内容 min-width 三处同源）；命令面板保持 620（面板类界面惯例偏窄）
- 错误态靶场截图验证：向导自检失败（失败徽章+原因+可重试）、命令面板必填校验（红框+禁用执行）、设置搜索空态（0 项+兜底动作）均符合设计语言

### Added（账本待办落地，R331 · L624/L585/L586 部分）
- **恢复默认设置前自动备份**（L624 部分）：确认后先自动下载全量备份（设置+收藏+审计+回执+台账，与「导出全量备份」共享 `downloadFullBackup` 实现），导出失败即中止重置并给手动备份指引；备份导出按钮补 pending 态
- **对话框关闭后焦点回归**（L585 部分）：设置主面板/命令面板/恢复中心/审计/收藏/宿主 `openDialog` 全部经 `destroyCallback` 把焦点还给触发元素
- **动态反馈区 role 标注**（L586 部分）：状态页最近回执 `role=status`（aria-live=polite）、通知/恢复列表 `role=region`+aria-label、命令面板执行消息 `role=status`

### Added（账本待办落地，R332 · L552/L605/L590 部分）
- **命令面板条目「复制命令信封」**（L552 部分）：条目悬停出现 `{}` ghost 按钮——宿主命令生成 `commands.run` 信封、能力动作生成自身 op 信封（args 待填），一键复制后可直接粘贴到 lv-cli / Quicker / MCP 客户端发命令；实测剪贴板内容正确
- **队列页「最老待处理」KPI**（L605 部分）：显示最老未消费命令的年龄（分钟/小时），≥1 分钟（信封缺省 60s TTL）即橙色警示标注「超 TTL」——积压从纯数字变为可判读状态
- 审计无匹配 / 收藏空态补「上手指南」帮助链接（L590 部分）

### Added（账本待办落地，R339 · L630 部分）
- **队列页「载体明细」卡**（L630 部分）：commands/results/events/audit/favorites 逐文件行数与字节占用、合计、最老/最新回执时间，逐文件标注裁剪规则（回执窗口 200/台账 500/审计 auditMax/事件惰性压缩），附清理前导出引导——只读统计，不改动任何数据

### Added（账本待办落地，R333 · L561/L564/L624 再部分）
- **环境预检**（L561 部分）：诊断页新增「运行环境预检」——SiYuan 版本 vs minAppVersion、前端形态、桥目录可写性（专用探针文件）三档核对（✓ 可继续/⚠ 需注意/✕ 阻塞），外部客户端项诚实标注"无法在本面板检查"
- **向导自检证据可复制**（L564 部分）：首跑向导自检完成后提供「复制证据」——JSON 含时间/结果/处理数/耗时/通道，失败态同样可复制（贴 issue/留档）
- **重置后撤销**（L624 再部分）：恢复默认后保留重置前设置快照，状态概览页出现撤销横幅（本会话内一键撤销并按恢复的设置重启桥）；靶场端到端实测设置值 true→false→true 往返正确

### Verified（账本待办验证，R334 · L588/L565/L554 部分）
- **320px 窄屏零横向溢出**（L588 部分）：11 界面 × 亮暗全屏扫（scrollWidth 断言）通过——既有 wrap/break-all 规则覆盖，无需修改
- **首跑双路径说明**（L565 部分）：向导标题下说明①外部桥需向导显式开启、②不开桥也可用（MCP 只读工具/内核同步路由 7 只读 op），带 MCP README 与 op 契约链接
- 生态目录 stable 插件卡补「仓库 / Releases」入口链接（L554 部分；design 态未公开仓库不显示——诚实边界）

### Added（账本待办落地，R335 · L568/L593/L605 再部分）
- **结果中心「状态说明」图例**（L568 部分）：七类回执状态（recorded/duplicate/rejected/failed/unsupported/expired/unknown）折叠图例，各给含义、下一步与安全重试规则——unknown 明示禁止盲目换 id 重试副作用操作
- **诊断包复制前脱敏预览**（L593 部分）：「导出诊断包」先弹预览（完整 JSON + 脱敏边界说明），确认后才写入剪贴板
- **处理台账容量可见化**（L605 再部分）：队列页台账 KPI 显示 `X / 500` 上限，≥80% 预警色

### Added（账本待办落地，R336 · L567/L585 部分）
- **捕获写入前格式预览**（L567 部分）：去向选择对话框显示确切的落盘内容（今日日记=`- HH:mm 内容`、收集箱=原文），随悬停/聚焦的目标按钮联动
- **对话框焦点圈**（L585 部分）：新增 `src/services/focus-trap.ts`——Tab 在对话框内循环不外逸宿主；接入设置/命令面板/恢复/通知/回执五面（靶场实测最后元素 Tab 回到首元素）

### Added（账本待办落地，R341 · L571 再部分 + L545 文档）
- **桥恢复向导补防线备份行**（L571 再部分）：存在异常项时向导顶部出现「下载全量备份」动作行（处置前先留底，复用共享备份实现，完成后按钮转「已下载」）
- **用户结果卡文档**（L545）：新增 `design/docs/32-用户结果卡.md`——11 张卡按用户结果分四梯队（记东西/把命令交给插件/看状态找问题/守护数据），每卡固定「用户问题→输入→输出→写入位置→证据→失败恢复」六问并标注证据等级；design/README 文档地图收录

### Added/Test（账本待办落地，R342 · L608/L587/L593 部分）
- **广播 SSE 协议边界电池**（L608 部分）：新增 `tests/broadcast-protocol.test.ts` 5 测——CRLF 帧消费、一条信封跨 chunk 分片组装、UTF-8 BOM 剥离、**多行 JSON 协议门禁**（静默拒绝且不崩流，后续合法行继续）、EOF 静默立即重连且不带 Last-Event-ID（广播不回放历史）
- **触屏触控目标**（L587 部分）：coarse-pointer 媒体查询——qg 根内导航/面板条目/设置行主热区 ≥44px，常规按钮 36px（桌面鼠标不受影响）
- 诊断包复制成功提示附「敏感场合请及时清理剪贴板」（L593 尾巴）

### Added（备份来源设备 + 收藏合并策略 · R352/R354，L623）
- **备份载荷加 `sourceDevice`**（L623 来源设备字段）：导出时写入 deviceName，导入对话框显示"来源设备：X"——仅展示，本机 deviceName 恒保留不随备份迁移
- **收藏组导入合并策略**（L623 冲突策略）：导入对话框收藏组「合并」选项——并集去重（plugin/command 键，现有优先），默认仍覆盖替换

### Added（重置清向导进度 · R352，docs/33 §7-3）
- **恢复默认设置一并清除首跑向导进度**（docs/33 §7-3 落地）：重置时清空 wizard-state.json——重开设置回到完整七步首跑（向导进度受重置前防线备份保护）

### Added（workflow.cancel 实现 · R351，docs/36 I1~I2）
- **workflow.cancel op**（契约 27 个）：外部客户端/面板可请求取消运行中的工作流——写 `bridge/cancel.json`，execute 循环每步开始前检查；已完成步骤保留不回滚，回执标注 `stopped: "user-cancel"` + completed/pending 步骤列表；幂等 recorded（已停止再取消仍 recorded）；kernel-sync 路由不支持（FRONTEND_ONLY，收 unsupported+NDJSON 指引）
- 新增取消检查点单测 2 条（中途取消保留已完成步骤 / 全程 false 无取消标注）

### Added（L562 实现 · R347，规格 docs/33 I1~I4）
- **首跑向导升级为七步可恢复状态机**：环境检查 → 选择能力 → 桥权限（含"暂不开桥用 MCP 路径"）→ 连接探针 → 样例只读（daily.status+证据复制）→ 样例写入（可选，复用快速捕获）→ 完成；进度实时持久化 `wizard-state.json`，关闭面板/重启思源后续跑；损坏自动重置（步骤内提示）；完成后 `completedAt` 永久退出向导
- 步骤 1/4/5 失败均给「重试 / 改配置 / 查看 FAQ」三路径；样例写入含撤销指引；双路径说明（外部桥 vs MCP 只读）内置步骤文案
- host 接口新增 `readDailyStatus`/`captureQuick`（既有方法转公开供向导复用）
- **状态概览软提醒**（R353）：首跑向导未完成时「下一步」按钮区出现「继续首跑向导」入口（直达当前步骤，进度已持久化）；关于页显示会话运行时长（L610 部分）

### Added/Perf（账本待办落地，R343 · L552 再部分 + L605 完整）
- **能力动作表单头 op 一句话说明**（L552 再部分）：与 MCP 工具描述同源（`opDescription` 新导出），表单阶段即见动作用途
- **处理台账三级阈值**（L605 完整·队列侧）：≥70% 提示可导出留底 / ≥90% 请尽快导出清理 / 100% 明示最旧条目正被静默淘汰（上限 500 写满即滚动淘汰，90%+ 必须让用户知道）——靶场注入 480 条实测 ≥90% 档正确触发

### Added（L630 R-A · 天数保留实现，R346）
- **retentionDays 设置字段**（默认 0=关，不进设置页，改 bridge-settings.json 生效；normalize 校验 0~3650 非负整数）——>0 时三条写入路径追加"且时间戳 ≥ N 天前"裁剪：results（finishedAt）、events（emittedAt）、audit（time）
- **安全语义**：时间不可解析的行（坏行/未知行）按保留处理——人工核对权高于空间节约；默认 0 与旧版逐字节一致（零额外解析开销）；新增测试 3 条（results×2/events×1）
- 规格先行：`design/docs/35-载体保留策略规格与现状矩阵.md`——现状矩阵钉死 L604 条数维度**服务层已全部存在**（逐载体代码落点），剩余缺口收敛为天数维度（本轮落地默认关）与配对可视化（暂缓，触发条件在案）

### Added（账本待办落地，R337 · L566/L571 部分）
- **捕获写入可撤销**（L566 部分）：捕获成功卡新增「撤销写入」——`deleteBlock` 删除刚写入的块，confirm 二次把关 + 「已编辑勿撤」提示，按钮态防重

### Added（失联检测与接管实现 · R348，docs/34 I1~I3）
- **消费权心跳**（I1）：持有窗口每次 tick 后限流 ≥2s 落盘 `bridge/heartbeat.json`（holder=deviceName#windowSeq）；新增 `src/services/heartbeat.ts`（限流判定/读写/三档分类：healthy ≤15s / stale 15~60s / suspect >60s / unknown）
- **claimSteal**（I3 前置）：`bridge-claim` 新增 steal 认领（`{ ifAvailable:false, steal:true }` + 5s 超时防环境不支持挂死；被 steal 打断的原持锁 reject 静默容错）
- **恢复向导失联检测与接管**（I2+I3）：检测② 分档——他窗心跳正常（互斥运行中）/ 卡死嫌疑（15~60s）/ 高度疑似失联（>60s）/ 无法判断（诚实不猜）；stale/suspect 提供「接管消费权」（confirm 含他窗状态、待处理数、接管后建议），经 `takeoverBridge`（steal）执行；连接页消费权行附他窗心跳标注
- **onStolen 防双消费**：claim 支持 onStolen 回调——锁被他窗 steal 时原窗口自动停止轮询并提示（真实浏览器 steal 路径 P1 拒绝实测；docs/34 §7-3 已关闭）
- **桥恢复向导**（L571 部分）：连接页新增入口——六项状态检测（桥开关/本窗口轮询/退避/积压+坏行+最老待处理/广播/内核路由）三档汇总，行内动作（重启桥/清空队列带预览/导出诊断包）执行后自动重检；`buildDiagJson`/`clearQueueWithPreview` 抽为共享实现（诊断按钮/队列危险区同源）

### Added（账本待办落地，R338 · L623 部分）
- **备份导入选择性分组 + 差异预览**（L623 部分）：导入不再无脑全量覆盖——五分组（设置/收藏与最近/审计/回执/处理台账）勾选制，每组显示差异摘要（设置组列出与当前不同的键、其余显示备份 vs 当前计数），只导入勾选组；设置导入时**设备名始终保留本机**（device 路由身份不随备份迁移）
- `flushAudit` 公开化：审计分组导入后立即写回载体（不再等 pushAudit 节流）
- 修复：收藏当前计数读取把 `getFileText` 字符串直传 normalize 导致恒显示 0（R337 同型教训，生产路径）

### Added/Perf（账本待办落地，R340 · L600/L552 部分）
- **命令面板千条压测达标**（L600 部分）：输入防抖 120ms（与设置搜索同口径）+ 渲染截断前 100 条（超出提示继续输入缩小范围，顺序稳定）+ 键盘/点击索引统一 visible 切片；靶场千条合成命令实测击键落定 p50 167ms（防抖 120 + 渲染 ~46ms）、无掉帧
- **能力动作表单写入标注**（L552 部分）：表单阶段按 op 注解双档提示——destructive（plugin.api/workflow.execute）红框「写入或修改数据」、其他写 op 琥珀「写入数据」，口径与 MCP annotations 同源（新增导出 `opWriteAnnotation`）

### Docs
- 原型 [design/ui-prototype/mvp1.html](design/ui-prototype/mvp1.html) 补 ⑤命令面板/⑥通知中心/⑦恢复中心/⑧回执中心四屏；既有四屏同步新能力（设置搜索条/快速捕获去向/备份卡/入口按钮组）与实现位置注记
- README 双语新增「插件内 UI」节 + 路线行

### Security
- **plugin.api 原型链防护（TODO L651）**：`method` 此前直接索引桥对象——`constructor`/`hasOwnProperty` 等原型链成员可经透传调用；现要求**自有属性**（hasOwnProperty 检查），四成员回归测试（tests/plugin-api-guard.test.ts）

### Fixed
- **pollMs 热生效（TODO L659）**：修改轮询间隔此前只存设置、旧间隔持续到下次桥重启；现保存后自动重启轮询循环（Web Lock 认领重走防双窗口竞态），UI 提示即时生效

### Added
- **TODO §0.5 开发路线索引**：144 条 pending 按 P0 自主/P1 用户动作/P2 环境/P3 上游/P4 产品级五层重组；本轮核对销账 6 条（L298/L447/L488/L557/L566/L615）

### Changed
- 契约 26→**27 op**（+workflow.cancel）；README 双语 / api.md / MCP README / design 31 / REPO-MAP 计数同步
- 测试 210→**237**（SSE 协议边界 5 / 取消检查点 2 / 心跳 7 / 保留策略 3 / 收藏合并 / 原型链防护 4 等）

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

