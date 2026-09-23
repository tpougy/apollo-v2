# Quick Task 260922-vbt: Generalizar fundos para entidades com multiplos tipos configuraveis - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Task Boundary

Generalizar `fundos` para `entidades` com multiplos tipos configuraveis: nova modelagem
de entidade generica no lugar de `fundos` fixo, com suporte a multiplos tipos de entidade
(cada tipo com seu proprio label, ex Fundo/Cliente/Area), `templatesRotina`, `projetos` e
`tickets` passam a vincular a uma entidade de qualquer tipo, migracao dos dados de producao
existentes (`fundos` atuais viram entidades do tipo "Fundo").

This is a real schema migration (not a label-only rename) — the user explicitly chose this
scope over a lighter "just relabel the UI" alternative when asked directly. No further
clarifying questions are being asked for this task (user said "avance direto" / proceed
without pausing) — all gray areas below were resolved autonomously and are documented here
for transparency, mirroring this project's established convention for autonomous milestone
work (see PROJECT.md Key Decisions table, e.g. SEM-01, LIFE-03).

</domain>

<decisions>
## Implementation Decisions

### D1 — Full rename, no back-compat alias
Schema entity renamed `fundos` -> `entidades`. CLI command group renamed `apollo fundo` ->
`apollo entidade` (no `apollo fundo` alias kept). Web UI renamed throughout: nav item
"Fundos" -> "Entidades", dashboard grouping "por fundo" -> "por entidade", dialog titles,
column headers. Rationale: this is a personal single-user project (PROJECT.md's own
"Core value" statement — one real user across CLI+SPA), not a published product with
external consumers depending on argv/URL stability, so there is no compatibility cost to
a clean rename. A half-renamed system (some "fundo", some "entidade") would be far more
confusing long-term than a one-time full rename.

### D2 — Type modeling: free-text field, no separate types catalog
New required field `tipoEntidade: i.string()` on the `entidades` entity (required, not
optional — this is a brand-new entity/table, so there is no existing-row backfill problem
the way `templatesRotina.offsetDias`/`diaSemana` had; every row created via migration or
the CLI/web going forward always sets it explicitly). NO separate `tiposEntidade`
management entity/CRUD screen. Rationale: mirrors this schema's own established convention
of free-string categorical fields with no closed vocabulary (`status`, `tipoGeracao`,
`regraCompetencia` are all plain strings, never an enum table) — see PROJECT.md Key
Decisions on `status` staying open-vocabulary by product decision. The user's own request
("pode configurar um label para a entidade") is satisfied by simply typing the label as
this field's value when creating/editing an entidade; a dedicated types-catalog screen was
not requested and would be new scope, not migration of existing scope.
Migrated `fundos` rows get `tipoEntidade: "Fundo"`.

### D3 — Links renamed to match
`entidadeProjetos`, `entidadeTemplatesRotina`, `entidadeTickets` replace `fundoProjetos`,
`fundoTemplatesRotina`, `fundoTickets` (forward `on: projetos|templatesRotina|tickets, has:
one, label: entidade`; reverse `on: entidades, has: many, label: projetos|templatesRotina|
tickets`). The old `fundos` entity and its 3 links are removed from the schema once
migration is verified complete (not left as permanent dead schema).

### D4 — Migration mechanic (2-step schema push + admin data migration)
1. Additive schema push: add `entidades` entity + 3 new links, LEAVING `fundos` + old
   links in place (nothing breaks mid-migration, same "additive first" discipline this
   project already used for optional-field additions in `templatesRotina`).
2. Live admin migration script (mirrors the `260922-t1l` quick-batch item's own
   live-verified pattern: dry-run/count-first, canary-entity byte-identity check,
   independent post-hoc re-verification, transient script deleted after use): for every
   existing `fundos` row, create a new `entidades` row **reusing the exact same id**
   (InstantDB ids are client-assigned UUIDs; reusing it means no id-mapping table is
   needed to correlate old fundo <-> new entidade) with `tipoEntidade: "Fundo"` and the
   same `nome`/`codigo`/`ativo`/`donoId`/`createdAt`. Then re-link every `projetos`/
   `templatesRotina`/`tickets` row from its old `fundo` link to the new `entidade` link
   (both links coexist during migration; this is real linking work per child row, reusing
   the id only avoids needing a lookup table, it does not substitute for the `.link()`
   calls themselves).
3. Verify live: every `entidades` row count matches original `fundos` count; every child
   row that had a `fundo` link now also has an `entidade` link pointing at the same id;
   `codigo`/`nome`/`ativo`/`donoId` byte-identical between old and new row per id.
4. Second schema push: remove `fundos` entity + its 3 old links entirely.
5. Admin-delete any now-orphaned `fundos` rows/links data (same admin-cleanup pattern as
   `260922-t1l`), independently re-verified.

### D5 — Permissions
`shared/instant.perms.ts`'s existing `donoRules` block (`view`/`create`/`update`/`delete`
all gated on `auth.id == data.donoId`) applies to `entidades` exactly as it did to `fundos`
— no per-`tipoEntidade` special-casing. Same rule, new entity name.

### D6 — `apollo import` (Phase 31's `batch_import.py`) compatibility
Rename `fundoId`/fundo-natural-key handling to `entidadeId`, but make `tipoEntidade`
**optional** in the import JSON schema, defaulting to `"Fundo"` when omitted — so any
existing/future batch-import JSON files written before this change (using the old
implicit "fundo" concept) keep working without edits. This is the one deliberate
backward-compat exception in an otherwise clean-break rename, justified because import
files are external data files a human may have already written, not internal code.

### D7 — Dashboard component naming
`RoutinesByFundo.svelte` / `rotinasPorFundo` (in `derive.ts`) — both touched earlier today
by quick-batch item `260922-t1n` — are renamed to `RoutinesByEntidade.svelte` /
`rotinasPorEntidade` as part of this same rename sweep, along with `FundoDialog.svelte` ->
`EntidadeDialog.svelte`, `defs/fundos.ts` -> `defs/entidades.ts`, and every other
fundo-named file/identifier the planner's own repo scan turns up (`cli/apollo_cli/
entities/fundo.py` -> `entidade.py`, etc.). Full enumeration is left to the planner/
pattern-mapper's own grep sweep rather than hand-listed here, given the confirmed blast
radius (6 CLI source files + 11 CLI test files + 19 web/src files + 24 e2e spec files
reference "fundo" as of this writing) — an exhaustive list here would drift from the
actual repo state by the time planning runs.

### Claude's Discretion
- Exact migration script location/structure (mirror `cli/scripts/cleanup_rotina_test_data.py`'s
  established transient-script convention from `260922-t1l`).
- Whether the rename touches `web/e2e/fixtures/instancia-admin-fixture.ts` and other
  fixture helper names — planner's discretion based on actual content found.
- Task/wave breakdown given the scope — this is likely too large for a single 1-3 task
  quick plan; the planner should size tasks appropriately (schema+migration as an early
  tracer task, CLI rename, web rename, e2e rename as separate tasks) rather than force
  an artificially small task count.

</decisions>

<specifics>
## Specific Ideas

No specific UI mockups or exact wording were requested — the user's own words were "trocar
esse default de fundos para a entidade, e voce pode configurar um label para a entidade."
Any exact label text used in the UI ("Tipo", "Categoria", etc.) is the planner's judgment
call, consistent with this project's existing Portuguese-language UI conventions.

</specifics>

<canonical_refs>
## Canonical References

- `shared/instant.schema.ts` — current `fundos` entity + 3 links to generalize (read in full
  this session, reproduced in the surrounding conversation context).
- `shared/instant.perms.ts` — `donoRules` block to extend to `entidades`.
- `.planning/quick/20260922-limpar-dados-de-teste-poluidos-apagar-todos-os-registros-das/260922-t1l-PLAN.md`
  and its SUMMARY/VERIFICATION — the precedent live-migration/admin-cleanup pattern (dry-run
  first, canary byte-identity check, independent re-verification, transient script deleted
  after use) this task's migration step should mirror.
- `.planning/PROJECT.md` Key Decisions table — precedent for documenting a user-directed
  scope decision transparently rather than silently substituting it.

</canonical_refs>
