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
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Text;

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

    // 尺寸预检（R90-P1 体积限制缺口）：>20MB 提示压缩/分片替代，不盲目上传等超时
    if (png.Length > 20L * 1024 * 1024)
    {
        context.SetVarValue("是否成功", false);
        context.SetVarValue("结果消息", "❌ 图片 " + FormatSize(png.Length) + " 超过 20MB——请先压缩或裁剪后重试（大图直接上传会超时）");
        return;
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

public static string FormatSize(long bytes)
{
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return (bytes / 1024.0).ToString("F1") + "KB";
    return (bytes / 1024.0 / 1024).ToString("F1") + "MB";
}

public struct KernelResult { public bool Success; public string Text; public string Error; }
public struct UploadResult { public bool Success; public string Text; public string Error; }
