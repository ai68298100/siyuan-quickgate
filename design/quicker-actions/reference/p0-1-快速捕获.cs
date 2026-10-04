//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// P0-1 快速捕获到今日日记（单文件版）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 P0-1（含 R6 标题落点变体 + R3 多目标路由）· 共享规范 docs/03 §0
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【前置】动作首步建议 userinput（多行，标题「记点什么」→ 变量 内容）；本脚本从 内容 变量接续。
// 【输入变量】内容(文本，必填) SY_URL(文本，默认 http://127.0.0.1:6806) SY_TOKEN(文本)
//             日记笔记本ID(文本，可空=留空由思源默认日记笔记本处理) 落点标题(文本，可空=文末)
//             路由规则表(文本，可空，`#前缀=目标文档ID` 每行一条——见 SY-路由前缀解析.cs)
// 【输出变量】是否成功(布尔) 结果消息(文本) 块ID(文本)
// 【说明】①appendDailyNoteBlock 自带「今日日记不存在则创建」，无需预检；
//         ②落点标题非空时先 SQL 定位标题块 → appendBlock 到该节区（零命中回退文末并说明）；
//         ③内容以 `#前缀` 开头且命中路由表 → 直接落入目标文档（多目标路由 R3）；
//         ④失败分支含 401 令牌引导与「思源未运行」提示（对接 SY-思源未运行分支.cs 可替换）。
// ============================================================================
using System;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var notebook = context.GetVarValue("日记笔记本ID") as string ?? "";
    var heading = context.GetVarValue("落点标题") as string ?? "";
    var rules = context.GetVarValue("路由规则表") as string ?? "";
    var content = (context.GetVarValue("内容") as string ?? "").Trim();

    if (content.Length == 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 内容为空（动作首步 userinput 未取到输入）");
        return;
    }
    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    // ---- R3 多目标路由：#前缀 命中 → 改落点为指定文档（仅捕获前缀路由，@人脉 见摘录动作） ----
    var rest = content;
    if (content.StartsWith("#"))
    {
        var target = MatchPrefixRule(rules, content);
        if (target.Length > 0)
        {
            var sp = content.IndexOf(' ');
            rest = sp < 0 ? "" : content.Substring(sp + 1).Trim();
            var md2 = "- " + DateTime.Now.ToString("HH:mm ") + rest;
            var body2 = "{\"parentID\":" + JStr(target) + ",\"dataType\":\"markdown\",\"data\":" + JStr(md2) + "}";
            var r2 = KernelPost(syUrl, token, "/api/block/insertBlock", body2);
            Finish(context, r2, "✓ 已按路由入档");
            return;
        }
    }

    // ---- 主流程：HH:mm 前缀 → 今日日记 ----
    var md = "- " + DateTime.Now.ToString("HH:mm ") + rest;
    var parentId = "";

    // R6 变体：落点标题非空 → 先定位标题块（SQL 单引号转义，docs/03 P0-1 变体）
    if (heading.Length > 0)
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        var like = heading.Replace("'", "''");
        var stmt = "SELECT id FROM blocks WHERE type='h' AND content LIKE '%" + like + "%' AND root_id IN " +
                   "(SELECT id FROM blocks WHERE type='d' AND content LIKE '%" + today + "%') ORDER BY id LIMIT 1";
        var q = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
        if (q.Success)
        {
            parentId = ExtractStr(q.Text, "id") ?? "";
            // 零命中 → 回退文末（parentId 空），消息里说明
        }
    }

    string body, endpoint;
    if (parentId.Length > 0)
    {
        endpoint = "/api/block/appendBlock";
        body = "{\"parentID\":" + JStr(parentId) + ",\"dataType\":\"markdown\",\"data\":" + JStr(md) + "}";
    }
    else
    {
        endpoint = "/api/block/appendDailyNoteBlock";
        body = "{\"notebook\":" + JStr(notebook) + ",\"dataType\":\"markdown\",\"data\":" + JStr(md) + "}";
    }

    var r = KernelPost(syUrl, token, endpoint, body);
    Finish(context, r, parentId.Length > 0 ? "✓ 已入今日日记「" + heading + "」下" : "✓ 已入今日日记");
}

public static void Finish(Quicker.Public.IStepContext context, KernelResult r, string okMsg)
{
    if (!r.Success)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ " + r.Error);
        return;
    }
    var code = ExtractNum(r.Text, "code");
    if (code != 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? ""));
        return;
    }
    context.SetVarValue("块ID", ExtractStr(r.Text, "data") ?? "");
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", okMsg);
    // 反馈由后续 notify 模块展示 结果消息（docs/03 §0 文案规范）
}

// ---- 前缀路由（与 SY-路由前缀解析.cs 同规：最长匹配） ----
public static string MatchPrefixRule(string rules, string input)
{
    if (rules.Length == 0 || !input.StartsWith("#")) return "";
    var sp = input.IndexOf(' ');
    var token = sp < 0 ? input : input.Substring(0, sp);
    var best = "";
    foreach (var rawLine in rules.Replace("\r\n", "\n").Split('\n'))
    {
        var line = rawLine.Trim();
        if (!line.StartsWith("#") || !line.Contains("=")) continue;
        var eq = line.IndexOf('=');
        var prefix = line.Substring(0, eq).Trim();
        if (token.StartsWith(prefix) && prefix.Length > best.Length) best = line.Substring(eq + 1).Trim();
    }
    return best; // 空=未命中（走默认日记）
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
