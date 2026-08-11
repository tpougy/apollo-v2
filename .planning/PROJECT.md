# Apollo v2

## What This Is

Apollo v2 is a from-scratch rewrite of Apollo, a local, single-user system for a fund-controladoria professional. It replaces the original Python/Litestar/SvelteKit/SQLite stack with InstantDB as the sole backend, a pure Svelte 5 SPA (no SvelteKit), and a documented Python CLI that replaces the old MCP server for Claude-operated workflows. v1.0 shipped the full data layer: live InstantDB schema/perms, the shared ANBIMA business-day calendar, full magic-code-authenticated CRUD on both the CLI and the SPA for every domain entity, and the idempotent routine-instance-generation job running identically from both channels. v1.1 restyled the entire SPA on Tailwind CSS v4 + shadcn-svelte's own default look (no custom design tokens), covering login, shell/nav, and every entity's table and form — a pure presentation layer change, zero new domain functionality. No UI panel/dashboard design is in scope yet.

## Core Value

The user can execute every piece of controladoria data-entry work — full CRUD across all domain entities — from either the Svelte SPA or the Python CLI, with both channels authenticated as the same real user and governed by the exact same InstantDB permission rules. If everything else fails, this UI ↔ CLI parity at the data layer must hold. **Validated in v1.0**: proven live, cross-channel, in both directions, including under process interruption and cross-user permission attack.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Monorepo scaffold (`shared/`, `web/`, `cli/`) with working tooling for both runtimes — v1.0
- ✓ InstantDB schema (9 domain entities, including `templatesRotina.offsetDias` added mid-milestone) and permission rules live and pushed — v1.0
- ✓ Shared vendored ANBIMA business-day calendar, byte-identical between TS and Python — v1.0
- ✓ Python CLI: magic-code auth + full CRUD for all domain entities — v1.0
- ✓ Svelte SPA: magic-code auth + full functional CRUD screens for all domain entities — v1.0
- ✓ Client-side idempotent routine-instance-generation job (+ CLI equivalent), all 3 generation types, proven safe under real process kill and real concurrency — v1.0
- ✓ End-to-end parity verification + quality gates (ruff+ty on cli/, formatter+linter+svelte-check on web/) green — v1.0
- ✓ `web/` fully restyled on Tailwind v4 + shadcn-svelte's own CLI default (`--preset b0` = nova/neutral/lucide), no custom design tokens — LoginScreen, Shell/nav, and EntityScreen's table + form (Dialog, Select, Calendar date-picker, Badge, Sonner toasts) all rebuilt, zero business-logic change, dark mode via `prefers-color-scheme` with no manual toggle — v1.1
- ✓ Playwright e2e suite grew from 15 to 39 passing tests covering every restyled screen across all 3 entity capability classes (full-CRUD, restricted-create/status-only, read-only), zero human UAT anywhere in the milestone — v1.1
- ✓ `web/` composition/spacing pass on the same four screens (login, shell/nav, entity table, entity form): consistent spacing scale across every touched surface, page-header/Skeleton/Empty/bounded-table composition, Dialog.Description/Footer + busy-spinner + required-indicator on forms, aligned row actions, `window.confirm()` → shadcn `AlertDialog` for delete — still zero custom palette, still shadcn-svelte defaults only — v1.2
- ✓ Playwright e2e suite grew from 39 to 69 passing tests, including dual-color-scheme and keyboard/focus-visible coverage per capability class and a genuine cross-phase spacing-parity measurement, zero human UAT anywhere in the milestone — v1.2

### Active

<!-- Current scope. Building toward these. -->

- Navegação reorganizada em topbar de 6 seções (Dashboard, Rotinas, Tickets, Projetos, Fundos, Log); `etapas`, `templatesRotina`, `subtarefas`, `tarefas` deixam de ser destinos de primeiro nível — v1.3 (em andamento)
- Dashboard como tela inicial: calendário semanal de dias úteis, fila de tickets, rotinas agregadas por fundo, heatmap mensal de carga, mini-kanbans por projeto, sistema de 7 dialogs de foco — v1.3 (em andamento)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Porting existing SQLite data from original `apollo` — no real production data exists yet (SPEC, "Fora de escopo")
- UI panel/dashboard design (5 fixed panels, ordering, `.eml` drag-and-drop) — separate future spec; this milestone is data layer + auth + CLI + job only
- Advanced v2 rules from original `apollo` (automatic soft-deadline reallocation, chained delay propagation) — out of scope in the original project too, remains deferred

## Context

- Original `apollo` (`~/pessoal/apollo`) was planned/partially implemented on Python 3.12 + Litestar + litestar-vite + SvelteKit + AdvancedAlchemy + SQLite + `cofin/litestar-mcp`. It stays intact as reference/archive; not touched by this rewrite.
- Reference implementation for Svelte 5 + InstantDB patterns: `~/pessoal/ultima-missao` (Svelte 5 + Vite + `@instantdb/svelte`, no SvelteKit, Cloudflare Pages deploy).
- Source spec: `docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md` ("Migração Apollo → InstantDB + Svelte SPA + CLI Python", status: Aprovado para planejamento de implementação).
- Vendored ANBIMA holiday table source: extracted from the MIT-licensed `bizdays` PyPI package's bundled `ANBIMA.cal` (1003 dates, 2000-2078), not the originally-cited `feriados-anbima` scraper.
- This project executes autonomously via `/gsd:autonomous` for extended unattended stretches — no phase in the roadmap depends on human UAT/interaction to proceed.
- **v1.0 shipped 2026-08-09**: 6 phases, 27 plans, 70 tasks, ~10.4k LOC across `cli/`, `shared/`, `web/src`. Every phase's requirements were proven against the live InstantDB app (never mocked), including real magic-code email round trips and a real cross-user permission-denial proof.
- **v1.1 shipped 2026-08-10**: 5 phases (7-11), 8 plans, 114 files changed (+3,830/-272 LOC in `web/`). Every phase proven against the live InstantDB app via real Playwright runs, including real magic-code email round trips — zero human UAT anywhere in the milestone. Full detail: `.planning/milestones/v1.1-ROADMAP.md`; closing audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`.
- **v1.2 shipped 2026-08-10**: 6 phases (12-17), 9 plans, 22 tasks. Every phase proven against the live InstantDB app via real Playwright runs; a closing cross-phase integration audit caught and fixed one genuine visual regression (EntityScreen header-to-content 0px spacing gap) before completion. Full detail: `.planning/milestones/v1.2-ROADMAP.md`; closing audit: `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.
- Known technical debt / follow-ups for a future milestone: the panel/dashboard UI (5 fixed panels, ordering, `.eml` drag-and-drop) is still unbuilt; automatic soft-deadline reallocation and chained delay propagation remain deferred v2 rules; a hung `db.transact` during delete leaves the AlertDialog permanently undismissable (no timeout/abort path, non-blocking); no type-level invariant pairs `capabilities.delete` with `capabilities.create` on entity configs (non-blocking, all 9 current entities satisfy it); Shell's nav uses `flex-wrap` with no explicit single-row assertion at desktop width (functionally fine today, minor coverage gap).

## Constraints

All constraints below originate from the approved SPEC and are **LOCKED** — do not reopen or re-litigate any of them during planning or execution.

- **Tech stack (LOCKED)**: `shared/` (TS domain source of truth), `web/` = pure Svelte 5 SPA via Vite (no SvelteKit), `cli/` = Python 3.12 package managed with `uv`, entrypoint `apollo`. InstantDB is the sole backend/database. — *SPEC "Estrutura do repositório"*
- **Repo layout (LOCKED)**: `apollo-v2/{shared/{instant.schema.ts, instant.perms.ts, anbima-calendar.json, scripts/update_calendar.py}, web/src/lib/bizdays.ts, cli/apollo_cli/bizdays.py, .env.instantdb}`. `shared/` is the single place both `web/` and `cli/` read domain schema and calendar data from — never duplicated. — *C-01*
- **v1 scope (LOCKED)**: Full InstantDB schema + full CRUD for all domain entities delivered in one pass, no intermediate slice. — *C-02*
- **ANBIMA calendar (LOCKED)**: `shared/anbima-calendar.json` is a static vendored table (~948 dates, 2000-2078, federal-only), sourced from `github.com/ianliu/feriados-anbima`. Both `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` read exclusively from this JSON — never from a library's built-in/algorithmic calendar. Update path is manual (`shared/scripts/update_calendar.py`, run yearly), never computed at runtime. — *C-03*
- **Schema (LOCKED)**: 8 domain entities — `fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas` — plus log-only `logInferenciaClaude`. `donoId` is denormalized onto every entity. `subtarefas` is a real linked entity (not embedded JSON, unlike original `apollo`). `instanciasRotina.dedupeKey` is unique+indexed (idempotency key). Field/link shapes exactly as documented in SPEC §"Schema do InstantDB". — *C-04*
- **Auth & permissions (LOCKED)**: Magic-code email auth on both channels; browser stores session via SDK (localStorage), CLI stores session at `~/.config/apollo-cli/session` (created by `apollo auth login`). No admin token in normal operation — both channels authenticate as the same real user under the same `instant.perms.ts` rules: `view/update/delete: auth.id != null && auth.id == data.donoId`, `create: auth.id != null && auth.id == newData.donoId`. `$users` keeps InstantDB's default rule. — *C-05*
- **Idempotent job (LOCKED)**: Routine-instance generation runs client-side on authenticated SPA load (no backend process). For each active `templatesRotina`, compute expected `instanciasRotina` in range today→end of next month using the three generation types (`du_fixo`, `corrido_fixo`, `encadeado`), then upsert via `dedupeKey = hash(templateId + competencia + dataPrevista)` using InstantDB's atomic lookup-transact. Never duplicates, never deletes. Same logic must be triggerable from the CLI (`apollo rotina gerar-instancias`) for parity. — *C-06*
- **CLI surface (LOCKED)**: Package `cli/` (uv-managed), entrypoint `apollo`, built with `click`, subcommands organized by entity + action mirroring former MCP tool names (`apollo auth login`, `apollo fundo criar|editar|deletar|listar`, `apollo projeto ...`, `apollo tarefa ...`, `apollo ticket ...`, `apollo rotina template criar|editar|deletar`, `apollo rotina gerar-instancias`, `apollo log-inferencia registrar`), extended with equivalent CRUD subcommands for `etapa` and `subtarefa` to satisfy full-entity-coverage scope. Every subcommand needs rich `--help`. — *C-07*
- **Quality gates (LOCKED)**: `cli/` — 100% typed Python, `ruff` (curated rule set, not `ALL`) and `ty` both clean (zero errors/warnings) on every `.py` file, including `bizdays.py` and `shared/scripts/*.py`. `web/` — `bun` is the sole JS/TS executor; all frontend logic is `.ts` (never `.js`), including `.svelte` files using `<script lang="ts">`; a formatter (Prettier or Biome) and lint/type checker (ESLint or Biome + `svelte-check`) must run clean before a file is done. — *C-08*
- **Out of scope for this migration (LOCKED)**: No SQLite data migration; no panel/dashboard UI design; no advanced v2 rules (soft-deadline reallocation, chained delay propagation). — *C-09*
- **UI stack for v1.1 (LOCKED, added 2026-08-09; terminology resolved 2026-08-09 by Phase 7 research)**: `web/` UI styling runs on Tailwind CSS v4 + `shadcn-svelte`, using the CLI's own zero-index default (`shadcn-svelte add --preset b0` = style `nova` + base color `neutral` + icon `lucide`) and default theme tokens only — no custom color palette, no bespoke design tokens, no CSS beyond Tailwind utilities + the shadcn-svelte init output. The original "default style + slate base color" phrasing is stale (shadcn-svelte's CLI dropped both terms in the 1.x preset redesign); `--preset b0` is the literal current-CLI equivalent of "the default, uncustomized look" and satisfies this constraint's intent unchanged. Icon library `@lucide/svelte`. Dark mode via `prefers-color-scheme` only — shadcn-svelte's own default init output wires a class-based `mode-watcher` toggle, which must be removed/converted to a bare `@media (prefers-color-scheme: dark)` block to satisfy "no toggle". Tables use shadcn Table/Data Table; date fields use the shadcn Calendar/date-picker pattern — no external table/calendar library unless a phase's research proves shadcn-svelte's own primitive insufficient. — *C-11*
- **v1.1 verification (LOCKED, added 2026-08-09)**: This milestone runs fully unattended — every phase is verified via real Playwright e2e runs against the live InstantDB app (extending `web/e2e/`), never via a human UAT checkpoint. Consistent with the project-wide autonomous-execution pattern already established in v1.0 (see Context). — *C-12*
- **Autonomous magic-code auth testing (LOCKED, user-authorized 2026-08-09, mechanism corrected 2026-08-09)**: This project runs unattended for hours via `/gsd:autonomous` — no human is available to relay magic-code emails. The user explicitly authorized reading the magic-code email from their real inbox (`tp@rbrasset.com.br`) whenever a phase needs to complete or test the magic-code login flow (CLI `apollo auth login`, SPA login screen, or any auth-flow test/e2e verification). **Actual working channel (Phase 3 discovery):** the `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool does NOT have access to `tp@rbrasset.com.br` on this machine (it resolves to a different mailbox). The real channel is Outlook Classic (desktop, COM-accessible) running on the Windows host under WSL, read via the local tool at `/mnt/c/Users/thomaz.pougy/Documents/RBR/Sandbox/outlook-rules`, invoked from WSL as `powershell.exe -NoProfile -Command "Set-Location 'C:\Users\thomaz.pougy\Documents\RBR\Sandbox\outlook-rules'; .\orules.ps1 peek --folder Inbox --days 1 --grep 'nstant' --body 0 --max 5"` — the InstantDB magic-code subject line itself contains the numeric code (e.g. "423630 is your verification code for apollo"), sender `verify@auth-pm.instantdb.com`. **Codes expire fast (~60-90s observed)** — the send→peek→verify sequence must be tight, with no pause between reading the code and submitting it; on `record-expired`, immediately resend and retry the tight loop. Whichever real channel is reachable in a given environment, search for the most recent InstantDB magic-code message, extract the code, use it immediately, and do not otherwise read/act on unrelated mail in the inbox. This is scoped strictly to fetching that one code — never use this access for anything else. — *C-10*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| InstantDB as sole backend (no custom API server) | Native realtime sync; eliminates the Litestar/SQLAlchemy layer that was slowing iteration for a solo user | ✓ Good |
| Pure Svelte 5 + Vite SPA, no SvelteKit | Simpler deploy (static site on Cloudflare Pages); matches reference implementation `ultima-missao` | ✓ Good |
| Python CLI replaces MCP server | Same UI↔AI parity guarantee, now enforced by "same backend + same perms + two authenticated clients" instead of "same service layer behind two adapters" | ✓ Good |
| `donoId` denormalized on every entity | Simpler permission checks than walking relationship chains; duplication cost negligible in a single-user system | ✓ Good |
| `subtarefas` as a real linked entity, not embedded JSON | Trivial in InstantDB relationships; improves queryability over original `apollo` | ✓ Good |
| ANBIMA calendar vendored as static JSON, shared by both runtimes | No JS package guarantees ANBIMA-exact holiday matching; single source of truth prevents client/CLI drift | ✓ Good — proven byte-identical across TS/Python via shared fixture |
| No data migration from original `apollo` SQLite | No real production data exists yet | ✓ Good |
| `templatesRotina.offsetDias` added mid-milestone as an optional dual-purpose field (Phase 5) | Original SPEC schema table lacked a field for the Nth-day/offset rule that `du_fixo`/`corrido_fixo`/`encadeado` generation needed; had to be optional since InstantDB can't backfill required attrs onto existing live rows | ✓ Good |
| Orchestrator (not subagents) performs all magic-code email round trips | Subagents don't inherit the orchestrator's MCP/tool scoping (Outlook COM bridge, M365 mailbox access) — discovered live in Phase 3 and recurred through Phase 6 | ✓ Good — durable pattern, worked every time |
| shadcn-svelte's stale "default style + slate base color" wording resolved to `--preset b0` (style `nova` + base color `neutral`) | shadcn-svelte's CLI dropped both terms in its 1.x preset redesign (discovered live during Phase 7 research) — `--preset b0` is the literal current-CLI equivalent of "the unmodified default look" | ✓ Good — matched user intent, no re-litigation needed |
| Sonner hand-installed (`bun add svelte-sonner`) instead of via `bunx shadcn-svelte add sonner` | The stock registry entry pulls in `mode-watcher`, which would silently reintroduce the manual dark-mode toggle Phase 7 explicitly removed — a direct C-11/SETUP-03 violation if installed via the default CLI path | ✓ Good — caught by Phase 10 research before it landed |
| **v1.1 correction**: magic-code auth round trips do NOT require orchestrator-only execution | v1.0's Key Decision above was scoped to the M365 email-search *MCP tool*, which genuinely is orchestrator-only. `web/e2e/helpers/magic-code.ts` (built in v1.0 Phase 3, used throughout v1.1) shells out directly to `powershell.exe`/Outlook COM as a plain OS subprocess — reachable from any Bash-capable process, including plan-executor subagents. v1.1 delegated live magic-code Playwright runs to subagents throughout with no issue. | ✓ Good — de-risked autonomous execution significantly; watch for InstantDB's per-email rate limit (`429`) under parallel/bursty sends |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-10 — milestone v1.1 (UI bonita com Tailwind + shadcn-svelte) shipped and archived*
