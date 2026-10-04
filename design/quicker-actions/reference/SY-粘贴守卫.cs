//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·粘贴守卫 —— 模拟粘贴前的目标窗口确认（R151-04 焦点与危险输入保护核心件）
// 蓝图：docs/21 R151-04 · 用法：写剪贴板 → 本守卫 → [允许粘贴=true 时] 模拟按键 Ctrl+V
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【模块设置】普通线程（需查前台窗口）。
// 【输入变量】窗口标题关键字(文本，前台窗口标题须含此关键字；空=不校验直接放行)
//             校验进程名(文本，可空，如 "SiYuan"；进程名比标题更稳)
// 【输出变量】允许粘贴(布尔) 前台窗口(文本) 消息(文本)
// 【语义】R151-04 验收：焦点变化/弹窗遮挡/目标不匹配时**不粘贴**——本守卫输出 允许粘贴=false，
//         动作的条件分支据此终止并提示，绝不把内容写进错误应用。
// 【依赖】user32 P/Invoke（GetForegroundWindow/GetWindowText），零第三方。
// ============================================================================
using System;
using System.Text;
using System.Runtime.InteropServices;

public static void Exec(Quicker.Public.IStepContext context)
{
    var keyword = (context.GetVarValue("窗口标题关键字") as string ?? "").Trim();
    var processHint = (context.GetVarValue("校验进程名") as string ?? "").Trim();

    string title;
    string processName;
    GetForeground(out title, out processName);
    context.SetVarValue("前台窗口", title + (processName.Length > 0 ? " [" + processName + "]" : ""));

    var ok = true;
    var why = "";
    if (keyword.Length > 0 && title.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) < 0)
    {
        ok = false;
        why = "前台窗口标题不含关键字「" + keyword + "」";
    }
    if (ok && processHint.Length > 0 && processName.IndexOf(processHint, StringComparison.OrdinalIgnoreCase) < 0)
    {
        ok = false;
        why = "前台进程不是「" + processHint + "」";
    }

    context.SetVarValue("允许粘贴", ok);
    context.SetVarValue("消息", ok
        ? "✓ 目标窗口匹配，可粘贴"
        : "✗ 已阻止粘贴：" + why + "（把目标窗口带到前台后重试）");
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
        var p = System.Diagnostics.Process.GetProcessById((int)pid);
        processName = p.ProcessName;
    }
    catch { /* 前台查询失败不抛——由关键字校验自然拒绝 */ }
}
