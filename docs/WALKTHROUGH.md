# WALKTHROUGH — M0 spike 实证记录

> 状态标记：⬜ 待实证 · ✅ 已实证（含结论与日期） · ❌ 证伪（附替代方案）
> 规则：每一项实证后立即回填本文件与对应源码；未实证的代码路径必须保持"探测失败自动降级"。
> 环境：本机内核 `http://127.0.0.1:1568`（非默认端口），Token 在 `%APPDATA%\siyuan\env`（`SIYUAN_TOKEN=`）。下述 `$TOKEN` 即该值；快门需先在思源集市/本地安装并开启「外部命令桥」。

## ① 命令注册表形状 ⬜
- **静态已钉（v0.5.8）**：命令身份=`ICommand.langKey`（官方 app/src/types/index.d.ts；不存在 command/id——此前误读致列表为空）；文本=langText→`i18n[langKey]`；回调五形态（callback/globalCallback/execute 可外部执行，editor/dock/fileTree 标 focusOnly）
- 计划：思源 DevTools 控制台执行
  ```js
  console.table(window.siyuan.ws.app.plugins.map(p => ({name: p.name, ver: p.version, cmds: p.commands?.length})))
  window.siyuan.ws.app.plugins.find(p=>p.name==="siyuan-speed-switch").commands?.slice(0,5)
  ```
- 校准点：langKey 形态确认；`p.displayName`/`p.i18n` 是否如预期挂在实例上（挂不上则标题回退 id）；hotkeys[] 是否常见
- 影响：src/services/registry.ts 探测链与 commands.list/search 输出形状
- 结论：（待填）

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

## ⑧ 日记笔记本自动发现字段 ⬜
- 计划：对已知日记笔记本执行
  `curl -s http://127.0.0.1:1568/api/notebook/getNotebookConf -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"notebook\":\"<笔记本ID>\"}"`
- 校准点：`conf.dailynoteSavePath` 字段是否存在、值形如 `/2026/` 还是 `2026`；config.discover 判定逻辑按实调整
- 结论：（待填）

## ⑨ storage/local 同步边界与文件 API 可达性 ⬜（D-0006 迁移决策）
- 计划：控制台/内核路由各写读一次：
  ```bash
  curl -s http://127.0.0.1:1568/api/file/putFile -H "Authorization: Token $TOKEN" -F path=/storage/local/siyuan-quickgate/probe.txt -F file=@- <<< "probe"
  curl -s http://127.0.0.1:1568/api/file/getFile  -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"path\":\"/storage/local/siyuan-quickgate/probe.txt\"}"
  ```
  再在第二台设备/同步对端确认 `/storage/local/` **不**随同步复制
- 验收：读写可达 + 多端隔离 → 桥目录迁移立项（消解多设备命令串扰 + 同步流量）
- 结论：（待填）→ 决定是否执行 D-0006 迁移

## ⑩ 内核同步路由校准 ⬜（v0.5.0 实验性路由）
- 计划：设置页确认插件启用后（无需开桥），直接打私有路由：
  ```bash
  # 0) 负向鉴权（安全基线）：不带 Token 应被 401/403 拒绝——localhost API 的 CSRF 面核实，
  #    浏览器跨源页面无法伪造 Authorization 头，此层是唯一防线
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:1568/plugin/private/siyuan-quickgate/exec -H "Content-Type: application/json" -d "{\"op\":\"bridge.ping\"}"
  # 1) ping（应答 channel=kernel-sync）
  curl -s http://127.0.0.1:1568/plugin/private/siyuan-quickgate/exec -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"op\":\"bridge.ping\"}"
  # 2) 白名单目录（v0.5.5 起支持）
  curl -s http://127.0.0.1:1568/plugin/private/siyuan-quickgate/exec -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"op\":\"events.list\"}"
  # 3) 前端专属 op 的结构化降级
  curl -s http://127.0.0.1:1568/plugin/private/siyuan-quickgate/exec -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"op\":\"commands.run\",\"args\":{\"plugin\":\"x\",\"command\":\"y\"}}"
  ```
- 校准点：⓪**负向鉴权**（无 Token 请求必须 401/403；若匿名可调=严重安全问题，立即停用路由）①路由可达性（内核是否放行插件私有路由）②请求体解析（body.data.json() 还是 text()）③内核自呼 loadPetals 行为（registry.list 是否报"unexpected kpost"）④响应包形状与 kernel.d.ts 是否一致
- 验收：①②③ 全部返回预期 JSON → 内核通道可转正为「内核可处理 op 的默认快路径」（Quicker SY·路由 探测 200 直呼）
- 结论：（待填）

## ⑪ event-deleted 物化验证 ⬜（v0.5.4 新增订阅）
- 计划：装打卡 ≥18.16 → 打卡里删除一条打卡记录 → 检查
  `curl -s http://127.0.0.1:1568/api/file/getFile -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"path\":\"/storage/petal/siyuan-checkin/bridge/events.ndjson\"}"`
- 验收：出现 `name:"checkin:event-deleted"` 行，幂等键以 `:deleted` 结尾；同时 `events.pull`（内核路由或 NDJSON）能拉到它
- 备注：本项同时验证 v0.5.2 的 window CustomEvent 订阅通道修正——若 recorded 行也从未出现，优先排查通道
- 结论：（待填）
