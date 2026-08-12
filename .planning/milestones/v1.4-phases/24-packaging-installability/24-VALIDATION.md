---
phase: 24
slug: packaging-installability
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-12
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from
> `24-RESEARCH.md`'s own `## Validation Architecture` section, mapped onto the two plans this
> phase actually produced.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 9.1.1 (`cli/pyproject.toml` `[dependency-groups].dev`) |
| **Config file** | `cli/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd cli && uv run pytest -m "not live and not packaging"` |
| **Full suite command** | `cd cli && uv run pytest` (runs everything, including `live`- and `packaging`-marked tests; live-session-dependent tests skip cleanly when no session is persisted) |
| **Estimated runtime** | ~5-10s (quick, offline), ~30-90s (full suite, includes real `uv build`/`uv venv`/`uv pip install` subprocess calls in `test_packaging_live.py`) |

---

## Sampling Rate

- **After every task commit:** `cd cli && uv run pytest -m "not live and not packaging"` (fast, offline)
- **After Plan 24-01 (Task 1's tracer):** the scratch-venv live round trip scripted directly in Task 1's
  own `<verify>` — not deferred to a later wave, since PKG-05's crash mode (RESEARCH.md Pitfall 1) is
  triggered at CLI import time and must be proven fixed the moment the fix lands.
- **After Plan 24-02 (full suite + real install):** `cd cli && uv run pytest` (full suite, includes the
  new `packaging`-marked regression test) + the real `uv tool install --force`/`uv tool uninstall
  apollo-cli` round trip, executed once and captured verbatim in `24-02-SUMMARY.md`.
- **Max feedback latency:** ~90 seconds (the real `uv build`/install cycles are the slowest step; still
  well under the 30s-per-command "watch out" threshold on a per-command basis, though the full chain
  taken together runs longer — this is expected and accepted for a packaging phase whose entire point is
  proving real build/install mechanics, not a unit-test loop).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | PKG-01, PKG-03, PKG-04 | T-24-01-01..04 | No admin-token leak; wheel contains exactly the expected files; correct ANBIMA business-day math and no crash outside the repo | live (scratch venv, real subprocess) | `uv build` + `zipfile -l` grep + `uv venv`/`uv pip install` + direct `python -c` bizdays correctness check + run `apollo --version`/`doctor`/`fundo listar` from outside repo + `uv run pytest tests/test_bizdays.py tests/test_calendar_json.py tests/test_instant_client.py` | ✅ existing test files; ❌ Wave 0 for the round trip itself (created and run in this same task) | ⬜ pending |
| 24-01-02 | 01 | 1 | PKG-02, PKG-03, PKG-04 | — (test-writing task, no new threat surface) | Byte-parity is load-bearing (fails on deliberate divergence); fallback-chain precedence proven end-to-end | unit (offline, `tmp_path`+`monkeypatch`) | `uv run pytest tests/test_calendar_vendored_parity.py tests/test_config_app_id_fallback.py -v` + mutate/revert cycle + `uv run pytest -m "not live" -q` | ❌ Wave 0 (both files new, created and run in this same task) | ⬜ pending |
| 24-02-01 | 02 | 2 | PKG-05 | T-24-02-01 | Admin-token confinement gates pass unmodified; live packaging test is real, not mocked | packaging (live, real subprocess) + structural (AST-walk) | `uv run pytest tests/test_packaging_live.py -v -m packaging` + targeted `-k` run of the two admin-token confinement tests | ❌ Wave 0 (test_packaging_live.py new, created and run in this same task) | ⬜ pending |
| 24-02-02 | 02 | 2 | PKG-05 | T-24-02-02, T-24-02-03 | Real global `uv tool install`/`uninstall` round trip leaves the machine clean; quality gates all clean | quality gate + live (real `uv tool install`) | `uv run ruff check`/`ruff format --check`/`ty check` + `uv run pytest -q` + real `uv build`/`uv tool install --force`/run-outside-repo/`uv tool uninstall apollo-cli`/`uv tool list` | ✅ existing tooling; the manual round trip is the deliverable itself | ⬜ pending |

*Task IDs above match the `<name>` numbering inside each plan's `<tasks>` block.*

---

## Wave 0 Requirements

No task in either plan defers its own verification to a separate scaffold task — every task creates
whatever test file(s) it needs and runs them within the same task's `<verify>` block:

- [x] `cli/tests/test_calendar_vendored_parity.py` — created and run inside Plan 24-01 Task 2 (covers
  PKG-02)
- [x] `cli/tests/test_config_app_id_fallback.py` — created and run inside Plan 24-01 Task 2 (covers
  PKG-03/PKG-04)
- [x] `cli/tests/test_packaging_live.py` — created and run inside Plan 24-02 Task 1 (covers PKG-05,
  automated)
- [x] `cli/pyproject.toml`'s `packaging` marker registration — added inside Plan 24-02 Task 1, immediately
  consumed by the same task's test file
- [x] `cli/apollo_cli/data/` (and its vendored JSON) — created inside Plan 24-01 Task 1, immediately
  consumed by that same task's live round trip and by Task 2's byte-parity test

No `<automated>MISSING</automated>` placeholders exist anywhere in either plan.

---

## Manual-Only Verifications

- **The real `uv tool install --force`/`uv tool uninstall apollo-cli` acceptance round trip** (Plan 24-02
  Task 2) is scripted as a real, runnable `<automated>` command block (satisfying the Nyquist automated-
  verify requirement), but its *purpose* is manual-grade documentary capture: PROJECT.md's live-
  verification convention requires this exact transcript to be pasted into `24-02-SUMMARY.md`, not merely
  described. This is not a `checkpoint:human-verify` — no human judgment call is needed, only faithful
  transcription of a command that already ran.
- No `checkpoint:human-verify`/`checkpoint:human-action` tasks exist anywhere in this phase — `PROJECT.md`
  constraint (autonomous execution) and `workflow.human_verify_mode=end-of-phase` are both satisfied by
  every task's own real, runnable `<automated>` verify.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify — no `<human-check>` blocks anywhere
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 4 tasks across both plans
  carry real, runnable automated commands)
- [x] Wave 0 covered — every new test file is created and run within the same task that needs it
- [x] No watch-mode flags anywhere in any `<automated>` block
- [x] Feedback latency: quick loop < 10s; full live/packaging round trips are intentionally slower
  (real `uv build`/install cycles), documented above, not disguised as a fast loop
- [x] `nyquist_compliant: true` set in this document's frontmatter

**Approval:** pending (execution not yet run)
