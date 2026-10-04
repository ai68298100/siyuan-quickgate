//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·取回执 —— 按 id 轮询 results.ndjson 匹配回执（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/02 §3/§6 · 等待策略：按 op 区分（阻断项 D-0005）
// @version 1.0.0 · 2026-10-03 首版（编译验证通过；pending 语义不换 id 重试）
//
// 【模块设置】后台线程（MTA）。
// 【目标模式】普通动作→「C# 脚本」模块（普通模式v2）；不是 Quicker 2.3+ 的「脚本动作」类型（该类型为语法子集：无 async/await、无 lock/Mutex，宿主上下文 API 面不同），误贴会编译或运行失败。
// 【输入变量】桥插件(文本) 命令id(文本) 等待毫秒(数字；普通数据 op 8000 / commands.run 35000)
// 【输出变量】回执状态(文本：recorded|rejected|failed|unsupported|expired|timeout)
//             回执消息(文本) 回挂数据(文本，JSON) 回执原始行(文本)
// 【铁律】超时不得换新 id 重试（幂等键=id）；迟到回执仍会按原 id 落盘，动作可二次查询。
// ============================================================================

using System;
using System.Net;
using System.Text;

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
