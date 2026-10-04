//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·思源未运行分支 —— 内核不可达时的标准分支（docs/05 §6.1 toggle 语义）
// 流程：探测 /api/system/version（300ms 超时）→ 询问是否启动 → run 思源 exe → 重探（≤15s）→ 输出恢复结果
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】普通线程（需要弹窗与前台启动）。
// 【目标模式】普通动作→「C# 脚本」模块（普通模式v2）；不是 Quicker 2.3+ 的「脚本动作」类型（该类型为语法子集：无 async/await、无 lock/Mutex，宿主上下文 API 面不同），误贴会编译或运行失败。
// 【输入变量】sy_url(文本) 思源exe路径(文本，默认 C:\Program Files\SiYuan\SiYuan.exe)
//             静默启动(文本，"true"=跳过询问直接启动，默认 false) 等待窗口秒数(数字，默认 15)
// 【输出变量】思源已运行(布尔，出口=后续主流程是否继续) 是否成功(布尔，本子程序自身执行无异常) 消息(文本)
// 【说明】退出码约定：思源已运行=true 直接走主流程；启动成功=true；用户拒绝/启动失败=false 主流程终止。
//         已运行但探测超时（内核忙）也返回 true——交由上层「通用错误流」重试（docs/04 §8 busy ≤3）。
// ============================================================================
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

public static void Exec(Quicker.Public.IStepContext context)
{
    try
    {
        var syUrl = (context.GetVarValue("sy_url") as string ?? "http://127.0.0.1:6806").TrimEnd('/');
        var exePath = context.GetVarValue("思源exe路径") as string;
        if (string.IsNullOrWhiteSpace(exePath)) exePath = "C:\\Program Files\\SiYuan\\SiYuan.exe";
        var silent = (context.GetVarValue("静默启动") as string ?? "false").Trim() == "true";
        var waitSec = 15;
        int.TryParse(context.GetVarValue("等待窗口秒数") as string, out waitSec);
        if (waitSec <= 0) waitSec = 15;

        // 1) 首探（300ms：面板主流程要求快速失败，docs/05 §4 步骤2）
        if (ProbeKernel(syUrl, 300))
        {
            context.SetVarValue("思源已运行", true);
            context.SetVarValue("是否成功", true);
            context.SetVarValue("消息", "内核可达");
            return;
        }

        // 2) 询问（静默模式跳过）
        if (!silent)
        {
            var answer = MessageBox.Show("思源没在运行。启动它吗？", "小驴 · 思源未运行",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1);
            if (answer != DialogResult.Yes)
            {
                context.SetVarValue("思源已运行", false);
                context.SetVarValue("是否成功", true);
                context.SetVarValue("消息", "用户选择不启动");
                return;
            }
        }

        // 3) 启动（exe 不存在时退回 siyuan:// 协议拉起——05 §7-B 实测项的预案）
        if (File.Exists(exePath))
            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
        else
            Process.Start(new ProcessStartInfo("siyuan://") { UseShellExecute = true });

        // 4) 重探（每 500ms × waitSec，先于盲等窗口出现）
        var deadline = Environment.TickCount + waitSec * 1000;
        while (Environment.TickCount < deadline)
        {
            Thread.Sleep(500);
            if (ProbeKernel(syUrl, 500))
            {
                context.SetVarValue("思源已运行", true);
                context.SetVarValue("是否成功", true);
                context.SetVarValue("消息", "思源已启动并就绪");
                return;
            }
        }

        context.SetVarValue("思源已运行", false);
        context.SetVarValue("是否成功", true);
        context.SetVarValue("消息", "思源启动后 " + waitSec + "s 内内核未就绪（冷启动慢可调大 等待窗口秒数）");
    }
    catch (Exception ex)
    {
        context.SetVarValue("思源已运行", false);
        context.SetVarValue("是否成功", false);
        context.SetVarValue("消息", "启动分支异常：" + ex.Message);
    }
}

public static bool ProbeKernel(string syUrl, int timeoutMs)
{
    try
    {
        var req = (HttpWebRequest)WebRequest.Create(syUrl + "/api/system/version");
        req.Method = "POST";
        req.ContentType = "application/json";
        req.ContentLength = 0;
        req.Timeout = timeoutMs;
        req.ReadWriteTimeout = timeoutMs;
        using (var resp = (HttpWebResponse)req.GetResponse()) return (int)resp.StatusCode < 500;
    }
    catch { return false; }
}
