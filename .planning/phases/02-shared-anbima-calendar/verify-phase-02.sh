#!/usr/bin/env bash
# Re-runs every CAL-01 through CAL-05 gate for Phase 2 (shared ANBIMA
# calendar) in one command, plus the extended quality gates. Exits 0 and
# prints "PHASE 02 VERIFIED" as its final line only if every gate passes.
# Never leaves the repo dirty (a trap restores shared/anbima-calendar.json
# even on abort). Safe to run twice in a row from any cwd.
#
# Usage: bash .planning/phases/02-shared-anbima-calendar/verify-phase-02.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

echo "== Phase 2 verification starting in ${REPO_ROOT} =="

# Pinned drift-guard numbers, recorded here from the plan-02 SUMMARYs (not
# from PROJECT.md's stale "~948" figure, which this plan does not touch).
EXPECTED_HOLIDAY_COUNT=1003          # from 02-01-SUMMARY.md
EXPECTED_MIN_FIXTURE_CASES=40        # from 02-02-SUMMARY.md (42 actual)
EXPECTED_MIN_ERROR_CASES=12          # from 02-02-SUMMARY.md (13 actual)

# ---------------------------------------------------------------------------
# CAL-01: vendored table
# ---------------------------------------------------------------------------
echo "-- CAL-01: vendored ANBIMA calendar table"

test -f shared/anbima-calendar.json

uv run --project cli python - "${EXPECTED_HOLIDAY_COUNT}" <<'PYEOF'
import json
import sys

expected_count = int(sys.argv[1])

with open("shared/anbima-calendar.json", encoding="utf-8") as f:
    payload = json.load(f)

holidays = payload["holidays"]

assert payload["start"] == "2000-01-01", f"start={payload['start']!r}"
assert payload["end"] == "2078-12-25", f"end={payload['end']!r}"
assert payload["count"] == len(holidays), f"count={payload['count']} len={len(holidays)}"
assert holidays == sorted(holidays), "holidays not strictly ascending"
assert len(holidays) == len(set(holidays)), "duplicate holidays present"
assert 900 <= payload["count"] <= 1200, f"count {payload['count']} outside [900,1200] sanity band"
assert payload["count"] == expected_count, (
    f"count {payload['count']} != pinned {expected_count} (drift from 02-01-SUMMARY.md)"
)

print(f"CAL-01: holiday count {payload['count']} matches pinned {expected_count}")
PYEOF

(cd cli && uv run pytest tests/test_calendar_json.py -q)
echo "CAL-01: PASS"

# ---------------------------------------------------------------------------
# CAL-02 / CAL-03: both implementations, reading only the vendored JSON
# ---------------------------------------------------------------------------
echo "-- CAL-02 / CAL-03: both bizdays implementations"

test -f web/src/lib/bizdays.ts
test -f cli/apollo_cli/bizdays.py

grep -q 'anbima-calendar\.json' web/src/lib/bizdays.ts
grep -q 'anbima-calendar\.json' cli/apollo_cli/bizdays.py

if grep -rn --include='*.py' --include='*.ts' --include='*.svelte' -E '^[^#/]*Calendar\.load' cli/ shared/ web/src/; then
  echo "FAIL: Calendar.load(...) found in shipped code (algorithmic calendar forbidden)" >&2
  exit 1
fi

if grep -nE '(date-holidays|febraban-bank-holidays|workalendar)' web/package.json cli/pyproject.toml; then
  echo "FAIL: a holiday-computing package was added" >&2
  exit 1
fi

# Loud-failure proof: moving the vendored JSON out of the way must break the
# Python import. A trap restores it unconditionally, even on abort.
CALENDAR_MOVED=0
restore_calendar() {
  if [ "${CALENDAR_MOVED}" -eq 1 ] && [ -f "${REPO_ROOT}/shared/anbima-calendar.json.verify-bak" ]; then
    mv -f "${REPO_ROOT}/shared/anbima-calendar.json.verify-bak" "${REPO_ROOT}/shared/anbima-calendar.json"
    CALENDAR_MOVED=0
  fi
}
trap restore_calendar EXIT

mv shared/anbima-calendar.json shared/anbima-calendar.json.verify-bak
CALENDAR_MOVED=1
if (cd cli && uv run python -c "import apollo_cli.bizdays" >/dev/null 2>&1); then
  echo "FAIL: apollo_cli.bizdays imported successfully with the vendored calendar missing" >&2
  restore_calendar
  trap - EXIT
  exit 1
fi
restore_calendar
trap - EXIT
(cd cli && uv run python -c "import apollo_cli.bizdays" >/dev/null 2>&1) || {
  echo "FAIL: apollo_cli.bizdays failed to import after the vendored calendar was restored" >&2
  exit 1
}
echo "CAL-02 / CAL-03: PASS"

# ---------------------------------------------------------------------------
# CAL-04: cross-runtime parity
# ---------------------------------------------------------------------------
echo "-- CAL-04: cross-runtime parity"

# Scoped to `src` (web/e2e/*.spec.ts are Playwright specs added in Phase 4,
# incompatible with bun's native test runner) and to `-m "not live"` (this is
# an OFFLINE parity gate, per this echo's own "no network" framing -- the
# unscoped `pytest -q` this used to run would, now that later phases have
# added `@pytest.mark.live` modules, re-run the ENTIRE live suite including
# CRUD, auth-rejection, routine-job, cross-user-isolation and interrupted-job
# tests every time CAL-04 runs, none of which this gate is about).
(cd web && bun test src)
(cd cli && uv run pytest -q -m "not live")

if grep -rnE '"op"\s*:' web/src/lib/bizdays.test.ts cli/tests/test_bizdays.py; then
  echo "FAIL: test-case data inlined in a consumer instead of the shared fixture" >&2
  exit 1
fi

uv run --project cli python - "${EXPECTED_MIN_FIXTURE_CASES}" "${EXPECTED_MIN_ERROR_CASES}" <<'PYEOF'
import json
import sys

min_cases = int(sys.argv[1])
min_errors = int(sys.argv[2])

with open("shared/bizdays.testcases.json", encoding="utf-8") as f:
    cases = json.load(f)

assert len(cases) >= min_cases, f"only {len(cases)} cases, expected >= {min_cases}"

ids = [c["id"] for c in cases]
assert len(ids) == len(set(ids)), "duplicate case ids"

error_count = 0
for c in cases:
    has_expected = "expected" in c
    has_error = "error" in c
    assert has_expected != has_error, f"case {c['id']!r} must have exactly one of expected/error"
    if has_error:
        error_count += 1

assert error_count >= min_errors, f"only {error_count} error cases, expected >= {min_errors}"

print(f"CAL-04: {len(cases)} fixture cases, {error_count} error cases, all ids unique")
PYEOF
echo "CAL-04: PASS"

# ---------------------------------------------------------------------------
# CAL-05: manual regeneration path, never runtime-invoked
# ---------------------------------------------------------------------------
echo "-- CAL-05: manual regeneration path"

uv run --project cli python shared/scripts/update_calendar.py --check
CAL05_DIRTY="$(git status --porcelain shared/anbima-calendar.json)"
if [ -n "${CAL05_DIRTY}" ]; then
  echo "FAIL: shared/anbima-calendar.json was modified by --check" >&2
  exit 1
fi

if grep -rn --include='*.py' --include='*.ts' --include='*.svelte' -E '^[^#/]*update_calendar' cli/apollo_cli/ web/src/ shared/instant.schema.ts shared/instant.perms.ts; then
  echo "FAIL: update_calendar is referenced from a runtime path" >&2
  exit 1
fi

if grep -nE '^[^#]*\b(import|from)\s+(requests|urllib|http|socket|aiohttp)\b' shared/scripts/update_calendar.py; then
  echo "FAIL: update_calendar.py imports a networking module" >&2
  exit 1
fi
echo "CAL-05: PASS"

# ---------------------------------------------------------------------------
# Quality gates (extended Python scope + web toolchain)
# ---------------------------------------------------------------------------
echo "-- Quality gates: extended ruff/ty scope + web toolchain"

(cd cli && uv run ruff check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ruff format --check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ty check . ../shared/scripts)
(cd web && bun run check)
(cd web && bun run lint)
(cd web && bun run format:check)
echo "Quality gates: PASS"

echo "PHASE 02 VERIFIED"
