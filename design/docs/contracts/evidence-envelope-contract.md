# C2 证据信封合同（Context & Evidence Envelope · §18.2 R124-G1 · v0 草案）

> 目的：为"结论/数据/草稿"携带来源、版本与截断信息定义统一信封；验收 = 缺源可显式表达、截断可见、敏感等级可判。
> 状态：v0 草案——当前实现只有零散对应物（planned 为主），本合同先定目标形状约束后续实现（R126-G3 只读优先门的前置）。

## 1. 信封形状（目标）

```json
{
  "kind": "answer|draft|query-result",
  "claims": [{ "text": "…", "evidence": "E1|E2|E4|unknown", "sources": [{ "type": "block|doc|external", "id": "…", "version": "…" }] }],
  "truncated": { "input": false, "output": false, "limit": null },
  "sensitivity": "local-only|contains-personal|contains-external",
  "generatedBy": { "entry": "mcp|quicker|panel", "model": null | "provider/model", "promptVersion": "…" }
}
```

## 2. 规则

1. **缺源显式**：无来源的断言 `evidence:"unknown"`，消费方（UI/AI 模板）必须原样呈现"未核实"，禁止措辞美化（对齐 R114-P0 事实边界）。
2. **截断可见**：输入被截断（selectedText 2000 上限等）或输出被截断时 `truncated` 必须置位——"看起来完整"比截断本身更危险。
3. **敏感等级**：local-only（不出本机）→ contains-personal（出模型需同意，R126-G3 同意与删除）→ contains-external（已外发，需留痕）。当前 MCP 只读工具输出默认 local-only。
4. **版本绑定**：模型/prompt/工具 schema 版本入信封——旧会话可解释当时上下文（R126-G3 AI 版本漂移的前置）。

## 3. 现有对应物（部分）

| 现有 | 覆盖 | 缺口 |
|---|---|---|
| 事件流 idempotencyKey | 幂等/配对 | 无来源/敏感字段 |
| events.pull | 引用原行 | 无 envelope 包装 |
| 审计日志 | 入口/时间/状态 | 无 claims 级来源 |
| editor.context selectedText 2000 截断 | 截断事实存在 | 未对消费方声明 |

## 4. 落地顺序（绑定 R126 门）

只读 AI 闭环（R126-G3 首个门）实现时**必须**以本信封承载输出；在那之前本合同仅约束设计，不要求改造既有 op。
