/**
 * 插件运行时版本的唯一来源。
 * 发布前由 scripts/update_version.js 与 plugin.json/package.json 一起更新，
 * 避免设置页、诊断包和入口各自维护版本常量而出现漂移。
 */
export const PLUGIN_VERSION = "0.8.4";
