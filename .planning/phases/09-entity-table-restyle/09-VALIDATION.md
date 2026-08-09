---
phase: 9
slug: entity-table-restyle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` ^1.62.1 |
| **Config file** | `web/playwright.config.ts` (unchanged this phase) |
| **Quick run command** | `bunx playwright test <new-or-touched-spec> --project=authed` |
| **Full suite command** | `bun run test:e2e` |
| **Estimated runtime** | ~1-2 min targeted, ~3 min full suite |

---

## Sampling Rate

- **After every task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=authed`
- **After every plan wave:** `bun run test:e2e` (full suite, live)
- **Before `/gsd-verify-work`:** Full suite green + `bun run check` + `bun run lint` clean
- **Max feedback latency:** ~2 min

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-0X | 01 | 1 | ENTTBL-01 | V4 unchanged (N/A) | Capability gating logic untouched | e2e live | `bunx playwright test e2e/entities-table-restyle.spec.ts --project=authed` | ❌ Wave 0 | ⬜ pending |
| 09-01-0X | 01 | 1 | ENTTBL-02 | — | N/A | e2e live | same spec | ❌ Wave 0 | ⬜ pending |
| 09-01-0X | 01 | 1 | ENTTBL-03 | V4 unchanged (N/A) | Zero row-action rendering for read-only/restricted entities preserved | e2e live (extends `entities-fundos.spec.ts`, `entities-rotina-log.spec.ts`) | `bun run test:e2e` | ✅ existing specs | ⬜ pending |

*Exact task IDs assigned by the planner; this map documents requirement→test correspondence the plan must satisfy.*

---

## Wave 0 Requirements

- [ ] New/extended e2e spec proving `role="table"` + `Badge` rendering + row-count-matches-query, across at least one entity per capability class (full-CRUD: `fundos`; restricted create-only/status-only: `instanciasRotina`; read-only: `logInferenciaClaude`).
- [ ] Confirm existing `entities-*.spec.ts` specs still pass unmodified against the restyled markup (they use `data-testid` locators exclusively, preserved verbatim this phase).

---

## Manual-Only Verifications

*None — per PROJECT.md constraint C-12, zero human UAT anywhere in this milestone.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere (C-12)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers table/badge e2e coverage across all capability classes
- [ ] No watch-mode flags
- [ ] Feedback latency < 2 min
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
