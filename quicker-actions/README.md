# quicker-actions/ — Quicker 动作导出归档

> 集市暂缓期间的分发方式：Quicker 动作以导出文件形式随仓库发布。本目录版本与仓库 main 对应。

## 导入方法

1. 下载本目录的 `.qa` 动作文件（Quicker V2 导出格式）。
2. Quicker → 动作页空白按钮右键 → **导入动作**（或双击 .qa 文件）。
3. 按首跑向导完成：贴 API 令牌 → 确认自动发现的日记笔记本/收集箱。

## 子程序 C# 参考实现（[reference/](./reference/)，R16 起累积至六件）

`SY·内核请求` / `LV·发命令` / `LV·取回执` / `SY·占位符解析` / `SY·路由前缀解析` / `LV·摘要格式化` 六件的可粘贴 C# 代码（纯标准库、零第三方依赖；语法级已验证，需 Quicker 普通模式 v2/Roslyn），配合 [reference/README.md](./reference/README.md) 的变量连线表使用——先于 .qa 导出文件可用。

## 清单（随开发进度补齐）

> 搭建提速：Quicker 2.2.0+ 暂存区「用 AI 写」+ docs/03 附A 提示词先生成骨架，再按蓝图核对细节。

| 文件 | 对应蓝图 | 版本 |
|---|---|---|
| （待导出）SY·快速捕获 | docs/03 P0-1 | 参考件已就绪 `reference/p0-1-快速捕获.cs`（csc 编译门通过） |
| （待导出）SY·划词摘录（G2 样板） | docs/03 P0-2 · docs/25 | 参考件已就绪 `reference/g2-capture.cs` v1.1 |
| （待导出）SY·思源全局快查 | docs/03 P0-3 | 参考件已就绪 `reference/p0-3-全局快查.cs`（含 sql: 安全过滤） |
| （待导出）SY·打开今日日记 | docs/03 P0-4 | 参考件已就绪 `reference/p0-4-打开今日日记.cs` |
| （待导出）SY·剪贴板图片入库 | docs/03 P0-5 | 参考件已就绪 `reference/p0-5-剪贴板图片入库.cs` |
| （待导出）SY·汇总日记待办 | docs/03 SY-12 | 参考件已就绪 `reference/sy-12-汇总日记待办.cs` |
| （待导出）SY·分拣收集箱 | docs/03 方向二（R11，`fj` 指令，Drafts 分拣闭环） | — |
| （待导出）SY·数据体检 | docs/03 SY-13 | 参考件已就绪 `reference/sy-13-数据体检.cs`（只读版） |
| （待导出）SY·诊断 | docs/03 | — |
| （待导出）思源超级面板 | docs/05 | 分发器参考件已就绪 `reference/SY-路由.cs`（六分支） |
| 子程序 12 件 | docs/03 §0 · docs/05 §5/§5.1 | `reference/` 全套（SY·内核请求 v1.1 / LV·发命令 / LV·取回执 / SY·路由 / SY·反向触发 / SY·占位符解析 / SY·路由前缀解析 / LV·摘要格式化 / SY·思源未运行分支 / SY·OCR清理 / SY·日志轮转 / SY-反向触发）——**27 脚本全过 csc C#5 编译门（2026-10-04；SY-Office选区 需 /r:Microsoft.CSharp.dll 供 dynamic 晚绑定）** |
| `SY-研究来源卡.cs` | R152-04 落地件：三层分卡（摘录全文/来源+MD5 指纹/推断标注）+同 URL 提示——页面失效摘录仍可读 | docs/21 R152-04 |
| `SY-文件项目索引.cs` | R154-01 落地件：选中文件/目录元数据索引（大小/时间/可选 MD5）写思源文档，部分成功清单、不移动源文件 | docs/21 R154-01 |
| `SY-Office选区.cs` | R153 域共享件：COM 晚绑定附加运行中 Word/WPS·Excel/WPS（MK_E_UNAVAILABLE 分支）读选区——word=文本/页码/批注修订数，excel=Address+Value2/Text 双列表格；前置进程守卫 | docs/21 R153-01/02/03/04 |
| `SY-增量扫描.cs` | R154-02 落地件：重入式目录增量（上次扫描点+稳定性≥5s+临时件过滤）→ 收件箱草稿；无长驻等价物 | docs/21 R154-02 |
| `SY-WebDAV传输.cs` | R154-04/05 落地件：WebDAV download（MD5 指纹）/upload（ETag）/list（PROPFIND）；凭据只进动作配置；导入链接 P0-5 资产上传 | docs/21 R154-04/05 |
| `SY-变更报告.cs` | R154-06 落地件：新旧清单快照 diff——新增/删除/移动（同指纹）/重复组四分类只读报告 | docs/21 R154-06 |
| `SY-文本规范化.cs` | R156-02 落地件：规则集参数化文本清理（空行/行尾/全角/MD 标题列表/utm 追踪参数）——只产出新文本，diff 与写回归调用方 | docs/21 R156-02 |
| `SY-粘贴守卫.cs` | 模拟粘贴前目标窗口确认：GetForegroundWindow + 标题/进程双校验，不匹配即终止（R151-04 核心件） | docs/21 R151-04 |
| `SY-预检.cs` | 动作运行前能力预检：内核可达/令牌有效/快门桥（可选）/指定插件在装 → 逐项 ✓✗ 报告+失败项清单；不满足走草稿/手动路径（R151-06 缺口(a) 闭环件） | docs/21 R151-06 |

## 许可与红线复测清单

- **许可**：本目录全部参考件与导出动作按 **「可自用可修改」** 分发（MIT 顺延小驴系）；再分发保留版权头即可，禁止售卖。
- **statestorage 配置备份（换机迁移，§11）**：动作的 statestorage 落盘在 `%APPDATA%\Quicker\states\state_<动作UUID>.json`（每个动作一个文件；Quicker 界面：动作右键→「查看状态」可见同内容）。换机：①导出动作 `.qa`（配置不含 Token）②复制对应 `state_*.json` 到新机同目录 ③首跑把 `SY_TOKEN` 重新粘一次（Token 只存本机，不随备份走）。思源侧设备名在 `<工作区>/storage/local/siyuan-quickgate/device.json`（不随同步，每台机器独立生成，无需迁移）。
- **每次动作更新后的红线复测**（§11，逐项打勾后才发布）：
  - [ ] AI 生成 SQL 只读强制：`sql:` 前缀仍走 GuardSql（SELECT/EXPLAIN 单语句+13 禁止词+强制 LIMIT）——跑一次 `p0-3` 的拒绝用例
  - [ ] 动作不执行外部传入代码；自由文本进 SQL 前必须经单引号转义（JStr/Replace("'","''")）
  - [ ] 动作配置/导出文件不含 Token 与个人文档 ID（`node scripts/check-release.mjs`）
  - [ ] 默认值未被关闭：confirmExec=true、桥/rawApi/广播/移动端桥 默认关（`tests/chaos.test.ts` 安全默认守护）

## 版本三线分记

三条版本线独立演进、互不绑定，对照表随发版更新：

| 线 | 载体 | 当前 | 演进规则 |
|---|---|---|---|
| 桥协议（信封/回执/事件） | `docs/02`（协议 v1.1，信封 v1） | v1.1 | 破坏性变更升 v2（需协商窗口），字段只增不改 |
| 超级面板菜单模板 | `templates/superpanel-menu.json`（menu schema） | v1 | 载荷 t/then.t 只增不改；模板跟随 docs/05 |
| 动作包（Quicker 导出） | 本目录 `.qa`（revision 制） | 未发布 | 每次导出记 revision+变更说明，配置不含个人数据 |

> 导出方法：Quicker 动作右键 → 分享/导出 → 保存到本目录，并在上表登记版本。导出前确认配置里**不含个人 Token 与文档 ID**（`scripts/check-release.mjs` 自查）。
