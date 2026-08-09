---
phase: 02-shared-anbima-calendar
plan: 03
subsystem: shared-data
tags: [ruff, ty, quality-gates, docs, verify-script, anbima, phase-closeout]

# Dependency graph
requires:
  - phase: 02-shared-anbima-calendar (plan 01)
    provides: "shared/anbima-calendar.json (1003 holidays), shared/scripts/update_calendar.py"
  - phase: 02-shared-anbima-calendar (plan 02)
    provides: "web/src/lib/bizdays.ts, cli/apollo_cli/bizdays.py, shared/bizdays.testcases.json (42 cases, 13 error)"
provides:
  - "cli/README.md and README.md documenting the exact extended --config pyproject.toml . ../shared/scripts gate commands, mutation-proven to cover shared/scripts/"
  - ".planning/phases/02-shared-anbima-calendar/verify-phase-02.sh — single re-runnable proof of CAL-01..CAL-05, mirrors verify-phase-01.sh's shape"
affects: [phase-6-verify-02, phase-6-verify-03]

# Actuals
actuals:
  tokens: ~14000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ty check's default upward config-discovery from the project root already covers paths outside cli/ (e.g. ../shared/scripts) with no extra flag — unlike ruff, which requires an explicit --config pyproject.toml when linting a path outside the config file's own directory tree."
    - "verify-phase-02.sh's calendar-move loud-failure check uses a trap-guarded mv/restore pair, verified independently (outside the full script, via a minimal reproduction) to survive SIGINT mid-move without leaving the repo dirty."

key-files:
  created:
    - .planning/phases/02-shared-anbima-calendar/verify-phase-02.sh
  modified:
    - cli/README.md
    - README.md

key-decisions:
  - "ty check needs no --project or --config flag to cover shared/scripts/: uv run ty check --help shows a --project <PATH> flag exists for pinning a different project root, but ty's default behavior (walk up from the project root regardless of which paths are passed) already resolves cli/pyproject.toml's [tool.ty] settings correctly for ../shared/scripts — confirmed by running the extended command directly, zero findings."
  - "cli/pyproject.toml was NOT modified: uv run pytest (no testpaths config) already discovers and runs only cli/tests/ (224 tests, all under tests/) because no other test directory exists in the package — adding [tool.pytest.ini_options] testpaths would have been a no-op, so it was skipped per the plan's own conditional wording ('if uv run pytest ... does not already discover only tests/')."
  - "verify-phase-02.sh pins the holiday count (1003) and fixture case counts (42 total, 13 error) as literal drift-guard constants sourced from 02-01-SUMMARY.md and 02-02-SUMMARY.md respectively — not from PROJECT.md's stale '~948' figure, which this plan does not touch or reconcile."

requirements-completed: [CAL-01, CAL-02, CAL-03, CAL-04, CAL-05]

coverage:
  - id: D1
    description: "ruff/ty gate commands genuinely cover shared/scripts/, proven by mutation (extended catches an I001+ANN violation naming the file; naive uv run ruff check . does not)"
    requirement: "CAL-01, CAL-02, CAL-03, CAL-04, CAL-05 (gate scope, not requirement-specific)"
    verification:
      - kind: other
        ref: "Mutation proof run live: extended command (uv run ruff check --config pyproject.toml . ../shared/scripts) exits 1 reporting I001 + ANN202 + ANN001 for shared/scripts/update_calendar.py; naive uv run ruff check . exits 0 (All checks passed!) on the same mutated tree. File restored via git checkout --, git diff --exit-code clean afterward."
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-phase-02.sh re-proves CAL-01..CAL-05 in one command from a clean checkout, ending with PHASE 02 VERIFIED"
    requirement: "CAL-01, CAL-02, CAL-03, CAL-04, CAL-05"
    verification:
      - kind: other
        ref: "bash .planning/phases/02-shared-anbima-calendar/verify-phase-02.sh run from /tmp and from repo root, both exit 0 with final line 'PHASE 02 VERIFIED'; two consecutive runs from repo root both exit 0 with byte-identical git status --porcelain before/after (only pre-existing untracked .gsd/ and the new script itself present, unrelated to this plan)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Negative control: verify-phase-02.sh fails when a requirement is deliberately broken (CAL-04 fixture tampering)"
    requirement: "CAL-04"
    verification:
      - kind: other
        ref: "Flipped shared/bizdays.testcases.json's biz-day-ordinary-wednesday expected value to a bogus string; re-ran the script — CAL-04 section failed (bun test: 41 pass / 1 fail, exit 1) as required. Reverted via git checkout --, re-ran — PHASE 02 VERIFIED again."
        status: pass
    human_judgment: false
  - id: D4
    description: "Trap-guarded calendar-move restore survives interruption (T-02-12 mitigation)"
    requirement: "CAL-02, CAL-03"
    verification:
      - kind: other
        ref: "Full-script SIGINT timing window proved too fast to hit via external polling (mv+import+mv completes in milliseconds), so the exact trap/mv/restore pattern was extracted into a standalone reproduction, backgrounded, and sent SIGINT 1s after the mv — the trap fired and restored shared/anbima-calendar.json, confirmed present and git status --porcelain clean immediately after. Same trap code as in the shipped script."
        status: pass
    human_judgment: false
---

# Phase 2 Plan 3: Extend Quality Gates + verify-phase-02.sh Summary

**Locked and mutation-proved the `--config pyproject.toml . ../shared/scripts` ruff/ty gate scope, documented the calendar workflow in both READMEs, and shipped `verify-phase-02.sh` as a single re-runnable, negative-control-tested proof of CAL-01 through CAL-05.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files created:** 1 (`verify-phase-02.sh`)
- **Files modified:** 2 (`cli/README.md`, `README.md`)

## Accomplishments

- Confirmed and documented the exact three canonical Python gate commands (run from `cli/`):
  ```
  uv run ruff check --config pyproject.toml . ../shared/scripts
  uv run ruff format --check --config pyproject.toml . ../shared/scripts
  uv run ty check . ../shared/scripts
  ```
  `ty check --help` (`ty 0.0.69`) shows a `--project <PATH>` flag exists for pinning a different project root, but it is **not needed**: `ty`'s default upward config-discovery from the project root already resolves `cli/pyproject.toml`'s `[tool.ty]` settings correctly for `../shared/scripts` with no extra flag. `ruff` genuinely does need `--config pyproject.toml` — its per-file config discovery does not reach outside `cli/` on its own.
- Ran the scope mutation proof live (not just asserted): appended an unsorted `import os` + `import json as _json_dup` pair and an unannotated `_unannotated_helper(x)` function to `shared/scripts/update_calendar.py`. The extended command (`uv run ruff check --config pyproject.toml . ../shared/scripts`) exited 1, reporting `I001` (import order), `F401` x2 (unused imports), `ANN202`, and `ANN001` — all naming that file specifically. The naive `uv run ruff check .` (no `../shared/scripts` argument) exited 0 with "All checks passed!" on the same mutated tree, proving the exact gap this plan closes. File restored via `git checkout --`; `git diff --exit-code shared/scripts/update_calendar.py` clean afterward.
- `cli/pyproject.toml` was left unmodified: `uv run pytest` already discovers and runs only `cli/tests/` (224 tests collected, all under `tests/`) with no `testpaths` config needed, since no other test directory exists in the package.
- `cli/README.md` "Quality gates" section replaced with the extended three-command form, the `--config` rationale paragraph, and a new "Tests" section documenting `uv run pytest`. Root `README.md` gained a "Shared ANBIMA calendar" section (regeneration command, `--check` flag, manual/yearly cadence, `bizdays.testcases.json` fixture policy, `biome.json`-exclusion rationale) and an extended quality-gate section including both test-suite commands.
- `verify-phase-02.sh` created mirroring `verify-phase-01.sh`'s shape (`set -euo pipefail`, `cd` to repo root resolved from `${BASH_SOURCE[0]}`, one labeled section per requirement, final `PHASE 02 VERIFIED` line). Every section runs a real command whose exit status decides pass/fail — no step prints PASS without executing a check.
- Verified end to end: runs cleanly from repo root and from `/tmp`; two consecutive runs both exit 0 with byte-identical `git status --porcelain` before and after; negative control (flipped a fixture `expected` value) makes the CAL-04 section fail as required, then passes again once reverted; the trap-guarded calendar-move restore was independently confirmed to survive `SIGINT` mid-move (see Issues Encountered below for the timing caveat on the full-script interrupt test).

## Task Commits

1. **Task 1: Make ruff and ty genuinely cover shared/scripts, and document the calendar workflow** — `5f23394` (docs)
2. **Task 2: Write verify-phase-02.sh as the single re-runnable proof of CAL-01 through CAL-05** — `0998c34` (test)

## Files Created/Modified

- `.planning/phases/02-shared-anbima-calendar/verify-phase-02.sh` — executable bash gate, sections CAL-01 through CAL-05 plus quality gates, final line `PHASE 02 VERIFIED`
- `cli/README.md` — extended "Quality gates" section with `--config pyproject.toml` rationale, new "Tests" section
- `README.md` — "Shared ANBIMA calendar" section, extended "Quality gates" section with both test-suite commands

## Decisions Made

- See `key-decisions` in frontmatter above (ty needs no extra flag; `cli/pyproject.toml` left unmodified since `testpaths` was already effectively satisfied; drift-guard counts pinned from plan SUMMARYs, not PROJECT.md's stale figure).

## Mutation Proof Record (Task 1, both halves)

- **Extended command catches it:** `uv run ruff check --config pyproject.toml . ../shared/scripts` on the mutated `shared/scripts/update_calendar.py` → exit 1, `Found 5 errors` (`I001`, `F401` x2, `ANN202`, `ANN001`), all pointing at `shared/scripts/update_calendar.py` by absolute path.
- **Naive command misses it:** `uv run ruff check .` (from `cli/`, no `../shared/scripts` argument) on the same mutated tree → exit 0, `All checks passed!`.
- File restored (`git checkout -- shared/scripts/update_calendar.py`), re-verified clean (`git diff --exit-code` exit 0).

## Negative-Control Result (Task 2)

Temporarily set `shared/bizdays.testcases.json`'s `biz-day-ordinary-wednesday` case's `expected` value to a bogus string (`"ZZZZZZZZZZ-MUTATED"`). Re-running `verify-phase-02.sh` failed inside the CAL-04 section (`bun test`: 41 pass / 1 fail, script exit 1) — the script is not vacuous. Restored via `git checkout -- shared/bizdays.testcases.json`; re-ran and got `PHASE 02 VERIFIED` again.

## Pinned Numbers and Their Source

- **Holiday count: 1003** — from `02-01-SUMMARY.md` ("exactly 1003 holidays... start=2000-01-01, end=2078-12-25"), re-confirmed live by parsing `shared/anbima-calendar.json` directly in this plan.
- **Fixture case count: 42 total, 13 error cases** — from `02-02-SUMMARY.md`'s "Fixture Case Counts" section, re-confirmed live by parsing `shared/bizdays.testcases.json` directly in this plan (42 cases, 13 with an `error` key, all `id`s unique).
- Neither number was taken from `PROJECT.md` C-03's stale "~948" holiday figure, which this plan does not reopen or reconcile (per PROJECT.md's LOCKED constraints).

## Note for Phase 6

`verify-phase-02.sh` is intended to be run verbatim alongside `verify-phase-01.sh` as part of Phase 6's end-to-end verification pass. Its three extended Python gate commands and the web toolchain commands are the same ones documented in `cli/README.md` and the root `README.md` — Phase 6's VERIFY-02/VERIFY-03 should reuse those documented commands directly rather than re-deriving them, so gate scope cannot silently drift between phases.

## Issues Encountered

- **Full-script SIGINT timing window.** The plan's Task 2 acceptance criteria call for "interrupting a run with `Ctrl-C`-equivalent `kill -INT` during the CAL-02/03 section" as part of proving the calendar-move restore trap works. In practice, the `mv` → Python import check → `mv` back sequence inside that section completes in low single-digit milliseconds, faster than an external bash polling loop (even a tight no-sleep loop, tested up to 5000 iterations) could reliably observe the intermediate "file is moved" state and deliver `SIGINT` before the section finished on its own. Rather than accept an untested trap, I extracted the exact trap/mv/restore code from the shipped script into a standalone reproduction, backgrounded it with an explicit `sleep 30` inserted after the `mv` (to create an observable window), and sent `SIGINT` 1 second later — the trap fired correctly, restoring `shared/anbima-calendar.json` and leaving `git status --porcelain` clean. This is the same trap code shipped in `verify-phase-02.sh`; the reproduction only added a deliberate delay to make the race observable, it did not change the restore logic. Not a deviation from the plan's intent — the acceptance criterion's goal (prove the trap survives interruption) was met by an equivalent, honestly-reported method.

## User Setup Required

None — this plan is entirely offline documentation and shell-script work with no external service configuration.

## Next Phase Readiness

- Phase 2 is closed. All five CAL-01..CAL-05 requirements are re-provable in one command (`verify-phase-02.sh`), alongside Phase 1's `verify-phase-01.sh`.
- Phase 6 planning can reuse the documented gate commands and both verify scripts verbatim — no gate scope needs re-deriving.
- Open item carried from `02-02-SUMMARY.md`, unaffected by this plan: confirm `nextBusinessDay`'s strictly-after semantics against Phase 5's actual `du_fixo`/`corrido_fixo`/`encadeado` routine-generation rules during Phase 5 planning.

---
*Phase: 02-shared-anbima-calendar*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 4 claimed files verified present on disk (`verify-phase-02.sh`, `cli/README.md`, `README.md`, `02-03-SUMMARY.md`). Both task commit hashes (`5f23394`, `0998c34`) verified present in git history.
