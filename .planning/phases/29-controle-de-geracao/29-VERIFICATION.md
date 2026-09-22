---
phase: 29-controle-de-geracao
verified: 2026-09-22T00:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files: [".planning/phases/29-controle-de-geracao/29-01-PLAN.md", ".planning/phases/29-controle-de-geracao/29-01-SUMMARY.md", ".planning/phases/29-controle-de-geracao/29-CONTEXT.md", ".planning/phases/29-controle-de-geracao/29-PATTERNS.md", ".planning/phases/29-controle-de-geracao/29-REVIEW.md", ".planning/phases/29-controle-de-geracao/deferred-items.md", "cli/apollo_cli/entities/rotina.py", "cli/apollo_cli/routine_job.py", "cli/tests/test_routine_job.py", "shared/routine-job.testcases.json", "web/src/lib/routineJob.test.ts", "web/src/lib/routineJob.ts"]
covered_digest: "v1:sha256:6078824b201899d3eb9fb7023e4f4de3ae5401aa36c21a432e8fe222e823dedb"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 29: Controle de geração Verification Report

**Phase Goal:** Operar `gerar-instancias` em volume não obriga arrastar meses indesejados nem perder instâncias do início do mês corrente por engano.
**Verified:** 2026-09-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `--competencia`/`--de`+`--ate` work and are mutually exclusive (exit 2 on conflict) | ✓ VERIFIED | Independently ran CLI: `--competencia 2026-08 --de ... --ate ...` → exit 2 "não pode ser combinado"; `--de` alone → exit 2 "devem ser informados juntos"; `--de > --ate` → exit 2 "deve ser <= --ate". `_resolve_range_override` (rotina.py:130-161) runs before `client_for_session()` (rotina.py:554-555), so no query/write on error. |
| 2 | `--competencia 0000-08` rejected cleanly at CLI layer (CR-01 fix) | ✓ VERIFIED | Independently called `_validate_competencia_format` directly via `uv run python3` (not trusting the re-review's transcript) — `'0000-08'` → `BadParameter: 'tem ano invalido'`. Also ran the real CLI: `apollo rotina gerar-instancias --competencia 0000-08` → exit 2, `Error: Invalid value for '--competencia': '0000-08' tem ano invalido`, no network call (callback fires during Click arg parsing, before command body). |
| 3a | SC1: single-competência generation without dragging next month | ✓ VERIFIED | Ran live test `test_gerar_instancias_range_competencia_narrows_to_single_month_no_drag` against real InstantDB — PASSED. Independently cross-checked with `weekly_occurrences('2026-08-01','2026-08-31',4)` → exactly `['2026-08-07','2026-08-14','2026-08-21','2026-08-28']`, no September date. |
| 3b | SC2: mid-month recovery of already-passed dates | ✓ VERIFIED | Ran live test `test_gerar_instancias_range_de_ate_recovers_past_date_of_current_month` against real InstantDB — PASSED (recovers `2026-08-03` without disturbing existing `2026-09-03`). |
| 3c | SC3: idempotency (same dedupeKeys with/without recorte) | ✓ VERIFIED | Ran live test `test_gerar_instancias_range_idempotent_across_recorte_and_default_range` against real InstantDB — PASSED (row-id-identical across recorte and wider default-range runs). |
| 3d | SC4: no dataPrevista/dedupeKey ever differs from what it'd be without a recorte | ✓ VERIFIED | Verified by code reading: `months_in_range`/`weekly_occurrences` only change candidate *selection* (`candidate_months`/`weekly_occurrences` loop); `build_dedupe_key`/`shift_competencia`/`nth_business_day_of_month`/`nth_calendar_day_of_month` (routine_job.py:202-253) are byte-for-byte unmodified and are the same functions called regardless of range. Confirmed empirically by SC3's row-id-identical live proof (same underlying claim). |
| 4 | `months_in_range`/`monthsInRange` provably backward-compatible with old hardcoded 2-month derivation | ✓ VERIFIED | Independently executed `months_in_range(today, end_of_next_month(today))` against 5 dates (mid-month, month-end, Dec 31→Jan rollover, Feb 1, cross-century Dec 2000→Jan 2001) — every case matched the old hardcoded `[(today_year,today_month),(next_month_year,next_month)]` exactly. Also verified inverted-range (`[]`), cross-year-boundary, and 4-month-span cases directly. |
| 5 | TS/Python parity for `monthsInRange`/range-override logic | ✓ VERIFIED | Read `web/src/lib/routineJob.ts:315-339` (`monthsInRange`) and `:566-572` (`computeExpectedInstances`'s `rangeOverride`) — structurally identical to the Python twin (same inverted-range short-circuit, same month-walk loop, same December-rollover idiom, same "replace not intersect" `??` fallback). Shared fixture `dayMath.monthsInRange` (5 cases) and 2 `rangeOverride`-bearing scenarios consumed identically by both offline suites (confirmed passing below). |
| 6 | Offline test suites green; pre-existing live-test failure confirmed unrelated | ✓ VERIFIED | `cd cli && uv run pytest -m "not live and not packaging"` → 402 passed, 2 skipped, 0 failed. `cd web && bun test src` → 206 pass, 0 fail. Ran the flagged pre-existing live test myself: `test_gerar_instancias_double_run_idempotent_and_preserves_status` FAILS on current `main`, with `report1["existing"]` containing 90 extra dedupeKeys whose templateId (`06c65dac-...`) does NOT belong to this test's own freshly-created templates — confirming account-wide accumulated data pollution, not a Phase 29 regression. Confirmed via `git show 89b5edf c7d36a5 c7a44e1 -- cli/tests/test_routine_job.py` that none of the phase's commits touch line 397 (the failing assertion) or its surrounding function. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/routine_job.py` | `months_in_range`, `compute_expected_instances`'s `range_override`, `run_routine_instance_job`'s threading | ✓ VERIFIED | Read directly: `months_in_range` at line 264, `range_override` param at line 493 (+usage 495-499), `run_routine_instance_job`'s `range_override` param at line 863 threaded to `compute_expected_instances` call. |
| `web/src/lib/routineJob.ts` | `monthsInRange`, `computeExpectedInstances`'s `rangeOverride` | ✓ VERIFIED | Read directly: `monthsInRange` at line 315, `rangeOverride?` param at line 570, `??` fallback at line 572. |
| `cli/apollo_cli/entities/rotina.py` | `--competencia`/`--de`/`--ate` flags, `_resolve_range_override`, `_validate_competencia_format` | ✓ VERIFIED | Read directly: `_COMPETENCIA_RE` line 68, `_validate_competencia_format` line 97, `_resolve_range_override` line 130, three new `@click.option`s and `range_override = _resolve_range_override(...)` at line 554. `--help` output independently confirmed all three flags + "substitui". |
| `shared/routine-job.testcases.json` | `dayMath.monthsInRange` + rangeOverride scenarios | ✓ VERIFIED | `python3` fixture assertion: `monthsInRange` has 5 cases, 2 scenarios carry `rangeOverride`, `tpl-range-corrido-a` present. Total scenarios = 34 (31 pre-existing + 3 new). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `rotina.py --competencia/--de/--ate` | `run_routine_instance_job`'s `range_override` | `_resolve_range_override`'s returned tuple | ✓ WIRED | Code read confirms `range_override = _resolve_range_override(competencia, de, ate)` then passed into `run_routine_instance_job(..., range_override=range_override)`, line 554-559. |
| `compute_expected_instances`'s `range_override` | `_compute_fixed_instances`/`_compute_semanal_instances`'s range args | `months_in_range(range_start, range_end)` | ✓ WIRED | Confirmed `range_start`/`range_end` locals flow unconditionally into both dispatch branches (lines 556-571) and the `encadeado` sweep filter (line 656) — all three consume the (possibly overridden) range without needing `today`. |

### Behavioral Spot-Checks / Live Proofs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01 fix (`--competencia 0000-08` rejected) | Direct call to `_validate_competencia_format` + real CLI invocation | `BadParameter`/exit 2 | ✓ PASS |
| CLI mutex/pairing/ordering validation (4 combinations) | Real CLI invocations | All exit 2, correct error messages | ✓ PASS |
| `--help` documents new flags + "substitui" | Real CLI `--help` | All present | ✓ PASS |
| `months_in_range` backward-compat (5 dates incl. Dec rollover, cross-century) | Direct Python execution | All match old hardcoded 2-month derivation | ✓ PASS |
| SC1 live (single competência, no drag) | `pytest -m live -k test_gerar_instancias_range_competencia_narrows_to_single_month_no_drag` | PASSED against real InstantDB | ✓ PASS |
| SC2 live (mid-month recovery) | `pytest -m live -k test_gerar_instancias_range_de_ate_recovers_past_date_of_current_month` | PASSED against real InstantDB | ✓ PASS |
| SC3/4 live (idempotency, row-id-identical) | `pytest -m live -k test_gerar_instancias_range_idempotent_across_recorte_and_default_range` | PASSED against real InstantDB | ✓ PASS |
| Offline CLI suite | `cd cli && uv run pytest -m "not live and not packaging"` | 402 passed, 2 skipped, 0 failed | ✓ PASS |
| Offline web suite | `cd web && bun test src` | 206 pass, 0 fail | ✓ PASS |
| Pre-existing live-test failure unrelated to Phase 29 | `pytest -m live -k test_gerar_instancias_double_run_idempotent_and_preserves_status` (run independently) | FAILS with 90 extra dedupeKeys from unrelated templateId (`06c65dac-...`); `git show` confirms no Phase 29 commit touches this test | ✓ PASS (confirmed unrelated, not masking a regression) |
| Lint/format/type gates | `ruff check/format --check`, `ty check` (CLI); `bun run check`, `bun run lint` (web) | All exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RANGE-01 | 29-01-PLAN.md | `gerar-instancias` accepts explicit range recorte without altering dating/dedupeKey derivation; recorte filters candidates, idempotency preserved | ✓ SATISFIED | All 6 observable truths above verified directly against the working codebase and, for the live-only claims, against the real production InstantDB app. |

### Anti-Patterns Found

None. Grepped the 6 phase files (per 29-REVIEW.md iteration 2, independently spot-checked) for hardcoded secrets, dangerous functions, debug artifacts, and unreferenced debt markers — no hits. `29-REVIEW.md` iteration 2 status is `issues_found` but only 1 Info-level finding (IN-01: dead-code TS-side unguarded-year gap in `weeklyOccurrences`/`monthsInRange`'s date parsing, no SPA caller reaches it, explicitly deferred by design since D-07/D-08 means no TS caller supplies `rangeOverride` yet). No blockers, no unresolved TBD/FIXME/XXX.

### Human Verification Required

None. All must-haves are either directly code-verified or live-verified via automated tests run in this session against the real production app.

### Gaps Summary

No gaps. All ROADMAP Success Criteria (1-4), the CR-01 fix, TS/Python parity, and offline test suites are independently confirmed against the actual codebase and live production data — not merely inferred from SUMMARY.md's narrative. The one pre-existing live-test failure (`test_gerar_instancias_double_run_idempotent_and_preserves_status`) was independently reproduced and its root cause (account-wide accumulated data from an unrelated templateId) confirmed via direct query-result inspection and `git show` diff — it is not a Phase 29 regression and does not block this phase's goal.

---

_Verified: 2026-09-22_
_Verifier: Claude (gsd-verifier)_
