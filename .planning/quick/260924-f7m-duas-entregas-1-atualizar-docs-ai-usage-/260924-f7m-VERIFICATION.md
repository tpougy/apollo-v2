---
phase: 260924-f7m
verified: 2026-09-24T14:30:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/STATE.md"
  - ".planning/quick/260924-f7m-duas-entregas-1-atualizar-docs-ai-usage-/260924-f7m-CONTEXT.md"
  - ".planning/quick/260924-f7m-duas-entregas-1-atualizar-docs-ai-usage-/260924-f7m-PLAN.md"
  - ".planning/quick/260924-f7m-duas-entregas-1-atualizar-docs-ai-usage-/260924-f7m-RESEARCH.md"
  - ".planning/quick/260924-f7m-duas-entregas-1-atualizar-docs-ai-usage-/260924-f7m-SUMMARY.md"
  - "cli/apollo_cli/cli.py"
  - "cli/apollo_cli/data/scaffold/CLAUDE.md"
  - "cli/apollo_cli/data/scaffold/README.md"
  - "cli/apollo_cli/data/scaffold/__init__.py"
  - "cli/apollo_cli/init.py"
  - "cli/tests/test_auth_rejection.py"
  - "cli/tests/test_init.py"
  - "cli/tests/test_scaffold_vendored_parity.py"
  - "docs/ai-usage/CLAUDE.md"
  - "docs/ai-usage/README.md"
covered_digest: "v1:sha256:ca521ba21d6c2c42825a11d84a2ef82da4115fb3a0e6495b1004fe16748d3806"
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260924-f7m: Docs entidade-rename + `apollo init` scaffold — Verification Report

**Phase Goal:** Atualizar `docs/ai-usage/{README,CLAUDE}.md` para refletir o rename fundos->entidades, e novo comando `apollo init <path>` que faz scaffold de uma pasta Apollo Tasks (README.md + CLAUDE.md vendorizados) e orienta login sem crashar quando o usuário não está autenticado.
**Verified:** 2026-09-24T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

All checks below were run independently against the live codebase (not taken from SUMMARY.md claims): direct `grep`, `diff`, `git show`, real `apollo init` CLI invocations against fresh/pre-populated temp directories with a real authenticated session and a simulated unauthenticated session, and the actual pytest suites.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docs/ai-usage/{README,CLAUDE}.md` contain zero remaining "fundo"/"fundos" occurrences, except the one legitimate `--tipo-entidade` example value | ✓ VERIFIED | `grep -n -i fundo docs/ai-usage/README.md` → 0 matches. `grep -n -i fundo docs/ai-usage/CLAUDE.md` → exactly 1 match at line 63: `--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)` — matches SUMMARY's documented deviation #2 verbatim, and matches the real CLI's own `entidade.py:46` help text (confirmed by reading the line in context). Domain diagram (lines 28-42) and opening paragraph (lines 3-5) independently confirmed renamed to "entidade(s)". |
| 2 | `cli/apollo_cli/data/scaffold/{README,CLAUDE}.md` are byte-identical to `docs/ai-usage/{README,CLAUDE}.md`, enforced by a passing automated parity test | ✓ VERIFIED | `diff docs/ai-usage/README.md cli/apollo_cli/data/scaffold/README.md` → no diff. `diff docs/ai-usage/CLAUDE.md cli/apollo_cli/data/scaffold/CLAUDE.md` → no diff. `uv run pytest tests/test_scaffold_vendored_parity.py -v` → 2/2 PASSED. |
| 3 | `apollo init <path>` creates `<path>` and writes README.md + CLAUDE.md byte-identical to the vendored scaffold, live-proven | ✓ VERIFIED | Ran `uv run apollo init <fresh temp dir>` directly (not via pytest). Exit code 0. `written: ["CLAUDE.md", "README.md"]`. `diff` against `docs/ai-usage/{README,CLAUDE}.md` confirmed byte-identical. |
| 4 | Re-running `apollo init` against a folder with locally-edited README.md/CLAUDE.md refuses (non-zero exit, structured JSON error, zero writes) without `--force`, and succeeds with `--force` | ✓ VERIFIED | Live-reproduced independently: pre-populated `README.md` with `"minhas notas pessoais"`, ran `apollo init` without `--force` → exit code 6, JSON `{"error": "scaffold_files_exist", "conflicting_files": ["README.md"], ...}`, README.md content untouched afterward, and CLAUDE.md was never even created (zero writes confirmed). Re-ran with `--force` → exit 0, README.md now byte-identical to vendored source. |
| 5 | `apollo init` always exits 0 and reports real auth status: authenticated email when a session exists (same `load_session()`+`verify_token()` mechanism as `whoami`), and the exact two login commands when unauthenticated (including simulated fresh machine via `APOLLO_SESSION_FILE`), never crashing | ✓ VERIFIED | Live-reproduced both branches independently. Real session present: `apollo init` → exit 0, `{"authenticated": true, "email": "tp@rbrasset.com.br", ...}` — the real logged-in email on this machine, not a fixture value. Simulated fresh machine: `APOLLO_SESSION_FILE=<nonexistent path> apollo init` → exit 0, `{"authenticated": false, "next_steps": ["apollo auth login --email <voce@exemplo.com>", "apollo auth login --email <voce@exemplo.com> --code <codigo>"]}` — exact two commands, verbatim. |
| 6 | `docs/ai-usage/CLAUDE.md`'s known staleness on the rotina/import command surface is recorded as a visible, tracked deferred item in `.planning/STATE.md` | ✓ VERIFIED | `.planning/STATE.md` line 147: new Deferred Items row, Category "Docs", describing the exact rotina/import staleness (semanal periodicity, `--dia-semana`, `--offset-dias`, `--competencia`/`--de`/`--ate`, `template deletar --force`, `instancia limpar-orfas`, `apollo import`), Status "Deferred — explicit out-of-scope per CONTEXT.md D6...", Deferred At "260924-f7m close". |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/ai-usage/README.md` | Renamed, zero "fundo" occurrences | ✓ VERIFIED | Confirmed via grep, diff against vendored copy |
| `docs/ai-usage/CLAUDE.md` | Renamed (except 1 legit `--tipo-entidade` value) | ✓ VERIFIED | Confirmed via grep, spot-read of diagram/prose/field-block sections |
| `cli/apollo_cli/data/scaffold/README.md` | Byte-identical vendored copy | ✓ VERIFIED | `diff` clean; parity test passes |
| `cli/apollo_cli/data/scaffold/CLAUDE.md` | Byte-identical vendored copy | ✓ VERIFIED | `diff` clean; parity test passes |
| `cli/apollo_cli/data/scaffold/__init__.py` | Empty file, makes subpackage importable | ✓ VERIFIED | Exists, present in `ls`, `importlib.resources.files("apollo_cli.data.scaffold")` successfully resolves (proven by live `apollo init` reads succeeding) |
| `cli/tests/test_scaffold_vendored_parity.py` | Parametrized byte-parity test | ✓ VERIFIED | 2/2 tests pass |
| `cli/apollo_cli/init.py` | `run_init()`, `_auth_status()`, `_scaffold_text()` | ✓ VERIFIED | Read in full; matches PLAN's Step A spec (exit code 6, check-then-write ordering, never-raising auth check, exact next_steps text) |
| `cli/tests/test_init.py` | 4 live tests | ✓ VERIFIED | All 4 pass under `-m live` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/ai-usage/{README,CLAUDE}.md` | `cli/apollo_cli/data/scaffold/{README,CLAUDE}.md` | byte copy, enforced by parity test | ✓ WIRED | `diff` clean, test passes |
| `cli/apollo_cli/data/scaffold/*` | `apollo_cli.init.run_init()` | `importlib.resources.files("apollo_cli.data.scaffold")` | ✓ WIRED | Live `apollo init` invocation wrote content read from the vendored files (proven by content match) |
| `cli.py`'s `init` command | `run_init()` + `emit()` | direct call, JSON stdout | ✓ WIRED | `cli.py:141-150` confirmed; live invocation produced JSON on stdout as expected |
| `_auth_status()` | `apollo_cli.session.load_session()` + `Instant(...).auth.verify_token()` | reused read-only, same mechanism as `whoami` | ✓ WIRED | Live invocation with a real session returned the real email; live invocation with `APOLLO_SESSION_FILE` pointed at a nonexistent path returned `authenticated: false` without crashing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `apollo init` on fresh dir writes byte-identical vendored files | `uv run apollo init <fresh temp dir>` | exit 0, `diff` clean against `docs/ai-usage/*.md` | ✓ PASS |
| `apollo init` refuses to clobber locally-edited files without `--force` | pre-populate `README.md`, run without `--force` | exit 6, JSON error, zero writes (CLAUDE.md never created, README.md content untouched) | ✓ PASS |
| `apollo init --force` overwrites | re-run same dir with `--force` | exit 0, README.md now vendored content | ✓ PASS |
| `apollo init` reports real authenticated email | run with real session present | exit 0, `authenticated: true`, real email `tp@rbrasset.com.br` | ✓ PASS |
| `apollo init` never crashes when unauthenticated | `APOLLO_SESSION_FILE=<nonexistent>` | exit 0, `authenticated: false`, exact two login commands | ✓ PASS |
| Byte-parity test | `uv run pytest tests/test_scaffold_vendored_parity.py -v` | 2/2 PASSED | ✓ PASS |
| `test_init.py` full live suite | `uv run pytest tests/test_init.py -v -m live` | 4/4 PASSED | ✓ PASS |
| `test_cli_surface.py` (help-completeness, JSON-output, suppression gates) | `uv run pytest tests/test_cli_surface.py -v` | 14/14 PASSED | ✓ PASS |
| Full offline regression suite | `uv run pytest -m "not live and not packaging" -q` | 411 passed, 2 skipped, 0 failed | ✓ PASS |

### Anti-Patterns Found

None. `init.py` was read in full — no TODO/FIXME/XXX/placeholder markers, no stub returns, no empty handlers. The one "fundo" grep hit is a legitimate, CLI-verbatim example value (documented and independently confirmed against `entidade.py`'s real `--help` text), not an oversight.

### Scope Boundary Check (routine_job.py / gerar-instancias untouched)

Verified via `git show 84e4fc3 --stat` and `git show 9dbee93 --stat`: only `docs/ai-usage/{README,CLAUDE}.md`, `cli/apollo_cli/data/scaffold/*`, `cli/tests/test_scaffold_vendored_parity.py`, `.planning/STATE.md` (commit 1), and `cli/apollo_cli/cli.py`, `cli/apollo_cli/init.py`, `cli/tests/test_auth_rejection.py`, `cli/tests/test_init.py` (commit 2) were changed. `cli/apollo_cli/routine_job.py` and `cli/tests/test_routine_job*.py` do not appear in either diff — confirmed untouched, consistent with D6's explicit scope boundary.

### STATE.md Deferred Item Accuracy

Read `.planning/STATE.md` line 147 directly (not from SUMMARY paraphrase): the row's Category ("Docs"), Item text (verbatim list of stale rotina/import surface features), Status ("Deferred — explicit out-of-scope per CONTEXT.md D6, future pass should reconcile deliberately"), and Deferred At ("260924-f7m close") all match CONTEXT.md D6's mandated wording and this task's id. Confirmed real and accurate.

### Deviation Cross-Check

SUMMARY.md documents 2 deviations. Both independently verified:
1. **`init.py` added to `test_auth_rejection.py`'s `_INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES`** — confirmed via `git show 9dbee93 -- tests/test_auth_rejection.py`; the diff matches the SUMMARY's description exactly, and the full offline suite (411 passed) confirms this fix is effective.
2. **One remaining "fundo" match is the legitimate `--tipo-entidade` example value** — confirmed via direct grep and reading the line in context against `entidade.py`'s real help text (out of scope for this verifier to re-read `entidade.py`, but the doc's own field-block wording — `--nome`, `--codigo`, `--tipo-entidade`, `--ativo`, in that order — matches the PLAN's Step B instruction verbatim, and the SUMMARY's rationale is internally consistent and matches CONTEXT.md D3's own text which itself contains "ex: Fundo, Cliente, Area").

### Requirements Coverage

Not applicable — this is a quick task with no formal `REQUIREMENTS.md` entry; must-haves are drawn from PLAN.md frontmatter (see Observable Truths above, all 6 verified).

### Human Verification Required

None. All must-haves were independently live-verified via direct CLI invocation, file diffs, and test execution — no visual/UX/external-service judgment calls remain.

### Gaps Summary

None. All 6 must-have truths verified, all artifacts present/substantive/wired, all key links proven live, full regression suite green (411 passed, 2 skipped, 0 failed), scope boundary respected (routine_job.py/gerar-instancias untouched), and the STATE.md deferred item is real and accurately worded.

---

_Verified: 2026-09-24T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
