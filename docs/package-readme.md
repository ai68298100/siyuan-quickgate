# 小驴快门（Lv QuickGate）· 安装包说明

[![Version](https://img.shields.io/badge/version-0.9.0-blue)](https://github.com/ai68298100/siyuan-quickgate/releases)

> 小驴生态联动中枢 + 外部网关：把思源笔记的命令、数据与编辑器上下文安全地开放给 Quicker、CLI 与 MCP 客户端。
> **本文件随安装包分发**（面向安装后使用），面向开发者的工具/MCP 配置与完整文档在[源码仓库](https://github.com/ai68298100/siyuan-quickgate)。

## 安装（手动；集市暂未上架）

1. 下载 Release 附件 `package.zip`（[Releases](https://github.com/ai68298100/siyuan-quickgate/releases)—— prerelease 标记的版本为公开测试版，正式版见无标记的最新 tag）。
2. 思源 → 设置 → 集市 → **使用本地安装包安装**（或解压到 `<工作空间>/data/plugins/siyuan-quickgate/` 后重启）。
3. 启用插件后进入 **设置 → 小驴快门**：
   - **外部命令桥**默认关闭——Quicker/CLI 需要它，开启即授权本机程序经桥文件发命令（Token 鉴权）；
   - **广播快路径**默认关闭——毫秒级通道，按需开启；
   - `plugin.api` 高级透传默认关闭且有允许名单（默认仅三个已完成契约审计的小驴插件）。
4. 全程无 Token 请求一律 401/403 拒绝；所有写操作留审计（不含参数值）。

## 三通道速览

| 通道 | 延迟 | 通道开关 |
|---|---|---|
| NDJSON 桥（Quicker/CLI） | ~1.2s 轮询 | 外部命令桥 |
| 广播快路径（postMessage + SSE） | 毫秒级 | 广播快路径 |
| 内核同步路由（只读探测 + 实验性写） | ~100ms | 随插件启用即用 |

MCP 客户端（Claude Desktop / Cursor）：只读工具随内核路由即用；写工具需环境变量 `LV_MCP_WRITE=1`——配置方法见[源码仓库 README](https://github.com/ai68298100/siyuan-quickgate#mcp-for-ai-assistants)（工具与 CLI 均随源码仓库分发，不随安装包）。

## 帮助

- [上手指南](https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/GETTING-STARTED.md) · [FAQ](https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/FAQ.md) · [隐私说明](https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/PRIVACY.md) · [op 契约](https://github.com/ai68298100/siyuan-quickgate/blob/main/docs/api.md)
- 问题反馈：[Issues](https://github.com/ai68298100/siyuan-quickgate/issues)

## 许可

[MIT](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) · 作者 [@ai68298100](https://github.com/ai68298100)
