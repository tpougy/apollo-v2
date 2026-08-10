---
phase: 08-auth-shell-restyle
reviewed: 2026-08-09T23:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - web/src/lib/auth/LoginScreen.svelte
  - web/src/lib/Shell.svelte
  - web/e2e/login-flow.spec.ts
  - web/e2e/shell-nav.spec.ts
  - web/playwright.config.ts
  - web/package.json
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: clean
fixed_at: 2026-08-09T23:05:41Z
fix_report: 08-REVIEW-FIX.md
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-09T23:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** clean (both Warning findings resolved — see [08-REVIEW-FIX.md](./08-REVIEW-FIX.md); Info findings remain as acknowledged, non-blocking notes)

## Summary

Reviewed the hand-edited restyle of `LoginScreen.svelte`/`Shell.svelte` on shadcn-svelte primitives, plus the two new Playwright specs and the two config/manifest edits that support them. Diffed both restyled `.svelte` files against their pre-restyle commits (`8cbf148~1`/`68b41da~1`) to confirm script-block integrity claims rather than trusting the SUMMARY's prose.

Findings against the specific risk areas called out for this review:
- **`type="submit"` on both LoginScreen submit Buttons** — present and correct on both the email-step and code-step `Button`. Confirmed `button.svelte`'s own default is `type = "button"` (line 51), so this was a genuine silent-break risk that was correctly avoided.
- **`login-submit` testid reuse** — the literal string `data-testid="login-submit"` is present verbatim on both submit `Button` instances (email step and code step), matching `auth.setup.ts`'s expectation of clicking the same testid twice.
- **`Shell.svelte`'s `onMount` job-tracking / `{#key ativo}` block** — diffed against `68b41da~1`; the `<script>` block is byte-identical (only the `Button` import line was added). No accidental refactor of `jobStarted`/`jobState`/`onMount` or the `{#key ativo}` mount block.
- **XSS / error-message rendering** — no `{@html}` introduced in either file; `{erro}`, `{email}`, `{auth.user.email}` all remain plain Svelte text interpolation (auto-escaped). The restyled `Alert`/`AlertDescription` wrapping is a pure container change around the same trusted-by-Svelte text node; consistent with the plan's own threat register (T-08-01/T-08-02, both "accept").

No blocker-level issues found. Two warnings (test-suite/dependency-hygiene quality issues, not functional regressions in the restyled screens) and two info-level notes below.

## Warnings

### WR-01: `login-flow.spec.ts`'s post-test "drain" is a no-op that doesn't do what its comment claims

**File:** `web/e2e/login-flow.spec.ts:42-47`
**Issue:** After the loading-state assertions pass, the test calls:
```ts
await readMagicCodeAfter(sentAt, null).catch(() => {
  // Best-effort drain only ...
});
```
The comment states this "drains the code this test itself triggered so it doesn't confuse a later `readLatestMagicCode()` call." But:
1. `readMagicCodeAfter`/`readLatestMagicCode` (`web/e2e/helpers/magic-code.ts`) are read-only — they only run `orules.ps1 peek`, which never deletes or marks anything in the inbox. Nothing is actually "drained" from Outlook; the message stays exactly where it was regardless of this call.
2. The return value is discarded entirely (no assignment, no assertion), so even the read itself has no effect on subsequent tests' state.
3. `priorCode` is hardcoded to `null` instead of the actual prior code observed before this test's send, defeating the "code different from priorCode" comparison the helper is designed around — the first code found (which could be a stale message already sitting in the inbox from an unrelated run) satisfies `code !== null` immediately.

Net effect: this call does nothing useful, can never fail the test (wrapped in `.catch`), but is misleading to a future maintainer who reads the comment and assumes it clears inbox state. It also has no coordinating effect with Test 2 in the same file, which independently calls `readLatestMagicCode()` for its own `priorCode` baseline and would work identically whether or not this "drain" call exists.

**Fix:** Either remove the block (it accomplishes nothing) or replace the comment with an accurate description — e.g., if the intent is only "let the in-flight send settle before the test ends," a plain `await expect(page.getByTestId("login-code")).toBeVisible()` (already present two lines above) already covers that; the extra inbox read is unnecessary.

**Resolved:** Removed the dead `readMagicCodeAfter(sentAt, null).catch(...)` block and its misleading comment entirely (option 1 of the Fix) — the preceding `await expect(page.getByTestId("login-code")).toBeVisible(...)` already covers the "let the send settle" intent. The now-unused `sentAt` local was removed too. Re-ran `bunx playwright test e2e/login-flow.spec.ts --project=anon` live (real magic-code round trip via the Outlook COM bridge) — both tests pass. See [08-REVIEW-FIX.md](./08-REVIEW-FIX.md).

### WR-02: `@internationalized/date` added as an untracked, unused dependency

**File:** `web/package.json:33`
**Issue:** `bunx shadcn-svelte add button input label card alert` pulled `@internationalized/date` (line 33) in addition to the documented `bits-ui`. `08-01-SUMMARY.md`'s `tech-stack.added` field only lists `bits-ui@^2.16.3 (transitive, via shadcn-svelte Label)"` — `@internationalized/date` is undocumented. Verified it is not imported anywhere under `web/src/`:
```
$ grep -rl "@internationalized/date" web/src/
(no output)
```
It is presumably a transitive pull tied to the shadcn-svelte "nova" registry's shared component metadata (likely destined for the Calendar/date-picker component Phase 9/10 will add), but as committed today it is dead weight with no tracked justification.
**Fix:** Either document it in the SUMMARY's `tech-stack.added` list (if intentionally pre-staged for a later phase) or remove it now and let the phase that actually needs it (Calendar/date-picker) reintroduce it via its own `shadcn-svelte add` run.

**Resolved:** Investigated further before acting — `web/node_modules/bits-ui/package.json` (resolved `bits-ui@2.18.1`) declares `@internationalized/date@^3.8.1` as a `peerDependency`, and `bun.lock` confirms it was pulled in as a direct dependency at version `3.12.3` (satisfying that peer range) by the same `bunx shadcn-svelte add` run that installed `bits-ui`. It is genuinely required — not dead weight — even though no Phase 8 component imports it directly; removing it would leave `bits-ui`'s declared peer dependency unsatisfied. Per the Fix's first option, documented it in `08-01-SUMMARY.md`'s `tech-stack.added` list and `key-files` section instead of removing it. `package.json`/`bun.lock` unchanged. See [08-REVIEW-FIX.md](./08-REVIEW-FIX.md).

## Info

### IN-01: Hardcoded real personal email in a new live e2e spec

**File:** `web/e2e/login-flow.spec.ts:11`
**Issue:** `const EMAIL = "tp@rbrasset.com.br";` is a real personal mailbox committed to source control. This continues an existing, explicitly-authorized pattern (PROJECT.md C-10, already present in `auth.setup.ts` from an earlier phase) rather than introducing new exposure, so this is not flagged as a new risk — noting it here only for completeness per the review's security-scan scope. No action needed unless the project's stance on C-10 changes.

### IN-02: Login `Card` has no `CardHeader`/`CardTitle` — cosmetic only

**File:** `web/src/lib/auth/LoginScreen.svelte:61-62`
**Issue:** `Card`/`CardContent` wraps the form with no title/header region, so the login card currently has no visible heading distinguishing it from a bare panel. This satisfies the plan's literal requirement ("Card must be present at each step") and is explicitly out of this plan's stated scope, but is worth flagging as a low-priority visual polish item if a future phase revisits auth screen visual design.
**Fix:** Optional — add `CardHeader`/`CardTitle` (e.g. "Entrar") in a future visual-polish pass; not required by AUTHUI-01/02.

Both Info findings above (IN-01, IN-02) were explicitly out of the requested fix scope for this pass (Warning-only) and remain acknowledged, non-blocking notes — not fixed.

---

_Reviewed: 2026-08-09T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-08-09T23:05:41Z_
_Fixer: Claude (gsd-code-fixer)_
