# Lv QuickGate (小驴快门)

[中文文档](./README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-0.7.0-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**Lv QuickGate** is the hub of the Lv plugin ecosystem and its external gateway for [SiYuan Note](https://b3log.org/siyuan). It lets outside clients (Quicker, iOS Shortcuts, CLI, PowerShell, AI assistants, HA scripts…) and sibling plugins share one public contract (23 ops):

- `commands.*` — discover / search / run command-palette entries of any installed plugin (confirm-gated, audited)
- `checkin.*` / `contacts.*` — structured pass-through to the public bridges of Lv Check-in (API v5) and Lv Contacts (bridge v1)
- `registry.list` / `diagnostics.report` / `config.discover` — Lv ecosystem manifest (7 plugins, maturity × installed version), sanitized diagnostics, daily-note notebook auto-discovery
- `events.list` / `events.pull` — whitelisted event stream (check-in record/deletion auto-materialized; deletions as `:deleted`-suffixed markers coexisting with originals)
- `workflow.plan` / `workflow.execute` — controlled orchestration (≤8 steps, op whitelist, 30s total confirm, stop-on-failure)
- `template.new` / `doc.open` / `daily.status` / `editor.context` / `setting.open` — doc-from-template, controlled navigation, editor context
- `plugin.api` — raw bridge pass-through (off by default + allowlist + manifest-driven window-bridge mapping)

**Three channels** (all speaking the same envelope, sharing one idempotency ledger):

| Channel | Latency | Coverage | Notes |
|---|---|---|---|
| NDJSON bridge (default) | ~750ms @ 500ms poll | all ops | async; files under `data/storage/petal/<plugin>/bridge/` |
| Kernel sync route (v0.5.0) | ~100ms | kernel-capable subset (7 ops) | `POST /plugin/private/siyuan-quickgate/exec`; works with the bridge switch off |
| Broadcast fast path (v1.5, v0.6.0) | ~10–100ms | all frontend ops | SSE on `qg-cmd` channel; off by default; reservation semantics against dual-channel replays |

> **Marketplace status: deferred.** Install manually from GitHub Releases (import `package.zip` via SiYuan → Marketplace → Downloads → Install from package). This repo is the single distribution channel for now.

## Install (manual)

1. Download `package.zip` from the [latest release](https://github.com/ai68298100/siyuan-quickgate/releases/latest).
2. SiYuan → Settings → Marketplace → Downloads → top-right menu → *Install from package* → pick the zip.
3. Enable the plugin, open its settings, switch **External command bridge** on (default off by design).

## Protocol

One NDJSON file set per plugin under `data/storage/petal/<plugin>/bridge/`:

```
commands.ndjson   # client → plugin, one JSON envelope per line
results.ndjson    # plugin → client, rolling window of 200 receipts
events.ndjson     # public host-event stream (materialized by QuickGate on behalf of Check-in: records + deletion markers)
```

Envelope: `{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}` — receipts echo `id` with `status ∈ recorded|duplicate|rejected|failed|unsupported|expired`. Full contract: [docs/api.md](./docs/api.md) · machine-readable: [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json) (the op face is enforced against `src/ops.ts` by a consistency test).

Clients included in [`tools/`](./tools): zero-dependency node CLI (`ping/send/run/events/exec/fast`) and a PowerShell script (`-Exec` kernel route, `-Fast` broadcast). Quicker subprograms use the same envelope.

### MCP for AI assistants

[`src/mcp/`](./src/mcp) exposes all 23 ops as MCP tools over stdio — AI clients can run SiYuan commands, log check-ins, record contacts interactions and execute controlled workflows, a surface no built-in MCP server covers (see [docs/10 §3.14](../../../AI/思源笔记插件开发/quicksrer%20动作/docs/10-生态调研-R1.md) in the project docs for the rationale).

- **13 read-only tools by default**; write tools stay hidden until `LV_MCP_WRITE=1` (calls to hidden tools are honestly refused)
- `plugin.api` / `workflow.execute` additionally carry the `destructiveHint` annotation
- All QuickGate-side defenses still apply: confirm dialogs, blacklist, audit log, plugin.api allowlist

```json
{ "mcpServers": { "lv-quickgate": {
    "command": "node",
    "args": ["<repo>/src/mcp/main.ts"],
    "env": { "SIYUAN_TOKEN": "<token>" }
} } }
```

## Safety

- Bridge is **off by default**; `commands.run` shows a confirm dialog (30s timeout = deny) and everything is audited.
- `plugin.api` raw pass-through is off by default with an allowlist (window-bridge mapping comes from the ecosystem manifest, not hard-coded).
- The hub only consumes publicly registered capabilities and public bridge methods. It never reads other plugins' private storage.
- The event stream is append-only; deletions are marker rows paired by idempotency key. High-frequency heartbeat events (analytics-updated) are explicitly excluded from materialization (D-0011).

## Status & roadmap

**v0.1.0** bridge core + adapters + settings + unit tests → **v0.2.0** ecosystem hub (manifest/registry/diagnostics) → **v0.3.0** reliability hardening (template.new, 15s cap, device name, diag package) → **v0.4.x** events/workflow + check-in host-event bridging → **v0.5.x** experimental kernel sync route, event-subscription channel fix (window CustomEvent), observability stats, manifest calibrated against remote mains, event-deleted materialization → **v0.6.x** deployed live on a real workspace (3.8.5) and enabled: config.discover calibrated against the live kernel (dailyNoteSavePath camelCase + non-default-template-first), v1.5 broadcast fast path (SSE millisecond-level command channel, default off, reservation semantics against dual-channel replays), frontend assumptions statically verified against the installed app bundle (editor.context docId fix, registry customHotkey effective key).

Kernel-runtime verification (M0 spike ①–⑪) is tracked in [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md); roadmap in [docs/ROADMAP.md](./docs/ROADMAP.md); decision log in [docs/DECISIONS.md](./docs/DECISIONS.md) (D-0001–D-0015).

## Development

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm accept  # acceptance gate: unit tests (98) + MCP protocol smoke (6)
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # symlink into your workspace for dev
```

After restarting SiYuan with the plugin deployed, run `npm run verify:restart` (add `SIYUAN_LOG=<workspace>/temp/siyuan.log` for the log-growth readout) — it produces the full acceptance dataset: bridge e2e latency, kernel-route ops, event materialization counts, broadcast liveness, v1.5 fast-path latency, MCP kernel-route, kernel log growth.

License: [MIT](./LICENSE) · Author: [@ai68298100](https://github.com/ai68298100)
