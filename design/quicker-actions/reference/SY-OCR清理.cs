//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·OCR清理 —— OCR 结果后处理：去除汉字之间被误插的空格/换行（参考实现，Quicker C# 模块「普通模式v2」）
// 场景：P0-5 剪贴板图片入库 OCR alt、划词 OCR 摘录（docs/03 P0-5）
// @version 1.0.0 · 2026-10-03 首版
//
// 【模块设置】普通/后台线程均可；纯文本处理零网络依赖。
// 【输入变量】输入文本(文本，OCR 原始输出) 保留段落(文本，"true"=换行视作段落边界保留，默认 true)
// 【输出变量】清理结果(文本) 是否成功(布尔)
// 【规则】两个 CJK 字符之间的空格/软换行删除；CJK 与西文/数字之间的空格保留一个；
//         保留段落=true 时「整行换行」保留为\n，行尾软换行（行非空且下一行非空且行尾无标点）视作 OCR 断行删除。
// ============================================================================
using System;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var input = context.GetVarValue("输入文本") as string ?? "";
    var keepParaRaw = (context.GetVarValue("保留段落") as string ?? "true").Trim();
    var keepPara = keepParaRaw != "false" && keepParaRaw != "0";

    context.SetVarValue("清理结果", CleanOcr(input, keepPara));
    context.SetVarValue("是否成功", true);
}

public static string CleanOcr(string text, bool keepPara)
{
    if (string.IsNullOrEmpty(text)) return "";
    var lines = text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
    var sb = new StringBuilder();
    for (var i = 0; i < lines.Length; i++)
    {
        var line = lines[i];
        var sbLine = new StringBuilder(line.Length);
        for (var j = 0; j < line.Length; j++)
        {
            var ch = line[j];
            if ((ch == ' ' || ch == '\u00a0' || ch == '\u3000') && j > 0 && j < line.Length - 1
                && IsCjk(line[j - 1]) && IsCjk(line[j + 1]))
                continue; // 汉字间空格：删
            sbLine.Append(ch);
        }
        var cleaned = sbLine.ToString().Trim();
        if (cleaned.Length == 0) { sb.AppendLine(); continue; }

        sb.Append(cleaned);
        var hasNext = i < lines.Length - 1 && lines[i + 1].Trim().Length > 0;
        if (hasNext)
        {
            var endsSentence = cleaned.Length > 0 && "。！？；：.!?;:".IndexOf(cleaned[cleaned.Length - 1]) >= 0;
            if (keepPara && endsSentence) sb.AppendLine();      // 句号断行=段落
            else sb.Append(IsCjk(cleaned[cleaned.Length - 1]) && IsCjk(lines[i + 1].Trim()[0]) ? "" : " "); // 断行缝合
        }
        else sb.AppendLine();
    }
    return sb.ToString().TrimEnd();
}

public static bool IsCjk(char c)
{
    return (c >= 0x4E00 && c <= 0x9FFF)   // CJK 基本区
        || (c >= 0x3400 && c <= 0x4DBF)   // 扩展 A
        || (c >= 0xF900 && c <= 0xFAFF);  // 兼容表意
}
