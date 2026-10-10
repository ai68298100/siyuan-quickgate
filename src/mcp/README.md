# MCP stdio 代理（lv-quickgate）

> 各 AI 客户端（含国内千问/豆包/WorkBuddy 等无 MCP 平台）的接入路径与兼容矩阵见 [docs/ai-clients.md](../docs/ai-clients.md)。

把小驴快门的 39 个 op 一比一暴露为 MCP tools，供 Claude Desktop / Cursor 等 AI 客户端调用。
零插件改动：代理 ↔ 思源内核 HTTP API（NDJSON 桥文件 + 广播快路径），消费的端点均已真机实证。

## 运行

```bash
# Node ≥24（原生 TS 类型剥离）
SIYUAN_TOKEN=<思源API令牌> node src/mcp/main.ts
# 不设 SIYUAN_URL 时自动发现工作区内核（6806 快路径 → 扫描 SiYuan-Kernel 端口，Token 鉴权判定；
# 3.8.7-alpha 双内核架构下工作区内核是动态端口，见 docs/ai-clients.md §3.3）；LV_MCP_WRITE=1 开启写工具
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

## 安全模型

- **默认只读**：22 个只读工具（ping/清单/概览/搜索/上下文/诊断/事件拉取…）
- **写工具默认隐藏**：`LV_MCP_WRITE=1` 才进 tools/list；tools/call 直接调写工具会被诚实拒绝
- **参数校验前置（L562）**：tools/call 先按登记 schema 本地校验，缺失必填/错型直接回 JSON-RPC **-32602**（协议级 invalid params），不消耗桥队列槽位——与工具执行失败（isError result）分离
- **stdio 并发限额（L560）**：并发 tools/call 上限 4，超限立即回 -32000（服务忙请重试），防并发写者放大 NDJSON 队列竞争
- `plugin.api` 与 `workflow.execute` 额外标注 `destructiveHint`
- 快门侧既有防线全部共用：命令确认门控（30s）/ 黑名单 / 审计 / plugin.api 允许名单 / 桥与广播默认关
- 与思源 3.8.6+ 内置 MCP server 可并存：内置覆盖内核 CRUD 面，本代理独有小驴生态面
  （checkin/contacts/commands/workflow/registry/config.discover）

## 工具面

39 op 一比一（tools 集合由测试强制 === src/ops.ts ALL_OPS）：
逐 op 参数 schema 见 tools.ts ARGS 表（required 已穿透；无参 op 为空 properties；本地校验同表驱动）。
等待策略：普通 op 15s；commands.run / workflow.execute 35s（覆盖确认窗口）。
回执等待经共享监视器（L555）：并发调用共享单一 results.ndjson 读取循环按 id 分发；
客户端暴露通道指标（sent/sentFast/fastHits/fallbackResends/timeouts，L553）。

## 状态与边界

- ✅ Vitest 单测全绿（契约一致性/安全过滤/JSON-RPC 语义/错误分支/参数 schema 纪律/内核路由三态/L655 状态机/MCP 加固；数量以 CI 最近一次运行结果为准）
- ✅ 裸 Node 协议烟测：initialize 握手 / tools/list（默认 18 只读） / 写工具拒绝提示 / required 穿透
- ✅ **协议级冒烟**（`node tools/mcp-smoke.mjs`）：无思源鉴权环境时 6 项协议断言通过；真实 `bridge.ping` 需有效 Authorization，不能将环境失败记为代码通过
- ✅ **真机 e2e 全链（R81）**：三通道全部经真实前端消费（广播 recorded/内核路由 recorded/NDJSON 投递）
- ✅ **npm 打包脚手架**（`npm run build:mcp`）：esbuild bundle → dist-mcp/（mcp-quickgate.js + package.json），SMOKE_TARGET 可验 bundle，冒烟 6/6
- ⬜ 发布到 npm registry：需 npm 账号（用户侧），`npm run build:mcp` 产物即发布物
- ⬜ 真 AI host 实测（Claude Desktop/Cursor 等贴上方配置；国内客户端矩阵见 docs/ai-clients.md）
