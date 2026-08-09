# Constraints (from SPECs)

Source doc: `docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md`
(title: "Migração Apollo → InstantDB + Svelte SPA + CLI Python", status: "Aprovado para planejamento de implementação")

---

## C-01: Monorepo structure — `apollo-v2`

- type: nfr
- source: docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md (§ "Estrutura do repositório")

New, independent repository `~/pessoal/apollo-v2` (old `apollo` repo stays intact as reference/archive until migration is validated). Monorepo layout:

```
apollo-v2/
├── shared/
│   ├── instant.schema.ts       # single source of truth for domain (entities + links)
│   ├── instant.perms.ts        # permission rules
│   ├── anbima-calendar.json    # vendored ANBIMA holiday table (2000-2078)
│   └── scripts/update_calendar.py
├── web/                        # Svelte 5 SPA (pure Vite, no SvelteKit)
│   └── src/lib/bizdays.ts
├── cli/                        # Python package (uv), entrypoint `apollo`
│   └── apollo_cli/bizdays.py
└── .env.instantdb              # APP_ID only; no admin token needed for normal operation
```

Rationale: since UI↔CLI parity is the core requirement, keeping `instant.schema.ts` and `anbima-calendar.json` in one shared location prevents client/CLI silent divergence — any domain or calendar change touches both sides in the same PR.

## C-02: v1 scope — full schema + full CRUD in one pass

- type: nfr
- source: same doc, § "Decisão de escopo"

v1 of apollo-v2 implements the complete InstantDB schema and complete CRUD for all 8 domain entities at once (no intermediate slice), reusing the domain design already validated in the original `apollo` repo (Fundos, Projetos, Etapas, Tarefas, Templates de Rotina, Instâncias, Tickets, Log de Inferência).

## C-03: ANBIMA business-day calendar — single vendored source of truth

- type: nfr
- source: same doc, § "Cálculo de dias úteis (ANBIMA)"

The ANBIMA calendar used by `bizdays` is a static table (~948 dates, 2000–2078), federal-only — not an algorithm. No JS holiday-calculation package is guaranteed to match it. Decision: vendor the official table (source: `github.com/ianliu/feriados-anbima`) as `shared/anbima-calendar.json` and use it as the **single source of holidays** on both sides:
- Client (`web/src/lib/bizdays.ts`): thin business-day math layer (`isBusinessDay`, `addBusinessDays`, `nextBusinessDay`) fed by the vendored JSON — never by a library's own algorithmic calculation.
- CLI (`cli/apollo_cli/bizdays.py`): Python `bizdays` configured with a custom calendar pointing at the same JSON, instead of the library's built-in `ANBIMA` calendar.
- Update path: `shared/scripts/update_calendar.py`, run manually once a year — never at runtime, never computed dynamically.

Explicitly preserves the equivalent guarantee of the original Apollo's RNF-01 ("single source of truth for business days"), adapted to two runtimes.

## C-04: InstantDB schema — 8 domain entities

- type: schema
- source: same doc, § "Schema do InstantDB"

| Entidade | Campos principais | Links |
|---|---|---|
| `fundos` | nome, codigo, ativo, donoId, createdAt | → projetos, templatesRotina, tickets |
| `projetos` | nome, descricao, status, dataInicioPrevista, dataFimPrevista, donoId | fundo (1) → etapas |
| `etapas` | nome, ordem, status, donoId | projeto (1) → tarefas |
| `tarefas` | titulo, descricao, tipoPrazo, dataPrevista, dataPrevistaEstimada, competencia, status, donoId | etapa (1) → subtarefas |
| `templatesRotina` | nome, tipoGeracao (`du_fixo`/`corrido_fixo`/`encadeado`), regraCompetencia (`M0`/`M-1`/`M-2`/`M+1`/`manual`), propagarAtrasoSoft, donoId | fundo (1), antecessor (self-link opcional) → instanciasRotina |
| `instanciasRotina` | **dedupeKey** (string, unique+indexed — idempotency key), dataPrevista, dataPrevistaEstimada, competencia, tipoPrazo, status, donoId | template (1) |
| `tickets` | titulo, corpo, remetente, dataRecebimento, tipoPrazo, dataPrevista, status, donoId | fundo (1) → subtarefas |
| `subtarefas` | titulo, concluida, ordem, donoId | tarefa (opcional, 1) **ou** ticket (opcional, 1) |
| `logInferenciaClaude` | campo, valorInferido, trechoMotivador, entidadeTipo, entidadeId, donoId, createdAt | — (log-only) |

Notes:
- Subtarefas is its own linked entity (not embedded JSON as in original `apollo`) — explicit decision of this migration, made viable by trivial InstantDB relationships.
- `donoId` (reference to owning `$users` id) is denormalized onto every entity — simpler to check in permission rules than walking `fundo→projeto→etapa→tarefa` chains; duplication cost is negligible in a single-user system.

## C-05: Auth & permission protocol — magic code, identical rules both channels

- type: protocol
- source: same doc, § "Autenticação e permissões"

Both the web client (browser) and the CLI authenticate to InstantDB via **magic code sent by email**, each storing its own local user session (browser: localStorage via SDK; CLI: `~/.config/apollo-cli/session`, created by `apollo auth login`, run once). No admin token is used in normal operation — client and CLI operate under the **same real user identity** and the **same `instant.perms.ts` rules**. This is how UI↔AI parity is guaranteed under the new architecture: not "same service layer behind two adapters" but "same backend, same rules, two interfaces authenticated the same way."

`shared/instant.perms.ts` rules — identical for every domain entity:
```
view/update/delete: "auth.id != null && auth.id == data.donoId"
create:              "auth.id != null && auth.id == newData.donoId"
```
`$users` keeps InstantDB's default rule (each user sees only their own profile).

Side effect: if another person ever needs access, they just log in with their own email — data stays isolated by `donoId` automatically, no schema or rule change needed.

## C-06: Idempotent `instanciasRotina` generation — runs client-side

- type: protocol
- source: same doc, § "Job de geração de instâncias de rotina"

With no backend process, the job (previously fired on Python process startup) now runs **on the client, when the authenticated SPA loads**:
1. For each active `templatesRotina`, compute which `instanciasRotina` should exist in the standard range (today → end of next month), using `bizdays.ts` to resolve the three generation types (`du_fixo`, `corrido_fixo`, `encadeado`).
2. For each expected instance, compute `dedupeKey = hash(templateId + competencia + dataPrevista)` and run an upsert `transact` via unique-attribute lookup (`db.tx.instanciasRotina[lookup('dedupeKey', key)].update({...})`) — atomic InstantDB operation: creates if absent, never duplicates if present.
3. Never deletes existing instances — preserves the original idempotency guarantee (never duplicate, never delete).

Each `transact` is atomic and independent, so closing the browser mid-check leaves no inconsistent state — next open reconfirms and completes what's missing.

## C-07: CLI surface — mirrors former MCP tool names

- type: api-contract
- source: same doc, § "Estrutura da CLI Python"

Package `cli/` (managed with `uv`), entrypoint `apollo`, subcommands organized by entity + action (mirroring the names the AI already used via MCP tools: `criar_fundo`, `editar_fundo`, etc.):

```
apollo auth login
apollo fundo criar|editar|deletar|listar
apollo projeto criar|editar|deletar|listar
apollo tarefa criar|editar|deletar|listar
apollo ticket criar|editar|deletar|listar
apollo rotina template criar|editar|deletar
apollo rotina gerar-instancias
apollo log-inferencia registrar
```

Implemented with `click`; every subcommand needs rich `--help` (description, examples, required fields) — this documented surface is what replaces the MCP server for local Claude Code usage.

## C-08: Quality tooling gates

- type: nfr
- source: same doc, § "Qualidade e tooling"

**Python (`cli/`):** 100% mandatory typing in every `.py` file (every function, parameter, return, and variable where applicable). A Python file is only "done" when both run clean with zero errors/warnings:
- `ruff` — a deliberately curated rule set (not the full/`ALL` ruleset); covers lint + formatting.
- `ty` (Astral's type checker) — must pass clean against the 100%-typed files.

Applies to all of `cli/`, including `cli/apollo_cli/bizdays.py` and `shared/scripts/` (e.g. `update_calendar.py`).

**JS/TS (`web/`):** `bun` is the sole executor (dev, build, scripts) — same convention as current `apollo` and `ultima-missao`. Frontend logic is **always** written in `.ts` — never plain `.js`, no exceptions, 100% of the time (`instant.schema.ts`, `instant.perms.ts`, `bizdays.ts`, `.svelte` components with `<script lang="ts">`). Project always uses a formatter (Prettier or Biome, to be decided during implementation) and a lint/type checker (ESLint or Biome + `svelte-check`) running clean before a file is considered done.

## C-09: Out of scope for this migration

- type: nfr
- source: same doc, § "Fora de escopo desta migração"

- Porting existing SQLite data from current `apollo` — no real production data was recorded in that project's `PROJECT.md` (scaffold only).
- UI panel design (5 fixed panels, ordering, `.eml` drag-and-drop) — this migration covers schema + full CRUD (client and CLI) only; panel UI/UX is a separate spec, to be done after the data layer and CLI are validated end-to-end.
- Advanced v2 rules from original `apollo` (automatic soft-deadline reallocation, chained delay propagation) — remain out of scope, as they were in original `apollo`.
