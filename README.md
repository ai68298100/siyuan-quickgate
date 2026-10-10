<div align="center">

<img src="./icon.png" width="88" alt="Lv QuickGate" />

# Lv QuickGate (小驴快门)

**The Lv ecosystem hub & external gateway for SiYuan** — one public contract (39 ops) for Quicker / Shortcuts / CLI / AI assistants

[中文文档](./README.zh-CN.md) · [Getting started](./docs/GETTING-STARTED.md) · [op contract](./docs/api.md) · [AI client matrix](./docs/ai-clients.md) · [Download](https://github.com/ai68298100/siyuan-quickgate/releases)

[![CI](https://github.com/ai68298100/siyuan-quickgate/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai68298100/siyuan-quickgate/actions/workflows/ci.yml) [![Version](https://img.shields.io/badge/version-0.9.2-blue)](./plugin.json) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) [![SiYuan](https://img.shields.io/badge/SiYuan-%E2%89%A53.8.4-ff5c67)](https://b3log.org/siyuan)

<img src="./preview.png" alt="Layered settings · command palette · four centers" width="820" />

</div>

Outside clients (Quicker, iOS Shortcuts, CLI, PowerShell, AI assistants, HA scripts…) and sibling plugins share one public contract (39 ops):

- `commands.*` — discover / search / run command-palette entries of any installed plugin (confirm-gated, audited; search understands zh/en/pinyin aliases — 打卡/daka/checkin all hit)
- `checkin.*` / `contacts.*` — structured pass-through to the public bridges of Lv Check-in (API v5) and Lv Contacts (bridge v1)
- `favorites.*` — favorites & recent usage (command-palette UX: dedupe-and-move-to-front, privacy clearing; stored separately from bridge files)
- `registry.list` / `diagnostics.report` / `config.discover` — Lv ecosystem manifest (7 plugins, maturity × installed version), sanitized diagnostics, daily-note notebook + inbox auto-discovery
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

> **Marketplace status: deferred.** GitHub Releases is the single distribution channel for now (see install below).

## In-plugin UI (SiYuan side)

Visual language follows [design/ui-prototype/mvp1.html](./design/ui-prototype/mvp1.html) (all `--b3-*` tokens, follows the host theme's light/dark mode, no hard-coded colors):

- **Layered settings panel**: Status overview (health home: channel cards / run KPIs / next step / recent receipts) · First-run wizard (**resumable seven-step state machine**: env check → capability selection → bridge permission → connection probe → sample read → optional sample write (undoable) → done; wizard-state.json resume) · Connections · Security · Queue & data (incl. **full backup/restore** and clear-queue preview) · Diagnostics & ecosystem · About; a top search bar filters settings **across groups**.
- **Command palette** (`Ctrl+Alt+P`): search host commands (zh/en/pinyin aliases, favorites ★ / recents auto-pinned); "capability actions" run in two stages (fill params, then execute, write-ops annotated); empty-result fallback = one-line **quick capture** to today's daily note / inbox.
- **Notification / Recovery / Results centers**: aggregated attention items (one-click jump to the handling surface) · manual disposition of unknown/failed/expired receipts (retry with a new id / dismiss with record / batch) · `results.ndjson` query (status/time filters, keyword, paging, CSV/JSON export).
- **Liveness detection & takeover**: when another window holds the consumer lock, its heartbeat status is shown; stale/suspect heartbeats offer one-click takeover (ledger prevents double consumption).

## Install (manual)

1. Download `package.zip` from [Releases](https://github.com/ai68298100/siyuan-quickgate/releases). A prerelease is for public testing; GitHub shows the uploaded asset's SHA-256 digest. Releases from v0.9.0 on are stable (non-prerelease) — just pick the latest one.
2. SiYuan → Settings → Marketplace → Downloads → top-right menu → *Install from package* → pick the zip.
3. Enable the plugin, open its settings, switch **External command bridge** on (default off by design).
4. **After updating, fully quit SiYuan (tray → quit) and start it again** — reopening the window does not refresh plugin frontend code. Or just double-click `tools/restart-siyuan.bat`.

## Protocol

One NDJSON file set per plugin under `data/storage/petal/<plugin>/bridge/`:

```
commands.ndjson   # client → plugin, one JSON envelope per line
results.ndjson    # plugin → client, rolling window of 200 receipts
events.ndjson     # public host-event stream (materialized by QuickGate on behalf of Check-in: records + deletion markers)
```

Envelope: `{v:1, id, op, args, createdAt, ttlMs?, reply?, device?}` — receipts echo `id` with `status ∈ recorded|duplicate|rejected|failed|unsupported|expired`. Full contract: [docs/api.md](./docs/api.md) · machine-readable: [docs/contracts/quickgate-api-v1.json](./docs/contracts/quickgate-api-v1.json) (the op face is enforced against `src/ops.ts` by a consistency test).

Clients included in [`tools/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/tools): zero-dependency node CLI (`ping/send/run/events/exec/fast`), a PowerShell script (`-Exec` kernel route, `-Fast` broadcast) and `restart-siyuan.bat` (one-click safe restart after deploying). Quicker subprograms use the same envelope.

### MCP for AI assistants

[`src/mcp/`](https://github.com/ai68298100/siyuan-quickgate/tree/main/src/mcp) exposes all 39 ops as MCP tools over stdio — AI clients can run SiYuan commands, log check-ins, record contacts interactions and execute controlled workflows, including the Lv ecosystem actions that are outside SiYuan's built-in MCP surface. See the [MCP guide](./src/mcp/README.md) for the protocol and safety model.

- **14 read-only tools by default**; write tools stay hidden until `LV_MCP_WRITE=1` (calls to hidden tools are honestly refused)
- `plugin.api` / `workflow.execute` additionally carry the `destructiveHint` annotation
- All QuickGate-side defenses still apply: confirm dialogs, blacklist, audit log, plugin.api allowlist

```json
{ "mcpServers": { "lv-quickgate": {
    "command": "node",
    "args": ["<repo>/src/mcp/main.ts"],
    "env": { "SIYUAN_TOKEN": "<token>" }
} } }
```

### Built-in SiYuan Agent integration (automatic, no config)

On SiYuan ≥3.8.6 the plugin registers three capabilities natively with the **built-in AI Agent** via `siyuan.agent.registerCapability`: `quickgate_ping` (health), `quickgate_discover` (diary notebook + inbox discovery) and `quickgate_capture` (append a line to today's daily note). Verified live on the Agent's model-facing tool list (`/api/ai/lsCapabilities`) — nothing to configure. Alternatively, point the Agent's external-MCP settings at this repo's MCP stdio server for the full 27-tool surface — full guide (field-level `ai.mcp.servers` setup + approval policy): [docs/agent-integration.md](./docs/agent-integration.md).

## Safety

- Bridge is **off by default**; `commands.run` shows a confirm dialog (30s timeout = deny) and everything is audited.
- `plugin.api` raw pass-through is off by default with an allowlist (window-bridge mapping comes from the ecosystem manifest, not hard-coded).
- The hub only consumes publicly registered capabilities and public bridge methods. It never reads other plugins' private storage.
- The event stream is append-only; deletions are marker rows paired by idempotency key. High-frequency heartbeat events (analytics-updated) are explicitly excluded from materialization (D-0011).

## Status & roadmap

| Version | Milestones |
|---|---|
| v0.1–v0.3 | bridge core + adapters + settings + tests → ecosystem hub (manifest/registry/diagnostics) → reliability hardening (template.new, 15s cap, device name, diag package) |
| v0.4–v0.6 | events/workflow + check-in host-event bridging → experimental kernel sync route → live deployment (3.8.5) + v1.5 broadcast fast path + bundle static verification |
| v0.7.0–0.7.3 | MCP stdio server for AI assistants + kernel route live-verified on 3.8.6 (bug#9) + acceptance entry points → backlog cleanup (eight correctness fixes + version/release gates) + bug#11/12/13 |
| **v0.7.4** | **template.new path-traversal security fix** (three-channel guard) + favorites/recents full chain + **built-in SiYuan Agent native capabilities** (zero config) + concurrency correctness (idempotency registry / bridge claim / multi-writer mitigation) + contract 23→27 + manifest v2 (live-calibrated) |
| **v0.7.5** | release-chain hardening: package.zip unpack assertions (bug#9 regression gate) + Agent integration guide + restart tool + bug#17 documented (lifecycle hook noise, zero functional impact) |
| **v0.8.0** | **resumable seven-step first-run wizard** (wizard-state.json resume, sample read/write with undo) · **liveness detection & takeover** (heartbeat + Web Locks steal) · **workflow.cancel channel** (checkpoint before each step, completed steps preserved) · day-based retention (retentionDays, off by default) · backup sourceDevice + favorites merge import · prototype-aligned UI polish |
| **v0.8.1** | CI/release reproducibility hardening · MCP smoke count derived from the single op registry · Dependabot and GitHub issue/PR workflow hygiene · bilingual documentation and security policy refresh |
| **v0.8.2** | Runtime version source unified across entry/settings/diagnostics · container E2E failures made visible with strict gates, health probes, token masking, and diagnostic artifacts |
| **v0.8.3** | Session health snapshot in diagnostics · command palette empty-state keyboard safety · combobox/listbox accessibility · stricter E2E startup readiness |
| **v0.8.4** | SSE frame/drop/error metrics and session-safe health snapshots · one-click health snapshot copy · keyboard navigation for empty-state actions · isolated E2E volumes and cleanup |
| **v0.8.5** | Preserve SSE tail frames at EOF · count only readable connections · complete empty-state option semantics for screen readers |
| **v0.8.6** | Await in-flight bridge ticks before releasing the consumer lock · preserve audit and runtime stats during unload and hot reload |
| **v0.8.7** | Fix keyboard execution offsets after the 100-command render limit · remove an ineffective dynamic import warning |
| **v0.8.8** | Serialize bridge start/stop transitions · release late Web Lock grants after takeover timeout · improve settings screen-reader labels |
| **v0.9.0** | **Full UI overhaul**: settings panel / palette / four centers aligned to the prototype (evidence-solved palette contrast ≥4.5:1, narrow-screen & touch support, 13-assertion real-kernel interaction e2e) · fixed capture-undo false failure · settings search hit highlighting · new icon & brand visuals |
| **v0.9.2** | **Ecosystem completion 35→39 op**: xiaolv-common window bridge shipped upstream (0.4.0 · ADR-0013 read-only subset) and integrated as common.search/get/recent/favorites (all read-only) |
| **v0.9.1** | **Ecosystem adapters 27→35 op**: glean (siyuanGlean v1) / home (LvHome v1) / exam (siyuanExam) integration · manifest calibration (three plugins design→stable + xiaolv-common added, 8 entries) · AI client matrix (docs/ai-clients.md) + tool-schema exporter |

Kernel-runtime verification (M0 spike ①–⑪) is tracked in [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md); roadmap in [docs/ROADMAP.md](./docs/ROADMAP.md); decision log in [docs/DECISIONS.md](./docs/DECISIONS.md) (D-0001–D-0015).

## Development

```bash
corepack pnpm install
corepack pnpm check   # tsc + svelte-check
corepack pnpm accept  # unit tests + MCP protocol smoke (6 protocol checks; live bridge.ping adds one environment-dependent check)
corepack pnpm build   # dist/ + package.zip
corepack pnpm make-link  # symlink into your workspace for dev
```

After deploying, restart SiYuan (or double-click `tools/restart-siyuan.bat`), then run:

- `corepack pnpm run verify:restart` (add `SIYUAN_LOG=<workspace>/temp/siyuan.log` for the log-growth readout) — full acceptance dataset: bridge e2e latency, kernel-route ops, event materialization counts, broadcast liveness, v1.5 fast-path latency, MCP kernel-route, kernel log growth.
- `corepack pnpm run verify:bg` — 7-check background walkthrough (including the "frontend bundle discriminator": after deploying index.js you must fully quit & restart SiYuan, and this check should pass).

License: [MIT](https://github.com/ai68298100/siyuan-quickgate/blob/main/LICENSE) · Author: [@ai68298100](https://github.com/ai68298100)
