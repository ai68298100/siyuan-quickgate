//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// P0-3 思源全局快查（单文件版）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 P0-3（三级 fallback R3 + sql: AI 实验分支 08-O6）· 文本指令 sy
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【输入变量】关键词(文本) SY_URL(文本，默认 http://127.0.0.1:6806) SY_TOKEN(文本)
// 【输出变量】是否成功(布尔) 结果消息(文本) 候选列表(文本，每行"id\t内容摘要"，供 userselect) 块ID(文本)
// 【流程】①全文搜索 fullTextSearchBlock → 零命中 ②自动改跑同名 SQL（content LIKE）→ 仍零命中
//         ③提示加 sql: 前缀。关键词以 `sql:` 开头 → 安全过滤（只允许单条 SELECT/EXPLAIN，
//         拒绝 UPDATE/DELETE/INSERT/DROP/ATTACH/PRAGMA 等写/危险关键词，强制 LIMIT）→ 直跑 SQL。
// 【说明】sql: AI 生成查询分支（/api/ai/chatGPT）依赖思源内置 AI 配置，且端点形状待 M0 实测
//         （docs/03 P0-3 AI 增强）——本版先落地安全过滤+直跑；AI 分支留 AI生成 开关位。
//         选中跳转由后续 openurl 模块用 块ID 完成（siyuan://blocks/{块ID}）。
// ============================================================================
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var keyword = (context.GetVarValue("关键词") as string ?? "").Trim();

    if (keyword.Length == 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 关键词为空");
        return;
    }
    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    // ---- sql: 实验分支：安全过滤 → 直跑 SQL（docs/03 P0-3 + TODO P0-3 安全过滤项） ----
    if (keyword.StartsWith("sql:", StringComparison.OrdinalIgnoreCase))
    {
        var sql = keyword.Substring(4).Trim();
        var guard = GuardSql(sql);
        if (guard.Length > 0)
        {
            context.SetVarValue("是否成功", false);
            context.SetVarValue("结果消息", "❌ SQL 安全检查未通过：" + guard + "（只允许单条只读 SELECT/EXPLAIN）");
            return;
        }
        var r = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(sql) + "}");
        EmitResults(context, r, "SQL 查询完成");
        return;
    }

    // ---- ①全文搜索 ----
    var body = "{\"query\":" + JStr(keyword) + ",\"method\":0,\"orderBy\":0,\"types\":{\"paragraph\":true,\"heading\":true,\"list\":true},\"page\":1}";
    var fr = KernelPost(syUrl, token, "/api/search/fullTextSearchBlock", body);
    if (fr.Success)
    {
        var candidates = ExtractBlocks(fr.Text);
        if (candidates.Count > 0) { Emit(context, candidates, "✓ 全文搜索命中 " + candidates.Count + " 条"); return; }
    }
    else { Fail(context, fr.Error); return; }

    // ---- ②同名 SQL fallback（PowerToys Run 式无感降级） ----
    var like = keyword.Replace("'", "''");
    var stmt = "SELECT id,content FROM blocks WHERE content LIKE '%" + like + "%' AND type IN ('p','h') LIMIT 20";
    var sr = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
    if (sr.Success)
    {
        var candidates2 = ExtractBlocks(sr.Text);
        if (candidates2.Count > 0) { Emit(context, candidates2, "✓ 模糊匹配 " + candidates2.Count + " 条"); return; }
    }

    // ---- ③三级兜底提示 ----
    Fail(context, "没有找到「" + keyword + "」。加 sql: 前缀可用 SQL 查询（只读）");
}

// ---- SQL 安全过滤（P0-3 安全项：未知不得改写为成功的查询面镜像） ----
public static string GuardSql(string sql)
{
    var upper = sql.Trim().ToUpperInvariant();
    if (upper.Length == 0) return "空语句";
    if (upper.Contains(";")) return "不允许多语句（分号）";
    if (!upper.StartsWith("SELECT") && !upper.StartsWith("EXPLAIN")) return "只允许 SELECT/EXPLAIN 开头";
    var deny = new string[] { "UPDATE", "DELETE", "INSERT", "REPLACE", "DROP", "CREATE", "ALTER",
                              "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX", "INTO" };
    foreach (var w in deny)
    {
        var token2 = " " + w + " ";
        if ((" " + upper + " ").Contains(token2)) return "含禁止关键词 " + w;
    }
    if (!upper.Contains("LIMIT")) return "缺少 LIMIT（强制限流）";
    return "";
}

// ---- 结果输出：data.blocks[*] 与 SQL 行两种形状都兼容 ----
public static List<string> ExtractBlocks(string json)
{
    var list = new List<string>();
    if (json == null) return list;
    foreach (var rawLine in json.Replace("\r\n", "\n").Split('\n'))
    {
        var id = ExtractStr(rawLine, "id");
        if (id == null || id.Length == 0) continue;
        var content = ExtractStr(rawLine, "content") ?? "";
        if (content.Length > 60) content = content.Substring(0, 60) + "…";
        list.Add(id + "\t" + content.Replace("\t", " "));
    }
    return list;
}

public static void Emit(Quicker.Public.IStepContext context, List<string> candidates, string msg)
{
    context.SetVarValue("候选列表", string.Join("\n", candidates.ToArray()));
    context.SetVarValue("块ID", "");
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", msg);
}

public static void EmitResults(Quicker.Public.IStepContext context, KernelResult r, string okMsg)
{
    if (!r.Success) { Fail(context, r.Error); return; }
    var code = ExtractNum(r.Text, "code");
    if (code != 0) { Fail(context, "思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? "")); return; }
    var rows = ExtractBlocks(r.Text);
    if (rows.Count == 0) { Fail(context, "查询成功但零行"); return; }
    Emit(context, rows, okMsg + "（" + rows.Count + " 行）");
}

public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("结果消息", "❌ " + msg);
    context.SetVarValue("候选列表", "");
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
