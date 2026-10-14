# ROADMAP

> 里程碑与验收对应项目主仓库 TODO §5；此处只列本仓库视角的顺序与门槛。
> 状态（2026-10-14，v0.9.3 发布线）：**生态公开契约 39 op / MCP 默认 22 只读**——拾遗/管家/考试/常用已接入；manifest 8 款、7 stable + 1 design。本轮整合 R364~R369 的捕获确认、公开安装与调用条件检查、MCP 输入校验及重载误报修复；最新验证以 PROGRESS 与命令输出为准。人脉当前支持 v1，v2 明确返回 unsupported。双窗口、现场 blockId、多设备/Android、真实 AI host 应用内与 Agent 会话仍独立待验。集市继续暂缓。

## 当前开发状态与后续顺序（R366 / 调研 R10）

1. 本地工程基线已完成：平台注入、发布包门禁、调度与账本解析；远端 CI 仍待提交后重跑。
2. 已交付：同源表单校验、插件状态入口、捕获核验与确认、已填写调用示例；捕获已取得独立靶场证据。
3. 首跑只读探针异常分账已补（R367），公开安装状态与表单调用条件预检已补（R368）；下一批优先人脉 v2 的身份/ref/逐项回执契约，再推进公开业务配置、上下文/写入影响和失败关联。首跑完成门槛与显式跳过语义继续独立评估。
4. 继续补真实宿主与首个用户使用闭环。会话内表单暂存列评估池，持久自动化保持原门槛。

正式调研与验收条件：[生态调研 R10](https://github.com/ai68298100/siyuan-quickgate/blob/main/design/docs/10-生态调研-R10.md)。

R366 已交付快速捕获样板的目标核验/确认、首跑写入边界和已填写调用示例；捕获独立靶场交互 16/16。R368 再补 21 表单检查（其中 18 个生态 op 检查公开安装/方法/协议），业务配置和当前文档仍未核验；R10-C/D/E/F 的完整范围与真实设备验收保留。当前开发侧未完成 149 项（含候选与部分实现），其它阻塞 72 项；分流见 [R366](https://github.com/ai68298100/siyuan-quickgate/blob/main/design/docs/38-待办梳理与本轮执行-R366.md) 与 [R368](https://github.com/ai68298100/siyuan-quickgate/blob/main/design/docs/40-公开安装状态与命令预检-R368.md)。

最新自动化验收为 46 文件/375 测试、离线 MCP 6/6 与 check 全绿（R369/R370）；v0.9.3 隔离靶场 UI 16/16、受保护内核三通道 9/9、MCP live 7/7，实际重载误报零次。GitHub CI 结果见 PROGRESS。真实断网、全部模板、Android/多窗口和 Quicker 作者链仍待验。账本 1474 项，完成 1252，未完成 222（开发 149、其它 73）；新增上游鉴权元数据缺口 P0，外部面须配置宿主访问授权码。人脉 v2 适配继续为 P0，未因部分预检补齐关闭原“必须完成首跑”任务。

Quicker 作者链增量 R365：官方 MCP 与 Codex 动作助手已查明，本机 Quicker 2.3.2.0 MCP/写入开启且接口可达，Codex 插件尚未安装。后续按用户接入要求走官方插件→会话工具发现→测试暂存动作保存/读回/预览→快门只读样板；创建与运行证据分开，详情见 [接入核验](https://github.com/ai68298100/siyuan-quickgate/blob/main/design/docs/37-Quicker-MCP-Codex接入核验.md)。不另造作者服务器，R364 产品待办继续保留。

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
⑪ **事件物化验证** ◐（v0.7.3 真机验收含 recorded 物化闭环；deleted 现场复测仍待验，见 WALKTHROUGH⑪）

## M1 校准回填（半天，spike 后）
- ✅ registry/editor.context/discoverConfig 已按 bundle/真机形状回填（v0.5.9~v0.6.3）
- D-0006 桥目录迁移（spike⑨ 单机通过；多端隔离补验后即迁）
- ✅ v1.5 广播通道已实现（v0.6.0；联调待内核重启复测批）

## M2 完整性（✅ 主体已在 v0.2.0~v0.7.x 完成）
- ✅ 设置页全功能（桥/移动端/广播开关、轮询、确认、透传+允许名单、黑名单、队列状态、清空预览、回执、审计筛选+复制、诊断包、**能力目录视图**、收藏管理器、恢复默认）
- ✅ 单测覆盖契约一致性、路径/幂等/认领、广播、生命周期、设置页与输入校验；文件/用例数以最近一次 `pnpm test` 输出为准。
- ✅ E2E U1~U11 + e2e-bg 7 项（含前端 bundle 判别）
- ✅ v0.9.0 独立 Chromium 视觉/交互与窄屏走查；⬜ 双窗口手动矩阵、大库联调、真实 Android（预览/浏览器模拟不能代替相应宿主证据）。
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
