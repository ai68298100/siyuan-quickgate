# WALKTHROUGH — M0 spike 实证记录

> 状态标记：⬜ 待实证 · ✅ 已实证（含结论与日期） · ◐ 部分实证 · ❌ 证伪（附替代方案）
> 规则：每一项实证后立即回填本文件与对应源码；未实证的代码路径必须保持"探测失败自动降级"。
> **环境（2026-10-02 实测更正）**：内核 `http://127.0.0.1:6806`（默认端口；早前记录的 1568 已过时）、内核版本 **3.8.5**、Token 在 `%APPDATA%\siyuan\env`（`SIYUAN_TOKEN=`/`SIYUAN_URL=`）。快门 **v0.6.6** 已部署至 `data/plugins/siyuan-quickgate/` 并经 `/api/petal/setPetalEnabled` 启用（桥与广播快路径默认关；前端窗口内运行的仍是启用时刻加载的版本，重启后生效最新）。下文 `$TOKEN` 即该值。
> 内核侧 spike（⑥⑧⑨⑩⓪⑤）已由自动化探针执行（2026-10-02）；前端侧 spike ①②⑦ 已用本机 bundle 静态核实（R26/R27，**不需要 DevTools**）：grep `D:\biji\SiYuan\resources\stage\build\app\` 编译产物可直接核实前端假设——这是实际运行的代码，比远端源码更硬。剩余 DevTools 现场：④ 多窗口 Web Lock、⑦ blockId 光标爬升、⑪ 事件现场、① 可选复核。
> **重启复测一键化（R24，R65 收敛入 npm scripts）**：思源重启后跑 **`npm run verify:restart`**（即 `node tools/verify-restart.mjs`，自动读 env；`SIYUAN_LOG=<工作空间>/temp/siyuan.log` 可附产 §10-10 日志增长读数）——③桥端到端含延迟 / ⑩⓪负向鉴权+路由 ping+events.list+降级 / ⑪事件物化计数 / ⑤广播存活 / **v1.5 postMessage→回执延迟测量** / **MCP 内核路由**。自主层一条 **`npm run accept`**（单测+MCP 协议冒烟）。手工单发广播命令可用 **`lv-cli.mjs fast`**（postMessage 推信封→qg-cmd 频道，回执算 e2eMs；`--channel` 可换频道自测 HTTP 层）。

## ① 命令注册表形状 ✅（2026-10-02，bundle 静态核实；原 DevTools 尾巴全部钉住）
- **静态已钉（v0.5.8）**：命令身份=`ICommand.langKey`（官方 app/src/types/index.d.ts；不存在 command/id——此前误读致列表为空）；文本=langText→`i18n[langKey]`；回调五形态（callback/globalCallback/execute 可外部执行，editor/dock/fileTree 标 focusOnly）
- **bundle 实证（R27，本机 3.8.5 安装产物 common.js）**：
  - Plugin 基类构造器 `this.i18n=We.i18n,this.displayName=We.displayName,this.commands=[]`——**p.i18n/p.displayName 挂载成立**，标题代取链有效 ✓
  - `addCommand(c)`：以 `(name, langKey, c.hotkey, c.hotkeys)` 解析后**就地回写** `c.hotkey`=解析默认值、`c.customHotkey`=用户生效键（keymap 查 langKey，身份=langKey 再证）；`customHotkey` 非字符串者报错并从 commands **移除** ✓
  - `window.siyuan.ws.app.plugins` 数组遍历路径官方自身多处使用 ✓；官方对命令快捷键的消费就是读 `customHotkey`
  - 校准点"hotkeys[] 是否常见"→ 结论：`hotkeys[]` 只是声明形态，运行时真值是宿主回写的 `customHotkey`/`hotkey`——registry v0.6.3 起 accelerator 优先级改为 customHotkey > hotkey > hotkeys[]
- DevTools 现场步骤保留（可选复核，无校准负债）：
  ```js
  console.table(window.siyuan.ws.app.plugins.map(p => ({name: p.name, ver: p.version, cmds: p.commands?.length})))
  ```
- 影响：src/services/registry.ts（v0.6.3 更新+证据注释）；测试覆盖三级优先级
- 结论：注册表探测链全部静态坐实，无剩余假设

## ⑥ petal/loadPetals 形状 ✅（2026-10-02，内核 3.8.5 真机自动探测）
- 实证：`POST /api/petal/loadPetals {frontend:"desktop"}` → `data:[{name, displayName, version, enabled, incompatible, disabledInPublish, userDisabledInPublish, disallowInstall, js(完整源码内嵌)…}]`
- registry.list 合并所需字段（name/version/enabled）全部吻合 ✓；注意响应内嵌 js 源码体积大，消费方应尽早截断
- 本工作空间实装名单与生态清单校准一致：雷切 0.44.1 / 打卡 18.16.0 / 人脉 0.4.1（快门 v0.5.9 已部署启用）
- 结论：registry.list 与设置页生态清单对照无需再改

## ② confirm API ✅（2026-10-02，bundle 静态核实）
- 实证（3.8.5 common.js）：宿主 `confirm` 为**回调式、无返回值（void）、无自动超时**——确认按钮 `confirmCB(dialog)` 后 destroy；**Esc/取消按钮仅 destroy，3.8.5 取消分支未见回调调用**
- 校准结论：confirmWithFront 的 **30s 自制超时必要**（对话框可无限期停留；取消路径可能不触发任何回调，超时是唯一兜底 resolve(false)）；现有第 4 参 cancel 回调无害（不被触发时超时兜底，被触发时提前 resolve）
- DevTools 现场步骤保留（可选复核）：`confirm("t","c",()=>console.log("ok"))` 观察返回值
- 影响：src/index.ts confirmWithFront（契约一致，仅补证据注释）
- 结论：无需行为修改

## ③ 桥文件端到端 ⬜
- 计划：设置页开桥 → `node tools/lv-cli.mjs ping`
- 验收：<2s 收到 pong（含 pollMs/版本）
- 结论：（待填）

## ④ Web Lock 多窗口单消费 ⬜
- 计划：同工作空间开两个思源窗口（多窗口模式），两窗口都启用快门 → `lv-cli.mjs ping` 连发 3 条
- 验收：每条命令只被一个窗口消费（回执仅一份、无重复执行）
- 结论：（待填）

## ⑤ SSE/WS 广播可用性 ✅（2026-10-02，3.8.5 真机自动探测——无需内核重启/无需前端）
- 实证：`POST /api/broadcast/postMessage {channel:"qg-spike5",message}` → code:0（频道自动创建）；`GET /es/broadcast/subscribe?channel=qg-spike5`（SSE）→ 200 text/event-stream，**推送消息约 1s 内送达**（`id:35\nevent:qg-spike5\ndata:ping-sse\n\n`）；均以 Token 头鉴权生效
- 结论：**v1.5 push 通道技术前提成立**（毫秒级、Token 鉴权、频道按名自治）。立项细化：外部客户端 postMessage 推命令到约定频道 ↔ 快门前端 SSE 订阅消费（与 NDJSON 慢路径并存，频道命名/鉴权粒度见 TODO M3）
- 备注：`GET /api/broadcast/getChannels` 200 但响应空体（小怪癖，不阻塞）

## ⑦ editor.context 字段校准 ◐（2026-10-02，本机 bundle 静态核实；**发现并修复 bug#7**；DevTools 现场部分待补）
- **静态核实法**（DevTools 不可用时的替代证据链）：直接 grep 本机安装的编译产物 `D:\biji\SiYuan\resources\stage\build\app\common.js`——这是实际运行的代码
- **bug#7**：`data-doc-id` 属性在整个 bundle 中不存在（只有 `data-doc-type`）→ readEditorContext 主路径恒空，一直在靠 fallback 工作；v0.6.2 修复
- 实证（bundle 内联证据）：
  - `.protyle` 容器自带 `data-node-id`=rootID（Protyle 类加载路径 `this.element.setAttribute("data-node-id", i.block.rootID)`，与 `fn__none` 切换同一方法）→ docId 主路径
  - `.protyle-title` 元素在 render 时 `setAttribute("data-node-id")` → fallback 有效
  - 标题文本官方读取路径是 `title.editElement.textContent.trim()`（即 `.protyle-title__input`）→ rootTitle 改为优先读它
  - `fn__none` 由 Protyle 类在 tab 切换时 add/remove → `:not(.fn__none)` 过滤有效；官方自身不使用该选择器（走 `window.siyuan.layout` 树），但语义正确
- 计划中的 DevTools 现场步骤保留（选中块/光标路径现场确认）：
  ```js
  const siyuan = window.siyuan; // 依次核对：
  siyuan.editor ?? Object.values(siyuan.ws.app.plugins).length
  document.querySelector(".layout__center .protyle:not(.fn__none)")?.dataset?.nodeId   // docId?
  window.siyuan.block?.id || document.querySelector(".protyle-wysiwyg--select")?.dataset?.nodeId // 选中块?
  getSelection().toString()
  ```
- 影响：src/index.ts readEditorContext（v0.6.2 已修复并内联证据注释）
- 结论：docId/rootTitle 选择器已静态坐实；blockId 光标爬升逻辑（wysiwyg 块普遍带 data-node-id，bundle 佐证）与现场行为待 DevTools 补验

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
