//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·变更报告（R154-06 落地件）—— 两份文件清单快照 diff：新增/删除/移动/重复
// 验收语义（docs/21 R154-06）：**只生成报告不改任何东西**（引用更新由用户在思源里决定）
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【清单格式】JSON 数组：[{"path":"...","size":123,"mtime":"ISO","md5":"8位或完整，可空"}, …]
//             （SY-文件项目索引 生成的表可另存为清单；本子程序只消费 JSON——两边解耦）
// 【输入变量】旧清单JSON(文本) 新清单JSON(文本) 报告标题(文本，可空)
// 【输出变量】是否成功(布尔) 变更报告(文本) 新增数/删除数/移动数/重复数(数字)
// 【判定】新增=path 仅在新清单；删除=path 仅在旧清单；移动=同 md5（非空）不同 path 且两侧都出现；
//         重复=新清单内同 md5 多 path（md5 缺省的条目不参与移动/重复判定——诚实边界）
// ============================================================================
using System;
using System.Collections.Generic;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var oldJson = context.GetVarValue("旧清单JSON") as string ?? "";
    var newJson = context.GetVarValue("新清单JSON") as string ?? "";
    var title = context.GetVarValue("报告标题") as string ?? "";
    if (oldJson.Trim().Length == 0 || newJson.Trim().Length == 0) { Fail(context, "新旧清单 JSON 均必填"); return; }

    var oldMap = ParseManifest(oldJson);
    var newMap = ParseManifest(newJson);
    if (oldMap == null || newMap == null) { Fail(context, "清单 JSON 解析失败（须为数组，元素含 path/md5 字段）"); return; }

    var added = new List<string>();
    var removed = new List<string>();
    var moved = new List<string>();
    var byHashNew = new Dictionary<string, List<string>>();

    foreach (var kv in newMap)
    {
        if (!oldMap.ContainsKey(kv.Key)) added.Add(kv.Key);
        var h = kv.Value;
        if (!string.IsNullOrEmpty(h))
        {
            if (!byHashNew.ContainsKey(h)) byHashNew[h] = new List<string>();
            byHashNew[h].Add(kv.Key);
        }
    }
    foreach (var kv in oldMap)
    {
        if (!newMap.ContainsKey(kv.Key)) removed.Add(kv.Key);
        // 移动：旧 path 消失，但其 md5 在新清单的其他 path 出现
        if (!newMap.ContainsKey(kv.Key) && !string.IsNullOrEmpty(kv.Value) && byHashNew.ContainsKey(kv.Value))
            moved.Add(kv.Key + " → " + byHashNew[kv.Value][0]);
    }
    // 重复：同 md5 多 path
    var dupCount = 0;
    var dupLines = new List<string>();
    foreach (var kv in byHashNew)
    {
        if (kv.Value.Count > 1)
        {
            dupCount++;
            dupLines.Add("  ↳ " + kv.Key + "：" + string.Join("、", kv.Value.ToArray()));
        }
    }

    var sb = new StringBuilder();
    sb.Append("# 文件变更报告").Append(title.Length > 0 ? " · " + title : "").Append("（").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm")).Append("）\n\n");
    sb.Append("新增 ").Append(added.Count).Append(" · 删除 ").Append(removed.Count)
      .Append(" · 移动 ").Append(moved.Count).Append(" · 重复组 ").Append(dupCount).Append("\n");

    if (added.Count > 0) { sb.Append("\n## 新增\n"); foreach (var p in added.ToArray()) sb.Append("- ").Append(p).Append("\n"); }
    if (removed.Count > 0) { sb.Append("\n## 删除\n"); foreach (var p in removed.ToArray()) sb.Append("- ").Append(p).Append("\n"); }
    if (moved.Count > 0) { sb.Append("\n## 移动（同指纹不同路径）\n"); foreach (var p in moved.ToArray()) sb.Append("- ").Append(p).Append("\n"); }
    if (dupCount > 0)
    {
        sb.Append("\n## 重复组\n");
        foreach (var l in dupLines.ToArray()) sb.Append("- ").Append(l).Append("\n");
    }
    sb.Append("\n> ⚠️ 本报告只读——思源资源块引用更新、源文件处理均由用户决定，动作不代劳。");

    context.SetVarValue("变更报告", sb.ToString());
    context.SetVarValue("新增数", added.Count);
    context.SetVarValue("删除数", removed.Count);
    context.SetVarValue("移动数", moved.Count);
    context.SetVarValue("重复数", dupCount);
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 报告完成：+" + added.Count + " -" + removed.Count + " →" + moved.Count + " 重复组" + dupCount);
}

// 轻量清单解析：逐行对象提取 path/md5（避免完整 JSON 解析依赖）
public static Dictionary<string, string> ParseManifest(string json)
{
    try
    {
        var map = new Dictionary<string, string>();
        var objRe = new System.Text.RegularExpressions.Regex("\\{[^{}]*\\}");
        foreach (System.Text.RegularExpressions.Match m in objRe.Matches(json))
        {
            var path = ExtractStr(m.Value, "path");
            if (string.IsNullOrEmpty(path)) continue;
            map[path] = ExtractStr(m.Value, "md5") ?? "";
        }
        return map;
    }
    catch { return null; }
}

public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("结果消息", "❌ " + msg);
}

public static string ExtractStr(string json, string field)
{
    if (json == null) return null;
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return null;
    i += key.Length;
    while (i < json.Length && json[i] == ' ') i++;
    if (i >= json.Length) return null;
    if (json[i] != '"')
    {
        var j = i;
        while (j < json.Length && json[j] != ',' && json[j] != '}') j++;
        return json.Substring(i, j - i).Trim();
    }
    i++;
    var sb = new StringBuilder();
    while (i < json.Length && json[i] != '"')
    {
        if (json[i] == '\\' && i + 1 < json.Length)
        {
            i++;
            var c = json[i];
            sb.Append(c == 'n' ? '\n' : c == 't' ? '\t' : c == 'r' ? '\r' : c);
        }
        else sb.Append(json[i]);
        i++;
    }
    return sb.ToString();
}
