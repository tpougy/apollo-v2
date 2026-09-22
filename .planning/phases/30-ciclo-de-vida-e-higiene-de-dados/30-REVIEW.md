---
phase: 30-ciclo-de-vida-e-higiene-de-dados
reviewed: 2026-09-22T21:21:31Z
depth: quick
files_reviewed: 14
files_reviewed_list:
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_crud_rotina_template.py
  - cli/tests/test_rotina_instancia.py
  - cli/tests/test_cli_surface.py
  - cli/tests/test_routine_job.py
  - web/e2e/fixtures/instancia-admin-fixture.ts
  - web/e2e/dashboard.spec.ts
  - web/e2e/focus-dialog-button-inventory.spec.ts
  - web/e2e/focus-dialog-dia-rotina.spec.ts
  - web/e2e/focus-dialog-fundo.spec.ts
  - web/e2e/entities-rotina-log.spec.ts
  - web/e2e/routine-job.spec.ts
  - web/e2e/routine-job-cross-channel.spec.ts
  - web/e2e/entities-form-restyle.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-09-22T21:21:31Z
**Depth:** quick (pattern-matching, targeted trace-through of the 4 review-brief focus points)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed `cli/apollo_cli/entities/rotina.py` (LIFE-01/LIFE-02), `web/e2e/fixtures/instancia-admin-fixture.ts`
(`sweepInstancesByDedupeKeyPrefix`, LIFE-03), and the 8 e2e spec files that consume the new
`--force`/sweep wiring, against the review brief's 4 focus points. No hardcoded secrets, `eval`,
`innerHTML`, empty catch blocks (beyond the pre-existing, commented "already gone" tolerance
pattern), or debug artifacts were found via pattern scan.

**Core safety properties hold up under trace-through:**
- `deletar --force` and `limpar-orfas --confirmar` both default to `False` (list/block, never
  destructive-by-default) — no path sets either to `True` implicitly.
- `limpar_orfas` is structurally incapable of deleting a non-orphan: it queries once, filters
  client-side to `not row.get("template")`, and only ever calls `delete_entity(etype="instanciasRotina", eid=row["id"])` for rows already in that filtered list — `_ETYPE_INSTANCIA` is a
  module constant, never caller-controlled, and `delete_entity` itself takes a hardcoded `etype`
  argument with no override path. C-06 cannot be bypassed by any flag combination.
- `sweepInstancesByDedupeKeyPrefix` resolves `ownerEmail` → `owner.id` via `adminDb.auth.getUser`
  and scopes its `instanciasRotina` query to `donoId: owner.id` *before* the client-side
  `dedupeKey.startsWith(prefix)` filter — it structurally cannot select or delete another
  account's rows, even though it runs on unrestricted admin credentials. This holds for every
  call site checked.
- `_count_linked_instances` correctly returns `0` for a template with zero/absent reverse-linked
  instances (`isinstance(instancias, list)` guard) and for a nonexistent template id (empty
  `rows`), matching the `templateInstancias` reverse link's documented "has many" shape
  (`shared/instant.schema.ts:152-155`), where an empty-to-many collection is `[]`, not absent —
  consistent with the codebase's existing `antecessor` (to-one) link-normalization convention
  used elsewhere in `routine_job.py`.
- Every `rotina template deletar` call site across all 8 touched spec files carries `--force`
  (verified by direct string search for the 4 files using literal argv construction, and by
  tracing the `group === "rotina template"` conditional-push branch for the 4 files using the
  generic `tryDelete(group, eid)` helper — no bypass call site exists in any of the 8 files).

Two Warning-level design issues remain, both latent rather than actively triggered by the
current test suite/config; see below.

## Warnings

### WR-01: `_EXIT_INSTANCES_LINKED = 2` collides with Click's own built-in usage-error exit code

**File:** `cli/apollo_cli/entities/rotina.py:78-82,489`
**Issue:** The module's own comment claims this exit code is "deliberately distinct from
`crud_helpers.EXIT_API_ERROR = 3`," but it never checks it against Click's *own* default. Click
raises `UsageError`/`BadParameter` (bad flags, missing required options, XOR-validation failures
such as this same module's own `_resolve_range_override`, `cli/apollo_cli/entities/rotina.py:157,161,166`)
with exit code `2` by default — the same value now reused here for a completely different
business-rule condition ("template has linked instances, pass `--force`"). Any caller that
branches on exit code alone (a common CLI integration pattern, and the exact kind of code this
phase's own e2e specs write via `execFileSync`/try-catch) cannot distinguish "you passed a bad
flag" from "blocked by linked instances" without also parsing the JSON stderr payload. Today's
shipped callers happen to always pass `--force` and don't inspect exit codes, so this is latent,
not actively wrong — but it is a real, discoverable exit-code space collision, not a hypothetical
one.
**Fix:** Pick an exit code outside Click's reserved default range (Click's convention is `0`
success / `1` generic error / `2` usage error), e.g. reuse the `1`-`4` family already established
in `crud_helpers.py` by adding a 5th distinct constant (`EXIT_BUSINESS_RULE_BLOCKED = 5` or
similar), or document explicitly in the module docstring that exit code `2` is deliberately
overloaded and callers must always parse the JSON body to disambiguate.

### WR-02: Shared `PREFIX = "phase23-e2e-"` across 3 spec files sharing one InstantDB account, with no enforced serialization at the fixture level

**File:** `web/e2e/focus-dialog-button-inventory.spec.ts:29`, `web/e2e/focus-dialog-dia-rotina.spec.ts:22`, `web/e2e/focus-dialog-fundo.spec.ts:23`
**Issue:** All three files define the identical `PREFIX` constant and the identical
`OWNER_EMAIL = "tp@rbrasset.com.br"`, and each calls `sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL)`
(via its own `sweepLeftovers`) in a `beforeAll`/`afterEach`-style hook. Today this is safe only
because `web/playwright.config.ts` sets `fullyParallel: false` and `workers: 1` project-wide —
a setting external to all three of these files and to the fixture itself. If that config is ever
changed (a plausible future optimization, and outside this phase's own diff), one file's sweep
could delete another file's in-flight, not-yet-asserted `instanciasRotina` rows mid-run, since
`sweepInstancesByDedupeKeyPrefix` matches purely on `dedupeKey` prefix + owner, with no per-file
or per-run discriminator. This is a same-account cross-test data-race risk, not the
cross-account risk the phase's own threat model (T-30-08) was scoped to, so it was not caught by
that review — but it is a real latent fragility introduced by reusing the same literal prefix
string across three otherwise-independent files.
**Fix:** Make `PREFIX` unique per spec file (e.g. append the spec's own basename or a per-file
suffix, matching the pattern already used by `phase04-e2e-`/`phase05-e2e-`/`phase10-e2e-`/
`phase21-e2e-` in the other files reviewed here), or add an explicit comment in
`playwright.config.ts` noting that `workers: 1`/`fullyParallel: false` is a correctness
requirement for these shared-prefix sweeps, not just a performance choice.

## Info

### IN-01: No explicit `limit`/pagination handling on the two new InstaQL queries

**File:** `cli/apollo_cli/entities/rotina.py:441-449` (`_count_linked_instances`), `:578-582` (`limpar_orfas`)
**Issue:** Neither `client.query({"templatesRotina": {"instancias": {}, ...}})` nor
`client.query({"instanciasRotina": {"template": {}, "$": {"where": {"donoId": ...}}}})` passes a
`limit`/pagination option, unlike `list_entities` elsewhere in this module which threads an
explicit `limit` through to `query_opts`. Whether the underlying InstantDB SDK silently truncates
large result sets by default could not be confirmed from this codebase alone. If it does, a
template with an unusually large linked-instance count could under-report in the `deletar` block
message (cosmetic only — the block still correctly fires since `linked_count > 0`), and
`limpar-orfas` could silently miss orphans beyond the truncation point for an account with very
many `instanciasRotina` rows (a completeness gap, not a correctness-in-the-wrong-direction bug —
it cannot cause an over-deletion, per WR analysis above).
**Fix:** Confirm the InstantDB Python admin SDK's default page size for nested link expansion and
top-level queries; if a default cap exists, either pass an explicit high `limit` or paginate
`limpar_orfas`'s query the same way `list_entities` already supports it, to guarantee orphan-sweep
completeness at real production scale (22 rows were live-cleaned this phase; the guard should not
regress silently once that number grows).

### IN-02: `tryDelete`/`tryDeleteTemplate`'s catch-all masks any future regression that reintroduces exit(2)

**File:** `web/e2e/dashboard.spec.ts:78-88`, `web/e2e/focus-dialog-button-inventory.spec.ts:47-55`, `web/e2e/focus-dialog-dia-rotina.spec.ts:40-48`, `web/e2e/focus-dialog-fundo.spec.ts:41-49`, and the `tryDeleteTemplate` variants in `entities-rotina-log.spec.ts:44-50`, `routine-job.spec.ts:39-45`, `routine-job-cross-channel.spec.ts:45-51`, `entities-form-restyle.spec.ts:38-42,264-268,355-359,406-410,413-417`
**Issue:** Every teardown helper wraps its `apolloCli(...)` call in a bare `try { ... } catch { /* Already gone -- fine. */ }`, a pre-existing pattern this phase extends to the new `--force` call sites. Because `execFileSync` throws on any non-zero exit, this swallows not just the intended "already deleted" case but also a future accidental regression (e.g. a `--force` flag dropped by a later edit, reintroducing the `_EXIT_INSTANCES_LINKED = 2` block from WR-01) — such a regression would silently leave orphaned/undeleted test residue in the live account instead of failing the test loudly, compounding exactly the "account-wide-accumulation" class of pre-existing flake already logged 3 times in this milestone's `deferred-items.md`.
**Fix:** Not a blocking concern for this phase (the pattern predates it and every current call site is verified correct), but worth narrowing eventually — e.g. only swallow when the thrown error's message/exit code matches "not_found", and rethrow (or `console.warn`) otherwise, so a future silent regression surfaces as a visible teardown failure rather than more accumulated production residue.

---

_Reviewed: 2026-09-22T21:21:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
