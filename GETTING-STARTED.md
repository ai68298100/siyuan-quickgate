# 5 分钟快速启动

> 你已经装好了思源和快门。现在只差三步就能用 AI 助手操作你的思源。

---

## 第一步：确认桥已开启（~10 秒）

```bash
cd D:\AI\Codex\siyuan-quickgate
set SIYUAN_TOKEN=你的API令牌
node tools/lv-cli.mjs ping
```

**期望输出**：`"status": "recorded"` ← 看到这个就说明桥在工作

> Token 在思源「设置 → 关于 → 复制 API 令牌」

---

## 第二步：接入 AI 助手（~3 分钟）

1. 安装 [Claude Desktop](https://claude.ai/download)
2. 打开配置文件：`%APPDATA%\Claude\claude_desktop_config.json`
3. 加入以下内容（保存后重启 Claude Desktop）：

```json
{
  "mcpServers": {
    "lv-quickgate": {
      "command": "node",
      "args": ["D:/AI/Codex/siyuan-quickgate/src/mcp/main.ts"],
      "env": { "SIYUAN_TOKEN": "你的API令牌" }
    }
  }
}
```

4. 重启 Claude Desktop → 你会看到 13 个工具（锤子图标）
5. 对 Claude 说：**"帮我看看今天的日记写了没有"**

---

## 第三步：验证全链路（~1 分钟）

```bash
npm run verify:restart
```

**期望输出**：`== 复测：9/9 通过 ==` ← 九项全绿 = 系统完整可用

---

## 你现在可以对 AI 说的话

| 对 Claude 说 | 背后发生什么 |
|---|---|
| "帮我看看今天的日记写了没有" | 调用 daily.status → 返回 exists=true/false |
| "搜索包含 XX 的笔记" | 调用 commands.search → 返回匹配结果 |
| "列出我装了哪些小驴插件" | 调用 registry.list → 返回七插件清单 |
| "给我看看系统诊断信息" | 调用 diagnostics.report → 返回脱敏快照 |
| "帮我记录一次打卡：早起" | 调用 checkin.record → 需先设 LV_MCP_WRITE=1 |

---

## 写操作（可选）

默认只开放 13 个只读工具。要启用写入（打卡/人脉/文档操作）：

```bash
set LV_MCP_WRITE=1
```

或在 Claude Desktop 配置的 `env` 里加 `"LV_MCP_WRITE": "1"`。

---

## 遇到问题？

| 症状 | 检查 |
|---|---|
| AI 助手里看不到工具 | Claude Desktop 是否重启？配置 JSON 是否合法？ |
| bridge.ping 超时 | 快门设置→外部命令桥是否开启？ |
| 所有调用返回 401 | SIYUAN_TOKEN 是否正确？ |
| 看到工具但调用超时 | 思源是否正在运行？ |
