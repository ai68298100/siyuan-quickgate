//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·Office选区 —— 附加运行中 Word/WPS文字 或 Excel/WPS表格 读取选区（R153-01/02/03/04 共享件）
// 机制：COM 晚绑定（Marshal.GetActiveObject），免 Office 互操作程序集；
//       ProgID 本机实证（R155）：Word.Application/Excel.Application 与 KWPS/KET 并存均可用
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过；运行时需目标 Office 打开且有选区）
//
// 【模块设置】后台线程（MTA，STA 由 COM 自动封送）；失败后停止=否（分支输出）。
// 【输入变量】应用(文本，"word" 或 "excel") 窗口标题关键字(文本，可空——SY·粘贴守卫同款前置校验)
// 【输出变量】是否成功(布尔) 消息(文本) 选区文本(文本) 页码(文本，word) 区域地址(文本，excel)
//             表格Markdown(文本，excel：Value2+Text 双列) 批注数(数字，word) 修订数(数字，word)
// 【错误分支】0x800401E3(MK_E_UNAVAILABLE)=应用未运行 → 提示「先打开文档」；
//             无选区/选区为空 → 提示先选择；进程不匹配 → 守卫拒绝。
// 【说明】只读不写；证据双列原则（R153-03）：excel 输出 Value2 原始列+Text 显示列。
// ============================================================================
using System;
using System.Text;
using System.Runtime.InteropServices;

public static void Exec(Quicker.Public.IStepContext context)
{
    var app = (context.GetVarValue("应用") as string ?? "word").Trim().ToLowerInvariant();
    var keyword = (context.GetVarValue("窗口标题关键字") as string ?? "").Trim();

    // 前置守卫：前台进程须为对应 Office（SY-粘贴守卫同款，进程名族匹配）
    string title, processName;
    GetForeground(out title, out processName);
    var wordLike = processName.IndexOf("WINWORD", StringComparison.OrdinalIgnoreCase) >= 0
                || processName.IndexOf("wps", StringComparison.OrdinalIgnoreCase) >= 0;
    var excelLike = processName.IndexOf("EXCEL", StringComparison.OrdinalIgnoreCase) >= 0
                || processName.IndexOf("et", StringComparison.OrdinalIgnoreCase) >= 0
                || processName.IndexOf("wps", StringComparison.OrdinalIgnoreCase) >= 0;
    if (keyword.Length > 0 && title.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) < 0)
    {
        Fail(context, "前台窗口标题不含「" + keyword + "」（当前：" + title + "）——把目标窗口带到前台后重试");
        return;
    }
    if (app == "word" && !wordLike) { Fail(context, "前台进程不是 Word/WPS 文字（当前：" + processName + "）"); return; }
    if (app == "excel" && !excelLike) { Fail(context, "前台进程不是 Excel/WPS 表格（当前：" + processName + "）"); return; }

    try
    {
        var progId = app == "excel" ? "Excel.Application" : "Word.Application";
        var appType = Type.GetTypeFromProgID(progId);
        if (appType == null) { Fail(context, "未安装 " + progId + "（检查 Office/WPS）"); return; }
        object instance = null;
        try { instance = Marshal.GetActiveObject(progId); }
        catch (COMException ce)
        {
            if ((uint)ce.ErrorCode == 0x800401E3) { Fail(context, progId + " 未在运行——请先打开文档再试"); return; }
            throw;
        }
        if (instance == null) { Fail(context, progId + " 未在运行"); return; }
        var t = instance.GetType();

        if (app == "word")
        {
            dynamic doc = t.InvokeMember("ActiveDocument", System.Reflection.BindingFlags.GetProperty, null, instance, null);
            dynamic sel = t.InvokeMember("Selection", System.Reflection.BindingFlags.GetProperty, null, instance, null);
            string selText = Convert.ToString(sel.Text);
            if (string.IsNullOrEmpty(selText)) { Fail(context, "无选区——先在文档里选择文本"); return; }
            string page = "";
            try
            {
                dynamic pages = sel.Information; // wdActiveEndPageNumber = 3
                page = Convert.ToString(t.InvokeMember("Information", System.Reflection.BindingFlags.GetProperty, null, sel, new object[] { 3 }));
            }
            catch { page = "?"; }
            int comments = 0, revisions = 0;
            try { comments = Convert.ToInt32(doc.Comments.Count); } catch { }
            try { revisions = Convert.ToInt32(doc.Revisions.Count); } catch { }

            context.SetVarValue("是否成功", true);
            context.SetVarValue("选区文本", selText);
            context.SetVarValue("页码", page);
            context.SetVarValue("批注数", comments);
            context.SetVarValue("修订数", revisions);
            context.SetVarValue("消息", "✓ 已读取选区（" + selText.Length + " 字，页 " + page + "，批注 " + comments + "，修订 " + revisions + "）"
                + (comments + revisions == 0 ? "——无批注/修订：走普通选区留证" : ""));
            return;
        }

        // excel：Selection.Address + Value2/Text 双列 → Markdown
        dynamic selX = t.InvokeMember("Selection", System.Reflection.BindingFlags.GetProperty, null, instance, null);
        string address = Convert.ToString(t.InvokeMember("Address", System.Reflection.BindingFlags.GetProperty, null, selX, null));
        string selType = Convert.ToString(t.InvokeMember("Name", System.Reflection.BindingFlags.GetProperty, null, selX.GetType(), null));
        var rows = new StringBuilder();
        rows.Append("| 单元格 | 原始值(Value2) | 显示值(Text) |\n|---|---|---|\n");
        int count = 0;
        try
        {
            // Cells 遍历（选区通常为连续矩形；超大选区截断 200 格）
            dynamic cells = t.InvokeMember("Cells", System.Reflection.BindingFlags.GetProperty, null, selX, null);
            var enumr = ((System.Collections.IEnumerable)cells).GetEnumerator();
            while (enumr.MoveNext() && count < 200)
            {
                dynamic cell = enumr.Current;
                string addr = Convert.ToString(t.InvokeMember("Address", System.Reflection.BindingFlags.GetProperty, null, cell, new object[] { false }));
                string v2 = "";
                string tx = "";
                try { v2 = Convert.ToString(t.InvokeMember("Value2", System.Reflection.BindingFlags.GetProperty, null, cell, null)); } catch { }
                try { tx = Convert.ToString(t.InvokeMember("Text", System.Reflection.BindingFlags.GetProperty, null, cell, null)); } catch { }
                if (v2.Length == 0 && tx.Length == 0) continue;
                rows.Append("| ").Append(addr.Replace("|", "\\|")).Append(" | ").Append(Esc(v2)).Append(" | ").Append(Esc(tx)).Append(" |\n");
                count++;
            }
        }
        catch { /* 非矩形选区等：已读到的部分有效 */ }
        if (count == 0) { Fail(context, "选区无可读单元格（空值区或非单元格选区）"); return; }

        context.SetVarValue("是否成功", true);
        context.SetVarValue("区域地址", address);
        context.SetVarValue("表格Markdown", rows.ToString());
        context.SetVarValue("消息", "✓ 已读取 " + count + " 格（" + address + "）" + (count >= 200 ? "——超 200 格截断" : ""));
    }
    catch (COMException ce)
    {
        Fail(context, "COM 调用失败（0x" + ce.ErrorCode.ToString("X") + "）：" + ce.Message);
    }
    catch (Exception ex)
    {
        Fail(context, "读取异常：" + ex.Message);
    }
}

private static string Esc(string s) { return (s ?? "").Replace("|", "\\|").Replace("\n", " "); }
private static void Fail(Quicker.Public.IStepContext context, string msg)
{
    context.SetVarValue("是否成功", false);
    context.SetVarValue("消息", "❌ " + msg);
}

[DllImport("user32.dll")]
private static extern IntPtr GetForegroundWindow();

[DllImport("user32.dll", CharSet = CharSet.Unicode)]
private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

[DllImport("user32.dll")]
private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

private static void GetForeground(out string title, out string processName)
{
    title = "";
    processName = "";
    try
    {
        var h = GetForegroundWindow();
        if (h == IntPtr.Zero) return;
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        title = sb.ToString();
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        processName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
    }
    catch { }
}
