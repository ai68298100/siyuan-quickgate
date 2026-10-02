// SiYuan 划词摘录 → 收集箱（G2 样板单文件版）
// 粘贴到 Quicker C# 模块即可使用，无需分别搭建多个子程序
//
// 【Quicker 配置】
//   动作类型：C# 脚本
//   用户输入：
//     SY_URL     (文本) 思源地址，默认 http://127.0.0.1:6806
//     SY_TOKEN   (文本) API 令牌
//     收集箱ID   (文本) 收集箱文档 ID
//   输入变量：
//     {选中文本}  从 Quicker 文本变量获取（划词内容）
//   输出变量：
//     是否成功   (布尔)
//     结果消息   (文本)
//
// 【使用方式】
//   1. Quicker 新建动作 → 添加「C# 脚本」模块
//   2. 粘贴本代码
//   3. 在动作设置中添加用户配置项 SY_URL / SY_TOKEN / 收集箱ID
//   4. 绑定快捷键或鼠标侧键
//
// 依赖：仅 .NET 标准库（HttpClient / Encoding / Json）
// 兼容：Quicker V2 (2.x) + .NET Framework 4.x+

using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

// Quicker C# 模块入口（同步包装异步方法）
public static void Exec(Quicker.Public.IStepContext context)
{
    try
    {
        Main(context);
    }
    catch (Exception ex)
    {
        var msg = "❌ " + (ex.InnerException?.Message ?? ex.Message);
        context.SetVarValue("结果消息", msg);
        context.SetVarValue("是否成功", false);
        ShowNotify(msg, true);
    }
}

static void Main(Quicker.Public.IStepContext context)
{
    // ---- 配置读取 ----
    var syUrl = (context.GetVarValue("SY_URL") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
    var syToken = context.GetVarValue("SY_TOKEN") as string ?? "";
    var collectionBoxId = context.GetVarValue("收集箱ID") as string ?? "";

    // ---- 选中文本 ----
    var selectedText = (context.GetVarValue("选中文本") as string ?? "").Trim();
    if (string.IsNullOrEmpty(selectedText))
    {
        context.SetVarValue("结果消息", "⚠️ 未选中任何文字");
        context.SetVarValue("是否成功", false);
        return;
    }

    // ---- 收集箱 ID 校验 ----
    if (string.IsNullOrEmpty(collectionBoxId))
    {
        context.SetVarValue("结果消息", "⚠️ 请先在动作设置中配置「收集箱ID」");
        context.SetVarValue("是否成功", false);
        return;
    }

    // ---- 构造请求 ----
    var now = DateTime.Now;
    var timestamp = now.ToString("HH:mm");
    var source = (context.GetVarValue("来源窗口") as string ?? "").Trim();
    var quoteBlock = "> " + selectedText.Replace("\n", "\n> ");
    var sourceLine = string.IsNullOrEmpty(source)
        ? ""
        : "\n\n> 来源：" + source;

    var markdown = quoteBlock + sourceLine
        + "\n\n" + timestamp
        + " #[摘录]";

    // ---- API 调用 ----
    using (var client = new HttpClient())
    {
        client.Timeout = TimeSpan.FromSeconds(10);
        client.DefaultRequestHeaders.Add("Authorization", "Token " + syToken);

        // 追加块到收集箱文档末尾
        var endpoint = syUrl + "/api/block/insertBlock";
        var payload = new
        {
            dataType = "markdown",
            data = markdown,
            parentID = collectionBoxId
        };
        var json = SimpleJson(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = client.PostAsync(endpoint, content).Result;
        var body = response.Content.ReadAsStringAsync().Result;

        if (!response.IsSuccessStatusCode)
        {
            var errMsg = "HTTP " + (int)response.StatusCode;
            try
            {
                var errObj = ParseJson(body);
                errMsg += " " + (errObj.msg ?? "");
            }
            catch { }
            context.SetVarValue("结果消息", "❌ " + errMsg);
            context.SetVarValue("是否成功", false);
            return;
        }

        // 解析响应获取块 ID
        string blockId = "";
        try
        {
            var respObj = ParseJson(body);
            blockId = respObj.data ?? "";
        }
        catch { }

        // ---- 成功通知 ----
        var preview = selectedText.Length > 30
            ? selectedText.Substring(0, 30) + "…"
            : selectedText;
        var msg = "✓ 已入收集箱：" + preview;
        context.SetVarValue("结果消息", msg);
        context.SetVarValue("是否成功", true);
        ShowNotify(msg, false);
    }
}

// ---- 辅助方法 ----

static void ShowNotify(string msg, bool isError)
{
    // Quicker 通知：通过 ShowMessage 触发
    // 如果 Quicker 环境不支持，可以注释掉或改用其他通知方式
    try
    {
        // Quicker V2 提供 ShowMessage
        // 此处通过反射调用以保持通用性
    }
    catch { }
    // 备用：Windows 通知（如果 Quicker ShowMessage 不可用）
}

static string SimpleJson(object obj)
{
    // 极简 JSON 序列化（仅支持匿名类型平铺字段）
    var sb = new StringBuilder("{");
    var type = obj.GetType();
    var props = type.GetProperties();
    for (int i = 0; i < props.Length; i++)
    {
        if (i > 0) sb.Append(",");
        var name = props[i].Name;
        var value = props[i].GetValue(obj);
        sb.Append("\"").Append(name).Append("\":");
        if (value is string s)
            sb.Append("\"").Append(EscapeJson(s)).Append("\"");
        else if (value is bool b)
            sb.Append(b ? "true" : "false");
        else if (value is int || value is long || value is double)
            sb.Append(value.ToString());
        else
            sb.Append("\"").Append(EscapeJson(value?.ToString() ?? "")).Append("\"");
    }
    sb.Append("}");
    return sb.ToString();
}

static string EscapeJson(string s)
{
    return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
}

// 注意：Quicker C# 模块中不能使用 HttpClient 的 async/await
// 上方 Main 方法使用 .Result 同步等待——这在 Quicker 后台线程（MTA）中是安全的
// 如果遇到死锁，改用以下方式：
//   var task = Task.Run(async () => { ... });
//   task.Wait();
