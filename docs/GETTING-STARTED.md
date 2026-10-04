# 小驴快门 · 上手指南

> 5 分钟从安装到第一条命令。故障排查见 [FAQ](./FAQ.md)；完整 op 契约见 [api.md](./api.md)。

## 1. 安装（手动；集市暂缓）

1. 从 [Releases](https://github.com/ai68298100/siyuan-quickgate/releases) 下载 `package.zip`（prerelease=公开测试版）。
2. 思源 → 设置 → 集市 → 「使用本地安装包安装」，选择 zip；或解压到 `<工作空间>/data/plugins/siyuan-quickgate/` 后**完全退出并重启思源**（托盘右键退出——窗口重开不刷新插件代码）。
3. 插件列表启用「小驴快门」。

## 2. 启用通道（按需，全部默认关）

| 想做什么 | 打开什么 | 在哪 |
|---|---|---|
| Quicker / CLI / 脚本发命令 | **外部命令桥** | 设置 → 小驴快门 → 基础连接 |
| 毫秒级命令通道 | **广播快路径** | 同上（需先开桥） |
| AI 助手只读查询 | 无需设置 | MCP stdio（见仓库 README「MCP for AI assistants」） |
| AI 助手写操作 | 环境变量 `LV_MCP_WRITE=1` | MCP 启动环境 |
| 思源内置 AI Agent 调用 | **无需设置**（≥3.8.6 自动注册 ping/discover/capture 三能力） | — |

## 3. 第一条命令（10 秒验证）

```bash
# CLI（仓库 tools/ 下，零依赖）
SIYUAN_URL=http://127.0.0.1:6806 SIYUAN_TOKEN=<你的Token> node tools/lv-cli.mjs ping
# PowerShell
.\tools\Send-LvCommand.ps1 -Op bridge.ping
```

返回 `recorded` 即全链打通。令牌在思源「设置 → 关于 → 复制 API 令牌」。

## 4. 思源内置 AI Agent（≥3.8.6）

插件启用后自动注册三个 Agent 能力（无需配置）：`quickgate_capture`（一句话记今日日记）、`quickgate_discover`（发现日记笔记本/收集箱）、`quickgate_ping`。在思源 AI 助手里说「用 quickgate_capture 记一杯水」即可验证。要给 Agent 更多能力（打卡/人脉/工作流），把它的外部 MCP 设置指向本仓库的 MCP stdio 服务。

## 5. 安全边界（默认全关，逐项开启）

- 外部面（桥/广播/plugin.api）出厂即 off；Token 是唯一钥匙，无 Token 请求一律 401/403。
- 所有写操作留审计（只记插件/方法名，不记内容）。
- 数据不出本机：无任何云端依赖（见 [PRIVACY.md](./PRIVACY.md)）。
