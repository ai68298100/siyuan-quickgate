# AI 客户端接入矩阵（外部 Agent 调用快门）

> 快门的 AI 接入口是**协议级**的，不绑定任何单一客户端：MCP 是开放标准，内核 HTTP 路由与工具 schema 导出面则覆盖不支持 MCP 的平台。本文按客户端能力分三条路径，各家任选其一。
> 版本基线：v0.9.1（35 op / MCP 默认 18 只读工具）。客户端 MCP 支持状态随版本变化快，配置文件位置以各客户端当前文档为准；实测结果请回填 §5 兼容表。

## 0. 路径总览

| 路径 | 适用客户端 | 前置 | 工具面 |
|---|---|---|---|
| **A. MCP stdio** | Claude Desktop / Claude Code、OpenAI Codex CLI、ZCode、Google Antigravity（反重力）、Qwen Code、TRAE、Cherry Studio、Chatbox 等一切支持「本地 MCP 服务器」的客户端 | Node ≥24 | 35 op → MCP tools（默认 18 只读） |
| **B. 思源内置 Agent**（零配置） | 思源 ≥3.8.6 的内置 AI Agent | 无（插件启用即注册） | `quickgate_ping` / `quickgate_discover` / `quickgate_capture` 三能力；全工具面可经外部 MCP 挂载（见 §2） |
| **C. 自定义工具 / HTTP** | 千问办公、豆包办公、WorkBuddy、DeepSeek dsh 等无 MCP 但支持 function-calling 或 HTTP 插件的 Agent | 思源 API Token | 35 op 全量（schema 由导出器生成；调用走内核 HTTP 路由或 NDJSON 桥） |

**写权限门控对所有客户端一致**：MCP 写工具需 `LV_MCP_WRITE=1` 才进 tools/list（直接调用被诚实拒绝）；`plugin.api` / `workflow.execute` 标注 `destructiveHint`；快门侧防线（确认框 30s、黑名单、审计、plugin.api 允许名单、桥默认关）与客户端无关，任何客户端都无法绕过。

## 1. 路径 A：MCP stdio（推荐）

服务器命令（各家通用）：

```
command: node
args:    <仓库路径>/src/mcp/main.ts
env:     SIYUAN_URL=http://127.0.0.1:6806
         SIYUAN_TOKEN=<思源 设置→关于→API 令牌>
         LV_MCP_WRITE=1   # 可选：放开写工具；缺省只读
```

协议与安全模型详见 [src/mcp/README.md](../src/mcp/README.md)。常见客户端的配置位置：

| 客户端 | 配置文件 | 形状 |
|---|---|---|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/`） | `{"mcpServers": {"lv-quickgate": {…}}}` |
| Claude Code | `claude mcp add lv-quickgate -- node <仓库>/src/mcp/main.ts`（或 `.mcp.json`） | 同上形状 |
| OpenAI Codex CLI | `~/.codex/config.toml` | `[mcp_servers.lv-quickgate]` `command = "node"` `args = […，"src/mcp/main.ts"]` `env = { "SIYUAN_TOKEN" = "…" }` |
| ZCode / Cline / Continue 等 VS Code 系 | 各自的 MCP 设置（JSON，多为 `mcpServers` 键） | 同 Claude Desktop 形状 |
| Google Antigravity（反重力）/ TRAE / Qwen Code | 各自 MCP 设置页（本地 stdio server 类型） | 填 command/args/env 三项 |
| Cherry Studio / Chatbox（模型配 DeepSeek 等均可） | 设置 → MCP 服务器 → 添加（类型=STDIO） | 填 command/args/env 三项 |

配置模板（Claude 形状，其他客户端等价搬运）：

```json
{ "mcpServers": { "lv-quickgate": {
    "command": "node",
    "args": ["D:/path/to/siyuan-quickgate/src/mcp/main.ts"],
    "env": { "SIYUAN_TOKEN": "<token>", "LV_MCP_WRITE": "1" }
} } }
```

> 国内客户端注意：只要支持「本地 MCP（stdio）」即可接入，与底层用哪家模型无关——Cherry Studio/Chatbox 配 DeepSeek/Qwen/豆包模型 + 本 MCP 服务器，效果等同于专属 Agent。

## 2. 路径 B：思源内置 Agent（零配置）

思源 ≥3.8.6 下，插件启用即向内置 AI Agent 原生注册三个能力（无需任何配置，`/api/ai/lsCapabilities` 可见）：

- `quickgate_ping`——健康探针
- `quickgate_discover`——日记笔记本 + 收集箱发现
- `quickgate_capture`——一句话追加今日日记

要给内置 Agent 全部 35 工具面：把 Agent 设置的「外部 MCP」指向本仓库 stdio 服务器（同 §1 env），字段级挂法与审批策略见 [docs/agent-integration.md](./agent-integration.md)。注意内核需 ≥3.8.7-alpha.4 以规避上游 MCP 客户端连接 bug #19998。

## 3. 路径 C：自定义工具 / HTTP（无 MCP 平台）

### 3.1 工具 schema 导出

```bash
node tools/export-toolschema.mjs            # 只读 18 工具 → dist/toolschema/
node tools/export-toolschema.mjs --write    # 含写工具（35）
```

产物两份：

- `quickgate-tools[-rw].function-calling.json`——OpenAI tools 数组形状，直接导入支持「自定义工具/function-calling」的平台（千问办公、豆包办公、WorkBuddy、DeepSeek 平台侧等；各家入口名称不同：「自定义工具/插件/Action」）
- `quickgate-tools[-rw].openapi3.json`——OpenAPI 3.1，适合支持「导入 OpenAPI/Action schema」的平台（类 GPT Actions 流程）

### 3.2 调用端点

Agent 拿到 schema 后，通过**内核同步路由**执行（~100ms，无需开桥）：

```
POST {SIYUAN_URL}/plugin/private/siyuan-quickgate/exec
Authorization: Token <思源API令牌>
Content-Type: application/json

{"op": "exam.stats", "args": {}}
```

- 随插件启用的 7 个 op（`bridge.ping / registry.list / diagnostics.report / events.list / events.pull / config.discover / template.new`）直接可用
- 其余 op 为前端专属：需在快门设置开启「外部命令桥」，改走 NDJSON 桥或广播快路径（见 [docs/api.md](./api.md) 通道表）；无 MCP 的编排型平台建议优先选 7 个内核 op + 引导用户开桥
- 平台无法直连本机时（云端 Agent），需内网穿透/本机代理，且 **Token 只发给你自己的实例**

curl 验证：

```bash
curl -s -X POST http://127.0.0.1:6806/plugin/private/siyuan-quickgate/exec \
  -H "Authorization: Token <token>" -H "Content-Type: application/json" \
  -d '{"op":"bridge.ping","args":{}}'
```

## 4. 写操作分级（全路径通用）

| 级别 | op | 门控 |
|---|---|---|
| 只读 | ping/list/search/summary/context/registry/diagnostics/events…（18 个 MCP 只读工具） | 无（桥/内核通道自身鉴权除外） |
| 受控写 | `checkin.record`、`glean.status`、`contacts.*` 写、`home.memo`、`template.new`… | 需 `LV_MCP_WRITE=1`（MCP）；NDJSON/HTTP 面有确认框 30s + 审计 |
| 破坏性标注 | `plugin.api`（原始透传，默认关+允许名单）、`workflow.execute` | `destructiveHint`；建议人工在场 |

无幂等键的写 op（`home.memo` 运行态备忘）超时后**禁止换 id 重试同语义**（会重复记录）；幂等写（`checkin.record` 的 `source+externalRef`）重复投递安全。

## 5. 兼容性实测表（回填用）

| 客户端 | 版本 | 路径 | 实测结果 | 备注 |
|---|---|---|---|---|
| Claude Desktop | — | A | ⬜ 待实测 | 上手指南默认示例 |
| OpenAI Codex CLI | — | A | ⬜ 待实测 | config.toml 形状 |
| ZCode | — | A | ⬜ 待实测 | |
| Antigravity（反重力） | — | A | ⬜ 待实测 | |
| Qwen Code | — | A | ⬜ 待实测 | |
| TRAE | — | A | ⬜ 待实测 | |
| Cherry Studio + DeepSeek | — | A | ⬜ 待实测 | 模型侧无 MCP 依赖 |
| 千问办公 | — | C | ⬜ 待实测 | 自定义工具导入 function-calling JSON |
| 豆包办公 | — | C | ⬜ 待实测 | 同上；平台侧工具面以当前版本为准 |
| WorkBuddy | — | C | ⬜ 待实测 | 同上 |
| DeepSeek dsh | — | C | ⬜ 待实测 | 同上 |
| 思源内置 Agent（≥3.8.7-alpha.4） | — | B | ✅ 三能力真机实证（R244/R245） | 全工具面挂载待端到端 |
