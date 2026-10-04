/**
 * 命令搜索别名映射（TODO L471 · R76）——中英文/拼音/关键词别名，命中=关键词或任一别名匹配。
 * 裁剪声明：不做全量拼音引擎（依赖重、收益薄），以高频词别名表覆盖「打卡/daka/checkin」「摘录/捕获/capture」式跨语言命中；
 * 键与小写化后比对。raw op 本就不进命令注册表（registry=宿主插件命令），自然只在高级诊断（diagnostics）面出现。
 * 扩表纪律：新别名须对应真实宿主命令词（title/id/plugin 域），不凭想象扩表。
 */
export const SEARCH_ALIASES: Record<string, string[]> = {
    // 打卡域
    "打卡": ["checkin", "check-in", "daka"],
    "daka": ["打卡", "checkin", "check-in"],
    "checkin": ["打卡", "check-in", "daka"],
    "check-in": ["打卡", "checkin"],
    // 摘录/捕获域（拾遗 glean / 划词捕获）
    "摘录": ["capture", "glean", "zhailu"],
    "捕获": ["capture", "glean"],
    "capture": ["摘录", "捕获", "glean"],
    "glean": ["摘录", "拾遗"],
    "拾遗": ["glean", "摘录"],
    // 人脉域
    "人脉": ["contacts", "renmai", "lvcontacts"],
    "renmai": ["人脉", "contacts"],
    "contacts": ["人脉"],
    // 闪卡/复习域
    "闪卡": ["flashcard", "review", "lv-cards", "lvcards"],
    "复习": ["review", "flashcard"],
    "review": ["复习", "闪卡", "flashcard"],
    "flashcard": ["闪卡", "复习"],
    // 导航/搜索域（雷切）
    "导航": ["navigation", "navigate", "daohang"],
    "搜索": ["search"],
    "search": ["搜索"],
    // 考试域
    "考试": ["exam", "kaoshi"],
    "exam": ["考试"],
};

/** 展开搜索词：[原词, ...别名]（全部小写；调用方对 title/id/plugin 逐一 includes） */
export function expandSearchKeyword(kw: string): string[] {
    const lower = kw.toLowerCase();
    const aliases = SEARCH_ALIASES[lower] ?? [];
    return [lower, ...aliases.map((a) => a.toLowerCase())];
}
