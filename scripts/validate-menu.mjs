import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = resolve(process.cwd(), process.argv[2] ?? "templates/superpanel-menu.json");
const allowedTypes = new Set(["http", "url", "sql-url", "bridge", "cmd", "act"]);
const profiles = new Set(["all", "global", "siyuan"]);
const gates = new Set(["quickgate", "quickgate-or-bridge", "checkin", "contacts"]);

const fail = (message) => {
  throw new Error(`${file}: ${message}`);
};

const menu = JSON.parse(await readFile(file, "utf8"));
if (!Number.isInteger(menu.version) || menu.version < 1) fail("version must be a positive integer (v2: R11 分拣收集箱/打卡概览)");
if (!Array.isArray(menu.groups) || menu.groups.length === 0) fail("groups must be a non-empty array");

let itemCount = 0;
for (const [groupIndex, group] of menu.groups.entries()) {
  if (!group || typeof group !== "object") fail(`groups[${groupIndex}] must be an object`);
  if (typeof group.label !== "string" || !group.label.trim()) fail(`groups[${groupIndex}].label is required`);
  if (group.profile !== undefined && !profiles.has(group.profile)) {
    fail(`groups[${groupIndex}].profile must be all, global, or siyuan`);
  }
  if (group.gate !== undefined && !gates.has(group.gate)) {
    fail(`groups[${groupIndex}].gate must be one of: ${[...gates].join(", ")}`);
  }
  if (!Array.isArray(group.items)) fail(`groups[${groupIndex}].items must be an array`);

  for (const [itemIndex, item] of group.items.entries()) {
    itemCount += 1;
    if (!item || typeof item !== "object") fail(`groups[${groupIndex}].items[${itemIndex}] must be an object`);
    if (typeof item.label !== "string" || !item.label.trim()) fail(`groups[${groupIndex}].items[${itemIndex}].label is required`);
    if (item.gate !== undefined && !gates.has(item.gate)) {
      fail(`groups[${groupIndex}].items[${itemIndex}].gate must be one of: ${[...gates].join(", ")}`);
    }
    if (!allowedTypes.has(item.t)) fail(`groups[${groupIndex}].items[${itemIndex}].t is invalid`);
    if (item.t !== "http" && item.t !== "url" && item.t !== "sql-url" && item.t !== "act" && item.v === undefined) {
      fail(`groups[${groupIndex}].items[${itemIndex}].v is required for ${item.t}`);
    }
    if (item.then !== undefined && (!item.then || typeof item.then !== "object" || typeof item.then.t !== "string" || item.then.v === undefined)) {
      fail(`groups[${groupIndex}].items[${itemIndex}].then must use {t,v}`);
    }
    if (item.t === "bridge" && (!item.v || typeof item.v.plugin !== "string" || typeof item.v.op !== "string")) {
      fail(`groups[${groupIndex}].items[${itemIndex}] bridge needs v.plugin and v.op`);
    }
  }
}

console.log(`OK ${file}: ${menu.groups.length} groups, ${itemCount} items`);
