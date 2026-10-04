# 发布证据清单合同（Release Evidence · §18.2 R124-G1 · v0 草案）

> 目的：把每次 release 必须携带的事实合并为一份可核对清单；验收 = **每个发布声明都有等级化证据支撑**（R123-G0 证据等级 E0~E5），未验证事项不得出现在"已支持"宣传中。
> 状态：v0 草案——从 v0.7.0/v0.7.1 两次真实发布提炼。

## 1. 发布前必核（七项）

| # | 项 | 证据等级要求 | v0.7.1 实例 |
|---|---|---|---|
| 1 | 版本一致性 | E3（自动化） | plugin.json/package.json/PLUGIN_VERSION/README 徽章四处一致；dist 自检 |
| 2 | 验收门 | E3 | `npm run accept`（98 单测 + MCP 冒烟 6/6）全绿 |
| 3 | 真机数据集 | E4 | verify-restart 数据（复测批通过项如实列出，未过项**显式声明**——v0.7.0 即因 e2e 未验保持 pre-release） |
| 4 | 兼容性 | E4 | 存量 settings normalize 实证；minAppVersion ≥3.8.4（3.8.5/3.8.6 双验证） |
| 5 | 凭据卫生 | E2+E3 | 令牌泄漏扫描零命中（R63）；.gitignore 凭据条目在位 |
| 6 | 包内容 | E2 | dist 白名单（plugin.json/index.js/kernel.js/i18n/asset/docs）；无 storage/私有数据 |
| 7 | 事实表同步 | E2 | CHANGELOG（发版同轮）/PROGRESS/README×2/api.md/ROADMAP/WALKTHROUGH 七面对齐 |

## 2. 发布面声明规则

1. **pre-release 标记 = 存在未验证承诺**。解除条件：对应 e2e 完成（v0.7.x 例：真 AI 客户端 + 插件消费侧）。
2. **推论（R78 实测）**：全部 release 均为 pre-release 时，GitHub `/releases/latest` 返回 404——README 安装链接对全新用户是断链。**每次发布后必须验证 latest 可解析**；已真机全量验收的版本应解除 pre-release（v0.7.1 先例：9/9 复测后转正）。
3. 每条 release note 的能力声明必须能指到证据：真机数据（verify-restart 输出）、测试（vitest 行数）、或文档（contract 条款）。指不到就删声明。
4. **已知缺陷必须与功能并列**（v0.7.1 例：bug#9 说明 v0.7.0 受影响——坏消息同轮发布）。
5. 集市上架（门槛后）另需：preview.png 真实截图、i18n 完整、依赖声明——见 TODO §8 门槛清单。

## 3. 回滚证据

- 上一版本 package.zip 永久可下（GitHub releases 不删除）。
- 用户回滚路径：下载旧 release → 同导入流程覆盖；存储兼容由 normalize 双向保证（新→旧：未知字段被旧 normalize 忽略）。
- **内核路由前提**：kernel.js 的 kernels 字段类声明错误（bug#9 类）在导入后即可复现 404——发布前 #3 真机数据集是唯一拦截点，不可省。
- **CI 容器化内核侧验收**（R105）：`gh workflow run ci-e2e-experiment.yml`——ubuntu+siyuan docker 自动跑内核侧六类（路由 ping/events.list/降级/MCP exec），全 recorded 方可发布（前端侧由本机 verify:restart 覆盖）。

## 4. 追溯

- v0.7.0（首面向发布版）：三通道定位/MCP/双语 README 重写
- v0.7.1：bug#9（kernels 字段）——本清单 §1-3 的直接动因
- 流程：版本四处 bump → accept → build → dist 自检 → 部署 → CHANGELOG+PROGRESS 同轮 → release → CI 绿 → tag fetch
