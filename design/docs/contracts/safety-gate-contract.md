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


## 5. 附件：思源内核 CheckAuth 认证顺序（v3.8.6 源码实证，R101）

kernel/model/session.go CheckAuth 判定顺序：
1. **JWT 角色直通**：GetGinContextRole ∈ {Administrator,Editor,Reader} 直接放行（JWT=siyuan-kernel 签发，auth.go：golang-jwt/v5+32 字节随机密钥+多 audience 含 siyuan-kernel-plugin——**CI 容器提取的 122 字符 token 即此类**）；
2. **API Token**：Authorization 头 Token /token /Bearer /bearer 四前缀 → authByAPIToken 比对 conf api.token；
3. **query token**：?token= 等效；
4. **accessAuthCode 未设置**：SiYuanAccessAuthCodeBypass 或 localhost+非跨站 → Administrator（R21⓪ 的 401 基线在 accessAuthCode 设置态）；
5. **accessAuthCode 已设置（CI 容器态）**：localhost 请求需过 **Sec-Fetch-Site 跨站检查**（GHSA-9gpj-3rm3-x42m）与 Origin 检查——curl 无这些头，默认放行；非 localhost 直接 401。

**CI 容器 registry.list 400 的定位**：认证层（1~3）已过（400≠401），400 在业务/私有路由层——kernelRegistryList 容器内自呼 loadPetals 或会话依赖，需容器内逐层调试（实验分支继续）。

**本机直通 vs 容器 400 差异根因候选**：本机思源窗口存在已认证会话（浏览器 cookie）+ Sec-Fetch 头差异；容器纯 curl 无会话头。
## 6. 写 op 统一策略表（R69-P1·L446 · R226 定稿）

> 写 op 全集（7）：`checkin.record`、`contacts.ensure`、`contacts.interaction`、`template.new`、`commands.run`、`workflow.execute`、`plugin.api`（透传面）。
> §2 防线矩阵「内核子集无写命令」的表述已过时——`template.new` 自入 KERNEL_OPS 起为内核路由可达写 op（L627 登记的旁路面），本表为修正基准。

| 写 op | 确认门 | 审计 | 黑名单 | 幂等键 | MCP 写门 | 差距（现状→目标） |
|---|---|---|---|---|---|---|
| `commands.run` | ✅ confirmExec 开时 30s confirm（超时=拒绝） | ✅ 每次落 audit | ✅ settings.blacklist（插件级） | 无（执行类） | write=true | — |
| `checkin.record` | 无（单条打卡低风险，数据归 owner） | ✗ | 不适用（能力协商担当） | ✅ externalRef=命令 id（v0.5.7 source 归一 api） | write=true | 审计缺失→差距① |
| `contacts.ensure` / `contacts.interaction` | 无 | ✗ | 不适用 | ensure 幂等 ref 防重建（L578）；interaction ref=命令 id | write=true | 审计缺失→差距① |
| `template.new` | 无（新建文档，不覆写） | ✗ | 不适用 | 无 id（每次新建） | write=true | 审计缺失→差距①②；路径安全→§7 |
| `workflow.execute` | ✅ confirmAll（步骤摘要 30s） | 步级继承各 op | ✅ 继承各 op | planId+步序（内存 5min） | write=true + destructiveHint | — |
| `plugin.api` | 无（读为主） | ✅ 共用 audit | ✅ rawApiAllowlist | 不适用 | write=true 且需 rawApiEnabled | — |

统一策略（目标态；①②挂 quickgate 实现批）：
1. **差距①（审计全覆盖）**：全部写 op 在 dispatch 出口统一 audit（status/elapsedMs/args 脱敏摘要），不依赖各 case 自律；rejected/unsupported 也留痕。
2. **差距②（内核旁路收口）**：`template.new` 保留在 KERNEL_OPS 的前提 = §7 守卫+审计落地；未落地前 MCP 侧以 write 门+「实验」标注补偿（L627 合并裁定）。
3. 确认门只设两档语义：`exec`（单命令确认）/ `all`（批量步骤摘要）；数据透传类写（checkin/contacts）默认无确认——依据「数据归 owner 插件」边界（ecosystem-manifest-contract §2），必须有幂等键。
4. 黑名单只作用于执行面（commands.run / plugin.api）；数据透传类由能力协商担当（缺能力=unsupported，不得伪装 denied/failed，L618）。
5. MCP 写门恒必须：write 标注=tools.ts 单一事实源，schema 门测试强制 tools 集合===ALL_OPS；`LV_MCP_WRITE=1` 才投影（§3 不变）。

## 7. template.new 路径安全规格（R78-P0·L628 · R226 定稿）

**现状（R226 源码核对）**：前端与内核两通道均为 `` `/templates/${templatePath.replace(/^\/+/, "")}` `` 直拼——`..` 回溯、反斜杠、NUL、绝对路径均未拦截；内容无大小上限；拒绝路径无审计。MCP 经内核路由同缺陷。

**规格（三通道一致；quickgate 批实现+回归）**：
1. `templatePath` 白名单形状：必须匹配 `^[A-Za-z0-9][A-Za-z0-9/_-]*\.(md|txt)$`；含 `..` 段、`\`、NUL、前导 `/`、`%`、控制字符 → `rejected`（中文 message 说明原因）。
2. 长度/大小上限：`templatePath` ≤200 字符；`template` 内联与 templatePath 读取内容均 ≤64KB——超限 `rejected`，**不得截断后继续执行**。
3. 目录限定：`getFileText` 只允许 `/templates/` 前缀（拼接前断言；禁止依赖 `replace` 兜底后逃出目录）。
4. 失败审计：rejected 也写 audit（op、templatePath、原因；**不含模板内容**）。
5. 回归矩阵（前端 NDJSON / 内核路由 / MCP 三通道各跑一遍）：`../conf/siyuan.json`、`a/../../storage/petal/x/bridge/results.ndjson`、`..\windows`、含 NUL、绝对路径 `/data/...`、301 字符超长、合法 `hello.md`（唯一应 `recorded` 的用例）。
