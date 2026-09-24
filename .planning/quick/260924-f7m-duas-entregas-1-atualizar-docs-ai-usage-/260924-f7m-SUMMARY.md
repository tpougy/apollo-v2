---
phase: 260924-f7m
plan: 1
subsystem: cli
tags: [docs, cli, click, importlib-resources, apollo-init]

# Dependency graph
requires:
  - phase: 260922-vbt
    provides: fundo->entidade generic-entity rename (the CLI surface these docs catch up with)
provides:
  - "docs/ai-usage/{README,CLAUDE}.md fully renamed to entidade/entidades terminology (CLI syntax + generic prose)"
  - "cli/apollo_cli/data/scaffold/{README,CLAUDE}.md — a byte-parity-tested vendored copy of the onboarding docs, shipped inside the installed CLI package"
  - "apollo init <path> — a new top-level command that scaffolds an Apollo Tasks folder and reports read-only auth status"
affects: [cli-packaging, onboarding-docs]

actuals:
  tokens: 9709
  tasks: 2
  commits: 2
plan_head_before: 32c89414830f920678dec5b952b9a380e5ffdc2e

tech-stack:
  added: []
  patterns:
    - "importlib.resources vendoring for .md scaffold files, mirroring the existing ANBIMA calendar JSON vendoring + byte-parity-test precedent"
    - "check-then-write ordering for a multi-file overwrite guard (read+compare both files before writing either, mirrors rotina.py's query-before-write idiom)"
    - "never-raising reimplementation of an existing whoami-style auth check for a command that must always exit 0"

key-files:
  created:
    - cli/apollo_cli/data/scaffold/__init__.py
    - cli/apollo_cli/data/scaffold/README.md
    - cli/apollo_cli/data/scaffold/CLAUDE.md
    - cli/tests/test_scaffold_vendored_parity.py
    - cli/apollo_cli/init.py
    - cli/tests/test_init.py
  modified:
    - docs/ai-usage/README.md
    - docs/ai-usage/CLAUDE.md
    - cli/apollo_cli/cli.py
    - cli/tests/test_auth_rejection.py
    - .planning/STATE.md

key-decisions:
  - "Kept the CLI-verbatim '--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)' line even though it contains the literal substring 'Fundo' — it is a real, still-valid --tipo-entidade example value quoted verbatim from the live CLI's own --help text (entidade.py:46), not a stale generic reference to the old fundo-as-entity-model term the rename targets."
  - "Added init.py to test_auth_rejection.py's _INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES allow-list, mirroring auth.py's documented exemption, since apollo init's read-only auth-status check legitimately constructs a bare Instant(...) client for the same never-cascade-a-corrupt-session reason whoami does."

requirements-completed: []

coverage:
  - id: D1
    description: "docs/ai-usage/README.md and CLAUDE.md renamed fundo->entidade (CLI syntax + generic prose per D3+D6)"
    verification:
      - kind: other
        ref: "grep -i fundo docs/ai-usage/README.md docs/ai-usage/CLAUDE.md (one expected, intentional match — see Deviations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cli/apollo_cli/data/scaffold/{README,CLAUDE}.md vendored, byte-identical to docs source, enforced by a passing pytest parity test"
    verification:
      - kind: unit
        ref: "cli/tests/test_scaffold_vendored_parity.py::test_vendored_scaffold_file_is_byte_identical_to_docs_source"
        status: pass
    human_judgment: false
  - id: D3
    description: "apollo init <path> creates the folder, writes byte-identical vendored files, refuses-then-force-overwrites a locally-edited folder, and always exits 0 with honest real auth status"
    verification:
      - kind: integration
        ref: "cli/tests/test_init.py (4 live tests, invoked against the real CLI + real session)"
        status: pass
      - kind: integration
        ref: "cli/tests/test_cli_surface.py (14 tests: help-completeness, JSON-output-only, suppression gates)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-24
status: complete
---

# Quick Task 260924-f7m: Docs entidade-rename + `apollo init` scaffold Summary

**`docs/ai-usage/{README,CLAUDE}.md` renamed fundo->entidade and vendored byte-parity-tested into the CLI package; new `apollo init <path>` command scaffolds an Apollo Tasks folder with a force-guarded overwrite check and a never-crashing real auth-status report.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-24T13:41:00Z (approx, session start)
- **Completed:** 2026-09-24T14:16:02Z
- **Tasks:** 2
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments
- Every `apollo fundo *`/`--fundo-id` CLI-syntax reference and every generic-prose "fundo(s)" reference in the onboarding docs renamed to `entidade`/`entidades`, including the domain-hierarchy diagram and the `apollo entidade criar` field block gaining `--tipo-entidade` (verbatim match to the real CLI).
- The renamed docs are now the single source of truth, vendored byte-for-byte into `cli/apollo_cli/data/scaffold/` and read at runtime via `importlib.resources`, with a parity test that fails loudly if the two copies ever diverge.
- New `apollo init <path>` command: creates the target folder, writes the vendored README.md/CLAUDE.md, refuses to clobber locally-edited copies (exit 6, JSON error, zero writes) unless `--force`, and reports real auth status (authenticated email, or the exact two `apollo auth login` commands) — live-proven to always exit 0 even on a simulated unauthenticated first-run machine.
- The unrelated rotina/import doc-drift found during research is now a tracked Deferred Item in `.planning/STATE.md` rather than silently left undocumented.

## Task Commits

1. **Task 1: Rename docs to entidade, vendor a byte-parity-tested copy into the CLI package** - `84e4fc3` (feat)
2. **Task 2: Implement `apollo init <path>` — scaffold + force guard + read-only auth status, live-tested** - `9dbee93` (feat)

**Plan metadata:** committed alongside this SUMMARY by the orchestrator.

## Files Created/Modified
- `docs/ai-usage/README.md` - fundo->entidade rename (6 line-level edits)
- `docs/ai-usage/CLAUDE.md` - fundo->entidade rename (domain diagram, field blocks, onboarding steps, log-inferencia enum)
- `cli/apollo_cli/data/scaffold/__init__.py` - empty file, makes `apollo_cli.data.scaffold` a real subpackage
- `cli/apollo_cli/data/scaffold/README.md` / `CLAUDE.md` - byte-identical vendored copies of the renamed docs
- `cli/tests/test_scaffold_vendored_parity.py` - byte-parity gate (2 parametrized tests, mirrors the ANBIMA calendar precedent)
- `cli/apollo_cli/init.py` - `run_init()`: mkdir -p, check-then-write overwrite guard (exit 6), `_auth_status()` never-raising whoami reimplementation
- `cli/apollo_cli/cli.py` - registers `apollo init` (thin, `emit()`-based, mirrors the `import` command's shape)
- `cli/tests/test_init.py` - 4 live tests covering scaffold write, force round trip, both auth-status branches
- `cli/tests/test_auth_rejection.py` - added `init.py` to the `Instant(...)` constructor allow-list with rationale
- `.planning/STATE.md` - new Deferred Items row for the out-of-scope rotina/import doc drift

## Decisions Made
- Kept the verbatim CLI help text `--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)` even though it contains "Fundo" — this is a real, still-current example value of the free-text `--tipo-entidade` field (confirmed against `entidade.py:46`), not stale terminology; renaming it would make the doc diverge from the actual CLI's own `--help` output.
- Reused `auth.whoami`'s exact `Instant(app_id=..., admin_token="")` + `verify_token` mechanism read-only inside `_auth_status()`, never `crud_helpers.require_session()` (which `SystemExit`s on the very failure mode `init` must tolerate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `init.py` to `test_auth_rejection.py`'s `Instant(...)` constructor allow-list**
- **Found during:** Task 2 (running the full offline test suite after implementing `init.py`)
- **Issue:** `test_admin_token_confinement` structurally forbids any `apollo_cli/*.py` file from constructing `Instant(...)` directly, except a small, explicitly documented allow-list (`instant_client.py`, `auth.py`). `init.py` legitimately does this (per the plan's own Finding 3 instruction to mirror `whoami`'s mechanism), so the test failed.
- **Fix:** Added `"init.py"` to `_INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES` with a comment explaining the same rationale already documented for `auth.py`.
- **Files modified:** `cli/tests/test_auth_rejection.py`
- **Verification:** Full offline suite (`uv run pytest -m "not live and not packaging"`) went from 1 failed/410 passed to 411 passed/2 skipped.
- **Committed in:** `9dbee93` (Task 2 commit)

### Known, Documented (Not a Bug)

**Plan's automated verify command for Task 1 (`! grep -qi "fundo" docs/ai-usage/README.md docs/ai-usage/CLAUDE.md`) reports one match.**
- The one remaining case-insensitive "fundo" occurrence is `docs/ai-usage/CLAUDE.md:63`: `--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)`. This line is a NEW addition mandated by both CONTEXT.md D3 ("gains `--tipo-entidade TEXT (obrigatorio, ex: Fundo, Cliente, Area)`... confirmed the current real CLI surface") and PLAN.md's own Step B instruction ("the new line's field name/order/wording matches the real CLI verbatim, `entidade.py:40-52`"), which itself literally reads `"Tipo/categoria da entidade (texto livre, ex.: Fundo, Cliente, Area)"`.
- This is a genuine contradiction between the plan's own action text (which mandates this verbatim string) and its automated verify command (a blanket case-insensitive grep with no exception). "Fundo" here names a still-valid, real `--tipo-entidade` category value (the entity type "investment fund"), not the deprecated generic model noun the rename targets — the same distinction CONTEXT.md itself draws for PROJECT.md's unchanged "fund-controladoria professional" framing.
- Resolution: kept the verbatim CLI-matching text (the more specific, locked, and functionally-verifiable requirement) over the blanket grep. All other 20 occurrences enumerated in RESEARCH.md Finding 1 were renamed; this is the sole intentional exception.

---

**Total deviations:** 1 auto-fixed (1 blocking), 1 documented plan-verify discrepancy (not a code defect)
**Impact on plan:** The auto-fix was necessary to keep the existing admin-token-confinement security gate accurate and green. The documented discrepancy is a plan-authoring inconsistency (verify script vs. explicit CONTEXT.md D3 requirement), not a functional gap — no scope creep in either case.

## Issues Encountered
None beyond the two items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `docs/ai-usage/{README,CLAUDE}.md` are the accurate, vendored source of truth for the "Apollo Tasks" onboarding template; `apollo init <path>` is a working, live-tested way to scaffold it for a new user.
- The rotina/import command-surface drift tracked in `.planning/STATE.md`'s Deferred Items is a known follow-up for a future dedicated docs-sync pass — not blocking.
- Do not use `--tipo-geracao=semanal` or `--dia-semana` etc. as examples in these docs yet; that surface remains undocumented by design (out of this task's scope).

---
*Phase: 260924-f7m*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 11 files created/modified verified present on disk; both task commits (`84e4fc3`, `9dbee93`) verified present in `git log`.
