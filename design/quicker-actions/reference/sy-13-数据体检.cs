//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY-13 数据体检（单文件版，只读）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 SY-13（借鉴「无效数据处理」，只读版）· 文本指令 tj · 超级面板 ⚙️ 组
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【输入变量】体检项(文本，"空文档"/"重复标题"/"长期未更新"，默认全部跑) SY_URL(文本) SY_TOKEN(文本)
//             日记笔记本ID(文本，可空——"长期未更新"用 box 限定)
// 【输出变量】是否成功(布尔) 结果消息(文本) 体检报告(文本，showtext 模块展示)
// 【铁律】**只读不删**——清理引导用户使用原作「无效数据处理」动作（成熟度高，不重复造轮子）；
//         报表必须带「可能误判」提示（已关闭笔记本/嵌入块/AV 绑定文档，docs/03 SY-13）。
// ============================================================================
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var item = (context.GetVarValue("体检项") as string ?? "").Trim();
    var notebook = context.GetVarValue("日记笔记本ID") as string ?? "";

    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    var report = new StringBuilder();
    report.Append("# 小驴数据体检报表 ").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm")).Append("\n");
    var allOk = true;

    if (item.Length == 0 || item == "空文档")
    {
        var r = RunSql(context, syUrl, token, "SELECT id,content FROM blocks WHERE type='d' AND content='' LIMIT 50");
        if (r == null) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 空文档检查失败"); return; }
        report.Append("\n## 空文档（≤50）\n").Append(r.Length == 0 ? "✓ 无" : r).Append("\n");
        if (r.Length > 0) allOk = false;
    }
    if (item.Length == 0 || item == "重复标题")
    {
        var r = RunSql(context, syUrl, token, "SELECT content, COUNT(*) AS c FROM blocks WHERE type='d' GROUP BY content HAVING c>1 LIMIT 50");
        if (r == null) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 重复标题检查失败"); return; }
        report.Append("\n## 重复标题文档（≤50）\n").Append(r.Length == 0 ? "✓ 无" : r).Append("\n");
        if (r.Length > 0) allOk = false;
    }
    if (item.Length == 0 || item == "长期未更新")
    {
        // id 前缀=创建时间戳：升序取最早 50 个；box 可选限定
        var boxFilter = notebook.Length > 0 ? " AND box='" + notebook.Replace("'", "''") + "'" : "";
        var r = RunSql(context, syUrl, token, "SELECT id,content FROM blocks WHERE type='d'" + boxFilter + " ORDER BY id ASC LIMIT 50");
        if (r == null) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 长期未更新检查失败"); return; }
        report.Append("\n## 最早创建的文档（top50，自查是否仍需要）\n").Append(r.Length == 0 ? "✓ 无文档" : r).Append("\n");
    }

    report.Append("\n> ⚠️ 可能误判提示：已关闭笔记本、嵌入块内引用、AV 绑定文档不在本报表视野内；")
          .Append("本报表**只读不删**——清理请使用原作「无效数据处理」动作。")
          .Append("\n> 总体：").Append(allOk ? "✓ 未发现问题" : "发现待复核项（见上）");

    context.SetVarValue("体检报告", report.ToString());
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", allOk ? "✓ 体检完成，未发现问题" : "⚠️ 体检完成，发现待复核项（报告见 体检报告 变量）");
}

// 跑 SQL 并格式化为报表行（id 链接化）；失败返回 null
public static string RunSql(Quicker.Public.IStepContext context, string syUrl, string token, string stmt)
{
    var r = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
    if (!r.Success) return null;
    var code = ExtractNum(r.Text, "code");
    if (code != 0) return null;
    var sb = new StringBuilder();
    foreach (var line in r.Text.Replace("\r\n", "\n").Split('\n'))
    {
        var id = ExtractStr(line, "id") ?? ExtractStr(line, "root_id");
        var content = ExtractStr(line, "content") ?? ExtractStr(line, "bcontent") ?? "";
        var c = ExtractStr(line, "c");
        if (id == null && c == null) continue;
        if (content.Length > 40) content = content.Substring(0, 40) + "…";
        if (id != null) sb.Append("- ").Append(content.Length > 0 ? content : "（空）").Append("  [打开](siyuan://blocks/").Append(id).Append(")\n");
        else sb.Append("- ").Append(content).Append(" ×").Append(c).Append("\n");
    }
    return sb.ToString();
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
        req.Timeout = 15000;
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
            return new KernelResult { Success = false, Text = "", Error = "令牌无效" };
        if (resp != null) return new KernelResult { Success = false, Text = "", Error = "HTTP " + (int)resp.StatusCode };
        return new KernelResult { Success = false, Text = "", Error = "思源未运行或网络错误" };
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
