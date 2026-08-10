---
phase: 7
slug: design-system-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` 1.62.1 |
| **Config file** | `web/playwright.config.ts` (existing — `setup`/`authed` projects, `baseURL: http://localhost:5174`, auto-starting webServer) |
| **Quick run command** | `cd web && bunx playwright test e2e/design-system.spec.ts` |
| **Full suite command** | `cd web && bun run test:e2e` |
| **Estimated runtime** | ~10-20 seconds (quick), ~2-3 minutes (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd web && bunx playwright test e2e/design-system.spec.ts`
- **After every plan wave:** Run `cd web && bun run test:e2e` (full existing suite — must not regress `auth.setup.ts`/entity specs)
- **Before `/gsd-verify-work`:** Full suite green + `bun run check` (svelte-check/tsc) + `bun run lint` (Biome) all clean
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-0X | 01 | 1 | SETUP-01 | — / N/A (no new attack surface — build tooling only) | N/A | e2e | `bunx playwright test e2e/design-system.spec.ts -g "preflight"` | ❌ Wave 0 | ⬜ pending |
| 07-01-0X | 01 | 1 | SETUP-02 | — / N/A | N/A | e2e + tooling | `bunx playwright test e2e/design-system.spec.ts -g "tokens"` + `test -f web/components.json` | ❌ Wave 0 | ⬜ pending |
| 07-01-0X | 01 | 1 | SETUP-03 | — / N/A | N/A | e2e | `bunx playwright test e2e/design-system.spec.ts -g "dark mode"` | ❌ Wave 0 | ⬜ pending |
| 07-01-0X | 01 | 1 | (all) | — / N/A | N/A | e2e | `bunx playwright test e2e/design-system.spec.ts -g "boots"` | ❌ Wave 0 | ⬜ pending |

*Exact task IDs are assigned by the planner; this map documents the requirement→test correspondence the plan must satisfy.*

---

## Wave 0 Requirements

- [ ] `web/e2e/design-system.spec.ts` — new file, covers SETUP-01/02/03 + zero-console-error boot check. No new fixtures needed — runs standalone against the pre-login DOM (no auth dependency).

---

## Manual-Only Verifications

*None — per PROJECT.md constraint C-12, this milestone has zero human UAT anywhere. All phase behaviors have automated (Playwright) verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere (C-12)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `design-system.spec.ts`
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
