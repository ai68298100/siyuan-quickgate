//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·研究来源卡（R152-04 落地件）—— 网页/文献摘录写入结构化来源卡（Quicker C# 普通模式v2）
// 契约对齐：docs/contracts/evidence-envelope（claims/sources/truncated/sensitivity 分层）
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【输入变量】选中文本(文本，摘录正文，必填) 页面URL(文本，可空) 页面标题(文本，可空=来源窗口)
//             推断笔记(文本，可空——自己的话，卡内明确标注「推断」层) 收集箱ID(文本，可空=留空报错)
//             SY_URL(文本) SY_TOKEN(文本)
// 【输出变量】是否成功(布尔) 结果消息(文本) 块ID(文本) 内容指纹(文本，摘录 MD5 前 8 位)
// 【卡结构】三层分明：摘录层（> 引用全文，页面失效仍可读）→ 来源层（URL·标题·抓取时间·内容指纹）
//           → 推断层（标注「推断」，与摘录物理隔离）。重复 URL 不阻断，结果消息提示已有卡时间。
// 【指纹裁定（R152-04 缺口(a)）】：内容指纹 = 摘录正文 MD5 前 8 位（非整页 hash）——同一摘录
//   重复入库可指纹比对；整页 hash 需抓取正文，挂浏览器扩展轮。
// ============================================================================
using System;
using System.Net;
using System.Security.Cryptography;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var inboxId = context.GetVarValue("收集箱ID") as string ?? "";
    var selectedText = (context.GetVarValue("选中文本") as string ?? "").Trim();
    var pageUrl = (context.GetVarValue("页面URL") as string ?? "").Trim();
    var pageTitle = (context.GetVarValue("页面标题") as string ?? "").Trim();
    if (pageTitle.Length == 0) pageTitle = (context.GetVarValue("来源窗口") as string ?? "").Trim();
    var note = (context.GetVarValue("推断笔记") as string ?? "").Trim();

    if (selectedText.Length == 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 摘录正文为空");
        return;
    }
    if (token.Length == 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN");
        return;
    }
    if (inboxId.Length == 0)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置收集箱ID（config.discover 自动发现或手填）");
        return;
    }

    // 内容指纹（R152-04 裁定：摘录正文 MD5 前 8 位）
    string fingerprint;
    using (var md5 = MD5.Create())
    {
        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(selectedText));
        var sb = new StringBuilder();
        foreach (var b in hash) sb.Append(b.ToString("x2"));
        fingerprint = sb.ToString().Substring(0, 8);
    }
    context.SetVarValue("内容指纹", fingerprint);

    // 重复 URL 提示（不阻断）：SQL 查收集箱内已有同 URL 卡
    var dupHint = "";
    if (pageUrl.Length > 0)
    {
        var like = pageUrl.Replace("'", "''");
        var q = KernelPost(syUrl, token, "/api/query/sql",
            "{\"stmt\":" + JStr("SELECT content FROM blocks WHERE parentID=" + JStr2(inboxId) +
            " AND markdown LIKE '%" + like.Replace("%", "").Replace("[", "[[]") + "%' ORDER BY id DESC LIMIT 1") + "}");
        if (q.Success && q.Text.Contains("\"id\""))
        {
            dupHint = "（提示：收集箱已有同 URL 卡）";
        }
    }

    // 卡结构：摘录层 → 来源层 → 推断层（物理隔离，evidence-envelope 分层映射）
    var now = DateTime.Now;
    var fetchedAt = now.ToString("yyyy-MM-dd HH:mm");
    var sb2 = new StringBuilder();
    sb2.Append("> ").Append(selectedText.Replace("\r\n", "\n").Replace("\n", "\n> ")).Append("\n\n");
    sb2.Append("## 来源\n");
    if (pageUrl.Length > 0) sb2.Append("- URL：").Append(pageUrl).Append("\n");
    if (pageTitle.Length > 0) sb2.Append("- 标题：").Append(pageTitle).Append("\n");
    sb2.Append("- 抓取时间：").Append(fetchedAt).Append("\n");
    sb2.Append("- 内容指纹：").Append(fingerprint).Append("\n");
    if (note.Length > 0)
    {
        sb2.Append("\n## 推断（我的话，非原文）\n").Append(note.Replace("\n", "\n")).Append("\n");
    }

    var payload = "{\"parentID\":" + JStr(inboxId) + ",\"dataType\":\"markdown\",\"data\":" + JStr(sb2.ToString()) + "}";
    var r = KernelPost(syUrl, token, "/api/block/insertBlock", payload);
    if (!r.Success) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ " + r.Error); return; }
    var code = ExtractNum(r.Text, "code");
    if (code != 0) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? "")); return; }

    context.SetVarValue("块ID", ExtractStr(r.Text, "data") ?? "");
    context.SetVarValue("是否成功", true);
    var preview = selectedText.Length > 30 ? selectedText.Substring(0, 30) + "…" : selectedText;
    context.SetVarValue("结果消息", "✓ 来源卡已入收集箱：" + preview + dupHint);
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
            return new KernelResult { Success = false, Text = "", Error = "令牌无效：思源 设置→关于→复制 API 令牌" };
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

private static string JStr2(string s) { return JStr(s); }

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
