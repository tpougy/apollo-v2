---
phase: 04-web-spa-auth-crud-smoke-ui
plan: 01
subsystem: auth
tags: [instantdb, playwright, svelte5, magic-code, e2e, chromium]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: "Live InstantDB user (tp@rbrasset.com.br, id adf0d402-06df-4406-a5c7-ce82ee1bcb7e) and the C-10 orules.ps1 Outlook Classic COM peek mechanism, proven working"
provides:
  - "web/playwright.config.ts with setup/authed/anon projects and STORAGE_STATE const"
  - "web/e2e/helpers/magic-code.ts: readLatestMagicCode()/readMagicCodeAfter() against the real C-10 inbox channel"
  - "web/src/lib/auth/LoginScreen.svelte: two-step magic-code login form with stable data-testid hooks"
  - "web/src/App.svelte auth gate (SignedOut -> LoginScreen, SignedIn -> app-shell placeholder)"
  - "web/e2e/.auth/user.json: persisted authenticated storageState (incl. IndexedDB) for downstream specs"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, phase-6-verify]

# Tech tracking
tech-stack:
  added: ["@playwright/test@1.62.1"]
  patterns:
    - "Playwright project dependencies (setup -> authed) with --no-deps for reusing a persisted storageState without re-triggering the dependency"
    - "storageState({ indexedDB: true }) required because @instantdb/core persists its session in IndexedDB, not localStorage"
    - "Sender-scoped block parsing of orules.ps1 peek output rather than a blind regex, to avoid matching a stray 6-digit run in an unrelated email"

key-files:
  created:
    - web/playwright.config.ts
    - web/tsconfig.e2e.json
    - web/e2e/helpers/magic-code.ts
    - web/e2e/auth.setup.ts
    - web/e2e/auth.spec.ts
    - web/e2e/no-leakage.spec.ts
    - web/src/lib/auth/LoginScreen.svelte
  modified:
    - web/src/App.svelte
    - web/package.json
    - biome.json
    - .gitignore

key-decisions:
  - "C-10's literal --grep 'nstant' example never matches the real magic-code subject line; switched to --grep 'verification code' plus sender-scoped ('instantdb.com') block parsing in magic-code.ts"
  - "Used --no-deps when re-running the authed project against an already-persisted storageState, since Playwright always re-runs a project's declared dependencies within a single invocation"
  - "Unstyled semantic HTML for LoginScreen (no CSS), per CONTEXT.md's 'no visual design investment' instruction"

patterns-established:
  - "Every data-bearing region nested under <SignedIn {db}>; no db.useQuery call anywhere outside that gate"
  - "e2e/helpers/magic-code.ts is the single reusable channel for any future real magic-code test across Phase 4/6"

requirements-completed: [WEB-01, WEB-10]

duration: ~55min
completed: 2026-08-09
---

# Phase 4 Plan 1: Web SPA Auth Foundation & Playwright Harness Summary

**Real magic-code login proven end-to-end in headless Chromium via Playwright, with `@instantdb/svelte`'s `SignedIn`/`SignedOut` gate and a persisted `storageState({indexedDB: true})` reused by downstream specs.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-09T14:17:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 11

## Accomplishments
- Playwright `1.62.1` installed as a `web/` devDependency; Chromium binaries reused from the existing `~/.cache/ms-playwright/chromium-1234` cache with no fresh download (confirmed via `bunx playwright install chromium --dry-run` matching the already-present revision) — closes 04-RESEARCH.md assumption A2.
- `web/playwright.config.ts` wires three projects (`setup`, `authed`, `anon`) against a dev server on port 5174, with `authed`/`anon` using contrasting `storageState` (persisted vs. explicitly empty).
- `LoginScreen.svelte` + auth-gated `App.svelte`: zero hand-rolled session storage, zero `useQuery` outside `SignedIn`, `VITE_INSTANT_APP_ID` display removed (WEB-10 defence in depth).
- A REAL magic-code round trip authenticated `tp@rbrasset.com.br` in an actual Chromium browser on the FIRST attempt (no resend needed), in 15.5s total from send to authenticated `app-shell`.
- Session persistence proven three ways: same-context reload (`auth.setup.ts`), brand-new context restored from `storageState` (`auth.spec.ts`), and a fail-loud demonstration that `no-leakage.spec.ts` actually catches a regression when `app-shell` is moved outside the `SignedIn` gate.

## Task Commits

1. **Task 1: Install Playwright, wire the headless harness, and add the C-10 magic-code reader** - `91fa218` (feat)
2. **Task 2: LoginScreen.svelte and the SignedIn/SignedOut gate in App.svelte** - `3e8779f` (feat)
3. **Task 3: Prove WEB-01 and WEB-10 with a REAL magic-code round trip in Chromium** - `070a22e` (test)

_No separate plan-metadata commit was made per this plan's execution instructions (STATE.md/ROADMAP.md untouched by this executor run)._

## Files Created/Modified
- `web/playwright.config.ts` - three projects (setup/authed/anon), `STORAGE_STATE` const, webServer on :5174
- `web/tsconfig.e2e.json` - chains e2e TypeScript into the `check` script (C-08 gate)
- `web/e2e/helpers/magic-code.ts` - `readLatestMagicCode()`/`readMagicCodeAfter()` against the real C-10 Outlook Classic COM channel
- `web/e2e/auth.setup.ts` - real send→peek→verify round trip, reload-persistence assertion, `storageState({indexedDB:true})` + `LOGIN-EVIDENCE.txt`
- `web/e2e/auth.spec.ts` - fresh-context restore-from-storageState assertion (`authed` project)
- `web/e2e/no-leakage.spec.ts` - unauthenticated-load, zero-entity-data assertion (`anon` project)
- `web/src/lib/auth/LoginScreen.svelte` - two-step magic-code form with `data-testid` hooks
- `web/src/App.svelte` - `SignedOut`→`LoginScreen`, `SignedIn`→`app-shell` placeholder gate
- `web/package.json` - `test:e2e`, `test:e2e:auth` scripts; `check`/`lint`/`format:check` extended to `web/e2e/**`
- `biome.json` - `files.includes` extended to `web/e2e/**/*.ts`, `web/playwright.config.ts`
- `.gitignore` - `web/e2e/.auth/`, `web/test-results/`, `web/playwright-report/`

## Decisions Made
- **C-10 grep pattern bug (Rule 1 fix):** `PROJECT.md` C-10's example command uses `--grep 'nstant'`, expecting it to match "instant" somewhere in the InstantDB magic-code email. Verified against `orules.ps1`'s actual C# implementation (`Peek.cs`) and a real inbox: `--grep` matches ONLY the message's subject+body concatenation, never the sender address, and the real subject line is literally `"<code> is your verification code for apollo"` — it contains no "instant" substring anywhere. With `--body 0` the body isn't even fetched, so `--grep 'nstant'` reliably returns zero matches and (per `Peek.cs`'s `if (!isMatch) continue;`) the message is silently excluded from the listed samples — not a transient issue, a deterministic no-match. Fixed by using `--grep 'verification code'` (present in every observed subject) plus sender-scoped (`instantdb.com`) block parsing in `magic-code.ts`, so a stray 6-digit run elsewhere in the mailbox output can never be mistaken for the real code.
- **`--no-deps` for the `authed` project's standalone acceptance check:** Playwright always re-runs a project's declared `dependencies` within a single `playwright test` invocation (no cross-invocation caching), so `bunx playwright test --project=authed` alone re-triggers `setup` (and a new magic-code send) by design. `--no-deps` reuses the already-persisted `storageState` without re-running `setup`, which is what the plan's acceptance criterion ("WITHOUT triggering a new magic-code email") actually requires.
- **Task 1 acceptance criterion `playwright test --list` deferred to end-of-plan:** that criterion needs the `setup`/`authed`/`anon` test files created in Task 3 to actually list non-zero tests; verified `--list` prints all three with exit 0 only after Task 3's specs existed. This is an inherent ordering property of the plan (Task 1 wires the config, Task 3 adds the spec files it references), not a defect introduced during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] C-10's literal `--grep 'nstant'` never matches the real magic-code subject line**
- **Found during:** Task 3, first real round-trip attempt (timed out after 45s waiting for a code that had, in fact, already arrived)
- **Issue:** `orules.ps1 peek --grep 'nstant' --body 0` returned `casaram: 0` and an empty message list even though three matching InstantDB emails were confirmed present in the inbox at the time (verified via a plain, ungrepped peek and via a manual REST `send_magic_code` call). Root cause confirmed by reading `Peek.cs`: `--grep` matches subject+body only (never the sender), and `--body 0` means the body isn't even fetched, so the concatenated haystack was just the subject `"<code> is your verification code for apollo"` — no "instant" substring.
- **Fix:** Changed the peek command in `magic-code.ts` to `--grep 'verification code'` (matches every observed InstantDB subject) and added block-level parsing that only accepts a code from a message block whose sender line contains `instantdb.com`, rather than a blind global regex over the whole command output.
- **Files modified:** `web/e2e/helpers/magic-code.ts`
- **Verification:** Manual standalone run of `readLatestMagicCode()` returned the correct newest code (`650027` at the time); full `--project=setup` run then authenticated successfully on the first attempt (15.5s, no resend needed).
- **Committed in:** `070a22e` (Task 3 commit)

**2. [Rule 3 - Blocking] Default 30s Playwright test timeout too short for the real email round trip**
- **Found during:** Task 3, first `--project=setup` run — failed with "Test timeout of 30000ms exceeded" while correctly polling for the code (page was already on the code-entry step, waiting on `readMagicCodeAfter`'s 45s poll window).
- **Issue:** Real email delivery + the `orules.ps1` COM roundtrip routinely exceeds Playwright's default 30s test timeout, independent of the (unchanged) 2s poll interval / 45s poll timeout inside `magic-code.ts`.
- **Fix:** Added `test.setTimeout(150_000)` inside `auth.setup.ts`'s test body — gives the real-world round trip room to complete without slackening the poll loop itself.
- **Files modified:** `web/e2e/auth.setup.ts`
- **Verification:** Subsequent `--project=setup` runs completed in 15.5s–27s, well under the new timeout.
- **Committed in:** `070a22e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both were necessary corrections to make the plan's own literal instructions actually work against the real inbox/timeout environment; no scope creep.

## Issues Encountered
None beyond the two auto-fixed items above — both were diagnosed and resolved within the fix-attempt limit before any full test run.

## Real Magic-Code Round Trip Evidence

- **Playwright version:** `1.62.1` (`@playwright/test`, well above the 1.51 minimum required for `storageState({indexedDB: true})`)
- **Chromium install:** Reused cached binaries at `~/.cache/ms-playwright/chromium-1234` (confirmed via `bunx playwright install chromium --dry-run` matching the installed revision exactly) — no fresh download. Closes 04-RESEARCH.md assumption A2.
- **Authenticated user id observed in the browser:** `adf0d402-06df-4406-a5c7-ce82ee1bcb7e` — **matches** Phase 3's pinned `EXPECTED_USER_ID` (`03-06-SUMMARY.md`) exactly. No mismatch.
- **Magic-code attempts needed:** 1 (first attempt succeeded; the plan's built-in one-resend-then-fail-loud retry path was never exercised because no expiry occurred)
- **Full round-trip timing (final successful `--project=setup` run):** send → real code read from `tp@rbrasset.com.br`'s inbox → verify → authenticated `app-shell` visible, in 15.5s
- **`web/e2e/.auth/user.json`:** present, non-empty (2161 bytes), contains one IndexedDB database (`instant_<app-id>_6`) with the InstantDB session record (`currentUser.id`, `refresh_token`) — confirms `indexedDB: true` capture worked as required by the RESEARCH doc's Pitfall warning.
- **Fail-loud demonstration (`no-leakage.spec.ts`):** temporarily moved the `app-shell` placeholder outside `<SignedIn {db}>` in `App.svelte` → `--project=anon` FAILED with `expect(locator).toHaveCount(0) ... Received: 1` on `getByTestId('app-shell')`, naming the exact leaked element. Restored `App.svelte` → `--project=anon` passed again cleanly. This proves `no-leakage.spec.ts`'s assertion is a real regression detector, not a vacuously-passing check.
- **Full suite (`bunx playwright test`, all three projects in one invocation):** 3 passed, 18.6s total.

## User Setup Required
None - no external service configuration required. The C-10 mailbox-read mechanism ran fully autonomously as authorized.

## Next Phase Readiness
- `web/playwright.config.ts`, `web/e2e/helpers/magic-code.ts`, and `web/e2e/.auth/user.json` are all ready for 04-02 through 04-05's entity CRUD specs to reuse via the `authed` project.
- `App.svelte`'s `app-shell` placeholder (stable `data-testid`) is explicitly designed for 04-02 to replace its body with the real `Shell.svelte` component without touching the auth gate.
- No blockers. The fixed `magic-code.ts` grep pattern and sender-scoped parsing should be reused verbatim by any later plan needing a fresh magic-code round trip (e.g. Phase 6 VERIFY-01) — do not revert to C-10's literal `--grep 'nstant'` example.

---
*Phase: 04-web-spa-auth-crud-smoke-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified present on disk; all three task commit hashes (`91fa218`, `3e8779f`, `070a22e`) verified present in git log.
