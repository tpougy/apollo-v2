---
phase: 8
slug: auth-shell-restyle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` ^1.62.1 |
| **Config file** | `web/playwright.config.ts` (`setup` → `authed` (depends-on setup) → `anon` projects) |
| **Quick run command** | `bun run test:e2e:auth` (setup only) or targeted `bunx playwright test <file> --project=<name>` |
| **Full suite command** | `bun run test:e2e` |
| **Estimated runtime** | ~30-60s targeted, several minutes full (real magic-code round trip included) |

---

## Sampling Rate

- **After every task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=<matching project>`
- **After every plan wave:** `bun run test:e2e` (full suite — live `setup` → `authed` → `anon`)
- **Before `/gsd-verify-work`:** Full suite green + `bun run check` + `bun run lint` clean
- **Max feedback latency:** ~60s targeted

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-0X | 01 | 1 | AUTHUI-01 | V2/V3 unchanged (N/A) | Existing InstantDB magic-code backend logic untouched | e2e live | `bunx playwright test e2e/auth.setup.ts --project=setup` | ✅ exists | ⬜ pending |
| 08-01-0X | 01 | 1 | AUTHUI-02 | V5 preserved (input attrs unchanged) | No new validation logic added/removed | e2e live | `bunx playwright test e2e/login-flow.spec.ts --project=anon` | ❌ Wave 0 | ⬜ pending |
| 08-01-0X | 01 | 1 | SHELLUI-01 | V4 N/A (no perms touched) | N/A | e2e live (authed) | `bunx playwright test e2e/shell-nav.spec.ts --project=authed` | ❌ Wave 0 | ⬜ pending |
| 08-01-0X | 01 | 1 | SHELLUI-02 | — | N/A | e2e live (authed) | same as above | ❌ Wave 0 | ⬜ pending |

*Exact task IDs assigned by the planner; this map documents requirement→test correspondence the plan must satisfy.*

---

## Wave 0 Requirements

- [ ] `web/e2e/login-flow.spec.ts` — covers AUTHUI-02 loading/error states via a live round trip + deliberate wrong-code submission; added to `playwright.config.ts`'s `anon` project `testMatch` (additive edit, same pattern as Phase 7's `design-system.spec.ts`).
- [ ] `web/e2e/shell-nav.spec.ts` — covers SHELLUI-01/02 nav/active-state/logout; picked up automatically by `authed`'s existing `testMatch` regex, no config edit needed.

---

## Manual-Only Verifications

*None — per PROJECT.md constraint C-12, zero human UAT anywhere in this milestone. The real magic-code round trip is itself fully automated (`auth.setup.ts` shells out to the Outlook COM bridge directly, no human relay needed).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere (C-12)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `login-flow.spec.ts` + `shell-nav.spec.ts`
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (targeted runs)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
