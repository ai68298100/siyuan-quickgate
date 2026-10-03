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
using System;
using System.IO;
using System.Net;
using System.Text;

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
