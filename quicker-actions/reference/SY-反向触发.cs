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
using System;
using System.IO;
using System.Net;
using System.Text;

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
