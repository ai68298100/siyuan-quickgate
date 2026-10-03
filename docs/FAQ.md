# FAQ — 故障排查（症状 → 原因 → 解法）

> 口径：错误状态遵循[契约](../README.md#error-semantics) `unsupported/rejected/failed/expired/duplicate`；
> 本文每条都来自真实踩坑（bug#1~13 与真机联调），不是理论清单。
> 自助顺序：先对症状 → 试解法 → 仍不行跑 `npm run verify:restart`（九/十项一键复测）把失败项带去提 issue。

## 1. 鉴权类

| 症状 | 原因 | 解法 |
|---|---|---|
| 任何请求都 401/403 | Token 缺失/错误（CheckAuth：JWT→API Token 四前缀→query token→会话） | 思源 `设置→关于→复制 API 令牌`，更新动作配置 `SY_TOKEN`；CLI/MCP 走 `%APPDATA%\siyuan\env` 的 `SIYUAN_TOKEN`（SY·内核请求 v1.1 会自动重读自愈一次） |
| Token 明明对，仍 401 | 思源重置过令牌（重装/升级） | 同上重拷；`SY-内核请求.cs` 的 401 自愈会先重读 env 再失败 |
| 内核路由 404（`/plugin/private/.../exec`） | 插件 kernel.js 未加载（v0.7.0 及以前缺 `kernels` 字段，bug#9） | 升级到 ≥v0.7.1；确认插件已启用（petal 开关开） |

## 2. 桥命令类（NDJSON）

| 症状 | 原因 | 解法 |
|---|---|---|
| 命令发出后一直没有回执 | ①桥开关没开（默认关）②思源没运行 ③pollMs 过长还没轮到 | 设置页开「外部命令桥」；`lv-cli ping` 探；等待 ≤pollMs+处理时间 |
| 回执 `expired` | createdAt+ttlMs 过期未消费（内核忙/积压） | 加大 ttlMs 重发；查桥目录 commands.ndjson 是否积压 |
| 回执 `rejected`：`plugin/command 缺失` | 信封字段缺失（bug#11 同类：op 缺失行会以坏行指纹回执一次后被压缩） | 用 `lv-cli send --op xx --args '{}'` 正确发；检查信封 v/id/op/args |
| 回执 `rejected`：用户未确认 | confirmExec 开着，commands.run 弹确认 30s 无人点 | 无人值守场景在设置关「命令执行前确认」，或现场点确认 |
| 同一命令执行了两遍 | v0.7.2 及以前 bug#8 系/超时重复派发（bug 已修） | 升级 ≥v0.7.3；D-0012 预留语义保证双通道不双执行 |
| 多窗口/多客户端下命令偶尔丢失 | 多写者交错覆盖（stale-writer 窗口，混沌测试实证） | 约定单写者；调用方超时后**同 id** 重发（MCP 已内建 3s 补发），台账保证不双执行 |
| 桥目录文件异常增长 | 早期版本坏行滞留（bug#11） | 升级 ≥v0.7.3；坏行首次回执即随压缩消失 |

## 3. 广播快路径（v1.5）

| 症状 | 原因 | 解法 |
|---|---|---|
| 快路径死路：开关开着但命令不执行 | v0.7.2 及以前：桥运行中再开广播开关，订阅不创建（bug 已修） | 升级 ≥v0.7.3；或关开一次桥 |
| 断连后几十秒不恢复 | v0.7.1 及以前退避上限 30s（bug#10） | 升级 ≥v0.7.2（上限 5s + MCP 3s 同 id NDJSON 补发） |

## 4. 内核数据类

| 症状 | 原因 | 解法 |
|---|---|---|
| events.ndjson 首行是 `{"code":404...}` | 3.8.6 缺失文件返回 HTTP 202+错误信封，旧版误当内容（bug#12） | 升级 ≥v0.7.3；手工删掉那行即可 |
| events.pull 报 Cannot find module | 构建产物动态 import chunk 在渲染进程 require 失败（bug#13） | 升级 ≥v0.7.3（manifest 已内联） |
| `not exist` 类错误 | 收集箱/日记笔记本 ID 失效（文档被删/移动） | 重跑 `config.discover`（v0.7.3 起含收集箱按约定名发现）；或手填 |
| 内核返回 busy | 内核忙（同步/索引中） | 动作层重试 ≤3（docs/04 §8）；稍后再试 |
| events 一直不更新 | 事件物化需前端在线 + 桥开启 | 确认思源窗口存活；v0.7.3 起开/关桥即配对订阅，无需重启插件 |

## 5. MCP（AI 客户端）

| 症状 | 原因 | 解法 |
|---|---|---|
| tools/list 只有 13 个只读工具 | 写工具需 `LV_MCP_WRITE=1` | claude_desktop_config.json 的 env 加 `"LV_MCP_WRITE": "1"` 重启 Claude |
| 写工具调用被拒 | 同上门控 + 快门侧确认/允许名单 | 按提示开启对应开关（外部面默认关是安全设计） |
| MCP 路由第一次调用很慢 | node 冷启动 + 内核 exec 冷路径 | 正常现象（实测 1~9s）；后续调用快 |
| `setting.open` 之类报不支持 | 前端专属 op（需思源窗口）走内核路由时诚实降级 | 走 NDJSON 通道（桥开启时自动） |

## 6. Quicker 动作侧

| 症状 | 原因 | 解法 |
|---|---|---|
| C# 粘贴报签名错误 | Quicker 版本上下文类型差异 | 保留编辑器骨架签名，只换方法体（reference/README 边界声明） |
| 粘贴报 C# 语法错误 | 用了 v1 老编译器 | 参考件为「普通模式 v2」Roslyn 语法（且已过 C#5 严格门，v2 下兼容） |
| 系统代理拦 127.0.0.1 | Quicker HTTP 模块走系统代理 | 代理软件加 127.0.0.1 直连/白名单（实测项，待复测） |
| 图片上传失败 | `file[]` 字段名/大小限制 | 用 p0-5 参考件（multipart 字段已对齐）；大图先压缩 |

## 7. 自检工具速查

```bash
npm run accept            # 119 单测 + MCP 协议冒烟（无需思源）
npm run verify:restart    # 十项真机复测（需思源运行；自动读 %APPDATA%\siyuan\env）
node tools/lv-cli.mjs ping                          # 桥端到端
node tools/lv-cli.mjs fast                          # 广播快路径延迟
node scripts/check-version.mjs                      # 三处版本一致性门禁
node tools/mcp-smoke.mjs                            # MCP 协议冒烟（6 断言）
```
