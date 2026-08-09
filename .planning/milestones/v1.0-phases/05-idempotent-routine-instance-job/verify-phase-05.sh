#!/usr/bin/env bash
# Re-runs every JOB-01/JOB-02 gate for Phase 5 (idempotent routine-instance
# job) in one command, plus the C-08 quality gates and the T-05-02/T-05-34/
# T-05-35/T-05-36/T-05-37 threat mitigations. Exits 0 and prints
# "PHASE 05 VERIFIED" as its final line only if every gate passes.
#
# What this proves:
#   - The routine-instance generation job (`runRoutineInstanceJob` in
#     web/src/lib/routineJob.ts, `run_routine_instance_job` in
#     cli/apollo_cli/routine_job.py, both triggered by
#     `apollo rotina gerar-instancias`) never duplicates, never deletes.
#   - Both channels interoperate: records one channel writes are recognized
#     by the other (ROADMAP SC-4).
#   - The non-duplication guarantee holds under GENUINE process-level
#     concurrency, traced to the live `instanciasRotina.dedupeKey.unique()`
#     schema constraint, not merely to the app-level query-before-write diff.
#
# What this deliberately does NOT prove:
#   - The real magic-code email round trip itself (WEB-01/CLI-01) -- that is
#     Phase 3/4's scope, re-proved by their own verify-phase-0N.sh scripts.
#     This script REUSES the already-persisted CLI session
#     (~/.config/apollo-cli/session) and Playwright storageState
#     (web/e2e/.auth/user.json) and never sends a magic-code email on a
#     normal run. Pass --with-magic-code / set VERIFY_MAGIC_CODE=1 to also
#     re-prove that round trip (sends a real email to tp@rbrasset.com.br).
#
# Never creates a record it does not delete: every e2e/live test this script
# invokes cleans up its own `phase05-`-prefixed fixtures, and this script
# asserts zero such records remain afterward -- failing loudly, never
# skipping a gate whose prerequisites are missing.
#
# Usage:
#   bash .planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
#   VERIFY_MAGIC_CODE=1 bash .../verify-phase-05.sh   # also re-proves the
#                                                       # real magic-code send
#   bash .../verify-phase-05.sh --with-magic-code       # same as above
#
# Runs correctly from any cwd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

WITH_MAGIC_CODE="${VERIFY_MAGIC_CODE:-0}"
for arg in "$@"; do
  if [ "${arg}" = "--with-magic-code" ]; then
    WITH_MAGIC_CODE=1
  fi
done

echo "== Phase 5 verification starting in ${REPO_ROOT} =="

# ---------------------------------------------------------------------------
# Gate 1 -- C-08 quality gates
# ---------------------------------------------------------------------------
echo "-- Gate 1: C-08 quality gates (web check/lint/format/build, cli ruff/ty)"

(cd web && bun run check)
(cd web && bun run lint)
(cd web && bun run format:check)
(cd web && bun run build)
uv run --project cli ruff check cli
uv run --project cli ty check cli

echo "Gate 1: PASS"

# ---------------------------------------------------------------------------
# Gate 2 -- schema gate: live pull confirms offsetDias + dedupeKey.unique()
# ---------------------------------------------------------------------------
echo "-- Gate 2: schema gate (bun run instant:verify, live pull)"

(cd web && bun run instant:verify)

PULLED_SCHEMA="web/.instant-verify/instant.schema.ts"
if [ ! -f "${PULLED_SCHEMA}" ]; then
  echo "FAIL: Gate 2: ${PULLED_SCHEMA} was not produced by instant:verify" >&2
  exit 1
fi

if ! grep -q "offsetDias" "${PULLED_SCHEMA}"; then
  echo "FAIL: Gate 2: live schema no longer declares templatesRotina.offsetDias" >&2
  exit 1
fi

DEDUPE_KEY_LINE="$(grep 'dedupeKey' "${PULLED_SCHEMA}" || true)"
if [ -z "${DEDUPE_KEY_LINE}" ]; then
  echo "FAIL: Gate 2: live schema no longer declares dedupeKey at all" >&2
  exit 1
fi
if ! echo "${DEDUPE_KEY_LINE}" | grep -q "unique"; then
  echo "FAIL: Gate 2: live schema's dedupeKey attribute no longer carries unique() -- the" >&2
  echo "  server-side guarantee the whole concurrency proof depends on: ${DEDUPE_KEY_LINE}" >&2
  exit 1
fi

echo "Gate 2: PASS (offsetDias present, dedupeKey unique() confirmed live)"

# ---------------------------------------------------------------------------
# Gate 3 -- offline parity gate: TS/Python twins agree, no network
# ---------------------------------------------------------------------------
echo "-- Gate 3: offline parity (bun test src, pytest -m 'not live')"

(cd web && bun test src)
uv run --project cli pytest cli/tests -m "not live"

echo "Gate 3: PASS"

# ---------------------------------------------------------------------------
# Gate 4 -- live CLI gate: idempotency + cross-channel + concurrency proofs
# ---------------------------------------------------------------------------
echo "-- Gate 4: live CLI gate (test_routine_job.py + test_routine_job_parity.py)"

uv run --project cli pytest \
  cli/tests/test_routine_job.py \
  cli/tests/test_routine_job_parity.py \
  -m live

echo "Gate 4: PASS"

# ---------------------------------------------------------------------------
# Gate 5 -- live SPA gate: routine job + cross-channel e2e specs
# ---------------------------------------------------------------------------
echo "-- Gate 5: live SPA gate (routine job + cross-channel e2e specs)"

AUTH_STATE_FILE="web/e2e/.auth/user.json"

if [ "${WITH_MAGIC_CODE}" = "1" ]; then
  echo "   (--with-magic-code / VERIFY_MAGIC_CODE=1: re-proving the real magic-code send)"
  (cd web && bunx playwright test --project=setup)
fi

if [ ! -f "${AUTH_STATE_FILE}" ]; then
  echo "FAIL: Gate 5: ${AUTH_STATE_FILE} is missing -- run 'bun run test:e2e:auth' (the setup" >&2
  echo "  project) first to perform a real magic-code login and persist the session." >&2
  exit 1
fi

SPA_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${SPA_OUTPUT_FILE}"' EXIT

if ! (cd web && bunx playwright test --project=authed --no-deps -g "routine job|cross-channel") \
  >"${SPA_OUTPUT_FILE}" 2>&1; then
  cat "${SPA_OUTPUT_FILE}" >&2
  if grep -qiE "not authenticated|unauthorized|401|please.*login|auth" "${SPA_OUTPUT_FILE}"; then
    echo "FAIL: Gate 5: the 'authed' project failed with what looks like an auth error --" >&2
    echo "  run 'bun run test:e2e:auth' (the setup project) to refresh ${AUTH_STATE_FILE}." >&2
  else
    echo "FAIL: Gate 5: the live SPA e2e specs failed" >&2
  fi
  exit 1
fi
cat "${SPA_OUTPUT_FILE}"

for required_spec in "routine-job.spec.ts" "routine-job-cross-channel.spec.ts"; do
  if ! grep -qF "${required_spec}" "${SPA_OUTPUT_FILE}"; then
    echo "FAIL: Gate 5: expected spec file '${required_spec}' did not appear in the run output" >&2
    echo "  -- it may have been silently renamed or skipped." >&2
    exit 1
  fi
done

echo "Gate 5: PASS"

# ---------------------------------------------------------------------------
# Gate 6 -- prohibition gates: no delete path, no admin token in the job,
# no @instantdb/admin in the shipped browser bundle
# ---------------------------------------------------------------------------
echo "-- Gate 6: prohibition gates (no delete path, no admin token, no admin SDK in dist)"

# routineJob.ts's ONLY `.delete(` occurrences are two Set.delete() calls in
# the encadeado topological sweep (`pendingIds.delete(template.id)`) -- an
# in-memory bookkeeping set, unrelated to any InstantDB write. They are
# filtered out by name (not by line-comment stripping, since they are real
# code) so this gate stays a true negative control for an ACTUAL InstantDB
# delete path, which would show up as anything else matching `.delete(`.
TS_DELETE_HITS="$(
  grep -v '^\s*\*\|^\s*//' web/src/lib/routineJob.ts \
    | grep '\.delete(' \
    | grep -v 'pendingIds\.delete(' \
    || true
)"
if [ -n "${TS_DELETE_HITS}" ]; then
  echo "FAIL: Gate 6: unexpected .delete( in web/src/lib/routineJob.ts: ${TS_DELETE_HITS}" >&2
  exit 1
fi

PY_DELETE_HITS="$(grep -v '^\s*#' cli/apollo_cli/routine_job.py | grep '\.delete(' || true)"
if [ -n "${PY_DELETE_HITS}" ]; then
  echo "FAIL: Gate 6: unexpected .delete( in cli/apollo_cli/routine_job.py: ${PY_DELETE_HITS}" >&2
  exit 1
fi

PY_ADMIN_HITS="$(
  grep -v '^\s*#' cli/apollo_cli/routine_job.py \
    | grep -E 'login_client|admin_token' \
    || true
)"
if [ -n "${PY_ADMIN_HITS}" ]; then
  echo "FAIL: Gate 6: cli/apollo_cli/routine_job.py references login_client/admin_token: ${PY_ADMIN_HITS}" >&2
  exit 1
fi

if [ -d web/dist ] && grep -rn "@instantdb/admin" web/dist >/dev/null 2>&1; then
  echo "FAIL: Gate 6: @instantdb/admin found in the built web/dist bundle" >&2
  exit 1
fi

echo "Gate 6: PASS"

# ---------------------------------------------------------------------------
# Gate 7 -- leftover gate: zero phase05- prefixed records remain live
# ---------------------------------------------------------------------------
echo "-- Gate 7: leftover gate (zero phase05- records in the live app)"

TEMPLATE_LEFTOVERS="$(uv run --project cli apollo rotina template listar | grep -c 'phase05-' || true)"
if [ "${TEMPLATE_LEFTOVERS}" != "0" ]; then
  echo "FAIL: Gate 7: ${TEMPLATE_LEFTOVERS} phase05- templatesRotina record(s) left behind" >&2
  exit 1
fi

INSTANCE_LEFTOVERS="$(uv run --project cli apollo rotina instancia listar | grep -c 'phase05-' || true)"
if [ "${INSTANCE_LEFTOVERS}" != "0" ]; then
  echo "FAIL: Gate 7: ${INSTANCE_LEFTOVERS} phase05- instanciasRotina record(s) left behind" >&2
  exit 1
fi

echo "Gate 7: PASS"

echo "PHASE 05 VERIFIED"
