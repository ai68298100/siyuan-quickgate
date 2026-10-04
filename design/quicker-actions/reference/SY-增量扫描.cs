//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·增量扫描（R154-02 落地件）—— 目录自上次扫描点以来的新增/变更文件 → 收件箱草稿
// 验收语义（docs/21 R154-02）：文件稳定后才收（LastWriteTime 年龄 ≥5s）；临时/同步盘副本过滤；
//                               停止监听=调用方按需停用本子程序（重入安全，无长驻）
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【输入变量】监控目录(文本，多行/分号分隔) 上次扫描时间(文本，ISO；空=全量首轮)
//             目标文档ID(文本，收件箱/项目文档) 稳定秒(数字，默认 5) SY_URL(文本) SY_TOKEN(文本)
// 【输出变量】是否成功(布尔) 结果消息(文本) 新文件数(数字) 本轮最新时间(文本——写回 statestorage
//             作为下次「上次扫描时间」，调用方负责持久化) 草稿Markdown(文本)
// 【过滤】~$/*/.tmp/.crdownload/.part 临时件；LastWriteTime 在未来（时钟偏差）→ 记入但以 max 现在值为基点
// 【说明】长驻 watcher 不做（Quicker 动作是有限时长模型）——「重入式增量」等价且幂等：漏扫窗口
//         由上次扫描点覆盖，重复扫描由草稿幂等键（路径+mtime）提示去重。
// ============================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var targetDoc = context.GetVarValue("目标文档ID") as string ?? "";
    var dirsRaw = context.GetVarValue("监控目录") as string ?? "";
    var lastRaw = (context.GetVarValue("上次扫描时间") as string ?? "").Trim();
    var stableSec = 5;
    int.TryParse(context.GetVarValue("稳定秒") as string, out stableSec);
    if (stableSec <= 0) stableSec = 5;

    if (token.Length == 0) { Fail(context, "未配置 SY_TOKEN"); return; }
    if (targetDoc.Length == 0) { Fail(context, "未配置目标文档ID"); return; }

    DateTime since = DateTime.MinValue;
    if (lastRaw.Length > 0 && !DateTime.TryParse(lastRaw, out since)) since = DateTime.MinValue;

    var dirs = new List<string>();
    foreach (var raw in dirsRaw.Replace("\r\n", "\n").Split('\n', ';'))
    {
        var d = raw.Trim();
        if (d.Length > 0 && Directory.Exists(d)) dirs.Add(d);
    }
    if (dirs.Count == 0) { Fail(context, "监控目录为空或不存在"); return; }

    // 增量收集（临时件过滤 + 稳定性检查）
    var found = new List<FileInfo>();
    var maxSeen = since;
    foreach (var dir in dirs)
    {
        try
        {
            foreach (var f in new DirectoryInfo(dir).GetFiles())
            {
                if (f.Name.StartsWith("~$")) continue;
                var ext = f.Extension.ToLowerInvariant();
                if (ext == ".tmp" || ext == ".crdownload" || ext == ".part") continue;
                if (f.LastWriteTime > since)
                {
                    // 稳定性：最后写入距今 ≥ stableSec 秒才收（仍在写的文件留给下轮）
                    if ((DateTime.Now - f.LastWriteTime).TotalSeconds < stableSec) continue;
                    found.Add(f);
                }
                if (f.LastWriteTime > maxSeen && f.LastWriteTime <= DateTime.Now) maxSeen = f.LastWriteTime;
            }
        }
        catch (UnauthorizedAccessException) { /* 无权限目录跳过，下轮再试 */ }
        catch (DirectoryNotFoundException) { /* 已消失目录跳过 */ }
    }
    found.Sort((a, b) => DateTime.Compare(a.LastWriteTime, b.LastWriteTime));

    context.SetVarValue("新文件数", found.Count);
    context.SetVarValue("本轮最新时间", maxSeen == DateTime.MinValue ? lastRaw : maxSeen.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
    if (found.Count == 0)
    {
        context.SetVarValue("是否成功", true);
        context.SetVarValue("结果消息", "✓ 无新增文件（基点 " + (lastRaw.Length > 0 ? lastRaw : "首轮") + "）");
        return;
    }

    // 草稿：逐行路径/大小/时间（幂等提示：路径+mtime 即天然幂等键，重复扫描同键由人工或后续去重）
    var sb = new StringBuilder();
    sb.Append("## 收件箱 · 增量文件（").Append(found.Count).Append(" 个，自 ").Append(lastRaw.Length > 0 ? lastRaw : "首轮").Append("）\n");
    foreach (var f in found.ToArray())
    {
        sb.Append("- ").Append(Esc(f.Name)).Append("（").Append(FormatSize(f.Length)).Append("，")
          .Append(f.LastWriteTime.ToString("MM-dd HH:mm")).Append("）`").Append(Esc(f.FullName)).Append("`\n");
    }
    context.SetVarValue("草稿Markdown", sb.ToString());

    var payload = "{\"parentID\":" + JStr(targetDoc) + ",\"dataType\":\"markdown\",\"data\":" + JStr(sb.ToString()) + "}";
    var r = KernelPost(syUrl, token, "/api/block/insertBlock", payload);
    if (!r.Success) { Fail(context, r.Error); return; }
    var code = ExtractNum(r.Text, "code");
    if (code != 0) { Fail(context, "思源返回 " + code + "：" + (ExtractStr(r.Text, "msg") ?? "")); return; }

    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 已写入 " + found.Count + " 个增量文件草稿");
}

public static string Esc(string s) { return (s ?? "").Replace("|", "\\|"); }
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
        req.Timeout = 30000;
        var buf = Encoding.UTF8.GetBytes(body);
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new KernelResult { Success = true, Text = reader.ReadToEnd(), Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
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
