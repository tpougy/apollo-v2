---
phase: 11
slug: full-verification-quality-gates
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` ^1.62.1 |
| **Config file** | `web/playwright.config.ts` (`setup`/`authed`/`anon`, unchanged) |
| **Quick run command** | N/A — this phase's unit of work is the full suite |
| **Full suite command** | `bun run test:e2e` (single sequential invocation — do NOT parallelize auth-dependent runs, per rate-limit risk noted in 11-CONTEXT.md) |
| **Estimated runtime** | ~4-5 min |

---

## Sampling Rate

- **Per task:** re-run `bun run test:e2e` (this phase has no smaller unit — its job IS the full suite) + `bun run check` + `bun run lint`
- **Phase gate:** same, must be green with zero new suppressions vs v1.0 baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 11-01-0X | 01 | 1 | VERIFY-01/02/03 | e2e live (full suite) | `bun run test:e2e` | ⬜ pending |
| 11-01-0X | 01 | 1 | QUAL-01 | tooling | `bun run check && bun run lint` | ⬜ pending |

---

## Wave 0 Requirements

- [x] No new spec infrastructure needed — this phase audits/extends existing coverage built by Phases 7-10.

---

## Manual-Only Verifications

*None — per PROJECT.md constraint C-12, zero human UAT anywhere in this milestone. This phase is itself the proof that this held throughout.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere (C-12)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-10
