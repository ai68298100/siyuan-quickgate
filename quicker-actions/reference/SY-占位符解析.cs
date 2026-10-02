//.cs 文件类型，便于外部编辑时使用
// ============================================================================
// SY·占位符解析 —— 面板/动作载荷里的占位符统一替换（参考实现，Quicker C# 模块「普通模式v2」）
// 字典：docs/05 §5.1
//
// 【模块设置】普通/后台线程均可（无网络调用）。
// 【输入变量】文本模板(文本，含 {占位符} 的载荷模板)
//             其余变量按存在即用：选中文本 来源窗口 clipboard 选中标签 选中块ID 选中书签块ID
//             日记笔记本ID 收集箱文档ID ask值
// 【输出变量】解析结果(文本)
// 【范围声明（诚实边界）】
//   - {ask:提示语} 不在此解析——它是交互（userinput 模块），应在进入本模块前完成并把结果存 ask值。
//   - 不存在的变量按空串替换（例如非划词场景 {选中文本}→""）；字典外的 {…} 原样保留。
//   - {sql:前缀} AI 分支、多目标路由（#会议/@人名）属动作级逻辑，见 docs/03 §0，不在此层。
// ============================================================================

using System;
using System.Text;

public static void Exec(Quicker.Public.IStepContext context)
{
    var template = context.GetVarValue("文本模板") as string ?? "";
    var now = DateTime.Now;

    var sb = new StringBuilder(template);

    // 日期时间类（总是可解析）
    sb.Replace("{今天}", now.ToString("yyyy-MM-dd"))
      .Replace("{日期时间}", now.ToString("yyyy-MM-dd HH:mm"))
      .Replace("{时间}", now.ToString("HH:mm"));

    // 变量类：变量存在（非空）才替换；不存在则替换为空串（非划词场景语义）
    ReplaceVar(sb, context, "{选中文本}", "选中文本");
    ReplaceVar(sb, context, "{来源窗口}", "来源窗口");
    ReplaceVar(sb, context, "{clipboard}", "clipboard");
    ReplaceVar(sb, context, "{选中标签}", "选中标签");
    ReplaceVar(sb, context, "{选中块ID}", "选中块ID");
    ReplaceVar(sb, context, "{选中书签块ID}", "选中书签块ID");
    ReplaceVar(sb, context, "{ask值}", "ask值");
    ReplaceVar(sb, context, "{日记笔记本ID}", "日记笔记本ID");
    ReplaceVar(sb, context, "{收集箱文档ID}", "收集箱文档ID");

    context.SetVarValue("解析结果", sb.ToString());
}

private static void ReplaceVar(StringBuilder sb, Quicker.Public.IStepContext context, string placeholder, string varName)
{
    string value = null;
    try { value = context.GetVarValue(varName) as string; } catch { /* 变量未建：按空串 */ }
    sb.Replace(placeholder, value ?? "");
}
