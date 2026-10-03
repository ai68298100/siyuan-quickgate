//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·日志轮转 —— 动作本地日志追加（sy-quicker.log 超 1MB 滚动保留 1 份 .old）
// 路径：%APPDATA%\Quicker\sy-quicker.log（不进思源工作区，避免同步污染）
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】后台线程（MTA）；失败后停止=否（日志失败不影响主流程）。
// 【输入变量】日志内容(文本) 日志级别(文本，INFO/WARN/ERROR，默认 INFO) 场景标记(文本，可空，如动作名)
// 【输出变量】是否成功(布尔) 日志路径(文本)
// 【说明】多进程并发追加用 File.AppendText + 互斥锁（Mutex 跨进程）；轮转在 >1MB 时
//         先删 .old 再 Move 当前行；异常静默（日志永不打断动作）。
// ============================================================================
using System;
using System.IO;
using System.Threading;

public static void Exec(Quicker.Public.IStepContext context)
{
    var content = context.GetVarValue("日志内容") as string ?? "";
    var level = context.GetVarValue("日志级别") as string ?? "INFO";
    var scene = context.GetVarValue("场景标记") as string ?? "";

    var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Quicker");
    var logPath = Path.Combine(dir, "sy-quicker.log");
    context.SetVarValue("日志路径", logPath);

    try
    {
        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
        var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " [" + level + "]"
                   + (scene.Length > 0 ? "[" + scene + "]" : "") + " " + content.Replace("\r\n", " ").Replace("\n", " ");

        using (var mutex = new Mutex(false, "Global\\sy-quicker-log"))
        {
            var ok = false;
            try { ok = mutex.WaitOne(500); } catch (AbandonedMutexException) { ok = true; }
            try
            {
                if (File.Exists(logPath) && new FileInfo(logPath).Length > 1024 * 1024)
                {
                    var old = logPath + ".old";
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(logPath, old);
                }
                File.AppendAllText(logPath, line + Environment.NewLine, Encoding.UTF8);
            }
            finally { if (ok) mutex.ReleaseMutex(); }
        }
        context.SetVarValue("是否成功", true);
    }
    catch
    {
        context.SetVarValue("是否成功", false); // 日志失败静默：不打断动作
    }
}
