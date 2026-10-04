# C9 生态清单合同（Ecosystem Manifest · §18.2 R124-G8 + R77 · v0 草案）

> 目的：把小驴生态插件的能力声明、事件白名单、权威数据域（source of truth）与幂等身份合并为一份**机器可校验**的清单合同；验收 = manifest 任何改动过 schema 校验门，未过不发布（R77-P1 类型门禁）。
> 状态：v0 草案——收录 **v1 已实现形状** + 定义 **v2 目标形状**（新增字段逐个标注）；校验脚本已交付（§5），TS 类型扩展与 CI 阻断挂实现仓库批（§6）。

## 0. 载体与版本线

| 载体 | 角色 |
|---|---|
| quickgate `src/assets/ecosystem-manifests.json` | 运行时唯一事实源（registry.list / events 白名单 / 设置页生态对照共用） |
| 本合同 + `ecosystem-manifest.schema.json` | 形状冻结（人读+机器双格式） |
| `scripts/validate-ecosystem-manifest.mjs`（本仓库） | 可执行校验器（零依赖，与 schema 同规则） |
| quickgate `src/services/bridge-service.ts` 的 `EcosystemManifest` 接口 | TS 消费面（当前缺 events 等字段，v2 补齐） |

- `version: 1` = 当前已发布形状（2026-10-02 R6 校准：雷切 0.44.1 / 打卡 18.16.0 / 人脉 0.4.1）。
- `version: 2` = 本合同定义的目标形状；v1→v2 迁移只**追加**字段，不改既有字段语义（桥协议铁律：能力新增只追加）。

## 1. manifest v2 插件条目 schema

| 字段 | 类型 | v1 现状 | v2 变化 | 说明 |
|---|---|---|---|---|
| `pluginId` | string | ✅ | 不变 | 上游 `plugin.json` name，精确匹配 |
| `displayName` | string | ✅ | 不变 | 人读名 |
| `maturity` | enum | ✅ | 不变 | `stable`（已发布公开契约）/ `design`（设计态）/ `unlocated`（仓库未定位）；design/unlocated 只进 manifest 与诊断，**不注册可执行 adapter** |
| `version` | string\|null | ✅ | 不变 | 上游校准基准版本（对照远端 main；null=未定位） |
| `protocol` | string\|null | ✅ | 不变 | 公开契约面，如 `window.siyuanCheckin v5` |
| `minProtocol` | string\|null | — | **新增** | 快门接入的最低协议版本（如 `v5`）；null=未接入（design/unlocated 恒 null）。future major→unsupported，unknown minor→兼容（R77 测试矩阵口径） |
| `windowBridge` | string | ✅ 可选 | 不变 | window 公开桥全局名（仅 hubIntegration 插件） |
| `sourceOfTruth` | string[] | — | **新增** | 该插件权威的数据域列表（§2 矩阵的机器面），域格式 `domain.sub` |
| `ingestion` | enum | — | **新增** | 事件物化载体：`none` / `eventFile`（`storage/petal/<id>/bridge/events.ndjson`）/ `windowEvent`（window CustomEvent）。快门 events.pull 只消费 `eventFile` |
| `eventNamespace` | string | — | **新增** | 事件名前缀（如 `checkin`、`lv-cards`）；有 `events` 必填，校验门强制 |
| `capabilities` | string[] | ✅ | 不变 | 能力名声明面（上游既有命名优先，见 §4.2） |
| `capabilitySchemas` | object | — | **新增·optional** | 逐能力参数 schema（`{ [capability]: { required?: string[], properties?: object } }`）；planned——先登记形状，逐能力补齐，不阻塞 v2 |
| `events` | array | ✅（TS 接口缺） | TS 接口**补齐** | 条目形状见下 |
| `hubIntegration` | string | ✅ | 不变 | 中枢接入方式人读说明 |

`events[]` 条目：`{ name, status: "available"|"observed"|"design", idempotency, payload?, since?, note? }`

- `status`：`available`=快门已订阅物化 / `observed`=上游广播存在、未消费 / `design`=草案（L615：DOM 事件与预留全局完成前恒 design）。
- `idempotency`：非空字符串（available 级强制，校验门）；推荐写 `source+externalRef` 派生式（§3）。
- `since`（v2 新增·optional）：该事件引入的上游版本，漂移审计用。

## 2. sourceOfTruth 权威矩阵（R77-P1·L596）

**每个数据域恰好一个权威插件；中枢（快门）只透传与聚合，不重算、不私读业务库。**

| 数据域 | source of truth | 公开契约面 | 快门角色（禁止项） |
|---|---|---|---|
| 打卡记录 / 事项 / summary | `siyuan-checkin` | `window.siyuanCheckin v5`（items.read / events.record / summary.read …） | 透传 adapter；**禁止**自行重算 streak/heatmap/月历（L597） |
| 人脉人物 / 互动 | `siyuan-contacts` | `window.LvContacts v1`（searchPeople / getPerson / ensurePerson / recordInteraction） | 透传；生日/久未联系提醒必须由 owner 公开 bounded projection 提供（L582），**禁止** SQL 猜业务口径 |
| 导航 / 工作区上下文 | `siyuan-speed-switch` | `agent-capabilities + commands`（14 能力） | 仅经 `commands.run` 命令面板条目调用 |
| 闪卡调度 / revlog | `siyuan-lv-cards`（design；R228 真机校准前误记 siyuan-flashcards） | 规划中（Gateway / `lv-cards:*`） | 等稳定 sessionId/completedAt/validCount/durationMs 才设计学习打卡（L580/L617）；**不读 revlog** |
| 考试题目 / 作答 / 统计 | `siyuan-exam`（design；R228 真机未安装） | 规划中（descriptor + `getStats()` bounded projection） | 一次性 `lv-exam:stats` **不得**驱动晚间总结或打卡（L616） |
| 拾遗状态 / 读库 | `siyuan-glean`（design；R228 真机校准前误记 siyuan-shiyi/unlocated） | 待定义（L615：读写桥+whenReady 定型前维持 design） | 不注册 adapter，只显示能力缺失诊断 |
| 聚合 / 待办提醒 | `siyuan-home`（design；R228 真机校准前误记 siyuan-butler） | 待契约 | 先定位仓库与主数据再定义只读 projection（L583）；不复制打卡 occasions / 人脉 birthday |
| 日记 / 块 / 文件树 | **思源内核** | `/api/filetree` `/api/block` `/api/template` 等 | 唯一非插件权威域；快门直呼内核 |

不变量：
1. 中枢聚合（晨间/晚间总结）引用域数据时必须带 `source pluginId + queriedAt`，未知/失败**不得写成 0**（L602）。
2. 私有库红线（safety-gate §1-2）：`revlog` / `attempts` / `glean-index` 等业务私有库一律不读。
3. 权威插件缺席时域数据=不可用空态+原因，不做本地代算（L606）。

## 3. 幂等身份注册表 `source+externalRef`（R77-P1·L599 设计定稿）

**同一用户动作全链路只记一次。** 幂等键统一形状：`<source>:<externalRef>`。

| 域 | 键形状 | 例 | 载体与 TTL | 现状 |
|---|---|---|---|---|
| 桥命令 | 调用方生成的命令 `id` | `mcp-20261005-…` / Quicker id | processed 台账（`Record<id, ts>`，LRU=auditMax） | ✅ 已实现（NDJSON+广播共用） |
| 事件 | manifest `events[].idempotency` 派生 | `checkin:<eventId>`；删除=`<id>:deleted` 后缀配对 | `IdempotencyRegistry`（idempotency.json，键=`<pluginId>:<idempotencyKey>`，TTL 30 天+LRU 2000）+ events.ndjson 追加载体 | ✅ R229 实装（写入侧去重：滚动裁剪后重放不重复落行；先写后记账 fail-open） |
| 工作流 | `planId + 步序` | `wf-<ts>#2` | 内存计划池 5 分钟 | ✅ 已实现（不持久化） |
| 跨插件衍生记录 | 声明式 externalRef | `lv-cards:<sessionId>` / `exam:<sessionId>` / `glean:<docId>:<date>` | 目标 owner 台账；快门只携带不登记 | 设计态（L619） |

规则：
1. `duplicate` 状态 ≠ 失败（result-contract §1：等同 recorded，禁止换 id 重试）。
2. 事件域键以**源发生身份**为准：owner 的 `eventId/externalRef/occurredAt/localDate` 与快门 `ingestedAt` 分开记录；补卡/跨午夜按 owner 日期归属（L600）。
3. 删除 tombstone 与原事件按同源 eventId 配对；不得用接收时间或条目顺序猜（L600）。
4. **内核路由差距**（docs/02 §10）：`id=kernel` 不进 processed 台账——补齐 id/externalRef 前，任何文档不得宣称三通道共享完整幂等台账（L636）。

## 4. 作者接入包（R77-P2·L610）

### 4.1 manifest 条目模板

复制 `templates/ecosystem-manifest-entry.template.json`（v2 形状、`$comment` 注释可留，校验器忽略），填实后整条追加进 `plugins[]`。

### 4.2 能力与事件命名

- 能力名：**上游既有公开名优先**（如打卡 `items.read`、人脉 `searchPeople`）；新命名用 `domain.verb-noun`（如 `calendar.read`）。
- 事件名：`<eventNamespace>:<kebab-verb>`，namespace 全小写短名（`checkin` / `lv-cards` / `glean`）；一张 manifest 内 namespace 唯一，校验门强制前缀匹配。
- 事件必须声明 `status` 与 `idempotency`；`available` 级事件还要有 `payload` 形状与物化载体说明。

### 4.3 版本协商

- `protocol` 字符串格式：`window.<BridgeName> v<Major>`（窗口桥）或 `agent-capabilities + commands`（命令面）。
- `minProtocol` 填快门已验证的最低 major：上游 future major → `unsupported`（拒绝执行未知方法，L585）；上游 unknown minor → 按兼容处理；能力缺失（`hasCapability` false）→ `unsupported` 而非 `failed`（L618：未初始化/不支持/未就绪分开显示）。

### 4.4 示例 adapter（形状，20 行）

```ts
// 透传 adapter = 能力协商 + 参数校验 + BridgeResult 归一，见 src/services/adapters.ts
export async function myopEnsure(getBridge: () => MyBridgeLike | undefined, args: Args): Promise<BridgeResult> {
    const b = getBridge();
    if (!b || typeof b.hasCapability !== "function" || !b.hasCapability("mycap.write"))
        return { status: "unsupported", data: null, message: "XX 插件未安装或无 mycap.write 能力" };
    if (typeof args.name !== "string" || !args.name) return { status: "rejected", data: null, message: "name 缺失" };
    if (!(await waitReady(b))) return { status: "unsupported", data: null, message: "XX 插件数据未就绪" };
    try {
        const data = await b.ensure?.({ name: args.name, externalRef: args.__cmdId });  // 幂等键透传
        return { status: "recorded", data, message: "已登记" };
    } catch (e) {
        return { status: "failed", data: null, message: `XX 桥失败：${e instanceof Error ? e.message : String(e)}` };
    }
}
```

### 4.5 诊断字段对照（registry.list 输出）

`{ pluginId, displayName, maturity, manifestVersion, installedVersion, installed, protocol, capabilities, hubIntegration }`——`installedVersion ≠ manifestVersion` 即 stale 候选；作者改版后必须同步校准 manifest `version` 并在 `note`/提交信息留 source commit（L575：漂移必须有 source commit + 日期）。

### 4.6 提交前检查（作者侧）

```bash
node scripts/validate-ecosystem-manifest.mjs --file <你的条目JSON>   # 本仓库；形状/命名/幂等门
```

再走 quickgate 侧 CI 门（§5 阻断点，挂实现批）：schema 校验失败=合并/发布阻断。

## 5. 校验门（可执行）

`scripts/validate-ecosystem-manifest.mjs`（零依赖，仿 validate-menu.mjs）：

- 接受 `--file <path>`；默认依次校验本仓库模板 + quickgate `src/assets/ecosystem-manifests.json`（存在即校验）。
- 规则：顶层 `version` 整数 ≥1；`plugins` 非空且 pluginId 唯一；maturity 枚举；`idempotency` 非空（available 强制，其余建议）；`ingestion` 枚举且 stable 插件不得为 `none`（有事件却 `none`=fail）；`sourceOfTruth` 域格式 `domain.sub`；**v2 必填字段（sourceOfTruth/ingestion/minProtocol/eventNamespace）在 `version ≥ 2` 时强制、v1 宽容为迁移期警告**（schema.json 为 v2 目标形状，无迁移宽容——CI 严格门与 manifest 升 v2 同步生效）。
- 阻断点：本仓库=手工/评审门；quickgate=**planned**（`check:manifest` 进 package.json + CI，v2 字段补齐后开严格门）。

## 6. 追溯与差距

| TODO | 交付对照 |
|---|---|
| L595（R77-P1 类型门禁） | ◐ 本合同 §1 + schema.json + 校验脚本=设计仓库半；TS 接口补字段、移除 `as unknown` 断言、CI 阻断=quickgate 实现批 |
| L596（R77-P1 权威矩阵） | ✅ §2（含红线与禁止项） |
| L599（R77-P1 幂等身份） | ◐ §3 设计定稿；统一注册表实现挂 quickgate 批 |
| L610（R77-P2 作者接入包） | ✅ §4 全项（模板/命名/协商/adapter/诊断/脚本）+ templates/ + scripts/ |

- 校准锚点：R20（初版对照远端 main）、R35（零漂移复核）、R6/R77（雷切 0.44.1 +3 能力 / 打卡 +7 事件 / 人脉 0.4.1）。
- 关联合同：capability-registry-contract（五态可用性，本合同=其 declared 层的形状冻结）、safety-gate-contract（写门控）、result-contract（状态词典）。
