# ROADMAP

> 里程碑与验收对应项目主仓库 TODO §5；此处只列本仓库视角的顺序与门槛。
> 状态（2026-10-02，v0.6.3）：**内核侧 spike 全部自动探针完成**（⑥⑧⑨⑩⓪⑤，2026-10-02）；前端 spike ①②⑦ 已用"本机安装 bundle 静态核实"坐实（v0.6.2/v0.6.3，bug#7 即此法产出）；快门已部署真机工作空间并启用（桥/广播默认关）。剩余真机项：内核重启复测批（verify-restart.mjs）+ DevTools 现场三项（④/⑦blockId/⑪）。

## M0 spike（需思源真机，半天）→ 产出 docs/WALKTHROUGH.md（现为 11 项实操手册）
① 命令注册表形状 ✅bundle 静态核实（v0.6.3：i18n/displayName 挂载+customHotkey 回写机制；DevTools 可选复核）
② confirm API 签名与超时 ✅bundle 静态核实（v0.6.3：回调式无自动超时→30s 兜底必要）
③ 桥文件端到端 <2s ✅工具就绪（lv-cli.mjs ping；**待内核重启后 verify-restart.mjs 一键复测**）
④ Web Lock 多窗口单消费（需 DevTools/双窗口现场）
⑤ SSE/WS 广播可用性 ✅真机实证（v0.6.0 据此实现 v1.5 广播快路径）
⑥ petal/loadPetals 形状 ✅真机自动探针（registry.list 合并吻合）
⑦ editor.context 字段校准 ◐bundle 静态坐实（v0.6.2 修 bug#7：docId=容器 data-node-id；blockId 爬升待现场）
⑧ 日记笔记本自动发现字段 ✅真机探针（bug#6 修复 v0.5.9/v0.6.1）
⑨ storage/local 同步边界 ✅单机通过（D-0006 技术可行；多端隔离待第二设备）
⑩ **内核同步路由校准** ◐（⓪无 Token→401 ✓；功能面待内核重启复测）
⑪ **event-deleted 物化验证**（待内核重启后 verify-restart 批 + 现场事件）

## M1 校准回填（半天，spike 后）
- ✅ registry/editor.context/discoverConfig 已按 bundle/真机形状回填（v0.5.9~v0.6.3）
- D-0006 桥目录迁移（spike⑨ 单机通过；多端隔离补验后即迁）
- ✅ v1.5 广播通道已实现（v0.6.0；联调待内核重启复测批）

## M2 完整性（✅ 主体已在 v0.2.0~v0.5.5 提前完成）
- ✅ 设置页全功能（桥开关/轮询/确认/透传/允许名单/黑名单/队列状态/清空/回执/审计/诊断包/生态清单对照）
- ✅ 单测 15 文件 86 用例（含契约一致性强制）
- ✅ E2E U1~U11（events 与内核路由探针就绪）
- ⬜ Playwright 视觉走查、双窗口手动矩阵、大库联调（需真机）
- ⬜ Release 正式版（spike 全绿后 v1.0.0-rc；当前为预发布序列）

## M3+（评估池，均有前置门槛）
- MCP 通道（spike 后评估；对标 Sisyphus，差异化=小驴生态能力面）
- 笔记本级写权限分级（第二先例：siyuan-bridge-skill forbidden_notebooks）
- doc.resolve（hpath 寻址，备选池）
- OpenAPI 3 文档（集市上架门槛后）
- i18n 双语（集市上架门槛后）
