# C3 能力注册表合同（§18.2 R124-G1 · v0 草案）

> 目的：把"小驴生态插件能做什么、谁负责、什么版本、现在可用吗"合并为一份 Capability Registry 合同；验收 = declared / observed / available / stale / unknown 五种可用性分开，写入必有唯一 owner。
> 状态：v0 草案——收录已实现形状（ecosystem-manifests.json + registry.list + 设置页生态对照），未实现的字段标注 `planned`。

## 1. 插件条目 schema（已实现：src/assets/ecosystem-manifests.json）

```json
{
  "pluginId": "siyuan-checkin",
  "displayName": "小驴打卡",
  "maturity": "stable | design | unlocated",
  "version": "18.16.0",              // 对照上游 main 的基准版本（R20/R35 校准）
  "protocol": "bridge v5 | agent-capabilities + commands | …",
  "windowBridge": "siyuanCheckin",    // plugin.api 透传的窗口桥对象名（仅 hubIntegration 插件）
  "capabilities": ["items.read", "events.record", "…"],   // 该插件公开的能力名（声明面）
  "events": [{ "name": "checkin:event-recorded", "idempotency": "…", "payload": "…" }],
  "hubIntegration": "…"
}
```

## 2. 可用性五态（planned：registry.list 现只回 `installed`；五态拆分是升级项）

| 态 | 判定 | 数据来源 |
|---|---|---|
| `declared` | manifest 里声明了该能力 | ecosystem-manifests.json（静态契约） |
| `observed` | 探测到插件实际暴露该能力（loadPetals js / 窗口桥方法存在） | registry 探测（spike⑥ 形状） |
| `available` | declared ∧ observed ∧ 插件 enabled ∧ 版本兼容 | 运行时合成 |
| `stale` | 已安装版本 ≠ manifest 基准版本（能力面可能漂移） | loadPetals version 对比 |
| `unknown` | 无法判定（插件缺席/探测失败） | 诚实缺省 |

不变量：
1. `available` 必须由 declared+observed 推导，**禁止只凭 declared 宣称可用**（R123-G0 证据等级 E2≠E4 的同源纪律）。
2. owner 唯一：每个 capability 归属恰好一个 pluginId；跨插件复用经 hubIntegration 声明，不得隐式共享。
3. 写入能力（events.record / contacts.ensure 等）必须在 capabilities 里可枚举——安全门（safety-gate-contract.md）按此枚举做门控，未枚举即拒绝。

## 3. 消费面（已实现）

| 消费方 | 用法 |
|---|---|
| `registry.list` op | 输出七插件 {pluginId, displayName, maturity, manifestVersion, installedVersion, installed, protocol, capabilities, hubIntegration} |
| `plugin.api` 允许名单 | windowBridge 映射来自 manifest（非硬编码，D-0001） |
| `events.list/pull` 白名单 | 仅 stable 插件且 available 的事件（events-workflow.test 强制） |
| 设置页生态清单 | manifest × loadPetals 对照展示 |
| 诊断报告 | registrySource + hostPlugins 计数 |

## 4. 已知差距（登记进 TODO，见 §18.2 对应条目）

- `observed/available/stale` 三态未实现（registry.list 只有 installed 布尔）——升级需 loadPetals 探测深化（planned）
- capability 无 effects 标注（读/写/删）——安全门的 destructiveHint 现为 MCP 层手工标注，应下沉到 manifest
- 版本漂移告警：stale 判定已可做（installedVersion ≠ manifestVersion），尚未在 diagnostics.report 中呈现

## 5. 追溯

- manifest 校准：R20（对照远端 main）、R35（上游零漂移复核）
- 形状实证：spike⑥ loadPetals（name/version/enabled/incompatible/js）
- 消费测试：tests/contract-consistency（ops 面）、tests/events-workflow（白名单=stable∧available）
