# Quicker 动作编辑与 AI 创建调研 R106~R113：从生成骨架到可维护动作

> 调研日期：2026-10-02。开始时 TODO 共 851 项（完成 192、未完成 659）；本轮新增 109 项后共 960 项（完成 192、未完成 768）。本轮只登记 Quicker 动作创建、审查、测试、分享和维护待办，不开发、不导出真实动作、不配置 AI 服务。候选登记在 [TODO §16](../TODO.md)。

## 1. 官方能力核对

本轮以 Quicker V2 官方文档为准，核对到以下与本项目直接相关的事实：

| 官方机制 | 对本项目的影响 |
|---|---|
| 动作内容与面板/场景/触发入口分离；同一动作可被多个位置引用 | 修改动作本体前要知道影响哪些入口；整理入口不能误删动作本体 |
| 组合动作由模块、变量和步骤组成；V2 文档提供模块参考和教程 | 动作蓝图应从“步骤散文”升级为输入/输出/变量/错误路径可核对的设计稿 |
| V2 提供暂存区；AI 新建结果先在本机暂存，确认后再保留到场景 | AI 生成动作不能直接当正式动作；要有暂存、检查、试运行和采用门槛 |
| 可在动作设计器内用 AI 修改当前编辑内容；2.2.26 起可运行并分析最近结果 | AI 修改、保存、真实运行和故障分析是不同状态，待办必须分开验收 |
| 脚本动作使用受限 C# 与 `qk` API；脚本运行是真实执行，没有自动回滚 | 脚本动作需要副作用清单、最小测试数据、运行前确认和版本限制 |
| V2 分享使用 share ID + revision，并可包含 V1/V2 制品；2.2.3+ 适合分享网络公共子程序 | 动作包必须记录版本、适用客户端、公共子程序来源、许可和升级/回退路径 |
| MCP 连接与允许 MCP 写入是分开的；动作修改可走暂存副本和写回确认 | 外部 AI 能改动作不等于获得业务写权限；动作编辑权限和思源写权限要分层 |

来源：[开始使用 Quicker V2](https://docs.getquicker.net/v2/getting-started)、[动作与动作面板](https://docs.getquicker.net/v2/features/actions)、[组合动作](https://docs.getquicker.net/v2/xaction)、[组合动作编辑器](https://docs.getquicker.net/v2/xaction/concepts/xaction-editor)、[调试](https://docs.getquicker.net/v2/xaction/concepts/debug)、[模块参考](https://docs.getquicker.net/v2/xaction/modules)、[脚本动作](https://docs.getquicker.net/v2/features/script-actions/)、[AI 与 Agent 现状](https://docs.getquicker.net/v2/features/ai-and-agent)、[动作面板](https://docs.getquicker.net/v2/features/action-panel/)、[动作暂存区](https://docs.getquicker.net/v2/features/action-panel/action-drafts)、[场景与分组](https://docs.getquicker.net/v2/features/scenes)、[快速触发](https://docs.getquicker.net/v2/features/triggers/)、[分享动作与公共子程序](https://docs.getquicker.net/v2/features/action-sharing)、[AI 动作 JSON 规则](https://github.com/QuickerOrg/docs.getquicker.net/blob/main/data/xaction/ai-action-json-guide.md)。

## 2. 动作创建的正确生命周期

对于快门动作，完整生命周期应是：

`用户结果定义 → 动作卡片 → 模块/脚本设计 → AI 生成或人工搭建 → 静态审查 → 固定样例试运行 → 真环境验证 → 暂存版本 → 场景/触发绑定 → 分享 revision → 反馈修订 → 兼容迁移/回退`

“AI 已经生成”“设计器显示修改”“动作已经保存”“动作试运行成功”“业务结果已核验”是五个不同事实。现有 Quicker 文档明确脚本真实执行且无自动回滚，AI 结果也需要用户检查；因此本项目不能把 AI 输出或保存成功作为动作可用证明。

## 3. 本项目动作设计的特殊边界

快门动作的业务目标来自思源和小驴插件公开契约；Quicker 负责入口、参数收集、编排、调用、回执呈现和用户确认。动作不应复制插件私有数据、不应把 Token/文档 ID 固定在分享制品里、不应让 AI 自由生成未登记 API、不应通过 C# 脚本绕过快门的确认、幂等和审计。

动作创建待办应同时面向三类人：只想安装并使用的人、需要在编辑器里调整参数的人、负责维护和分享动作的人。每个待办都要回答：用户要完成的结果是什么、动作输入是什么、成功证据是什么、失败如何恢复、升级如何迁移。

## 4. AI 创建的产品判断

Quicker 的 AI 可以生成或修改组合动作、在设计器内辅助修改、引用步骤、分析运行问题，并通过暂存副本隔离正式动作。它提高了创建速度，却不能证明模块选择、变量连线、目标窗口、权限、真实输入和业务结果正确。AI 创建能力应被定位为“动作设计助手”，不是动作发布审批者，也不是快门业务授权者。

## 5. 调研门槛

本轮候选先核对 Quicker 客户端版本、V1/V2 模式、账号/专业版限制、AI 服务配置、模块实际可用性和真实运行环境。未在真实 Quicker 编辑器中验证的蓝图、提示词、C# 参考件和 `.qa` 文件继续标为不可直接发布；动作分享、AI 写入和脚本执行都需要保留人工检查、试运行证据和回滚方案。
