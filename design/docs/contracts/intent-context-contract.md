# C2 意图上下文合同（§18.2 R124-G1 · v0 草案）

> 目的：把各入口携带的"意图上下文"（用户想做什么 + 凭什么做 + 绑定到哪次确认）合并为一份合同；验收 = 不再有并行字段命名。
> 状态：v0 草案——收录已实现形状；`planned` 标注 R116/R118 的目标态（Intent/Plan 中枢），当前由各入口轻量承载。

## 1. 上下文四要素（任何入口执行前应可回答）

| 要素 | 问题 | 当前载体（已实现） |
|---|---|---|
| **意图** | 想做什么（op + 参数） | 信封 `{op, args}`（三通道同形）；MCP `{name, arguments}` |
| **环境上下文** | 在哪个文档/块/插件上做 | `editor.context`（docId/rootTitle/blockId/selectedText）；Quicker 用户配置项（SY_URL/SY_TOKEN/收集箱文档ID/日记笔记本ID） |
| **权限上下文** | 凭什么做 | Token；`LV_MCP_WRITE`；plugin.api 允许名单（见 safety-gate-contract） |
| **确认绑定** | 哪次确认对应哪次执行 | 信封 `id`（确认窗 30s 绑定该 id）；workflow `planId`（一次性，总确认绑全部步骤） |

不变量：
1. **确认不可转移**：一次确认只授权一个 id / 一个 planId；换 id 重发必须重新过门（result-contract 补救表）。
2. **上下文缺失要显式**：`editor.context` 无焦点返回全 null（不猜）；占位符变量"存在即用、缺省空串"（SY-占位符解析）——两处都不静默 substitute 别的值。

## 2. 各入口的上下文形状（已实现）

| 入口 | 形状 |
|---|---|
| NDJSON/内核路由/广播 | 信封字段 + args（op 自描述；无独立意图层） |
| MCP tools/call | `{name, arguments}` + 逐 op JSON schema（required 穿透）+ annotations（readOnly/destructive） |
| workflow.plan | `steps:[{op,args}]≤8` → 计划对象含 steps[].confirm 标记（写步骤自动标注）+ expiresAt |
| Quicker 动作 | 用户配置项 + 占位符九变量类（{今天}/{选中文本}/{来源窗口}/{clipboard}/{选中块ID}…，存在即用缺省空串）+ `{ask:提示语}` 交互 |

## 3. planned（R116/R118 目标态，登记不承诺）

- Intent 中枢：`{goal, targets[], constraints[]}` 独立于 op——AI 场景（自然语言→op）就绪前不建，避免过早抽象（R126-G3 顺序门：模板和场景不得先于 schema/安全）。
- 澄清协议：missing-context → 结构化澄清请求（而非失败）；依赖 C1 unknown 语义先行。
- 跨入口上下文透传：Quicker → 思源 → MCP 的 intentId 贯穿（现各入口 id 独立）。
