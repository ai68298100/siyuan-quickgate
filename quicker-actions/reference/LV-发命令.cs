//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·发命令 —— 向快门桥 commands.ndjson 追加一行信封（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/02 §2/§6 · 协议 v1.1
//
// 【模块设置】后台线程（MTA）。
// 【输入变量】桥插件(文本，默认 siyuan-quickgate) 命令op(文本) 命令参数(文本，JSON 对象字面量，如 {"keyword":"x"})
//             可选ttl(数字，ms，0=不带) 目标设备(文本，可空)
// 【输出变量】命令id(文本) 发送成功(布尔) 发送错误(文本)
// 【说明】args 以 JSON 文本直接内嵌（不反序列化再序列化，避免浮点/中文转义误差）；
//         putFile 为 Multipart 表单（path 文本字段 + file 字段）。不依赖 Newtonsoft。
// ============================================================================

using System;
using System.IO;
using System.Net;
using System.Text;

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
        if (we.Response is HttpWebResponse r && (int)r.StatusCode == 404) return null;
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
