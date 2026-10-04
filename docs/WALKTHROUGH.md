# WALKTHROUGH — M0 spike 实证记录

> 状态标记：⬜ 待实证 · ✅ 已实证（含结论与日期） · ◐ 部分实证 · ❌ 证伪（附替代方案）
> 规则：每一项实证后立即回填本文件与对应源码；未实证的代码路径必须保持"探测失败自动降级"。
> **环境（2026-10-02 实测更正）**：内核 `http://127.0.0.1:6806`（默认端口；早前记录的 1568 已过时）、内核版本 **3.8.6**、Token 在 `%APPDATA%\siyuan\env`（`SIYUAN_TOKEN=`/`SIYUAN_URL=`）。快门 **v0.7.3+（未发布构建随 R 轮部署）** 已部署至 `data/plugins/siyuan-quickgate/` 并启用；**外部命令桥与广播快路径已开启（R70 代开，用户可随时在设置页关回）**。下文 `$TOKEN` 即该值。
> **M0 spike 复测收官（R70，2026-10-02）**：`npm run verify:restart` **9/9 全绿**——③桥 444ms / ⑩⓪ 401 / ⑩内核路由功能面（bug#9 修复后）/ ⑤广播 / **v1.5 真机 227ms** / MCP 内核路由 / §10-10 日志 +254B。唯余：⑪（需在打卡里记/删一条）、④多窗口与 ⑦blockId/①复核（DevTools 现场）。
> **MCP 真 e2e 全链首次通过（R110，2026-10-03）**：三通道（广播快路径/内核路由/NDJSON）全部经真实前端消费——bridge.ping / registry.list / editor.context / daily.status 四 op 全 recorded。v0.7.2 解除 pre-release 转正式版。系统进入全功能验证态。
> **CI 容器化内核侧验收上线（R105，2026-10-03）**：GitHub Actions ubuntu + b3log/siyuan docker（serve 子命令+bypass+预置 conf：api.token/bazaar trust）→ **⑩路由 kernel-sync/events.list/降级/MCP registry.list 301ms 全 recorded**（⑥⑧⑨ 内核侧事实在容器复现）；③⑤v1.5/⑪ 需前端环境（本机 verify:restart 覆盖）。手动触发：`gh workflow run ci-e2e-experiment.yml`。十轮诊断全记录见 workflow 文件与该分支历史。
> 内核侧 spike（⑥⑧⑨⑩⓪⑤）已由自动化探针执行（2026-10-02）；前端侧 spike ①②⑦ 已用本机 bundle 静态核实（R26/R27，**不需要 DevTools**）：grep `<思源安装目录>\resources\stage\build\app\` 编译产物可直接核实前端假设——这是实际运行的代码，比远端源码更硬。剩余 DevTools 现场：④ 多窗口 Web Lock、⑦ blockId 光标爬升、⑪ 事件现场、① 可选复核。
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

## ③ 桥文件端到端 ✅（2026-10-02，3.8.6 真机 + v0.7.1）
- 实证：外部命令桥开启（bridge-settings bridgeEnabled=true，经设置文件代开+toggle 重载生效）后 `npm run verify:restart` → **③ 桥文件端到端 444ms/614ms/1797ms status=recorded**（三次运行均 <2s 验收线）
- 附：§10-10 同批复测内核日志增长仅 +254~2163B——**500ms 轮询不刷屏内核日志**（决策 §10-10 数据到手）
- 结论：✅；用户可随时在设置页关回（默认关红线不变）

## ④ Web Lock 多窗口单消费 ◐（R232：单窗口认领已实现——startBridge 先认领 siyuan-quickgate-bridge，被占用拒绝启动；双窗口实测待两开验证）
- 计划：同工作空间开两个思源窗口（多窗口模式），两窗口都启用快门 → `lv-cli.mjs ping` 连发 3 条
- 验收：每条命令只被一个窗口消费（回执仅一份、无重复执行）
- 结论：（待填）

## ⑤ SSE/WS 广播可用性 ✅（2026-10-02，3.8.5 真机自动探测——无需内核重启/无需前端）
- **v1.5 真机联调 ✅（2026-10-02，3.8.6 + v0.7.1 开桥后）**：postMessage(qg-cmd) → 前端 SSE 订阅 → 执行 → 回执落盘 **227ms**（诊断实验 319ms；verify-restart 每轮复现）。联调前提=「外部命令桥」+「广播快路径」两开关开启（设置文件代开+toggle 重载生效）；**复测批需在订阅建立后运行**（toggle 后 8s 内跑会误报跳过——时序敏感点已验证）
- 实证：`POST /api/broadcast/postMessage {channel:"qg-verify",message}` → code:0（频道自动创建）；`GET /es/broadcast/subscribe?channel=qg-spike5`（SSE）→ 200 text/event-stream，**推送消息约 1s 内送达**（`id:35\nevent:qg-spike5\ndata:ping-sse\n\n`）；均以 Token 头鉴权生效
- 结论：**v1.5 push 通道真机全线打通**（毫秒级、Token 鉴权、频道按名自治）；与 NDJSON 双通道幂等竞态由预留语义保证（单测覆盖），真机重复推演可随时重跑 verify-restart

## ⑦ editor.context 字段校准 ◐（2026-10-02，本机 bundle 静态核实；**发现并修复 bug#7**；DevTools 现场部分待补）
- **静态核实法**（DevTools 不可用时的替代证据链）：直接 grep 本机安装的编译产物 `<思源安装目录>\resources\stage\build\app\common.js`——这是实际运行的代码
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

## ⑩ 内核同步路由校准 ✅（2026-10-02，3.8.6 真机 v0.7.1 全线打通）
- ⓪ **无 Token → HTTP 401** ✓（3.8.6 复确认；Token 头是唯一防线）
- **bug#9（本 spike 的真因）**：plugin.json 缺 `kernels` 字段——内核按该字段判定是否加载 kernel.js，缺字段则内核侧名单（isKernel=true）从不包含插件，路由对全部用户 404；对照 docktomato（有 `"kernels":["all"]`）实证。补字段后 **toggle petal 开关即热加载**（无需重启）
- 功能面全绿（v0.7.1 复测批）：路由 ping `channel=kernel-sync` ✓ / events.list 白名单=8 ✓ / 前端专属 op 诚实降级（消息指引 NDJSON）✓ / **MCP registry.list 经 exec isError=false** ✓
- 结论：✅ **内核路由功能面收官**（v0.5.0 实验通道转正依据成立）；前端中继仍按 D-0010 暂缓

## ⑪ event-deleted 物化验证 ⬜（v0.5.4 新增订阅）

## ⑫ 前端加载判别与热重载接管 ⬜（R234/R239 新增 · bug#15）
- 判别式：NDJSON 发 favorites.list → recorded=新前端；「未知 op」=旧 bundle（Electron 模块缓存，**需托盘完全退出后重启**，窗口重开无效——进程实证主进程 16:06 起未退）
- 已布防：构造器所有权令牌 + 3s onload 自检自愈（实测未被 push_reload 路径触发，机制待 DevTools）
- 走查步骤：完全退出 → 重启 → 跑 e2e-bg（「前端 bundle 判别」项应 pass）→ favorites.add/list/remove 全链
- 计划：装打卡 ≥18.16 → 打卡里删除一条打卡记录 → 检查
  `curl -s http://127.0.0.1:1568/api/file/getFile -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\"path\":\"/storage/petal/siyuan-checkin/bridge/events.ndjson\"}"`
- 验收：出现 `name:"checkin:event-deleted"` 行，幂等键以 `:deleted` 结尾；同时 `events.pull`（内核路由或 NDJSON）能拉到它
- 备注：本项同时验证 v0.5.2 的 window CustomEvent 订阅通道修正——若 recorded 行也从未出现，优先排查通道
- 结论：（待填）
