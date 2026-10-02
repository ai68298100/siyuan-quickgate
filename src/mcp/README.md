# MCP stdio 代理（lv-quickgate）

把小驴快门的 23 个 op 一比一暴露为 MCP tools，供 Claude Desktop / Cursor 等 AI 客户端调用。
零插件改动：代理 ↔ 思源内核 HTTP API（NDJSON 桥文件 + 广播快路径），消费的端点均已真机实证。

## 运行

```bash
# Node ≥24（原生 TS 类型剥离）
SIYUAN_TOKEN=<思源API令牌> node src/mcp/main.ts
# SIYUAN_URL 默认 http://127.0.0.1:6806；LV_MCP_WRITE=1 开启写工具
```

Claude Desktop 配置（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "lv-quickgate": {
      "command": "node",
      "args": ["D:/AI/Codex/siyuan-quickgate/src/mcp/main.ts"],
      "env": { "SIYUAN_TOKEN": "<token>" }
    }
  }
}
```

## 安全模型（docs/10 §3.14）

- **默认只读**：13 个只读工具（ping/清单/概览/搜索/上下文/诊断/事件拉取…）
- **写工具默认隐藏**：`LV_MCP_WRITE=1` 才进 tools/list；tools/call 直接调写工具会被诚实拒绝
- `plugin.api` 与 `workflow.execute` 额外标注 `destructiveHint`
- 快门侧既有防线全部共用：命令确认门控（30s）/ 黑名单 / 审计 / plugin.api 允许名单 / 桥与广播默认关
- 与思源 3.8.6+ 内置 MCP server 可并存：内置覆盖内核 CRUD 面，本代理独有小驴生态面
  （checkin/contacts/commands/workflow/registry/config.discover）

## 工具面

23 op 一比一（tools 集合由测试强制 === src/ops.ts ALL_OPS）：
逐 op 参数 schema 见 tools.ts ARGS 表（required 已穿透；无参 op 为空 properties）。
等待策略：普通 op 15s；commands.run / workflow.execute 35s（覆盖确认窗口）。

## 状态与边界

- ✅ 单测 8+1 组（契约一致性/安全过滤/JSON-RPC 语义/错误分支），98 总全绿
- ✅ 裸 Node 真机烟测：initialize 握手 / tools/list（默认 13） / 写工具拒绝提示 / required 穿透
- ✅ **协议级冒烟**（`node tools/mcp-smoke.mjs`，6 断言全过）：完整 stdio 序列 vs 真进程——握手/列表/隐藏/拒绝/写模式/诚实超时
- ⬜ e2e：真实 AI 客户端完整会话 + 插件侧消费（待思源重启复测批通过）
- ⬜ npm 独立发包（@lv/mcp-quickgate）：待 e2e 后评估；当前随仓库分发
