# WALKTHROUGH — M0 spike 实证记录

> 状态标记：⬜ 待实证 · ✅ 已实证（含结论与日期） · ◐ 部分实证 · ❌ 证伪（附替代方案）
> 规则：每一项实证后立即回填本文件与对应源码；未实证的代码路径必须保持"探测失败自动降级"。
> **环境（2026-10-02 实测更正）**：内核 `http://127.0.0.1:6806`（默认端口；早前记录的 1568 已过时）、内核版本 **3.8.5**、Token 在 `%APPDATA%\siyuan\env`（`SIYUAN_TOKEN=`/`SIYUAN_URL=`）。快门 v0.5.9 已部署至 `data/plugins/siyuan-quickgate/` 并经 `/api/petal/setPetalEnabled` 启用（桥默认关）。下文 `$TOKEN` 即该值。
> 内核侧 spike（⑥⑧⑨⑩⓪）已由自动化探针执行（2026-10-02）；前端侧（①②④⑤⑦⑪）需思源窗口内 DevTools。

## ① 命令注册表形状 ⬜
- **静态已钉（v0.5.8）**：命令身份=`ICommand.langKey`（官方 app/src/types/index.d.ts；不存在 command/id——此前误读致列表为空）；文本=langText→`i18n[langKey]`；回调五形态（callback/globalCallback/execute 可外部执行，editor/dock/fileTree 标 focusOnly）
- 计划：思源 DevTools 控制台执行
  ```js
  console.table(window.siyuan.ws.app.plugins.map(p => ({name: p.name, ver: p.version, cmds: p.commands?.length})))
  window.siyuan.ws.app.plugins.find(p=>p.name==="siyuan-speed-switch").commands?.slice(0,5)
  ```
- 校准点：langKey 形态确认；`p.displayName`/`p.i18n` 是否如预期挂在实例上（挂不上则标题回退 id）；hotkeys[] 是否常见
- 影响：src/services/registry.ts 探测链与 commands.list/search 输出形状
- 结论：（待填——需前端 DevTools）

## ⑥ petal/loadPetals 形状 ✅（2026-10-02，内核 3.8.5 真机自动探测）
- 实证：`POST /api/petal/loadPetals {frontend:"desktop"}` → `data:[{name, displayName, version, enabled, incompatible, disabledInPublish, userDisabledInPublish, disallowInstall, js(完整源码内嵌)…}]`
- registry.list 合并所需字段（name/version/enabled）全部吻合 ✓；注意响应内嵌 js 源码体积大，消费方应尽早截断
- 本工作空间实装名单与生态清单校准一致：雷切 0.44.1 / 打卡 18.16.0 / 人脉 0.4.1（快门 v0.5.9 已部署启用）
- 结论：registry.list 与设置页生态清单对照无需再改

## ② confirm API ⬜
- 计划：控制台分别试 `confirm("标题","正文",()=>console.log("ok"))`（思源全局）与 `window.siyuan.ws.app.plugins[0]...`；观察返回值是 Promise 还是仅回调
- 校准点：confirmWithFront 的 30s 自制超时是否必要、resolve 语义
- 影响：src/index.ts confirmWithFront
- 结论：（待填）

## ③ 桥文件端到端 ⬜
- 计划：设置页开桥 → `node tools/lv-cli.mjs ping`
- 验收：<2s 收到 pong（含 pollMs/版本）
- 结论：（待填）

## ④ Web Lock 多窗口单消费 ⬜
- 计划：同工作空间开两个思源窗口（多窗口模式），两窗口都启用快门 → `lv-cli.mjs ping` 连发 3 条
- 验收：每条命令只被一个窗口消费（回执仅一份、无重复执行）
- 结论：（待填）

## ⑤ SSE/WS 广播可用性 ⬜（v1.5 通道决策前置）
- 计划：DevTools 里 `new WebSocket("ws://127.0.0.1:1568/ws/broadcast")`（带/不带 Token 两种）观察握手与消息；SSE 同理 `curl -N http://127.0.0.1:1568/sse/broadcast -H "Authorization: Token $TOKEN"`
- 验收：能收到内核广播即通过 → v1.5 push 通道立项；否则维持 pull-only
- 结论：（待填）

## ⑥ petal/loadPetals 形状 ⬜
- 计划：`curl -s http://127.0.0.1:1568/api/petal/loadPetals -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"frontend\":\"desktop\"}" | head -c 2000`
- 校准点：条目字段名（name/version/enabled？）、`frontend` 参数语义（不带参数 vs desktop vs mobile 的差异）
- 影响：registry.list 合并逻辑、设置页生态清单对照
- 结论：（待填）

## ⑦ editor.context 字段校准 ⬜
- 计划：打开一篇文档，光标置于块内，控制台检查
  ```js
  const siyuan = window.siyuan; // 依次核对：
  siyuan.editor ?? Object.values(siyuan.ws.app.plugins).length
  document.querySelector(".layout__center .protyle:not(.fn__none)")?.dataset?.nodeId   // docId?
  window.siyuan.block?.id || document.querySelector(".protyle-wysiwyg--select")?.dataset?.nodeId // 选中块?
  getSelection().toString()
  ```
- 校准点：readEditorContext 五个选择器的真实性（docId/rootTitle/blockId/selectedText）
- 影响：src/index.ts readEditorContext
- 结论：（待填）

## ⑧ 日记笔记本自动发现字段 ✅（2026-10-02，3.8.5 真机；**发现并修复 bug#6**）
- 实证：`getNotebookConf` → `conf.**dailyNoteSavePath**`（驼峰大写 N；旧代码读 `dailynoteSavePath` 全小写 → 自动发现恒失败，v0.5.9 修复）
- **歧义发现**：3.8.5 所有笔记本都带相同默认模板 `/daily note/{{now | date "2006/01"}}/…`——"非空即日记"启发式失效
- 校准：discoverConfig/kernelConfigDiscover 改两级消歧——恰一候选直接命中；多候选时 renderSprig 渲染当日 hpath + listDocsByPath 查今日日记文档真实存在，恰一命中才判定，否则 null+说明（本工作空间三笔记本同值且均无今日日记 → 诚实回退手填 ✓）
- 结论：已修复并测试覆盖；真机消歧路径随内核侧验证

## ⑨ storage/local 同步边界与文件 API 可达性 ◐（2026-10-02，单机部分通过）
- 实证（3.8.5 真机）：`/storage/local/siyuan-quickgate/probe.txt` putFile 200 + getFile 200 回读一致 ✓——**D-0006 迁移技术可行**
- ⬜ 剩余：第二设备/同步对端确认 `/storage/local/` 不随同步复制（单机无法验证）
- 结论：单机可达性通过；多端隔离待补验后即可执行 D-0006 迁移

## ⑩ 内核同步路由校准 ◐（2026-10-02，安全基线通过；handler 待内核重启）
- 实证（v0.5.9 已部署进工作空间 `data/plugins/siyuan-quickgate/` 并 setPetalEnabled 启用）：
  - ⓪ **无 Token → HTTP 401** ✓（Token 头是唯一防线，CSRF 基线成立；鉴权在私有路由基础设施层，先于插件 handler）
  - 私有路由基础设施可达：`/plugin/private/siyuan-quickgate/exec` 返回 `[plugin:siyuan-quickgate] not found`——**内核不热加载新启用 petal 的 kernel.js**（需内核重启）
- ⬜ 剩余：内核重启后复测（ping 应答 channel=kernel-sync / events.list / 前端 op 降级 / registry.list 内核自呼 loadPetals）——复测命令=`node tools/lv-cli.mjs exec --op bridge.ping`
- 结论：**安全基线 ✓（可安心启用）**；功能面待内核重启，路由基础设施实证可达

## ⑪ event-deleted 物化验证 ⬜（v0.5.4 新增订阅）
- 计划：装打卡 ≥18.16 → 打卡里删除一条打卡记录 → 检查
  `curl -s http://127.0.0.1:1568/api/file/getFile -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"path\":\"/storage/petal/siyuan-checkin/bridge/events.ndjson\"}"`
- 验收：出现 `name:"checkin:event-deleted"` 行，幂等键以 `:deleted` 结尾；同时 `events.pull`（内核路由或 NDJSON）能拉到它
- 备注：本项同时验证 v0.5.2 的 window CustomEvent 订阅通道修正——若 recorded 行也从未出现，优先排查通道
- 结论：（待填）
