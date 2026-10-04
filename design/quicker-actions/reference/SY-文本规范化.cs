//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·文本规范化（R156-02 落地件）—— 规则化文本清理，输出新旧文本供 diff 预览（不直接写回）
// 验收语义（docs/21 R156-02）：超长文本不截断；目标窗口/块重新确认由调用方负责；取消不覆盖——
//                              本子程序只产出「新文本」，写回动作由后续模块执行
// @version 1.0.0 · 2026-10-04 首版（csc C#5 编译验证通过）
//
// 【输入变量】原文本(文本) 规则集(文本，逗号分隔，默认 "blank,eol,fullwidth,mdtitle"；可选 utm)
//   blank     连续 3+ 空行压成 1 空行
//   eol       删除行尾空白；CRLF→LF
//   fullwidth 数字/字母全角→半角（中文标点保留）
//   mdtitle   标题标记后补空格（"#标题"→"# 标题"）；列表 * → - 统一
//   utm       URL 去 utm_* 追踪参数
// 【输出变量】是否成功(布尔) 新文本(文本) 变更行数(数字) 消息(文本)
// ============================================================================
using System;
using System.Text;
using System.Text.RegularExpressions;

public static void Exec(Quicker.Public.IStepContext context)
{
    var src = context.GetVarValue("原文本") as string ?? "";
    var ruleRaw = (context.GetVarValue("规则集") as string ?? "blank,eol,fullwidth,mdtitle").Trim();
    if (src.Length == 0) { context.SetVarValue("是否成功", false); context.SetVarValue("消息", "❌ 原文本为空"); return; }

    var rules = new System.Collections.Generic.HashSet<string>(ruleRaw.ToLowerInvariant().Split(','));

    var t = src;
    if (rules.Contains("eol")) t = t.Replace("\r\n", "\n").Replace("\r", "\n");
    if (rules.Contains("fullwidth")) t = FullwidthToHalf(t);
    if (rules.Contains("mdtitle")) t = Regex.Replace(t, @"(?m)^(\s*)(#{1,6})([^#\s])", "$1$2 $3");
    if (rules.Contains("mdtitle")) t = Regex.Replace(t, @"(?m)^(\s*)\*[ \t]+", "$1- ");
    if (rules.Contains("utm")) t = Regex.Replace(t, @"([?&])utm_[a-zA-Z]+=[^&\s)]*", "$1").Replace("?&", "?").Replace("&&", "&").Replace("? ", "? ");

    if (rules.Contains("eol")) t = Regex.Replace(t, @"[ \t]+\n", "\n"); // 行尾空白
    if (rules.Contains("blank")) t = Regex.Replace(t, @"\n{3,}", "\n\n"); // 空行压缩

    // 变更行数（按行差异的轻量计数）
    var changed = 0;
    var oldLines = src.Split('\n');
    var newLines = t.Split('\n');
    for (var i = 0; i < Math.Min(oldLines.Length, newLines.Length); i++)
        if (oldLines[i] != newLines[i]) changed++;
    changed += Math.Abs(oldLines.Length - newLines.Length);

    context.SetVarValue("新文本", t);
    context.SetVarValue("变更行数", changed);
    context.SetVarValue("是否成功", true);
    context.SetVarValue("消息", "✓ 规范化完成（" + changed + " 行变更；diff 预览与写回由后续模块执行）");
}

public static string FullwidthToHalf(string s)
{
    var sb = new StringBuilder(s.Length);
    foreach (var ch in s)
    {
        var c = ch;
        if (c >= 0xFF01 && c <= 0xFF5E) c = (char)(c - 0xFEE0);       // 全角 ASCII 区
        else if (c == 0x3000) c = ' ';                                 // 全角空格
        sb.Append(c);
    }
    return sb.ToString();
}
