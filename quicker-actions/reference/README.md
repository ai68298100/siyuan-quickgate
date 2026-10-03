# reference/ — 子程序 C# 参考实现（可直接粘贴进 Quicker C# 模块）

> 目的：把 docs/02 §6 的子程序步骤表落成**可运行的 C# 代码**，把你的搭建工作从"按散文写代码"降为"粘贴+连变量"。
> 版本对应：协议 v1.1（信封 v1）、快门 v0.5.x。纯 .NET Framework 标准库，**不依赖 Newtonsoft**（args 以 JSON 文本直接内嵌，避免序列化误差）。

## 使用方法（每个文件同样流程）

1. Quicker 动作里加「C# 脚本」模块 → 执行线程选**后台线程（MTA）**。
2. 打开模块后，Quicker 会给出代码骨架——**保留你版本骨架里的签名与 using**，把 `OnExecuted`/`Exec` 方法体替换为本文件的内容（不同 Quicker 版本上下文类型名可能微差，以你编辑器给出的骨架为准）。
3. 按文件头注释的【输入/输出变量】表，在动作里建同名变量并连线。
4. 测试模式跑一遍，再按 docs/04 §8 错误分支检查失败路径（改错 token 试一次）。

## 文件清单

| 文件 | 职责 | 关键契约 |
|---|---|---|
| `SY-内核请求.cs` | 唯一内核调用入口：配置兜底 → HTTP → 401 自愈（v1.1：强制重读 env 重试一次）→ 中文分支 | docs/03 §0 · docs/04 §8 |
| `LV-发命令.cs` | 生成 id → 拼信封（args 文本直嵌）→ Multipart putFile 追加 commands.ndjson | docs/02 §2（v1.1） |
| `LV-取回执.cs` | 按 id 轮询 results.ndjson（逐行解析容错）→ 状态/消息/data 输出；超时=timeout 不重试 | docs/02 §3 · D-0005 |
| `SY-占位符解析.cs` | 载荷模板的 `{占位符}` 统一替换（日期时间类+9 个变量类）；`{ask:提示语}` 交互与路由前缀不在此层 | docs/05 §5.1 |
| `SY-路由前缀解析.cs` | 多目标路由 v1：`#前缀=目标文档ID` 最长匹配 + `@人脉(N)` 提名解析 → 目标/剩余文本/人脉名单 | docs/03 §0 路由规则表 |
| `LV-摘要格式化.cs` | checkin.summary 的 `{today,streaks}` → 一行中文通知；形状不符降级占位 | docs/05 §5.2 · v0.5.6 契约 |
| `SY-路由.cs` | **总装件**：六分支分发（http/sql-url/url/bridge/cmd/act，docs/05 §5）+ §5.1 占位符 + 桥命令收发内联；url/act 输出指令交后续模块执行 | docs/05 §5 |
| `SY-思源未运行分支.cs` | 内核不可达标准分支：探测(300ms)→询问→启动 exe/siyuan://→重探(≤15s)→toggle 出口 | docs/05 §6.1 |
| `SY-反向触发.cs` | Quicker 668 `/api/exec` 封装（operation=action，wait/maxWaitMs）；外部面联动入口 | docs/05 §7-F |
| `SY-OCR清理.cs` | OCR 后处理：汉字间空格删/西文间保留/断行缝合/句号段落，纯文本零依赖 | docs/03 P0-5 |
| `SY-日志轮转.cs` | sy-quicker.log 追加（跨进程 Mutex）+ 超 1MB 滚动保留 .old；日志失败静默 | §2 日志轮转项 |
| `g2-capture.cs` | **G2 样板单文件**：划词摘录→收集箱（收集箱兜底链+insertBlock+错误分支）= P0-2 | docs/25 · docs/03 P0-2 |
| `p0-1-快速捕获.cs` | 快速捕获到今日日记：HH:mm 前缀 + R6 标题落点变体（SQL 定位→回退文末）+ R3 `#前缀` 路由 | docs/03 P0-1 |
| `p0-3-全局快查.cs` | 全局快查：全文搜索→同名 SQL→提示 sql: 三级 fallback；`sql:` 安全过滤（只读单语句+禁止词+强制 LIMIT） | docs/03 P0-3 |
| `p0-4-打开今日日记.cs` | 打开日记/收集箱：today 精确匹配 SQL→无则 appendDailyNoteBlock 建后重取；输出 openurl 指令 | docs/03 P0-4 |
| `p0-5-剪贴板图片入库.cs` | 图片 PNG 字节 multipart `/api/asset/upload` → OCR 文本写 alt → 入今日日记（图片可全文检索） | docs/03 P0-5 |
| `sy-12-汇总日记待办.cs` | 近 N 天日记未勾选待办聚合（日期白名单谓词，拒绝宽匹配）→ 汇总块写今日日记带回链 | docs/03 SY-12 |
| `sy-13-数据体检.cs` | 只读体检报表（空文档/重复标题/最早文档）+「可能误判」提示；只读不删，清理引原作动作 | docs/03 SY-13 |

## 已知边界（诚实声明）

- **上下文签名以你的 Quicker 为准**：v2 各版本 `Quicker.Public.IStepContext` 的确切命名空间可能微调；若粘贴报签名错误，保留编辑器骨架签名、只换方法体即可。
- `LV-取回执.cs` 的字段提取是**手写轻量解析**（扁平回执够用）；`data` 原样输出，需要深取时在 Quicker 里接 `jsonextract` 模块。
- 内核路由快路径（KERNEL_OPS 同步直呼）：**无需专用参考件**——`SY·内核请求` 传 `sy_url` 保持不变、端点填 `/plugin/private/siyuan-quickgate/exec`、请求体 `{"op":"…","args":{}}` 即为直呼（3.8.6 真机已验证，spike⑩ ✅ 2026-10-02）；响应 `data` 即回执（与桥回执同形）。前端专属 op 会收到 `unsupported`+中文指引（走 NDJSON 通道）。规范见 docs/02 §6。
- 这十二份是**参考实现**，Quicker 真 API 成员面仍以真机为准；首次粘贴如遇编译错误，多为变量缺失或签名差异，按提示补齐即可。实测后请反馈，会修正进参考件（TODO §5.8 R16）。
- **语法级验证（csc C#5 严格门）**：2026-10-02 R33 首轮（六件，LV 三件含 C#7 语法报错"属预期"）；**2026-10-03 全量重验 12 件全净**——LV 两件的 `is T x`/`out var` 已降 C#5，g2-capture 修复三处真实缺陷（ParseJson 未定义/ShowNotify 空壳静默/C#7 语法）后重写为 v1.1。`__build-compile.mjs`（包 class+提 using）+ `__compile-stub.cs`（stub IStepContext）= 可重复的编译门，任何参考件改动后 `node __build-compile.mjs && csc … __combined.cs __compile-stub.cs` 即验。
- **文件编码**：含中文注释，均为 UTF-8（带/不带 BOM 不影响 Quicker 粘贴；若用外部编辑器打开请确认以 UTF-8 读取）。
