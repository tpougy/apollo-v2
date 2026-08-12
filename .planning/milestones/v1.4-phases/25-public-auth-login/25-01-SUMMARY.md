---
phase: 25-public-auth-login
plan: 01
subsystem: auth
tags: [httpx, instantdb, magic-code-auth, cli, ast-walk-gate]

# Dependency graph
requires:
  - phase: 24-packaging-installability
    provides: "config.py's post-Phase-24 InstantConfig(app_id, app_id_source, env_file, admin_token_present) shape, which this plan's login() rewrite consumes via load_instant_config()"
provides:
  - "cli/apollo_cli/auth.py's login() -- httpx.post() direct to InstantDB's public /runtime/auth/send_magic_code and /runtime/auth/verify_magic_code, zero login_client()/admin-token usage"
  - "cli/apollo_cli/auth.py's _post_public_auth() helper, reusing instantdb._http_errors.api_error_from_response()/DEFAULT_API_URI/DEFAULT_TIMEOUT"
  - "httpx as an explicit cli/pyproject.toml [project.dependencies] entry (already pinned/installed transitively -- no new install surface)"
  - "cli/apollo_cli/instant_client.py's login_client()/module docstrings corrected to name test_cross_user_isolation.py's teardown as the one remaining legitimate caller"
  - "cli/README.md's 'About the admin token' section corrected -- no apollo command, including login, reads the admin token anymore"
  - "cli/tests/test_auth_rejection.py's _LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES tightened (auth.py dropped) plus a new real-refused-connection network-error test"
  - "cli/tests/test_auth_live.py's new permanent invalid-code live test, proving the full new transport end-to-end with zero admin token present"
affects: [25-02-public-auth-login]

# Actuals (#2632)
actuals:
  tokens: 4019
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct httpx.post() calls to InstantDB's public /runtime/auth/* endpoints, reusing the instantdb SDK's own _http_errors.api_error_from_response()/DEFAULT_API_URI/DEFAULT_TIMEOUT internals rather than duplicating error-mapping/timeout logic locally."
    - "Per-test @pytest.mark.live markers (instead of a module-wide pytestmark) in files that mix genuinely-live and genuinely-offline tests, so a fast offline test can live in the same module as live network probes without inheriting the live marker."

key-files:
  created: []
  modified:
    - cli/apollo_cli/auth.py
    - cli/apollo_cli/instant_client.py
    - cli/pyproject.toml
    - cli/README.md
    - cli/tests/test_auth_rejection.py
    - cli/tests/test_instant_client.py
    - cli/tests/test_auth_live.py

key-decisions:
  - "Reused instantdb._http_errors.api_error_from_response() + instantdb._sync.http.DEFAULT_API_URI/DEFAULT_TIMEOUT rather than writing local equivalents (RESEARCH.md Open Question 1). Rationale, per RESEARCH.md and CONTEXT.md decision: these symbols back the instantdb SDK's own public Instant/AsyncInstant error/timeout contract at the currently-pinned range (instantdb>=1.0.63,<2), so they cannot change shape without breaking the SDK's own public API; reusing them eliminates ~10 lines of duplicated error-mapping/timeout logic that could otherwise silently drift from the vendor's actual behavior on a future patch release, at the cost of a new (but low-risk, version-bounded) 'import a `_`-prefixed vendor module' pattern for this codebase."
  - "Autonomous httpx package-legitimacy resolution (Task 0, T-25-SC in the threat register): RESEARCH.md's Package Legitimacy Audit verdict for httpx is SUS (seam) -- the automated legitimacy check could not retrieve a PyPI download-count signal in this sandbox -- but disposition is Approved: httpx==0.28.1 is already a resolved, pinned, installed transitive dependency of instantdb in this exact project's cli/uv.lock (confirmed via `grep -q 'httpx==0.28.1' cli/uv.lock`), the widely-used HTTP client maintained by Encode OSS (pypi.org/project/httpx/, github.com/encode/httpx). Task 1 promotes it from implicit/transitive to an explicit [project.dependencies] entry (`httpx>=0.27,<1`, matching instantdb's own `Requires-Dist: httpx>=0.27` floor); `uv sync` confirmed the resolved version is unchanged (still httpx==0.28.1) -- zero new install surface. Recorded here per this milestone's 100%-autonomous execution mandate; no blocking human checkpoint was hit (the plan's original checkpoint task was already converted to this autonomous Task 0 in an earlier commit, 8e8fe19, before this execution began)."
  - "Restructured test_auth_rejection.py's marker scheme from a single module-wide `pytestmark = pytest.mark.live` to per-test @pytest.mark.live markers on the four tests that genuinely need real InstantDB network I/O (tests 1/2/3/5). This was required to satisfy the plan's own explicit instruction to add a new *offline* (non-live) network-error test to this same module -- a blanket module marker cannot be selectively un-applied to one new test. As a side effect, the pre-existing test_admin_token_confinement structural AST-walk gate (which does zero network I/O) now also runs under the fast `-m \"not live and not packaging\"` inner loop, matching RESEARCH.md's own 'unit (structural, AST-walk)' classification for that exact test -- a net strengthening, not a narrowing, of offline coverage."
  - "_post_public_auth()'s return type is `dict[str, Any] | None` (not a bare `Any`) to satisfy ruff's ANN401 (no bare `typing.Any` in a return annotation) without a noqa; verify_magic_code's call site narrows it with `assert body is not None` before subscripting, satisfying `ty check`'s not-subscriptable diagnostic on the Optional. Zero behavior change -- the endpoint always returns a JSON body on success in practice."

patterns-established:
  - "New auth transport code that talks directly to an InstantDB endpoint the instantdb SDK doesn't wrap should reuse the SDK's own private error/timeout constants (instantdb._http_errors, instantdb._sync.http) rather than re-implementing them, within the SDK's pinned version range."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-05]

coverage:
  - id: D1
    description: "httpx package-legitimacy resolution recorded autonomously (Task 0) -- httpx already pinned/installed transitively via instantdb, promoted to an explicit cli/pyproject.toml dependency with zero new install surface"
    verification:
      - kind: unit
        ref: "grep -q 'httpx==0.28.1' cli/uv.lock -- passed; uv sync confirmed resolved version unchanged after promoting to explicit"
        status: pass
    human_judgment: false
  - id: D2
    description: "apollo auth login sends/verifies magic codes via direct httpx.post() calls to InstantDB's public /runtime/auth/send_magic_code and /runtime/auth/verify_magic_code, with an explicit 60s/10s-connect timeout (DEFAULT_TIMEOUT, imported from instantdb._sync.http) matching the SDK's own default -- never httpx's shorter 5s default. Zero login_client()/admin-token usage inside login()."
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_auth_live.py::test_login_with_invalid_code_exits_api_error_with_zero_admin_token -- passed live against the real InstantDB API"
        status: pass
      - kind: unit
        ref: "grep -n 'login_client|Instant(' cli/apollo_cli/auth.py -- confirms zero login_client() call and zero Instant( construction inside login(); the only remaining Instant( is whoami()'s pre-existing, unrelated construction"
        status: pass
    human_judgment: false
  - id: D3
    description: "apollo auth login's JSON/exit-code contract (auth_failed/exit-3 for invalid code, network_error/exit-4 for a real connection failure) stays byte-identical to before the rewrite, proven live for both error paths with zero admin token present"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "cli/tests/test_auth_live.py::test_login_with_invalid_code_exits_api_error_with_zero_admin_token -- {\"error\": \"auth_failed\", \"type\": \"record-not-found\"}, exit 3 -- passed"
        status: pass
      - kind: unit
        ref: "cli/tests/test_auth_rejection.py::test_login_with_unreachable_api_uri_exits_network_error -- real refused connection to 127.0.0.1:1, {\"error\": \"network_error\"}, exit 4 -- passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "No apollo_cli/*.py file (auth.py included) references login_client()/INSTANT_APP_ADMIN_TOKEN outside the two documented exemptions -- enforced structurally by test_auth_rejection.py's AST-walk gate, tightened to drop auth.py's exemption. login_client() itself is kept (not deleted) since test_cross_user_isolation.py's admin-only delete_user teardown is its one legitimate remaining caller; its docstrings and cli/README.md's admin-token section are corrected accordingly."
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "cli/tests/test_auth_rejection.py::test_admin_token_confinement (26 parametrized cases) -- passed under -m \"not live and not packaging\""
        status: pass
      - kind: unit
        ref: "cli/tests/test_instant_client.py -- 9 passed, 2 skipped (config.py/instant_client.py legitimately exempt from the key-name gate)"
        status: pass
    human_judgment: false
  - id: D5
    description: "test_auth_rejection.py's _LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES no longer contains auth.py (auth.py no longer calls login_client() at all after the rewrite); a new offline, real-refused-connection network-error test proves the network_error/exit-4 path without any InstantDB mocking"
    requirement: "AUTH-05"
    verification:
      - kind: unit
        ref: "cli/tests/test_auth_rejection.py -k network -- test_login_with_unreachable_api_uri_exits_network_error passed"
        status: pass
      - kind: other
        ref: "Full offline gate: uv run ruff check/ruff format --check/ty check --config pyproject.toml . ../shared/scripts -- all clean; uv run pytest -m \"not live and not packaging\" -- 348 passed, 2 skipped; full uv run pytest (all markers) -- 417 passed, 2 skipped, 1 xfailed, 0 failed (one transient SSL-handshake-timeout flake in an unrelated pre-existing test, test_crud_projeto.py::test_full_crud_round_trip, confirmed to pass cleanly on immediate re-run -- real network flakiness, not a regression from this plan)"
        status: pass
    human_judgment: false

# Metrics
duration: ~12min
completed: 2026-08-12
status: complete
---

# Phase 25 Plan 01: Public Auth Login (Transport Rewrite) Summary

**`apollo auth login` now sends/verifies magic codes via direct `httpx` calls to InstantDB's public, unauthenticated `/runtime/auth/*` endpoints -- proven live, end-to-end, with `INSTANT_APP_ADMIN_TOKEN` entirely absent from the process, and the admin-token-bearing `login_client()` is no longer reachable from any `apollo` command.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-12T20:32:03Z
- **Completed:** 2026-08-12T20:44:00Z
- **Tasks:** 3 (Task 0 was a documentation-only autonomous resolution, folded into this summary; no separate commit)
- **Files modified:** 7 (`cli/uv.lock` also changed mechanically as a side effect of `cli/pyproject.toml`'s new dependency, but is not hand-edited)

## Accomplishments

- Rewrote `cli/apollo_cli/auth.py`'s `login()` to call InstantDB's public `/runtime/auth/send_magic_code`/`verify_magic_code` endpoints directly via a new `_post_public_auth()` helper, reusing the `instantdb` SDK's own `api_error_from_response()`/`DEFAULT_API_URI`/`DEFAULT_TIMEOUT` internals so the error shape and the 60s/10s-connect timeout stay byte-identical to the old admin-SDK path -- zero `login_client`/admin-token usage remains inside `login()`.
- Declared `httpx` as an explicit `cli/pyproject.toml` dependency (`httpx>=0.27,<1`); `uv sync` confirmed the resolved version is unchanged (`httpx==0.28.1`, already installed transitively via `instantdb`) -- zero new install surface, resolved via an autonomous package-legitimacy audit per this milestone's 100%-autonomous mandate.
- Added a new permanent live test (`cli/tests/test_auth_live.py`) proving the invalid-code error path -- `apollo auth login --email <nonexistent> --code 000000` -- exits 3 with `{"error": "auth_failed", "type": "record-not-found"}` against the real InstantDB production API, with `INSTANT_APP_ADMIN_TOKEN` explicitly absent from the process environment.
- Corrected `cli/apollo_cli/instant_client.py`'s module and `login_client()` docstrings and `cli/README.md`'s "About the admin token" section: neither claims `apollo auth login` needs an admin-capable client anymore; both now name `cli/tests/test_cross_user_isolation.py`'s `delete_user` teardown as `login_client()`'s one remaining legitimate caller.
- Tightened `test_auth_rejection.py`'s `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` to drop `auth.py`, and added a new offline, real-refused-connection (`127.0.0.1:1`, no mocking) test proving the `network_error`/exit-4 path. This required converting the module's single blanket `pytestmark = pytest.mark.live` into per-test `@pytest.mark.live` markers, which also brought the pre-existing `test_admin_token_confinement` structural gate (26 cases) into the fast offline test loop for the first time.
- Full quality gate green: `ruff check`/`ruff format --check`/`ty check` clean across `cli/` + `../shared/scripts`; `uv run pytest -m "not live and not packaging"` -- 348 passed, 2 skipped; full `uv run pytest` (all markers) -- 417 passed, 2 skipped, 1 xfailed, 0 failed.

## Task Commits

Each task was committed atomically:

0. **Task 0: Record `httpx` package-legitimacy resolution** -- no code change, no separate commit (documented above and in this SUMMARY's Decisions; the plan's original blocking checkpoint had already been converted to this autonomous task in an earlier commit, `8e8fe19`, before this execution session began)
1. **Task 1: End-to-end invalid-code login via public runtime endpoints, zero admin token** - `20a0126` (feat)
2. **Task 2: Correct `login_client()`'s docstrings and `README.md`** - `80eed6f` (docs)
3. **Task 3: Tighten AST-walk gate + network-error test + full quality gate** - `304823b` (test)

_No separate plan-metadata commit is made yet -- see the STATE.md/ROADMAP.md/REQUIREMENTS.md update commit that follows this SUMMARY, per this project's standing convention._

## Files Created/Modified

- `cli/apollo_cli/auth.py` - `login()` rewritten to call `_post_public_auth()` directly against the public `/runtime/auth/*` endpoints; zero `login_client` import/call
- `cli/apollo_cli/instant_client.py` - Module and `login_client()` docstrings corrected (test-only caller now, not `apollo_cli.auth.login`)
- `cli/pyproject.toml` - `httpx>=0.27,<1` added to `[project] dependencies`
- `cli/README.md` - "About the admin token" section rewritten; no longer claims login needs an admin-capable client
- `cli/tests/test_auth_rejection.py` - `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` tightened; module-wide live marker replaced with per-test markers; new network-error test added
- `cli/tests/test_instant_client.py` - Clarifying comment on `_EXEMPT_FILENAMES`, no functional change
- `cli/tests/test_auth_live.py` - New permanent live invalid-code test added
- `cli/uv.lock` - Regenerated by `uv sync` after declaring `httpx` explicit (mechanical, not hand-edited; resolved version unchanged)

## Decisions Made

See frontmatter `key-decisions` above for full rationale on:
- Reusing `instantdb`'s private `_http_errors`/`_sync.http` internals rather than duplicating error/timeout logic (RESEARCH.md Open Question 1, resolved: reuse).
- The autonomous `httpx` package-legitimacy resolution (Task 0 / threat T-25-SC).
- Restructuring `test_auth_rejection.py`'s pytest markers from a blanket module mark to per-test marks, required to add a genuinely-offline test to a module that previously marked everything live.
- `_post_public_auth()`'s `dict[str, Any] | None` return type (not a bare `Any`) to satisfy `ruff`'s `ANN401`, with an `assert body is not None` narrowing at the `verify_magic_code` call site for `ty check`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `ruff` ANN401 on `_post_public_auth()`'s bare `Any` return annotation**
- **Found during:** Task 1's `uv run ruff check` verify step
- **Issue:** The plan's literal signature, `_post_public_auth(path: str, body: dict[str, Any]) -> Any`, triggers `ruff`'s `ANN401` (no bare `typing.Any` in a return annotation) -- this project's `pyproject.toml` has `extend-select = ["I", "ANN"]`, and no `noqa: ANN401` precedent exists anywhere in `apollo_cli/`.
- **Fix:** Narrowed the return type to `dict[str, Any] | None` (matching the function's actual two possible return shapes: a JSON object on success-with-content, `None` on success-with-no-content) instead of adding a `noqa` comment with no codebase precedent.
- **Files modified:** `cli/apollo_cli/auth.py`
- **Verification:** `uv run ruff check apollo_cli/auth.py` clean.
- **Committed in:** `20a0126` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `ty check`'s not-subscriptable diagnostic on `body["user"]`/`body["created"]`**
- **Found during:** Task 1's `uv run ty check apollo_cli/auth.py` verify step (immediately after fix #1 above)
- **Issue:** Narrowing `_post_public_auth()`'s return type to `dict[str, Any] | None` (fix #1) made `ty check` correctly flag `body["user"]`/`body["created"]` in `login()`'s verify-code branch as subscripting a possibly-`None` value.
- **Fix:** Added `assert body is not None, "verify_magic_code returned an empty success response"` immediately after the call, narrowing the type for `ty` with zero behavior change (the endpoint always returns a JSON body on a 2xx `verify_magic_code` response in practice; this assert documents that invariant rather than silently trusting it).
- **Files modified:** `cli/apollo_cli/auth.py`
- **Verification:** `uv run ty check apollo_cli/auth.py` clean; live test still passes.
- **Committed in:** `20a0126` (Task 1 commit)

**3. [Rule 3 - Blocking] Restructured `test_auth_rejection.py`'s pytest markers from module-wide to per-test**
- **Found during:** Task 3, while adding the new offline network-error test
- **Issue:** The plan explicitly requires the new network-error test to be "offline (non-`live`)" and selectable via `-k network` under the fast `-m "not live and not packaging"` gate -- but the module had a single blanket `pytestmark = pytest.mark.live` applied to every test, which cannot be selectively un-applied to one new test (pytest markers are additive, not overridable per-function).
- **Fix:** Removed the module-level `pytestmark`, added `@pytest.mark.live` individually to the four tests that genuinely perform real InstantDB network I/O (tests 1/2/3/5), and left the genuinely-offline tests (4, 6, the structural AST-walk gate, and the new network test) unmarked. This mirrors the pattern `cli/tests/test_cross_user_isolation.py`'s own docstring already documents for the identical reason.
- **Files modified:** `cli/tests/test_auth_rejection.py`
- **Verification:** `uv run pytest -m "not live and not packaging" -v` -- all previously-live-only structural tests (`test_admin_token_confinement`, 26 cases) now also pass under the offline gate; `uv run pytest tests/test_auth_rejection.py -k network -v` -- the new test passes; full `uv run pytest` (all markers) confirms zero regressions (417 passed).
- **Committed in:** `304823b` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking lint/type fixes, 1 blocking test-infrastructure restructuring -- all Rule 1/3)
**Impact on plan:** Zero scope creep. Deviations #1-2 are mechanical lint/type-narrowing fixes with no behavior change. Deviation #3 was a necessary, minimal restructuring to fulfill the plan's own explicit instruction (an offline test in a previously blanket-`live` module) and had the beneficial side effect of bringing a pre-existing structural gate into the fast offline test loop, matching RESEARCH.md's own classification of that gate as non-network.

## Issues Encountered

One transient flake during the full-suite (`uv run pytest -q`, all markers) run: `tests/test_crud_projeto.py::test_full_crud_round_trip` failed once with `_ssl.c:993: The handshake operation timed out` (a real network hiccup against the live InstantDB API, unrelated to any file this plan touched). Re-ran `uv run pytest tests/test_crud_projeto.py -v` immediately afterward -- all 5 tests passed cleanly. Re-ran the full suite once more afterward -- 417 passed, 2 skipped, 1 xfailed, 0 failed. Not a regression from this plan; not auto-fixed (nothing to fix -- it is inherent network variance in a live end-to-end test against a production API).

## User Setup Required

None -- no external service configuration required. `httpx` was already installed (transitive dependency of `instantdb`); declaring it explicit in `cli/pyproject.toml` triggered no new download. No new environment variable, credential, or dashboard step is needed.

## Next Phase Readiness

- `cli/tests/test_auth_live.py` now exists with the new permanent invalid-code test, which is the file `25-02-PLAN.md` (wave 2, `depends_on: ["25-01"]`) extends with the full real send+verify magic-code round-trip proof (the happy-path AUTH-01/AUTH-03/AUTH-04 coverage this plan intentionally left to 25-02, per RESEARCH.md Pitfall 3's error-path/happy-path split).
- `login_client()` is untouched functionally and still importable -- `cli/tests/test_cross_user_isolation.py`'s admin-only teardown (line 367) continues to work exactly as before.
- `apollo doctor`/`admin_token_present` (AUTH-04) are completely untouched by this plan -- 25-02's own task re-checks them per CONTEXT.md decision 5.
- `git diff --stat` across this plan's three commits touches exactly the seven `files_modified` paths from the plan frontmatter, plus the mechanically-regenerated `cli/uv.lock` -- no accidental edit to `web/`, `shared/`, or `instant.perms.ts` (confirmed via `git diff --stat 8e8fe19 HEAD -- web/ shared/ instant.perms.ts`, empty).
- No stubs, skipped tests, or unrun `<verify>` blocks in this plan -- every task's `<verify>` command was executed for real, including the two live network round trips against the production InstantDB API.

---
*Phase: 25-public-auth-login*
*Completed: 2026-08-12*

## Self-Check: PASSED

Confirmed `cli/apollo_cli/auth.py` contains zero `login_client`/bare `Instant(` calls inside `login()` (grep). Confirmed all three task commits (`20a0126`, `80eed6f`, `304823b`) present in `git log --oneline`. Confirmed `cli/tests/test_auth_live.py`'s new test and `cli/tests/test_auth_rejection.py`'s new test both exist on disk and pass when re-run individually. Confirmed `cli/uv.lock` still resolves `httpx==0.28.1` (unchanged) via `grep httpx cli/uv.lock`.
