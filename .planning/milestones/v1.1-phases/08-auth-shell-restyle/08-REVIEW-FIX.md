---
phase: 08-auth-shell-restyle
fixed_at: 2026-08-09T23:05:41Z
review_path: .planning/phases/08-auth-shell-restyle/08-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-08-09T23:05:41Z
**Source review:** .planning/phases/08-auth-shell-restyle/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Warning-only; Info findings IN-01/IN-02 explicitly out of scope per fix request)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `login-flow.spec.ts`'s post-test "drain" is a no-op that doesn't do what its comment claims

**Files modified:** `web/e2e/login-flow.spec.ts`
**Commit:** 8ff9e19
**Applied fix:** Removed the dead `await readMagicCodeAfter(sentAt, null).catch(() => { ... })` block and its misleading "drains the code" comment entirely (the Fix section's first option — the call was read-only, discarded its return value, and passed `null` instead of a real prior code, so it accomplished nothing). Also removed the now-unused `const sentAt = Date.now();` local that existed only to feed the removed call. The preceding `await expect(page.getByTestId("login-code")).toBeVisible({ timeout: 30_000 })` (already present two lines above) fully covers the legitimate "let the in-flight send settle before the test ends" intent, so no replacement code was needed.

Verification: `bun run check` (svelte-check + tsc, 0 errors) and `bun run lint` (Biome, 0 issues) both clean; re-ran `bunx playwright test e2e/login-flow.spec.ts --project=anon` live against the real InstantDB backend and Outlook Classic COM bridge (no mock) — both tests passed (1.5s + 8.1s).

### WR-02: `@internationalized/date` added as an untracked, unused dependency

**Files modified:** `.planning/phases/08-auth-shell-restyle/08-01-SUMMARY.md`
**Commit:** e92324a
**Applied fix:** Investigated before applying either literal Fix option (document vs. remove). Confirmed `@internationalized/date` is **not** dead weight: the resolved `bits-ui@2.18.1` (`web/node_modules/bits-ui/package.json`) declares `@internationalized/date@^3.8.1` as a `peerDependency`, and `web/bun.lock` shows `@internationalized/date@3.12.3` was installed as a direct dependency by the same `bunx shadcn-svelte add` run that pulled `bits-ui` — satisfying that peer requirement. Per the Fix section's guidance ("leave it and note why" if it turns out to be genuinely required), left `web/package.json`/`web/bun.lock` unchanged and instead documented the dependency's real purpose: added `"@internationalized/date@^3.12.0 (transitive, bits-ui's declared peerDependency — required by bits-ui@2.18.1 per its package.json even though no Phase 8 component imports it directly; not dead weight)"` to `08-01-SUMMARY.md`'s `tech-stack.added` list, and updated the `key-files` line describing the `package.json`/`bun.lock` diff to mention it explicitly.

Verification: `bun run check` and `bun run lint` re-confirmed clean after the docs-only edit (no source files touched, so no runtime risk).

## Skipped Issues

None — both in-scope findings were fixed.

---

_Fixed: 2026-08-09T23:05:41Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
