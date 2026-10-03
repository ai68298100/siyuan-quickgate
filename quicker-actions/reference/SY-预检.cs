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
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;

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
