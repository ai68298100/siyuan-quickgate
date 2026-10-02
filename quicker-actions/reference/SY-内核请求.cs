//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·内核请求 —— 所有思源内核调用的唯一入口（参考实现，Quicker C# 模块「普通模式v2」）
// 蓝图：docs/03 §0 · 规范：docs/02 §6 · 错误分支：docs/04 §8
//
// 【模块设置】执行线程=后台线程（MTA）；建议勾选「允许缓存程序集」；失败后停止=否（自行分支）。
// 【输入变量】sy_url(文本) sy_token(文本) 端点(文本，如 /api/system/version) 请求体(文本，JSON，可空)
// 【输出变量】状态码(数字) 文本结果(文本) 是否成功(布尔) 错误提示(文本)
// 【说明】本实现不依赖 Newtonsoft：请求体直接传文本；401/超时分支按 04 §8 给出中文提示，
//         引导分支通过 错误提示 变量交给后续 msgbox 模块展示（不在脚本内弹窗，便于替换 UI）。
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

    // 兜底：statestorage 没配时读本机 env（思源重置令牌的自愈路径，docs/03 §0）
    if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(url))
    {
        var envPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "siyuan", "env");
        if (File.Exists(envPath))
        {
            foreach (var line in File.ReadAllLines(envPath))
            {
                var i = line.IndexOf('=');
                if (i <= 0) continue;
                var k = line.Substring(0, i).Trim();
                var v = line.Substring(i + 1).Trim();
                if (k == "SIYUAN_TOKEN" && string.IsNullOrWhiteSpace(token)) token = v;
                if (k == "SIYUAN_URL" && string.IsNullOrWhiteSpace(url)) url = v.TrimEnd('/');
            }
            context.SetVarValue("sy_token", token);   // 回写动作变量，下次不再读 env
            context.SetVarValue("sy_url", url);
        }
    }

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

        try
        {
            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                context.SetVarValue("状态码", (int)resp.StatusCode);
                context.SetVarValue("文本结果", reader.ReadToEnd());
                context.SetVarValue("是否成功", true);
                context.SetVarValue("错误提示", "");
            }
        }
        catch (WebException we)
        {
            var resp = we.Response as HttpWebResponse;
            var text = "";
            if (resp != null)
                using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) text = reader.ReadToEnd();

            if (resp != null && ((int)resp.StatusCode == 401 || (int)resp.StatusCode == 403))
            {
                // 令牌无效：先自愈（重读 env 已在上方做过一次），仍失败则引导
                context.SetVarValue("状态码", (int)resp.StatusCode);
                context.SetVarValue("文本结果", text);
                context.SetVarValue("是否成功", false);
                context.SetVarValue("错误提示", "令牌无效：请到思源「设置→关于→复制 API 令牌」，粘贴到动作配置 sy_token。");
            }
            else
            {
                context.SetVarValue("状态码", resp != null ? (int)resp.StatusCode : 0);
                context.SetVarValue("文本结果", text);
                context.SetVarValue("是否成功", false);
                context.SetVarValue("错误提示", "思源未运行或网络错误：" + we.Message);
            }
        }
    }
    catch (Exception ex)
    {
        context.SetVarValue("状态码", 0);
        context.SetVarValue("文本结果", "");
        context.SetVarValue("是否成功", false);
        context.SetVarValue("错误提示", "请求异常：" + ex.Message);
    }
}
