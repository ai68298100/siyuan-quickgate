# DECISIONS

> 决策记录。编号 D-0001 起，只追加不修改；推翻旧决策时新增条目并注明。

## D-0001 · 快门=生态中枢，数据走透传而非逐插件桥（2026-10-01，源自项目评审 O1）

数据类操作由快门内置适配器转发到各插件**已有公开窗口桥**（打卡 v5 / 人脉 v1），插件零接入零发版。NDJSON 桥协议降级为无快门兜底与手机直连通道。纪律：只调用公开桥，不读私有存储（承 D-255/D-0012）。

## D-0002 · 队列正确性：按 id 记账 + 惰性压缩（2026-10-02，阻断项1）

放弃"执行后用剩余行覆盖整文件"（消费期间外部追加会丢命令）。改为：消费者持久化 processed-ids，压缩时仅移除已处理 id 的行；外部并发写回造成的行复活按 id 跳过。**不存在丢失窗口**：任何外部写回都包含其读到的全部未处理行。复活成本 = 一次跳过 + 一次压缩，可接受。备选方案（每命令独立文件/原子认领）被否：内核文件 API 无目录列举，无法枚举 inbox。

## D-0003 · 幂等台账持久化，上限 500 LRU（阻断项4）

processed-ids 存 `bridge-state.json`（schemaVersion+normalize，坏数据回空不阻断），跨重启生效；超 500 按时间淘汰最旧。淘汰窗口内的重放边界：TTL（默认 60s）远小于台账存活期，实际不可触发。

## D-0004 · 轮询器单飞（阻断项5）

`while(active){ await tick(); await delay(interval×backoff) }`，禁止 setInterval 重入；连续失败指数退避封顶 backoffMaxMs，成功复位。onunload 仅置 stop 标志，当前 tick 自然结束（不撕写）。

## D-0005 · 回执匹配按字段，等待按 op（阻断项3/8）

客户端逐行 JSON.parse 后按 `id` 字段匹配；`commands.run` 等待 ≥35s 覆盖确认窗口，超时不换 id 重试；迟到回执仍按原 id 落盘。

## D-0006 · 桥目录基路径可配置（spike⑨ 预留）

`bridgeBasePath` 默认 `/storage/petal/siyuan-quickgate/bridge`；spike⑨ 证实 storage/local 不同步且文件 API 可达后，改配置即可迁移（消解多设备消费与同步流量），协议与客户端零改动。

## D-0007 · commands.run 确认前置激活思源窗口（08-O10）

confirm 前调 `window.focus()`；30s 超时=拒绝；回执文案注明"思源在后台未确认"场景。

## D-0008 · workflow 计划不持久化（R3 评估结案，2026-10-02）

workflow.plan 生命周期 5 分钟 + 一次性语义。持久化的收益（重启后仍可 execute）与成本（额外状态文件、过期清理、多实例一致性）不匹配：重启后重新 plan 一次的成本≈0（计划本来就是客户端生成的）。结论：**保持内存池**，重启后 execute 回 `rejected`（提示重新 plan）——该行为已文档化进 api.md。

## D-0009 · events 载体由快门代为物化（R3，2026-10-02）

打卡宿主事件（checkin:event-recorded）由快门订阅公开宿主事件并**代写**到 `/storage/petal/siyuan-checkin/bridge/events.ndjson`——上游零改动即可产出事件流。纪律边界：只消费公开宿主事件；写的是快门自己维护的桥文件，不触碰打卡私有存储。上游（闪卡/考试）未来可自写（推荐）或由快门以同样模式桥接。
**通道勘误（v0.5.2，2026-10-02）**：上游发射通道是 **`window.dispatchEvent(new CustomEvent(...))`**（integrations.ts `emitIntegrationEvent`，v18.16 源码实证；打卡对 app.eventBus 只用 `loaded-protyle-*` 内部事件）。v0.4.1 曾误订 `app.eventBus` 导致永不触发，v0.5.2 改订 window 事件；detail 为包裹形状 `{type:"event-recorded", event:{…}}`，归一化兼容包裹/平铺两种。

## D-0010 · 内核路由不做前端中继（R4 评估结案，2026-10-02）

已核实官方 API（kernel.d.ts + 模板文档）：内核→前端只有**单向 broadcast**（`api.rpc.broadcast`），无同步的前端调用。前端中继技术可行（handler 挂起 resolver → broadcast 请求 → 前端 RPC 客户端执行 → 回调内核 RPC 解析），但：①前端离线需超时兜底 ②多前端竞态 ③双跳延迟与故障面。而 NDJSON 通道已覆盖前端 op（~750ms）。**结论：暂不实现中继**；内核路由保持"内核可处理子集"。重评触发：真实使用中同步性成为实测痛点（如工作流多步总耗时显著劣化体验）。

## D-0011 · analytics-updated 不订阅物化（R7，2026-10-02）

打卡 8 个契约事件中，快门订阅 event-recorded 与 event-deleted；**analytics-updated 不订阅**：它在每次记录/统计重算后高频触发，而 events.ndjson 是 200 行滚动窗口——高频心跳会把有业务价值的 recorded/deleted 行挤掉。数据变化信号由消费方轮询（events.pull / summary.read）承担。重评触发：出现明确的实时统计消费方（如雷切 home-widget 需要推送刷新）时，考虑独立载体文件或消费方侧去重后再接。item-* / suggestion-* 事件保持 observed（暂无消费场景，接入前先立 use case）。

## D-0012 · v1.5 广播快路径：与 NDJSON 共用幂等台账，预留语义（R20-R21，2026-10-02）

新增第三通道（SSE 订阅 + postMessage，毫秒级）时，防双执行不另建机制：广播与 NDJSON 共用 processed-ids 台账，**同步 check+mark 后才 await 执行**（先到者执行、后到者按 id 跳过）。`broadcastEnabled` 独立开关默认关（新外部面红线同 D-0008 精神）；断流指数退避 1s→30s。回执照常写 results.ndjson——消费方对通道无感。

## D-0013 · MCP 经独立 stdio 代理，不经插件内核（R39-R50，2026-10-02）

AI 客户端接入走 `src/mcp/` 独立代理进程（MCP stdio ↔ 内核 HTTP），**不在插件内实现 MCP server**：①Claude Desktop 主流 stdio，内核内实现受制于思源 HTTP 语义；②零插件改动、独立发版；③通道复用既有三通道（KERNEL_OPS→exec→只读 fast→NDJSON 回退链）。安全：**默认只暴露 13 个只读工具**，写工具需 `LV_MCP_WRITE=1`；快门侧防线（确认/黑名单/审计/允许名单）全共用——MCP 只是消费通道，不新增特权。与思源 3.8.6+ 内置 MCP server 并存：内置覆盖内核 CRUD，本代理独有小驴生态面。

## D-0014 · 前端假设用"本机安装 bundle 静态核实"（R26 方法论，2026-10-02）

前端 DOM/宿主 API 假设的实证，**不等 DevTools**：直接 grep 本机安装编译产物（`<思源安装目录>\resources\stage\build\app\*.js`，即实际运行代码）。bug#7（data-doc-id 不存在）与 spike①②⑦ 即此法产出；证据等级高于远端源码（版本一致），低于真机运行时（spike 现场仍保留可选复核）。适用边界：DOM 结构、宿主挂载行为；不适用于交互时序类问题（④多窗口/⑪事件现场仍需真窗口）。

## D-0015 · 审计日志跨重启持久（R47 bug#8，2026-10-02）

audit.json 此前只写不读（重启即丢历史且被覆写）——修正为 onload 加载恢复（逐条形状校验/auditMax 截尾）。原则：**凡是"持久化"命名的数据必须真的跨生命周期可读**；写入无读取路径的持久化是半实现。
