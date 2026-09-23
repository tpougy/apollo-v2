# Quick Task 260922-vbt: Generalizar fundos para entidades - Research

**Researched:** 2026-09-22
**Domain:** InstantDB schema rename/migration + full-stack (TS shared schema, Svelte SPA, Python CLI) rename sweep
**Confidence:** HIGH (every claim below is either read-in-full-this-session, live-queried against the real production app, or read from the vendored InstantDB SDK source; the one open question — server-side attr-deletion semantics — is CITED against official docs, not assumed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — Full rename, no back-compat alias.** Schema entity renamed `fundos` ->
`entidades`. CLI command group renamed `apollo fundo` -> `apollo entidade` (no
`apollo fundo` alias kept). Web UI renamed throughout: nav item "Fundos" ->
"Entidades", dashboard grouping "por fundo" -> "por entidade", dialog titles,
column headers. Rationale: single-user personal project, no external argv/URL
consumers — a half-renamed system would be more confusing than a clean rename.

**D2 — Type modeling: free-text field, no separate types catalog.** New
required field `tipoEntidade: i.string()` on `entidades` (required, not
optional — brand-new entity, no existing-row backfill problem). NO separate
`tiposEntidade` management entity/CRUD screen. Mirrors this schema's existing
convention of free-string categorical fields with no closed vocabulary
(`status`, `tipoGeracao`, `regraCompetencia`). Migrated `fundos` rows get
`tipoEntidade: "Fundo"`.

**D3 — Links renamed to match.** `entidadeProjetos`, `entidadeTemplatesRotina`,
`entidadeTickets` replace `fundoProjetos`, `fundoTemplatesRotina`,
`fundoTickets` (forward `on: projetos|templatesRotina|tickets, has: one,
label: entidade`; reverse `on: entidades, has: many, label:
projetos|templatesRotina|tickets`). The old `fundos` entity and its 3 links
are removed from the schema once migration is verified complete.

**D4 — Migration mechanic (2-step schema push + admin data migration).**
1. Additive schema push: add `entidades` entity + 3 new links, LEAVING
   `fundos` + old links in place.
2. Live admin migration script (mirrors `260922-t1l`'s pattern: dry-run/
   count-first, canary-entity byte-identity check, independent re-verification,
   transient script deleted after use): for every existing `fundos` row,
   create a new `entidades` row **reusing the exact same id** with
   `tipoEntidade: "Fundo"` and the same `nome`/`codigo`/`ativo`/`donoId`/
   `createdAt`. Then re-link every `projetos`/`templatesRotina`/`tickets` row
   from its old `fundo` link to the new `entidade` link (both links coexist
   during migration).
3. Verify live: every `entidades` row count matches original `fundos` count;
   every child row that had a `fundo` link now also has an `entidade` link
   pointing at the same id; fields byte-identical between old and new row.
4. Second schema push: remove `fundos` entity + its 3 old links entirely.
5. Admin-delete any now-orphaned `fundos` rows/links data, independently
   re-verified.

**D5 — Permissions.** `shared/instant.perms.ts`'s existing `donoRules` block
applies to `entidades` exactly as it did to `fundos` — no per-`tipoEntidade`
special-casing. Same rule, new entity name.

**D6 — `apollo import` (`batch_import.py`) compatibility.** Rename
`fundoId`/fundo-natural-key handling to `entidadeId`, but make `tipoEntidade`
**optional** in the import JSON schema, defaulting to `"Fundo"` when omitted —
existing/future batch-import JSON files written before this change keep
working without edits.

**D7 — Dashboard component naming.** `RoutinesByFundo.svelte` /
`rotinasPorFundo` (in `derive.ts`) renamed to `RoutinesByEntidade.svelte` /
`rotinasPorEntidade`, along with `FundoDialog.svelte` -> `EntidadeDialog.svelte`,
`defs/fundos.ts` -> `defs/entidades.ts`, and every other fundo-named
file/identifier the planner's own repo scan turns up (`cli/apollo_cli/
entities/fundo.py` -> `entidade.py`, etc.).

### Claude's Discretion
- Exact migration script location/structure (mirror
  `cli/scripts/cleanup_rotina_test_data.py`'s transient-script convention).
- Whether the rename touches `web/e2e/fixtures/instancia-admin-fixture.ts` and
  other fixture helper names — planner's discretion based on actual content
  found.
- Task/wave breakdown given the scope — likely too large for a single 1-3
  task quick plan; size tasks appropriately (schema+migration as an early
  tracer task, CLI rename, web rename, e2e rename as separate tasks).

### Deferred Ideas (OUT OF SCOPE)
None documented as deferred in CONTEXT.md — this task has no explicitly
deferred sub-scope; D2's rejection of a separate types-catalog entity/screen
is the closest thing to an explicit non-goal ("a dedicated types-catalog
screen was not requested and would be new scope, not migration of existing
scope").
</user_constraints>

## Summary

This is a real schema rename + data migration across all three runtimes
(`shared/`, `cli/`, `web/`), not a label-only UI change. The blast radius is
large in file *count* (29 non-gitignored files reference "fundo" across
`shared/`, `cli/`, `web/src/`, `web/e2e/`) but the actual **migration risk is
much smaller than CONTEXT.md's own historical framing suggests**: live
production right now holds **58 `fundos` rows and ZERO `projetos`/`tickets`/
`templatesRotina`/`instanciasRotina` rows** (verified live via `apollo fundo
listar` / `apollo projeto listar` / `apollo ticket listar` / `apollo rotina
template listar` / `apollo rotina instancia listar`, all queried this
session). CONTEXT.md's own D4 migration plan describes re-linking
`projetos`/`templatesRotina`/`tickets` child rows from `fundo` to `entidade`
— that re-linking step has **zero rows to actually process today**. Write the
migration script generically (it must still handle relinking correctly, since
someone could `apollo import` templates against these fundos before this task
lands), but do not expect the "verify every child row got the new link" step
to have any real work to check against.

The good architectural news: both the CLI (`entities/__init__.py`'s
`pkgutil.iter_modules` auto-discovery of any module exporting `group:
click.Group`) and the web SPA (`registry.ts`'s `import.meta.glob("./defs/*.ts")`
auto-discovery) are **zero-registration-list** systems. Renaming
`fundo.py` -> `entidade.py` (with `@click.group(name="entidade")`) and
`defs/fundos.ts` -> `defs/entidades.ts` (with `etype: "entidades"`) requires
**no edit anywhere else** to re-wire CLI subcommand registration or SPA entity
registry — `EntityScreen.svelte` and `registry.ts` have zero "fundo"
references today (grep-verified, zero hits) and never need any.

The single riskiest technical assumption in CONTEXT.md's D4 — reusing the
same row id across two different InstantDB entity/table namespaces
(`fundos` id X and `entidades` id X coexisting) — is **verified safe** by
reading the vendored `@instantdb/core` SDK source directly (see
`## InstantDB Id-Reuse Verification` below): entity *identity* attrs
(`fundos/id` vs `entidades/id`) are separate, namespace-scoped attributes in
the triple store, and both `checkEntityExists` and `deleteEntity` explicitly
filter by `attr['forward-identity'][1] === etype` before acting — meaning
writing/deleting `entidades` triples for an id never touches that same id's
`fundos` triples. This is exactly the mechanic D4 assumes.

CONTEXT.md's D4 step 5 ("admin-delete any now-orphaned `fundos` rows/links
data" as a step separate from step 4's schema push) is very likely
**redundant, not merely cautious** — see `## Schema-Push Deletion Semantics`
below: InstantDB's own CLI docs confirm that a field/entity *deletion*
(as opposed to a rename) during schema push **already destroys the
underlying data**, not just its type registration. Recommend the planner
still keep step 5 as a defensive verification-only step (re-query and
confirm 0 rows) rather than remove it outright, since a live check costs
nothing and the docs evidence, while strong, is about `delete-attr` in
general rather than this exact "delete namespace" grouping.

**Primary recommendation:** Treat this as roughly 4 sequential tracer tasks:
(1) additive schema push + migration script + verify + destructive schema
push (D4 steps 1-5, in one plan since they're one continuous live sequence
touching production), (2) CLI rename (`fundo.py` -> `entidade.py`,
`batch_import.py`, `projeto.py`/`ticket.py`/`rotina.py`'s `--fundo-id`
options, `cli.py` docstrings, `cli/tests/*`), (3) web rename (`defs/fundos.ts`,
`derive.ts`, `Dashboard.svelte` + all 8 dialog/section components,
`dashboardQuery.ts`), (4) e2e rename (`entities-fundos.spec.ts` and every
`["fundo", ...]` CLI-fixture invocation across 15 spec files, plus
`no-leakage.spec.ts`'s `ENTITY_NAMES` literal and `test_cli_surface.py`'s
CLI-surface inventory dict).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entity schema definition (`entidades`, `tipoEntidade`, 3 links) | Database (InstantDB schema) | — | `shared/instant.schema.ts` is the single source of truth both runtimes read from (PROJECT.md C-01) |
| Permission enforcement (donoId scoping) | Database (InstantDB perms) | — | `shared/instant.perms.ts`'s `donoRules`, unconditionally applied per-entity |
| Data migration (fundos rows -> entidades rows, id reuse, re-linking) | API/Backend (admin script) | Database | One-time admin-token script using `instantdb` Python SDK directly against InstantDB's admin API — no UI or CLI-user-facing surface |
| CLI CRUD surface (`apollo entidade criar/editar/deletar/listar`) | API/Backend (CLI-as-client) | Database | `cli/apollo_cli/entities/entidade.py`, thin wrapper over `crud_helpers` generic functions |
| CLI batch import (`apollo import`, entidadeId/tipoEntidade handling) | API/Backend (CLI-as-client) | Database | `batch_import.py`'s validation + natural-key resolution logic |
| SPA generic CRUD screen (`EntityScreen.svelte` + `defs/entidades.ts`) | Browser/Client (SPA) | Database | Config-driven, already fully generic — zero `etype`-specific branching to touch |
| SPA dashboard rendering (grouping, dialogs, kanban) | Browser/Client (SPA) | — | `derive.ts` pure functions + `Dashboard.svelte`/`RoutinesByFundo.svelte`/`FundoDialog.svelte` presentation layer |
| e2e verification (fixtures, CLI-invocation sweeps, nav testids) | Browser/Client (Playwright, out-of-band) | API/Backend (CLI fixture calls) | Tests call both the CLI (`apolloCli(["fundo", ...])`) and the SPA UI (`nav-fundos` testid) — both surfaces must rename in lockstep with the runtime code |

## Package Legitimacy Audit

**Not applicable.** This task introduces zero new external packages in any
ecosystem. The migration script reuses the already-installed, already-vetted
`instantdb` Python package (v1.0.63, already pinned in `cli/pyproject.toml`
and used throughout the CLI) and `httpx` (already a transitive dependency).
No `npm install`/`pip install`/`uv add` of any new package is required for
this rename+migration.

## Full File Enumeration

Enumerated via `grep -rli "fundo" <dir>` (case-insensitive) across the four
scoped directories, 2026-09-22. Two files are excluded from the table below
because they are gitignored, transient Playwright test-runner artifacts, not
source: `web/e2e/.auth/user.json`, `web/e2e/.auth/LOGIN-EVIDENCE.txt`
(confirmed via `git check-ignore -v`; they regenerate on the next `playwright
test --project=setup` run and contain incidental "fundos" substrings from
cached page/email content, not code).

### shared/ (2 files)

| File | Hits | What needs to change |
|------|------|----------------------|
| `shared/instant.schema.ts` | 11 | `fundos: i.entity({...})` -> `entidades: i.entity({..., tipoEntidade: i.string()})`; 3 links (`fundoProjetos`/`fundoTemplatesRotina`/`fundoTickets`) -> `entidadeProjetos`/`entidadeTemplatesRotina`/`entidadeTickets` per D3, `reverse.on: "entidades"`, forward `label: "entidade"` |
| `shared/instant.perms.ts` | 1 | `rules.fundos: donoRules` -> `rules.entidades: donoRules` (key rename only, rule body unchanged per D5) |

### cli/apollo_cli/ (6 files)

| File | Hits | What needs to change |
|------|------|----------------------|
| `cli/apollo_cli/batch_import.py` | 95 | `_ETYPE_FUNDO = "fundos"` -> `"entidades"`; every `fundoId`/`fundo_id` field/param -> `entidadeId`/`entidade_id`; `tipoEntidade` added as optional field defaulting `"Fundo"` per D6; docstrings (module + every function) rewritten; report key `"fundos"` -> `"entidades"`; `_check_fundo_form`/`_check_fundo_codigo_uniqueness`/`_resolve_fundos`/`_resolved_fundo_id` renamed; the `("fundos", index)` tuples in `_check_local_id_uniqueness` |
| `cli/apollo_cli/entities/fundo.py` -> `entidade.py` | 14 | Whole-file rename; `_ETYPE = "fundos"` -> `"entidades"`; `@click.group(name="fundo")` -> `name="entidade"`; add `--tipo` (or similar) option wired to `tipoEntidade` (required per D2 — `criar` must require it, `editar` optional to update it); docstrings |
| `cli/apollo_cli/entities/projeto.py` | 20 | `_PARENT_ETYPE = "fundos"` -> `"entidades"`; `_resolve_fundo_link` -> `_resolve_entidade_link`; `--fundo-id` CLI option -> `--entidade-id`; `{"fundo": fundo_id}` link dict -> `{"entidade": entidade_id}`; docstrings |
| `cli/apollo_cli/entities/ticket.py` | 21 | Same pattern as `projeto.py`: `_PARENT_ETYPE`, `_resolve_fundo_link`, `--fundo-id` -> `--entidade-id`, link dict key, `where = {"fundo.id": ...}` -> `{"entidade.id": ...}` in `listar` |
| `cli/apollo_cli/entities/rotina.py` | 13 | `_ETYPE_FUNDO = "fundos"` -> `"entidades"`; `--fundo-id` (criar/editar/listar) -> `--entidade-id`; `where = {"fundo.id": ...}` -> `{"entidade.id": ...}`; `_resolve_ref(etype=_ETYPE_FUNDO, ..., link_label="fundo")` -> `link_label="entidade"` |
| `cli/apollo_cli/cli.py` | 8 | Top-level docstring listing entity command groups (`fundo, projeto, etapa, ...`) -> `entidade, ...`; `apollo import --from-json` help text's `fundos`/`fundoId` mentions -> `entidades`/`entidadeId` |

**Not in scope for edits (verified generic, zero fundo-specific code):**
`cli/apollo_cli/crud_helpers.py` (zero "fundo" hits — fully generic
`create_entity`/`update_entity`/`delete_entity`/`list_entities`/`get_entity`),
`cli/apollo_cli/entities/__init__.py` (auto-discovery via `pkgutil` — no
per-entity registration list to edit).

### cli/tests/ (11 files)

| File | Hits | What needs to change |
|------|------|----------------------|
| `cli/tests/test_batch_import.py` | 206 | Every fixture/assertion built around `fundos`/`fundoId`/`fundo_id` in JSON batch payloads; this is the largest single file to touch — likely its own task |
| `cli/tests/test_cross_user_isolation.py` | 33 | `tp_owned_fundo` fixture -> `tp_owned_entidade`; `client.tx.fundos[...]` -> `client.tx.entidades[...]`; `cleanup_records.append(("fundos", fundo_id))` -> `("entidades", ...)`; VERIFY-05 assertion text mentioning `apollo fundo listar` |
| `cli/tests/test_crud_ticket.py` | 28 | `_query_ticket(..., with_fundo=...)` -> `with_entidade`; `_create_fundo` helper -> `_create_entidade`; `["fundo", "criar", ...]` CLI invocation -> `["entidade", "criar", ...]` |
| `cli/tests/test_crud_rotina_template.py` | 23 | Same `_create_fundo` helper pattern + `{"fundo": {}, "antecessor": {}}` sub-query -> `{"entidade": {}, ...}` |
| `cli/tests/test_crud_projeto.py` | 19 | `_query_projeto(..., with_fundo=...)`, `test_criar_with_fundo_link_resolves` -> rename test + body, `_create_fundo` helper |
| `cli/tests/test_crud_fundo.py` -> `test_crud_entidade.py` | 18 | Whole-file rename; `_query_fundo` -> `_query_entidade`; `client.query({"fundos": ...})` -> `{"entidades": ...}`; `["fundo", "criar", ...]` -> `["entidade", "criar", ...]` |
| `cli/tests/test_auth_rejection.py` | 8 | `client.tx.fundos[new_id()].create(...)` (×3, cross-user negative-permission fixtures) -> `client.tx.entidades[...]`; `["uv", "run", "apollo", "fundo", "criar", ...]` subprocess invocations -> `"entidade"`; `client.query({"fundos": ...})` |
| `cli/tests/test_packaging_live.py` | 2 | `fundo listar` mention in a comment about an env-var override; `[str(apollo_bin), "fundo", "listar"]` subprocess call -> `"entidade"` |
| `cli/tests/test_cli_surface.py` | 1 | Literal inventory dict entry `"fundos": (["fundo"], {"criar","editar","deletar","listar"}, False)` -> `"entidades": (["entidade"], {...}, False)` — this is the CLI-surface completeness check, must track the rename exactly |
| `cli/tests/test_batch_import_file_errors.py` | 1 | `path.write_text('{"fundos": []}', ...)` fixture payload -> `'{"entidades": []}'` |
| `cli/tests/conftest.py` | 1 | Docstring reference to `test_crud_fundo.py` (update to new filename) |

### web/src/ (19 files)

| File | Hits | What needs to change |
|------|------|----------------------|
| `web/src/lib/dashboard/derive.test.ts` | 56 | Test suite for `derive.ts` — every `rotinasPorFundo`/`rotinasDoFundo` test case, fixture shape (`InstanciaAgendaLike.template.fundo`), and assertion text |
| `web/src/lib/dashboard/derive.ts` | 52 | `rotinasPorFundo` -> `rotinasPorEntidade`, `rotinasDoFundo` -> `rotinasDoEntidade`; `Item.fundoId` -> `entidadeId`; `ProjetoFundoLike`/`InstanciaAgendaLike`/`TicketAgendaLike`'s `fundo`/`fundoId` fields -> `entidade`/`entidadeId`; every doc comment referencing "fundo grouping" |
| `web/src/lib/dashboard/Dashboard.svelte` | 47 | `FundoRow` type -> `EntidadeRow`; `openFundoDialog`/`fundoNomeFor`/`fundoDialogProjetos`/`fundoDialogTickets`/`fundoByProjetoId` renamed; `DialogKind` union's `"fundo"` -> `"entidade"`; `import FundoDialog from "./dialogs/FundoDialog.svelte"` -> `EntidadeDialog`; `import { ..., rotinasPorFundo } from "./derive"` -> `rotinasPorEntidade`; `<RoutinesByFundo ... onOpenFundo={openFundoDialog}>` -> `<RoutinesByEntidade ... onOpenEntidade={...}>`; `query.data?.fundos` -> `?.entidades` (must match renamed `dashboardQuery.ts` key) |
| `web/e2e/focus-dialog-fundo.spec.ts` -> `focus-dialog-entidade.spec.ts` | 88 | Whole-file rename; every `["fundo", ...]` CLI-fixture call, `nav-fundos` testid references, `(f) editar drives EntityScreen(fundos)` test name/body |
| `web/e2e/projetos-section.spec.ts` | 55 | `["fundo", "criar"/"listar", ...]` CLI-fixture sweep calls, comments about deletion order ("tickets before fundos") |
| `web/src/lib/dashboard/dialogs/FundoDialog.svelte` -> `EntidadeDialog.svelte` | 28 | Whole-file rename; `requireConfig("fundos")` -> `requireConfig("entidades")`; `fundosConfig` var; props `fundoId`/`fundoNome` -> `entidadeId`/`entidadeNome`; `rotinasDoFundo` import; `nav-fundos` selector in `verPagina()`; `fundo-dialog-*` testids -> `entidade-dialog-*` |
| `cli/tests/test_crud_ticket.py` | (see cli/tests table above) | — |
| `web/e2e/focus-dialog-button-inventory.spec.ts` | 34 | Same CLI-fixture-sweep pattern (`apolloCli(["fundo", "listar"])`) |
| `cli/tests/test_cross_user_isolation.py` | (see cli/tests table above) | — |
| `web/src/lib/dashboard/dialogs/RoutinesByFundo.svelte` -> `RoutinesByEntidade.svelte` | 26 | Whole-file rename (D7); `Grupo.fundoId`/`fundoNome` -> `entidadeId`/`entidadeNome`; every `data-testid="rotinas-fundo-*"` -> `rotinas-entidade-*`; `onOpenFundo` prop -> `onOpenEntidade`; the `agrupar: "fundo"` single-value Select (both the type union and the literal `"fundo"` string + label) -> `"entidade"`; "Sem fundo vinculado" copy -> "Sem entidade vinculada" |
| `web/e2e/entities-projeto-etapa-tarefa.spec.ts` | 23 | CLI-fixture sweep (`apolloCli(["fundo", "listar"])`) |
| `web/e2e/entities-form-restyle.spec.ts` | 23 | Same CLI-fixture pattern + `nav-fundos` selector, test names mentioning "fundos (full-CRUD)" |
| `cli/tests/test_crud_rotina_template.py` | (see cli/tests table above) | — |
| `cli/apollo_cli/entities/ticket.py` | (see cli/apollo_cli table above) | — |
| `web/e2e/cross-phase-verification.spec.ts` | 20 | `nav-fundos` selector, test names ("fundos leg: full-CRUD representative") |
| `cli/apollo_cli/entities/projeto.py` | (see cli/apollo_cli table above) | — |
| `cli/tests/test_crud_projeto.py` | (see cli/tests table above) | — |
| `cli/tests/test_crud_fundo.py` | (see cli/tests table above) | — |
| `web/e2e/focus-dialog-dia-rotina.spec.ts` | 16 | CLI-fixture sweep |
| `web/e2e/focus-dialog-projetos-kanban.spec.ts` | 15 | CLI-fixture sweep + `onOpenFundo` wiring assertions |
| `web/src/lib/sections/ProjetosSection.svelte` | 14 | `GroupBy = "fundo" | "nenhum" | "status"` union -> `"entidade" | ...`; `groupBy` default `$state<GroupBy>("fundo")` -> `"entidade"`; `projeto.fundo?.nome` reads -> `.entidade?.nome`; `<Select.Item value="fundo" ...>` -> `"entidade"`; "Sem fundo vinculado" copy |
| `web/e2e/focus-dialog-ticket.spec.ts` | 14 | CLI-fixture sweep |
| `web/e2e/entities-fundos.spec.ts` -> `entities-entidades.spec.ts` | 14 | Whole-file rename; `sweepLeftovers` etype target, `nav-fundos` selector, test names |
| `web/e2e/dashboard-kanbans.spec.ts` | 14 | CLI-fixture sweep (`apolloCli(["fundo", "listar"])`), sweep-order comments |
| `cli/apollo_cli/entities/fundo.py` | (see cli/apollo_cli table above) | — |
| `cli/apollo_cli/entities/rotina.py` | (see cli/apollo_cli table above) | — |
| `web/e2e/focus-dialog-projeto.spec.ts` | 12 | CLI-fixture sweep |
| `web/e2e/entities-table-restyle.spec.ts` | 12 | `nav-fundos` selector, "ENTTBL: fundos (full-CRUD)" test name |
| `web/e2e/entities-header-states.spec.ts` | 11 | `nav-fundos` selector, test names ("ENTTBL-04/05/06: fundos ...") |
| `web/src/lib/dashboard/ProjectStrips.svelte` | 9 | `FundoRow` type -> `EntidadeRow`; `ProjetoRow.fundo` -> `.entidade`; `onOpenFundo` prop -> `onOpenEntidade`; `project-strip-fundo-badge` testid -> `project-strip-entidade-badge`; "Sem fundo vinculado" copy |
| `cli/tests/test_auth_rejection.py` | (see cli/tests table above) | — |
| `cli/apollo_cli/cli.py` | (see cli/apollo_cli table above) | — |
| `web/src/lib/entities/defs/fundos.ts` -> `defs/entidades.ts` | 6 | Whole-file rename; `etype: "fundos"` -> `"entidades"`; `titulo: "Fundos"` -> `"Entidades"`; add `tipoEntidade` field (required, `kind: "text"`) to the `fields`/`listColumns` arrays per D2 |
| `web/src/lib/dashboard/dashboardQuery.ts` | 6 | Query shape: `fundos: {}` top-level branch -> `entidades: {}`; every `projetos: { fundo: {}, ... }` / `instanciasRotina: { template: { fundo: {} } }` / `tickets: { fundo: {}, ... }` nested branch -> `entidade: {}` |
| `web/e2e/entities-form-dialog-composition.spec.ts` | 5 | "ENTFRM-07: submitting fundos' create Dialog ..." test name, `nav-fundos` selector |
| `web/e2e/.auth/LOGIN-EVIDENCE.txt` (gitignored, excluded) | 5 | — |
| `web/src/lib/entities/defs/tickets.ts` | 4 | `links: [{ label: "fundo", targetEtype: "fundos", ... }]` -> `label: "entidade", targetEtype: "entidades"`; `listColumns` array's `"fundo"` entry -> `"entidade"` |
| `web/src/lib/entities/defs/projetos.ts` | 4 | Same pattern as `defs/tickets.ts` |
| `web/src/lib/dashboard/dialogs/TaskDialog.svelte` | 3 | `fundoNome?: string | null` prop -> `entidadeNome`; `contexto` string interpolation |
| `web/src/lib/dashboard/TicketQueue.svelte` | 3 | Row shape's `fundo?: {...}` -> `entidade?`; "Sem fundo" copy |
| `web/src/lib/entities/types.ts` | 2 | Two doc-comment examples (`"fundo"`, `"fundos"`) illustrating the generic `EntityLink` type — comment text only, no functional change |
| `web/src/lib/entities/registry.test.ts` | 2 | `fundos: { create: true, update: true, delete: true }` capability fixture -> `entidades: {...}`; a `"fundos"` string in an array fixture (line 326) |
| `web/src/lib/entities/defs/templatesRotina.ts` | 2 | `links: [{ label: "fundo", targetEtype: "fundos", ... }]` -> `entidade`/`entidades`; `listColumns` `"fundo"` entry -> `"entidade"` |
| `web/src/lib/dashboard/dialogs/TicketDialog.svelte` | 2 | `fundo?: {...} | null` prop -> `entidade?`; "Sem fundo" copy |
| `web/src/lib/dashboard/dialogs/RotinaDialog.svelte` | 2 | `fundoNome?: string | null` prop -> `entidadeNome`; `contexto` interpolation |
| `web/src/lib/dashboard/dialogs/ProjectDialog.svelte` | 2 | `fundoNome?: string | null` prop -> `entidadeNome`; `contexto` interpolation |
| `web/src/lib/dashboard/dialogs/EtapaDialog.svelte` | 2 | `fundoNome?: string | null` prop -> `entidadeNome`; `contexto` interpolation |

*(Note: several files above are cross-listed once in this table and once in
the CLI table due to how the directory scan overlaps — no file needs editing
twice; the `cli/tests`/`cli/apollo_cli` rows are the authoritative entry for
those paths.)*

### web/e2e/ (22 real files + 2 gitignored artifacts excluded)

| File | Hits | What needs to change |
|------|------|----------------------|
| `web/e2e/dashboard.spec.ts` | 114 | Largest e2e file to touch: `apolloCli(["fundo", "criar"/"listar", ...])` fixture calls throughout, `nav-fundos` selector, comments about deletion order |
| `web/e2e/focus-dialog-fundo.spec.ts` -> rename | 88 | (see web/src table above — cross-listed) |
| `web/e2e/projetos-section.spec.ts` | 55 | (see web/src table above) |
| `web/e2e/focus-dialog-button-inventory.spec.ts` | 34 | (see web/src table above) |
| `web/e2e/entities-projeto-etapa-tarefa.spec.ts` | 23 | (see web/src table above) |
| `web/e2e/entities-form-restyle.spec.ts` | 23 | (see web/src table above) |
| `web/e2e/cross-phase-verification.spec.ts` | 20 | (see web/src table above) |
| `web/e2e/focus-dialog-dia-rotina.spec.ts` | 16 | (see web/src table above) |
| `web/e2e/focus-dialog-projetos-kanban.spec.ts` | 15 | (see web/src table above) |
| `web/e2e/focus-dialog-ticket.spec.ts` | 14 | (see web/src table above) |
| `web/e2e/entities-fundos.spec.ts` -> rename | 14 | (see web/src table above) |
| `web/e2e/dashboard-kanbans.spec.ts` | 14 | (see web/src table above) |
| `web/e2e/focus-dialog-projeto.spec.ts` | 12 | (see web/src table above) |
| `web/e2e/entities-table-restyle.spec.ts` | 12 | (see web/src table above) |
| `web/e2e/entities-header-states.spec.ts` | 11 | (see web/src table above) |
| `web/e2e/entities-form-dialog-composition.spec.ts` | 5 | (see web/src table above) |
| `web/e2e/shell-nav.spec.ts` | 2 | `"nav-fundos": "Fundos"` map entry (both the testid string and expected label text) -> `"nav-entidades": "Entidades"` |
| `web/e2e/fixtures/instancia-admin-fixture.ts` | 2 | **No functional change needed** — `deleteAdminRecord(etype, eid)` is already fully generic by etype string, never hardcodes `"fundos"`. The 2 hits are comment prose ("sweepFundoLeftovers" mentioned as an example pattern name used in *other* spec files, not this one) |
| `web/e2e/entities-rotina-log.spec.ts` | 2 | Comment/doc-string mentions only (its own `sweepLeftovers` targets `templatesRotina`, not fundos) — verify no functional hit before touching |
| `cli/tests/test_packaging_live.py` | (cli table) | — |
| `web/e2e/no-leakage.spec.ts` | 1 | `ENTITY_NAMES` array literal: `"fundos"` entry -> `"entidades"` (this is a real functional assertion: the test checks the unauthenticated login page's body text never contains any entity name — must track the rename or the test silently stops checking anything) |
| `web/e2e/entities-ticket-subtarefa.spec.ts` | 1 | Single incidental hit — verify context before editing (likely a comment or unrelated CLI-fixture sweep call) |
| `web/e2e/entities-delete-confirmation.spec.ts` | 1 | Single incidental hit — verify context before editing |
| `cli/tests/test_cli_surface.py` | (cli table) | — |
| `cli/tests/test_batch_import_file_errors.py` | (cli table) | — |
| `cli/tests/conftest.py` | (cli table) | — |

**Excluded (gitignored, transient Playwright artifacts, regenerate on next
test run):** `web/e2e/.auth/user.json`, `web/e2e/.auth/LOGIN-EVIDENCE.txt`.

## InstantDB Id-Reuse Verification (CONTEXT.md D4's riskiest assumption)

**Claim under test:** "InstantDB ids are client-assigned UUIDs; reusing it
[for a new `entidades` row] means no id-mapping table is needed" — i.e. the
same UUID string can simultaneously be a valid `fundos` row id and a valid
`entidades` row id without collision or corruption.

**Verified true** — [VERIFIED: web/node_modules/@instantdb/core/src/instaml.ts:212-246]
by reading `checkEntityExists`:

```typescript
} else {
    // eid
    for (const store of stores || []) {
      const av = store?.eav.get(eid);
      if (av) {
        for (const attr_id of av.keys()) {
          if (attrsStore.getAttr(attr_id)?.['forward-identity'][1] == etype) {
            return true;
          }
        }
      }
    }
  }
  return false;
```

This function checks whether a given `eid` has attributes **specifically
belonging to the requested `etype`'s forward-identity** — not whether the eid
exists at all in the store. An id with only `fundos/*` attributes returns
`false` for `checkEntityExists(stores, attrs, "entidades", eid)`, meaning
InstantDB's own client SDK is built to let the same id string carry
independent per-namespace attribute sets simultaneously.

This is reinforced by `deleteEntity`
[VERIFIED: web/node_modules/@instantdb/core/src/store.ts:525-565], which,
when deleting entity `eid` scoped to `etype`, only removes triples where
`attr['forward-identity']?.[1] === etype` (or the reverse-identity
equivalent) — quote:

```typescript
if (
  // Fall back to deleting everything if we've rehydrated tx-steps from
  // the store that didn't set `etype` in deleteEntity
  !etype ||
  // If we don't know about the attr, let's just get rid of it
  !attr ||
  // Make sure it matches the etype
  attr['forward-identity']?.[1] === etype
) {
  deleteInMap(store.aev, [a, id]);
  deleteInMap(store.eav, [id, a]);
}
```

So deleting the `fundos` namespace entirely (D4 step 4/5) for an id that also
has `entidades` attributes will **not** touch the `entidades` attributes for
that same id, as long as the delete step is scoped `etype: "fundos"` (which
`instant-cli push`'s generated `delete-namespace` migration is, per
`renderSchemaPlan.ts`'s `delete-attr` step shape, each carrying its own
`identifier.namespace`).

**Caveat:** this is client-SDK (`@instantdb/core`) source, which encodes the
intended data model and is what the reactive/optimistic local store does —
it is strong evidence of the *design*, not a direct read of the server's
authoritative Clojure/Datalog implementation (which is closed-source and not
vendored anywhere in this repo). Given the client SDK is built directly
against the server's actual triple-store semantics (same team, same wire
protocol, InstantDB's whole value proposition is client/server store
consistency), and this pattern (per-etype-scoped identity attrs) is
structural to how InstantDB's `forward-identity`/`reverse-identity` attr
model works everywhere else in the same source tree, treat this as
[VERIFIED] for planning purposes, not [ASSUMED] — but if paranoia is
warranted, the D4 step 3 "verify live" checkpoint already independently
re-confirms this in production before step 4's destructive push runs.

## Schema-Push Deletion Semantics (addresses CONTEXT.md D4 step 4 vs step 5)

**Question:** Does removing `fundos` from `instant.schema.ts` and running
`instant-cli push` actually delete the underlying row data, or does it just
stop type-checking/validating that namespace (leaving orphaned data behind
that step 5's explicit admin-delete would then need to clean up)?

**Finding: it already deletes the data** — [CITED: instantdb.com/docs/cli]:

> "Choosing 'create' deletes the old field and creates a new one, losing the
> existing data" — describing the interactive prompt `instant-cli push` shows
> when an attribute looks renamed vs. newly-created. The `rename` option
> exists specifically because the "create" path is destructive.

This is further corroborated by reading the vendored CLI/platform source:
`renderSchemaPlan.ts` groups a whole-namespace removal (every attr in
`fundos`, including its `id` attr) into a `delete-namespace` migration made
of individual `delete-attr` steps, and `@instantdb/platform/src/api.ts`'s
`translatePlanStep` for `delete-attr` produces the friendly description
`` `Delete attribute ${friendlyName}.` `` — i.e. the push mechanism has no
separate "unregister but keep data" mode; deletion is the only operation
available for a namespace no longer declared in schema.

**Implication for the plan:** D4 step 4 (second schema push removing
`fundos` + its 3 old links) is very likely **sufficient on its own** to
destroy all `fundos` row data — D4 step 5 (a separate explicit admin-delete)
is likely redundant with step 4, not an additional necessary safety net.
Recommend keeping step 5 in the plan anyway, but reframed as a
**verification-only** check ("query `fundos` post-push, assert 0 rows") —
cheap, catches the case where the push behaved unexpectedly, and costs
nothing if step 4 already did the deletion.

## Live Production State (verified this session, changes D4's risk sizing)

Queried live via `apollo <entity> listar` against the real production
InstantDB app (same app STATE.md/PROJECT.md describe as the sole environment
this project uses — no separate test app exists):

| Entity | Live count (this session) | Note |
|--------|---------------------------|------|
| `fundos` | **58** | 18 are the real RBR onboarding funds (created 2026-08-14); 40 are `LOTE-F*` test-residue rows from prior `batch_import`/e2e live-test runs (created 2026-09-22, same day as this task) — not cleaned up, but harmless to migrate identically (D4 makes no distinction, migrates every row) |
| `projetos` | **0** | `apollo projeto listar` -> `[]` |
| `tickets` | **0** | `apollo ticket listar` -> `[]` |
| `templatesRotina` | **0** | `apollo rotina template listar` -> `[]` (previously wiped by quick-task `260922-t1l`) |
| `instanciasRotina` | **0** | `apollo rotina instancia listar` -> `[]` (same) |

**Implication:** D4 step 2's "re-link every `projetos`/`templatesRotina`/
`tickets` row from its old `fundo` link to the new `entidade` link" has
**zero rows to actually re-link right now**. The migration script must still
implement this logic correctly and generically (someone could create
projetos/tickets/templates linked to a fundo between now and when this plan
executes, and the code should not assume 0 forever), but the plan's own live
verification step (D4 step 3) should not be surprised to see 0 re-linked
rows — that is the correct, expected outcome given current production state,
not a sign the migration script is broken.

## Architecture Patterns

### Recommended Project Structure

No new directories. Renames only, in place:

```
shared/
├── instant.schema.ts       # fundos entity+links -> entidades entity+links
└── instant.perms.ts        # rules.fundos -> rules.entidades

cli/apollo_cli/
├── batch_import.py          # fundoId -> entidadeId, tipoEntidade optional/"Fundo" default
├── cli.py                   # docstring updates only
└── entities/
    ├── entidade.py           # renamed from fundo.py
    ├── projeto.py            # --fundo-id -> --entidade-id
    ├── ticket.py             # --fundo-id -> --entidade-id
    └── rotina.py             # --fundo-id -> --entidade-id

cli/scripts/
└── migrate_fundos_to_entidades.py   # NEW, transient — mirrors
                                       # cleanup_rotina_test_data.py's
                                       # convention (outside apollo_cli
                                       # package, deleted after use)

web/src/lib/
├── entities/defs/
│   └── entidades.ts          # renamed from fundos.ts
├── dashboard/
│   ├── derive.ts             # rotinasPorFundo -> rotinasPorEntidade, etc.
│   ├── dashboardQuery.ts     # fundos: {} -> entidades: {}
│   ├── Dashboard.svelte      # FundoRow -> EntidadeRow, DialogKind, etc.
│   ├── RoutinesByEntidade.svelte   # renamed from RoutinesByFundo.svelte
│   └── dialogs/
│       └── EntidadeDialog.svelte  # renamed from FundoDialog.svelte

web/e2e/
├── entities-entidades.spec.ts     # renamed from entities-fundos.spec.ts
└── focus-dialog-entidade.spec.ts  # renamed from focus-dialog-fundo.spec.ts
```

### Pattern 1: Zero-registration-list entity discovery (already in place, do not touch)

**What:** Both the CLI and the SPA discover entity modules automatically —
no central list to keep in sync when renaming.
**When to use:** Already the established pattern; the rename must preserve
it (do not accidentally introduce a manual registration list while renaming).
**Example (CLI side):**
```python
# Source: cli/apollo_cli/entities/__init__.py:19-30 (read in full this session)
def discover_entity_groups() -> list[click.Group]:
    groups: list[click.Group] = []
    for module_info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{module_info.name}")
        group = getattr(module, "group", None)
        if not isinstance(group, click.Group):
            raise TypeError(...)
        groups.append(group)
    return sorted(groups, key=lambda group: group.name or "")
```
**Example (SPA side):**
```typescript
// Source: web/src/lib/entities/registry.ts:6 (read this session)
const modules = import.meta.glob("./defs/*.ts", { eager: true }) as Record<...>;
```
Renaming `fundo.py` -> `entidade.py` (keeping `group: click.Group` exported)
and `defs/fundos.ts` -> `defs/entidades.ts` (keeping the default export) is
**sufficient** — no other file references either module by path.

### Pattern 2: Natural-key idempotent migration script (mirror `260922-t1l`)

**What:** A transient, admin-token, dry-run-first script living outside
`apollo_cli` (so it's invisible to `test_auth_rejection.py`'s admin-token
confinement AST gate, which only walks `cli/apollo_cli/**/*.py`).
**When to use:** For D4's migration script.
**Example shape (mirrors `cli/scripts/cleanup_rotina_test_data.py`'s proven
structure, per `260922-t1l-SUMMARY.md`):**
```python
# Pattern, not verbatim source (that script was deleted after use per its
# own convention) — reconstructed from 260922-t1l-SUMMARY.md's description:
def main(confirmar: bool) -> None:
    client = login_client()  # from apollo_cli.instant_client
    fundos = client.query({"fundos": {}})["fundos"]
    before = {"fundos": len(fundos), "entidades": ...}
    print(json.dumps({"before": before, "confirmado": confirmar}))
    if not confirmar:
        return
    # ... create entidades rows reusing fundos ids, re-link children ...
```

### Anti-Patterns to Avoid
- **Skipping the additive-first schema push:** Do not combine D4 steps 1 and
  4 into a single schema push. C-05-equivalent discipline (this project's own
  established pattern for `templatesRotina.offsetDias`/`diaSemana`) requires
  additive-then-verify-then-destructive, never a single atomic schema swap
  that could leave data unrecoverable if the migration script has a bug.
- **Trusting id-reuse without the live verify step:** Even though the SDK
  source confirms id-reuse is safe by design (see above), D4 step 3's live
  verification (row counts + per-id field byte-identity) is not redundant —
  it catches migration-script bugs (e.g. a typo copying the wrong field),
  not SDK-level id-collision risk.
- **Special-casing `tipoEntidade` in permissions:** D5 explicitly forbids
  per-`tipoEntidade` permission rules — do not add a `where tipoEntidade =
  "Fundo"` branch anywhere in `instant.perms.ts` or in query `where` clauses
  by default; `tipoEntidade` is a display/filter field, never an
  authorization dimension.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI subcommand registration after rename | A manual "register these groups" list | Existing `pkgutil.iter_modules` auto-discovery (`entities/__init__.py`) | Already works, zero edits needed beyond the file rename itself |
| SPA entity registry after rename | A manual entity-config import list | Existing `import.meta.glob("./defs/*.ts")` (`registry.ts`) | Same — already works, zero edits needed |
| Migration id correlation | A separate `fundo_id -> entidade_id` mapping table/JSON | Id reuse (D4's own decision) — same UUID string for both rows | Verified safe (see `## InstantDB Id-Reuse Verification`); a mapping table would be genuinely unnecessary extra state to keep consistent |
| Post-push orphan cleanup | A new generic "detect and delete orphaned rows for any removed entity" tool | The `instant-cli push` destructive removal itself (see `## Schema-Push Deletion Semantics`) + a simple post-push count-check | The push already does the deletion; building a separate sweeper duplicates `instant-cli`'s own behavior |

**Key insight:** This project has already established every reusable pattern
this task needs (auto-discovery registries, additive-schema-first migration
discipline, transient admin-script convention) in prior phases/quick-tasks —
this task's job is applying those patterns consistently across ~50 files,
not inventing anything new.

## Runtime State Inventory

This is a rename+migration task; the canonical question applies: *after
every file in the repo is updated, what runtime systems still have the old
string cached, stored, or registered?*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live InstantDB production app: 58 `fundos` rows (verified this session via `apollo fundo listar`) | Data migration — D4's admin script (create `entidades` rows reusing ids, `tipoEntidade: "Fundo"`) |
| Stored data (child links) | 0 `projetos`/`tickets`/`templatesRotina` rows currently link to any `fundo` (verified this session — all three `listar` commands return `[]`) | No re-linking work exists today, but the migration script must still implement it generically for future rows created before this task lands |
| Live service config | None found — InstantDB schema/perms are the only "external service config," and both are files in `shared/` already tracked in git (not a separate UI-configured service like n8n) | None |
| OS-registered state | None — this is a rename touching schema/CLI/web source only, no OS-level task scheduler, pm2, or systemd registration involved | None |
| Secrets/env vars | None — `.env.instantdb`'s `NEXT_PUBLIC_INSTANT_APP_ID`/`INSTANT_APP_ADMIN_TOKEN` reference the InstantDB *app*, not the `fundos` entity name; unaffected by this rename | None |
| Build artifacts | None found — no compiled/cached artifact embeds the string "fundos" as an identifier (Vite dev server and `uv` don't cache schema-derived types on disk in a way this rename would orphan) | None — a routine `bun run instant:pull`/typecheck after the schema push will regenerate any local type cache |

## Common Pitfalls

### Pitfall 1: `dashboardQuery.ts`'s two-hop query shape drift
**What goes wrong:** `dashboardQuery.ts` queries `instanciasRotina: { template:
{ fundo: {} } }` and `projetos: { fundo: {}, ... }`/`tickets: { fundo: {},
... }` as separate, independently-typed branches of one query object. If the
CLI/schema rename to `entidade` link label happens but this file's link keys
aren't updated in the same commit, the SPA's `db.useQuery()` silently returns
`undefined` for the nested `entidade`/`fundo` field (InstantDB doesn't error
on an unknown link label in a query, it just returns nothing for that
branch) rather than throwing — masking the bug as "no fundo/entidade shows
up in the dashboard" instead of a clear error.
**Why it happens:** InstantDB's InstaQL is structurally permissive; a stale
link-label string doesn't fail loudly.
**How to avoid:** Update `dashboardQuery.ts` in the SAME task/commit as the
schema push (D4 step 1), and manually verify via `adminQuery`/live Playwright
run that `entidade` data actually appears nested, not just that the app
doesn't crash.
**Warning signs:** Dashboard renders (no error), but every "Sem entidade
vinculada" bucket is unexpectedly large — that's the tell that the link
label didn't actually resolve.

### Pitfall 2: `RoutinesByFundo.svelte`'s hardcoded single-value Select
**What goes wrong:** `agrupar` is `$state<"fundo">("fundo")` — a
single-member type union deliberately modeling "there is currently only one
grouping key." Renaming the type parameter to `"entidade"` without also
updating the `<Select.Item value="fundo" label="fundo">fundo</Select.Item>`
JSX/markup line (which is a separate, unrelated-looking string) leaves the
UI showing "agrupar: entidade" in the trigger but a dropdown option still
literally labeled "fundo" — a visible, easy-to-miss inconsistency since
TypeScript won't catch a stale UI string.
**Why it happens:** The type-level rename (compiler-checked) and the
markup-level rename (not compiler-checked, since it's a plain string in a
Svelte template) are two different edits in the same file that must both
happen.
**How to avoid:** Grep the renamed file for the literal string `"fundo"`
(not just the identifier `fundo`) after the identifier-level rename is done,
specifically inside `<Select.Item>`/testid/copy strings.
**Warning signs:** e2e test `rotinas-agrupar` testid assertion still passes
(structure unchanged) but a human/screenshot review would catch the stale
label — automated tests alone won't catch this class of bug.

### Pitfall 3: `test_cli_surface.py`'s exhaustiveness check going silently stale
**What goes wrong:** This test file maintains a literal inventory dict
(`"fundos": (["fundo"], {"criar","editar","deletar","listar"}, False)`) that
some other assertion in the same file presumably iterates to confirm every
expected CLI subcommand exists with the exact expected verb set. If this
dict entry isn't renamed to `"entidades": (["entidade"], {...}, False)` in
lockstep with `entidade.py`'s actual `@click.group(name="entidade")`, the
test either (a) fails loudly (good — the safe outcome, since the old key
`"fundo"` group no longer exists to check against) or (b) if the test
iterates `entities/__init__.py`'s live-discovered groups by name and merely
checks "no unexpected group leaked in," could pass despite the inventory
listing a nonexistent group name — verify by reading the full file's
assertion logic during implementation, not just the fixture dict, before
assuming a green run means the rename is complete.
**Why it happens:** A literal test fixture dict is a second source of truth
for "the CLI surface" alongside the actual `entities/` module, and the two
can drift.
**How to avoid:** Read `test_cli_surface.py` in full during planning/
implementation (only the fixture dict line was grepped this session, not the
full test body) to confirm exactly how it fails when the two sources
disagree.
**Warning signs:** `pytest cli/tests/test_cli_surface.py` passes without
ever having actually run `apollo entidade --help`.

### Pitfall 4: e2e CLI-fixture sweep argv going stale silently (test pollution, not failure)
**What goes wrong:** 15 e2e spec files call `apolloCli(["fundo", "listar"])`
/ `apolloCli(["fundo", "criar", ...])` as **cleanup/setup fixtures**, not as
the test's actual assertion subject. If `apollo fundo` is renamed to `apollo
entidade` but even one of these 15 call sites is missed, that spec's
`sweepLeftovers()` silently starts failing to find/delete its own seeded
test rows (the CLI subprocess exits non-zero or the JSON parse fails) —
depending on how the fixture helper handles a CLI error, this could either
throw (loud, good) or silently leave `LOTE-F*`-style test residue
accumulating in production forever, exactly the kind of debt already visible
in the current 58-row `fundos` count (40 of which are exactly this class of
leftover from `batch_import` test runs).
**Why it happens:** 45 occurrences of the literal argv string `["fundo"`
across 15 files is a lot of near-identical, easy-to-miss call sites, and
`apolloCli()` is typically a thin wrapper that doesn't necessarily surface a
non-zero exit as a Playwright test failure if it's called in
`beforeEach`/`afterEach` teardown rather than the test body itself.
**How to avoid:** After the CLI rename, `grep -rn '\["fundo"' web/e2e/` must
return zero hits — treat this as a mechanical, exhaustive final check, not
"I renamed the ones I remember."
**Warning signs:** e2e suite stays green, but production `entidades` row
count creeps upward across CI runs (the same failure mode already visible
in this session's live query: 40/58 current `fundos` rows are exactly this
kind of accumulated test debris).

## Code Examples

### Renamed schema shape (target state, per CONTEXT.md D1-D3)

```typescript
// shared/instant.schema.ts — target shape
entidades: i.entity({
  nome: i.string(),
  codigo: i.string().indexed(),
  ativo: i.boolean(),
  tipoEntidade: i.string(),        // NEW, required (D2)
  donoId: i.string().indexed(),
  createdAt: i.date(),
}),

// links block:
entidadeProjetos: {
  forward: { on: "projetos", has: "one", label: "entidade" },
  reverse: { on: "entidades", has: "many", label: "projetos" },
},
entidadeTemplatesRotina: {
  forward: { on: "templatesRotina", has: "one", label: "entidade" },
  reverse: { on: "entidades", has: "many", label: "templatesRotina" },
},
entidadeTickets: {
  forward: { on: "tickets", has: "one", label: "entidade" },
  reverse: { on: "entidades", has: "many", label: "tickets" },
},
```

```typescript
// shared/instant.perms.ts — target shape
const rules = {
  entidades: donoRules,   // was: fundos: donoRules
  // ... unchanged otherwise
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single fixed `fundos` entity, one implicit type ("investment fund") | Generic `entidades` entity with a free-text `tipoEntidade` discriminator | This task | Every downstream consumer (CLI, SPA, dashboard grouping, batch import) that assumed "the fundo" must instead read/display `tipoEntidade` alongside `nome` |
| `apollo fundo` CLI command group | `apollo entidade` CLI command group, `--tipo` option | This task | No back-compat alias per D1 — any external script (e.g. `apollo import` JSON batch files, per D6) calling the old command name breaks; D6's `tipoEntidade` optional-defaulting-to-"Fundo" is the one deliberate compat exception |

**Deprecated/outdated:**
- `fundos`/`fundoProjetos`/`fundoTemplatesRotina`/`fundoTickets` schema
  entities and links — removed entirely per D4 step 4, no dead-schema
  retention.
- `RoutinesByFundo.svelte`/`FundoDialog.svelte`/`defs/fundos.ts` — deleted
  (renamed, not kept as thin wrappers) per D7.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | InstantDB's server-side (not just client-SDK) triple store genuinely enforces per-etype-scoped identity attrs identically to the vendored `@instantdb/core` client source read this session | InstantDB Id-Reuse Verification | If wrong, D4's id-reuse migration mechanic could corrupt data server-side in a way the client SDK wouldn't reveal until a real push; mitigated by D4 step 3's own live verification checkpoint before the destructive step 4 push runs |
| A2 | `instant-cli push`'s "delete-namespace" grouping (removing all of `fundos`' attrs including `id`) behaves identically, data-deletion-wise, to the single-attr "delete-attr" case the official docs describe | Schema-Push Deletion Semantics | If wrong (e.g. namespace-level deletion has different semantics than per-attr deletion), D4 step 5's admin-delete could turn out to be necessary after all, not redundant — low risk since the plan should keep step 5 as a defensive verify-only check regardless |
| A3 | No external consumer (script, saved bookmark, automation) outside this repo depends on the `apollo fundo` command name or the `fundos` schema entity name | User Constraints (D1's own stated rationale) | This is the user's own explicit rationale in CONTEXT.md D1, not this research session's finding — restated here per the Assumptions Log's requirement to surface every `[ASSUMED]`-tagged claim, though CONTEXT.md frames it as a confirmed decision, not an open question |

**If this table is empty:** N/A — see above; none of these three block
planning, all three already have a live verification checkpoint (D4 step 3,
D4 step 5-as-verify, or the user's own explicit decision) that would surface
a wrong assumption before it caused irreversible damage.

## Open Questions (RESOLVED)

All three questions below were resolved during planning — see PLAN.md for where each
resolution landed (noted inline per question).

1. **Exact `--tipo`/`tipoEntidade` CLI flag naming** — RESOLVED: Task 2 uses `--tipo-entidade`,
   exactly this research's own recommendation.
   - What we know: D2 requires a required-on-create, optional-on-edit
     free-text field. CONTEXT.md's `<specifics>` section explicitly defers
     exact label/flag wording to planner judgment ("Tipo", "Categoria", etc.
     is the planner's call).
   - What's unclear: Whether the CLI flag should be `--tipo` or
     `--tipo-entidade` (the schema field is `tipoEntidade`, but this
     project's existing CLI flags don't always mirror the schema field name
     1:1 — e.g. `regraCompetencia` maps to `--regra-competencia`, suggesting
     the convention IS a 1:1 kebab-case mirror).
   - Recommendation: Use `--tipo-entidade` for exact 1:1 consistency with
     every other flag in this codebase (`--regra-competencia` <->
     `regraCompetencia`, `--propagar-atraso-soft` <-> `propagarAtrasoSoft`).

2. **`test_cli_surface.py`'s full assertion logic** — RESOLVED: Task 2's action reflects a
   full read of the file's exhaustiveness-check mechanics, resulting in the documented
   transitional `_PENDING_SCHEMA_REMOVAL` design (introduced in Task 2, removed again in
   Task 4).

3. **Whether `web/e2e/entities-rotina-log.spec.ts` and
   `entities-ticket-subtarefa.spec.ts`/`entities-delete-confirmation.spec.ts`'s
   single incidental "fundo" hits are functional or purely comment/prose** — RESOLVED:
   Task 4 explicitly instructs opening each of these files and confirming functional vs.
   incidental before editing, rather than assuming "1 hit = trivial."

## Environment Availability

Skipped — this task has no new external tool/service dependency beyond what
the project already uses everywhere (InstantDB via already-installed SDKs,
`uv`/`bun` already verified working throughout the project's history). No
audit needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (CLI) | `pytest` (markers: `live`, `packaging`) — `cli/pyproject.toml` |
| Framework (web unit) | `bun test` |
| Framework (web e2e) | Playwright (`web/playwright.config.ts`) |
| Config file | `cli/pyproject.toml` `[tool.pytest.ini_options]`; `web/package.json` scripts |
| Quick run command (CLI, offline) | `uv run pytest -m "not live and not packaging"` (cli/) |
| Quick run command (web unit) | `bun test src` (web/) |
| Full suite command (CLI, incl. live) | `uv run pytest` (cli/, requires a live session) |
| Full suite command (web e2e) | `bun run test:e2e` (web/, requires live app + auth setup project) |

### Phase Requirements → Test Map

This is a quick task, not a phase with formal REQ-IDs — CONTEXT.md's D1-D7
decisions serve as the requirement set. Suggested test coverage:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D1 (CLI rename) | `apollo entidade criar/editar/deletar/listar` all work | integration (live) | `uv run pytest cli/tests/test_crud_entidade.py -m live` | ❌ needs rename from `test_crud_fundo.py` |
| D2 (tipoEntidade) | `criar` rejects missing `--tipo-entidade`, `editar` allows omitting it | unit/integration | same file, new test cases | ❌ new assertions needed |
| D3 (schema links) | `projeto`/`ticket`/`rotina template` `--entidade-id` resolves and links correctly | integration (live) | `uv run pytest cli/tests/test_crud_projeto.py cli/tests/test_crud_ticket.py cli/tests/test_crud_rotina_template.py -m live` | ✅ existing files, needs rename of assertions |
| D4 (migration) | Live production `entidades` count == pre-migration `fundos` count; 0 orphaned `fundos` rows after | manual/live script | migration script's own dry-run + confirm output | ❌ Wave 0 — script doesn't exist yet |
| D5 (permissions) | Cross-user isolation still denies access to another user's `entidades` | integration (live) | `uv run pytest cli/tests/test_cross_user_isolation.py -m live` | ✅ existing file, needs rename |
| D6 (batch import compat) | `apollo import` with an old-style JSON (no `tipoEntidade` key) still succeeds, defaults to `"Fundo"` | unit | `uv run pytest cli/tests/test_batch_import.py` | ❌ new test case needed for the omitted-key default path |
| D7 (SPA rename) | Dashboard renders entidade groupings/dialogs correctly | e2e (live) | `bun run test:e2e -g "entidade"` (after renaming test names) | ✅ existing files, needs rename |
| No-leakage | Unauthenticated page never leaks any entity name incl. "entidades" | e2e | `bun run test:e2e -g "no-leakage"` | ✅ `no-leakage.spec.ts`, needs `ENTITY_NAMES` update |

### Sampling Rate
- **Per task commit:** `uv run pytest -m "not live and not packaging"` (CLI
  tasks) / `bun test src` (web tasks) — fast, offline inner loop.
- **Per wave merge:** Full live suite for the touched surface (CLI live
  tests for CLI waves, Playwright e2e for web waves) — this project's
  established discipline of never mocking InstantDB.
- **Phase gate:** Full suite green (both `cli/` and `web/`) before
  considering the quick task complete, matching every prior phase's
  verification bar in this project.

### Wave 0 Gaps
- [ ] `cli/scripts/migrate_fundos_to_entidades.py` — does not exist yet,
  needed for D4.
- [ ] A new test case in `test_batch_import.py` (or a new file) covering
  D6's "omitted `tipoEntidade` defaults to `Fundo`" path specifically —
  the existing 206 assertions in that file are all pre-rename shape and
  will need at least one net-new case for this specific compat guarantee.
- [ ] No new test framework/config needed — `pytest`/`bun test`/Playwright
  are already fully configured and proven throughout this project's history.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — this task touches no auth flow |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | `donoRules` (auth.id == data.donoId) reapplied verbatim to `entidades` per D5 — no new access-control logic, just a key rename in `instant.perms.ts` |
| V5 Input Validation | Yes | `batch_import.py`'s existing two-pass form/reference validation extends naturally to `entidadeId`/`tipoEntidade` — no new validation *pattern*, same discipline (collect-all-errors, never write on any error) |
| V6 Cryptography | No | Unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data access via a renamed entity accidentally missing its perms rule | Elevation of Privilege | `instant.perms.ts`'s `rules.entidades: donoRules` must exist from the very first additive schema push (D4 step 1) — never push the new entity to production without its perms rule already in place, even transiently. `test_cross_user_isolation.py`'s existing negative-permission fixture (already reads `fundos`, needs rename to `entidades`) is this project's own regression guard for exactly this class of mistake |
| Migration script partial-failure leaving some rows in an inconsistent link state (has `entidade` link but old `fundo` link diverged, or vice versa) | Tampering (data integrity) | D4's own step 3 "verify live" checkpoint (byte-identity + link-presence check per row) before step 4's destructive push — mirrors `260922-t1l`'s proven "count-first, canary-check, independent re-verify" discipline |
| `tipoEntidade` used anywhere as an implicit authorization signal (e.g. "only tipoEntidade=Fundo users can X") | Elevation of Privilege | D5 explicitly forbids this — `tipoEntidade` must never appear in a `perms.ts` rule string or in a security-relevant `where` clause; it is a display/categorization field only |

## Sources

### Primary (HIGH confidence)
- `shared/instant.schema.ts` (read in full this session) — current `fundos`
  entity + 3 links.
- `shared/instant.perms.ts` (read in full this session) — `donoRules` block.
- `cli/apollo_cli/entities/fundo.py` (read in full this session).
- `cli/apollo_cli/batch_import.py` (read in full this session).
- `web/src/lib/dashboard/RoutinesByFundo.svelte`,
  `web/src/lib/dashboard/derive.ts`,
  `web/src/lib/dashboard/dialogs/FundoDialog.svelte`,
  `web/src/lib/entities/defs/fundos.ts` (all read in full this session).
- `web/node_modules/@instantdb/core/src/instaml.ts` (lines 212-388, read
  this session) — `checkEntityExists`/`expandCreate`/`expandDelete`.
- `web/node_modules/@instantdb/core/src/store.ts` (lines 525-670, read this
  session) — `deleteEntity`/`applyTxStep`.
- `web/node_modules/instant-cli/src/renderSchemaPlan.ts` (read in full this
  session) — namespace create/delete grouping logic.
- `web/node_modules/@instantdb/platform/src/api.ts` (relevant excerpt read
  this session) — `translatePlanStep`'s `delete-attr` friendly description.
- Live production InstantDB app, queried this session via `apollo fundo
  listar` / `apollo projeto listar` / `apollo ticket listar` / `apollo
  rotina template listar` / `apollo rotina instancia listar` — 58/0/0/0/0
  respectively.
- `.planning/quick/20260922-limpar-dados-de-teste-poluidos-.../260922-t1l-SUMMARY.md`
  (read in full this session) — the precedent migration-script discipline.

### Secondary (MEDIUM confidence)
- [CITED: instantdb.com/docs/cli] — via `WebFetch`, confirms the
  rename-vs-create-deletes-data distinction for `instant-cli push`.

### Tertiary (LOW confidence)
- None — every claim in this document is either directly read from source
  this session, live-queried, or CITED against official docs.

## Metadata

**Confidence breakdown:**
- Full file enumeration: HIGH — every count is a fresh `grep -rli`/`grep -ci`
  run this session, not carried over from CONTEXT.md's own (slightly older,
  by the same day) estimate.
- Id-reuse mechanic (D4's core risk): HIGH — read directly from vendored
  SDK source, cross-checked against two independent functions
  (`checkEntityExists`, `deleteEntity`) that both confirm etype-scoping.
- Schema-push deletion semantics: MEDIUM — CITED against official docs
  (not a first-party server-source read, since InstantDB's server is
  closed-source), but the docs statement is unambiguous and directly on
  point.
- Live production state (58/0/0/0/0): HIGH — directly queried via the
  installed, working CLI this session, not inferred.

**Research date:** 2026-09-22
**Valid until:** Live production row counts (the 58/0/0/0/0 figures) are a
point-in-time snapshot — re-verify immediately before running the D4
migration script if any time passes between this research and execution,
since other quick tasks/tests could change these counts (as already
happened once today per the `260922-t1l` history). The schema/architecture
findings (id-reuse mechanic, auto-discovery patterns, file enumeration) are
stable until the next schema-touching phase.
