# 安全门合同（Policy & Safety Gate · §18.2 R124-G1 · v0 草案）

> 目的：把散在各入口的防线合并为一份统一安全门合同；验收 = **面板、Agent、MCP、Quicker 不得绕过**。
> 状态：v0 草案——收录已实现防线 + 已声明的红线；未实现项标注 `planned`。

## 1. 红线（不可协商，违反即缺陷）

1. 外部面默认关闭：桥/广播快路径/plugin.api 透传出厂即 off，用户显式开启才生效。
2. 不读取任何插件的私有存储（`data/storage/petal/<其他插件>/` 下的非 bridge 公开文件）。
3. 无 Token 请求必须被 401/403 拒绝（内核私有路由 + localhost API 唯一 CSRF 防线，spike⑩⓪）。
4. 不自带模型服务、不复制业务私有库、不重算学习调度、不成为通用备份/清理工具（docs/14 R88 边界）。
5. 未知不得改写为成功（result-contract §1 不变量 2）。

## 2. 入口无关的防线矩阵（已实现）

| 防线 | NDJSON | 内核路由 | 广播 v1.5 | MCP | plugin.api |
|---|---|---|---|---|---|
| Token 鉴权 | ✅（文件读写需 Token） | ✅ 401 实证 | ✅ postMessage 需 Token | ✅ env 注入 | ✅ |
| 确认门控（30s=拒绝） | ✅ commands.run | —（内核子集无写命令） | ✅ 共用 | ✅ 35s 等待覆盖 | — |
| 黑名单插件 | ✅ | ✅ 同 dispatch | ✅ 共用 | ✅ 共用 | ✅ |
| 审计日志（跨重启） | ✅ | — | ✅ 共用 | ✅ 共用 | ✅ |
| 允许名单 | — | — | — | ✅ LV_MCP_WRITE 门控 | ✅ rawApiAllowlist |
| 只读默认 | — | — | — | ✅ 13/23 工具 | 默认关 |

不变量：
1. **MCP 只是消费通道，不新增特权**（D-0013）——任何 MCP 可达的操作，等价于同 op 的 NDJSON 调用。
2. 防线在 dispatch 层统一实现（bridge-service），通道层不得旁路。
3. 未来任何新入口（面板直呼/Agent/HTTP 端点）必须走同一 dispatch，自动继承全列。

## 3. MCP 专属门控（已实现）

| 门 | 规则 |
|---|---|
| 工具投影 | 默认 13 只读；写工具在 `LV_MCP_WRITE=1` 前不进 tools/list |
| 调用拒绝 | 未授权写工具的 tools/call → isError=true + 指引文本，**不产生桥命令** |
| destructiveHint | `plugin.api`/`workflow.execute` 标注；宿主据此二次确认 |
| schema 门 | 逐 op 参数 schema 纪律测试强制（tools 集合===ALL_OPS） |

## 4. planned（登记待办，不在本合同承诺）

- 笔记本级写权限分级（R8②已评估：暂不立项，触发条件=新增 doc.append/block.insert 类通用写 op）
- `workflow.cancel`/自动化急停（R82-P0 熔断，与 C4 取消合并设计）
- capability effects 下沉到 manifest（capability-registry-contract §4）
