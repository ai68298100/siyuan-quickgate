# Quicker MCP 与 Codex 接入核验（R365）

> 核验时间：2026-10-14 08:48（北京时间）。这是官方资料与本机只读检查的结论，不是动作创建或运行验收。承接 [R106~R113 动作作者链调研](17-Quicker动作编辑与AI创建调研-R106-R113.md)，增量事项登记在 [TODO §23](../TODO.md)。

## 结论与分工

**可以通过 Codex 编写 Quicker 动作。优先使用 Quicker 自带 MCP 与官方 Codex 插件，不另造动作数据库写入接口。** 官方插件支持读取运行时知识、创建动作草稿、保存和预览；新建动作先留在 Quicker 暂存区，转为正式动作、覆盖原稿和执行分别受用户要求与 Quicker 的审批约束。[官方接入仓库](https://github.com/QuickerOrg/quicker-agent-integrations)；[Quicker 外部助手说明](https://docs.getquicker.net/v2/features/ai-and-agent/#连接外部助手)。

两条 MCP 链的职责不同：Quicker MCP 用于编辑和管理 Quicker 动作；快门 MCP 用于调用思源与小驴插件的公开能力。创建了 Quicker 草稿，不代表思源写入已获授权，也不代表业务结果已核验。

## 本机状态（E4，仅安装与连通性）

| 检查项 | 2026-10-14 观察 | 证据与边界 |
| --- | --- | --- |
| Quicker 安装 | 已安装，2.3.2.0 | Windows 卸载项与 `C:\Program Files\Quicker\Quicker.exe` 文件版本一致 |
| Quicker 进程 | 正在运行，响应正常 | 进程存在；未退出、重启或改变设置 |
| 安装包的接入说明 | 包含 `agent/skills/external-agents/SKILL.md` | 当地安装包明确列出 Codex 与官方接入仓库，属于静态契约 E2 |
| MCP / 写入开关 | 公开接入状态文件中 `Enabled=true`、`AllowWrites=true` | 只读取这两个值、端口与 Token 是否存在；没有复制 Token、修改授权或读取动作库 |
| MCP 端口 | 本次配置为 18765，loopback TCP 连接成功 | 使用有期限的直接 TCP 探测；该值是本次观察，不能硬编码为通用端口 |
| `/mcp` 鉴权 | 无凭据 GET 返回 HTTP 401 | 请求直连 loopback，不使用代理、不跟随重定向；没有发送 Token 或执行 MCP 工具 |
| Codex CLI | 0.159.3 | `codex --version` |
| Codex Quicker 插件 | 尚未安装 | `codex plugin list --json` 未发现 Quicker；普通 `codex mcp list --json` 也没有 Quicker，本会话工具目录未发现 Quicker 工具 |

因此当前缺少 **Codex 官方插件的安装与会话加载**。MCP 开关和端口可达不能证明客户端同意、写工具发现或动作保存成功。`Get-NetTCPConnection` 的空结果也不能单独证明未监听；本次以 TCP 成功和 HTTP 401 作为可达证据。

## 官方接入方式（已核对，尚未执行）

官方仓库当前主分支：[`96f25d2`](https://github.com/QuickerOrg/quicker-agent-integrations/tree/96f25d22803f9c24b738811bcffed5037f53778c)，Codex 包版本 0.2.0。下列命令来自该版本的 [安装说明](https://github.com/QuickerOrg/quicker-agent-integrations/blob/96f25d22803f9c24b738811bcffed5037f53778c/README.md#安装-codex-插件)，不要求手工配置 Token：

```powershell
codex plugin marketplace add QuickerOrg/quicker-agent-integrations
codex plugin add quicker@quicker-agent-integrations
```

安装后新开 Codex 会话，检查插件是否启用、是否发现 Quicker 工具。首次连接如出现 Quicker 客户端同意窗口，由用户核对并确认；保留现有审批方式。诊断命令为：

```powershell
codex plugin list --marketplace quicker-agent-integrations --json
```

官方插件是本地 STDIO 转接到 Quicker 的 loopback HTTP MCP。转接从 Quicker 的公开接入状态取得当前端口和凭据，不把 Token 写到命令行、插件配置或文档；不会通过写状态文件来代替用户授权。Codex 支持这两种传输，客户端共享本机配置，见 [OpenAI MCP 文档](https://developers.openai.com/codex/mcp)。

## 第一项动作验收

连接成功后，应先读取 Quicker 运行时提供的编写知识与 schema，再创建一个容易辨认的测试草稿。验收请求可以是：

> 创建“快门 · Codex 接入测试”动作，内容只显示“来自 Codex”；保存到暂存区，读回核对并打开设计器预览。

依次记录工具发现、动作 ID、保存回执、读回的标题和内容、暂存区位置以及设计器实际显示。这里不需要运行动作；保存和预览没有替代运行验证。发生传输超时或保存结果未知时，先读回同一个动作，不重复创建、强制覆盖或改写为成功。

通过后再建立“快门连接诊断”只读样板，使用快门现有公开契约；需要测试快速捕获等思源写入时，按根 AGENTS.md 使用快门独立靶场，不能直接打在用工作区。

## 版本边界与取舍

- 官方接入仓库的兼容性表记录了 Debug 构建中的真实草稿验收，同时明确正式安装包端到端、部分客户端和权限拒绝场景仍待验。本机 2.3.2.0 的作者链不能直接借用这些记录宣称已通过。[兼容性与证据范围](https://github.com/QuickerOrg/quicker-agent-integrations/blob/96f25d22803f9c24b738811bcffed5037f53778c/docs/兼容性.md)。
- 当前 Quicker 文档描述了更高版本的行为：2.3.7 调整已有正式动作的提交方式；2.3.9 发布快照扩展脚本与基础动作编写。本机是 2.3.2.0，实际类型、保存流程和工具集合应以运行时知识与返回为准，不套用新版本规则。[官方版本说明](https://docs.getquicker.net/v2/features/ai-and-agent/)。
- 暂不立项第三方 MCP 包或自建 Quicker 作者服务器：官方已有相应能力。重新评估的触发条件是官方工具实测缺少所需类型、schema 或保存能力，并且存在文档化公开接口；不能以直接修改私有动作库作为替代。
- 既有 C# 参考实现与导入方案继续作为待核验制品；本次不会宣称其可直接导入，也不会将组合动作中的 C# 模块等同于新版脚本动作。

本轮只做调研、只读检查与账本更新；未安装插件、未改变 MCP/写入权限、未创建或运行动作。
