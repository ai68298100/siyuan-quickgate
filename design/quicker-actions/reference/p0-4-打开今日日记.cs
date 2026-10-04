//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// P0-4 打开今日日记 / 收集箱（单文件版）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 P0-4 · 文本指令/鼠标侧键
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【输入变量】目标(文本，"日记"或"收集箱"，默认 日记) SY_URL(文本) SY_TOKEN(文本)
//             日记笔记本ID(文本，可空——收集箱目标时用作 box 限定) 收集箱文档ID(文本，可空=先发现)
// 【输出变量】是否成功(布尔) 结果消息(文本) 后续动作(文本，"openurl:siyuan://blocks/{id}"，交后续 openurl 模块)
// 【说明】日记：SQL 找 content 含今日日期的文档（today 白名单精确 yyyy-MM-dd，不做宽 %20% 匹配）；
//         零命中 → 自动创建：appendDailyNoteBlock 轻触（写一个空列表块）再 SQL 重取——
//         与蓝图「今日日记状态只探测不创建」不同，此动作语义就是"打开，没有就建"（P0-4 主流程）。
// ============================================================================
using System;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var target = (context.GetVarValue("目标") as string ?? "日记").Trim();
    var notebook = context.GetVarValue("日记笔记本ID") as string ?? "";
    var inbox = context.GetVarValue("收集箱文档ID") as string ?? "";

    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    if (target == "收集箱")
    {
        if (inbox.Length > 0) { Open(context, inbox); return; }
        // 自动发现：config.discover（快门已装）→ 不在时提示配置
        var d = KernelPost(syUrl, token, "/plugin/private/siyuan-quickgate/exec", "{\"op\":\"config.discover\",\"args\":{}}");
        if (d.Success)
        {
            var found = ExtractStr(d.Text, "inboxDocId") ?? "";
            if (found.Length > 0) { Open(context, found); return; }
        }
        Fail(context, "收集箱未配置且自动发现未命中（动作设置里手填 收集箱文档ID）");
        return;
    }

    // ---- 日记 ----
    var today = DateTime.Now.ToString("yyyy-MM-dd");
    var boxFilter = notebook.Length > 0 ? " AND box=" + JStr(notebook) : "";
    var stmt = "SELECT root_id FROM blocks WHERE type='d' AND content LIKE '%" + today + "%'" + boxFilter + " LIMIT 1";
    var r = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
    if (!r.Success) { Fail(context, r.Error); return; }
    var rootId = ExtractStr(r.Text, "root_id") ?? "";
    if (rootId.Length > 0) { Open(context, rootId); return; }

    // 今日日记不存在 → appendDailyNoteBlock 触发创建（自带建日记）→ 重取
    var create = KernelPost(syUrl, token, "/api/block/appendDailyNoteBlock",
        "{\"notebook\":" + JStr(notebook) + ",\"dataType\":\"markdown\",\"data\":\"\"}");
    if (!create.Success) { Fail(context, create.Error); return; }
    var code = ExtractNum(create.Text, "code");
    if (code != 0) { Fail(context, "创建日记失败：" + (ExtractStr(create.Text, "msg") ?? "")); return; }

    var r2 = KernelPost(syUrl, token, "/api/query/sql", "{\"stmt\":" + JStr(stmt) + "}");
    if (!r2.Success) { Fail(context, r2.Error); return; }
    rootId = ExtractStr(r2.Text, "root_id") ?? "";
    if (rootId.Length == 0) { Fail(context, "日记已创建但定位失败（索引延迟 ~1s，重试一次即可）"); return; }
    Open(context, rootId);
}

public static void Open(Quicker.Public.IStepContext context, string blockId)
{
    context.SetVarValue("后续动作", "openurl:siyuan://blocks/" + blockId);
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 已定位（由后续 openurl 模块打开）");
}

public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("结果消息", "❌ " + msg);
    context.SetVarValue("后续动作", "");
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
