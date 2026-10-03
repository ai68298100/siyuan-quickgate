//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·WebDAV传输 —— 远程素材导入/归档的通用 WebDAV 客户端（R154-04/05 落地件）
// 验收语义（docs/21 R154-04/05）：凭据只存在于动作配置（本子程序不输出凭据/带凭据 URL）；
//                                下载失败可逐项补做（单文件单调用）；MD5 指纹随传输输出
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【前置】WebDAV 端点自备——本机可用 openlist 插件（启用后 http://127.0.0.1:5244/dav/）或任意
//         WebDAV 服务（坚果云/InfiniCloud/AList 等）。
// 【模块设置】后台线程（MTA）；失败后停止=否。
// 【输入变量】操作(文本，"download"/"upload"/"list") dav_base(文本，如 http://127.0.0.1:5244/dav)
//             dav_user(文本) dav_pass(文本) 远程路径(文本，相对 dav_base，如 "nas/资料/a.pdf")
//             本地文件(文本，upload=源文件；download=目标保存路径，目录不存在自动建)
// 【输出变量】是否成功(文本→布尔) 消息(文本) 本地文件(文本，download 回填实际保存路径)
//             远程列表(文本，list：每行"名称\t类型(0文件/1目录)\t大小") 内容MD5(文本)
// 【说明】PROPFIND Depth=1 仅一层；list 输出走轻量 XML 提取（多命名空间容错）；
//         upload 默认覆盖（PUT 语义），防覆盖由调用方先 list 比对。
// ============================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var op = (context.GetVarValue("操作") as string ?? "").Trim().ToLowerInvariant();
    var davBase = (context.GetVarValue("dav_base") as string ?? "").TrimEnd('/');
    var user = context.GetVarValue("dav_user") as string ?? "";
    var pass = context.GetVarValue("dav_pass") as string ?? "";
    var remote = (context.GetVarValue("远程路径") as string ?? "").Trim().TrimStart('/');
    var local = (context.GetVarValue("本地文件") as string ?? "").Trim();

    if (davBase.Length == 0 || remote.Length == 0)
    {
        Fail(context, "缺少 dav_base 或 远程路径");
        return;
    }
    var url = davBase + "/" + remote;

    try
    {
        if (op == "download")
        {
            if (local.Length == 0) { Fail(context, "download 需要本地文件（保存路径）"); return; }
            var dir = Path.GetDirectoryName(local);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var req = MakeReq(url, "GET", user, pass, 60000);
            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var rs = resp.GetResponseStream())
            using (var fs = new FileStream(local, FileMode.Create, FileAccess.Write))
            {
                var buf = new byte[81920];
                int n;
                while ((n = rs.Read(buf, 0, buf.Length)) > 0) fs.Write(buf, 0, n);
            }
            // 指纹：对落盘文件计算（单次拉取，避免消费响应流后无法复用）
            string fp = "";
            using (var md5 = MD5.Create())
            using (var fs = File.OpenRead(local))
            {
                var h = md5.ComputeHash(fs);
                var sb = new StringBuilder();
                foreach (var b in h) sb.Append(b.ToString("x2"));
                fp = sb.ToString();
            }
            context.SetVarValue("本地文件", local);
            context.SetVarValue("内容MD5", fp);
            Ok(context, "✓ 已下载 " + new FileInfo(local).Length + " 字节（MD5 " + fp + "）");
            return;
        }

        if (op == "upload")
        {
            if (local.Length == 0 || !File.Exists(local)) { Fail(context, "upload 需要存在的本地文件"); return; }
            var req = MakeReq(url, "PUT", user, pass, 300000);
            var bytes = File.ReadAllBytes(local);
            req.ContentLength = bytes.Length;
            using (var s = req.GetRequestStream()) s.Write(bytes, 0, bytes.Length);
            using (var resp = (HttpWebResponse)req.GetResponse())
            {
                var etag = resp.Headers["ETag"] ?? "";
                Ok(context, "✓ 已上传（HTTP " + (int)resp.StatusCode + (etag.Length > 0 ? "，ETag " + etag : "") + "）");
            }
            return;
        }

        if (op == "list")
        {
            var req = MakeReq(url.EndsWith("/") ? url : url + "/", "PROPFIND", user, pass, 30000);
            req.Headers["Depth"] = "1";
            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                var xml = reader.ReadToEnd();
                var lines = new List<string>();
                // 多命名空间容错：<d:href> / <D:href> / <href>；集合=<d:collection/>
                var hrefRe = new System.Text.RegularExpressions.Regex("<(?:[a-zA-Z0-9]+:)?href>([^<]+)</(?:[a-zA-Z0-9]+:)?href>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                var colRe = new System.Text.RegularExpressions.Regex("<(?:[a-zA-Z0-9]+:)?collection\\s*/?>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                var lenRe = new System.Text.RegularExpressions.Regex("<(?:[a-zA-Z0-9]+:)?getcontentlength>(\\d+)<");
                var blockRe = new System.Text.RegularExpressions.Regex("<(?:[a-zA-Z0-9]+:)?response[\\s\\S]*?</(?:[a-zA-Z0-9]+:)?response>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                foreach (System.Text.RegularExpressions.Match blk in blockRe.Matches(xml))
                {
                    var body = blk.Value;
                    var hm = hrefRe.Match(body);
                    if (!hm.Success) continue;
                    var href = Uri.UnescapeDataString(hm.Groups[1].Value);
                    var name = href.TrimEnd('/');
                    var slash = name.LastIndexOf('/');
                    name = slash >= 0 ? name.Substring(slash + 1) : name;
                    if (name.Length == 0) continue; // 根自身
                    var isDir = colRe.IsMatch(body);
                    var lm = lenRe.Match(body);
                    lines.Add(name + "\t" + (isDir ? "1" : "0") + "\t" + (isDir ? "" : (lm.Success ? lm.Groups[1].Value : "?")));
                }
                context.SetVarValue("远程列表", string.Join("\n", lines.ToArray()));
                Ok(context, "✓ 列出 " + lines.Count + " 项");
            }
            return;
        }

        Fail(context, "未知操作：" + op + "（download/upload/list）");
    }
    catch (WebException we)
    {
        var resp = we.Response as HttpWebResponse;
        if (resp != null && (int)resp.StatusCode == 401) Fail(context, "WebDAV 401：账号/密码错误（凭据仅存动作配置）");
        else if (resp != null && (int)resp.StatusCode == 404) Fail(context, "WebDAV 404：远程路径不存在");
        else if (resp != null) Fail(context, "WebDAV HTTP " + (int)resp.StatusCode);
        else Fail(context, "WebDAV 不可达：" + we.Message + "（服务已启用？端口对？）");
    }
    catch (Exception ex) { Fail(context, "传输异常：" + ex.Message); }
}

private static HttpWebRequest MakeReq(string url, string method, string user, string pass, int timeoutMs)
{
    var req = (HttpWebRequest)WebRequest.Create(url);
    req.Method = method;
    req.Timeout = timeoutMs;
    req.ReadWriteTimeout = timeoutMs;
    if (user.Length > 0)
        req.Headers[HttpRequestHeader.Authorization] = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes(user + ":" + pass));
    return req;
}

public static void Ok(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", true);
    context.SetVarValue("消息", msg);
}
public static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("消息", "❌ " + msg);
}
