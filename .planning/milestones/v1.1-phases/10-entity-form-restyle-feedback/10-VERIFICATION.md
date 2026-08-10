---
phase: 10-entity-form-restyle-feedback
verified: 2026-08-10T03:11:44Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 10: Entity Form Restyle & Feedback Verification Report

**Phase Goal:** Create/edit forms for all 9 entities are rebuilt inside a shadcn Dialog/Sheet using
per-field-type shadcn inputs (including a real date-picker for date fields and Select/Combobox for
relationship fields), validation errors render via shadcn conventions instead of `window.alert`, and
every write anywhere in the app — entity CRUD and auth alike — surfaces a Sonner toast.
**Verified:** 2026-08-10T03:11:44Z
**Status:** passed
**Re-verification:** No — initial verification

## Live Verification Run (performed by this verifier, not sourced from SUMMARY claims)

- `cd web && bun run test:e2e` → **39/39 passed (4.2m)**, single clean run, one `setup` project login
  (one magic-code send, `auth.setup.ts`, code `721185`), no rate-limit hit this run.
- `bun run check` (svelte-check + tsc×2) → **0 errors, 1 pre-existing warning** (`state_referenced_locally`
  on `configProp`, documented in 10-REVIEW.md as pre-existing and phase-10-unrelated), exit code 0.
- `bun run lint` (Biome, `shared web/src web/vite.config.ts web/e2e web/playwright.config.ts`) →
  **exit code 0**, one info-level finding only (`useParseIntRadix` in CLI-generated
  `calendar-caption.svelte`, acknowledged in 10-REVIEW.md as out-of-scope boilerplate, not an error/warning).

## Goal Achievement

### Observable Truths (ROADMAP Phase 10 Success Criteria, verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening create/edit on an entity from each capability class opens a shadcn `Dialog` containing shadcn `Input`/`Label`/`Select`/`Checkbox` fields matching that entity's field config; Playwright asserts dialog role and field types | ✓ VERIFIED | `EntityScreen.svelte`'s form is `Dialog.Root open={mode !== null}` (line ~460); every `f.kind` branch (text/textarea/number/boolean/date/select/links/xorLink) renders the matching shadcn primitive. Live: `entities-form-restyle.spec.ts` asserts `page.getByRole("dialog")` for `fundos` (full-CRUD) and `instanciasRotina` (status-only, the only other class with a form — `logInferenciaClaude` is fully read-only, zero form by design, unchanged since Phase 9). Ran live: both tests pass (see suite run above, tests #10, #12). |
| 2 | Focusing a date field opens a shadcn `Calendar` date-picker popover; selecting a date populates the field and persists correctly to live InstantDB on save | ✓ VERIFIED | `Popover.Trigger` + `Calendar type="single"` composition (EntityScreen.svelte ~518-548), fixed post-review (commit `b748198`) so the trigger's `id`/class survive bits-ui's prop forwarding. Live: `entities-form-restyle.spec.ts`'s fundos test picks `createdAt` via `pickDate()`, reloads, and asserts the row contains the exact picked ISO value (test #10). Cross-entity date fields (`dataInicioPrevista`, `dataPrevistaEstimada`, `dataRecebimento`) also converted and proven live in `entities-projeto-etapa-tarefa.spec.ts` / `entities-ticket-subtarefa.spec.ts` (tests #17-20, #27-33, all passed in the live run). |
| 3 | A relationship field (`fundo` on `templatesRotina`, `tarefa`/`ticket` XOR on `subtarefas`) is driven by a shadcn `Select`, correctly links the chosen record's id on save, and the XOR "exactly one" invariant still holds | ✓ VERIFIED | `Select.Root type="single"` for static-option fields, plain links, and both xorLink pickers (EntityScreen.svelte). Live: `entities-form-restyle.spec.ts`'s templatesRotina test asserts the Select renders exactly the 3 static options and persists the chosen `fundo` link (test #13). subtarefas test creates with `tarefa` parent, verifies server-side via CLI (`subtarefa listar --tarefa-id`) that only the tarefa link exists, then edits to switch parent to `ticket` and verifies server-side that the tarefa link is gone and only the ticket link remains — the XOR invariant proven live, not just in the DOM (test #14). |
| 4 | Submitting with a missing/invalid required field shows inline shadcn-styled error text/`Alert` and blocks submission, with zero native `window.alert`/`confirm` dialogs (Playwright dialog-listener proof) | ✓ VERIFIED | `formError` renders via `Alert[variant=destructive]` + `AlertDescription` (testid `entity-error` unchanged); `<form novalidate>` added (10-02, live-discovered fix) so JS-level validation — not the browser's native constraint validation — is the sole blocking path. Live: `entities-form-restyle.spec.ts`'s ENTFRM-04 test registers a `page.on("dialog", ...)` listener that throws if any native dialog fires, submits with `field-nome` blank, asserts the `Alert` (`[data-slot="alert"]` with `destructive` class) is visible and the Dialog stays open — zero native dialog fired (test #11, passed). Delete's pre-existing `window.confirm()` is untouched and out of this truth's scope (SC4 is about *validation* errors, not delete confirmation; the form-restyle spec explicitly accepts that dialog on delete, consistent with unchanged pre-existing delete UX). |
| 5 | Creating, editing, deleting a record, and logging in/out each produce a visible outcome-matching Sonner toast, for at least one entity per capability class plus both auth actions | ✓ VERIFIED | `toast.success()`/`toast.error()` wired into every `formError` assignment + success path in `handleSubmit`/`handleDelete` (EntityScreen.svelte), `LoginScreen.svelte`'s `enviarCodigo`/`verificarCodigo`, and `Shell.svelte`'s logout (fixed post-review, commit `eb8e84f`, to only fire success after `signOut()` actually resolves). Live: fundos create+delete toasts (test #10), validation-error toast (test #11), instanciasRotina status-edit toast (test #12) — covering both capability classes with forms; `login-flow.spec.ts` asserts send-success and wrong-code-error toasts (tests #6-7); `shell-nav.spec.ts` asserts logout success toast (test #39). All passed live. Edit-specific toast text ("Registro atualizado.") shares the exact same `toast.success(...)` call site as create (EntityScreen.svelte line 360, single line, `wasCreate` ternary only changes the string) — not a separately-testable branch, so the create-path live proof extends with high confidence to edit; no live test asserts the "atualizado" string specifically (see Note below). |

**Score:** 5/5 truths verified

### Note (non-blocking)

No spec explicitly asserts the toast text for a plain **edit** (update, as opposed to create) success — only create/delete/status-edit/validation/login/logout paths are asserted with `data-sonner-toast` locators. Code inspection confirms this is a single shared line (`toast.success(wasCreate ? "Registro criado." : "Registro atualizado.")`) reached by both create and update, not a separate branch that could silently diverge, so this is not treated as a gap. Recorded here for completeness, not as a blocker.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/components/ui/dialog/` | shadcn Dialog primitives | ✓ VERIFIED | Present, wired into EntityScreen.svelte's form |
| `web/src/lib/components/ui/checkbox/`, `textarea/`, `popover/`, `calendar/`, `select/`, `separator/` | shadcn field primitives | ✓ VERIFIED | Present, wired per field kind |
| `web/src/lib/components/ui/sonner/sonner.svelte` + `index.ts` | hand-written Toaster wrapper, no mode-watcher | ✓ VERIFIED | Confirmed hand-written, `theme="system"`, mounted once in `App.svelte` outside SignedIn/SignedOut; `package.json`/`bun.lock` confirmed to have zero `mode-watcher` |
| `web/src/lib/entities/EntityScreen.svelte` | Dialog-wrapped form, all field kinds converted, Alert validation, toast calls | ✓ VERIFIED | All branches present; `novalidate` present; toast calls at every formError site + success paths |
| `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/Shell.svelte` | toast calls on auth actions | ✓ VERIFIED | Confirmed present; Shell's logout fix (WR-02) confirmed applied in current source |
| `web/e2e/entities-form-restyle.spec.ts` | proves ENTFRM-01/02/03/04 + FDBK-01 live | ✓ VERIFIED | Read in full; assertions are substantive (role checks, server-side CLI cross-checks for XOR, reload-based persistence checks), not superficial |
| `web/e2e/helpers/form-controls.ts` | `pickDate`/`selectByText`/`openAndReadSelectOptions` | ✓ VERIFIED | Present, used by all touched specs; zero remaining native `.selectOption()`/`.locator("option")`/date-`.fill()` anywhere in `web/e2e/` (grep-confirmed) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `EntityScreen.svelte` form | InstantDB | `db.transact` inside `handleSubmit`/`handleDelete` (unchanged from pre-Phase-10) | ✓ WIRED | Live reload-based assertions in `entities-form-restyle.spec.ts` confirm persisted values, not optimistic-only state |
| Date-picker trigger | `formValues[f.name]` | `Calendar`'s `value` binding → `parseDate`/`CalendarDate.toString()` round-trip | ✓ WIRED | `formValues[f.name]` remains a plain `YYYY-MM-DD` string end to end; live-proven via reload assertion |
| Select/xorLink | `donoId`-scoped relationship link | `onValueChange` setting the link id, `handleSubmit`'s existing link/unlink transact calls | ✓ WIRED | Server-side CLI cross-check in the subtarefas xorLink test proves the link mutation actually happened, not just DOM state |
| `formError`/`erro` | Toast + Alert | Same already-sanitized string fed to both `toast.error()` and `AlertDescription` | ✓ WIRED | Confirmed by code read; both render paths use the identical variable |

### Behavioral Spot-Checks / Live Full Suite

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Playwright e2e suite (setup+authed+anon) | `bun run test:e2e` | 39 passed (4.2m), 1 worker, one clean run | ✓ PASS |
| Type-check + svelte-check | `bun run check` | 0 errors, 1 pre-existing unrelated warning | ✓ PASS |
| Formatter + linter | `bun run lint` | exit 0, 1 pre-existing/acknowledged info finding | ✓ PASS |

### Code Review Findings (10-REVIEW.md) — Resolution Confirmed

| ID | Finding | Status | Confirmed In Codebase |
|----|---------|--------|------------------------|
| WR-01 | Date-picker trigger lost `id`/layout classes to bits-ui prop forwarding | Fixed (`b748198`) | `EntityScreen.svelte` ~line 526: `{...props}` spread first, explicit `id`/`data-testid`/`class` after — confirmed by direct read of current source |
| WR-02 | Logout toast fired unconditionally, not gated on `signOut()` success | Fixed (`eb8e84f`) | `Shell.svelte` logout handler now `try { await db.auth.signOut(); toast.success(...) } catch { toast.error(...) }` — confirmed by direct read of current source |
| IN-01 | Missing radix param in CLI-generated calendar boilerplate | Acknowledged, not fixed (out of scope) | Confirmed still present as a Biome info-level (not error/warning) finding, does not affect `bun run lint`'s exit code |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| ENTFRM-01 | 10-01, 10-02 | ✓ SATISFIED | Dialog + all field kinds via shadcn primitives, live-proven |
| ENTFRM-02 | 10-01, 10-04 | ✓ SATISFIED | Popover+Calendar date-picker, persists correctly, live-proven across 4 entities |
| ENTFRM-03 | 10-02, 10-04 | ✓ SATISFIED | Select for static-option/link/xorLink fields, XOR invariant proven server-side |
| ENTFRM-04 | 10-02 | ✓ SATISFIED | Alert-based validation, `novalidate` fix, zero-native-dialog listener proof |
| FDBK-01 | 10-03 | ✓ SATISFIED | Toasts wired into all CRUD writes + both auth actions, live-proven for both capability classes with forms plus auth |

No orphaned requirements — all 4 plans' declared `requirements:` fields (ENTFRM-01/02/03/04, FDBK-01) match REQUIREMENTS.md's Phase 10 mapping exactly.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across all phase-10-touched files (`EntityScreen.svelte`, `App.svelte`, `LoginScreen.svelte`, `Shell.svelte`, `sonner/*`, `entities-form-restyle.spec.ts`, `form-controls.ts`) returned zero matches. All commits referenced in SUMMARYs and REVIEW confirmed present in `git log`.

### Human Verification Required

None. Per PROJECT.md C-12 (zero human UAT anywhere in this milestone) and REQUIREMENTS.md's explicit Out-of-Scope note ("Human UAT checkpoints... Playwright e2e is the verification mechanism for every phase"), every truth above was verified via a live Playwright run performed directly by this verifier (not sourced from SUMMARY claims) plus direct source-code inspection. No status other than `passed`/`gaps_found` is applicable to this phase, consistent with the verification instructions.

### Gaps Summary

No gaps found. All 5 ROADMAP Phase 10 success criteria hold, verified by a live, clean `bun run test:e2e` run (39/39) performed by this verifier, live `bun run check`/`bun run lint` (both exit 0), and direct source inspection confirming both prior code-review findings (WR-01, WR-02) are fixed in the current codebase — not just claimed fixed in 10-REVIEW.md. The one acknowledged info-level Biome finding (IN-01) is pre-existing CLI-generated boilerplate explicitly out of scope and does not affect the quality-gate exit code.

---

*Verified: 2026-08-10T03:11:44Z*
*Verifier: Claude (gsd-verifier)*
