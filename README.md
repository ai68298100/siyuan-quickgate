# Lv QuickGate (小驴快门)

[中文文档](./README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-0.6.4-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**Lv QuickGate** is the hub of the Lv plugin ecosystem and its external gateway for [SiYuan Note](https://b3log.org/siyuan). It lets outside clients (Quicker, iOS Shortcuts, CLI, PowerShell, HA scripts…) and sibling plugins share one public contract (23 ops):

- `commands.*` — discover / search / run command-palette entries of any installed plugin (confirm-gated, audited)
- `checkin.*` / `contacts.*` — structured pass-through to the public bridges of Lv Check-in (API v5) and Lv Contacts (bridge v1)
- `registry.list` / `diagnostics.report` / `config.discover` — Lv ecosystem manifest (7 plugins, maturity × installed version), sanitized diagnostics, daily-note notebook auto-discovery
- `events.list` / `events.pull` — whitelisted event stream (check-in record/deletion auto-materialized; deletions as `:deleted`-suffixed markers coexisting with originals)
- `workflow.plan` / `workflow.execute` — controlled orchestration (≤8 steps, op whitelist, 30s total confirm, stop-on-failure)
- `template.new` / `doc.open` / `daily.status` / `editor.context` / `setting.open` — doc-from-template, controlled navigation, editor context
- `plugin.api` — raw bridge pass-through (off by default + allowlist + manifest-driven window-bridge mapping)

**Two channels**: the NDJSON bridge (default, async) + an **experimental kernel sync route** (v0.5.0, `POST /plugin/private/siyuan-quickgate/exec`) that handles the kernel-capable op subset synchronously, no frontend window required.

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

Clients included in [`tools/`](./tools): zero-dependency node CLI (`ping/send/run/events/exec`) and a PowerShell script (`-Exec` hits the kernel route directly). Quicker subprograms use the same envelope.

## Safety

- Bridge is **off by default**; `commands.run` shows a confirm dialog (30s timeout = deny) and everything is audited.
- `plugin.api` raw pass-through is off by default with an allowlist (window-bridge mapping comes from the ecosystem manifest, not hard-coded).
- The hub only consumes publicly registered capabilities and public bridge methods. It never reads other plugins' private storage.
- The event stream is append-only; deletions are marker rows paired by idempotency key. High-frequency heartbeat events (analytics-updated) are explicitly excluded from materialization (D-0011).

## Status & roadmap

**v0.1.0** bridge core + adapters + settings + unit tests → **v0.2.0** ecosystem hub (manifest/registry/diagnostics) → **v0.3.0** reliability hardening (template.new, 15s cap, device name, diag package) → **v0.4.x** events/workflow + check-in host-event bridging → **v0.5.x** experimental kernel sync route, event-subscription channel fix (window CustomEvent), observability stats, manifest calibrated against remote mains, event-deleted materialization → **v0.6.x** deployed live on a real workspace (3.8.5) and enabled: config.discover calibrated against the live kernel (dailyNoteSavePath camelCase + non-default-template-first), v1.5 broadcast fast path (SSE millisecond-level command channel, default off, reservation semantics against dual-channel replays), frontend assumptions statically verified against the installed app bundle (editor.context docId fix, registry customHotkey effective key).

Kernel-runtime verification (M0 spike ①–⑪) is tracked in [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md); roadmap in [docs/ROADMAP.md](./docs/ROADMAP.md); decision log in [docs/DECISIONS.md](./docs/DECISIONS.md) (D-0001–D-0011).

## Development

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm test    # vitest (no kernel needed)
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # symlink into your workspace for dev
```

License: [MIT](./LICENSE) · Author: [@ai68298100](https://github.com/ai68298100)
