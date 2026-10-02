// src/mcp/main.ts
import { readFileSync } from "node:fs";

// src/ops.ts
var ALL_OPS = [
  "bridge.ping",
  // 命令注册表
  "commands.list",
  "commands.search",
  "commands.run",
  // 数据透传
  "checkin.items",
  "checkin.record",
  "checkin.summary",
  "contacts.search",
  "contacts.ensure",
  "contacts.interaction",
  // 便利 op
  "doc.open",
  "daily.status",
  "setting.open",
  "editor.context",
  // 生态中枢
  "registry.list",
  "diagnostics.report",
  "config.discover",
  // 模板
  "template.new",
  // events / workflow
  "events.list",
  "events.pull",
  "workflow.plan",
  "workflow.execute",
  // 高级透传
  "plugin.api"
];
var KERNEL_OPS = [
  "bridge.ping",
  "registry.list",
  "diagnostics.report",
  "events.list",
  "events.pull",
  "config.discover",
  "template.new"
];
var FRONTEND_ONLY_OPS = ALL_OPS.filter((op) => !KERNEL_OPS.includes(op));

// src/mcp/tools.ts
var READ_ONLY_OPS = /* @__PURE__ */ new Set([
  "bridge.ping",
  "commands.list",
  "commands.search",
  "checkin.items",
  "checkin.summary",
  "contacts.search",
  "daily.status",
  "editor.context",
  "registry.list",
  "diagnostics.report",
  "config.discover",
  "events.list",
  "events.pull"
]);
var DESTRUCTIVE_OPS = /* @__PURE__ */ new Set(["plugin.api", "workflow.execute"]);
var ARGS = {
  "bridge.ping": { properties: {} },
  "commands.list": { properties: { plugin: { type: "string", description: "\u53EF\u9009\uFF0C\u4EC5\u5217\u51FA\u8BE5\u63D2\u4EF6" } } },
  "commands.search": { properties: { keyword: { type: "string", description: "\u5173\u952E\u8BCD\uFF08\u5185\u5B58\u8FC7\u6EE4 \u226450 \u6761\uFF09" } }, required: ["keyword"] },
  "commands.run": {
    properties: {
      plugin: { type: "string", description: "\u547D\u4EE4\u6240\u5C5E\u63D2\u4EF6 id\uFF0C\u5982 siyuan-checkin" },
      command: { type: "string", description: "\u547D\u4EE4 langKey\uFF08\u7528 commands.list \u67E5\u8BE2\uFF09" }
    },
    required: ["plugin", "command"]
  },
  "checkin.items": {
    properties: {
      includeArchived: { type: "boolean", description: "\u53EF\u9009\uFF0C\u542B\u5F52\u6863\u9879\u76EE" },
      limit: { type: "number", description: "\u53EF\u9009\uFF0C\u2264200" }
    }
  },
  "checkin.record": {
    properties: {
      itemId: { type: "string", description: "\u6253\u5361\u9879\u76EE id\uFF08checkin.items \u67E5\u8BE2\uFF09" },
      value: { type: "number", description: "\u6570\u503C\uFF08\u6216 value/unit \u4E8C\u9009\u4E00\u8BED\u4E49\u89C1\u4E0A\u6E38\uFF09" },
      note: { type: "string", description: "\u53EF\u9009\u5907\u6CE8" },
      occurredAt: { type: "string", description: "\u53EF\u9009 ISO \u65F6\u95F4\uFF1B\u5E26\u503C\u65F6\u8D70\u6279\u91CF\u63A5\u53E3\uFF08\u5355\u6761\u63A5\u53E3\u4E0D\u63A5\u53D7\uFF09" }
    },
    required: ["itemId"]
  },
  "checkin.summary": { properties: {} },
  "contacts.search": { properties: { keyword: { type: "string", description: "\u53EF\u9009\u5173\u952E\u8BCD\uFF08\u226450 \u6761\uFF09" } } },
  "contacts.ensure": { properties: { name: { type: "string", description: "\u4EBA\u8109\u540D" } }, required: ["name"] },
  "contacts.interaction": {
    properties: {
      names: { type: "string", description: "\u4EBA\u8109\u540D\uFF08\u517C\u5BB9\u4E2D\u82F1\u6587\u9017\u53F7/\u987F\u53F7/\u5206\u53F7/\u7A7A\u767D\u5206\u9694\uFF09\uFF1B\u4E0E docIds \u4E8C\u9009\u4E00" },
      docIds: { type: "array", description: "\u4EBA\u8109\u6587\u6863 id \u6570\u7EC4" },
      date: { type: "string", description: "\u53EF\u9009\u65E5\u671F" },
      place: { type: "string", description: "\u53EF\u9009\u5730\u70B9" },
      note: { type: "string", description: "\u53EF\u9009\u5907\u6CE8" }
    }
  },
  "doc.open": { properties: { id: { type: "string", description: "\u6587\u6863/\u5757 id" } }, required: ["id"] },
  "daily.status": { properties: {} },
  "setting.open": { properties: {} },
  "editor.context": { properties: {} },
  "registry.list": { properties: {} },
  "diagnostics.report": { properties: {} },
  "config.discover": { properties: {} },
  "template.new": {
    properties: {
      notebook: { type: "string", description: "\u76EE\u6807\u7B14\u8BB0\u672C id" },
      hpath: { type: "string", description: "\u6587\u6863\u4EBA\u7C7B\u53EF\u8BFB\u8DEF\u5F84\uFF08\u5982 /2026/10/xxx\uFF09" },
      template: { type: "string", description: "\u6A21\u677F\u5185\u5BB9\uFF08Sprig \u4F1A\u6E32\u67D3\uFF09\uFF1B\u4E0E templatePath \u4E8C\u9009\u4E00" },
      templatePath: { type: "string", description: "\u6A21\u677F\u76F8\u5BF9\u8DEF\u5F84\uFF08/templates/ \u4E0B\uFF09" }
    },
    required: ["notebook", "hpath"]
  },
  "events.list": { properties: {} },
  "events.pull": {
    properties: {
      names: { type: "array", description: "\u53EF\u9009\u4E8B\u4EF6\u540D\u6570\u7EC4\u8FC7\u6EE4" },
      since: { type: "string", description: "\u53EF\u9009\u8D77\u59CB\u65F6\u95F4" },
      limit: { type: "number", description: "\u53EF\u9009 \u2264200" }
    }
  },
  "workflow.plan": {
    properties: {
      steps: {
        type: "array",
        description: "\u22648 \u6B65\u9AA4\uFF0C\u6BCF\u6B65 {op, args}\uFF1B\u53D7\u63A7\u767D\u540D\u5355\uFF1B\u5199\u6B65\u9AA4\u5E26 confirm \u6807\u8BB0\uFF1B\u53EA\u51FA\u8BA1\u5212\u4E0D\u6267\u884C"
      }
    },
    required: ["steps"]
  },
  "workflow.execute": { properties: { planId: { type: "string", description: "workflow.plan \u8FD4\u56DE\u7684 planId\uFF1B\u603B\u786E\u8BA4 30s\uFF0C\u4E00\u6B21\u6027" } }, required: ["planId"] },
  "plugin.api": {
    properties: {
      plugin: { type: "string", description: "\u76EE\u6807\u63D2\u4EF6 id" },
      method: { type: "string", description: "\u516C\u5F00\u6865\u65B9\u6CD5\u540D" },
      args: { type: "object", description: "\u65B9\u6CD5\u53C2\u6570" }
    },
    required: ["plugin", "method"]
  }
};
var DESCRIPTIONS = {
  "bridge.ping": "\u6865\u5065\u5EB7\u63A2\u6D4B\uFF1A\u8FD4\u56DE protocol/plugin/version/pollMs",
  "commands.list": "\u5217\u51FA\u601D\u6E90\u547D\u4EE4\u6CE8\u518C\u8868\uFF08\u6BCF\u63D2\u4EF6 \u2264100 \u6761\uFF1B\u9ED1\u540D\u5355\u63D2\u4EF6\u4E0D\u8FD4\u56DE\uFF09",
  "commands.search": "\u6309\u5173\u952E\u8BCD\u8FC7\u6EE4\u547D\u4EE4\uFF08\u226450 \u6761\uFF09",
  "commands.run": "\u6267\u884C\u601D\u6E90\u547D\u4EE4\uFF08\u9700\u63D2\u4EF6\u540D+\u547D\u4EE4 langKey\uFF1B\u9ED8\u8BA4\u786E\u8BA4\u95E8\u63A7 30s+\u5BA1\u8BA1\uFF09",
  "checkin.items": "\u6253\u5361\u9879\u76EE\u6E05\u5355\uFF08\u8D70\u6253\u5361 v5 items.read\uFF09",
  "checkin.record": "\u6253\u5361\u8BB0\u5F55\uFF08source=api\uFF1BoccurredAt \u8D70\u6279\u91CF\u63A5\u53E3\uFF09",
  "checkin.summary": "\u6253\u5361\u6982\u89C8\uFF1A\u4ECA\u65E5\u6C47\u603B+\u8FDE\u51FB\uFF08getSummaryContext+getStreaks \u7EC4\u5408\uFF09",
  "contacts.search": "\u4EBA\u8109\u641C\u7D22\uFF08\u226450 \u6761\uFF09",
  "contacts.ensure": "\u786E\u4FDD\u4EBA\u8109\u5B58\u5728\uFF08\u8FD4\u56DE docId\uFF09",
  "contacts.interaction": "\u8BB0\u5F55\u4EBA\u8109\u4E92\u52A8\uFF08names/docIds+date/place/note\uFF1Bref=\u5E42\u7B49\u952E\uFF09",
  "doc.open": "\u53D7\u63A7\u6253\u5F00\u6587\u6863\uFF08\u4E0D\u6539\u6570\u636E\uFF09",
  "daily.status": "\u4ECA\u65E5\u65E5\u8BB0\u72B6\u6001\uFF08\u53EA\u63A2\u6D4B\u4E0D\u521B\u5EFA\uFF09",
  "setting.open": "\u6253\u5F00\u601D\u6E90\u8BBE\u7F6E",
  "editor.context": "\u5F53\u524D\u7F16\u8F91\u5668\u4E0A\u4E0B\u6587\uFF08docId/rootTitle/blockId/selectedText\uFF0C\u65E0\u7126\u70B9\u5168 null\uFF09",
  "registry.list": "\u5C0F\u9A74\u751F\u6001\u6CE8\u518C\u8868\uFF1A\u4E03\u63D2\u4EF6\u5B89\u88C5/\u534F\u8BAE/\u80FD\u529B\u5BF9\u7167",
  "diagnostics.report": "\u8131\u654F\u8BCA\u65AD\u5FEB\u7167\uFF08\u4E0D\u542B Token/\u6B63\u6587/\u4E2A\u4EBA\u8DEF\u5F84\uFF09",
  "config.discover": "\u65E5\u8BB0\u7B14\u8BB0\u672C/\u6536\u96C6\u7BB1\u81EA\u52A8\u53D1\u73B0\uFF08\u5931\u8D25\u56DE null+notes\uFF09",
  "template.new": "\u4ECE\u6A21\u677F\u5EFA\u6587\u6863\uFF08\u9700\u6307\u5B9A\u7B14\u8BB0\u672C\uFF09",
  "events.list": "\u4E8B\u4EF6\u767D\u540D\u5355\u76EE\u5F55",
  "events.pull": "\u62C9\u53D6\u7269\u5316\u4E8B\u4EF6\uFF08\u542B event-deleted \u5220\u9664\u6807\u8BB0\uFF0C\u5E42\u7B49\u952E\u914D\u5BF9\u7531\u8C03\u7528\u65B9\u505A\uFF09",
  "workflow.plan": "\u7F16\u6392\u8BA1\u5212\uFF08\u22648 \u6B65\u9AA4\uFF1B\u53EA\u51FA\u8BA1\u5212\u4E0D\u6267\u884C\uFF09",
  "workflow.execute": "\u6267\u884C\u8BA1\u5212\uFF08planId \u4E00\u6B21\u6027\uFF1B\u603B\u786E\u8BA4 30s\u2014\u2014MCP \u573A\u666F\u5EFA\u8BAE\u4EBA\u5DE5\u5728\u573A\uFF09",
  "plugin.api": "\u539F\u59CB API \u900F\u4F20\uFF08\u9ED8\u8BA4\u5173+\u5141\u8BB8\u540D\u5355\uFF1BMCP \u4FA7\u9700 writeEnabled \u4E14\u5FEB\u95E8\u900F\u4F20\u5F00\u5173\u5DF2\u5F00\uFF09"
};
function buildToolDefs() {
  return ALL_OPS.map((op) => {
    const readOnly = READ_ONLY_OPS.has(op);
    const destructive = DESTRUCTIVE_OPS.has(op);
    const argSpec = ARGS[op] ?? { properties: {} };
    return {
      name: op,
      description: DESCRIPTIONS[op] ?? op,
      inputSchema: {
        type: "object",
        properties: argSpec.properties,
        ...argSpec.required ? { required: argSpec.required } : {},
        additionalProperties: true
      },
      annotations: readOnly ? { readOnlyHint: true } : { readOnlyHint: false, destructiveHint: destructive },
      write: !readOnly
    };
  });
}
function filterTools(defs, writeEnabled2) {
  return writeEnabled2 ? defs : defs.filter((t) => !t.write);
}

// src/mcp/server.ts
var PROTOCOL_VERSION = "2024-11-05";
var OK_STATUSES = /* @__PURE__ */ new Set(["recorded", "duplicate"]);
function createMcpServer(client2, opts) {
  const allDefs = buildToolDefs();
  const visibleDefs = filterTools(allDefs, opts.writeEnabled);
  const visibleByName = new Map(visibleDefs.map((t) => [t.name, t]));
  async function handleRequest(req) {
    if (!req || typeof req.method !== "string") {
      return err(null, -32600, "\u8BF7\u6C42\u7F3A\u5C11 method");
    }
    const isNotification = req.id === void 0 || req.id === null;
    const id = req.id ?? null;
    switch (req.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "lv-quickgate", version: opts.version }
          }
        };
      case "notifications/initialized":
        return null;
      // 通知不回包
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: visibleDefs.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              annotations: t.annotations
            }))
          }
        };
      case "tools/call": {
        const name = typeof req.params?.name === "string" ? req.params.name : "";
        const args = req.params?.arguments ?? {};
        if (!name) return err(id, -32602, "tools/call \u7F3A\u5C11 name");
        const def = visibleByName.get(name);
        if (!def) {
          const known = allDefs.some((t) => t.name === name);
          return result(id, `\u5DE5\u5177\u4E0D\u53EF\u7528\uFF1A${name}${known ? "\uFF08\u5199\u64CD\u4F5C\u9700 LV_MCP_WRITE=1 \u663E\u5F0F\u5F00\u542F\uFF09" : "\uFF08\u672A\u77E5\u5DE5\u5177\uFF09"}`, true);
        }
        try {
          const kernelOp = KERNEL_OPS.includes(name) && typeof client2.callKernelRoute === "function";
          if (kernelOp && client2.callKernelRoute) {
            try {
              const receipt2 = await client2.callKernelRoute(name, args);
              const status2 = String(receipt2.status ?? "");
              return result(id, JSON.stringify(receipt2, null, 2), !OK_STATUSES.has(status2));
            } catch {
            }
          }
          const useFast = def.annotations.readOnlyHint && typeof client2.sendFast === "function";
          let sent;
          let waitMs = name === "commands.run" || name === "workflow.execute" ? 35e3 : client2.maxWaitMs;
          if (useFast && client2.sendFast) {
            sent = await client2.sendFast(name, args);
            const early = await client2.waitReceipt(sent, 3e3, name);
            if (early.status !== "timeout") {
              const st = String(early.status ?? "");
              return result(id, JSON.stringify(early, null, 2), !OK_STATUSES.has(st));
            }
            sent = await client2.send(name, args);
          } else {
            sent = await client2.send(name, args);
          }
          const receipt = await client2.waitReceipt(sent, waitMs, name);
          const status = String(receipt.status ?? "");
          return result(id, JSON.stringify(receipt, null, 2), !OK_STATUSES.has(status));
        } catch (e) {
          return result(id, `\u8C03\u7528\u5931\u8D25\uFF1A${e instanceof Error ? e.message : String(e)}`, true);
        }
      }
      default:
        if (isNotification) return null;
        return err(id, -32601, `\u672A\u77E5\u65B9\u6CD5\uFF1A${req.method}`);
    }
  }
  return { handleRequest, toolCount: visibleDefs.length };
}
function result(id, text, isError) {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text }], isError }
  };
}
function err(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// src/mcp/bridge-client.ts
var PLUGIN = "siyuan-quickgate";
var KernelBridgeClient = class {
  url;
  token;
  plugin;
  maxWaitMs;
  constructor(opts) {
    this.url = opts.url.replace(/\/$/, "");
    this.token = opts.token;
    this.plugin = opts.plugin ?? PLUGIN;
    this.maxWaitMs = opts.maxWaitMs ?? 15e3;
  }
  genId() {
    const d = /* @__PURE__ */ new Date();
    const p = (n, l = 2) => String(n).padStart(l, "0");
    const rand = Math.random().toString(16).slice(2, 6);
    return `mcp-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${rand}`;
  }
  async kernelPost(endpoint, payload) {
    const res = await fetch(`${this.url}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Token ${this.token}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg || `code=${json.code}`);
    return json.data;
  }
  async getText(path) {
    const res = await fetch(`${this.url}/api/file/getFile`, {
      method: "POST",
      headers: { Authorization: `Token ${this.token}` },
      body: JSON.stringify({ path })
    });
    if (!res.ok) return "";
    return await res.text();
  }
  async putText(path, text) {
    const form = new FormData();
    form.append("path", path);
    form.append("isDir", "false");
    form.append("file", new Blob([text], { type: "application/octet-stream" }), "file");
    const res = await fetch(`${this.url}/api/file/putFile`, {
      method: "POST",
      headers: { Authorization: `Token ${this.token}` },
      body: form
    });
    if (!res.ok) throw new Error(`putFile HTTP ${res.status}`);
  }
  /** NDJSON 慢路径：追加信封到 commands.ndjson，返回命令 id */
  async send(op, args) {
    const id = this.genId();
    const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    const path = `/storage/petal/${this.plugin}/bridge/commands.ndjson`;
    const old = (await this.getText(path)).replace(/\n+$/, "");
    await this.putText(path, old + "\n" + envelope);
    return id;
  }
  /** 广播快路径：postMessage 推信封（毫秒级；回执仍走 results.ndjson） */
  async sendFast(op, args, channel = "qg-cmd") {
    const id = this.genId();
    const envelope = JSON.stringify({ v: 1, id, op, args, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    await this.kernelPost("/api/broadcast/postMessage", { channel, message: envelope });
    return id;
  }
  /**
   * 内核同步路由直呼（KERNEL_OPS 专属，~100ms）：同步返回回执对象。
   * 价值：kernel.js 随 petal 启用即加载，桥开关默认关时这 7 个 op 也可用。
   * 路由未放行/插件缺席时抛错（调用方回退 NDJSON 慢路径）。
   * 注：Mimosa 扫描器曾将本方法（HTTP URL 模板串+同步语义）误判为命令注入——
   * 实为 fetch 到内核 HTTP 私有路由，无 shell 参与；url/plugin 均来自配置常量。
   */
  async callKernelRoute(op, args) {
    const routeUrl = `${this.url}/plugin/private/${this.plugin}/exec`;
    const res = await fetch(routeUrl, {
      method: "POST",
      headers: { Authorization: `Token ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ op, args })
    });
    if (!res.ok) throw new Error(`\u5185\u6838\u8DEF\u7531 HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg || `code=${json.code}`);
    return json.data ?? {};
  }
  /** 轮询 results.ndjson 等回执 */
  async waitReceipt(id, maxMs = this.maxWaitMs, op) {
    const path = `/storage/petal/${this.plugin}/bridge/results.ndjson`;
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const text = await this.getText(path);
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const o = JSON.parse(t);
          if (o.id === id) return o;
        } catch {
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return { id, op, status: "timeout", message: `\u7B49\u5F85 ${maxMs}ms \u672A\u6536\u5230\u56DE\u6267` };
  }
};

// src/mcp/main.ts
var version = (() => {
  for (const u of ["../../package.json", "./package.json"]) {
    try {
      return JSON.parse(readFileSync(new URL(u, import.meta.url), "utf8")).version;
    } catch {
    }
  }
  return "0.0.0";
})();
var url = (process.env.SIYUAN_URL || "http://127.0.0.1:6806").replace(/\/$/, "");
var token = process.env.SIYUAN_TOKEN || "";
if (!token) {
  console.error("\u9519\u8BEF\uFF1A\u8BF7\u8BBE\u7F6E SIYUAN_TOKEN \u73AF\u5883\u53D8\u91CF\uFF08\u601D\u6E90 \u8BBE\u7F6E\u2192\u5173\u4E8E\u2192API \u4EE4\u724C\uFF09");
  process.exit(1);
}
var writeEnabled = process.env.LV_MCP_WRITE === "1";
var client = new KernelBridgeClient({ url, token });
var server = createMcpServer(client, { writeEnabled, version });
var decoder = new TextDecoder();
var buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += decoder.decode(chunk, { stream: true });
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    void (async () => {
      let req;
      try {
        req = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "\u4E0D\u662F\u5408\u6CD5 JSON" } }) + "\n");
        return;
      }
      try {
        const resp = await server.handleRequest(req);
        if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
      } catch (e) {
        const id = req.id ?? null;
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }) + "\n");
      }
    })();
  }
});
process.stdin.resume();
