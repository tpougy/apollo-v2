---
phase: 10-entity-form-restyle-feedback
plan: 03
subsystem: ui
tags: [svelte5, svelte-sonner, sonner, toast, playwright, instantdb]

requires:
  - phase: 10-entity-form-restyle-feedback
    provides: "10-01/10-02's Dialog-wrapped form and all field-kind conversions (text/textarea/number/boolean/date/select/links/xorLink) in the same EntityScreen.svelte, plus formError's Alert rendering"
provides:
  - "Hand-written svelte-sonner Toaster wrapper (web/src/lib/components/ui/sonner/) with zero mode-watcher dependency, mounted once in App.svelte outside SignedIn/SignedOut"
  - "toast.success()/toast.error() calls on every entity CRUD write path in EntityScreen.svelte (handleSubmit's every formError assignment plus its success reset, handleDelete's success/catch)"
  - "toast.success()/toast.error() calls on both LoginScreen.svelte auth actions (enviarCodigo/verificarCodigo) and Shell.svelte's logout"
  - "entities-form-restyle.spec.ts toast assertions for fundos (create+delete success toasts) and the validation-error path (error toast alongside the existing Alert), plus a new instanciasRotina status-only-edit test proving the second FDBK-01/SC5 capability class"
  - "login-flow.spec.ts/shell-nav.spec.ts toast assertions for both auth actions (send success, wrong-code error, logout success)"
affects: [11-full-verification-quality-gates]

actuals:
  tokens: 4204
  tasks: 3
  commits: 4

tech-stack:
  added: ["svelte-sonner@1.1.1"]
  patterns:
    - "svelte-sonner installed by hand (bun add, no shadcn-svelte add sonner) to keep mode-watcher out of the dependency tree — sonner.svelte hardcodes theme=\"system\" and relies on svelte-sonner's own internal matchMedia listener for live dark-mode reactivity, per 10-RESEARCH.md Pitfall 1"
    - "toast calls are strictly additive alongside every existing formError/erro assignment — no control-flow change, no new state, same already-sanitized extractErrorMessage()/erro value reused for both the Alert and the toast"
    - "handleSubmit's success toast message (\"criado\" vs \"atualizado\") captures `const wasCreate = mode === \"create\"` immediately before the existing `mode = null` reset, since the ternary would otherwise read a nulled mode"

key-files:
  created:
    - web/src/lib/components/ui/sonner/sonner.svelte
    - web/src/lib/components/ui/sonner/index.ts
  modified:
    - web/src/App.svelte
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/auth/LoginScreen.svelte
    - web/src/lib/Shell.svelte
    - web/e2e/entities-form-restyle.spec.ts
    - web/e2e/login-flow.spec.ts
    - web/e2e/shell-nav.spec.ts
    - web/package.json
    - web/bun.lock

key-decisions:
  - "svelte-sonner installed via `bun add` directly, then sonner.svelte/index.ts hand-written per 10-RESEARCH.md's exact code block — confirmed zero mode-watcher line in package.json both immediately after install and again at the end of the plan's full-suite verification"
  - "Toast calls added at every formError assignment site in handleSubmit (xorLink required-check, per-link required-check, per-field required-check, parent_not_found pre-check, session-not-authenticated check, catch block) plus handleDelete's success/catch — matches FDBK-01's literal 'every write' scope, not just the happy path"

requirements-completed: [FDBK-01]

coverage:
  - id: D1
    description: "svelte-sonner installed by hand and mounted once in App.svelte (theme=system), with zero mode-watcher dependency"
    requirement: FDBK-01
    verification:
      - kind: automated_ui
        ref: "web/package.json grep check (no mode-watcher, has svelte-sonner) + `bun run build` exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Creating, editing, and deleting a fundo each produce a visible outcome-matching toast; validation errors produce an error toast alongside the existing Alert"
    requirement: FDBK-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-04: missing required field blocks submission, shows Alert, fires zero native dialogs"
        status: pass
    human_judgment: false
  - id: D3
    description: "instanciasRotina's status-only edit (the restricted capability class) also produces a success toast — the second FDBK-01/SC5 capability class alongside fundos' full-CRUD"
    requirement: FDBK-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#FDBK-01: instanciasRotina status-only edit — single field Dialog, no create affordance, success toast"
        status: pass
    human_judgment: false
  - id: D4
    description: "Logging in (send success + wrong-code error) and logging out each produce a visible outcome-matching toast — the auth half of FDBK-01/SC5"
    requirement: FDBK-01
    verification:
      - kind: e2e
        ref: "web/e2e/login-flow.spec.ts#submit Button shows disabled + spinner while the send request is in flight"
        status: pass
      - kind: e2e
        ref: "web/e2e/login-flow.spec.ts#submitting a deliberately wrong code renders the destructive Alert"
        status: pass
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#clicking Logout ends the session and returns to the restyled LoginScreen"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full web/e2e/ suite (10-01/10-02/10-03/10-04's combined surface) is green with zero regression; Biome + svelte-check clean on this plan's files"
    verification:
      - kind: e2e
        ref: "bun run test:e2e — 39/39 passed on a clean run"
        status: pass
      - kind: other
        ref: "bun run check (svelte-check, 0 errors) + bun run lint (biome, exit 0)"
        status: pass
    human_judgment: false

duration: 71min (mostly blocked waiting out a live InstantDB rate-limit cooldown, not active work)
completed: 2026-08-09
status: complete
---

# Phase 10 Plan 03: Sonner Toast Feedback Summary

**svelte-sonner hand-installed with zero mode-watcher dependency, mounted once in App.svelte, and wired into every entity CRUD write path (create/edit/delete) and both auth actions (login send/verify, logout) — proven live against InstantDB for both FDBK-01/SC5 capability classes (fundos full-CRUD, instanciasRotina status-only) plus the auth half.**

## Performance

- **Duration:** ~71 min wall clock (22:29 → 23:41); the great majority of that was a forced wait for a live InstantDB per-email magic-code rate limit to clear, not active implementation time — see Issues Encountered.
- **Started:** 2026-08-09T22:29:57-03:00 (Task 1 commit)
- **Completed:** 2026-08-09T23:41:38-03:00 (final lint-fix commit)
- **Tasks:** 3/3 completed
- **Files modified:** 11 (across 4 commits: 5, 2, 4, 3 files respectively)

## Accomplishments

- `svelte-sonner` installed via `bun add` (not `bunx shadcn-svelte@latest add sonner`) — `web/package.json` never gained a `mode-watcher` line, confirmed by grep both immediately after install and again at the end of the plan's full-suite verification run.
- `web/src/lib/components/ui/sonner/sonner.svelte`/`index.ts` hand-written exactly per 10-RESEARCH.md's Pitfall 1 code block — imports only `Toaster as Sonner`/`type ToasterProps as SonnerProps` from `svelte-sonner`, hardcodes `theme="system"`. `<Toaster />` mounted once in `App.svelte`, outside both `<SignedOut>` and `<SignedIn>`.
- `EntityScreen.svelte`'s `handleSubmit` now calls `toast.success("Registro criado."/"Registro atualizado.")` on success (capturing `wasCreate` before the existing `mode = null` reset) and `toast.error(formError)` immediately after every one of its five `formError` assignment sites (xorLink required-check, per-link required-check, per-field required-check, `parent_not_found` pre-check, session-not-authenticated check, and the catch block) — additive only, zero control-flow change. `handleDelete` mirrors the pattern (`toast.success("Registro excluído.")` / `toast.error(formError)`).
- `LoginScreen.svelte`'s `enviarCodigo()`/`verificarCodigo()` each gained a `toast.success(...)` on their existing success line and `toast.error(erro)` in their existing catch block. `Shell.svelte`'s Logout button now also fires `toast.success("Você saiu.")` alongside the unchanged `db.auth.signOut()` call.
- `entities-form-restyle.spec.ts` extended: the fundos test now asserts a success toast after create and after delete; the ENTFRM-04 validation-error test now also asserts an error toast alongside the pre-existing Alert; a brand-new test proves the `instanciasRotina` status-only edit (seeded via `seedInstance`, single `field-status` Input control, zero create affordance, success toast, persists on reload).
- `login-flow.spec.ts` extended with a success-toast assertion (loading-state test) and an error-toast assertion (wrong-code test). `shell-nav.spec.ts` extended with a success-toast assertion on the Logout test, checked before the navigation-away assertion per the plan's race-avoidance note.
- Full `bun run test:e2e` run clean (39/39) confirming zero regression across 10-01/10-02/10-03/10-04's combined surface; `bun run check` (svelte-check) 0 errors; `bun run lint` (Biome) exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-install svelte-sonner (no mode-watcher); mount Toaster in App.svelte** - `67cb1d8` (feat)
2. **Task 2: Wire toast calls into entity CRUD; extend entities-form-restyle.spec.ts** - `320a223` (feat)
3. **Task 3: Wire toast calls into LoginScreen/Shell; extend login-flow.spec.ts and shell-nav.spec.ts** - `8a71cfa` (feat)

**Deviation fix:** `994a77d` (fix — Rule 1, Biome `organizeImports` violation, see Deviations below)

_Note: this plan ran in parallel with 10-04, which touched three disjoint e2e spec files (`entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`) — confirmed zero file overlap throughout execution._

## Files Created/Modified

- `web/src/lib/components/ui/sonner/sonner.svelte` - hand-written Toaster wrapper, `theme="system"`, no mode-watcher import
- `web/src/lib/components/ui/sonner/index.ts` - re-exports `Toaster`
- `web/src/App.svelte` - mounts `<Toaster />` once, outside `SignedIn`/`SignedOut`
- `web/src/lib/entities/EntityScreen.svelte` - `toast.success()`/`toast.error()` added to `handleSubmit`/`handleDelete`
- `web/src/lib/auth/LoginScreen.svelte` - `toast.success()`/`toast.error()` added to `enviarCodigo()`/`verificarCodigo()`
- `web/src/lib/Shell.svelte` - Logout `onclick` now also fires `toast.success("Você saiu.")`
- `web/e2e/entities-form-restyle.spec.ts` - toast assertions on fundos create/delete/validation-error; new `instanciasRotina` status-only-edit test
- `web/e2e/login-flow.spec.ts` - toast assertions on send-success and wrong-code-error tests
- `web/e2e/shell-nav.spec.ts` - toast assertion on the Logout test
- `web/package.json`/`web/bun.lock` - `svelte-sonner@1.1.1` added, zero `mode-watcher`

## Decisions Made

- Installed `svelte-sonner` by hand per the plan's explicit constraint, verified zero `mode-watcher` twice (immediately after install, and again after the plan's full-suite verification run) to be certain no later step silently reintroduced it.
- Captured `wasCreate` before nulling `mode` in `handleSubmit`'s success path so the toast message correctly distinguishes "criado" vs "atualizado" (10-RESEARCH.md Assumption A2's exact ordering note).
- Added `toast.error(...)` to every `formError`/`erro` assignment site, not just the final catch block, so FDBK-01's "every write" scope covers pre-transact validation failures (missing required field, dangling parent link, unauthenticated session) exactly as it covers post-transact failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `import { toast } from "svelte-sonner"` violated Biome's `organizeImports` sort order in three files**
- **Found during:** Post-Task-3 quality-gate check (`bun run lint`)
- **Issue:** The new `svelte-sonner` import, added after each file's existing `$lib/components/ui/*`/relative imports (matching the plan's literal code examples), sorted out of order per Biome's `assist/source/organizeImports` rule in `App.svelte`, `LoginScreen.svelte`, and `EntityScreen.svelte` — 3 lint errors, `bun run lint` exiting 1.
- **Fix:** Ran `bunx @biomejs/biome check --write` scoped to exactly those 3 files, which safely reordered the import (moved before the `$lib/*` imports, alongside the other bare-package imports) — cosmetic only, zero behavior change.
- **Files modified:** `web/src/App.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** `bun run lint` exit 0 after the fix; `bun run build` still succeeds; full `bun run test:e2e` re-run green (39/39) to confirm the cosmetic reorder introduced zero regression.
- **Committed in:** `994a77d`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 lint fix)
**Impact on plan:** Cosmetic only — import order, zero behavior change. No scope creep.

## Issues Encountered

- **Live InstantDB per-email magic-code rate limit hit mid-verification.** After several magic-code sends accumulated across this session's own retries plus normal test traffic, `POST /runtime/auth/send_magic_code` began returning `429 {"type":"rate-limited","message":"Too many verification codes requested for this email. Please try again later."}` for `tp@rbrasset.com.br`. This blocked `shell-nav.spec.ts`'s live auth-setup dependency (and would have blocked any further live-auth test) for roughly 45 minutes. Diagnosed by instrumenting a throwaway Playwright script to capture the actual HTTP response (never committed) rather than guessing from symptoms (a `readMagicCodeAfter` "timed out waiting for a new code" error, which could otherwise be mistaken for an Outlook-sync delay per C-10's documented ~60-90s expiry variance). Resolved by waiting out the rate-limit window (~25+ minutes with zero further sends) rather than hammering retries, which would likely have extended the cooldown. Not a code defect — `login-flow.spec.ts` had already passed live before the rate limit kicked in, and every affected test passed cleanly once the window cleared. No code changes resulted from this; documented here as a session-level constraint for future live-auth-heavy sessions on this same test email.
- One further transient magic-code delivery timeout during the final full-suite confirmation run (`login-flow.spec.ts`'s wrong-code test), resolved on an immediate retry with no code changes — consistent with the same flakiness pattern already documented in `10-02-SUMMARY.md`'s Issues Encountered and PROJECT.md C-10's ~60-90s expiry/delivery variance.
- One full-suite run (before the rate-limit episode) showed a single unrelated failure in `entities-projeto-etapa-tarefa.spec.ts` (a 10-04 file, not touched by this plan) that passed cleanly in isolation immediately after — attributed to worker/resource contention from 10-04's own concurrent Playwright runs against the same dev server port and the same real inbox, not a regression from this plan's changes. A subsequent clean full-suite run (39/39) after 10-04 finished confirmed this.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- FDBK-01 is now fully proven live: every entity CRUD write and both auth actions surface an outcome-matching Sonner toast, across both capability classes (full-CRUD via fundos, restricted status-only via instanciasRotina) plus login/logout.
- This closes out Phase 10's last requirement — ENTFRM-01/02/03/04 (10-01/10-02) and FDBK-01 (10-03/10-04) are all complete.
- Phase 11 (Full Verification & Quality Gates) can proceed: the full `web/e2e/` suite is green (39/39) on a clean run, `bun run check`/`bun run lint` both clean.
- **Session-level note for Phase 11 (or any future live-auth-heavy session against `tp@rbrasset.com.br`):** InstantDB enforces a per-email magic-code rate limit that can trigger after a burst of ~5-8 sends within a few minutes, with an observed cooldown on the order of 20-25+ minutes. Space out live-auth test retries; do not hammer `sendMagicCode` in a tight retry loop when diagnosing an unrelated failure.
- No blockers.

---
*Phase: 10-entity-form-restyle-feedback*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files (sonner component dir, App.svelte, EntityScreen.svelte, LoginScreen.svelte, Shell.svelte, entities-form-restyle.spec.ts, login-flow.spec.ts, shell-nav.spec.ts, package.json, bun.lock, this SUMMARY) confirmed present on disk. All 4 commits (`67cb1d8`, `320a223`, `8a71cfa`, `994a77d`) confirmed present in `git log`.
