# Phase 30: Ciclo de vida e higiene de dados - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 2 CLI targets (1 modified command + 1 new command group) + ~13 e2e spec files with sweep call sites
**Analogs found:** 2/2 for CLI; e2e call sites fully enumerated below (no new-file analog needed — all edits, no new spec files)

## Live-Experiment Findings (unblocks LIFE-02's operational "orphan" definition)

Ran a real experiment against the live production InstantDB app (session
`tp@rbrasset.com.br`, user_id `adf0d402-06df-4406-a5c7-ce82ee1bcb7e`):

1. Created a throwaway `templatesRotina` via `apollo rotina template criar`
   (`du_fixo`, `M0`, `offsetDias=0`).
2. Generated linked instances via `apollo rotina gerar-instancias` (the only
   sanctioned creator of `instanciasRotina`, per C-06) — got 2 real
   `instanciasRotina` rows linked to the throwaway template, each with a full
   `template: [{id, nome, ...}]` array under link expansion.
3. Deleted the template directly (`apollo rotina template deletar --id
   <id>`; no guard exists yet, so this is exactly what LIFE-01 will block by
   default).
4. Re-queried the orphaned instance two ways:
   - **Raw** (`{"instanciasRotina": {"$": {"where": {"id": instance_id}}}}`,
     no link expansion requested): row returned normally, all scalar fields
     intact (`id`, `status`, `dedupeKey`, `tipoPrazo`, `dataPrevista`,
     `competencia`, `donoId`) — **no `template` key present at all** (it was
     never requested).
   - **With link expansion** (`{"instanciasRotina": {"template": {},
     "$": {"where": {"id": instance_id}}}}`): the row came back **with no
     `template` key whatsoever** — not `"template": []`, not `"template":
     null`, the key is simply absent from the JSON object. This is a
     stronger/cleaner result than CONTEXT.md's hypothesis phrased as
     "returns empty" — it is not an empty array, it is a missing key. Any
     orphan-detection code must therefore check `"template" not in row or
     not row["template"]` (falsy-or-absent), not assume a `[]` shape.
   - A **filter-based** query (`{"instanciasRotina": {"template": {}, "$":
     {"where": {"template.id": <deleted_template_id>}}}}`) returned `[]` —
     confirms the reverse is also true: you cannot find orphans by filtering
     on the dead template's id, you must list all instances and check for
     absence of `template`.
5. **Confirms CONTEXT.md's hypothesis is correct in substance** (no error,
   no dangling reference, no exception) — refine it only on exact shape: key
   absence, not empty-array presence, matching the `_normalize_antecessor`
   pattern in `routine_job.py` which already treats "not a list, not a
   dict" as `None` — the same normalization approach should be reused for
   `template` in the new LIFE-02 command.
6. **Confirmed open question from CONTEXT.md decision 5b**: no `apollo
   rotina instancia deletar` command exists today (`instancia` group only
   has `listar`/`status`, verified `cli/apollo_cli/entities/rotina.py:179-
   190,431-450` — no `deletar` under `@instancia.command()`). Cleanup of the
   orphaned instance in this experiment required a raw
   `client.transact(client.tx["instanciasRotina"][id].delete())` call — the
   same low-level path LIFE-02's implementation will need internally (there
   is no `delete_entity` shortcut usable from outside a command, but
   `delete_entity(etype="instanciasRotina", eid=...)` from `crud_helpers.py`
   works fine as the actual deletion primitive once a command wraps it).
   The throwaway instance and template were both cleaned up; no residue
   left in production data.

## Grep Sweep Findings (unblocks LIFE-03/decision 5a+5b)

### Every `web/e2e/*.spec.ts` call site invoking `rotina template deletar`

No shared sweep helper exists in `web/e2e/helpers/` (contains only
`delete-confirmation.ts`, `form-controls.ts`, `gotoNested.ts`,
`magic-code.ts`, `subtarefasPanel.ts` — none sweep-related). **The
`sweepLeftovers`/`tryDelete`/`tryDeleteTemplate` pattern is duplicated
per-file, confirmed independently in each of the files below** — this
directly answers CONTEXT.md decision 6's open question: centralizing today
would touch 8 files instead of editing 8 files' local helpers, roughly a
wash file-count-wise, but a shared helper removes the duplication risk that
caused the original production incident (one file's sweep silently missing
`instanciasRotina` while others might not).

Two call-site shapes exist:

**Shape A — generic `tryDelete(group, eid)` where `group` can be
`"rotina template"`:**
- `web/e2e/dashboard.spec.ts` — `tryDelete` defined line 73 (`group.split("
  ")` + `"deletar"` + `--id`); `sweepTemplateLeftovers()` line 89-97 calls
  `tryDelete("rotina template", record.id)`; direct calls at lines 299, 573,
  923, 924, 925.
- `web/e2e/focus-dialog-button-inventory.spec.ts` — `tryDelete` line 43;
  sweep calls `tryDelete("rotina template", record.id)` line 81; direct call
  line 394.
- `web/e2e/focus-dialog-dia-rotina.spec.ts` — `tryDelete` line 36; sweep
  calls line 59; direct call line 266. **This is the file whose
  `sweepLeftovers()` is the traced root cause of the real
  `phase23-e2e-dedupe-weekday-...` residue (CONTEXT.md decision 5)** —
  `sweepLeftovers()` at lines 45-65 sweeps `tarefa`/`ticket`/`rotina
  template`/`fundo` by `nome`/`titulo` prefix, never `instanciasRotina`
  (which has no `nome` field, only `dedupeKey`).
- `web/e2e/focus-dialog-fundo.spec.ts` — `tryDelete` line 37; sweep call
  line 64; direct calls lines 304, 305.

**Shape B — dedicated `tryDeleteTemplate(eid)` (single-purpose wrapper,
direct `apolloCli(["rotina","template","deletar","--id",eid])` call):**
- `web/e2e/entities-rotina-log.spec.ts:46` — `tryDeleteTemplate`, called
  from `sweepLeftovers()` line 61.
- `web/e2e/routine-job.spec.ts:42` — `tryDeleteTemplate`, called at lines
  98, 102, 106; `sweepLeftovers()` (line 48-55) also uses it at line 54.
- `web/e2e/routine-job-cross-channel.spec.ts:48` — `tryDeleteTemplate`,
  called at line 87; `sweepLeftovers()` (line 54-61) uses it at line 60.

**Shape C — direct `apolloCli` call, no wrapper:**
- `web/e2e/entities-form-restyle.spec.ts:265` —
  `apolloCli(["rotina","template","deletar","--id",record.id])` inline
  inside its own sweep loop.

**Total: 8 distinct spec files need the new `--force`-equivalent flag added
to every `rotina template deletar` invocation** (both the sweep-loop calls
and the direct per-test cleanup calls) once LIFE-01 ships its blocking
guard — 21 individual call sites across those 8 files (counting each
`tryDelete("rotina template", ...)`/`tryDeleteTemplate(...)`/direct
`apolloCli` line separately, including both sweep-loop and explicit
`afterAll`/inline calls).

None of these 8 files currently sweep `instanciasRotina` at all — decision
5b's required extension (sweep instances by `dedupeKey` prefix) is net-new
in every one of them, not a fix to existing broken logic.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cli/apollo_cli/entities/rotina.py` (`deletar`, LIFE-01: add pre-delete count-guard + `--force`) | controller (CLI command) | CRUD (guarded delete) | Same file's own `_query_active_templates`-style link-expansion query (`routine_job.py:778-787`) + `crud_helpers.delete_entity`/`get_entity` | exact (same module, same helper library) |
| `cli/apollo_cli/entities/rotina.py` (new `instancia limpar-orfas` command, LIFE-02) | controller (CLI command, new subcommand under existing `instancia` group) | CRUD (list + guarded batch delete) | `crud_helpers.list_entities`/`delete_entity` (list-then-conditionally-delete shape) + `_query_active_templates`'s link-expansion query pattern (`routine_job.py:778-787`) + existing `instancia status`/`listar` commands (`rotina.py:424-450`) for click-group wiring conventions | role-match, very close (same file, same command group, same helper library) |
| `web/e2e/dashboard.spec.ts`, `focus-dialog-button-inventory.spec.ts`, `focus-dialog-dia-rotina.spec.ts`, `focus-dialog-fundo.spec.ts` (Shape A: generic `tryDelete`) | test (e2e cleanup helper) | request-response (CLI subprocess invocation) | Each other (identical duplicated pattern) | exact (self-analog — all 4 share byte-identical `tryDelete` shape) |
| `web/e2e/entities-rotina-log.spec.ts`, `routine-job.spec.ts`, `routine-job-cross-channel.spec.ts` (Shape B: `tryDeleteTemplate`) | test (e2e cleanup helper) | request-response (CLI subprocess invocation) | Each other (identical duplicated pattern) | exact (self-analog) |
| `web/e2e/entities-form-restyle.spec.ts` (Shape C: inline `apolloCli` call) | test (e2e cleanup helper) | request-response (CLI subprocess invocation) | `entities-fundos.spec.ts`'s `sweepLeftovers` (same file family, same PREFIX-scan idiom) for structure, though this one calls `deletar` inline rather than through a wrapper | role-match |

## Pattern Assignments

### `cli/apollo_cli/entities/rotina.py` — `deletar` (LIFE-01)

**Analog 1 — count query pattern**, from `cli/apollo_cli/routine_job.py:778-787`:
```python
def _query_active_templates(client: Instant, dono_id: str) -> list[dict[str, Any]]:
    result = client.query(
        {
            "templatesRotina": {
                "antecessor": {},
                "$": {"where": {"ativo": True, "donoId": dono_id}},
            }
        }
    )
    return result.get("templatesRotina", [])
```
Copy this InstaQL shape but expand the **reverse** link `instancias` (per
`shared/instant.schema.ts:153-154`, `reverse: {on: "templatesRotina", has:
"many", label: "instancias"}`) filtered to the one template id being
deleted:
```python
result = client.query(
    {
        "templatesRotina": {
            "instancias": {},
            "$": {"where": {"id": eid}},
        }
    }
)
rows = result.get("templatesRotina", [])
count = len(rows[0].get("instancias", [])) if rows else 0
```
(Live-verified: an empty/absent reverse link returns as either an absent
key or empty list on the row — mirror the `_normalize_antecessor`-style
falsy-or-absent check rather than assuming one specific shape.)

**Analog 2 — current unguarded command**, `cli/apollo_cli/entities/rotina.py:408-412`:
```python
@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to delete.")
def deletar(eid: str) -> None:
    """Delete a routine template."""
    delete_entity(etype=_ETYPE_TEMPLATE, eid=eid)
    emit({"id": eid, "deleted": True})
```
This is the exact function to modify — add a `--force` flag and the count
check before the existing `delete_entity` call, matching this module's
error-emission convention (`_emit_err` + `SystemExit(EXIT_API_ERROR)` or a
new exit code) rather than raising a bare exception. See
`crud_helpers.py`'s `_emit_err`/`instant_errors()`/`EXIT_API_ERROR` for the
existing error-shape vocabulary to extend (this phase's guard needs its own
distinct error `type`, e.g. `"instances_linked"`, plus exit code 2 per
CONTEXT.md decision 1 — note this differs from the existing `EXIT_API_ERROR
= 3` convention, so a new named exit constant is warranted, not a reuse of
an existing one).

**Error handling pattern** to imitate (`crud_helpers.py:190-198`, the
existing `not_found` guard in `delete_entity`):
```python
def delete_entity(*, etype: str, eid: str) -> None:
    if get_entity(etype=etype, eid=eid) is None:
        _emit_err({"error": "not_found", "etype": etype, "id": eid})
        raise SystemExit(EXIT_API_ERROR)
    ...
```
Same shape (query-then-conditionally-`_emit_err`-then-`SystemExit`) is the
right template for the new "instances linked, no `--force`" guard.

### `cli/apollo_cli/entities/rotina.py` — new `instancia limpar-orfas` (LIFE-02)

**Analog — list + generic CRUD delete helpers**, `cli/apollo_cli/crud_helpers.py:148-166` (`list_entities`) and `:216-223` (`delete_entity`):
```python
def list_entities(*, etype, where=None, limit=None) -> list[dict[str, Any]]:
    client, _ = client_for_session()
    query_opts: dict[str, Any] = {"where": where or {}}
    if limit is not None:
        query_opts["limit"] = limit
    with instant_errors():
        result = client.query({etype: {"$": query_opts}})
    return result.get(etype, [])
```
`limpar-orfas` cannot use `list_entities` as-is because it needs the
`template` link expanded (not just a `where` filter) — write a small local
query analogous to `_query_active_templates` instead:
```python
result = client.query(
    {
        "instanciasRotina": {
            "template": {},
            "$": {"where": {"donoId": dono_id}},
        }
    }
)
rows = result.get("instanciasRotina", [])
orphans = [r for r in rows if not r.get("template")]
```
(Live-verified exact shape: `r.get("template")` is safely falsy — either
key-absent or empty — for a truly orphaned instance; a healthy instance has
`"template": [{...}]`.)

**Command-group wiring analog**, existing `instancia status`
(`rotina.py:442-462`):
```python
@instancia.command()
@click.option("--id", "eid", required=True, help="Id of the instance to update.")
@click.option("--status", required=True, help="New status value.")
def status(eid: str, status: str) -> None:
    ...
    update_entity(etype=_ETYPE_INSTANCIA, eid=eid, fields={"status": status})
    emit({"id": eid, "updated": True})
```
Copy this `@instancia.command()` decorator + `emit(...)` JSON-output
convention. `limpar-orfas` defaults to list-only (`emit({"orphans": [...],
"count": N})`); the confirm flag additionally loops
`delete_entity(etype=_ETYPE_INSTANCIA, eid=row["id"])` per orphan (using
the existing `delete_entity` helper directly — no need to add a bare
`instancia deletar` command for production use, since C-06 still forbids
free-standing instance deletion outside this guarded path; PATTERNS confirms
no such command exists today).

**Docstring convention to preserve**: the module docstring
(`rotina.py:9-27`) currently states "`instanciasRotina` has NO `criar` and
NO `deletar` command here... this is still the reasoning behind `instancia`
having no `criar`/`deletar`." This docstring needs an explicit amendment
noting `limpar-orfas` is a narrow, template-link-only exception, not a
reopening of general instance deletion — do not silently contradict this
comment.

## Shared Patterns

### CLI error/exit-code vocabulary
**Source:** `cli/apollo_cli/crud_helpers.py:19-27` (existing exit constants) + `:190-198`/`:216-223` (`_emit_err` + `SystemExit` shape)
**Apply to:** both `deletar`'s new guard and `limpar-orfas`'s (if any) failure paths. CONTEXT.md decision 1 specifies exit code 2 for the blocked-delete case — this is a new, phase-specific exit code, not reused from `EXIT_NO_SESSION=1`/`EXIT_API_ERROR=3`/`EXIT_NETWORK_ERROR=4`; name it explicitly (e.g. `EXIT_INSTANCES_LINKED = 2`) in `crud_helpers.py` or locally in `rotina.py`, matching the existing `Final[int]` convention.

### InstaQL link-expansion query shape
**Source:** `cli/apollo_cli/routine_job.py:778-787` (`_query_active_templates`) and `:790-793` (`_normalize_antecessor`)
**Apply to:** both LIFE-01's count query and LIFE-02's orphan-detection query. Live experiment in this file confirms the normalization must treat the link as falsy-or-absent, exactly matching `_normalize_antecessor`'s existing `isinstance(value, list) -> value[0] if value else None` / `else None` shape — reuse or closely mirror this helper rather than writing ad hoc truthiness checks.

### e2e CLI-fixture invocation
**Source:** `web/e2e/dashboard.spec.ts:33-38` (`apolloCli`), reused verbatim across all e2e spec files:
```typescript
function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}
```
**Apply to:** every one of the 8 spec files needing the `--force` flag added to their `rotina template deletar` calls, and to any new instance-sweep logic (decision 5b) that shells out to `apollo rotina instancia listar`/a new bare delete path.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/e2e/helpers/sweep.ts` (if planner chooses to centralize per decision 6) | utility (test helper) | request-response | No shared e2e helper of this kind exists yet — `web/e2e/helpers/` only holds narrow UI-interaction helpers (`delete-confirmation.ts`, `form-controls.ts`, etc.), none do CLI-fixture sweeping. If planner centralizes, the closest structural analog is honestly the duplicated `sweepLeftovers`/`tryDelete` bodies themselves (e.g. `dashboard.spec.ts:73-98`) — extract-and-parameterize by `PREFIX`/`OWNER_EMAIL`/entity-group list, since every file already shares near-identical shape. |

## Metadata

**Analog search scope:** `cli/apollo_cli/entities/rotina.py`, `cli/apollo_cli/crud_helpers.py`, `cli/apollo_cli/routine_job.py`, `cli/tests/conftest.py`, `cli/tests/test_routine_job.py`, `shared/instant.schema.ts`, all `web/e2e/*.spec.ts`, `web/e2e/helpers/`.
**Files scanned:** ~34 e2e spec files (grep), 4 CLI/shared source files (read in full or targeted ranges), plus 1 live experiment against production InstantDB (throwaway records created and fully cleaned up).
**Pattern extraction date:** 2026-09-22
