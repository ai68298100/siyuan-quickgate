# ROADMAP

> 里程碑与验收对应项目主仓库 TODO §5；此处只列本仓库视角的顺序与门槛。
> 状态（2026-10-11，源码 v0.9.1 · GitHub 发布线 v0.9.0）：**v0.9.1 生态适配扩展已真机闭环**——拾遗/管家/考试三家公开桥接入（27→35 op，`glean.*`/`home.*`/`exam.*`），manifest 校准（三家 design→stable + 补录 xiaolv-common，清单 8 款）；AI 客户端矩阵落地（Codex/Claude Code/ZCode 配置就绪，MCP 协议冒烟 7/7 live recorded）+ **工作区内核端口自动发现**（3.8.7-alpha 双内核，未设 SIYUAN_URL 零配置）；在用工作区部署 v0.9.1 后 verify-restart full 10/10。真机新发现：3.8.7-alpha 双内核架构（6806=启动器、工作区内核动态端口、Token 不通用、失败鉴权 429 限流），已文档化（ai-clients §3.3）并有发现器兜底。剩余真机项：DevTools 现场三项（④双窗口/⑦blockId/⑪现场事件）+ 各 AI 客户端 app 内端到端与 C 类平台实测（ai-clients §5）。集市仍按约定不推送。

## M0 spike（需思源真机，半天）→ 产出 docs/WALKTHROUGH.md（现为 11 项实操手册）
① 命令注册表形状 ✅bundle 静态核实（v0.6.3：i18n/displayName 挂载+customHotkey 回写机制；DevTools 可选复核）
② confirm API 签名与超时 ✅bundle 静态核实（v0.6.3：回调式无自动超时→30s 兜底必要）
③ 桥文件端到端 <2s ✅（R68 复测批 + e2e-bg 常规项）
④ Web Lock 多窗口单消费 ◐（R232：单窗口认领已实现——startBridge 先认领 siyuan-quickgate-bridge；双窗口现场待验）
⑤ SSE/WS 广播可用性 ✅真机实证（v0.6.0 据此实现 v1.5 广播快路径）
⑥ petal/loadPetals 形状 ✅真机自动探针（registry.list 合并吻合）
⑦ editor.context 字段校准 ◐bundle 静态坐实（v0.6.2 修 bug#7：docId=容器 data-node-id；blockId 爬升待现场）
⑧ 日记笔记本自动发现字段 ✅真机探针（bug#6 修复 v0.5.9/v0.6.1）
⑨ storage/local 同步边界 ✅单机通过（D-0006 技术可行；多端隔离待第二设备）
⑩ **内核同步路由校准** ✅（spike⑩ 2026-10-02 真机全线打通；R235 鉴权七格矩阵 E4 零泄漏）
⑪ **event-deleted 物化验证** ✅（v0.7.3 真机验收 10/10 含事件物化闭环；R230 恢复探针在案）

## M1 校准回填（半天，spike 后）
- ✅ registry/editor.context/discoverConfig 已按 bundle/真机形状回填（v0.5.9~v0.6.3）
- D-0006 桥目录迁移（spike⑨ 单机通过；多端隔离补验后即迁）
- ✅ v1.5 广播通道已实现（v0.6.0；联调待内核重启复测批）

## M2 完整性（✅ 主体已在 v0.2.0~v0.7.x 完成）
- ✅ 设置页全功能（桥/移动端/广播开关、轮询、确认、透传+允许名单、黑名单、队列状态、清空预览、回执、审计筛选+复制、诊断包、**能力目录视图**、收藏管理器、恢复默认）
- ✅ 单测 39 文件 254 用例（含契约一致性强制 + path-guard/幂等/别名/认领回归 + 广播可观测性/EOF 尾帧/健康会话/停机等待/启停串行/迟到锁释放/设置页无障碍回归）
- ✅ E2E U1~U11 + e2e-bg 7 项（含前端 bundle 判别）
- ⬜ Playwright 视觉走查、双窗口手动矩阵、大库联调（需真机；R270 实证：IAB webview 无法启动思源 Web 应用——boot 后即断连占位页，页面内 API 正常但应用 JS 崩溃——视觉走查需桌面端或独立 Playwright+Chromium）
- ✅ Release v0.7.2 正式版；v0.8.1/v0.8.2 GitHub prerelease 与 package.zip、SHA-256、SBOM 校验资产已同步
- ✅ R231~R251 增量：路径安全守卫（L628）、写 op 统一审计（L446）、幂等注册表（L599）、桥消费权认领（L452）、命令搜索别名（L471）、收藏/最近使用 ops+UI（L472/474）、内置 Agent 原生能力（R245）、MCP 规范 annotations（R234）

## M3+（评估池，均有前置门槛）
- MCP 通道 → **✅ 已完成（R42~R85 五个增量+真机 e2e）**：MCP 真 e2e 全链通过（三通道经真实前端消费，R81）；npm 打包脚手架（build:mcp）；CI 护栏（协议冒烟进 CI）。v0.9.1 追加：bundle 态含端口自动发现（SMOKE_TARGET 验证 7/7 live recorded）；**真 AI host 实测=协议层已闭环，app 内端到端待各客户端重启验证（Codex/Claude Code/ZCode 配置已写入）**；⬜ npm registry 发布（需账号）
- **思源内置 Agent 集成** ◐（R244/R245）：原生能力注册 ✅ 已实现并真机验证（3.8.6 siyuan.agent.registerCapability，ping/discover/capture；v0.9.1 部署后内核日志 Agent 注册 3/3）；⬜ Agent 会话端到端（需思源 AI 配置接模型；内核需 ≥3.8.7-alpha.4 以规避 MCP 客户端连接 bug #19998——本机 3.8.7-alpha.6 已满足）
- 菜单 schema v3（收藏动态组，设计=docs draft；**挂 L157 showmenu 动态菜单实测**）
- 协议 v2 按写者分文件（评估=docs draft 裁定暂不立项，触发条件在案）
- 笔记本级写权限分级（第二先例：siyuan-bridge-skill forbidden_notebooks）
- doc.resolve（hpath 寻址，备选池）
- OpenAPI 3 文档 → **◐ v0.9.1 已有工具 schema 导出器产出 OpenAPI 3.1 投影（tools/export-toolschema.mjs）**；集市上架门槛后再入正式文档
- i18n 双语（集市上架门槛后）
