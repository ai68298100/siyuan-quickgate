# ROADMAP

> 里程碑与验收对应项目主仓库 TODO §5；此处只列本仓库视角的顺序与门槛。
> 状态（2026-10-02，v0.5.5）：M0 真机 spike 待用户执行；M1/M2 主体已提前实现完毕，仅剩 spike 校准回填与真机项。

## M0 spike（需思源真机，半天）→ 产出 docs/WALKTHROUGH.md（现为 11 项实操手册）
① 命令注册表形状 ✅代码就绪（registry.ts 探测链，spike 校准字段）
② confirm API 签名与超时 ✅代码就绪（confirmWithFront 30s 自制超时）
③ 桥文件端到端 <2s ✅工具就绪（lv-cli.mjs ping）
④ Web Lock 多窗口单消费
⑤ SSE/WS 广播可用性（v1.5 决策）
⑥ petal/loadPetals 形状（设置页生态清单对照依赖它）
⑦ editor.context 字段校准
⑧ 日记笔记本自动发现字段
⑨ storage/local 同步边界（决定 D-0006 迁移）
⑩ **内核同步路由校准**（v0.5.0 实验通道转正决策；curl 就绪）
⑪ **event-deleted 物化验证**（兼验 v0.5.2 window 订阅通道修正）

## M1 校准回填（半天，spike 后）
- registry/editor.context/dailyStatus/discoverConfig 按真机形状回填（代码已带降级，不阻塞）
- D-0006 桥目录迁移（spike⑨ 通过则改配置即迁）
- v1.5 广播通道立项（spike⑤ 通过才做）

## M2 完整性（✅ 主体已在 v0.2.0~v0.5.5 提前完成）
- ✅ 设置页全功能（桥开关/轮询/确认/透传/允许名单/黑名单/队列状态/清空/回执/审计/诊断包/生态清单对照）
- ✅ 单测 12 文件 70 用例（含契约一致性强制）
- ✅ E2E U1~U11（events 与内核路由探针就绪）
- ⬜ Playwright 视觉走查、双窗口手动矩阵、大库联调（需真机）
- ⬜ Release 正式版（spike 全绿后 v1.0.0-rc；当前为预发布序列）

## M3+（评估池，均有前置门槛）
- MCP 通道（spike 后评估；对标 Sisyphus，差异化=小驴生态能力面）
- 笔记本级写权限分级（第二先例：siyuan-bridge-skill forbidden_notebooks）
- doc.resolve（hpath 寻址，备选池）
- OpenAPI 3 文档（集市上架门槛后）
- i18n 双语（集市上架门槛后）
