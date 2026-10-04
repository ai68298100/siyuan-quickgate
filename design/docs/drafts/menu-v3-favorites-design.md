# 超级面板收藏消费设计：menu schema v3 候选（L472 消费面 · R236 design note）

> 问题：favorites.list（L474 已实现）的消费面在超级面板——面板菜单是静态 JSON，收藏/最近使用需要**动态组**。
> 裁定：**设计先行，实现挂 L157**（showmenu「列表变量生成菜单」动态能力待用户真机实测——动态组的可行性由它决定）。

## 1. 现状机制（menu schema v2 已有动态雏形）

`thenMenu` 把**上一个动作的响应数组**转为二级菜单，现有三源：`bookmarks` / `tags` / `recentBlocks`（思源内核数据）。即「响应→菜单」管线已存在，缺的只是：
1. 数据源第四枚举：`favorites`（t=bridge 调 favorites.list → `{favorites:[…], recent:[…]}` 双数组）；
2. 双源组：收藏与最近使用同屏（两个动态组或一组两段）。

## 2. schema v3 变更草案

```json
{
  "label": "⭐ 收藏命令",
  "t": "bridge",
  "v": { "op": "favorites.list", "args": {} },
  "thenMenu": "favorites",          // v3 新增枚举
  "thenMenuField": "favorites",     // v3 新增：取响应哪个数组（favorites|recent）
  "thenMenuItem": { "label": "{title}", "t": "cmd", "v": { "plugin": "{plugin}", "command": "{command}" } }
}
```

- `thenMenuItem`：行模板（占位符取数组元素字段）——通用化后 recentBlocks 等旧源也可迁移（v4 再议，v3 不动旧源）。
- validate-menu.mjs：`thenMenu` 枚举 + favorites、`thenMenuField`/`thenMenuItem` 形状校验。
- 空态：favorites 为空 → 组折叠为提示项「暂无收藏（favorites.add 添加）」（gate 机制复用）。

## 3. 依赖与门禁

1. **L157（用户实测）**：showmenu 列表变量生成菜单 + 项附加值——动态组的宿主前提；
2. 桥在线（favorites.* 前端专属 op）——gate=`quickgate-or-bridge` 既有机制；
3. 隐私：recent 只进本机菜单，不进导出/分享（menu 模板不含数据，天然安全）。

## 4. 追溯

- L472（收藏/最近使用/置顶）、L474（ops 已实现）、L157（宿主动态菜单实测门）；validate-menu.mjs 同步点=实现轮。
