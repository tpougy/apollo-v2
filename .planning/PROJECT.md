# Apollo v2

## What This Is

Apollo v2 is a from-scratch rewrite of Apollo, a local, single-user system for a fund-controladoria professional. It replaces the original Python/Litestar/SvelteKit/SQLite stack with InstantDB as the sole backend, a pure Svelte 5 SPA (no SvelteKit), and a documented Python CLI that replaces the old MCP server for Claude-operated workflows. v1.0 shipped the full data layer: live InstantDB schema/perms, the shared ANBIMA business-day calendar, full magic-code-authenticated CRUD on both the CLI and the SPA for every domain entity, and the idempotent routine-instance-generation job running identically from both channels. No UI panel/dashboard design is in scope yet.

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

### Active

<!-- Current scope. Building toward these. -->

## Current Milestone: v1.1 UI bonita com Tailwind + shadcn-svelte

**Goal:** Refazer visualmente as 4 telas existentes da SPA (LoginScreen, Shell, EntityScreen genérica das 9 entidades) usando Tailwind CSS + componentes shadcn-svelte no estilo/cores padrão, sem tocar em lógica de negócio, sem criar o painel de 5 áreas (fora de escopo, ver abaixo), verificado 100% via Playwright (sem UAT humano).

**Target features:**
- Tailwind v4 + shadcn-svelte inicializados em `web/` (estilo/baseColor padrão, ícones lucide, dark via `prefers-color-scheme`)
- LoginScreen refeita com componentes shadcn (Input/Button/Label/Card/Alert)
- Shell/nav refeita com componentes shadcn (Button + layout primitivo — sem dashboard)
- EntityScreen (tabela + formulário genérico das 9 entidades) refeita com shadcn Table/Data Table, Dialog/Sheet para criar/editar, Input/Label/Select/Checkbox/Calendar/date-picker por tipo de campo, Badge para status, Sonner para feedback
- Suite Playwright existente (`web/e2e/`) atualizada/estendida para cobrir cada tela refeita, sem gate de UAT humano em nenhuma fase

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
- Known technical debt / follow-ups for a future milestone: the panel/dashboard UI (5 fixed panels, ordering, `.eml` drag-and-drop) is still unbuilt; automatic soft-deadline reallocation and chained delay propagation remain deferred v2 rules.

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
- **UI stack for v1.1 (LOCKED, added 2026-08-09)**: `web/` UI styling runs on Tailwind CSS + `shadcn-svelte`, default style/baseColor and default theme tokens only — no custom color palette, no bespoke design tokens, no CSS beyond Tailwind utilities + the shadcn-svelte init output. Icon library `@lucide/svelte` (shadcn-svelte default). Dark mode via `prefers-color-scheme`, no toggle. Tables use shadcn Table/Data Table; date fields use the shadcn Calendar/date-picker pattern — no external table/calendar library unless a phase's research proves shadcn-svelte's own primitive insufficient. — *C-11*
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
*Last updated: 2026-08-09 — milestone v1.1 (UI bonita com Tailwind + shadcn-svelte) started*
