---
phase: 6
slug: end-to-end-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (`cli/`) — no new frontend test framework needed, this phase is CLI-only + shell-script composition |
| **Config file** | `cli/pyproject.toml` (existing, from Phase 1) |
| **Quick run command** | `cd cli && uv run pytest tests/test_cross_user_isolation.py tests/test_interrupted_job.py -q` |
| **Full suite command** | `bash .planning/phases/06-end-to-end-verification/verify-phase-06.sh` |
| **Estimated runtime** | ~5-10 minutes (composes all 5 prior phase verify scripts + 2 new live pytest modules) |

---

## Sampling Rate

- **After every task commit:** Run the relevant new pytest module (`test_cross_user_isolation.py` or `test_interrupted_job.py`)
- **After every plan wave:** Run the quick run command above
- **Before phase verification:** Full `verify-phase-06.sh` must exit 0
- **Max feedback latency:** ~120s (live magic-code round trip + live InstantDB round trips dominate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 06-01 | 1 | VERIFY-05 | T-06-01..04 | Second real user cannot write tp@'s donoId-scoped record | live | `uv run pytest cli/tests/test_cross_user_isolation.py -k login -q` | ⬜ | ⬜ pending |
| 06-01-02 | 06-01 | 1 | VERIFY-05 | T-06-01..04 | Write-based `permission-denied` proof against live app | live | `uv run pytest cli/tests/test_cross_user_isolation.py -k denial -q` | ⬜ | ⬜ pending |
| 06-01-03 | 06-01 | 1 | VERIFY-05 | T-06-17..20 | Guarded `delete_user` teardown never touches tp@ | live | `uv run pytest cli/tests/test_cross_user_isolation.py -k teardown -q` | ⬜ | ⬜ pending |
| 06-02-01 | 06-02 | 2 | VERIFY-04 | T-06-09..11 | Sentinel-gated SIGKILL lands mid-generation deterministically | live | `uv run pytest cli/tests/test_interrupted_job.py -k kill -q` | ⬜ | ⬜ pending |
| 06-02-02 | 06-02 | 2 | VERIFY-04 | T-06-12..14 | Re-run after kill: zero duplicate, zero missing instances | live | `uv run pytest cli/tests/test_interrupted_job.py -k converge -q` | ⬜ | ⬜ pending |
| 06-03-01 | 06-03 | 3 | VERIFY-01 | T-06-15 | Composes Phase 3/4/5 cross-channel specs, asserts they ran (not skipped) | shell | `bash verify-phase-06.sh` (VERIFY-01 section) | ⬜ | ⬜ pending |
| 06-03-02 | 06-03 | 3 | VERIFY-02, VERIFY-03 | T-06-16 | Repo-wide ruff/ty (cli/) and Biome/svelte-check (web/) clean | shell | `bash verify-phase-06.sh` (quality-gate section) | ⬜ | ⬜ pending |
| 06-03-03 | 06-03 | 3 | VERIFY-01..05 | T-06-18..20 | Single "v1 done" gate, re-runnable, no leftover fixtures | shell | `bash verify-phase-06.sh` (full run) | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cli/tests/test_cross_user_isolation.py` — new module for VERIFY-05 (06-01)
- [ ] `cli/tests/test_interrupted_job.py` — new module for VERIFY-04 (06-02)
- [ ] `.planning/phases/06-end-to-end-verification/verify-phase-06.sh` — new composition script (06-03)
- No new test framework installs needed — `pytest` (cli/) and Biome/svelte-check (web/) already present since Phases 1-4.

---

## Manual-Only Verifications

*None. All phase behaviors have automated verification — this phase's whole purpose is a fully-automated end-to-end gate for the v1 milestone.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (per plan text)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (per plan text)
- [x] Wave 0 covers all MISSING references (both new pytest modules + the composition script)
- [x] No watch-mode flags
- [x] Feedback latency < 120s (estimated)
- [ ] `nyquist_compliant: true` — set once execution actually proves the table above green

**Approval:** pending — this file was authored by the orchestrator before execution (plan-checker flagged the missing VALIDATION.md as a blocker); it documents the validation strategy already designed into 06-01/06-02/06-03's `<verify>` blocks. Status flips to `validated`/`nyquist_compliant: true` after `/gsd-execute-phase 6` runs and the per-task table above is filled in with real results.
