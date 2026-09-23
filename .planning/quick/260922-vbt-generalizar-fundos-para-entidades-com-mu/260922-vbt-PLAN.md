---
quick_id: 260922-vbt
type: execute
autonomous: true
depends_on: []
files_modified:
  - shared/instant.schema.ts
  - shared/instant.perms.ts
  - cli/apollo_cli/entities/entidade.py
  - cli/apollo_cli/entities/projeto.py
  - cli/apollo_cli/entities/ticket.py
  - cli/apollo_cli/entities/rotina.py
  - cli/apollo_cli/batch_import.py
  - cli/apollo_cli/cli.py
  - cli/tests/test_crud_entidade.py
  - cli/tests/test_cross_user_isolation.py
  - cli/tests/test_crud_ticket.py
  - cli/tests/test_crud_rotina_template.py
  - cli/tests/test_crud_projeto.py
  - cli/tests/test_auth_rejection.py
  - cli/tests/test_packaging_live.py
  - cli/tests/test_cli_surface.py
  - cli/tests/test_batch_import.py
  - cli/tests/test_batch_import_file_errors.py
  - cli/tests/conftest.py
  - web/src/lib/entities/defs/entidades.ts
  - web/src/lib/entities/defs/tickets.ts
  - web/src/lib/entities/defs/projetos.ts
  - web/src/lib/entities/defs/templatesRotina.ts
  - web/src/lib/entities/types.ts
  - web/src/lib/entities/registry.test.ts
  - web/src/lib/dashboard/derive.ts
  - web/src/lib/dashboard/derive.test.ts
  - web/src/lib/dashboard/dashboardQuery.ts
  - web/src/lib/dashboard/Dashboard.svelte
  - web/src/lib/dashboard/RoutinesByEntidade.svelte
  - web/src/lib/dashboard/ProjectStrips.svelte
  - web/src/lib/dashboard/TicketQueue.svelte
  - web/src/lib/dashboard/dialogs/EntidadeDialog.svelte
  - web/src/lib/dashboard/dialogs/TaskDialog.svelte
  - web/src/lib/dashboard/dialogs/TicketDialog.svelte
  - web/src/lib/dashboard/dialogs/RotinaDialog.svelte
  - web/src/lib/dashboard/dialogs/ProjectDialog.svelte
  - web/src/lib/dashboard/dialogs/EtapaDialog.svelte
  - web/src/lib/sections/ProjetosSection.svelte
  - web/e2e/dashboard.spec.ts
  - web/e2e/focus-dialog-entidade.spec.ts
  - web/e2e/projetos-section.spec.ts
  - web/e2e/focus-dialog-button-inventory.spec.ts
  - web/e2e/entities-projeto-etapa-tarefa.spec.ts
  - web/e2e/entities-form-restyle.spec.ts
  - web/e2e/cross-phase-verification.spec.ts
  - web/e2e/focus-dialog-dia-rotina.spec.ts
  - web/e2e/focus-dialog-projetos-kanban.spec.ts
  - web/e2e/focus-dialog-ticket.spec.ts
  - web/e2e/entities-entidades.spec.ts
  - web/e2e/dashboard-kanbans.spec.ts
  - web/e2e/focus-dialog-projeto.spec.ts
  - web/e2e/entities-table-restyle.spec.ts
  - web/e2e/entities-header-states.spec.ts
  - web/e2e/entities-form-dialog-composition.spec.ts
  - web/e2e/shell-nav.spec.ts
  - web/e2e/no-leakage.spec.ts
  - web/e2e/fixtures/instancia-admin-fixture.ts
  - web/e2e/entities-rotina-log.spec.ts
  - web/e2e/entities-ticket-subtarefa.spec.ts
  - web/e2e/entities-delete-confirmation.spec.ts
files_deleted:
  - cli/apollo_cli/entities/fundo.py
  - cli/tests/test_crud_fundo.py
  - web/src/lib/entities/defs/fundos.ts
  - web/src/lib/dashboard/dialogs/FundoDialog.svelte
  - web/src/lib/dashboard/RoutinesByFundo.svelte
  - web/e2e/entities-fundos.spec.ts
  - web/e2e/focus-dialog-fundo.spec.ts
  - cli/scripts/migrate_fundos_to_entidades.py

must_haves:
  truths:
    - "Every entidades row in production carries byte-identical nome/codigo/ativo/donoId/createdAt to the fundos row it replaced (same id, reused), plus tipoEntidade set to \"Fundo\"."
    - "apollo entidade criar/editar/deletar/listar work end-to-end against production; criar requires --tipo-entidade, editar accepts it optionally; no apollo fundo command exists anywhere."
    - "apollo projeto/ticket/rotina template criar|editar|listar accept --entidade-id (never --fundo-id) and link via the entidade label; apollo import creates entidades (not fundos), with tipoEntidade optional and defaulting to \"Fundo\" when omitted from the batch JSON."
    - "The web SPA's nav, dashboard grouping/dialogs, and entity table all read \"Entidades\"/\"por entidade\" wherever \"Fundos\"/\"por fundo\" used to appear, and the Entidade create/edit form exposes tipoEntidade as a free-text field."
    - "The fundos schema entity and its 3 links (fundoProjetos/fundoTemplatesRotina/fundoTickets) no longer exist in production — an admin query for fundos returns zero rows (or a namespace-not-found error), confirmed independently after the destructive schema push."
    - "grep across cli/ and web/ (excluding RESEARCH.md/CONTEXT.md/this PLAN.md and git history) finds zero remaining references to the old identifiers _ETYPE_FUNDO, --fundo-id, fundoId, apollo_cli.entities.fundo, or the schema entity name \"fundos\"."
    - "Full offline+live cli/ pytest suite and web/ bun test + svelte-check + Playwright e2e suite are green (excluding the 3 pre-existing, documented-unrelated test-fragility items in STATE.md Deferred Items)."
  artifacts:
    - shared/instant.schema.ts
    - shared/instant.perms.ts
    - cli/apollo_cli/entities/entidade.py
    - cli/apollo_cli/batch_import.py
    - cli/tests/test_crud_entidade.py
    - web/src/lib/entities/defs/entidades.ts
    - web/src/lib/dashboard/dialogs/EntidadeDialog.svelte
    - web/src/lib/dashboard/RoutinesByEntidade.svelte
    - web/e2e/entities-entidades.spec.ts
    - web/e2e/focus-dialog-entidade.spec.ts
  key_links:
    - "shared/instant.schema.ts's entidadeProjetos/entidadeTemplatesRotina/entidadeTickets -> shared/instant.perms.ts's rules.entidades: donoRules -> cli/apollo_cli/entities/{entidade,projeto,ticket,rotina}.py's --entidade-id resolution -> web/src/lib/entities/defs/{projetos,tickets,templatesRotina}.ts's entidade link -> web/src/lib/dashboard/dashboardQuery.ts's entidade: {} nested branches -> web/src/lib/dashboard/derive.ts's rotinasPorEntidade/rotinasDoEntidade -> web/src/lib/dashboard/RoutinesByEntidade.svelte + dialogs/EntidadeDialog.svelte"
    - "cli/scripts/migrate_fundos_to_entidades.py -> apollo_cli.instant_client.login_client() -> repo-root .env.instantdb's INSTANT_APP_ADMIN_TOKEN -> InstantDB admin query/transact, id-reuse from fundos into entidades"
---

<objective>
Generalize the fixed `fundos` entity into a generic `entidades` entity with a
free-text `tipoEntidade` discriminator (e.g. "Fundo", "Cliente", "Area"), per
CONTEXT.md decisions D1-D7 (locked, do not re-litigate). `templatesRotina`,
`projetos`, and `tickets` link to an entidade of any type instead of a fixed
fundo. All 58 existing production `fundos` rows migrate to `entidades` rows
(same id, `tipoEntidade: "Fundo"`), and the old `fundos` entity + its 3 links
are fully removed from the schema once every consumer (CLI, web, e2e) no
longer references them — a full rename, no back-compat alias (D1), except
`apollo import`'s JSON schema, where `tipoEntidade` stays optional and
defaults to `"Fundo"` (D6) for compatibility with pre-existing batch files.

Purpose: let the user model non-fund entities (clients, areas, etc.) through
the exact same CRUD/CLI/dashboard machinery `fundos` already had, without a
parallel schema.
Output: `entidades` entity + 3 renamed links live in production, 58 rows
migrated with verified byte-identical data, `fundos` fully removed, CLI/web/
e2e renamed end-to-end with zero remaining stale references.

Sequencing rationale (why the destructive schema push is Task 4, not Task 1):
the CLI and web layers keep working against `fundos` (schema declares it
additively, unmodified) through Tasks 1-3 — nothing breaks mid-migration.
Only once Task 2 (CLI) and Task 3 (web) have fully stopped writing/reading
`fundos` does Task 4 remove it from the schema; removing it any earlier would
break every not-yet-renamed CLI/web code path still doing
`client.tx.fundos[...]`/`{fundos: {}}` queries against an entity InstantDB has
already deleted (schema-push deletion is destructive — see RESEARCH.md
"Schema-Push Deletion Semantics"). `cli/tests/test_cli_surface.py`'s
schema-driven coverage test (which parametrizes over every entity currently
declared in `shared/instant.schema.ts`) gets one small, explicitly-documented
transitional exception in Task 2 for exactly this reason, removed again in
Task 4 once `fundos` is gone from the schema for good — see Task 2's action.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-CONTEXT.md
@.planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-RESEARCH.md

Read first (do not re-read once loaded):
- `shared/instant.schema.ts` / `shared/instant.perms.ts` — current `fundos`
  entity + 3 links + `donoRules` block, exact shape to generalize.
- `cli/apollo_cli/entities/fundo.py`, `projeto.py`, `ticket.py`, `rotina.py`,
  `batch_import.py`, `crud_helpers.py`, `entities/__init__.py` — full CLI
  surface + the zero-registration-list auto-discovery (renaming the file
  with `@click.group(name="entidade")` kept is sufficient, no other CLI edit
  needed to re-wire the command).
- `web/src/lib/dashboard/derive.ts`, `dashboardQuery.ts`, `Dashboard.svelte`,
  `RoutinesByFundo.svelte` (note: lives directly at
  `web/src/lib/dashboard/RoutinesByFundo.svelte`, NOT under `dialogs/` —
  RESEARCH.md's file table has a path typo for this one file only),
  `dialogs/FundoDialog.svelte`, `entities/defs/fundos.ts` — the web rename
  surface with real (not just mechanical) logic.
- `.planning/quick/20260922-limpar-dados-de-teste-poluidos-apagar-todos-os-registros-das/260922-t1l-PLAN.md`
  and its SUMMARY — the precedent live-migration/admin-cleanup pattern
  (dry-run first, canary/byte-identity check, independent re-verification,
  transient script deleted after use) Task 1's migration script mirrors.
- RESEARCH.md's "Full File Enumeration" section — the authoritative,
  session-verified per-file change list for every CLI/web/e2e file this plan
  touches (except the one path correction above). Tasks 2-4 below give the
  pattern + the specific gotchas (Pitfalls 1-4); RESEARCH.md's tables give
  the exhaustive file-by-file detail. Read both.

This plan runs entirely against the LIVE production InstantDB app configured
in the repo-root `.env.instantdb` — no admin-token mocking, matching this
project's established live-verification convention. Live production state at
research time: 58 `fundos` rows, 0 `projetos`/`tickets`/`templatesRotina`/
`instanciasRotina` rows. Re-verify these counts immediately before Task 1's
migration script runs (they may have drifted since research).
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Additive schema push + live migration script + verification (D4 steps 1-3)</name>
  <precondition>Repo-root `.env.instantdb` exists and contains `INSTANT_APP_ADMIN_TOKEN` — check with: `cd /home/thomaz/pessoal/apollo-v2 && cli/.venv/bin/python -c "from apollo_cli.config import load_instant_config as l; print(l().admin_token_present)"` must print `True` before proceeding.</precondition>
  <files>shared/instant.schema.ts, shared/instant.perms.ts, cli/scripts/migrate_fundos_to_entidades.py</files>
  <action>
Step A — additive schema push (D4 step 1). Edit `shared/instant.schema.ts`:
add a new `entidades: i.entity({...})` entity to the `entities` block (do NOT
touch or remove `fundos`), with fields `nome: i.string()`, `codigo:
i.string().indexed()`, `ativo: i.boolean()`, `tipoEntidade: i.string()`
(required — new entity, no existing-row backfill problem per D2),
`donoId: i.string().indexed()`, `createdAt: i.date()`. Add 3 new links to the
`links` block per D3: `entidadeProjetos` (forward `on: "projetos", has:
"one", label: "entidade"`; reverse `on: "entidades", has: "many", label:
"projetos"`), `entidadeTemplatesRotina` (forward `on: "templatesRotina", has:
"one", label: "entidade"`; reverse `on: "entidades", has: "many", label:
"templatesRotina"`), `entidadeTickets` (forward `on: "tickets", has: "one",
label: "entidade"`; reverse `on: "entidades", has: "many", label:
"tickets"`). Do NOT remove `fundoProjetos`/`fundoTemplatesRotina`/
`fundoTickets` or the `fundos` entity — both coexist through Task 3.

Edit `shared/instant.perms.ts`: add `entidades: donoRules,` to the `rules`
object (alongside the untouched `fundos: donoRules,`) — per the Known Threat
Pattern in RESEARCH.md's Security Domain, the perms rule must exist from the
very first push that introduces the entity, never added transiently later.

Run the push: `cd web && bun run instant:push` (uses `--yes`, non-
interactive; this is a pure addition, no rename ambiguity for `instant-cli`
to prompt about).

Step B — write the transient migration script at
`cli/scripts/migrate_fundos_to_entidades.py` (D4 step 2), deliberately
OUTSIDE `apollo_cli` (same reason as `cleanup_rotina_test_data.py`:
`test_auth_rejection.py`'s admin-token-confinement AST gate only walks
`cli/apollo_cli/**/*.py`) and NOT named `test_*.py`. Module docstring states
up front this is a ONE-OFF, TRANSIENT tool for quick task 260922-vbt, deleted
once the migration is confirmed.

Imports: `argparse`, `json`, `login_client` from `apollo_cli.instant_client`.

`_counts(client)` helper: one query merging `{"fundos": {}, "entidades": {}}`,
returns `{etype: len(rows)}` via `.get(etype, [])`.

`_fetch_fundos(client)`: `client.query({"fundos": {}})["fundos"]`, returns
the raw row list (each row has `id`, `nome`, `codigo`, `ativo`, `donoId`,
`createdAt`).

`_linked_children(client)`: for each of `("projetos", "fundo")`,
`("templatesRotina", "fundo")`, `("tickets", "fundo")`, queries
`{etype: {"fundo": {}, "$": {"where": {}}}}` (admin, no donoId filter — every
owner), filters to rows where `row.get("fundo")` is truthy, and returns a
dict `{etype: [(row_id, fundo_id), ...]}` — this is deliberately generic and
will iterate zero rows today (live production has 0 `projetos`/
`templatesRotina`/`tickets` rows), but must be implemented correctly and
exercised by this script's own dry run, not skipped, since a future
`apollo import`/CLI write between now and this task's execution could add
real linked rows.

`main()`: `argparse` with one flag, `--confirmar` (`action="store_true"`,
default `False`, mirrors `rotina.py limpar-orfas`/`cleanup_rotina_test_data.py`'s
convention). Call `login_client()` once. Compute `before = _counts(client)`
and `linked = _linked_children(client)`. Print exactly one JSON document:
`json.dumps({"before": before, "linked_counts": {k: len(v) for k, v in
linked.items()}, "confirmado": args.confirmar}, sort_keys=True)`. If
`--confirmar` is NOT passed, return immediately — zero writes, zero
`client.transact` calls.

Confirmar branch (implement fully): fetch `fundos = _fetch_fundos(client)`.
Build one `client.transact([...])` call: for each fundo row, a
`client.tx.entidades[row["id"]].create({"nome": row["nome"], "codigo":
row["codigo"], "ativo": row["ativo"], "tipoEntidade": "Fundo", "donoId":
row["donoId"], "createdAt": row["createdAt"]})` chunk — REUSING the fundo's
own `id` string for the new entidade row (D4's id-reuse mechanic, verified
safe in RESEARCH.md's "InstantDB Id-Reuse Verification" — different
`etype`-scoped identity attrs, no collision). Then for each `(etype,
fundo_link_label)` in `_linked_children`'s result, a `client.tx[etype][row_id]
.link({"entidade": fundo_id})` chunk per linked row (adds the NEW link,
never removes the old `fundo` link — both coexist through Task 4). Batch in
groups of at most 200 chunks per `client.transact()` call (mirrors
`cleanup_rotina_test_data.py`'s convention) — today this is one batch of 58,
but must not assume that scale is permanent.

After writing, compute `after = _counts(client)` and re-run
`_linked_children` to get `after_linked`. Print
`json.dumps({"after": after, "after_linked_counts": {k: len(v) for k, v in
after_linked.items()}}, sort_keys=True)`. Then assert (uncaught
`AssertionError`, non-zero exit is the correct failure signal):
`after["entidades"] == before["fundos"] + before["entidades"]` (idempotent-
safe: if entidades already had rows before this run for any reason, the
assertion still holds); `after["fundos"] == before["fundos"]` (fundos is
NEVER written to by this script); for every `etype` in `_linked_children`,
`len(after_linked[etype]) >= len(linked[etype])` (every row that had a
`fundo` link before now still has one, plus possibly a new `entidade` link —
this script never removes a `fundo` link). Also assert, per migrated fundo
row, that the freshly-created entidade row (re-queried via
`client.query({"entidades": {"$": {"where": {"id": row["id"]}}}})`) has
`nome`/`codigo`/`ativo`/`donoId`/`createdAt` byte-identical to the source
`fundos` row and `tipoEntidade == "Fundo"` — iterate ALL migrated rows (58 is
cheap), not a sample.

Step C — run: dry run first (`cli/.venv/bin/python
cli/scripts/migrate_fundos_to_entidades.py`, assert zero writes by re-running
it twice and diffing `before`/`linked_counts` for byte-identical output),
then `--confirmar` (real migration + the script's own internal assertions
above). Then run ONE independent, ad-hoc `python -c` admin query (not the
script) re-confirming: `entidades` count equals the pre-migration `fundos`
count, every `entidades` row has `tipoEntidade == "Fundo"`, and `fundos`
count is unchanged from before this task started.
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2 && (cd web && bun run instant:push) && A=$(cli/.venv/bin/python cli/scripts/migrate_fundos_to_entidades.py) && B=$(cli/.venv/bin/python cli/scripts/migrate_fundos_to_entidades.py) && [ "$A" = "$B" ] && cli/.venv/bin/python cli/scripts/migrate_fundos_to_entidades.py --confirmar && cli/.venv/bin/python -c "from apollo_cli.instant_client import login_client; c = login_client(); r = c.query({'fundos': {}, 'entidades': {}}); f = r.get('fundos', []); e = r.get('entidades', []); print(len(f), len(e)); assert len(e) == len(f); assert all(row.get('tipoEntidade') == 'Fundo' for row in e)"</automated>
  </verify>
  <done>`entidades` + 3 links live in production schema alongside untouched `fundos` + its 3 links. Migration script's `--confirmar` run passed its own internal byte-identity/count assertions. Independent post-hoc admin query confirms `entidades` count == pre-migration `fundos` count and every migrated row has `tipoEntidade == "Fundo"`. `fundos` row count and field content are completely unchanged (this task never writes to `fundos`).</done>
</task>

<task type="auto">
  <name>Task 2: CLI rename (`apollo fundo` → `apollo entidade`, batch_import, all CLI tests)</name>
  <files>cli/apollo_cli/entities/entidade.py, cli/apollo_cli/entities/projeto.py, cli/apollo_cli/entities/ticket.py, cli/apollo_cli/entities/rotina.py, cli/apollo_cli/batch_import.py, cli/apollo_cli/cli.py, cli/tests/test_crud_entidade.py, cli/tests/test_cross_user_isolation.py, cli/tests/test_crud_ticket.py, cli/tests/test_crud_rotina_template.py, cli/tests/test_crud_projeto.py, cli/tests/test_auth_rejection.py, cli/tests/test_packaging_live.py, cli/tests/test_cli_surface.py, cli/tests/test_batch_import.py, cli/tests/test_batch_import_file_errors.py, cli/tests/conftest.py</files>
  <action>
Rename `cli/apollo_cli/entities/fundo.py` -> `entidade.py` (git mv). Rename
`_ETYPE = "fundos"` -> `"entidades"`, `@click.group(name="fundo")` ->
`name="entidade"`, docstring/help text `fundo(s)` -> `entidade(s)`. Add
`--tipo-entidade` (required=True in `criar`, help "Tipo/categoria da
entidade (texto livre, ex.: Fundo, Cliente, Area) — sem catalogo separado";
default=None/optional in `editar`) wired to the `tipoEntidade` field in both
commands' `fields`/`drop_none(...)` dicts. `deletar`/`listar` unchanged
besides the etype/group rename.

`cli/apollo_cli/entities/projeto.py`/`ticket.py`/`rotina.py`: rename
`_PARENT_ETYPE`/`_ETYPE_FUNDO = "fundos"` -> `"entidades"`; rename
`_resolve_fundo_link`/its call sites -> `_resolve_entidade_link`/
`_resolve_ref(etype=_ETYPE_ENTIDADE, ..., link_label="entidade")`; rename
every `--fundo-id` CLI option -> `--entidade-id` (help text updated to
"...entidade..."); rename every `{"fundo": fundo_id}` link dict ->
`{"entidade": entidade_id}`; rename every `"fundo.id"` query where-key ->
`"entidade.id"`. Function parameter names `fundo_id` -> `entidade_id`
throughout.

`cli/apollo_cli/batch_import.py` (mechanical sweep, ~95 identifier sites):
`_ETYPE_FUNDO = "fundos"` -> `_ETYPE_ENTIDADE = "entidades"`;
`_SUPPORTED_TOP_LEVEL_KEYS` uses the new constant. Rename
`_check_fundo_form` -> `_check_entidade_form` (add D6: `tipoEntidade` is
OPTIONAL in the batch record — if present, must be a non-empty string, else
error `tipo_entidade_invalido`; never required at validation time, the
default is applied at resolution time, see below). Rename
`_check_fundo_codigo_uniqueness` -> `_check_entidade_codigo_uniqueness`
(unchanged logic, natural key stays `codigo` only — `tipoEntidade` is never
part of the identity/natural key per D2/D5). In `_check_template_form`,
rename `record.get("fundoId")` -> `record.get("entidadeId")`, error key
`fundo_id_invalido` -> `entidade_id_invalido`. In
`_check_template_natural_key_uniqueness`, rename the `fundo_id_value`
variable/key component to `entidade_id_value` (same raw-value, pre-
resolution collision-key logic, unchanged). In `_check_references`, rename
`fundo_ref`/error keys (`fundo_id_referencia_local_nao_encontrada` ->
`entidade_id_referencia_local_nao_encontrada`, `fundo_id_nao_encontrado` ->
`entidade_id_nao_encontrado`) and `get_entity(etype=_ETYPE_FUNDO, ...)` ->
`get_entity(etype=_ETYPE_ENTIDADE, ...)`. Rename `_resolve_fundos` ->
`_resolve_entidades`: query against `"entidades"` (not `"fundos"`); in the
`to_create` fields dict, add `"tipoEntidade": record.get("tipoEntidade",
"Fundo")` (D6's exact default). Rename `_resolved_fundo_id` ->
`_resolved_entidade_id` (reads `record.get("entidadeId")`). In
`_resolve_templates`, rename the `fundo_local_id_to_real_id` parameter ->
`entidade_local_id_to_real_id`, the `fundo.id`-scoped query where-key ->
`entidade.id`, the no-parent fallback query's `{"templatesRotina": {"fundo":
{}, ...}}` -> `{"entidade": {}, ...}` with `if row.get("entidade"): continue`,
and the final `links["fundo"] = fundo_id` -> `links["entidade"] =
entidade_id`. In `run_batch_import`, rename the local `fundos` list variable
(sourced from `present.get(_ETYPE_ENTIDADE, [])`) and the report's top-level
key `"fundos"` -> `"entidades"` (both the success report and the ambiguous-
post-send-failure recovery report). Update the module docstring's every
"fundos"/"fundoId" mention -> "entidades"/"entidadeId" (T-31-05/C-06's "never
creates instanciasRotina" invariant is unaffected — restate against
`entidades`/`templatesRotina`, still excluding `instanciasRotina`).

`cli/apollo_cli/cli.py`: update the top-level docstring's entity-group list
(`fundo, projeto, ...` -> `entidade, projeto, ...`) and the `apollo import
--from-json` help text's `fundos`/`fundoId` mentions -> `entidades`/
`entidadeId`.

Test files — rename `cli/tests/test_crud_fundo.py` -> `test_crud_entidade.py`
(git mv): rename `_query_fundo` -> `_query_entidade`, `client.query({"fundos":
...})` -> `{"entidades": ...}`, every `["fundo", "criar"/"editar"/"deletar"/
"listar", ...]` CLI-argv list -> `["entidade", ...]`, and add
`--tipo-entidade <valor>` to every `criar` invocation (now required). Sweep
the remaining 9 test files per RESEARCH.md's `cli/tests/` table: rename
`_create_fundo` helpers -> `_create_entidade` (and their call sites'
`--tipo-entidade` argv addition), `_query_*(..., with_fundo=...)` ->
`with_entidade`, `tp_owned_fundo` fixture -> `tp_owned_entidade`,
`client.tx.fundos[...]` -> `client.tx.entidades[...]`,
`cleanup_records.append(("fundos", ...))` -> `("entidades", ...)`, every
`["fundo", ...]`/`["uv", "run", "apollo", "fundo", ...]` CLI-argv -> the
`entidade` equivalent, `{"fundo": {}, "antecessor": {}}` sub-query shapes ->
`{"entidade": {}, ...}`. `conftest.py`: update the docstring reference to
the renamed test filename.

`cli/tests/test_cli_surface.py`: rename the `EXPECTED_SURFACE` key
`"fundos": (["fundo"], {...}, False)` -> `"entidades": (["entidade"],
{"criar","editar","deletar","listar"}, False)`. IMPORTANT — transitional
exception (see this plan's `<objective>` sequencing rationale): the schema
still declares `fundos` (Task 4 removes it), but `apollo fundo` no longer
exists after this task's rename — `test_schema_entity_coverage[fundos]`
would otherwise fail with "schema entity 'fundos' has no CLI coverage
mapping". Add a small, explicitly-commented constant right above
`EXPECTED_SURFACE`: `_PENDING_SCHEMA_REMOVAL: frozenset[str] =
frozenset({"fundos"})` with a comment stating this is transitional —
`fundos` is additively kept in the schema only until quick task 260922-vbt's
own Task 4 destructive schema push lands, remove this constant and its two
usages entirely once that push ships. Filter `_schema_entity_names()`'s
returned list through `[n for n in names if n not in
_PENDING_SCHEMA_REMOVAL]`, and add an assertion inside
`test_expected_surface_has_no_stale_entries` (or a new small test) that no
key in `_PENDING_SCHEMA_REMOVAL` is also a key in `EXPECTED_SURFACE` (catches
forgetting to also drop the old key, which you already did above by
replacing it with `"entidades"`).

`cli/tests/test_batch_import.py` (206 sites, mechanical — same
fundos/fundoId -> entidades/entidadeId sweep as `batch_import.py` itself,
applied to every fixture dict/assertion in this file) and
`test_batch_import_file_errors.py` (`'{"fundos": []}'` fixture payload ->
`'{"entidades": []}'`). Additionally add ONE new live test case to
`test_batch_import.py` proving D6: a batch JSON with an `entidades` record
that OMITS `tipoEntidade` entirely creates successfully, and the resulting
entidade's `tipoEntidade` (queried back) is exactly `"Fundo"`.
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2/cli && uv run pytest -m "not live and not packaging" && uv run pytest -m live -k "entidade or cross_user or batch_import or cli_surface or crud_projeto or crud_ticket or crud_rotina_template" && ! grep -rnE '"fundos"|fundoId|fundo_id|_ETYPE_FUNDO|_resolve_fundo|apollo_cli\.entities\.fundo|--fundo-id' apollo_cli tests --include="*.py"</automated>
  </verify>
  <done>`apollo entidade criar/editar/deletar/listar` work live against production (criar requires --tipo-entidade). `apollo projeto/ticket/rotina template` accept `--entidade-id`. `apollo import` creates `entidades` with optional `tipoEntidade` defaulting to `"Fundo"`. Full offline CLI test suite green; live tests for entidade/cross-user/batch-import/cli-surface/projeto/ticket/rotina-template CRUD green. Zero remaining `_ETYPE_FUNDO`/`--fundo-id`/`fundoId`/`fundo_id` identifiers anywhere in `cli/apollo_cli` or `cli/tests`. `test_cli_surface.py`'s transitional `_PENDING_SCHEMA_REMOVAL` exception is in place and documented.</done>
</task>

<task type="auto">
  <name>Task 3: Web rename (schema consumers, entity defs, dashboard, dialogs)</name>
  <files>web/src/lib/entities/defs/entidades.ts, web/src/lib/entities/defs/tickets.ts, web/src/lib/entities/defs/projetos.ts, web/src/lib/entities/defs/templatesRotina.ts, web/src/lib/entities/types.ts, web/src/lib/entities/registry.test.ts, web/src/lib/dashboard/derive.ts, web/src/lib/dashboard/derive.test.ts, web/src/lib/dashboard/dashboardQuery.ts, web/src/lib/dashboard/Dashboard.svelte, web/src/lib/dashboard/RoutinesByEntidade.svelte, web/src/lib/dashboard/ProjectStrips.svelte, web/src/lib/dashboard/TicketQueue.svelte, web/src/lib/dashboard/dialogs/EntidadeDialog.svelte, web/src/lib/dashboard/dialogs/TaskDialog.svelte, web/src/lib/dashboard/dialogs/TicketDialog.svelte, web/src/lib/dashboard/dialogs/RotinaDialog.svelte, web/src/lib/dashboard/dialogs/ProjectDialog.svelte, web/src/lib/dashboard/dialogs/EtapaDialog.svelte, web/src/lib/sections/ProjetosSection.svelte</files>
  <action>
Rename `web/src/lib/entities/defs/fundos.ts` -> `defs/entidades.ts` (git mv):
`etype: "fundos"` -> `"entidades"`, `titulo: "Fundos"` -> `"Entidades"`,
`descricao` updated to mention entities generically (e.g. "Entidades
geridas pela controladoria (fundos, clientes, areas, etc.)"). Add a new
field to `fields`/`listColumns` per D2: `{ name: "tipoEntidade", label:
"Tipo", required: true, kind: "text" }` (positioned after `codigo`, before
`ativo`); `listColumns` becomes `["nome", "codigo", "tipoEntidade", "ativo",
"createdAt"]`.

`web/src/lib/entities/defs/tickets.ts`, `defs/projetos.ts`,
`defs/templatesRotina.ts`: rename each `links: [{ label: "fundo",
targetEtype: "fundos", ... }]` entry -> `{ label: "entidade", targetEtype:
"entidades", ... }` (keep `targetLabelField`/`required`/`excludeSelf`
unchanged); rename the `"fundo"` entry in each `listColumns` array ->
`"entidade"`. Update each file's doc-comment mentions of "fundo"/"fundos" ->
"entidade"/"entidades".

`web/src/lib/entities/types.ts`: update the 2 doc-comment examples
(`"fundo"`, `"fundos"`) illustrating the generic `EntityLink` type -> use
`"entidade"`/`"entidades"` as the example instead (comment text only, no
functional change).

`web/src/lib/entities/registry.test.ts`: rename the `fundos: { create: true,
update: true, delete: true }` capability fixture key -> `entidades: {...}`
and the `"fundos"` string literal (around line 326) -> `"entidades"`.

`web/src/lib/dashboard/derive.ts` (the core logic rename, ~52 sites): rename
`rotinasPorFundo` -> `rotinasPorEntidade`, `rotinasDoFundo` ->
`rotinasDoEntidade` (both exports, keep behavior byte-identical — same
"null group always last" invariant for `rotinasPorEntidade`, same
week-unbounded full-list behavior for `rotinasDoEntidade`). Rename
`Item.fundoId` -> `entidadeId`. Rename the local interfaces
`ProjetoFundoLike` -> `ProjetoEntidadeLike` (field `fundo: {id} | null` ->
`entidade: {id} | null`), `InstanciaAgendaLike.template.fundo` ->
`.template.entidade` (keep the `nome`/`id` shape unchanged), `TicketAgendaLike.fundo`
-> `.entidade`. Update every internal read site (`tarefa.etapa?.projeto?.id`
lookup building `fundoIdByProjetoId` -> rename the map/variable to
`entidadeIdByProjetoId`, `instancia.template?.fundo?.id` ->
`?.entidade?.id`, `ticket.fundo?.id` -> `ticket.entidade?.id`) accordingly.
Update every doc comment mentioning "fundo"/"fundo grouping" ->
"entidade"/"entidade grouping".

`web/src/lib/dashboard/derive.test.ts`: mirror every renamed export/type/
field from `derive.ts` above across all existing test cases (fixture shapes,
assertion text, `rotinasPorFundo`/`rotinasDoFundo` call sites ->
`rotinasPorEntidade`/`rotinasDoEntidade`).

`web/src/lib/dashboard/dashboardQuery.ts`: in `DASHBOARD_QUERY`, rename the
top-level `fundos: {}` branch -> `entidades: {}`; rename every nested
`fundo: {}` branch (`projetos: { fundo: {}, ... }` -> `{ entidade: {}, ...
}`; `instanciasRotina: { template: { fundo: {} } }` -> `{ template: {
entidade: {} } }`; `tickets: { fundo: {}, ... }` -> `{ entidade: {}, ...
}`). This MUST land in the same commit/task as the schema's `entidade` link
label (already live since Task 1) — RESEARCH.md Pitfall 1: InstantDB's
InstaQL is structurally permissive, a stale link-label string returns
`undefined` silently rather than erroring, so verify live (not just "app
doesn't crash") that entidade data actually appears nested after this
change.

`web/src/lib/dashboard/Dashboard.svelte` (~47 sites): rename the `FundoRow`
type -> `EntidadeRow` (field `id`/`nome` unchanged); rename
`openFundoDialog` -> `openEntidadeDialog`, `fundoNomeFor` ->
`entidadeNomeFor`, `fundoDialogProjetos` -> `entidadeDialogProjetos`,
`fundoDialogTickets` -> `entidadeDialogTickets`, `fundoByProjetoId` ->
`entidadeByProjetoId`. Rename the `DialogKind` union member `"fundo"` ->
`"entidade"` (and every `dialogStack`/`activeDialogRef` branch comparing
against it). Rename the import `import FundoDialog from
"./dialogs/FundoDialog.svelte"` -> `import EntidadeDialog from
"./dialogs/EntidadeDialog.svelte"` and its render branch
(`{:else if activeDialogRef?.kind === "fundo"}` -> `"entidade"`,
`<FundoDialog fundoId={...} fundoNome={...} .../>` -> `<EntidadeDialog
entidadeId={...} entidadeNome={...} .../>`). Rename the import
`import RoutinesByFundo from "./RoutinesByFundo.svelte"` -> `import
RoutinesByEntidade from "./RoutinesByEntidade.svelte"` (this file lives
directly at `web/src/lib/dashboard/RoutinesByFundo.svelte`, NOT under
`dialogs/` — verified this session, RESEARCH.md's table has a path typo for
this one file) and its usage (`<RoutinesByFundo ... onOpenFundo={...}>` ->
`<RoutinesByEntidade ... onOpenEntidade={openEntidadeDialog}>`). Rename
`query.data?.fundos` -> `?.entidades` (must match `dashboardQuery.ts`'s
renamed top-level key). Rename every `.fundo`/`fundoNome` field read on
`ProjetoRow`/`TicketRow`/`InstanciaRotinaRow`/`TemplateRow` ->
`.entidade`/`entidadeNome` accordingly (`activeRotina`'s
`raw.template?.fundo?.nome` -> `?.entidade?.nome`; `activeTarefaForDialog`'s
`fundoByProjetoId`/`fundo?.nome` -> `entidadeByProjetoId`/`entidade?.nome`).

Rename `web/src/lib/dashboard/RoutinesByFundo.svelte` -> `RoutinesByEntidade.svelte`
(git mv, at its real path directly under `dashboard/`, not `dashboard/dialogs/`)
per D7's dashboard-component-naming decision (`RoutinesByFundo.svelte`/
`rotinasPorFundo` -> `RoutinesByEntidade.svelte`/`rotinasPorEntidade`,
`FundoDialog.svelte` -> `EntidadeDialog.svelte`, `defs/fundos.ts` ->
`defs/entidades.ts`, already applied above/below in this same task):
rename the `Grupo` type's `fundoId`/`fundoNome` fields -> `entidadeId`/
`entidadeNome`; rename props `onOpenFundo` -> `onOpenEntidade`; rename the
`agrupar` `$state<"fundo">("fundo")` single-value union -> `$state<"entidade">
("entidade")`; per RESEARCH.md Pitfall 2, the markup-level
`<Select.Item value="fundo" label="fundo">fundo</Select.Item>` string is a
SEPARATE edit from the type rename (TypeScript won't catch a stale literal
in a Svelte template) — rename it to `value="entidade" label="entidade"` and
the visible text to `entidade`. Rename every `data-testid="rotinas-fundo-*"`
-> `rotinas-entidade-*` (card/titulo/meta/row-fundo testids). Rename
`grupo.fundoId ?? "sem-fundo"` key -> `entidadeId ?? "sem-entidade"`. Rename
copy "Sem fundo vinculado" -> "Sem entidade vinculada". After the rename,
grep this file specifically for the literal string `"fundo"` (not just the
identifier) to catch any missed markup-level string per the Pitfall 2
warning sign.

Rename `web/src/lib/dashboard/dialogs/FundoDialog.svelte` ->
`EntidadeDialog.svelte` (git mv): rename `requireConfig("fundos")` ->
`requireConfig("entidades")`, the `fundosConfig` variable ->
`entidadesConfig`; rename props `fundoId`/`fundoNome` -> `entidadeId`/
`entidadeNome` (and the `instanciasRotina` prop's inline type's
`template.fundo` -> `template.entidade`); rename the `rotinasDoFundo` import
-> `rotinasDoEntidade` (from `../derive`, matches Task 3's own `derive.ts`
rename above) and its call site; rename `projetosVinculados`/
`ticketsVinculados`'s `.filter((p) => p.fundoId === fundoId)` ->
`entidadeId === entidadeId` (param renamed too); rename the `verPagina()`
function's `nav-fundos` selector -> `nav-entidades` (Shell.svelte's generic
`nav-${cfg.etype}` fallback — no Shell.svelte edit needed, `cfg.etype` is
now `"entidades"` from the renamed `defs/entidades.ts`); rename every
`data-testid="fundo-dialog-*"` (rotinas/projetos/tickets) ->
`entidade-dialog-*`; the error message `FundoDialog: missing EntityConfig`
-> `EntidadeDialog: missing EntityConfig`.

`web/src/lib/dashboard/ProjectStrips.svelte`: rename the local `FundoRow`
type -> `EntidadeRow`; rename `ProjetoRow.fundo` -> `.entidade`; rename prop
`onOpenFundo` -> `onOpenEntidade` (and its call site
`onclick={... onOpenFundo(projeto.fundo!.id) ...}` ->
`onOpenEntidade(projeto.entidade!.id)`); rename `data-testid=
"project-strip-fundo-badge"` -> `project-strip-entidade-badge`; rename copy
"Sem fundo vinculado" -> "Sem entidade vinculada".

`web/src/lib/dashboard/TicketQueue.svelte`: rename the row shape's `fundo?:
{id, nome} | null` -> `entidade?: {id, nome} | null`; rename the render
site's `ticket.fundo?.nome` -> `ticket.entidade?.nome`; rename copy "Sem
fundo" -> "Sem entidade".

`web/src/lib/dashboard/dialogs/TaskDialog.svelte`,
`dialogs/RotinaDialog.svelte`, `dialogs/EtapaDialog.svelte`,
`dialogs/ProjectDialog.svelte`: each has a `fundoNome?: string | null` prop
and a `contexto` string interpolation reading it (e.g.
`` `${tarefa.fundoNome ?? "Sem fundo"} · ...` ``) — rename the prop to
`entidadeNome` and the fallback copy "Sem fundo"/"Sem fundo vinculado" ->
"Sem entidade"/"Sem entidade vinculada" in all 4 files.

`web/src/lib/dashboard/dialogs/TicketDialog.svelte`: rename the `fundo?:
{id, nome} | null` prop -> `entidade?: {id, nome} | null`; rename the
`contexto` interpolation's `ticket.fundo?.nome` -> `ticket.entidade?.nome`
and fallback "Sem fundo" -> "Sem entidade".

`web/src/lib/sections/ProjetosSection.svelte`: rename the `GroupBy` union
`"fundo" | "nenhum" | "status"` -> `"entidade" | "nenhum" | "status"`; rename
the `groupBy` default `$state<GroupBy>("fundo")` -> `$state<GroupBy>
("entidade")`; rename every `projeto.fundo?.nome` read (in `groupProjetos`'s
label derivation, the project-header summary line, `findEtapaById`/
`findTarefaById`'s `fundoNome: projeto.fundo?.nome ?? null`) -> `.entidade
?.nome`/`entidadeNome: ...`; rename the bespoke `db.useQuery` shape's
`projetos: { fundo: {}, ... }` -> `{ entidade: {}, ... }` (this component's
own independent query, distinct from `dashboardQuery.ts` — must be updated
here too or the section silently shows no entidade grouping); rename the
`<Select.Item value="fundo" label="fundo">fundo</Select.Item>` markup line
(Pitfall 2 applies here too — a second, separate site from
`RoutinesByEntidade.svelte`'s own) -> `value="entidade" label="entidade"`;
rename "Sem fundo vinculado" copy -> "Sem entidade vinculada"; rename the
`"Sem fundo vinculado"` string used as the group label fallback and its
special-cased sort-to-last comparison (`if (a[0] === "Sem fundo vinculado")`)
-> `"Sem entidade vinculada"`.
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2/web && bun test src && bun run check && ! grep -rnE '"fundos"|fundoId|FundoRow|FundoDialog|RoutinesByFundo|rotinasPorFundo|rotinasDoFundo|onOpenFundo|fundoNomeFor|fundoDialogProjetos|fundoDialogTickets|fundoByProjetoId|value="fundo"|Sem fundo' src</automated>
  </verify>
  <done>`bun test src` and `bun run check` (svelte-check + tsc) both pass clean. Zero remaining stale `fundo`-named identifiers, testids, or literal UI copy anywhere in `web/src` (grep-verified, including the markup-level `Select.Item`/testid/copy strings a type-only rename would miss). `defs/entidades.ts` exposes `tipoEntidade` as a required text field. `dashboardQuery.ts`'s `entidade: {}` nested branches are confirmed (live, via a quick manual `db.useQuery` smoke check or the Task 4 e2e run) to actually resolve data, not silently return `undefined`.</done>
</task>

<task type="auto">
  <name>Task 4: e2e rename, destructive schema push (D4 steps 4-5), final admin verification</name>
  <reversibility rating="one-way">The destructive schema push permanently removes the `fundos` entity + its 3 links (and their underlying row data, per RESEARCH.md's Schema-Push Deletion Semantics finding) from production. This exact step was explicitly authorized by the user in CONTEXT.md's D4 (steps 4-5), gated on Task 1's migration + Task 2/3's consumer rename already being live-verified complete — the door is already walked through by the user's own locked decision, so no additional checkpoint is inserted here (mirrors 260922-t1l Task 2's identical precedent).</reversibility>
  <files>web/e2e/dashboard.spec.ts, web/e2e/focus-dialog-entidade.spec.ts, web/e2e/projetos-section.spec.ts, web/e2e/focus-dialog-button-inventory.spec.ts, web/e2e/entities-projeto-etapa-tarefa.spec.ts, web/e2e/entities-form-restyle.spec.ts, web/e2e/cross-phase-verification.spec.ts, web/e2e/focus-dialog-dia-rotina.spec.ts, web/e2e/focus-dialog-projetos-kanban.spec.ts, web/e2e/focus-dialog-ticket.spec.ts, web/e2e/entities-entidades.spec.ts, web/e2e/dashboard-kanbans.spec.ts, web/e2e/focus-dialog-projeto.spec.ts, web/e2e/entities-table-restyle.spec.ts, web/e2e/entities-header-states.spec.ts, web/e2e/entities-form-dialog-composition.spec.ts, web/e2e/shell-nav.spec.ts, web/e2e/no-leakage.spec.ts, web/e2e/fixtures/instancia-admin-fixture.ts, web/e2e/entities-rotina-log.spec.ts, web/e2e/entities-ticket-subtarefa.spec.ts, web/e2e/entities-delete-confirmation.spec.ts, shared/instant.schema.ts, shared/instant.perms.ts, cli/tests/test_cli_surface.py</files>
  <action>
Step A — e2e rename (do this BEFORE the destructive schema push, so the full
system — CLI, web, AND e2e — is proven working end-to-end against
`entidades` while `fundos` still exists as a safety fallback). Rename
`web/e2e/entities-fundos.spec.ts` -> `entities-entidades.spec.ts` and
`web/e2e/focus-dialog-fundo.spec.ts` -> `focus-dialog-entidade.spec.ts` (git
mv). Across these 2 plus the other 20 files RESEARCH.md's `web/e2e/` table
lists (`dashboard.spec.ts`, `projetos-section.spec.ts`,
`focus-dialog-button-inventory.spec.ts`,
`entities-projeto-etapa-tarefa.spec.ts`, `entities-form-restyle.spec.ts`,
`cross-phase-verification.spec.ts`, `focus-dialog-dia-rotina.spec.ts`,
`focus-dialog-projetos-kanban.spec.ts`, `focus-dialog-ticket.spec.ts`,
`dashboard-kanbans.spec.ts`, `focus-dialog-projeto.spec.ts`,
`entities-table-restyle.spec.ts`, `entities-header-states.spec.ts`,
`entities-form-dialog-composition.spec.ts`), mechanically sweep: every
`apolloCli(["fundo", "criar"/"editar"/"deletar"/"listar", ...])` CLI-fixture
call -> `apolloCli(["entidade", ...])` (add `--tipo-entidade <valor>` to any
`"criar"` call, now required); every `nav-fundos` testid selector ->
`nav-entidades`; every `fundo-dialog-*`/`entidade` testid ->
`entidade-dialog-*`; every `rotinas-fundo-*` testid -> `rotinas-entidade-*`;
test names/comments mentioning "fundos"/"fundo" (e.g. "fundos leg:
full-CRUD representative", "ENTTBL: fundos (full-CRUD)") -> "entidades"/
"entidade"; sweep-order comments ("tickets before fundos") -> "entidades".
RESEARCH.md's Pitfall 4 applies here: these are 45+ near-identical argv call
sites across cleanup/setup fixtures (not the tests' own assertion subject)
— a missed site fails LOUD (CLI subprocess errors, non-zero exit) rather
than silently, but confirm via the final grep in this task's `<verify>`
regardless, not "I renamed the ones I remember."

`web/e2e/shell-nav.spec.ts`: rename the `"nav-fundos": "Fundos"` map entry
(both the testid string and expected label text) -> `"nav-entidades":
"Entidades"`.

`web/e2e/no-leakage.spec.ts`: rename the `ENTITY_NAMES` array's `"fundos"`
entry -> `"entidades"` — this is a real functional assertion (the
unauthenticated login page's body text must never contain any entity name),
not cosmetic; a missed rename here would silently stop checking anything.

For the 4 low-hit-count files RESEARCH.md flagged as needing verification
before editing (`web/e2e/fixtures/instancia-admin-fixture.ts`,
`entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts`,
`entities-delete-confirmation.spec.ts`): open each, confirm whether its
"fundo" hit is a real functional reference or incidental comment/prose
naming an unrelated file/pattern, and only edit if functional (per
RESEARCH.md, `instancia-admin-fixture.ts`'s `deleteAdminRecord(etype, eid)`
is already fully etype-generic and likely needs no functional change — its
2 hits are comment prose mentioning a pattern name used in OTHER files).

Run the affected e2e specs live against production (already-migrated
`entidades` data from Task 1, already-renamed CLI/web from Tasks 2-3) to
prove the rename works end-to-end before touching the schema.

Step B — destructive schema push (D4 step 4). Edit `shared/instant.schema.ts`:
remove the `fundos: i.entity({...})` block entirely, and remove the 3 old
links `fundoProjetos`/`fundoTemplatesRotina`/`fundoTickets` entirely from
the `links` block. Edit `shared/instant.perms.ts`: remove the `fundos:
donoRules,` line from `rules`. Edit `cli/tests/test_cli_surface.py`: remove
the transitional `_PENDING_SCHEMA_REMOVAL` constant added in Task 2 and its
2 usages (the `_schema_entity_names()` filter and the no-stale-key
assertion) — the schema no longer declares `fundos` at all, so this
exception is no longer needed; the file returns to its clean, permanent
state with `"entidades"` as the only relevant key. Run the push: `cd web &&
bun run instant:push` (`--yes`, non-interactive — this is a namespace
removal, which `instant-cli` deletes outright per RESEARCH.md's "Schema-Push
Deletion Semantics" finding, no ambiguous-rename prompt to resolve since
`fundos` is not being renamed to anything, it is being dropped).

Step C — final admin verification (D4 step 5, reframed per RESEARCH.md as
verification-only — the push itself already deletes the data). Run ONE
independent ad-hoc admin query: attempt `client.query({"fundos": {}})`
against production; whether this raises (namespace genuinely gone) or
returns `{"fundos": []}` (permissive InstaQL), either outcome proves zero
`fundos` rows survive — assert on whichever the live app actually returns.
Separately confirm `entidades` still holds exactly the migrated row count
(58, or whatever the live count was at Task 1 time) with `tipoEntidade ==
"Fundo"` for every originally-migrated row, unaffected by this push.

Step D — full-suite final re-run for both runtimes: `cli/` full pytest
(offline + live), `web/` `bun test src` + `bun run check` +
`bun run test:e2e` (full Playwright suite, all 3 projects). The 3
pre-existing, documented-unrelated test-fragility items in STATE.md's
Deferred Items (2 dashboard heatmap density-band assertions + 1
cross-channel `existing==[]` assertion, all pre-dating this task per Phase
30's own documentation) are expected to still fail identically — do not
attempt to fix them as part of this task; every OTHER test must be green.

Step E — final cleanup: delete the transient
`cli/scripts/migrate_fundos_to_entidades.py` (its job is done — Task 1's own
internal assertions plus this task's Step C already proved the migration
correct; nothing later in this plan or in normal operation needs it) and
confirm `git status --porcelain cli/scripts/` shows nothing.
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2 && ! grep -rnE '"fundos"|fundoId|fundo_id|_ETYPE_FUNDO|nav-fundos|apolloCli\(\["fundo"' cli/apollo_cli cli/tests web/src web/e2e --include="*.py" --include="*.ts" --include="*.svelte" && (cd web && bun run instant:push) && cli/.venv/bin/python -c "from apollo_cli.instant_client import login_client; c = login_client(); e = c.query({'entidades': {}}).get('entidades', []); print('entidades:', len(e)); assert len(e) > 0 and all(row.get('tipoEntidade') for row in e)" && rm -f cli/scripts/migrate_fundos_to_entidades.py && test ! -f cli/scripts/migrate_fundos_to_entidades.py</automated>
  </verify>
  <done>All ~22 e2e spec files renamed/swept, live Playwright runs pass against production `entidades` data before the destructive push. `shared/instant.schema.ts`/`instant.perms.ts` no longer declare `fundos` or its 3 links/rule. `test_cli_surface.py`'s transitional exception is removed. Independent admin verification confirms zero `fundos` rows survive (either query-error or empty result) and `entidades` retains its full migrated row set with `tipoEntidade` populated on every row. Full `cli/` pytest suite and `web/` unit+e2e suite green except the 3 pre-existing, documented, unrelated flaky items. `cli/scripts/migrate_fundos_to_entidades.py` deleted, working tree clean under `cli/scripts/`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI/SPA client -> InstantDB | Both channels authenticate as the same real user; `entidades`/`entidadeProjetos`/`entidadeTemplatesRotina`/`entidadeTickets` cross this boundary on every read/write, gated by `instant.perms.ts` |
| Migration script -> InstantDB (admin) | `cli/scripts/migrate_fundos_to_entidades.py` uses the ADMIN client (bypasses all perms), scoped strictly to reading `fundos`/child link data and writing `entidades`/new links — never deletes anything (deletion is Task 4's schema push, a separate, narrower operation) |
| `apollo import` JSON file -> CLI | Untrusted input boundary (a human-authored batch file); `tipoEntidade`'s D6 optional-default and `entidadeId` reference resolution both cross this boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vbt-01 | Elevation of Privilege | `shared/instant.perms.ts` | high | mitigate | `rules.entidades: donoRules` added in Task 1's additive push, in the SAME commit that introduces the `entidades` entity — never pushed to production without its perms rule already in place, even transiently. `test_cross_user_isolation.py` (renamed in Task 2) is the regression guard. |
| T-vbt-02 | Tampering (data integrity) | `cli/scripts/migrate_fundos_to_entidades.py` | high | mitigate | Task 1's internal assertions (count match + per-row byte-identity check across ALL 58 rows, not a sample) plus an independent post-hoc admin re-query before the script is deleted — mirrors 260922-t1l's proven discipline. |
| T-vbt-03 | Elevation of Privilege | `tipoEntidade` used as an implicit auth signal | medium | mitigate | D5 explicitly forbids per-`tipoEntidade` permission branches or `where` clauses anywhere; `donoRules` stays the sole gate. Verified by inspection during Task 1/4 (no `tipoEntidade` string appears in `instant.perms.ts` at any point). |
| T-vbt-04 | Tampering | Destructive schema push (Task 4) run before all consumers are renamed | critical | mitigate | Explicit task ordering (Task 4 last, after Task 2/3 fully stop referencing `fundos`) plus Task 4's own pre-push e2e live run against `entidades` — prevents the exact "delete a namespace still-read-by-live-code" failure mode RESEARCH.md's Schema-Push Deletion Semantics section warns about. |
| T-vbt-05 | Repudiation/Tampering | Transient migration script left in the repo after use | low | mitigate | Script lives at `cli/scripts/` (git-tracked only during this task); Task 1's own `<done>` does not require its removal (unlike 260922-t1l) since Task 4 still needs to re-verify against the same production state — flagged here for the SUMMARY.md to confirm final removal before this quick task is closed. |
| T-vbt-06 | Information Disclosure | `apollo import` batch JSON accepting attacker-controlled `entidadeId`/`tipoEntidade` values | low | accept | Unchanged from the pre-existing `fundoId`/`batch_import.py` threat surface (already accepted in Phase 31/BATCH-01) — this is a local, single-user CLI tool, not a network-exposed service; no new exposure introduced by the rename. |

</threat_model>

<verification>
1. Task 1's independent post-hoc admin query (run outside the migration script) confirms `entidades` count == pre-migration `fundos` count and every row has `tipoEntidade == "Fundo"`.
2. Task 2's full CLI pytest suite (offline + live) is green; grep confirms zero remaining `_ETYPE_FUNDO`/`--fundo-id`/`fundoId` identifiers in `cli/`.
3. Task 3's `bun test src` + `bun run check` are green; grep confirms zero remaining stale `fundo`-named identifiers, testids, or literal UI copy in `web/src`.
4. Task 4's full e2e suite (all 3 Playwright projects) passes against production with `fundos` already removed from the schema, except the 3 pre-existing documented flaky items.
5. Final independent admin query (Task 4) confirms zero `fundos` rows/schema declaration survive, and `entidades` retains its full row set with `tipoEntidade` populated.
6. `git status --porcelain cli/scripts/` shows nothing after the quick task closes (transient migration script created and removed within this plan, never left behind — mirrors 260922-t1l's own final-state guarantee).
</verification>

<success_criteria>
- Production `entidades` count equals the pre-migration `fundos` count (58 at research time, re-verify live at execution time), every row carrying `tipoEntidade`.
- Production `fundos` entity, its 3 links, and its perms rule no longer exist in `shared/instant.schema.ts`/`instant.perms.ts` or in production.
- `apollo entidade`/`apollo projeto --entidade-id`/`apollo ticket --entidade-id`/`apollo rotina template --entidade-id`/`apollo import` all work live against production; `apollo fundo` does not exist.
- Web SPA nav/dashboard/dialogs/table show "Entidades"/"entidade" throughout, with `tipoEntidade` editable as free text; no `apollo fundo`/`fundos`-named component, file, or testid remains.
- Full `cli/` pytest suite and `web/` unit + e2e suite green (excluding the 3 pre-existing, documented, unrelated flaky items already tracked in STATE.md Deferred Items).
- `cli/scripts/migrate_fundos_to_entidades.py` no longer exists in the working tree once this quick task closes.
</success_criteria>

<output>
Create `.planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-SUMMARY.md` when done, with `status: complete` in frontmatter, recording: exact before/after row counts for the migration, confirmation the transient migration script was deleted, and any deviation from RESEARCH.md's file enumeration discovered during execution (e.g. the `RoutinesByFundo.svelte` path correction already folded into this plan, or any of the 4 low-hit-count e2e files that turned out to need no edit).
</output>

