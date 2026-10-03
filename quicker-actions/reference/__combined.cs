using System;
using System.IO;
using System.Net;
using System.Text;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

// ==== g2-capture.cs ====
public class __Snippet0 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·划词摘录 → 收集箱（G2 样板单文件版）—— Quicker C# 模块「普通模式v2」
// 蓝图：docs/25 首个纵向样板 · docs/03 P0-2 四级兜底
// @version 1.1.0 · 2026-10-03 修复：ParseJson 未定义（编译检查发现的真实缺陷）、
//                     ShowNotify 空壳静默（通知改回变量输出，由后续 notify 模块展示）、
//                     语法降级 C#5（csc v4 可编译验证）
//           1.0.0 首版
//
// 【模块设置】后台线程（MTA）。
// 【用户输入】SY_URL(文本，默认 http://127.0.0.1:6806) SY_TOKEN(文本) 收集箱ID(文本，可空=用日记笔记本兜底)
// 【输入变量】{选中文本}(文本，划词内容) {来源窗口}(文本，可空)
// 【输出变量】结果消息(文本) 是否成功(布尔) 块ID(文本)
// 【依赖】仅 .NET 标准库（HttpWebRequest/Encoding），零第三方；C# 5 语法。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var inboxId = context.GetVarValue("收集箱ID") as string ?? "";
    var selectedText = (context.GetVarValue("选中文本") as string ?? "").Trim();
    var sourceWindow = context.GetVarValue("来源窗口") as string ?? "";

    if (selectedText.Length == 0)
    {
        context.SetVarValue("结果消息", "❌ 先选中要摘录的文本");
        context.SetVarValue("是否成功", false);
        return;
    }
    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        context.SetVarValue("是否成功", false);
        return;
    }

    // 收集箱兜底链：手填 ID → config.discover 自动发现（docs/03 P0-2 四级兜底前两级）
    if (string.IsNullOrWhiteSpace(inboxId))
    {
        var r = KernelPost(syUrl, token, "/plugin/private/siyuan-quickgate/exec",
            "{\"op\":\"config.discover\",\"args\":{}}");
        if (r.Success)
        {
            inboxId = ExtractStr(r.Text, "inboxDocId") ?? "";
            if (inboxId.Length > 0)
                context.SetVarValue("收集箱ID", inboxId); // 回写，下次免发现
        }
    }
    if (string.IsNullOrWhiteSpace(inboxId))
    {
        context.SetVarValue("结果消息", "❌ 未配置收集箱ID，且自动发现未命中（动作设置里手填或先在思源建收集箱文档）");
        context.SetVarValue("是否成功", false);
        return;
    }

    // 摘录格式：> 引用块 + 来源行（来源窗口有值时）
    var now = DateTime.Now.ToString("HH:mm");
    var excerpt = "> " + selectedText.Replace("\r\n", "\n").Replace("\n", "\n> ");
    var md = excerpt + "\n\n" + now + " 摘录"
             + (sourceWindow.Length > 0 ? "自「" + sourceWindow + "」" : "");

    // 收集箱场景用 appendBlock 语义的 insertBlock（父块=收集箱文档；createDocWithMd 是建新文档，不适用）
    var payload = "{\"parentID\":" + JStr(inboxId) + ",\"dataType\":\"markdown\",\"data\":" + JStr(md) + "}";

    var result = KernelPost(syUrl, token, "/api/block/insertBlock", payload);
    if (!result.Success)
    {
        context.SetVarValue("结果消息", "❌ " + result.Error);
        context.SetVarValue("是否成功", false);
        return;
    }

    // 内核信封 {code:0,data:"块ID"}；code!=0 = 业务失败（非 HTTP 层）
    var code = ExtractNum(result.Text, "code");
    if (code != 0)
    {
        context.SetVarValue("结果消息", "❌ 思源返回 " + code + "：" + (ExtractStr(result.Text, "msg") ?? ""));
        context.SetVarValue("是否成功", false);
        return;
    }
    var blockId = ExtractStr(result.Text, "data") ?? "";
    context.SetVarValue("块ID", blockId);
    context.SetVarValue("结果消息", "✓ 已入收集箱：" + (selectedText.Length > 30 ? selectedText.Substring(0, 30) + "…" : selectedText));
    context.SetVarValue("是否成功", true);
    // 反馈由后续 notify 模块展示 结果消息（不在脚本内弹窗，便于统一 UI，docs/03 §0）
}

// ---------------- 内核与 JSON 原语（C#5，零依赖） ----------------

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
        if (resp != null)
        {
            var text = "";
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) text = reader.ReadToEnd();
            return new KernelResult { Success = false, Text = text, Error = "HTTP " + (int)resp.StatusCode };
        }
        return new KernelResult { Success = false, Text = "", Error = "思源未运行或网络错误（可用 SY·思源未运行分支恢复）" };
    }
    catch (Exception ex)
    {
        return new KernelResult { Success = false, Text = "", Error = "请求异常：" + ex.Message };
    }
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

// 轻量 JSON 字符串字段提取（内核信封 {code,msg,data} 平铺场景；不替代完整解析）
public static string ExtractStr(string json, string field)
{
    if (json == null) return null;
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return null;
    i += key.Length;
    while (i < json.Length && json[i] == ' ') i++;
    if (i >= json.Length) return null;
    if (json[i] != '"') // 非字符串值：取到逗号/右括号
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
    var s = ExtractStr(json, field);
    var n = 0;
    int.TryParse(s ?? "", out n);
    return n;
}

public struct KernelResult { public bool Success; public string Text; public string Error; }

}

// ==== LV-发命令.cs ====
public class __Snippet1 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·发命令 —— 向快门桥 commands.ndjson 追加一行信封（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/02 §2/§6 · 协议 v1.1
// @version 1.0.1 · 2026-10-03 404 分支降 C#5（is-pattern→as+null 检查），csc v4 编译验证通过；首版 1.0.0
//
// 【模块设置】后台线程（MTA）。
// 【输入变量】桥插件(文本，默认 siyuan-quickgate) 命令op(文本) 命令参数(文本，JSON 对象字面量，如 {"keyword":"x"})
//             可选ttl(数字，ms，0=不带) 目标设备(文本，可空)
// 【输出变量】命令id(文本) 发送成功(布尔) 发送错误(文本)
// 【说明】args 以 JSON 文本直接内嵌（不反序列化再序列化，避免浮点/中文转义误差）；
//         putFile 为 Multipart 表单（path 文本字段 + file 字段）。不依赖 Newtonsoft。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("sy_url") as string ?? "").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    var plugin = context.GetVarValue("桥插件") as string; if (string.IsNullOrWhiteSpace(plugin)) plugin = "siyuan-quickgate";
    var op = context.GetVarValue("命令op") as string ?? "";
    var argsJson = context.GetVarValue("命令参数") as string; if (string.IsNullOrWhiteSpace(argsJson)) argsJson = "{}";
    var ttl = 0; int.TryParse(context.GetVarValue("可选ttl") as string, out ttl);
    var device = context.GetVarValue("目标设备") as string ?? "";

    // id：qk-{yyyyMMdd-HHmmss}-{4位随机}；同毫秒并发概率极低，真冲突由台账去重兜底（D-0003）
    var id = "qk-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 4);
    var createdAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");   // ISO8601 UTC

    // 信封组装：argsJson 是调用方给的对象字面量，直接内嵌（协议要求 args 为对象）
    var envelope = "{\"v\":1,\"id\":\"" + id + "\",\"op\":\"" + op + "\",\"args\":" + argsJson +
                   ",\"createdAt\":\"" + createdAt + "\"" +
                   (ttl > 0 ? ",\"ttlMs\":" + ttl : "") +
                   (device.Length > 0 ? ",\"device\":\"" + device + "\"" : "") + "}";

    try
    {
        var path = "/storage/petal/" + plugin + "/bridge/commands.ndjson";
        var old = GetFileText(syUrl, token, path);           // 404 = 无命令，视为空
        var merged = (old == null ? "" : old.TrimEnd('\r', '\n')) + "\n" + envelope + "\n";

        // 追加 = 整文件覆盖写（协议 §1.2：消费者有 id 台账，外部单写者约定下不丢行）
        var boundary = "----quicker" + Guid.NewGuid().ToString("N");
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/file/putFile");
        req.Method = "POST";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.ContentType = "multipart/form-data; boundary=" + boundary;
        using (var s = req.GetRequestStream())
        {
            WritePart(s, boundary, "path", path);
            WriteFilePart(s, boundary, "file", "commands.ndjson", merged);
            WriteTail(s, boundary);
        }
        using (var resp = (HttpWebResponse)req.GetResponse()) { /* code=0 即成功 */ }

        context.SetVarValue("命令id", id);
        context.SetVarValue("发送成功", true);
        context.SetVarValue("发送错误", "");
    }
    catch (Exception ex)
    {
        context.SetVarValue("命令id", id);
        context.SetVarValue("发送成功", false);
        context.SetVarValue("发送错误", "思源未运行或网络错误：" + ex.Message);
    }
}

private static string GetFileText(string syUrl, string token, string path)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/file/getFile");
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        var buf = Encoding.UTF8.GetBytes("{\"path\":\"" + path + "\"}");
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return reader.ReadToEnd();
    }
    catch (WebException we)
    {
        var r404 = we.Response as HttpWebResponse;
        if (r404 != null && (int)r404.StatusCode == 404) return null;
        throw;   // 非 404（内核没开等）让上层走统一错误分支
    }
}

private static void WritePart(Stream s, string boundary, string name, string value)
{
    var head = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
    s.Write(head, 0, head.Length);
    var data = Encoding.UTF8.GetBytes(value);
    s.Write(data, 0, data.Length);
    s.Write(new byte[] { 13, 10 }, 0, 2);
}

private static void WriteFilePart(Stream s, string boundary, string name, string fileName, string content)
{
    var head = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"; filename=\"" + fileName + "\"\r\nContent-Type: application/octet-stream\r\n\r\n");
    s.Write(head, 0, head.Length);
    var data = Encoding.UTF8.GetBytes(content);
    s.Write(data, 0, data.Length);
    s.Write(new byte[] { 13, 10 }, 0, 2);
}

private static void WriteTail(Stream s, string boundary)
{
    var tail = Encoding.UTF8.GetBytes("--" + boundary + "--\r\n");
    s.Write(tail, 0, tail.Length);
}

}

// ==== LV-取回执.cs ====
public class __Snippet2 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·取回执 —— 按 id 轮询 results.ndjson 匹配回执（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/02 §3/§6 · 等待策略：按 op 区分（阻断项 D-0005）
// @version 1.0.0 · 2026-10-03 首版（编译验证通过；pending 语义不换 id 重试）
//
// 【模块设置】后台线程（MTA）。
// 【输入变量】桥插件(文本) 命令id(文本) 等待毫秒(数字；普通数据 op 8000 / commands.run 35000)
// 【输出变量】回执状态(文本：recorded|rejected|failed|unsupported|expired|timeout)
//             回执消息(文本) 回挂数据(文本，JSON) 回执原始行(文本)
// 【铁律】超时不得换新 id 重试（幂等键=id）；迟到回执仍会按原 id 落盘，动作可二次查询。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("sy_url") as string ?? "").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    var plugin = context.GetVarValue("桥插件") as string; if (string.IsNullOrWhiteSpace(plugin)) plugin = "siyuan-quickgate";
    var id = context.GetVarValue("命令id") as string ?? "";
    var maxMs = 8000; int.TryParse(context.GetVarValue("等待毫秒") as string, out maxMs);
    if (maxMs <= 0) maxMs = 8000;

    var path = "/storage/petal/" + plugin + "/bridge/results.ndjson";
    var deadline = Environment.TickCount + maxMs;
    var done = false;

    while (!done && Environment.TickCount < deadline)
    {
        var text = TryGetFile(syUrl, token, path);        // 404/异常都当"还没有回执"继续等
        if (text != null)
        {
            foreach (var line in text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
            {
                var t = line.Trim();
                if (t.Length == 0) continue;
                var obj = TryParse(t);                    // 逐行解析，坏行跳过（不得 Contains 匹配）
                if (obj == null) continue;
                if (GetField(obj, "id") == id)
                {
                    context.SetVarValue("回执状态", GetField(obj, "status"));
                    context.SetVarValue("回执消息", GetField(obj, "message"));
                    context.SetVarValue("回执原始行", t);
                    context.SetVarValue("回挂数据", GetDataRaw(t));
                    done = true;
                    break;
                }
            }
        }
        if (!done) System.Threading.Thread.Sleep(300);
    }

    if (!done)
    {
        // 超时：不判定失败（可能是确认窗/迟到完成），文案按"已提交待确认"口径（docs/03 反馈规范）
        context.SetVarValue("回执状态", "timeout");
        context.SetVarValue("回执消息", "已提交，尚未收到思源回执（可能在等待确认，稍后可用原 id 再查）");
        context.SetVarValue("回执原始行", "");
        context.SetVarValue("回挂数据", "");
    }
}

private static string TryGetFile(string syUrl, string token, string path)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/file/getFile");
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = 5000;
        var buf = Encoding.UTF8.GetBytes("{\"path\":\"" + path + "\"}");
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return reader.ReadToEnd();
    }
    catch { return null; }
}

// 轻量 JSON 字符串字段提取：满足回执的扁平形状（id/status/message 均为顶层字符串），逐行解析容错
private static string TryParse(string line) { return line.StartsWith("{") && line.EndsWith("}") ? line : null; }

private static string GetField(string json, string field)
{
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return "";
    i += key.Length;
    while (i < json.Length && json[i] == ' ') i++;
    if (i >= json.Length) return "";
    if (json[i] == '"')
    {
        var sb = new StringBuilder();
        i++;
        while (i < json.Length && json[i] != '"')
        {
            if (json[i] == '\\' && i + 1 < json.Length)
            {
                i++;
                var c = json[i];
                if (c == 'n') sb.Append('\n');
                else if (c == 't') sb.Append('\t');
                else if (c == 'u' && i + 4 < json.Length)
                {
                    sb.Append((char)Convert.ToInt32(json.Substring(i + 1, 4), 16));
                    i += 4;
                }
                else sb.Append(c);
            }
            else sb.Append(json[i]);
            i++;
        }
        return sb.ToString();
    }
    var j = json.IndexOf(',', i); if (j < 0) j = json.IndexOf('}', i);
    return j < 0 ? "" : json.Substring(i, j - i).Trim();
}

// data 字段原样截取（可能嵌套对象/数组，不做二次解析；调用方需要时用 jsonextract 模块处理）
private static string GetDataRaw(string json)
{
    var key = "\"data\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return "";
    i += key.Length;
    if (i >= json.Length) return "";
    if (json[i] == '{' || json[i] == '[')
    {
        var open = json[i]; var close = open == '{' ? '}' : ']';
        var depth = 0; var inStr = false;
        for (var k = i; k < json.Length; k++)
        {
            var ch = json[k];
            if (inStr) { if (ch == '\\') k++; else if (ch == '"') inStr = false; continue; }
            if (ch == '"') inStr = true;
            else if (ch == open || (open == '{' && ch == '[')) depth++;
            else if (ch == close || (open == '{' && ch == '}')) { depth--; if (depth == 0) return json.Substring(i, k - i + 1); }
        }
        return "";
    }
    var j = json.IndexOf(',', i); if (j < 0) j = json.IndexOf('}', i);
    return j < 0 ? "" : json.Substring(i, j - i).Trim();
}

}

// ==== LV-摘要格式化.cs ====
public class __Snippet3 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·摘要格式化 —— 打卡概览（checkin.summary 回执 data → 一行中文通知）
// 参考实现，Quicker C# 模块「普通模式v2」；对应 docs/05 §5.2 then.t=notify-summary
// @version 1.0.1 · 2026-10-03 out var 降 C#5，csc v4 编译验证通过；首版 1.0.0
// data 形状（v0.5.6 契约）：{today:{range,startDate,endDate,items[],totalEvents,completedItems,scheduledItems},
//                          streaks:{itemId:连击天数}}
//
// 【模块设置】普通线程即可。
// 【输入变量】回挂数据(文本，checkin.summary 回执的 data JSON)
// 【输出变量】摘要文本(文本) —— 空数据时给出可读的占位文案，绝不显示原始 JSON
// 【说明】轻量字段提取（同 LV-取回执 的策略）：顶层 today/streaks 内的数字字段按名直取；
//         形状不符（上游未来改字段）时降级为计数占位，保证通知永远可读。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var data = context.GetVarValue("回挂数据") as string ?? "";
    var sb = new StringBuilder("打卡概览：");

    var done = GetIntField(data, "completedItems", -1);
    var scheduled = GetIntField(data, "scheduledItems", -1);
    var total = GetIntField(data, "totalEvents", -1);

    if (done >= 0 && scheduled >= 0)
    {
        sb.Append("今日 ").Append(done).Append("/").Append(scheduled);
        if (total >= 0) sb.Append("（记录 ").Append(total).Append(" 条）");
    }
    else if (total >= 0)
    {
        sb.Append("今日记录 ").Append(total).Append(" 条");
    }
    else
    {
        sb.Append("今日暂无数据（事项可能未安排或打卡数据未就绪）");
        context.SetVarValue("摘要文本", sb.ToString());
        return;
    }

    // 连击：取 streaks 里最大的前 1 个（v1 不做全列；需要全列时在面板里接列表模块）
    var streakId = ""; var streakMax = 0;
    var i = data.IndexOf("\"streaks\"", StringComparison.Ordinal);
    if (i >= 0)
    {
        var close = data.IndexOf('}', i);
        if (close > i)
        {
            var seg = data.Substring(i, close - i);
            var k = 0;
            while ((k = seg.IndexOf("\":", k + 1, StringComparison.Ordinal)) >= 0)
            {
                var startName = seg.LastIndexOf('"', k - 1);
                if (startName < 0) continue;
                var nameStart = seg.LastIndexOf('"', startName - 1);
                if (nameStart < 0) continue;
                var name = seg.Substring(nameStart + 1, startName - nameStart - 1);
                var v = GetIntField(seg, name, -1);
                if (v > streakMax) { streakMax = v; streakId = name; }
            }
        }
    }
    if (streakMax > 0) sb.Append(" · 最高连击 ").Append(streakMax).Append(" 天");

    context.SetVarValue("摘要文本", sb.ToString());
}

private static int GetIntField(string json, string field, int fallback)
{
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return fallback;
    i += key.Length;
    while (i < json.Length && (json[i] == ' ')) i++;
    var j = i;
    while (j < json.Length && (char.IsDigit(json[j]) || json[j] == '-')) j++;
    var v = 0;
    return j > i && int.TryParse(json.Substring(i, j - i), out v) ? v : fallback;
}

}

// ==== p0-1-快速捕获.cs ====
public class __Snippet4 {
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

}

// ==== p0-3-全局快查.cs ====
public class __Snippet5 {
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

}

// ==== p0-4-打开今日日记.cs ====
public class __Snippet6 {
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

}

// ==== p0-5-剪贴板图片入库.cs ====
public class __Snippet7 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// P0-5 剪贴板图片入库（单文件版）—— Quicker C# 模块「普通模式v2」，后台线程（MTA）
// 蓝图：docs/03 P0-5（OCR 写 alt，图片可被全文检索）
// @version 1.0.0 · 2026-10-03 首版（csc C#5 编译验证通过）
//
// 【输入变量】图片(System.Drawing.Image，来自 getclipboardimage 模块的图片变量)
//             OCR文本(文本，可空——Quicker OCR 模块输出，已过 SY·OCR清理 更佳)
//             SY_URL(文本) SY_TOKEN(文本) 资源目录(文本，默认 assets)
// 【输出变量】是否成功(布尔) 结果消息(文本) 资源路径(文本)
// 【流程】①图片→PNG 字节 ②multipart /api/asset/upload（file+assetDir）③succSet[0].path
//         ④appendDailyNoteBlock：![OCR alt](path "剪贴板 HH:mm")
// 【说明】OCR 空时 alt 用「剪贴板图片」占位（仍可按时间检索）。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("SY_TOKEN") as string ?? "";
    var assetDir = context.GetVarValue("资源目录") as string ?? "assets";
    var ocr = (context.GetVarValue("OCR文本") as string ?? "").Trim();
    var img = context.GetVarValue("图片") as Image;

    if (img == null)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 剪贴板没有图片（先复制一张图）");
        return;
    }
    if (string.IsNullOrWhiteSpace(token))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 未配置 SY_TOKEN（思源 设置→关于→复制 API 令牌）");
        return;
    }

    // ①图片 → PNG 字节
    byte[] png;
    using (var ms = new MemoryStream())
    {
        img.Save(ms, ImageFormat.Png);
        png = ms.ToArray();
    }

    // ②multipart 上传（file + assetDir 两字段，思源要求 multipart/form-data）
    var uploadResult = UploadAsset(syUrl, token, assetDir, png);
    if (!uploadResult.Success)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 上传失败：" + uploadResult.Error);
        return;
    }
    var path = ExtractStr(uploadResult.Text, "succSet") != null ? ExtractStr(uploadResult.Text, "path") : null;
    if (string.IsNullOrEmpty(path))
    {
        // succSet 是数组：取 "[{" 之后的 path 字段（轻量解析足够：上传响应形状固定）
        var idx = uploadResult.Text.IndexOf("\"succSet\"");
        path = idx >= 0 ? ExtractStr(uploadResult.Text.Substring(idx), "path") : null;
    }
    if (string.IsNullOrEmpty(path))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 上传响应无 succSet[0].path：" + Truncate(uploadResult.Text, 120));
        return;
    }
    context.SetVarValue("资源路径", path);

    // ④写入今日日记（OCR alt 可检索）
    var alt = ocr.Length > 0 ? ocr.Replace("\"", "'").Replace("\n", " ") : "剪贴板图片";
    var md = "![" + alt + "](" + path + " \"剪贴板 " + DateTime.Now.ToString("HH:mm") + "\")";
    var w = KernelPost(syUrl, token, "/api/block/appendDailyNoteBlock",
        "{\"notebook\":\"\",\"dataType\":\"markdown\",\"data\":" + JStr(md) + "}");
    if (!w.Success) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 图片已上传 " + path + "，但写入日记失败：" + w.Error); return; }
    var code = ExtractNum(w.Text, "code");
    if (code != 0) { context.SetVarValue("是否成功", false); context.SetVarValue("结果消息", "❌ 写日记返回 " + code + "：" + (ExtractStr(w.Text, "msg") ?? "")); return; }

    context.SetVarValue("是否成功", true);
    context.SetVarValue("结果消息", "✓ 图片已入库" + (ocr.Length > 0 ? "（OCR alt 可检索）" : ""));
}

public static UploadResult UploadAsset(string syUrl, string token, string assetDir, byte[] bytes)
{
    try
    {
        var boundary = "----quicker" + Guid.NewGuid().ToString("N");
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/asset/upload");
        req.Method = "POST";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.ContentType = "multipart/form-data; boundary=" + boundary;
        req.Timeout = 30000; // 图片可能大
        using (var s = req.GetRequestStream())
        {
            var dirPart = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"assetDir\"\r\n\r\n" + assetDir + "\r\n");
            s.Write(dirPart, 0, dirPart.Length);
            var head = Encoding.UTF8.GetBytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file[]\"; filename=\"clipboard.png\"\r\nContent-Type: image/png\r\n\r\n");
            s.Write(head, 0, head.Length);
            s.Write(bytes, 0, bytes.Length);
            var tail = Encoding.UTF8.GetBytes("\r\n--" + boundary + "--\r\n");
            s.Write(tail, 0, tail.Length);
        }
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new UploadResult { Success = true, Text = reader.ReadToEnd(), Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null) return new UploadResult { Success = false, Text = "", Error = "HTTP " + (int)resp.StatusCode };
        return new UploadResult { Success = false, Text = "", Error = "网络错误：" + we.Message };
    }
    catch (Exception ex) { return new UploadResult { Success = false, Text = "", Error = ex.Message }; }
}

public static string Truncate(string s, int n) { return s != null && s.Length > n ? s.Substring(0, n) + "…" : s ?? ""; }

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
public struct UploadResult { public bool Success; public string Text; public string Error; }

}

// ==== sy-12-汇总日记待办.cs ====
public class __Snippet8 {
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

}

// ==== sy-13-数据体检.cs ====
public class __Snippet9 {
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

}

// ==== SY-OCR清理.cs ====
public class __Snippet10 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·OCR清理 —— OCR 结果后处理：去除汉字之间被误插的空格/换行（参考实现，Quicker C# 模块「普通模式v2」）
// 场景：P0-5 剪贴板图片入库 OCR alt、划词 OCR 摘录（docs/03 P0-5）
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】普通/后台线程均可；纯文本处理零网络依赖。
// 【输入变量】输入文本(文本，OCR 原始输出) 保留段落(文本，"true"=换行视作段落边界保留，默认 true)
// 【输出变量】清理结果(文本) 是否成功(布尔)
// 【规则】两个 CJK 字符之间的空格/软换行删除；CJK 与西文/数字之间的空格保留一个；
//         保留段落=true 时「整行换行」保留为\n，行尾软换行（行非空且下一行非空且行尾无标点）视作 OCR 断行删除。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var input = context.GetVarValue("输入文本") as string ?? "";
    var keepParaRaw = (context.GetVarValue("保留段落") as string ?? "true").Trim();
    var keepPara = keepParaRaw != "false" && keepParaRaw != "0";

    context.SetVarValue("清理结果", CleanOcr(input, keepPara));
    context.SetVarValue("是否成功", true);
}

public static string CleanOcr(string text, bool keepPara)
{
    if (string.IsNullOrEmpty(text)) return "";
    var lines = text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
    var sb = new StringBuilder();
    for (var i = 0; i < lines.Length; i++)
    {
        var line = lines[i];
        var sbLine = new StringBuilder(line.Length);
        for (var j = 0; j < line.Length; j++)
        {
            var ch = line[j];
            if ((ch == ' ' || ch == '\u00a0' || ch == '\u3000') && j > 0 && j < line.Length - 1
                && IsCjk(line[j - 1]) && IsCjk(line[j + 1]))
                continue; // 汉字间空格：删
            sbLine.Append(ch);
        }
        var cleaned = sbLine.ToString().Trim();
        if (cleaned.Length == 0) { sb.AppendLine(); continue; }

        sb.Append(cleaned);
        var hasNext = i < lines.Length - 1 && lines[i + 1].Trim().Length > 0;
        if (hasNext)
        {
            var endsSentence = cleaned.Length > 0 && "。！？；：.!?;:".IndexOf(cleaned[cleaned.Length - 1]) >= 0;
            if (keepPara && endsSentence) sb.AppendLine();      // 句号断行=段落
            else sb.Append(IsCjk(cleaned[cleaned.Length - 1]) && IsCjk(lines[i + 1].Trim()[0]) ? "" : " "); // 断行缝合
        }
        else sb.AppendLine();
    }
    return sb.ToString().TrimEnd();
}

public static bool IsCjk(char c)
{
    return (c >= 0x4E00 && c <= 0x9FFF)   // CJK 基本区
        || (c >= 0x3400 && c <= 0x4DBF)   // 扩展 A
        || (c >= 0xF900 && c <= 0xFAFF);  // 兼容表意
}

}

// ==== SY-内核请求.cs ====
public class __Snippet11 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·内核请求 —— 所有思源内核调用的唯一入口（参考实现，Quicker C# 模块「普通模式v2」）
// 蓝图：docs/03 §0 · 规范：docs/02 §6 · 错误分支：docs/04 §8
// @version 1.1.0 · 2026-10-03 401 自愈增强：失效时强制重读 %APPDATA%\siyuan\env 并重试一次（§2 令牌自愈项）
//                     1.0.0 首版：env 兜底 + 401/超时中文分支
//
// 【模块设置】执行线程=后台线程（MTA）；建议勾选「允许缓存程序集」；失败后停止=否（自行分支）。
// 【输入变量】sy_url(文本) sy_token(文本) 端点(文本，如 /api/system/version) 请求体(文本，JSON，可空)
// 【输出变量】状态码(数字) 文本结果(文本) 是否成功(布尔) 错误提示(文本)
// 【说明】本实现不依赖 Newtonsoft：请求体直接传文本；401 自愈路径=重读 env → 重试一次 → 仍失败
//         才引导手填（思源重置令牌场景免手动）；代码保持 C# 5 兼容（csc v4 可编译验证）。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var url = (context.GetVarValue("sy_url") as string ?? "").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    var endpoint = context.GetVarValue("端点") as string ?? "";
    var body = context.GetVarValue("请求体") as string ?? "";

    // 兜底：statestorage 没配时读本机 env（docs/03 §0）
    if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(url))
    {
        ReadEnv(ref url, ref token, false);
        context.SetVarValue("sy_token", token);
        context.SetVarValue("sy_url", url);
    }

    var r = DoRequest(url, token, endpoint, body);

    // 令牌自愈（v1.1）：401/403 → 强制重读 env（思源可能已重置令牌）→ 重试一次 → 仍失败才引导
    if ((r.Status == 401 || r.Status == 403) && ReadEnv(ref url, ref token, true))
    {
        context.SetVarValue("sy_token", token);
        context.SetVarValue("sy_url", url);
        r = DoRequest(url, token, endpoint, body);
    }

    context.SetVarValue("状态码", r.Status);
    context.SetVarValue("文本结果", r.Text);
    context.SetVarValue("是否成功", r.Success);
    if (r.Success) { context.SetVarValue("错误提示", ""); return; }
    context.SetVarValue("错误提示", r.Status == 401 || r.Status == 403
        ? "令牌无效（自愈重试后仍失败）：请到思源「设置→关于→复制 API 令牌」，粘贴到动作配置 sy_token。"
        : r.Error);
}

public static bool ReadEnv(ref string url, ref string token, bool forceToken)
{
    var envPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "siyuan", "env");
    if (!File.Exists(envPath)) return false;
    var hit = false;
    foreach (var line in File.ReadAllLines(envPath))
    {
        var i = line.IndexOf('=');
        if (i <= 0) continue;
        var k = line.Substring(0, i).Trim();
        var v = line.Substring(i + 1).Trim();
        if (k == "SIYUAN_TOKEN" && (forceToken || string.IsNullOrWhiteSpace(token))) { token = v; hit = true; }
        if (k == "SIYUAN_URL" && (forceToken || string.IsNullOrWhiteSpace(url))) { url = v.TrimEnd('/'); hit = true; }
    }
    return hit;
}

public static KernelResult DoRequest(string url, string token, string endpoint, string body)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(url + endpoint);
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = 10000;                          // 本地内核 <100ms；同步/导出类大操作可放宽 60s
        if (body.Trim().Length > 0)
        {
            var buf = Encoding.UTF8.GetBytes(body);
            using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        }
        else { req.ContentLength = 0; }

        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new KernelResult { Status = (int)resp.StatusCode, Text = reader.ReadToEnd(), Success = true, Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        var text = "";
        if (resp != null)
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) text = reader.ReadToEnd();
        if (resp != null)
            return new KernelResult { Status = (int)resp.StatusCode, Text = text, Success = false, Error = "内核返回 " + (int)resp.StatusCode };
        return new KernelResult { Status = 0, Text = "", Success = false, Error = "思源未运行或网络错误：" + we.Message };
    }
    catch (Exception ex)
    {
        return new KernelResult { Status = 0, Text = "", Success = false, Error = "请求异常：" + ex.Message };
    }
}

public struct KernelResult { public int Status; public string Text; public bool Success; public string Error; }

}

// ==== SY-占位符解析.cs ====
public class __Snippet12 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·占位符解析 —— 面板/动作载荷里的占位符统一替换（参考实现，Quicker C# 模块「普通模式v2」）
// 字典：docs/05 §5.1
// @version 1.0.0 · 2026-10-03 首版（编译验证通过；{ask:}交互占位由前置模块求值）
//
// 【模块设置】普通/后台线程均可（无网络调用）。
// 【输入变量】文本模板(文本，含 {占位符} 的载荷模板)
//             其余变量按存在即用：选中文本 来源窗口 clipboard 选中标签 选中块ID 选中书签块ID
//             日记笔记本ID 收集箱文档ID ask值
// 【输出变量】解析结果(文本)
// 【范围声明（诚实边界）】
//   - {ask:提示语} 不在此解析——它是交互（userinput 模块），应在进入本模块前完成并把结果存 ask值。
//   - 不存在的变量按空串替换（例如非划词场景 {选中文本}→""）；字典外的 {…} 原样保留。
//   - {sql:前缀} AI 分支、多目标路由（#会议/@人名）属动作级逻辑，见 docs/03 §0，不在此层。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var template = context.GetVarValue("文本模板") as string ?? "";
    var now = DateTime.Now;

    var sb = new StringBuilder(template);

    // 日期时间类（总是可解析）
    sb.Replace("{今天}", now.ToString("yyyy-MM-dd"))
      .Replace("{日期时间}", now.ToString("yyyy-MM-dd HH:mm"))
      .Replace("{时间}", now.ToString("HH:mm"));

    // 变量类：变量存在（非空）才替换；不存在则替换为空串（非划词场景语义）
    ReplaceVar(sb, context, "{选中文本}", "选中文本");
    ReplaceVar(sb, context, "{来源窗口}", "来源窗口");
    ReplaceVar(sb, context, "{clipboard}", "clipboard");
    ReplaceVar(sb, context, "{选中标签}", "选中标签");
    ReplaceVar(sb, context, "{选中块ID}", "选中块ID");
    ReplaceVar(sb, context, "{选中书签块ID}", "选中书签块ID");
    ReplaceVar(sb, context, "{ask值}", "ask值");
    ReplaceVar(sb, context, "{日记笔记本ID}", "日记笔记本ID");
    ReplaceVar(sb, context, "{收集箱文档ID}", "收集箱文档ID");

    context.SetVarValue("解析结果", sb.ToString());
}

private static void ReplaceVar(StringBuilder sb, Quicker.Public.IStepContext context, string placeholder, string varName)
{
    string value = null;
    try { value = context.GetVarValue(varName) as string; } catch { /* 变量未建：按空串 */ }
    sb.Replace(placeholder, value ?? "");
}

}

// ==== SY-反向触发.cs ====
public class __Snippet13 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·反向触发 —— Quicker 668 /api/exec 本机 HTTP API 封装（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/05 §7-F 实测项 · Quicker 官方「HTTP 与 WebSocket 服务」文档（docs.getquicker.net）
// @version 1.0.0 · 2026-10-03 首版
//
// 【前置】Quicker 设置 → 软件连接 → HTTP/WebSocket 服务：启用 HTTP API 并生成令牌
//         （默认端口 668，HTTPS 用 lan.quicker.cc 域名证书；本封装两种地址都支持）
// 【模块设置】后台线程（MTA）。
// 【输入变量】qk_api_url(文本，如 https://127-0-0-1.lan.quicker.cc:668 或 http://127.0.0.1:668)
//             qk_api_token(文本，设置页「生成令牌」) 目标动作(文本，动作 ID 或名称) 动作参数(文本，传给动作的输入，可空)
//             等待完成(文本，"true"/"false"，默认 false) 超时ms(数字，默认 3000，上限 60000)
// 【输出变量】是否成功(布尔) 响应文本(文本) 错误提示(文本)
// 【说明】operation=action，data=动作参数；wait=true 时同步等动作执行结果（上限 maxWaitMs）。
//         反向触发的用途：思源侧/其他动作反过来拉起本动作（外部面联动，docs/10 §3.9）。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var apiUrl = (context.GetVarValue("qk_api_url") as string ?? "").TrimEnd('/');
    var apiToken = context.GetVarValue("qk_api_token") as string ?? "";
    var actionName = context.GetVarValue("目标动作") as string ?? "";
    var actionData = context.GetVarValue("动作参数") as string ?? "";
    var waitRaw = (context.GetVarValue("等待完成") as string ?? "false").Trim();
    var wait = waitRaw == "true" || waitRaw == "1" || waitRaw == "是";
    var maxWait = 3000;
    int.TryParse(context.GetVarValue("超时ms") as string, out maxWait);
    if (maxWait <= 0) maxWait = 3000;
    if (maxWait > 60000) maxWait = 60000;

    if (string.IsNullOrWhiteSpace(apiUrl) || string.IsNullOrWhiteSpace(apiToken) || string.IsNullOrWhiteSpace(actionName))
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("响应文本", "");
        context.SetVarValue("错误提示", "缺少 qk_api_url / qk_api_token / 目标动作 配置（Quicker 设置→软件连接→HTTP 服务 生成令牌）");
        return;
    }

    try
    {
        // JSON 转义只处理 \\ 与 "（data 约定传纯文本/单行参数）
        var esc = actionData.Replace("\\", "\\\\").Replace("\"", "\\\"");
        var body = "{\"operation\":\"action\",\"action\":\"" + actionName.Replace("\"", "\\\"") +
                   "\",\"data\":\"" + esc + "\",\"wait\":" + (wait ? "true" : "false") +
                   ",\"maxWaitMs\":" + maxWait + ",\"dataType\":\"text\"}";
        var buf = Encoding.UTF8.GetBytes(body);

        ServicePointManager.ServerCertificateValidationCallback = (s, cert, chain, err) => true; // lan.quicker.cc 证书按 IP 通配，本机调用放宽校验
        var req = (HttpWebRequest)WebRequest.Create(apiUrl + "/api/exec");
        req.Method = "POST";
        req.ContentType = "application/json; charset=utf-8";
        req.Headers[HttpRequestHeader.Authorization] = "Bearer " + apiToken;
        req.Timeout = Math.Max(3000, maxWait + 2000);
        req.ContentLength = buf.Length;
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);

        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
        {
            context.SetVarValue("是否成功", true);
            context.SetVarValue("响应文本", reader.ReadToEnd());
            context.SetVarValue("错误提示", "");
        }
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        var text = "";
        if (resp != null)
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) text = reader.ReadToEnd();
        context.SetVarValue("是否成功", false);
        context.SetVarValue("响应文本", text);
        context.SetVarValue("错误提示", resp != null
            ? "Quicker HTTP API 返回 " + (int)resp.StatusCode + "（检查令牌与服务开关）"
            : "Quicker HTTP API 不可达：" + we.Message + "（确认设置→软件连接→HTTP 服务已开启）");
    }
    catch (Exception ex)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("响应文本", "");
        context.SetVarValue("错误提示", "反向触发异常：" + ex.Message);
    }
}

}

// ==== SY-思源未运行分支.cs ====
public class __Snippet14 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·思源未运行分支 —— 内核不可达时的标准分支（docs/05 §6.1 toggle 语义）
// 流程：探测 /api/system/version（300ms 超时）→ 询问是否启动 → run 思源 exe → 重探（≤15s）→ 输出恢复结果
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】普通线程（需要弹窗与前台启动）。
// 【输入变量】sy_url(文本) 思源exe路径(文本，默认 C:\Program Files\SiYuan\SiYuan.exe)
//             静默启动(文本，"true"=跳过询问直接启动，默认 false) 等待窗口秒数(数字，默认 15)
// 【输出变量】思源已运行(布尔，出口=后续主流程是否继续) 是否成功(布尔，本子程序自身执行无异常) 消息(文本)
// 【说明】退出码约定：思源已运行=true 直接走主流程；启动成功=true；用户拒绝/启动失败=false 主流程终止。
//         已运行但探测超时（内核忙）也返回 true——交由上层「通用错误流」重试（docs/04 §8 busy ≤3）。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    try
    {
        var syUrl = (context.GetVarValue("sy_url") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
        var exePath = context.GetVarValue("思源exe路径") as string;
        if (string.IsNullOrWhiteSpace(exePath)) exePath = "C:\\Program Files\\SiYuan\\SiYuan.exe";
        var silent = (context.GetVarValue("静默启动") as string ?? "false").Trim() == "true";
        var waitSec = 15;
        int.TryParse(context.GetVarValue("等待窗口秒数") as string, out waitSec);
        if (waitSec <= 0) waitSec = 15;

        // 1) 首探（300ms：面板主流程要求快速失败，docs/05 §4 步骤2）
        if (ProbeKernel(syUrl, 300))
        {
            context.SetVarValue("思源已运行", true);
            context.SetVarValue("是否成功", true);
            context.SetVarValue("消息", "内核可达");
            return;
        }

        // 2) 询问（静默模式跳过）
        if (!silent)
        {
            var answer = MessageBox.Show("思源没在运行。启动它吗？", "小驴 · 思源未运行",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1);
            if (answer != DialogResult.Yes)
            {
                context.SetVarValue("思源已运行", false);
                context.SetVarValue("是否成功", true);
                context.SetVarValue("消息", "用户选择不启动");
                return;
            }
        }

        // 3) 启动（exe 不存在时退回 siyuan:// 协议拉起——05 §7-B 实测项的预案）
        if (File.Exists(exePath))
            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
        else
            Process.Start(new ProcessStartInfo("siyuan://") { UseShellExecute = true });

        // 4) 重探（每 500ms × waitSec，先于盲等窗口出现）
        var deadline = Environment.TickCount + waitSec * 1000;
        while (Environment.TickCount < deadline)
        {
            Thread.Sleep(500);
            if (ProbeKernel(syUrl, 500))
            {
                context.SetVarValue("思源已运行", true);
                context.SetVarValue("是否成功", true);
                context.SetVarValue("消息", "思源已启动并就绪");
                return;
            }
        }

        context.SetVarValue("思源已运行", false);
        context.SetVarValue("是否成功", true);
        context.SetVarValue("消息", "思源启动后 " + waitSec + "s 内内核未就绪（冷启动慢可调大 等待窗口秒数）");
    }
    catch (Exception ex)
    {
        context.SetVarValue("思源已运行", false);
        context.SetVarValue("是否成功", false);
        context.SetVarValue("消息", "启动分支异常：" + ex.Message);
    }
}

public static bool ProbeKernel(string syUrl, int timeoutMs)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/system/version");
        req.Method = "POST";
        req.ContentType = "application/json";
        req.ContentLength = 0;
        req.Timeout = timeoutMs;
        req.ReadWriteTimeout = timeoutMs;
        using (var resp = (HttpWebResponse)req.GetResponse()) return (int)resp.StatusCode < 500;
    }
    catch { return false; }
}

}

// ==== SY-日志轮转.cs ====
public class __Snippet15 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·日志轮转 —— 动作本地日志追加（sy-quicker.log 超 1MB 滚动保留 1 份 .old）
// 路径：%APPDATA%\Quicker\sy-quicker.log（不进思源工作区，避免同步污染）
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】后台线程（MTA）；失败后停止=否（日志失败不影响主流程）。
// 【输入变量】日志内容(文本) 日志级别(文本，INFO/WARN/ERROR，默认 INFO) 场景标记(文本，可空，如动作名)
// 【输出变量】是否成功(布尔) 日志路径(文本)
// 【说明】多进程并发追加用 File.AppendText + 互斥锁（Mutex 跨进程）；轮转在 >1MB 时
//         先删 .old 再 Move 当前行；异常静默（日志永不打断动作）。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var content = context.GetVarValue("日志内容") as string ?? "";
    var level = context.GetVarValue("日志级别") as string ?? "INFO";
    var scene = context.GetVarValue("场景标记") as string ?? "";

    var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Quicker");
    var logPath = Path.Combine(dir, "sy-quicker.log");
    context.SetVarValue("日志路径", logPath);

    try
    {
        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
        var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " [" + level + "]"
                   + (scene.Length > 0 ? "[" + scene + "]" : "") + " " + content.Replace("\r\n", " ").Replace("\n", " ");

        using (var mutex = new Mutex(false, "Global\\sy-quicker-log"))
        {
            var ok = false;
            try { ok = mutex.WaitOne(500); } catch (AbandonedMutexException) { ok = true; }
            try
            {
                if (File.Exists(logPath) && new FileInfo(logPath).Length > 1024 * 1024)
                {
                    var old = logPath + ".old";
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(logPath, old);
                }
                File.AppendAllText(logPath, line + Environment.NewLine, Encoding.UTF8);
            }
            finally { if (ok) mutex.ReleaseMutex(); }
        }
        context.SetVarValue("是否成功", true);
    }
    catch
    {
        context.SetVarValue("是否成功", false); // 日志失败静默：不打断动作
    }
}

}

// ==== SY-粘贴守卫.cs ====
public class __Snippet16 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·粘贴守卫 —— 模拟粘贴前的目标窗口确认（R151-04 焦点与危险输入保护核心件）
// 蓝图：docs/21 R151-04 · 用法：写剪贴板 → 本守卫 → [允许粘贴=true 时] 模拟按键 Ctrl+V
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【模块设置】普通线程（需查前台窗口）。
// 【输入变量】窗口标题关键字(文本，前台窗口标题须含此关键字；空=不校验直接放行)
//             校验进程名(文本，可空，如 "SiYuan"；进程名比标题更稳)
// 【输出变量】允许粘贴(布尔) 前台窗口(文本) 消息(文本)
// 【语义】R151-04 验收：焦点变化/弹窗遮挡/目标不匹配时**不粘贴**——本守卫输出 允许粘贴=false，
//         动作的条件分支据此终止并提示，绝不把内容写进错误应用。
// 【依赖】user32 P/Invoke（GetForegroundWindow/GetWindowText），零第三方。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var keyword = (context.GetVarValue("窗口标题关键字") as string ?? "").Trim();
    var processHint = (context.GetVarValue("校验进程名") as string ?? "").Trim();

    string title;
    string processName;
    GetForeground(out title, out processName);
    context.SetVarValue("前台窗口", title + (processName.Length > 0 ? " [" + processName + "]" : ""));

    var ok = true;
    var why = "";
    if (keyword.Length > 0 && title.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) < 0)
    {
        ok = false;
        why = "前台窗口标题不含关键字「" + keyword + "」";
    }
    if (ok && processHint.Length > 0 && processName.IndexOf(processHint, StringComparison.OrdinalIgnoreCase) < 0)
    {
        ok = false;
        why = "前台进程不是「" + processHint + "」";
    }

    context.SetVarValue("允许粘贴", ok);
    context.SetVarValue("消息", ok
        ? "✓ 目标窗口匹配，可粘贴"
        : "✗ 已阻止粘贴：" + why + "（把目标窗口带到前台后重试）");
}

[DllImport("user32.dll")]
private static extern IntPtr GetForegroundWindow();

[DllImport("user32.dll", CharSet = CharSet.Unicode)]
private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

[DllImport("user32.dll")]
private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

private static void GetForeground(out string title, out string processName)
{
    title = "";
    processName = "";
    try
    {
        var h = GetForegroundWindow();
        if (h == IntPtr.Zero) return;
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        title = sb.ToString();
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        var p = System.Diagnostics.Process.GetProcessById((int)pid);
        processName = p.ProcessName;
    }
    catch { /* 前台查询失败不抛——由关键字校验自然拒绝 */ }
}

}

// ==== SY-路由.cs ====
public class __Snippet17 {
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

}

// ==== SY-路由前缀解析.cs ====
public class __Snippet18 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·路由前缀解析 —— 捕获多目标路由的解析层（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/03 §0「捕获多目标路由」（R3，v1 只做前缀路由不做正则）
// @version 1.0.0 · 2026-10-03 首版（编译验证通过；@人脉名单/剥离规则见文件尾说明）
//
// 【模块设置】普通/后台线程均可。
// 【输入变量】输入文本(文本，用户记的内容) 路由规则表(文本，每行一条：`#前缀=目标文档ID`；`@`=人脉规则)
//             默认文档ID(文本，通常=日记笔记本的今日日记由后续 appendDailyNoteBlock 决定，这里放收集箱或留空)
// 【输出变量】目标文档ID(文本；空=走默认) 剩余文本(文本，前缀剥离后) 人脉名单(文本，逗号分隔) 命中规则(文本，调试用)
// 【规则表示例】
//   #会议=20240101120000-abcdef
//   #周报=20240102130000-123456
//   @人脉
// 【语义】输入 " #会议 定了三件事" → 目标=会议文档ID、剩余文本="定了三件事"；
//         输入 "@张三 李四 午饭聊AI" → 人脉名单="张三,李四"、剩余文本="午饭聊AI"（@规则只开开关，人名取 @ 后到行尾的全部词）。
// ============================================================================


public static void Exec(Quicker.Public.IStepContext context)
{
    var input = context.GetVarValue("输入文本") as string ?? "";
    var rules = context.GetVarValue("路由规则表") as string ?? "";
    var defaultDoc = context.GetVarValue("默认文档ID") as string ?? "";

    var trimmed = input.TrimStart();
    var target = "";
    var hit = "";
    var rest = trimmed;

    // 1) 前缀规则（#xxx=目标文档ID）：取最长匹配前缀
    if (trimmed.StartsWith("#"))
    {
        var spaceIdx = trimmed.IndexOf(' ');
        var token = spaceIdx < 0 ? trimmed : trimmed.Substring(0, spaceIdx);   // 如 "#会议"
        foreach (var rawLine in rules.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || !line.StartsWith("#") || !line.Contains("=")) continue;
            var eq = line.IndexOf('=');
            var prefix = line.Substring(0, eq).Trim();          // "#会议"
            var docId = line.Substring(eq + 1).Trim();          // 文档ID
            if (token == prefix && docId.Length > 0)
            {
                target = docId;
                hit = prefix;
                rest = spaceIdx < 0 ? "" : trimmed.Substring(spaceIdx + 1).Trim();
                break;
            }
        }
    }

    // 2) @人脉规则：命中 @ 开头时提取人名（到行尾），前缀本身剥离
    var names = new List<string>();
    if (rest.StartsWith("@"))
    {
        var hitAt = false;
        foreach (var rawLine in rules.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (line == "@人脉") { hitAt = true; break; }
        }
        if (hitAt)
        {
            hit = hit.Length > 0 ? hit + "+@" : "@";
            var body = rest.Substring(1).Trim();                // "@张三 李四 午饭" → "张三 李四 午饭"
            var parts = body.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            // v1 约定：@ 后的词自首个中文字符起；英文场景按"前两段为人名、其余为正文"过于武断——
            // 简化规则：人名=前 N 个词，N 为规则行 "@人脉" 后可选括号里的数字（如 "@人脉(2)"），缺省 1
            var n = 1;
            var rp = rules.IndexOf("@人脉(", StringComparison.Ordinal);
            if (rp >= 0)
            {
                var close = rules.IndexOf(')', rp);
                var num = rules.Substring(rp + "@人脉(".Length, Math.Max(0, close - (rp + "@人脉(".Length)));
                int.TryParse(num.Trim(), out n);
            }
            n = Math.Max(1, Math.Min(n, 10));
            var textParts = new List<string>(parts);
            for (var i = 0; i < n && textParts.Count > 0; i++)
            {
                names.Add(textParts[0]);
                textParts.RemoveAt(0);
            }
            rest = string.Join(" ", textParts);
        }
    }

    context.SetVarValue("目标文档ID", target.Length > 0 ? target : defaultDoc);
    context.SetVarValue("剩余文本", rest);
    context.SetVarValue("人脉名单", string.Join(",", names));
    context.SetVarValue("命中规则", hit);
}

}

// ==== SY-预检.cs ====
public class __Snippet19 {
//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·预检 —— 动作运行前能力与版本预检（R151-06 缺口(a) 闭环件）
// 蓝图：docs/21 R151-06 · 共享规范 docs/03 §0「配置就绪检查」
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【模块设置】后台线程（MTA）；失败后停止=否（预检本身就是失败收集器）。
// 【输入变量】sy_url(文本，默认 http://127.0.0.1:6806) sy_token(文本)
//             需要桥(文本，"true"=额外检快门桥可用，默认 false)
//             需要插件(文本，逗号分隔插件 id，如 "siyuan-checkin,siyuan-contacts"，可空)
// 【输出变量】全部通过(布尔) 预检报告(文本，逐项 ✓/✗) 失败项(文本，分号分隔——为空即全过)
// 【检项】①内核可达（version，500ms）②令牌有效（lsNotebooks）③快门桥可用（可选，bridge.ping 经内核
//         路由探测）④指定插件在装（registry.list 比对）⑤Quicker 版本（环境信息，仅报告不阻断——
//         最低版本要求以动作设置「最低 Quicker 版本」元信息为准，Quicker 安装器已强制）
// 【说明】不满足前置时调用方应进入草稿/手动路径（R151-06 验收语义：不显示「可运行」假象）。
// ============================================================================

public static void Exec(Quicker.Public.IStepContext context)
{
    var syUrl = (context.GetVarValue("sy_url") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var token = context.GetVarValue("sy_token") as string ?? "";
    var needBridge = (context.GetVarValue("需要桥") as string ?? "false").Trim() == "true";
    var needPlugins = (context.GetVarValue("需要插件") as string ?? "").Trim();

    var report = new StringBuilder();
    var failures = new List<string>();
    report.Append("# SY·预检 ").Append(DateTime.Now.ToString("HH:mm:ss")).Append("\n");

    // ① 内核可达
    var v = KernelPost(syUrl, token, "/api/system/version", "{}", 500);
    if (!v.Success)
    {
        report.Append("✗ 内核不可达（").Append(syUrl).Append("）——SY·思源未运行分支可恢复\n");
        failures.Add("内核不可达");
        Finish(context, report, failures);
        return;
    }
    report.Append("✓ 内核可达（思源 ").Append(ExtractStr(v.Text, "data") ?? "?").Append("）\n");

    // ② 令牌有效（鉴权端点）
    var auth = KernelPost(syUrl, token, "/api/notebook/lsNotebooks", "{}", 3000);
    if (auth.Success && !auth.Text.Contains("\"code\":-")) report.Append("✓ 令牌有效\n");
    else
    {
        report.Append("✗ 令牌无效（401/403）——思源 设置→关于→复制 API 令牌\n");
        failures.Add("令牌无效");
    }

    // ③ 快门桥可用（可选）
    if (needBridge)
    {
        // 经内核路由探快门（桥文件消费需要前端在线；此处只验「快门在装+内核侧活着」）
        var ping = KernelPost(syUrl, token, "/plugin/private/siyuan-quickgate/exec", "{\"op\":\"bridge.ping\",\"args\":{}}", 5000);
        if (ping.Success && ping.Text.Contains("\"status\":\"recorded\""))
        {
            var ver = ExtractStr(ping.Text, "version") ?? "?";
            report.Append("✓ 快门桥可用（").Append(ver).Append("）\n");
        }
        else
        {
            report.Append("✗ 快门桥不可用（未装/未启用/内核路由不通）——见 docs/FAQ.md §1\n");
            failures.Add("快门桥不可用");
        }
    }

    // ④ 指定插件在装（registry.list 白名单/黑名单语义由快门负责）
    if (needPlugins.Length > 0)
    {
        var reg = KernelPost(syUrl, token, "/plugin/private/siyuan-quickgate/exec", "{\"op\":\"registry.list\",\"args\":{}}", 8000);
        var found = 0;
        var missing = new List<string>();
        foreach (var pidRaw in needPlugins.Split(','))
        {
            var pid = pidRaw.Trim();
            if (pid.Length == 0) continue;
            if (reg.Success && reg.Text.Contains("\"pluginId\":\"" + pid + "\"")) found++;
            else missing.Add(pid);
        }
        if (missing.Count == 0) report.Append("✓ 所需插件在装（").Append(found).Append("/").Append(found).Append("）\n");
        else
        {
            report.Append("✗ 缺插件：").Append(string.Join(", ", missing.ToArray())).Append("\n");
            failures.Add("缺插件:" + string.Join("/", missing.ToArray()));
        }
    }

    Finish(context, report, failures);
}

public static void Finish(Quicker.Public.IStepContext context, StringBuilder report, List<string> failures)
{
    report.Append("\n> ").Append(failures.Count == 0 ? "全部通过，可执行" : "存在失败项——按验收语义进入草稿/手动路径，不显示「可运行」假象");
    context.SetVarValue("全部通过", failures.Count == 0);
    context.SetVarValue("预检报告", report.ToString());
    context.SetVarValue("失败项", string.Join(";", failures.ToArray()));
    context.SetVarValue("结果消息", failures.Count == 0 ? "✓ 预检全部通过" : "⚠️ 预检 " + failures.Count + " 项未过");
}

// ---- 内核与 JSON 原语（与 g2-capture.cs 同款，C#5 零依赖；带超时参数） ----
public static KernelResult KernelPost(string syUrl, string token, string endpoint, string body, int timeoutMs)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + endpoint);
        req.Method = "POST";
        req.ContentType = "application/json";
        if (token.Length > 0) req.Headers[HttpRequestHeader.Authorization] = "Token " + token;
        req.Timeout = timeoutMs;
        req.ReadWriteTimeout = timeoutMs;
        var buf = Encoding.UTF8.GetBytes(body);
        using (var s = req.GetRequestStream()) s.Write(buf, 0, buf.Length);
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            return new KernelResult { Success = true, Text = reader.ReadToEnd(), Error = "" };
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null)
        {
            var text = "";
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) text = reader.ReadToEnd();
            return new KernelResult { Success = false, Text = text, Error = "HTTP " + (int)resp.StatusCode };
        }
        return new KernelResult { Success = false, Text = "", Error = "网络不可达：" + we.Message };
    }
    catch (Exception ex) { return new KernelResult { Success = false, Text = "", Error = ex.Message }; }
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

public struct KernelResult { public bool Success; public string Text; public string Error; }

}
