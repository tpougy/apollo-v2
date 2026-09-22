---
phase: 26-valida-o-na-escrita
plan: 01
subsystem: cli
tags: [click, cli-validation, pytest-live, e2e-fixtures]

requires: []
provides:
  - "apollo rotina template criar/editar --regra-competencia bound to click.Choice(REGRAS_COMPETENCIA_SUPORTADAS), rejecting out-of-enum values at exit 2 before any write"
  - "Corrected --regra-competencia help text (criar/editar) and docs/ai-usage/CLAUDE.md cheatsheet, no longer describing the field as free-form/unparsed"
  - "Corrected --propagar-atraso-soft help text (criar/editar) stating the value is stored but not currently read (C-09)"
  - "Corrected instancia status docstring: dedupeKey described as plain concatenation, not a hash"
  - "Two new permanent live regression tests proving VAL-01's reject-at-write-time contract"
  - "Every pre-existing CLI/e2e fixture using a now-invalid placeholder regraCompetencia repaired to M0"
affects: [27-job-robustez]

actuals:
  tokens: 2768
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "click.Choice bound to an imported tuple (never redeclared) for enum-style CLI options that must share a single source of truth with the job runtime"

key-files:
  created: []
  modified:
    - cli/apollo_cli/entities/rotina.py
    - docs/ai-usage/CLAUDE.md
    - cli/tests/test_crud_rotina_template.py
    - cli/tests/test_rotina_instancia.py
    - web/e2e/focus-dialog-fundo.spec.ts
    - web/e2e/focus-dialog-button-inventory.spec.ts
    - web/e2e/focus-dialog-dia-rotina.spec.ts
    - web/e2e/dashboard.spec.ts

key-decisions:
  - "Task 1's own <verify> (which includes the pre-existing test_full_crud_round_trip) cannot pass until Task 2's fixture repair lands, since enum enforcement immediately breaks several pre-existing placeholder fixtures in the same file — proceeded directly from Task 1 into Task 2 (both type=auto/tracer, no checkpoint) rather than treating the transient red as a blocker, per the plan's own objective text anticipating this exact sequence."
  - "Reworded --propagar-atraso-soft help text from 'NOT currently read anywhere' to 'Not currently read anywhere: ...' after discovering Click's ~80-column help wrapping split 'currently'/'read' across lines, defeating the plan's own grep -q 'currently read' acceptance check — moved the phrase to the start of the sentence so it stays on one wrapped line."

patterns-established:
  - "Enum-style CLI options must import their accepted-values tuple from the single module that also validates it at job time (apollo_cli.routine_job), never redeclare a second list that can drift."

requirements-completed: [VAL-01, VAL-02, VAL-03]

coverage:
  - id: D1
    description: "apollo rotina template criar/editar --regra-competencia <invalid> rejected at exit 2, naming M0/M-1/M-2/M+1, with no record written/changed"
    requirement: "VAL-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_criar_regra_competencia_invalida_e_recusada_na_hora"
        status: pass
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_editar_regra_competencia_invalida_e_recusada_na_hora"
        status: pass
    human_judgment: false
  - id: D2
    description: "--help output and docs/ai-usage/CLAUDE.md no longer describe --regra-competencia as free-form/unparsed"
    requirement: "VAL-01"
    verification:
      - kind: other
        ref: "uv run --project cli apollo rotina template criar --help | grep -q -- '--regra-competencia \\[M0|M-1|M-2|M+1\\]'"
        status: pass
      - kind: other
        ref: "uv run --project cli apollo rotina template editar --help | grep -q -- '--regra-competencia \\[M0|M-1|M-2|M+1\\]'"
        status: pass
    human_judgment: false
  - id: D3
    description: "--propagar-atraso-soft help text states the value is stored but not currently read by gerar-instancias (C-09)"
    requirement: "VAL-02"
    verification:
      - kind: other
        ref: "uv run --project cli apollo rotina template criar --help | grep -q 'currently read' (and 'C-09')"
        status: pass
      - kind: other
        ref: "uv run --project cli apollo rotina template editar --help | grep -q 'currently read'"
        status: pass
    human_judgment: false
  - id: D4
    description: "instancia status --help no longer describes dedupeKey as a hash"
    requirement: "VAL-03"
    verification:
      - kind: other
        ref: "uv run --project cli apollo rotina instancia status --help | grep -q 'concatenation'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zero observable regression for already-valid regraCompetencia/propagarAtrasoSoft values; full CLI pytest suite (offline) and affected fixtures pass"
    requirement: null
    verification:
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_full_crud_round_trip"
        status: pass
      - kind: unit
        ref: "cd cli && uv run pytest -m 'not live and not packaging' (348 passed, 2 skipped)"
        status: pass
      - kind: other
        ref: "cd web && bun run lint && bun run check (0 new errors in edited spec files)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-14
status: complete
---

# Phase 26 Plan 01: Validação na escrita Summary

**`apollo rotina template criar/editar --regra-competencia` now rejects any value outside `M0`/`M-1`/`M-2`/`M+1` at write time via `click.Choice`, closing the silent-failure gap that previously only surfaced deep inside `gerar-instancias`; `--propagar-atraso-soft` and `instancia status`'s docstring no longer misdescribe their own behavior.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 8 (plus 1 new deferred-items.md log)

## Accomplishments
- `template.criar`/`template.editar --regra-competencia` bound to `type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)`, imported from `apollo_cli.routine_job` (single source of truth, never redeclared) — an invalid value now exits 2 immediately, naming all four accepted values, with no `templatesRotina` record created or mutated.
- Two new permanent live regression tests (`test_criar_regra_competencia_invalida_e_recusada_na_hora`, `test_editar_regra_competencia_invalida_e_recusada_na_hora`) proving the reject-at-write-time contract, including that `editar`'s rejected attempt leaves the target record's `regraCompetencia` unchanged.
- Every pre-existing CLI test and web e2e fixture that seeded a `rotina template criar` call with a now-invalid placeholder (`mes_corrente`, `mes_seguinte`, `encadeada`, `R`, `mes-corrente`) repaired to the accepted value `M0` — 5 sites in `test_crud_rotina_template.py`, 1 in `test_rotina_instancia.py`, 9 across the four affected e2e spec files.
- `--propagar-atraso-soft` help text (both `criar`/`editar`) now states the value is stored but not currently read anywhere (citing C-09), instead of implying active propagation behavior.
- `instancia status`'s docstring corrected: `dedupeKey` is now described as the plain `templateId:competencia:dataPrevista` concatenation, matching `routine_job.py`'s own canonical wording, instead of incorrectly calling it a hash.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end `--regra-competencia` enum enforcement (VAL-01)** - `6349273` (feat)
2. **Task 2: Repair existing CLI/e2e fixtures broken by the new enum** - `d924a53` (fix)
3. **Task 3: Correct `--propagar-atraso-soft` help text and `dedupeKey` docstring (VAL-02/VAL-03)** - `c4399ba` (docs)

_Note: Task 1 is `type="tracer"`; its own `<verify>` (which includes the pre-existing `test_full_crud_round_trip`) only became fully green after Task 2's fixture repair landed — see Deviations._

## Files Created/Modified
- `cli/apollo_cli/entities/rotina.py` - `--regra-competencia` enum enforcement on `criar`/`editar`; corrected `--propagar-atraso-soft` help text; corrected `instancia.status` docstring
- `docs/ai-usage/CLAUDE.md` - `apollo rotina template criar` cheatsheet line corrected to bracket-enum notation
- `cli/tests/test_crud_rotina_template.py` - two new live regression tests; five pre-existing fixture values corrected to `M0`
- `cli/tests/test_rotina_instancia.py` - one pre-existing fixture value corrected to `M0`
- `web/e2e/focus-dialog-fundo.spec.ts`, `web/e2e/focus-dialog-button-inventory.spec.ts`, `web/e2e/focus-dialog-dia-rotina.spec.ts`, `web/e2e/dashboard.spec.ts` - CLI-seeding fixture values corrected to `M0` (9 call sites)
- `.planning/phases/26-valida-o-na-escrita/deferred-items.md` - new: logs one pre-existing, out-of-scope live-DB pagination flake discovered during verification

## Decisions Made
- Proceeded from Task 1 directly into Task 2 without pausing at a checkpoint: Task 1's `type="tracer"` `<verify>` includes the pre-existing `test_full_crud_round_trip`, which is guaranteed to fail immediately after enum enforcement lands (it still used placeholder `regraCompetencia` values) until Task 2's fixture repair runs. The plan's own objective text explicitly anticipates this ("this plan's second task repairs every one of those fixtures before it can happen"), so this was treated as intended in-plan sequencing, not an architectural deviation requiring a checkpoint.
- Reworded `--propagar-atraso-soft`'s help text from "Stored on the template but NOT currently read anywhere" to "Not currently read anywhere: stored on the template only" after discovering Click's ~80-column `--help` wrapping split "currently" and "read" onto separate lines, which defeated the plan's own `grep -q 'currently read'` acceptance check. Moved the phrase to the start of the sentence so it stays intact within one wrapped line — same meaning, no functional change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `--propagar-atraso-soft` help text wording split across a Click help-wrap boundary**
- **Found during:** Task 3 verification
- **Issue:** The plan's specified wording ("Stored on the template but NOT currently read anywhere...") wrapped at Click's default ~80-column width such that "currently" and "read" landed on separate output lines, causing the plan's own `grep -q 'currently read'` acceptance check to fail on both `criar` and `editar --help`.
- **Fix:** Reworded to open with "Not currently read anywhere: stored on the template only; ..." so the load-bearing phrase stays on a single wrapped line. Meaning and all cited facts (C-09, stored-not-read, defaults) unchanged.
- **Files modified:** `cli/apollo_cli/entities/rotina.py`
- **Verification:** `apollo rotina template criar/editar --help | grep -q 'currently read'` now passes for both commands.
- **Committed in:** `c4399ba` (Task 3 commit)

**2. [Out-of-scope, logged not fixed] Pre-existing live-DB pagination flake unrelated to this plan**
- **Found during:** Task 2 verification (`uv run pytest tests/test_crud_rotina_template.py tests/test_rotina_instancia.py`)
- **Issue:** `test_criar_without_offset_dias_omits_key_entirely` fails with `StopIteration` — `rotina template listar --limit 50` no longer reliably returns a just-created record, because the live InstantDB app now holds 84+ pre-existing `templatesRotina` records from the real RBR onboarding, and `listar` has no explicit creation-time ordering.
- **Verified unrelated:** `git diff`/`git log` confirm neither Task 1 nor Task 2 touched this test; it fails identically standalone with no `--regra-competencia` involvement.
- **Action:** Not fixed (out of this plan's scope per CONTEXT.md decision #5 — this phase only touches `--regra-competencia`/`--propagar-atraso-soft`/`dedupeKey`). Logged to `.planning/phases/26-valida-o-na-escrita/deferred-items.md` for a future phase.

---

**Total deviations:** 1 auto-fixed (Rule 1, help-text wrap wording), 1 logged-and-deferred (pre-existing, out-of-scope live-DB flake).
**Impact on plan:** No scope creep — both discoveries were incidental to verification, not design changes. All must-haves and success criteria remain fully met.

## Issues Encountered
- Click's default `--help` content width (~80 columns, capped regardless of `$COLUMNS`) can silently split a substring the plan's `<verify>` block greps for across two wrapped lines. Future plans authoring `grep`-based help-text acceptance checks should place the load-bearing phrase near the start of a sentence to avoid wrap-boundary flakiness.

## Next Phase Readiness
- VAL-01, VAL-02, VAL-03 fully closed and live-verified; Phase 26 (Validação na escrita) is complete.
- `routine_job.py`/`routineJob.ts` untouched, as required — Phase 27 (job robustez) can proceed without any collision with this phase's edits.
- One pre-existing, unrelated live-DB pagination flake logged in `deferred-items.md` for future triage; does not block Phase 27.

---
*Phase: 26-valida-o-na-escrita*
*Completed: 2026-08-14*

## Self-Check: PASSED

All created/modified files and all 3 task commits verified present.
