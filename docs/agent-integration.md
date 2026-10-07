# 思源内置 AI Agent × 小驴快门 集成指南

> 思源 ≥3.8 内置了 AI Agent 运行时。小驴快门与它有**两条集成路径**，可同时启用：
> - **路径 A：原生能力**（≥3.8.6 插件启用即自动注册，零配置）——3 个能力；
> - **路径 B：外部 MCP**（把快门 MCP 服务器挂进思源 AI 设置）——**全部 27 个工具**。
> 源码依据：kernel/conf/ai.go（`ai.mcp.servers`）、kernel/agent/*（审批策略）；内核建议 **≥3.8.7-alpha.4**（修复 MCP 客户端对部分服务器的连接 bug #19998）。

## 路径 A：原生能力（零配置，先试这个）

插件启用后自动向 Agent 注册三能力（模型可见名 `plugin__siyuan_quickgate__*`）：

| 能力 | 作用 | effects |
|---|---|---|
| `quickgate_capture` | 一句话追加到今日日记（`- HH:mm 内容`） | localWrite |
| `quickgate_discover` | 发现日记笔记本与收集箱（`createInboxIfMissing=true` 授权建收集箱） | localRead |
| `quickgate_ping` | 快门健康探针 | localRead |

验证：思源 AI 助手里说「用 quickgate_ping 检查快门」→ 应返回连通信息。
（技术核查：`POST /api/ai/lsCapabilities` 应含上述三能力。）

## 路径 B：27 工具全量（外部 MCP）

**前置**：思源 AI 设置中已接入一个模型提供方；本机装有 Node ≥24；小驴快门插件已启用（MCP 经桥/内核路由与插件通信）。

在思源 **设置 → AI → MCP 服务器** 新增（或编辑 `工作空间/conf/conf.json` 的 `ai.mcp.servers`）：

```json
{
  "id": "lv-quickgate",
  "name": "小驴快门",
  "enabled": true,
  "type": "stdio",
  "command": "node",
  "args": ["<快门仓库或插件目录>/src/mcp/main.ts"],
  "env": {
    "SIYUAN_URL": "http://127.0.0.1:6806",
    "SIYUAN_TOKEN": "<你的 API 令牌>",
    "LV_MCP_WRITE": "1"
  },
  "inheritEnv": ["SIYUAN_URL", "SIYUAN_TOKEN", "LV_MCP_WRITE"]
}
```

- `LV_MCP_WRITE=1` 才暴露 13 个写工具；不带则只读 14 个（写调用被诚实拒绝）。
- **审批策略**：AI 设置 → Agent → 审批策略，按能力 ID（外部 MCP 组）逐条配置 放行/询问/拒绝；未配置时按风险分级缺省。
- 快门侧安全门照常生效：确认弹窗（30s）、黑名单、审计、允许名单——Agent 只是又一个消费通道。

## 安全边界

- 内置 Agent 对外部 MCP 工具有**白名单隔离**（不与原生工具共用 action 空间）；
- 快门「未知不得改写为成功」「外部面默认关」红线对 Agent 通道同等生效；
- 决策模型（若启用）的答案只是证据，不是授权——权限只在你的审批策略与快门服务端门控。

## 排障

| 症状 | 处置 |
|---|---|
| MCP 服务器连不上 | 内核升级 ≥3.8.7-alpha.4（#19998）；检查 command/args 手动可跑 |
| Agent 看不见快门能力 | `POST /api/ai/lsCapabilities` 核对；插件需已启用 |
| 写工具缺席 | `LV_MCP_WRITE=1` 未设置（快门设置页「plugin.api」无关，那是另一通道） |
