# Phase 25: Public Auth Login — Plan Validation

**Validated:** 2026-08-12
**Plans:** `25-01-PLAN.md` (wave 1), `25-02-PLAN.md` (wave 2, depends_on `25-01`)

## Structural Gates (gsd-tools)

| Gate | 25-01 | 25-02 |
|------|-------|-------|
| `frontmatter.validate --schema plan` | `valid: true` | `valid: true` |
| `verify.plan-structure` | `valid: true` (0 errors, 4 tasks) | `valid: true` (0 errors, 2 tasks) |
| `check decision-coverage-plan` | `passed: true` (skipped — CONTEXT.md uses plain numbered decisions, not `D-NN` IDs; no trackable decisions for the automated gate, consistent with Phase 24's plans in this same project) | same |

`verify.plan-structure`'s one initial failure (checkpoint task missing `<name>`) was fixed before finalizing;
re-run confirmed `valid: true` for both files.

## Requirement Coverage

ROADMAP.md Phase 25 `phase_req_ids`: `AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05`.

| Requirement | Plan(s) | Covered |
|---|---|---|
| AUTH-01 | 25-01 (Task 1 rewrite), 25-02 (Task 2 live happy-path proof) | ✓ |
| AUTH-02 | 25-01 (Task 1 error-shape preservation, Task 3 network-error test) | ✓ |
| AUTH-03 | 25-01 (Task 3 AST-walk tightening), 25-02 (Task 2 admin-token-absent round trip) | ✓ |
| AUTH-04 | 25-02 (Task 2 `apollo doctor` re-check) | ✓ |
| AUTH-05 | 25-01 (Task 3 exemption-set tightening) | ✓ |

Union of both plans' `requirements:` frontmatter = `{AUTH-01..AUTH-05}` = full ROADMAP set. Zero gaps.

## Multi-Source Coverage Audit

```
SOURCE    | ID       | Feature/Requirement                                                    | Plan     | Status
--------- | -------- | ----------------------------------------------------------------------- | -------- | ---------
GOAL      | —        | login via public /runtime/auth/*, zero admin-token dependency, doctor unchanged | 25-01+02 | COVERED
REQ       | AUTH-01  | Direct httpx calls to public send/verify_magic_code                     | 25-01/02 | COVERED
REQ       | AUTH-02  | Observable JSON/exit-code contract unchanged                            | 25-01    | COVERED
REQ       | AUTH-03  | No CLI command reads/depends on INSTANT_APP_ADMIN_TOKEN                 | 25-01/02 | COVERED
REQ       | AUTH-04  | admin_token_present / apollo doctor unchanged                           | 25-02    | COVERED
REQ       | AUTH-05  | test_auth_rejection.py / test_instant_client.py updated                  | 25-01    | COVERED
RESEARCH  | —        | httpx explicit [project.dependencies] entry                             | 25-01    | COVERED
RESEARCH  | —        | Reuse instantdb._http_errors.api_error_from_response + DEFAULT_API_URI/DEFAULT_TIMEOUT (Pattern 1, Don't Hand-Roll) | 25-01 | COVERED
RESEARCH  | —        | Kebab-case request body keys (app-id/code) (Pattern 2)                  | 25-01    | COVERED
RESEARCH  | —        | login_client() kept (not deleted), docstring corrected (Pitfall 1)       | 25-01    | COVERED
RESEARCH  | —        | Explicit DEFAULT_TIMEOUT (60s/10s-connect), never httpx's 5s default (Pitfall 2) | 25-01 | COVERED
RESEARCH  | —        | Test-coverage split: invalid-code (no email) / network-error (no mock) / happy-path (needs email) (Pitfall 3) | 25-01 (invalid-code, network-error), 25-02 (happy-path) | COVERED
RESEARCH  | —        | cli/README.md admin-token section corrected (Pitfall 4)                 | 25-01    | COVERED
RESEARCH  | —        | Package Legitimacy Audit: httpx SUS(seam)/Approved                      | 25-01    | COVERED (blocking-human checkpoint)
RESEARCH  | —        | Python port of web/e2e/helpers/magic-code.ts (Don't Hand-Roll #2)       | 25-02    | COVERED
RESEARCH  | —        | Security Domain: magic code/refresh token never logged; rate-limit self-throttle | 25-02 | COVERED
RESEARCH  | OQ1      | Reuse vendor internals vs. local copy — resolved: reuse (rationale documented) | 25-01 | COVERED
RESEARCH  | OQ2      | Docstring wording for login_client()'s new status — resolved: facts specified, prose left to executor per project convention | 25-01 | COVERED
CONTEXT   | decision 1 | Replace, don't wrap — direct httpx calls to public endpoints           | 25-01    | COVERED
CONTEXT   | decision 2 | No behavior change in CLI output                                       | 25-01    | COVERED
CONTEXT   | decision 3 | login_client() audit — CORRECTED per user's important_correction: kept, not deleted (RESEARCH.md Pitfall 1 supersedes the literal "if nothing else calls it, remove it" framing) | 25-01 | COVERED (with documented correction) |
CONTEXT   | decision 4 | session_client() untouched                                            | 25-01    | COVERED
CONTEXT   | decision 5 | INSTANT_APP_ADMIN_TOKEN not read anywhere in operational path; doctor/admin_token_present kept | 25-01/02 | COVERED
CONTEXT   | decision 6 | Tests get stronger, not weaker                                        | 25-01    | COVERED
CONTEXT   | decision 7 | Scope is cli/ only                                                     | 25-01/02 | COVERED
CONTEXT   | decision 8 | httpx may be explicit dependency, no other new dependency              | 25-01    | COVERED
CONTEXT   | decision 9 | Live verification required, admin-token-free                          | 25-02    | COVERED
```

**Excluded (not gaps, per protocol):** RESEARCH.md's "expired code" test gap — explicitly flagged by the
researcher as a pre-existing gap, not a regression this phase introduces, and not required by AUTH-02's
bar (Pitfall 3). RESEARCH.md's Architectural Responsibility Map — a design constraint already satisfied
(no new tier introduced by either plan), not an actionable item.

Zero `⚠ MISSING` rows. No phase split needed.

## Scope-Reduction Self-Check

Grepped both plan files for prohibited scope-reduction language (`v1`/`v2`/"simplified version"/"static for
now"/"placeholder"/"basic version"/"minimal implementation"/"will be wired later"/"skip for now"). All hits
were false positives: `v1.0`/`v1.1`/`v1.2`/`v1.3` are historical milestone references (PROJECT.md), and
"placeholder" refers to masking a real secret value in a captured transcript — not a reduced implementation.
No CONTEXT.md decision is delivered as a lesser version of itself.

## Decision-Fidelity Self-Check

- [x] D-1 (public endpoints) → 25-01 Task 1
- [x] D-2 (no behavior change) → 25-01 Task 1, Task 3
- [x] D-3 (login_client audit) → 25-01 Task 1 objective + Task 1/2/3 (corrected per user's explicit
      instruction: kept, not deleted)
- [x] D-4 (session_client untouched) → 25-01 Task 2 ("Do NOT touch ... session_client()")
- [x] D-5 (no admin token in operational path; doctor kept) → 25-01 Task 3, 25-02 Task 2
- [x] D-6 (tests get stronger) → 25-01 Task 2, Task 3
- [x] D-7 (cli/ only) → both plans' `<verification>` sections
- [x] D-8 (httpx only new dep) → 25-01 Task 1
- [x] D-9 (live, admin-token-free) → 25-02 (entire plan)
- [x] No deferred idea appears in either plan (CONTEXT.md `<deferred>` is empty for this phase — nothing to
      exclude).
- [x] Claude's Discretion areas (RESEARCH.md Open Questions 1-2) both explicitly resolved with rationale
      recorded for SUMMARY.md, not left silently ambiguous.

## Wave/Dependency Check

- 25-01: `wave: 1`, `depends_on: []`.
- 25-02: `wave: 2`, `depends_on: ["25-01"]`.
- Both plans list `cli/tests/test_auth_live.py` in `files_modified` (25-01 adds the invalid-code test,
  25-02 adds the happy-path round-trip test) — this file overlap is exactly why 25-02 must be wave 2 with
  an explicit `depends_on`, which it already has. No same-wave file conflict exists.
- No other file appears in more than one plan's `files_modified`.

## Result

All structural, requirement-coverage, source-audit, scope-reduction, and decision-fidelity checks pass.
Proceeding to `## PLANNING COMPLETE`.
