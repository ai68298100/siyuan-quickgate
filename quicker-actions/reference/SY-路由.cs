//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·路由 —— 超级面板分发器总装（六分支 http/sql-url/url/bridge/cmd/act + 占位符 §5.1）
// 蓝图：docs/05 §5/§5.1/§5.2 · 参考实现，Quicker C# 模块「普通模式v2」，后台线程（MTA）
// @version 1.0.0 · 2026-10-03 首版（对照 g2-capture.cs 的单文件总装模式）
//
// 【输入变量】载荷t(文本) 载荷v(文本) 载荷then(文本，JSON，可空)
//             sy_url(文本) sy_token(文本) 桥插件(文本，默认 siyuan-quickgate)
//             选中文本(文本，可空) 来源窗口(文本，可空) 选中块ID(文本，可空) 日记笔记本ID(文本，可空) 收集箱文档ID(文本，可空)
//             今日日记ID(文本，可空——sql-url 分支优先用，缺省才跑 SQL 发现)
// 【输出变量】是否成功(布尔) 消息(文本) 结果数据(文本，回执 data JSON) 后续动作(文本，url/act 分支的执行指令)
// 【说明】http/bridge/cmd/sql-url 分支在本子程序内完成（HttpWebRequest 直连内核与桥文件）；
//         url/act 分支输出 后续动作="openurl:..." / "runaction:..."，由后续 Quicker 模块执行——
//         因为 openurl/runaction 是 Quicker 原生模块能力，C# 内直调会绕过其等待/失败分支。
// ============================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var t = (context.GetVarValue("载荷t") as string ?? "").Trim();
    var v = context.GetVarValue("载荷v") as string ?? "";
    try
    {
        v = ResolvePlaceholders(v, context); // §5.1 占位符字典（http/url 载荷统一解析）
    }
    catch (Exception ex)
    {
        Fail(context, "占位符解析失败：" + ex.Message);
        return;
    }

    switch (t)
    {
        case "url":
            context.SetVarValue("后续动作", "openurl:" + v);
            Ok(context, "打开链接指令已生成", "");
            break;

        case "act":
            context.SetVarValue("后续动作", "runaction:" + v);
            Ok(context, "转跳动作指令已生成", "");
            break;

        case "http":
            HttpBranch(context, v);
            break;

        case "sql-url":
            SqlUrlBranch(context, v);
            break;

        case "bridge":
        case "cmd": // cmd = bridge 特例：v 已是 {plugin,command} 完整 args（菜单模板负责组装）
            BridgeBranch(context, v);
            break;

        default:
            Fail(context, "未知载荷类型：" + t);
            break;
    }
}

// ---------------- http 分支：内核请求 → then/thenMenu 指令 ----------------
public static void HttpBranch(Quicker.Public.IStepContext context, string payloadV)
{
    // 载荷 v 约定：端点[|请求体JSON]（| 分隔，避免 JSON 内引号嵌套）
    var sep = payloadV.IndexOf('|');
    var endpoint = sep < 0 ? payloadV : payloadV.Substring(0, sep);
    var body = sep < 0 ? "" : payloadV.Substring(sep + 1);
    endpoint = endpoint.Replace("{选中文本}", context.GetVarValue("选中文本") as string ?? "")
                       .Replace("{选中块ID}", context.GetVarValue("选中块ID") as string ?? "");

    var result = KernelPost(context, endpoint, body);
    if (!result.Success) { Fail(context, result.Error); return; }
    Ok(context, "HTTP 完成（" + endpoint + "）", result.Text);
}

// ---------------- sql-url 分支：跑 SQL 取 root_id → openurl siyuan://blocks ----------------
public static void SqlUrlBranch(Quicker.Public.IStepContext context, string payloadV)
{
    var sql = payloadV.Length > 0 ? payloadV : "select root_id from blocks where id='{选中块ID}'";
    sql = sql.Replace("{选中块ID}", context.GetVarValue("选中块ID") as string ?? "");
    var result = KernelPost(context, "/api/query/sql", "{\"stmt\":" + JsonString(sql) + "}");
    if (!result.Success) { Fail(context, result.Error); return; }

    var rootId = ExtractJsonStringField(result.Text, "root_id");
    if (string.IsNullOrEmpty(rootId))
    {
        // 兜底：今日日记ID 变量直供（statestorage 已发现时免 SQL）
        var today = context.GetVarValue("今日日记ID") as string ?? "";
        if (today.Length > 0) rootId = today;
        else { Fail(context, "没有找到，先在思源里建一次日记"); return; }
    }
    context.SetVarValue("后续动作", "openurl:siyuan://blocks/" + rootId);
    Ok(context, "已定位文档 " + rootId, result.Text);
}

// ---------------- bridge/cmd 分支：LV·发命令+取回执 单文件内联 ----------------
public static void BridgeBranch(Quicker.Public.IStepContext context, string argsJson)
{
    var syUrl = (context.GetVarValue("sy_url") as string ?? "").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    var plugin = context.GetVarValue("桥插件") as string;
    if (string.IsNullOrWhiteSpace(plugin)) plugin = "siyuan-quickgate";

    var id = "qk-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 4);
    // op 由菜单模板经 载荷op 变量写入；cmd 分支缺省= commands.run（bridge 特例）
    var op = context.GetVarValue("载荷op") as string;
    if (string.IsNullOrWhiteSpace(op)) op = "commands.run";
    var envelope = "{\"v\":1,\"id\":\"" + id + "\",\"op\":\"" + op + "\",\"args\":" + argsJson +
                   ",\"createdAt\":\"" + DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") + "\"}";

    // 发命令（整文件覆盖写，外部单写者约定）
    var cmdPath = "/storage/petal/" + plugin + "/bridge/commands.ndjson";
    var old = GetFileText(syUrl, token, cmdPath);
    var merged = (old == null ? "" : old.TrimEnd('\r', '\n')) + "\n" + envelope + "\n";
    var put = PutFileText(syUrl, token, cmdPath, merged);
    if (!put) { Fail(context, "命令写入失败（桥目录不可达）"); return; }

    // 取回执：普通数据 8s / 快门命令 1.2s / commands.run 35s（确认弹窗），轮询 300ms
    var isRun = op == "commands.run";
    var budgetMs = isRun ? 35000 : (op.StartsWith("checkin") || op.StartsWith("contacts") ? 8000 : 1200);
    var deadline = Environment.TickCount + budgetMs;
    while (Environment.TickCount < deadline)
    {
        System.Threading.Thread.Sleep(300);
        var results = GetFileText(syUrl, token, "/storage/petal/" + plugin + "/bridge/results.ndjson");
        if (results == null) continue;
        foreach (var line in results.Replace("\r\n", "\n").Split('\n'))
        {
            if (!line.Contains("\"id\":\"" + id + "\"")) continue;
            var status = ExtractJsonStringField(line, "status");
            if (status == "recorded" || status == "duplicate")
            {
                Ok(context, ExtractJsonStringField(line, "message") ?? "完成", line);
                return;
            }
            if (status == "pending") continue; // 确认中：继续等（05 §5 不换新 id 重试）
            Fail(context, "命令 " + status + "：" + (ExtractJsonStringField(line, "message") ?? ""));
            return;
        }
    }
    // 超时：pending 语义回执——迟到回执仍按原 id 落 results，不自动重发
    context.SetVarValue("是否成功", false);
    context.SetVarValue("消息", isRun ? "等待确认超时（思源端可能弹出确认框）；回执稍后按原 id 可查" : "回执超时（" + budgetMs + "ms），不重试——迟到回执按原 id 可查");
    context.SetVarValue("结果数据", "");
    context.SetVarValue("后续动作", "");
}

// ---------------- §5.1 占位符字典 ----------------
public static string ResolvePlaceholders(string text, Quicker.Public.IStepContext context)
{
    var now = DateTime.Now;
    return text
        .Replace("{日记笔记本ID}", context.GetVarValue("日记笔记本ID") as string ?? "")
        .Replace("{收集箱文档ID}", context.GetVarValue("收集箱文档ID") as string ?? "")
        .Replace("{日期时间}", now.ToString("yyyy-MM-dd HH:mm"))
        .Replace("{今天}", now.ToString("yyyy-MM-dd"))
        .Replace("{时间}", now.ToString("HH:mm"))
        .Replace("{选中文本}", context.GetVarValue("选中文本") as string ?? "")
        .Replace("{来源窗口}", context.GetVarValue("来源窗口") as string ?? "")
        .Replace("{选中块ID}", context.GetVarValue("选中块ID") as string ?? "")
        .Replace("{clipboard}", context.GetVarValue("剪贴板文本") as string ?? "");
    // {ask:提示语} 与 {选中标签}/{选中书签块ID} 属交互占位：由前置 userinput/userselect 模块
    // 求值后以同名变量注入（ask值/选中标签），不在分发器内弹窗（保持分发器无 UI 依赖）
}

// ---------------- 内核与文件原语 ----------------
public static KernelResult KernelPost(Quicker.Public.IStepContext context, string endpoint, string body)
{
    var syUrl = (context.GetVarValue("sy_url") as string ?? "").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + endpoint);
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = 10000;
        if (body.Length > 0)
        {
            var buf = Encoding.UTF8.GetBytes(body);
            using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        }
        else req.ContentLength = 0;
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new KernelResult { Success = true, Text = reader.ReadToEnd(), Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null && ((int)resp.StatusCode == 401 || (int)resp.StatusCode == 403))
            return new KernelResult { Success = false, Text = "", Error = "令牌无效：请更新动作配置 sy_token（思源 设置→关于→复制 API 令牌）" };
        if (resp != null)
            return new KernelResult { Success = false, Text = "", Error = "内核返回 " + (int)resp.StatusCode };
        return new KernelResult { Success = false, Text = "", Error = "思源未运行或网络错误（可用 SY·思源未运行分支恢复）" };
    }
    catch (Exception ex)
    {
        return new KernelResult { Success = false, Text = "", Error = "请求异常：" + ex.Message };
    }
}

public static string GetFileText(string syUrl, string token, string path)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/file/getFile");
        req.Method = "POST"; req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = 5000;
        var buf = Encoding.UTF8.GetBytes("{\"path\":" + JsonString(path) + "}");
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
        {
            var text = reader.ReadToEnd();
            // 3.8.6：缺失文件返回 202 + {"code":404,...} 错误信封（bug#12 实证）——按缺失处理
            if (text.StartsWith("{\"code\":")) return null;
            return text;
        }
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null && (int)resp.StatusCode == 404) return null;
        return null;
    }
    catch { return null; }
}

public static bool PutFileText(string syUrl, string token, string path, string text)
{
    try
    {
        var boundary = "----quicker" + Guid.NewGuid().ToString("N");
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/file/putFile");
        req.Method = "POST";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.ContentType = "multipart/form-data; boundary=" + boundary;
        req.Timeout = 8000;
        using (var s = req.GetRequestStream())
        {
            var pathPart = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"path\"\r\n\r\n" + path + "\r\n");
            s.Write(pathPart, 0, pathPart.Length);
            var isDir = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"isDir\"\r\n\r\nfalse\r\n");
            s.Write(isDir, 0, isDir.Length);
            var fileHead = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"file\"\r\nContent-Type: application/octet-stream\r\n\r\n");
            s.Write(fileHead, 0, fileHead.Length);
            var fileBody = Encoding.UTF8.GetBytes(text);
            s.Write(fileBody, 0, fileBody.Length);
            var tail = Encoding.UTF8.GetBytes("\r\n--" + boundary + "--\r\n");
            s.Write(tail, 0, tail.Length);
        }
        using (var resp = (HttpWebResponse)req.GetResponse()) return (int)resp.StatusCode < 500;
    }
    catch { return false; }
}

public static string JsonString(string s)
{
    var sb = new StringBuilder(s.Length + 8);
    sb.Append('"');
    foreach (var ch in s)
    {
        if (ch == '\\' || ch == '"') { sb.Append('\\'); sb.Append(ch); }
        else if (ch < 32) sb.Append("\\u" + ((int)ch).ToString("x4"));
        else sb.Append(ch);
    }
    sb.Append('"');
    return sb.ToString();
}

public static string ExtractJsonStringField(string json, string field)
{
    if (json == null) return null;
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return null;
    i += key.Length;
    while (i < json.Length && json[i] == ' ') i++;
    if (i >= json.Length || json[i] != '"') return null;
    i++;
    var sb = new StringBuilder();
    while (i < json.Length && json[i] != '"')
    {
        if (json[i] == '\\' && i + 1 < json.Length) { i++; sb.Append(json[i] == 'n' ? '\n' : json[i]); }
        else sb.Append(json[i]);
        i++;
    }
    return sb.ToString();
}

public static void Ok(Quicker.Public.IStepContext context, string msg, string data)
{
    context.SetVarValue("是否成功", true);
    context.SetVarValue("消息", msg);
    context.SetVarValue("结果数据", data ?? "");
}

public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("消息", msg);
    context.SetVarValue("结果数据", "");
}

public struct KernelResult { public bool Success; public string Text; public string Error; }
