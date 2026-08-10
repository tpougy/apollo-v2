---
phase: 10
slug: entity-form-restyle-feedback
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` ^1.62.1 |
| **Config file** | `web/playwright.config.ts` (`setup`/`authed`/`anon` projects, unchanged) |
| **Quick run command** | `bunx playwright test <file> --project=authed` |
| **Full suite command** | `bun run test:e2e` |
| **Estimated runtime** | ~2-3 min targeted, ~4-5 min full suite (largest phase so far) |

---

## Sampling Rate

- **After every task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=<matching project>`
- **After every plan wave:** `bun run test:e2e` (full suite, live, includes the 4 existing specs this phase must update)
- **Before `/gsd-verify-work`:** Full suite green + `bun run check` + `bun run lint` clean
- **Max feedback latency:** ~3 min

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-0X-0X | TBD | TBD | ENTFRM-01 | V4 unchanged | N/A | e2e live | `bunx playwright test e2e/entities-form-restyle.spec.ts --project=authed` | ❌ Wave 0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | ENTFRM-02 | — | N/A | e2e live | same spec + updated `entities-fundos.spec.ts` | ❌ Wave 0 / existing update | ⬜ pending |
| 10-0X-0X | TBD | TBD | ENTFRM-03 | — | V5 preserved (Select enum invariant) | e2e live | same spec + updated `entities-projeto-etapa-tarefa.spec.ts`/`entities-ticket-subtarefa.spec.ts`/`entities-rotina-log.spec.ts` | ❌ Wave 0 / existing updates | ⬜ pending |
| 10-0X-0X | TBD | TBD | ENTFRM-04 | V7 (error handling unchanged) | `extractErrorMessage` unchanged, no raw error leakage | e2e live (`page.on("dialog")` zero-fire proof) | same spec | ❌ Wave 0 | ⬜ pending |
| 10-0X-0X | TBD | TBD | FDBK-01 | V7 | Toast reuses already-sanitized `formError` | e2e live (authed + anon) | same spec + `login-flow.spec.ts` additions | ❌ Wave 0 / existing update | ⬜ pending |

*Exact task/plan/wave IDs assigned by the planner; this map documents requirement→test correspondence the plan must satisfy.*

---

## Wave 0 Requirements

- [ ] `web/e2e/entities-form-restyle.spec.ts` — new spec covering ENTFRM-01/02/03/04 + FDBK-01 (entity side) across one entity per capability class (`fundos` full-CRUD incl. date-picker + Checkbox, `instanciasRotina` single-field status-only edit, `templatesRotina` or `subtarefas` for Select/xorLink coverage).
- [ ] `web/e2e/login-flow.spec.ts` (Phase 8, existing) — add two toast assertions (success + error) for FDBK-01's auth side.
- [ ] Update `.fill()`/`.selectOption()` call sites in `entities-fundos.spec.ts`, `entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts` to the new bits-ui-driven interaction patterns (role-based locators) — done in this phase's own plan, not deferred.

---

## Manual-Only Verifications

*None — per PROJECT.md constraint C-12, zero human UAT anywhere in this milestone.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere (C-12) — enforced at planning time
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — enforced at planning time
- [x] Wave 0 covers all listed spec updates/additions
- [x] No watch-mode flags
- [x] Feedback latency < 3 min
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-09 (research-derived, concrete locator strategies verified against live bits-ui source)
