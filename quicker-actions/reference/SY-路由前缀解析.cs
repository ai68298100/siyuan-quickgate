//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·路由前缀解析 —— 捕获多目标路由的解析层（参考实现，Quicker C# 模块「普通模式v2」）
// 规范：docs/03 §0「捕获多目标路由」（R3，v1 只做前缀路由不做正则）
//
// 【模块设置】普通/后台线程均可。
// 【输入变量】输入文本(文本，用户记的内容) 路由规则表(文本，每行一条：`#前缀=目标文档ID`；`@`=人脉规则)
//             默认文档ID(文本，通常=日记笔记本的今日日记由后续 appendDailyNoteBlock 决定，这里放收集箱或留空)
// 【输出变量】目标文档ID(文本；空=走默认) 剩余文本(文本，前缀剥离后) 人脉名单(文本，逗号分隔) 命中规则(文本，调试用)
// 【规则表示例】
//   #会议=20240101120000-abcdef
//   #周报=20240102130000-123456
//   @人脉
// 【语义】输入 " #会议 定了三件事" → 目标=会议文档ID、剩余文本="定了三件事"；
//         输入 "@张三 李四 午饭聊AI" → 人脉名单="张三,李四"、剩余文本="午饭聊AI"（@规则只开开关，人名取 @ 后到行尾的全部词）。
// ============================================================================

using System;
using System.Collections.Generic;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var input = context.GetVarValue("输入文本") as string ?? "";
    var rules = context.GetVarValue("路由规则表") as string ?? "";
    var defaultDoc = context.GetVarValue("默认文档ID") as string ?? "";

    var trimmed = input.TrimStart();
    var target = "";
    var hit = "";
    var rest = trimmed;

    // 1) 前缀规则（#xxx=目标文档ID）：取最长匹配前缀
    if (trimmed.StartsWith("#"))
    {
        var spaceIdx = trimmed.IndexOf(' ');
        var token = spaceIdx < 0 ? trimmed : trimmed.Substring(0, spaceIdx);   // 如 "#会议"
        foreach (var rawLine in rules.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || !line.StartsWith("#") || !line.Contains("=")) continue;
            var eq = line.IndexOf('=');
            var prefix = line.Substring(0, eq).Trim();          // "#会议"
            var docId = line.Substring(eq + 1).Trim();          // 文档ID
            if (token == prefix && docId.Length > 0)
            {
                target = docId;
                hit = prefix;
                rest = spaceIdx < 0 ? "" : trimmed.Substring(spaceIdx + 1).Trim();
                break;
            }
        }
    }

    // 2) @人脉规则：命中 @ 开头时提取人名（到行尾），前缀本身剥离
    var names = new List<string>();
    if (rest.StartsWith("@"))
    {
        var hitAt = false;
        foreach (var rawLine in rules.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (line == "@人脉") { hitAt = true; break; }
        }
        if (hitAt)
        {
            hit = hit.Length > 0 ? hit + "+@" : "@";
            var body = rest.Substring(1).Trim();                // "@张三 李四 午饭" → "张三 李四 午饭"
            var parts = body.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            // v1 约定：@ 后的词自首个中文字符起；英文场景按"前两段为人名、其余为正文"过于武断——
            // 简化规则：人名=前 N 个词，N 为规则行 "@人脉" 后可选括号里的数字（如 "@人脉(2)"），缺省 1
            var n = 1;
            var rp = rules.IndexOf("@人脉(", StringComparison.Ordinal);
            if (rp >= 0)
            {
                var close = rules.IndexOf(')', rp);
                var num = rules.Substring(rp + "@人脉(".Length, Math.Max(0, close - (rp + "@人脉(".Length)));
                int.TryParse(num.Trim(), out n);
            }
            n = Math.Max(1, Math.Min(n, 10));
            var textParts = new List<string>(parts);
            for (var i = 0; i < n && textParts.Count > 0; i++)
            {
                names.Add(textParts[0]);
                textParts.RemoveAt(0);
            }
            rest = string.Join(" ", textParts);
        }
    }

    context.SetVarValue("目标文档ID", target.Length > 0 ? target : defaultDoc);
    context.SetVarValue("剩余文本", rest);
    context.SetVarValue("人脉名单", string.Join(",", names));
    context.SetVarValue("命中规则", hit);
}
