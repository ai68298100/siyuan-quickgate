//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·文件项目索引（R154-01 落地件）—— 选中文件/目录写元数据索引到思源文档
// 验收语义（docs/21 R154-01）：默认只写引用与元数据，**不移动源文件**；权限不足进部分成功报告
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【输入变量】文件路径列表(文本，每行一个路径——Quicker 选中文件变量逐行拼接)
//             目标文档ID(文本，项目文档/收集箱) 含哈希(文本，"true"=对 ≤100MB 文件算 MD5，默认 false)
//             SY_URL(文本) SY_TOKEN(文本)
// 【输出变量】是否成功(布尔) 结果消息(文本) 索引Markdown(文本)
// 【语义】目录=列条目数与总大小（不递归展开——大目录保护，递归挂后续版本）；单文件=逐行元数据；
//         权限不足/已消失的路径进「失败清单」；部分成功不掩盖（总失败≠全未写入）。
// ============================================================================
using System;
using System.Collections.Generic;
using System.Net;
using System.Security.Cryptography;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var targetDoc = context.GetVarValue("目标文档ID") as string ?? "";
    var withHash = (context.GetVarValue("含哈希") as string ?? "false").Trim() == "true";
    var pathList = context.GetVarValue("文件路径列表") as string ?? "";

    if (token.Length == 0) { Fail(context, "未配置 SY_TOKEN"); return; }
    if (targetDoc.Length == 0) { Fail(context, "未配置目标文档ID"); return; }

    var paths = new List<string>();
    foreach (var raw in pathList.Replace("\r\n", "\n").Split('\n'))
    {
        var p = raw.Trim();
        if (p.Length > 0) paths.Add(p);
    }
    if (paths.Count == 0) { Fail(context, "文件路径列表为空（动作需先取选中文件）"); return; }

    var rows = new StringBuilder();
    var okCount = 0;
    var failures = new List<string>();
    rows.Append("| 路径 | 类型 | 大小 | 修改时间 | MD5 |\n|---|---|---|---|---|\n");

    foreach (var p in paths)
    {
        try
        {
            if (System.IO.Directory.Exists(p))
            {
                var di = new System.IO.DirectoryInfo(p);
                var files = di.GetFiles();
                long total = 0;
                foreach (var f in files) { try { total += f.Length; } catch { } }
                rows.Append("| ").Append(Esc(p)).Append(" | 目录 | ").Append(FormatSize(total))
                     .Append("（").Append(files.Length).Append(" 项） | ").Append(di.LastWriteTime.ToString("yyyy-MM-dd HH:mm")).Append(" | — |\n");
                okCount++;
            }
            else if (System.IO.File.Exists(p))
            {
                var fi = new System.IO.FileInfo(p);
                var hash = "—";
                if (withHash && fi.Length <= 100L * 1024 * 1024)
                {
                    using (var md5 = MD5.Create())
                    using (var stream = fi.OpenRead())
                    {
                        var h = md5.ComputeHash(stream);
                        var sb = new StringBuilder();
                        foreach (var b in h) sb.Append(b.ToString("x2"));
                        hash = sb.ToString().Substring(0, 8);
                    }
                }
                else if (withHash) hash = "超100MB跳过";
                rows.Append("| ").Append(Esc(p)).Append(" | 文件 | ").Append(FormatSize(fi.Length))
                     .Append(" | ").Append(fi.LastWriteTime.ToString("yyyy-MM-dd HH:mm")).Append(" | ").Append(hash).Append(" |\n");
                okCount++;
            }
            else
            {
                failures.Add("不存在:" + p);
            }
        }
        catch (UnauthorizedAccessException) { failures.Add("权限不足:" + p); }
        catch (Exception ex) { failures.Add("读取失败:" + p + "（" + ex.Message + "）"); }
    }

    var head = new StringBuilder();
    head.Append("## 文件索引（").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm"))
        .Append("，").Append(okCount).Append(" 项成功").Append(failures.Count > 0 ? "，" + failures.Count + " 项失败" : "").Append("）\n\n");
    foreach (var f in failures.ToArray()) head.Append("> ⚠️ ").Append(f).Append("\n");
    if (failures.Count > 0) head.Append("\n");
    head.Append(rows);

    var md = head.ToString();
    var payload = "{\"parentID\":" + JStr(targetDoc) + ",\"dataType\":\"markdown\",\"data\":" + JStr(md) + "}";
    var r = KernelPost(syUrl, token, "/api/block/insertBlock", payload);
    if (!r.Success) { Fail(context, r.Error); return; }
    var code = ExtractNum(r.Text, "code");
    if (code != 0) { Fail(context, "思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? "")); return; }

    context.SetVarValue("索引Markdown", md);
    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 已索引 " + okCount + " 项" + (failures.Count > 0 ? "（" + failures.Count + " 项失败见清单）" : ""));
}

public static string Esc(string s) { return (s ?? "").Replace("|", "\\|").Replace("\n", " "); }
public static string FormatSize(long bytes)
{
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return (bytes / 1024.0).ToString("F1") + "KB";
    if (bytes < 1024L * 1024 * 1024) return (bytes / 1024.0 / 1024).ToString("F1") + "MB";
    return (bytes / 1024.0 / 1024 / 1024).ToString("F2") + "GB";
}
public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("结果消息", "❌ " + msg);
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
        req.Timeout = 30000; // 哈希大文件时写入体可能大
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
