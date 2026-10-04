# 思源内核 API 参考（Quicker HTTP 模块直接可用 · 已对照本机端点表核实）

> 统一约定：`POST {SY_URL}/api/...`，请求头 `Authorization: Token {SY_TOKEN}`，请求体类型 JSON，返回 `{code, msg, data}`（`code=0` 成功）。表格中的 `(R/W)` 表示语义上的只读/写入，不是 HTTP 方法；思源有不少只读端点也使用 POST。
> 本文档所有端点与参数名均已对照本机端点表（548 个，思源 3.8.x）核实；个别响应形状标注「实测项」的，搭建动作时先跑一次确认。
> 完整清单本机可查：`sy api -g <关键词>`；官方文档 [API.md](https://github.com/siyuan-note/siyuan/blob/master/API.md)。

## 0. 调用约定

- 鉴权失败/未配令牌：HTTP 层拒绝（Quicker 里表现为状态码非 200）→ 动作统一走「令牌无效」引导分支（见 §6）。
- `code!=0` 时 `msg` 是中文错误，可直接展示给用户；常见：`do not [exist]`（ID 不存在/已删）、`busy`（内核忙，稍后重试）、`blocked by...`（受保护文档）。
- 超时建议 10s（本地内核 <100ms 正常返回）；同步/导出类大操作放宽到 60s。
- 幂等：内核 API 本身不幂等（两次调用=写两次），重复触发防护靠调用方（Quicker externalRef / 桥命令 id）。
- 多文档/多块操作优先用 batch 端点（一次事务，原子），别循环单块调用。

## 1. 块操作（最高频）

| 用途 | 端点 (方法标记) | 请求体参数 | 备注 |
|---|---|---|---|
| 追加到今日日记 | `/api/block/appendDailyNoteBlock` (W) | `notebook, data, dataType` | **日记不存在则自动创建**；dataType=markdown |
| 顶到今日日记开头 | `/api/block/prependDailyNoteBlock` (W) | `notebook, data, dataType` | |
| 创建日记文档（不带内容） | `/api/filetree/createDailyNote` (W) | `app, notebook` | app 传空即可（实测项） |
| 追加到文档/容器块 | `/api/block/appendBlock` (W) | `parentID, data, dataType` | parentID 必须容器块（d/l/b/i/s/callout） |
| 顶部插入 | `/api/block/prependBlock` (W) | 同上 | |
| 精确位置插入 | `/api/block/insertBlock` (W) | `data, dataType` + `previousID`/`nextID`/`parentID` 三选一 | previousID 最常用 |
| 改写块 | `/api/block/updateBlock` (W) | `id, data, dataType` | **整体替换**；部分修改先 getBlockKramdown 再拼回 |
| 删除块 ⚠️ | `/api/block/deleteBlock` (W) | `id` | 无回收站逻辑（靠思源历史） |
| 批量追加/插入/改写 | `/api/block/batchAppendBlock` / `batchInsertBlock` / `batchUpdateBlock` (W) | `blocks` 数组 | 一次事务原子提交 |
| 读块源码 | `/api/block/getBlockKramdown` (R) | `id` (+`mode,notebook` 可省) | → `data.kramdown` |
| 批量读源码 | `/api/block/getBlockKramdowns` (R) | `ids` | |
| 子块列表（文档顺序） | `/api/block/getChildBlocks` (R) | `id` | **唯一保序的读取方式** |
| 块信息 | `/api/block/getBlockInfo` (R) | `id` | 返回 box/path/rootID/rootTitle/rootIcon，**无 type 字段** |
| 块面包屑 | `/api/block/getBlockBreadcrumb` (R) | `id` | 祖先链 |
| 块是否存在 | `/api/block/checkBlockExist` (R) | `id` | 防脏 ID |
| 谁引用了此块 | `/api/block/getRefIDs` (R) | `id` | 反链 |
| 最近更新的块 | `/api/block/getRecentUpdatedBlocks` (R) | 无参 | 「最近」面板数据源，可做最近文档菜单 |
| 大纲 | `/api/outline/getDocOutline` (R) | `id` (+preview) | 标题树，做章节跳转菜单 |
| 任务项标记 | `/api/block/batchUpdateTaskListItemMarker` (W) | `id, items, marker` | 勾选待办专用 |

**插入响应形状**：`data[0].doOperations[].id` 是新块 ID（事务日志），链式操作直接用，不要回头 SELECT（索引异步）。

## 2. 搜索与查询

| 用途 | 端点 (标记) | 参数 | 说明 |
|---|---|---|---|
| 全文搜索块 | `/api/search/fullTextSearchBlock` (R) | `query` + 可选 `method, orderBy, page, pageSize, paths, types, subTypes, groupBy, notebook` | **注意大小写 fullText**；响应 `data.blocks[]\{id,hPath,content\}`，content 是纯文本摘要 |
| SQL 查询 | `/api/query/sql` | `stmt` | 索引库 SQLite；**无占位符**，拼串必须转义单引号 |
| 标签列表 | `/api/search/searchTag` (R) | `k` 前缀过滤 | 二级菜单数据源 |
| 模板搜索 | `/api/search/searchTemplate` (R) | `k` | 列出模板库文件 |
| 资源搜索 | `/api/search/searchAsset` (R) | `k, exts` | 附件/图片 |
| 资源内容搜索 | `/api/search/fullTextSearchAssetContent` (R) | `query` + 可选分页 | 搜附件内文字（PDF 等） |
| 嵌入块查询 | `/api/search/searchEmbedBlock` (R) | `embedBlockID, stmt` | 跑 {{query}} 语句 |
| 全局替换 ⚠️ | `/api/search/findReplace` (W) | `ids, k, r, replaceTypes...` | 批量替换，慎用 |

### 高频 SQL 模板

```sql
-- 今日日记文档
SELECT root_id FROM blocks WHERE type='d' AND content LIKE '%2026-10-01%' LIMIT 1;
-- 按标题精确找文档
SELECT id, hpath FROM blocks WHERE type='d' AND content='会议记录' LIMIT 10;
-- 某文档下的待办
SELECT id, content FROM blocks WHERE root_id='<文档ID>' AND markdown LIKE '%[ ]%';
-- 按自定义属性查块（IAL 存于 blocks.ial 文本列）
SELECT id FROM blocks WHERE ial LIKE '%custom-from-quicker="1"%';
-- 某笔记本最近文档（type='d'）
SELECT id, content FROM blocks WHERE type='d' AND box='<笔记本ID>' ORDER BY id DESC LIMIT 20;
```

## 3. 文档与笔记本

| 用途 | 端点 (标记) | 参数 | 备注 |
|---|---|---|---|
| 笔记本列表 | `/api/notebook/lsNotebooks` (R) | 可选 `flashcard` | → `data.notebooks[]\{id,name,closed\}`；closed=true 需先打开 |
| 新建笔记本 | `/api/notebook/createNotebook` (W) | `name` | **返回值不保证是 ID**（3.8.5 实测）：创建后重新 ls 获取；`refreshNotebooks` 端点在 3.8.5 不存在 |
| 新建文档 | `/api/filetree/createDocWithMd` (W) | `notebook, path(hpath), markdown` + 可选 `id, parentID, tags, withMath, clippingHref` | path 是**人类路径**（唯一的例外）；返回新文档 ID |
| 列出文档 | `/api/filetree/listDocsByPath` (R) | `notebook, path(内部.sy路径，根=/)` | |
| 完整人类路径 | `/api/filetree/getFullHPathByID` (R) | `id` | |
| hpath→ID | `/api/filetree/getIDsByHPath` (R) | `notebook, path` | |
| 重命名文档 | `/api/filetree/renameDoc` (W) | `notebook, path, title` | |
| 删除文档 ⚠️ | `/api/filetree/removeDoc` (W) | `notebook, path` | path 是内部路径 |
| 移动文档 | `/api/filetree/moveDocs` (W) | `fromPaths, toNotebook, toPath` | |
| 复制文档 | `/api/filetree/duplicateDoc` (W) | `id` | |
| 排序 | `/api/filetree/changeSort` (W) | `notebook, paths` | |
| 文档树扁平化等 | `doc2Heading / heading2Doc / li2Doc` (W) | 见 sy api | 结构转换 |

## 4. 属性 / 书签 / 标签

| 用途 | 端点 (标记) | 参数 | 备注 |
|---|---|---|---|
| 读块属性 | `/api/attr/getBlockAttrs` (R) | `id` | |
| 写块属性 | `/api/attr/setBlockAttrs` (W) | `id, attrs` | 自定义键要带 `custom-` 前缀 |
| 批量读/写属性 | `/api/attr/batchGetBlockAttrs` / `batchSetBlockAttrs` (R/W) | `ids` / `blockAttrs` | |
| 书签列表 | `/api/bookmark/getBookmark` (R) | 无参 | → 书签名+块 ID 列表 |
| 删除/改名书签 | `/api/bookmark/removeBookmark` / `renameBookmark` (W) | `bookmark` / `newBookmark, oldBookmark` | ⚠️ **没有 addBookmark 端点**——「收藏」只能经思源 UI/快门命令，或用 `setBlockAttrs` 打 `custom-` 标记代替 |
| 书签标签名列表 | `/api/attr/getBookmarkLabels` (R) | 无参 | |
| 标签列表 | `/api/search/searchTag` (W) | `k` | 见 §2 |

## 5. 数据库（AV）——人脉等库的通用读写

| 用途 | 端点 (标记) | 参数 | 备注 |
|---|---|---|---|
| 渲染（读取）视图 | `/api/av/renderAttributeView` (R) | `id(块ID), blockID` + 可选 `page,pageSize,query,viewID` | **AV 无 SQL 表，读取唯一正道**；`pageSize:-1` 全量 |
| 写单元格 | `/api/av/setAttributeViewBlockAttr` (W) | `avID, itemID, keyID, rowID(弃用), value` | value 形状见下表 |
| 加行（绑定文档） | `/api/av/addAttributeViewBlocks` (W) | `avID, srcs, blockID, previousID...` | isDetached:false |
| 删行（解绑） | `/api/av/removeAttributeViewBlocks` (W) | `avID, srcIDs` | 只解绑不删文档 |
| 加列 | `/api/av/addAttributeViewKey` (W) | `avID, keyID, keyIcon(必填!), keyName, keyType` | 3.8.5 实测 keyIcon 必填 |
| 值批量写 | `/api/av/batchSetAttributeViewBlockAttrs` (W) | `avID, values` | |
| 绑定 ID→行 ID | `/api/av/getAttributeViewItemIDsByBoundIDs` (R) | `avID, blockIDs` | 文档 ID→itemID 唯一正道 |
| 主键值搜索 | `/api/av/getAttributeViewPrimaryKeyValues` (R) | `id, keyword, page, pageSize` | |

value 形状（3.8.5 实证，来自人脉数据契约）：text/phone/email/url → `{"<type>":{"content":"..."}}`；date → `{"date":{"content":<ms>,"isNotEmpty":true,"isNotTime":true}}`；select/mSelect → `{"mSelect":[{"content":"...","color":"1"}]}`；checkbox → `{"checkbox":{"checked":true}}`；relation → `{"relation":{"blockIDs":[...]}}`。

> ⚠️ 外部程序**只读**人脉等小驴库可以（renderAttributeView），**直写**不行——会与插件内存态互相覆盖（详见 01 §3.2）。写入走 02 桥协议。

## 6. 文件 / 资源 / 导出 / 同步 / 系统

| 用途 | 端点 (标记) | 参数 | 备注 |
|---|---|---|---|
| 读工作空间文件 | `/api/file/getFile` (R) | `path`（工作空间相对路径） | 返回原始字节（非 JSON 信封）；Quicker 结果类型选「文件/文本」 |
| 写工作空间文件 | `/api/file/putFile` (W) | multipart：`path, file, isDir` + 可选 `modTime` | 02 桥协议传输通道 |
| 上传资源 ⚠️multipart | `/api/asset/upload` | 表单：`file, assetDir` | → `data.succSet[0].path` |
| 导出文档 MD | `/api/export/exportMdContent` (R) | `id` + 可选 `addTitle, yfm...` | 单文档 → markdown 内容 |
| 导出 docx/pdf | `/api/export/exportDocx` / `exportHTML`(pdf 参数) (R) | `id, savePath...` | 批量导出用循环 |
| 全量导出 | `/api/export/exportData` (R) | 无参 | 生成 .zip |
| 手动同步 | `/api/sync/performSync` (W) | `mobileSwitch, upload` | 两个参数传布尔 |
| 同步信息 | `/api/sync/getSyncInfo` (R) | 无参 | 状态面板用 |
| 内核版本 | `/api/system/version` (R) | 无参（GET 亦可） | **动作启动探测**，300ms 超时 |
| 当前时间 | `/api/system/currentTime` (R) | 无参 | 校时 |
| 已装插件表 | `/api/petal/loadPetals` (R) | `frontend` | 超级面板 L3 门控的轻量探测（不装快门也能知道装了啥） |
| 启用/禁插件 ⚠️ | `/api/petal/setPetalEnabled` (W) | `app, enabled, packageName` | 面板不做，仅备用 |

### 广播通道（v2 同步桥的候选通道，3.8.x 已有）

- `POST /api/broadcast/postMessage`（R）参数 `channel, message` —— 外部推消息进频道
- `GET /ws/broadcast`（WebSocket）与 `/es/broadcast/subscribe`（SSE）—— 常驻接收
- `GET /api/broadcast/getChannels` / `getChannelInfo`
- 用途：Quicker WebSocket 模块 ↔ 内核频道 ↔ 思源前端插件（SSE 订阅）三点通信，**无需任何插件发版**即可获得毫秒级命令通道（鉴权方式为实测项）。详见 06 §2.3。

## 7. 硬约束清单（写动作前必读）

1. `appendBlock.parentID` 必须是容器块；段落/标题等叶子块报错 → 改 `insertBlock + previousID`。
2. SQL **无文档顺序列**（`sort` 是类型序）→ 要顺序用 `getChildBlocks`；`ORDER BY id` ≈ 创建时间序。
3. 索引异步：写完立刻查可能查不到 → 链式操作用写接口返回的 ID。
4. SQL 无占位符 → 拼接外部文本先 `Replace("'","''")` 并截断长度；理想只拼接受控 ID。
5. `path` 参数两义：`createDocWithMd` 用 hpath，`removeDoc/renameDoc/listDocsByPath` 用内部 `.sy` 路径。不确定就先 `getPathByID` 拿内部路径。
6. 多块 markdown 一次调用成多块（原子且省调用）。
7. `getDoc` 返回整文档 DOM（50KB+）→ 动作里禁用，用 SQL 投影 / getChildBlocks。
8. 事务类端点（如 AV relation 配置 `/api/transactions`）顶层必须带 `reqId`（3.8.5 实测）。
9. IAL 必须独占一行跟在块后（`内容\n{: custom-x="1"}`），行尾写法不解析（3.8.5 实证）。
10. 本机内核端口曾误录为 1568（R21 实证为默认 6806）→ 教训不变：端口必须做成用户配置，别硬编码。

## 8. Quicker 组装备忘

**请求体组装（C# 表达式，`$=` 前缀）：**

```csharp
// 简单对象
$= JsonConvert.SerializeObject(new { notebook = {笔记本ID}, data = "- " + {内容}, dataType = "markdown" })
// 多行文本转引用（SQL/正则前先转义）
$= JsonConvert.SerializeObject(new { data = "> " + {选中文本}.Replace("\n", "\n> "), dataType = "markdown", parentID = {收集箱文档ID} })
// SQL 单引号转义 + 日期
$= JsonConvert.SerializeObject(new { stmt = "SELECT root_id FROM blocks WHERE type='d' AND content LIKE '%" + DateTime.Now.ToString("yyyy-MM-dd") + "%' LIMIT 1" })
// 防空指针的选中值
$= JsonConvert.SerializeObject(new { id = ({块ID} ?? "") })
```

**响应解析：**
- `jsonextract` 模块：JSONPath 直取，如 `data[0].root_id`、`data.blocks[0].id`。
- C#：`JObject.Parse({文本结果})["data"]["blocks"]`，配合 `SelectToken`。
- 判断成败：`if 模块` → 条件 `$= {状态码}==200 && JObject.Parse({文本结果})["code"].ToString()=="0"`（或者先 jsonextract code 再比较）。

**新步骤备查（Quicker 2.1.19 / 2.2.1 更新日志，V2 专属）：**
- **「自动化脚本」步骤**（2.1.19）：受限 JavaScript 执行组合键鼠、窗口、剪贴板、OCR 等桌面操作——可替代部分 UIA/sendkey 兜底编排（如 P0-6 光标处插入的"激活窗口+粘贴"两连，比分开的 simkey/粘贴模块更原子）。写脚本时注意其沙箱 API 面与普通 C# 表达式不同，桌面类操作优先用它。
- **「等待窗口」步骤**（2.2.1）：按标题/进程等待窗口出现、消失、前台、最小化、恢复，带超时——`run` 拉起思源后用它替代盲等（见 05 §6.1）；`SY·反向触发` 唤起思源窗口后也可用它确认就绪再发命令。
- **AI 写动作**（2.2.0）：暂存区「用 AI 写」可由自然语言生成/修改动作，生成的动作自动刷新进暂存区——docs/03 附 P0 各动作的提示词，粘贴即得骨架，再按蓝图微调。

**通用错误分支（所有动作统一）：**

| 症状 | 判定 | 处理 |
|---|---|---|
| 状态码 0/超时 | 内核未运行 | msgbox「思源未运行」→（可选）`run` 启动思源 → 重试一次 → 仍失败则终止 |
| 状态码 401/403 | Token 无效 | msgbox 引导：思源「设置→关于→复制 API 令牌」→ 粘贴进动作用户配置 |
| `code!=0` 含 busy | 内核忙 | 等 1s 重试 ≤3 次 |
| `code!=0` 含 not exist | ID 失效 | 提示重新选择目标文档（配置里的收集箱/日记笔记本可能被删） |
| 其他 `code!=0` | — | notify 显示 `msg` 原文 |

## 9. 版本兼容备忘（3.8.5 真内核实证，源自小驴人脉数据契约 §6）

- `addAttributeViewKey.keyIcon` 必填（文档写可选）。
- `/api/transactions` 顶层必须带 `reqId`。
- `appendAttributeViewDetachedBlocksWithValues.blocksValues` 是数组的数组。
- `createNotebook` 返回值不保证是 ID；`refreshNotebooks` 端点不存在。
- 块自定义属性存 `blocks.ial` 文本列（`custom-x="1"`），旧 `attributes` 表已弃用。
- 数据库没有 SQL 表（`av_table.go` 只是渲染逻辑），读取一律 `renderAttributeView`。
