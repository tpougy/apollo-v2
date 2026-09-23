---
phase: 260922-t1l
verified: 2026-09-22T21:25:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/quick/20260922-limpar-dados-de-teste-poluidos-apagar-todos-os-registros-das/260922-t1l-PLAN.md
  - .planning/quick/20260922-limpar-dados-de-teste-poluidos-apagar-todos-os-registros-das/260922-t1l-SUMMARY.md
covered_digest: "v1:sha256:1ed4d75fda8032e7e10a463b24f5367c6b17acabc348b98ed972c31a04fcb3f0"
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260922-t1l: Limpar dados de teste poluídos Verification Report

**Item Goal:** Delete ALL `templatesRotina` and `instanciasRotina` records in production InstantDB (via admin client), leaving `fundos`, `projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`, `logInferenciaClaude` untouched. Confirm before/after counts (after = 0 for both target entities).

**Verified:** 2026-09-22T21:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

This verification ran a fresh, independent live admin query against the production InstantDB app (not reusing the executor's script or any cached output) as the primary evidence source, in addition to reviewing the deleted script's source via `git show` and the git commit history.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Querying `instanciasRotina` in production (admin client, no where filter) returns 0 rows after cleanup | ✓ VERIFIED | Fresh live admin query run by verifier (not the executor's script) at 2026-09-22T21:25Z: `{"instanciasRotina": 0, ...}` — see Behavioral Spot-Checks below |
| 2 | Querying `templatesRotina` in production (admin client, no where filter) returns 0 rows after cleanup | ✓ VERIFIED | Same live query: `{"templatesRotina": 0, ...}` |
| 3 | Counts for `fundos`, `projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`, `logInferenciaClaude` are byte-identical before/after cleanup | ✓ VERIFIED | Verifier's live query returned `fundos=58, tarefas=1, projetos=0, etapas=0, tickets=0, subtarefas=0, logInferenciaClaude=0` — matches exactly the "before" counts recorded live in commit `17a86b6`'s message and SUMMARY.md's before/after table, and matches SUMMARY's claimed "after" snapshot verbatim |
| 4 | Before-cleanup counts were captured and non-zero, proving the run deleted real rows | ✓ VERIFIED | Commit `17a86b6` message and SUMMARY.md record live dry-run output: `templatesRotina=262, instanciasRotina=957` (non-zero) prior to the delete in commit `cfdef03` |
| 5 | No permanent script or CLI command left behind — cleanup tool is transient and removed | ✓ VERIFIED | `cli/scripts/` directory does not exist in working tree; `git status --porcelain cli/scripts/` returns empty; `git show cfdef03` confirms a 75-line pure-deletion diff removing the script that commit `17a86b6` added |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

No artifacts declared in `must_haves.artifacts` (correctly empty — the deliverable is a transient script that is deleted by design, not a persisted artifact).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/scripts/cleanup_rotina_test_data.py` | Transient, must NOT exist post-cleanup | ✓ VERIFIED ABSENT | Confirmed missing via `ls`/`test -d`; `git log` shows it was added in `17a86b6` and fully removed in `cfdef03` (75 additions, then 75 deletions, net zero) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `cli/scripts/cleanup_rotina_test_data.py` (historical, via `git show 17a86b6`) | `apollo_cli.instant_client.login_client()` | Direct import, sole admin-client constructor used | ✓ WIRED | Verified by reading the deleted script's source via `git show 17a86b6:cli/scripts/cleanup_rotina_test_data.py`: imports `login_client` from `apollo_cli.instant_client`; never constructs `Instant(...)` directly; never reads `INSTANT_APP_ADMIN_TOKEN` itself |
| `login_client()` | Repo-root `.env.instantdb` | `load_instant_config()` / `_read_admin_token()` | ✓ WIRED | `.env.instantdb` exists at repo root; `load_instant_config().admin_token_present` returns `True` when verifier ran it independently |
| Script's delete path | InstantDB `/admin/transact` | `client.transact([client.tx[etype][eid].delete() for eid in batch])`, batches of ≤200 | ✓ WIRED | Confirmed by source review — batches ids in groups of `_BATCH_SIZE = 200`, scoped only to `_ETYPES_DELETE = ("templatesRotina", "instanciasRotina")`; canary tuple `_ETYPES_CANARY` (7 other entities) is read-only, only used in `_counts()` for the before/after assertion, never appears in any `client.tx[...]` call |

### Data-Flow Trace (Level 4)

Not applicable in the standard sense (this is a one-off data-mutation script, not a rendered UI). The equivalent check — that the "0 rows" claim traces to a real live query rather than a static/mocked value — was performed directly: verifier executed its own `login_client()` + `client.query(...)` call against production, independent of the executor's (now-deleted) script and independent of SUMMARY.md's claims.

| Check | Source | Produces Real Data | Status |
|-------|--------|---------------------|--------|
| `templatesRotina`/`instanciasRotina` = 0 claim | Live `client.query()` call, fresh process, verifier-authored | Yes — real InstantDB admin API response, not cached/mocked | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production `templatesRotina`/`instanciasRotina`/canary counts, queried independently by verifier | `login_client(); c.query({9 entities: {}})` (fresh python process, no script reuse) | `{"etapas": 0, "fundos": 58, "instanciasRotina": 0, "logInferenciaClaude": 0, "projetos": 0, "subtarefas": 0, "tarefas": 1, "templatesRotina": 0, "tickets": 0}` | ✓ PASS |
| Deleted script's source matches plan/summary claims (admin-client-only, batched delete, canary assertion) | `git show 17a86b6:cli/scripts/cleanup_rotina_test_data.py` | Full source reviewed — matches plan spec exactly: `login_client()` import only, `_ETYPES_DELETE`/`_ETYPES_CANARY` tuples, batch size 200, `assert after[...] == 0` / `== before[...]` | ✓ PASS |
| No permanent file left behind | `git status --porcelain cli/scripts/`, `test -d cli/scripts` | Empty status; directory gone | ✓ PASS |
| No stray references to the deleted script outside planning docs | `grep -rn "cleanup_rotina_test_data" --include="*.py" .` (repo-wide) | Zero hits in any `.py`/code file — all remaining references are in `.planning/` markdown/JSON, which is expected documentation | ✓ PASS |

### Requirements Coverage

Not applicable — this is a quick-batch item (`.planning/quick/`), not a milestone phase with `REQUIREMENTS.md` mappings. No `requirements:` field present in PLAN frontmatter.

### Anti-Patterns Found

None. The only file this item touched (`cli/scripts/cleanup_rotina_test_data.py`) was deleted by design at the end of the task, so there is no lingering code to scan for stub/debt markers. Source review via `git show` found no `TODO`/`FIXME`/`HACK`/placeholder patterns, no empty handlers, and no hardcoded static data masquerading as a real query — `_counts()` performs a real `client.query()` call each time it's invoked.

### Human Verification Required

None. Every must-have truth was verified via a live, independent production database query executed directly by the verifier (not by re-running the deleted executor script, and not by trusting SUMMARY.md's reported numbers) plus direct git history/source inspection. No visual, UX, or external-service-timing concerns apply to this backend data-cleanup task.

### Gaps Summary

No gaps. All 5 must-have truths verified:
- Both target entities (`templatesRotina`, `instanciasRotina`) confirmed at 0 in production via a fresh, independently-run admin query.
- All 7 canary entities (`fundos=58`, `tarefas=1`, and 5 others at 0) confirmed unchanged from their pre-cleanup values, cross-checked against the live before-counts recorded in commit `17a86b6`.
- Before-cleanup counts were non-zero (262 / 957), proving real rows were deleted, not a no-op against empty tables.
- The transient script was fully removed — verified absent from the working tree, with a clean `git status --porcelain cli/scripts/` and a matching add-then-delete pair in git history (`17a86b6` → `cfdef03`).
- Script's own source (recovered via `git show` since the file no longer exists in the working tree) confirms it used only the sanctioned `login_client()` admin constructor, scoped writes to exactly the two target entity tx namespaces, and never touched the 7 canary entities' `tx` namespaces.

---

_Verified: 2026-09-22T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
