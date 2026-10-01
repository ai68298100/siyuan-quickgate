# ROADMAP

> 里程碑与验收对应项目主仓库 TODO §5；此处只列本仓库视角的顺序与门槛。

## M0 spike（需思源真机，半天）→ 产出 docs/WALKTHROUGH.md
① 命令注册表形状实证（校准 src/services/registry.ts 探测链）
② confirm API 签名与超时行为
③ 桥文件端到端 <2s（tools/lv-cli.mjs ping）
④ Web Lock 多窗口单消费
⑤ SSE/WS 广播可用性（v1.5 决策）
⑥ petal/loadPetals 形状
⑦ editor.context 字段校准（data-doc-id / protyle-title 选择器）
⑧ 日记笔记本自动发现字段（getConf/getNotebookConf）
⑨ storage/local 同步边界（决定 D-0006 迁移）

## M1（1~2 天）
- spike 校准回填（registry/editor.context/daily.status 的真实形状）
- R1 生态中枢扩展：registry.*（插件发现/健康）、context.* 快照完善、diagnostics.*
- 拾遗/管家/闪卡/考试 capability manifest（design 态只进 manifest 不进 adapter）

## M2（1~2 天）
- 设置页完整版（黑名单多选、审计全量、清空队列、导出诊断包、移动端适配）
- E2E（02 §8 十条 + 06 §10 六条）+ Playwright 视觉走查
- v0.1.0 Release（package.zip + 手动安装说明）

## M3（可选）
- v1.5 广播通道 / v2 内核私有路由（读模板 docs/kernel-plugin.md 后立项）
