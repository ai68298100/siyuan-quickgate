# Lv QuickGate (小驴快门)

[中文文档](./README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-0.5.4-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

**Lv QuickGate** is the hub of the Lv plugin ecosystem and its external gateway for [SiYuan Note](https://b3log.org/siyuan). It lets outside clients (Quicker, iOS Shortcuts, CLI, PowerShell, HA scripts…) and sibling plugins share one public contract:

- `commands.*` — discover / search / run command-palette entries of any installed plugin (confirm-gated, audited)
- `checkin.*` / `contacts.*` — structured pass-through to the public bridges of Lv Check-in (API v5) and Lv Contacts (bridge v1)
- `editor.context` / `daily.status` / `doc.open` — editor & workspace snapshots, controlled navigation
- `bridge.ping` — capability negotiation (`{protocol, plugin, version, pollMs, bridgeEnabled}`)

> **Marketplace status: deferred.** Install manually from GitHub Releases (import `package.zip` via SiYuan → Marketplace → Downloads → Install from package). This repo is the single distribution channel for now.

## Install (manual)

1. Download `package.zip` from the [latest release](https://github.com/ai68298100/siyuan-quickgate/releases/latest).
2. SiYuan → Settings → Marketplace → Downloads → top-right menu → *Install from package* → pick the zip.
3. Enable the plugin, open its settings, switch **External command bridge** on (default off by design).

## Protocol

One NDJSON file pair per plugin under `data/storage/petal/<plugin>/bridge/`:

```
commands.ndjson   # client → plugin, one JSON envelope per line
results.ndjson    # plugin → client, rolling window of 200 receipts
```

Envelope: `{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}` — receipts echo `id` with `status ∈ recorded|duplicate|rejected|failed|unsupported|expired`. Full contract: [docs/api.md](./docs/api.md) · machine-readable: [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json).

Clients included in [`tools/`](./tools): zero-dependency node CLI and a PowerShell script. Quicker subprograms use the same envelope.

## Safety

- Bridge is **off by default**; `commands.run` shows a confirm dialog (30s timeout = deny) and everything is audited.
- `plugin.api` raw pass-through is off by default with an allowlist.
- The hub only consumes publicly registered capabilities and public bridge methods. It never reads other plugins' private storage.

## Status & roadmap

v0.1.0 = bridge core + adapters + settings + unit tests (queue-race, TTL, dedup persistence, single-flight polling all covered). Kernel-runtime verification (M0 spike) is tracked in [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md); see [docs/ROADMAP.md](./docs/ROADMAP.md).

## Development

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm test    # vitest (no kernel needed)
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # symlink into your workspace for dev
```

License: [MIT](./LICENSE) · Author: [@ai68298100](https://github.com/ai68298100)
