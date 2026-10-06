# 内核 HTTP 访问契约（L653 · R293）

> 适用面：快门前端 `src/services/kernelApi.ts` 与内核插件 `src/kernel.ts` 的全部内核 HTTP 访问。
> 证据级别：E2（静态契约）+ E3（tests/file-read.test.ts、tests/kernel-ops.test.ts）。

## 1. 请求形态

- 一律 `POST`；JSON 端点带 `Content-Type: application/json` + JSON body（无参为 `{}`）。
- 文件写走 `PUT /api/file/putFile` 的 multipart（字段 `path`/`isDir`/`modTime`/`file`）。
- 鉴权：渲染进程同源免 Token；外部客户端（MCP/CLI）带 `Authorization: Token <token>`。
- **超时**：内核访问不设显式超时（委托宿主 fetch/浏览器栈）——执行上限语义由桥层
  `dispatchWithTimeout`（15s，确认窗 30s 自管）承担，见 bridge-service；本文件只约定分类，不约定重试。

## 2. 响应信封与已知怪癖

- 标准 JSON 信封 `{code, msg, data}`；`code===0` 为业务成功，非 0 抛 `msg`。
- **怪癖（bug#12，3.8.6 实证）**：`/api/file/getFile` 对缺失文件返回 **HTTP 202 + application/json
  错误信封**（`{"code":404,...}`）——202 属 2xx，`res.ok===true`，错误体不能当文件内容。
- 正常文件内容不含 `{code, ...}` 信封（快门自持载体为 ndjson/平面文本/收藏 JSON）。

## 3. 读取分类（src/services/file-read.ts，前端与内核同口径）

| kind | 判定 | 语义 |
|---|---|---|
| `ok` | 2xx 且非错误信封 | 正文可用（空文件 `""` 也是 ok——**空 ≠ 缺失**） |
| `missing` | 404；或 202+信封 code=404 | 确认不存在（`getFileText` 返回 null 的唯一情形） |
| `auth` | 401/403（状态码或信封 code） | Token/访问鉴权码不匹配 |
| `unreachable` | 网络异常 / 5xx / 空响应 | 内核不可达 |
| `unexpected` | 2xx + 错误信封非 404/401/403 | 异常响应，须透出不得吞 |

- `getFileText`（旧契约）：ok→正文、missing→null、真异常→抛 `FileReadError`。
- **分账**：`KernelApi.readMetrics`（ok/missing/auth/unreachable/unexpected 五计数，L653），
  纳入诊断包可核对面；UI/诊断不得把 auth/unreachable 显示成"没有文件"。

## 4. 写路径

- `putFileText`：multipart；非 2xx 抛 `putFile HTTP <status>`；父目录由内核自动创建。
- 并发写纪律：多写者 read-modify-write 会互相覆盖——桥命令追加必须走
  "写后读回校验 + 基于最新内容重试 ≤5 次"（bridge-client.send，L453）。
