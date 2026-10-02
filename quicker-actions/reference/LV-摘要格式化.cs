//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// LV·摘要格式化 —— 打卡概览（checkin.summary 回执 data → 一行中文通知）
// 参考实现，Quicker C# 模块「普通模式v2」；对应 docs/05 §5.2 then.t=notify-summary
// data 形状（v0.5.6 契约）：{today:{range,startDate,endDate,items[],totalEvents,completedItems,scheduledItems},
//                          streaks:{itemId:连击天数}}
//
// 【模块设置】普通线程即可。
// 【输入变量】回挂数据(文本，checkin.summary 回执的 data JSON)
// 【输出变量】摘要文本(文本) —— 空数据时给出可读的占位文案，绝不显示原始 JSON
// 【说明】轻量字段提取（同 LV-取回执 的策略）：顶层 today/streaks 内的数字字段按名直取；
//         形状不符（上游未来改字段）时降级为计数占位，保证通知永远可读。
// ============================================================================

using System;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var data = context.GetVarValue("回挂数据") as string ?? "";
    var sb = new StringBuilder("打卡概览：");

    var done = GetIntField(data, "completedItems", -1);
    var scheduled = GetIntField(data, "scheduledItems", -1);
    var total = GetIntField(data, "totalEvents", -1);

    if (done >= 0 && scheduled >= 0)
    {
        sb.Append("今日 ").Append(done).Append("/").Append(scheduled);
        if (total >= 0) sb.Append("（记录 ").Append(total).Append(" 条）");
    }
    else if (total >= 0)
    {
        sb.Append("今日记录 ").Append(total).Append(" 条");
    }
    else
    {
        sb.Append("今日暂无数据（事项可能未安排或打卡数据未就绪）");
        context.SetVarValue("摘要文本", sb.ToString());
        return;
    }

    // 连击：取 streaks 里最大的前 1 个（v1 不做全列；需要全列时在面板里接列表模块）
    var streakId = ""; var streakMax = 0;
    var i = data.IndexOf("\"streaks\"", StringComparison.Ordinal);
    if (i >= 0)
    {
        var close = data.IndexOf('}', i);
        if (close > i)
        {
            var seg = data.Substring(i, close - i);
            var k = 0;
            while ((k = seg.IndexOf("\":", k + 1, StringComparison.Ordinal)) >= 0)
            {
                var startName = seg.LastIndexOf('"', k - 1);
                if (startName < 0) continue;
                var nameStart = seg.LastIndexOf('"', startName - 1);
                if (nameStart < 0) continue;
                var name = seg.Substring(nameStart + 1, startName - nameStart - 1);
                var v = GetIntField(seg, name, -1);
                if (v > streakMax) { streakMax = v; streakId = name; }
            }
        }
    }
    if (streakMax > 0) sb.Append(" · 最高连击 ").Append(streakMax).Append(" 天");

    context.SetVarValue("摘要文本", sb.ToString());
}

private static int GetIntField(string json, string field, int fallback)
{
    var key = "\"" + field + "\":";
    var i = json.IndexOf(key, StringComparison.Ordinal);
    if (i < 0) return fallback;
    i += key.Length;
    while (i < json.Length && (json[i] == ' ')) i++;
    var j = i;
    while (j < json.Length && (char.IsDigit(json[j]) || json[j] == '-')) j++;
    return j > i && int.TryParse(json.Substring(i, j - i), out var v) ? v : fallback;
}
