//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY-12 汇总日记待办（单文件版）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 SY-12（借鉴「汇总日记代办」，纯内核）· 文本指令 db
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【输入变量】天数(文本/数字，默认 7) SY_URL(文本) SY_TOKEN(文本) 日记笔记本ID(文本，可空)
// 【输出变量】是否成功(文本→布尔) 结果消息(文本) 汇总Markdown(文本) 命中数(数字)
// 【流程】①本地生成最近 N 天 yyyy-MM-dd 白名单谓词（每日一条 LIKE，不做 %20% 宽匹配）
//         ②SQL：日记文档(d.box 限定+日期谓词) × markdown 含 "[ ]" 未勾选待办，LIMIT 100
//         ③汇总块写今日日记：## 待办汇总（近N天）+ 每条 - [ ] 内容 [链接](siyuan://blocks/{id})
// 【教训】只统计日记文档里的待办，别全库扫（原作讨论区）；笔记本ID/日期均做转义与格式校验。
// ============================================================================
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var notebook = context.GetVarValue("日记笔记本ID") as string ?? "";
    var days = 7;
    int.TryParse(context.GetVarValue("天数") as string ?? "", out days);
    if (days <= 0) days = 7;
    if (days > 60) days = 60;

    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    // ① 日期白名单谓词（固定格式生成，注入安全）
    var predicates = new List<string>();
    for (var i = 0; i < days; i++)
    {
        var d = DateTime.Now.AddDays(-i).ToString("yyyy-MM-dd");
        predicates.Add("d.content LIKE '%" + d + "%'");
    }
    var datePred = "(" + string.Join(" OR ", predicates.ToArray()) + ")";

    // ② 聚合 SQL（笔记本 ID 单引号转义）
    var box = notebook.Replace("'", "''");
    var boxFilter = notebook.Length > 0 ? " AND d.box='" + box + "'" : "";
    var stmt = "SELECT b.id AS bid, b.content AS bcontent, b.root_id AS rid FROM blocks b " +
               "JOIN blocks d ON b.root_id=d.id WHERE d.type='d' " + boxFilter + " AND " + datePred +
               " AND b.markdown LIKE '%[ ]%' ORDER BY b.id DESC LIMIT 100";
    var r = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
    if (!r.Success) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ " + r.Error); return; }
    var code = ExtractNum(r.Text, "code");
    if (code != 0) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? "")); return; }

    // 逐行提取（每行一个 SQL 行对象）
    var items = new List<string[]>(); // [blockId, content, rootId]
    foreach (var line in r.Text.Replace("\r\n", "\n").Split('\n'))
    {
        var bid = ExtractStr(line, "bid");
        if (bid == null || bid.Length == 0) continue;
        var bcontent = ExtractStr(line, "bcontent") ?? "";
        var rid = ExtractStr(line, "rid") ?? "";
        // 待办内容规整：剥 markdown 勾选标记，截断
        bcontent = bcontent.Replace("[ ]", "").Replace("[x]", "").Trim();
        if (bcontent.Length > 80) bcontent = bcontent.Substring(0, 80) + "…";
        items.Add(new string[] { bid, bcontent, rid });
    }

    if (items.Count == 0)
    {
        context.SetVarValue("是否成功", true);
        context.SetVarValue("结果消息", "✓ 近 " + days + " 天日记没有未完成待办");
        context.SetVarValue("命中数", 0);
        return;
    }

    // ③ 汇总块（链接指回原块，跳转高亮）
    var sb = new StringBuilder();
    sb.Append("## 待办汇总（近").Append(days).Append("天，").Append(items.Count).Append("条）\n");
    foreach (var it in items.ToArray())
        sb.Append("- [ ] ").Append(it[1]).Append(" [→](siyuan://blocks/").Append(it[0]).Append(")\n");

    var w = KernelPost(syUrl, token, "/api/block/appendDailyNoteBlock",
        "{\"notebook\":" + JStr(notebook) + ",\"dataType\":\"markdown\",\"data\":" + JStr(sb.ToString()) + "}");
    if (!w.Success) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 写汇总失败：" + w.Error); return; }
    var wcode = ExtractNum(w.Text, "code");
    if (wcode != 0) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 写汇总返回 " + wcode + "：" + (ExtractStr(w.Text, "msg") ?? "")); return; }

    context.SetVarValue("汇总Markdown", sb.ToString());
    context.SetVarValue("命中数", items.Count);
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 已汇总 " + items.Count + " 条待办到今日日记");
}

// ---- 内核与 JSON 原语（与 g2-capture.cs 同款，C#5 零依赖） ----
public static KernelResult KernelPost(string syUrl, string token, string endpoint, string body)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + endpoint);
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = 10000;
        var buf = Encoding.UTF8.GetBytes(body);
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new KernelResult { Success = true, Text = reader.ReadToEnd(), Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null && ((int)resp.StatusCode == 401 || (int)resp.StatusCode == 403))
            return new KernelResult { Success = false, Text = "", Error = "令牌无效：思源 设置→关于→复制 API 令牌 后更新 SY_TOKEN" };
        if (resp != null) return new KernelResult { Success = false, Text = "", Error = "HTTP " + (int)resp.StatusCode };
        return new KernelResult { Success = false, Text = "", Error = "思源未运行或网络错误（SY·思源未运行分支可恢复）" };
    }
    catch (Exception ex) { return new KernelResult { Success = false, Text = "", Error = "请求异常：" + ex.Message }; }
}

public static string JStr(string s)
{
    var sb = new StringBuilder(s.Length + 8);
    sb.Append('"');
    foreach (var ch in s)
    {
        if (ch == '\\' || ch == '"') { sb.Append('\\'); sb.Append(ch); }
        else if (ch == '\n') sb.Append("\\n");
        else if (ch == '\r') sb.Append("\\r");
        else if (ch == '\t') sb.Append("\\t");
        else if (ch < 32) sb.Append("\\u" + ((int)ch).ToString("x4"));
        else sb.Append(ch);
    }
    sb.Append('"');
    return sb.ToString();
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

public static int ExtractNum(string json, string field)
{
    var n = 0;
    int.TryParse(ExtractStr(json, field) ?? "", out n);
    return n;
}

public struct KernelResult { public bool Success; public string Text; public string Error; }
