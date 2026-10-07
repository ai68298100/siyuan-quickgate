# Security Policy / 安全策略

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.8.x | ✅（当前维护线；v0.8.0 目前为 prerelease） |
| 0.7.x | ⚠️ 仅接受可复现的安全报告，不承诺修复 |
| < 0.7.0 | ⚠️ 仅接受可复现的安全报告，不承诺修复 |

## Reporting a Vulnerability

- 请通过 GitHub [Security Advisories → Report a vulnerability](https://github.com/ai68298100/siyuan-quickgate/security/advisories/new) 私密报告，**不要开公开 Issue**。
- 通常 72 小时内回应。

## 设计边界（安全模型速览）

- 外部命令桥默认**关闭**；`commands.run` 有确认门控（30s 超时=拒绝）与审计。
- `plugin.api` 原始透传默认关闭且带允许名单。
- 快门只消费插件公开注册能力与公开桥方法，不读取其他插件私有存储。
- 能写桥文件 = 已持有思源工作空间写权限（等价于持有 API Token），协议不引入新攻击面；文档见仓库根 README 与 docs/api.md。
- 请勿在 Issue/截图/日志中粘贴思源 API Token。
