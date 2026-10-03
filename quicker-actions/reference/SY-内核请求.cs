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

using System;
using System.IO;
using System.Net;
using System.Text;

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
