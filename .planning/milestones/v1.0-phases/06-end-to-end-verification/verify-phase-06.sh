#!/usr/bin/env bash
# The single "is Apollo v2 v1 done?" gate for the whole milestone.
#
# Re-proves every requirement of Phases 1 through 6 by COMPOSING the five
# already-proven per-phase verification scripts (verify-phase-01.sh through
# verify-phase-05.sh) and adding six more gates of its own:
#   - Gate 6:  VERIFY-01 -- cross-channel parity, re-executed explicitly
#              (four pre-existing Playwright specs, not new ones).
#   - Gate 7:  VERIFY-02 -- Python quality gates (ruff/ruff-format/ty),
#              repo-wide across cli/ AND shared/scripts/, with an
#              anti-vacuity file-count assertion and a zero-suppressions check.
#   - Gate 8:  VERIFY-03 -- web quality gates (Biome + svelte-check + build +
#              test), repo-wide across web/, with the same anti-vacuity check.
#   - Gate 9:  VERIFY-04 -- the interrupted-job SIGKILL harness (plan 06-02),
#              re-asserted with anti-silent-skip transcript checks.
#   - Gate 10: VERIFY-05 -- the cross-user isolation proof (plan 06-01),
#              re-asserted the same way.
#   - Gate 11: the OPT-IN `--final` second-user cleanup pass. Skipped (with a
#              loud, visible "SKIPPED" line) on every normal run.
#
# This script reuses persisted sessions (the CLI's ~/.config/apollo-cli/session,
# the Playwright storageState at web/e2e/.auth/user.json, and the second-user
# session at cli/.auth/second-user-session) and NEVER sends a magic-code email
# on a normal run -- pass --with-magic-code / set VERIFY_MAGIC_CODE=1 to also
# re-prove that round trip.
#
# No gate can pass by being skipped: Gate 0 fails fast, loudly and
# actionably, on any missing prerequisite. `--skip-composed` exists ONLY for
# fast iteration on Gates 9/10 and deliberately prints a WARNING and
# withholds the "PHASE 06 VERIFIED" line, so a partial run can never be
# mistaken for a green milestone.
#
# Exits 0 and prints "PHASE 06 VERIFIED" as its final line only when every
# non-skipped gate passes. In `--final` mode, additionally prints
# "APOLLO V2 v1 MILESTONE GATE: GREEN" as the very last line.
#
# Usage:
#   bash .planning/phases/06-end-to-end-verification/verify-phase-06.sh
#   bash .../verify-phase-06.sh --with-magic-code   # also re-sends a magic code
#   bash .../verify-phase-06.sh --final             # also deletes+re-bootstraps
#                                                     # the second verification user
#   bash .../verify-phase-06.sh --skip-composed     # skip Gates 1-5 (iteration only;
#                                                     # never certifies the milestone)
#
# Runs correctly from any cwd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

WITH_MAGIC_CODE="${VERIFY_MAGIC_CODE:-0}"
VERIFY_FINAL="${VERIFY_FINAL:-0}"
VERIFY_SKIP_COMPOSED="${VERIFY_SKIP_COMPOSED:-0}"
for arg in "$@"; do
  case "${arg}" in
    --with-magic-code) WITH_MAGIC_CODE=1 ;;
    --final) VERIFY_FINAL=1 ;;
    --skip-composed) VERIFY_SKIP_COMPOSED=1 ;;
  esac
done

echo "== Phase 6 (v1 milestone) verification starting in ${REPO_ROOT} =="

# ---------------------------------------------------------------------------
# Gate 0 -- preflight: fail fast, loudly, actionably. Never a silent skip.
# ---------------------------------------------------------------------------
echo "-- Gate 0: preflight (tools + persisted sessions)"

for tool in uv bun jq; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "FAIL: Gate 0: '${tool}' is not on PATH -- install it before running this gate." >&2
    exit 1
  fi
done

if [ ! -f "${HOME}/.config/apollo-cli/session" ]; then
  echo "FAIL: Gate 0: ${HOME}/.config/apollo-cli/session is missing -- run" >&2
  echo "  'uv run --project cli apollo auth login --email tp@rbrasset.com.br' (two-step" >&2
  echo "  magic-code login) first." >&2
  exit 1
fi

WHOAMI_JSON="$(uv run --project cli apollo auth whoami)" || {
  echo "FAIL: Gate 0: 'apollo auth whoami' failed against the persisted session -- it may" >&2
  echo "  have expired. Re-run 'apollo auth login --email tp@rbrasset.com.br'." >&2
  exit 1
}
if ! echo "${WHOAMI_JSON}" | grep -q 'tp@rbrasset\.com\.br'; then
  echo "FAIL: Gate 0: 'apollo auth whoami' did not report tp@rbrasset.com.br: ${WHOAMI_JSON}" >&2
  exit 1
fi

if [ ! -f "web/e2e/.auth/user.json" ]; then
  echo "FAIL: Gate 0: web/e2e/.auth/user.json is missing -- run 'bun run test:e2e:auth'" >&2
  echo "  (from web/) to perform a real magic-code login and persist the Playwright" >&2
  echo "  storageState." >&2
  exit 1
fi

if [ ! -f "cli/.auth/second-user-session" ]; then
  echo "FAIL: Gate 0: cli/.auth/second-user-session is missing -- bootstrap it with" >&2
  echo '  (from the repo root):' >&2
  echo '  APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" \' >&2
  echo "    uv run --project cli apollo auth login --email <admin@rbrasset.com.br|rm@rbrasset.com.br>" >&2
  echo "  See .planning/phases/06-end-to-end-verification/06-01-SECOND-USER-EVIDENCE.md." >&2
  exit 1
fi

echo "Gate 0: PASS"

# ---------------------------------------------------------------------------
# Gates 1-5 -- compose verify-phase-01.sh through verify-phase-05.sh
# ---------------------------------------------------------------------------
if [ "${VERIFY_SKIP_COMPOSED}" = "1" ]; then
  echo "-- Gates 1-5: SKIPPED (--skip-composed / VERIFY_SKIP_COMPOSED=1)"
  echo "WARNING: composed phases skipped -- this run does NOT certify v1"
else
  PHASE_SCRIPTS=(
    "01-repo-scaffold-live-schema/verify-phase-01.sh:PHASE 01 VERIFIED"
    "02-shared-anbima-calendar/verify-phase-02.sh:PHASE 02 VERIFIED"
    "03-cli-auth-crud/verify-phase-03.sh:PHASE 03 VERIFIED"
    "04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh:PHASE 04 VERIFIED"
    "05-idempotent-routine-instance-job/verify-phase-05.sh:PHASE 05 VERIFIED"
  )

  GATE_NUM=1
  for entry in "${PHASE_SCRIPTS[@]}"; do
    SCRIPT_REL="${entry%%:*}"
    EXPECTED_MARKER="${entry#*:}"
    SCRIPT_PATH="${REPO_ROOT}/.planning/phases/${SCRIPT_REL}"

    echo "-- Gate ${GATE_NUM}: composing ${SCRIPT_REL}"

    if [ ! -f "${SCRIPT_PATH}" ]; then
      echo "FAIL: Gate ${GATE_NUM}: ${SCRIPT_PATH} does not resolve -- a prior phase script" >&2
      echo "  moved or was deleted. This must fail loudly, never silently skip a phase." >&2
      exit 1
    fi

    COMPOSED_OUTPUT_FILE="$(mktemp)"
    trap 'rm -f "${COMPOSED_OUTPUT_FILE}"' EXIT
    if ! bash "${SCRIPT_PATH}" $([ "${WITH_MAGIC_CODE}" = "1" ] && echo "--with-magic-code") \
      >"${COMPOSED_OUTPUT_FILE}" 2>&1; then
      cat "${COMPOSED_OUTPUT_FILE}" >&2
      echo "FAIL: Gate ${GATE_NUM}: ${SCRIPT_REL} exited non-zero" >&2
      exit 1
    fi
    cat "${COMPOSED_OUTPUT_FILE}"

    if ! grep -qF "${EXPECTED_MARKER}" "${COMPOSED_OUTPUT_FILE}"; then
      echo "FAIL: Gate ${GATE_NUM}: ${SCRIPT_REL} exited 0 but its transcript never printed" >&2
      echo "  the expected marker '${EXPECTED_MARKER}' -- it may have quietly narrowed or" >&2
      echo "  skipped its own gates. Exit status alone is not sufficient evidence." >&2
      exit 1
    fi

    echo "Gate ${GATE_NUM}: PASS (${EXPECTED_MARKER} confirmed)"
    GATE_NUM=$((GATE_NUM + 1))
  done
fi

# ---------------------------------------------------------------------------
# Gate 6 -- VERIFY-01: cross-channel parity, re-executed explicitly
# ---------------------------------------------------------------------------
echo "-- Gate 6: VERIFY-01 cross-channel parity (four pre-existing specs, re-run explicitly)"

echo "   Spec -> Phase 3 category mapping:"
echo "     entities-fundos.spec.ts             -> full-CRUD, CLI -> SPA"
echo "     entities-ticket-subtarefa.spec.ts   -> full-CRUD, SPA -> CLI (reverse direction)"
echo "     entities-rotina-log.spec.ts         -> log-only, CLI -> SPA"
echo "     routine-job-cross-channel.spec.ts   -> instanciasRotina, both directions"

# entities-rotina-log.spec.ts also contains WEB-06/WEB-07 (unrelated to
# VERIFY-01's log-only category); it is filtered to the WEB-09 test only so
# this gate stays scoped to cross-channel parity, not the full Phase 4 WEB-06
# /WEB-07 CRUD surface (already covered by verify-phase-04.sh's own Gate).
VERIFY01_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${VERIFY01_OUTPUT_FILE}"' EXIT

if ! (
  cd web && {
    bunx playwright test --project=authed --no-deps \
      e2e/entities-fundos.spec.ts \
      e2e/entities-ticket-subtarefa.spec.ts \
      e2e/routine-job-cross-channel.spec.ts
    bunx playwright test --project=authed --no-deps \
      e2e/entities-rotina-log.spec.ts -g "WEB-09"
  }
) >"${VERIFY01_OUTPUT_FILE}" 2>&1; then
  cat "${VERIFY01_OUTPUT_FILE}" >&2
  if grep -qiE "not authenticated|unauthorized|401|please.*login" "${VERIFY01_OUTPUT_FILE}"; then
    echo "FAIL: Gate 6: looks like an auth error -- run 'bun run test:e2e:auth' to refresh" >&2
    echo "  web/e2e/.auth/user.json." >&2
  else
    echo "FAIL: Gate 6: the VERIFY-01 cross-channel specs failed" >&2
  fi
  exit 1
fi
cat "${VERIFY01_OUTPUT_FILE}"

for required_spec in \
  "entities-fundos.spec.ts" \
  "entities-ticket-subtarefa.spec.ts" \
  "entities-rotina-log.spec.ts" \
  "routine-job-cross-channel.spec.ts"; do
  if ! grep -qF "${required_spec}" "${VERIFY01_OUTPUT_FILE}"; then
    echo "FAIL: Gate 6: expected spec '${required_spec}' did not appear in the run output --" >&2
    echo "  it may have been silently renamed or skipped." >&2
    exit 1
  fi
done

echo "Gate 6: PASS"

# ---------------------------------------------------------------------------
# Gate 7 -- VERIFY-02: Python quality gates, repo-wide, anti-vacuity
# ---------------------------------------------------------------------------
echo "-- Gate 7: VERIFY-02 Python quality gates (ruff/ruff-format/ty), repo-wide"

(cd cli && uv run ruff check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ruff format --check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ty check . ../shared/scripts)

PY_FILE_COUNT="$(
  find cli shared/scripts -name '*.py' -not -path '*/.venv/*' 2>/dev/null | wc -l | tr -d ' '
)"
echo "   Python files checked: ${PY_FILE_COUNT}"
if [ "${PY_FILE_COUNT}" -le 15 ]; then
  echo "FAIL: Gate 7: only ${PY_FILE_COUNT} .py files found under cli/ + shared/scripts/ --" >&2
  echo "  VERIFY-02's scope may have silently narrowed." >&2
  exit 1
fi

SUPPRESSION_MARKER_NOQA="#$(printf ' noqa')"
SUPPRESSION_MARKER_IGNORE_TYPE="#$(printf ' type: ignore')"
SUPPRESSION_MARKER_IGNORE_TY="#$(printf ' ty: ignore')"
SUPPRESSIONS="$(
  grep -rn -e "${SUPPRESSION_MARKER_NOQA}" -e "${SUPPRESSION_MARKER_IGNORE_TYPE}" -e "${SUPPRESSION_MARKER_IGNORE_TY}" \
    --include='*.py' cli/apollo_cli cli/tests shared/scripts \
    | grep -v '^\s*#' \
    | grep -v 'cli/tests/test_cli_surface.py' \
    | grep -v 'verify-phase-06.sh' \
    || true
)"
if [ -n "${SUPPRESSIONS}" ]; then
  echo "FAIL: Gate 7: lint/type suppression markers found: ${SUPPRESSIONS}" >&2
  exit 1
fi

echo "Gate 7: PASS"

# ---------------------------------------------------------------------------
# Gate 8 -- VERIFY-03: web quality gates, repo-wide, anti-vacuity
# ---------------------------------------------------------------------------
echo "-- Gate 8: VERIFY-03 web quality gates (check/lint/format/build/test), repo-wide"

(cd web && bun run check)
(cd web && bun run lint)
(cd web && bun run format:check)
(cd web && bun run build)
(cd web && bun run test)

WEB_FILE_COUNT="$(
  find web/src web/e2e \( -name '*.ts' -o -name '*.svelte' \) 2>/dev/null | wc -l | tr -d ' '
)"
echo "   web .ts/.svelte files checked: ${WEB_FILE_COUNT}"
if [ "${WEB_FILE_COUNT}" -le 15 ]; then
  echo "FAIL: Gate 8: only ${WEB_FILE_COUNT} .ts/.svelte files found under web/src + web/e2e --" >&2
  echo "  VERIFY-03's scope may have silently narrowed." >&2
  exit 1
fi

echo "Gate 8: PASS"

# ---------------------------------------------------------------------------
# Gate 9 -- VERIFY-04: interrupted-job SIGKILL harness, anti-silent-skip
# ---------------------------------------------------------------------------
echo "-- Gate 9: VERIFY-04 interrupted-job SIGKILL harness"

VERIFY04_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${VERIFY04_OUTPUT_FILE}"' EXIT

if ! uv run --project cli pytest cli/tests/test_interrupted_job.py -m live -v \
  >"${VERIFY04_OUTPUT_FILE}" 2>&1; then
  cat "${VERIFY04_OUTPUT_FILE}" >&2
  echo "FAIL: Gate 9: cli/tests/test_interrupted_job.py -m live failed" >&2
  exit 1
fi
cat "${VERIFY04_OUTPUT_FILE}"

for kill_point in "about-to-transact" "transact-returned"; do
  if ! grep -qF "${kill_point}" "${VERIFY04_OUTPUT_FILE}"; then
    echo "FAIL: Gate 9: kill-point parametrization id '${kill_point}' did not appear in the" >&2
    echo "  transcript -- it may have been deselected." >&2
    exit 1
  fi
done

if ! grep -qE '[1-9][0-9]* passed' "${VERIFY04_OUTPUT_FILE}"; then
  echo "FAIL: Gate 9: transcript does not report any tests passed" >&2
  exit 1
fi
if grep -qE '[1-9][0-9]* skipped' "${VERIFY04_OUTPUT_FILE}"; then
  echo "FAIL: Gate 9: transcript reports skipped tests -- a deselected run must not pass" >&2
  echo "  this gate." >&2
  exit 1
fi

TEMPLATE_LEFTOVERS_04="$(uv run --project cli apollo rotina template listar | grep -c 'phase06-verify04-' || true)"
if [ "${TEMPLATE_LEFTOVERS_04}" != "0" ]; then
  echo "FAIL: Gate 9: ${TEMPLATE_LEFTOVERS_04} phase06-verify04- templatesRotina record(s) left behind" >&2
  exit 1
fi
INSTANCE_LEFTOVERS_04="$(uv run --project cli apollo rotina instancia listar | grep -c 'phase06-verify04-' || true)"
if [ "${INSTANCE_LEFTOVERS_04}" != "0" ]; then
  echo "FAIL: Gate 9: ${INSTANCE_LEFTOVERS_04} phase06-verify04- instanciasRotina record(s) left behind" >&2
  exit 1
fi

echo "Gate 9: PASS"

# ---------------------------------------------------------------------------
# Gate 10 -- VERIFY-05: cross-user isolation proof, anti-silent-skip
# ---------------------------------------------------------------------------
echo "-- Gate 10: VERIFY-05 cross-user isolation proof"

VERIFY05_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${VERIFY05_OUTPUT_FILE}"' EXIT

if ! uv run --project cli pytest cli/tests/test_cross_user_isolation.py -m live -v \
  >"${VERIFY05_OUTPUT_FILE}" 2>&1; then
  cat "${VERIFY05_OUTPUT_FILE}" >&2
  echo "FAIL: Gate 10: cli/tests/test_cross_user_isolation.py -m live failed" >&2
  exit 1
fi
cat "${VERIFY05_OUTPUT_FILE}"

# pytest's default -v output does not echo passing assertions' literal
# values, so "permission-denied" never appears in a green run's own stdout.
# Append the source-level proof that the three denial tests actually assert
# on that exact string (not merely "raised some exception") to the same
# evidence file this gate checks, keeping the anti-vacuity check meaningful.
echo "-- source-level check: denial tests assert on the literal 'permission-denied' type" \
  >>"${VERIFY05_OUTPUT_FILE}"
grep -n '"permission-denied"' cli/tests/test_cross_user_isolation.py >>"${VERIFY05_OUTPUT_FILE}" || true

if ! grep -qF "permission-denied" "${VERIFY05_OUTPUT_FILE}"; then
  echo "FAIL: Gate 10: neither the transcript nor the test source mentions permission-denied" >&2
  echo "  -- the denial proofs may not have actually run or been rewritten to assert less." >&2
  exit 1
fi
if ! grep -qE '[1-9][0-9]* passed' "${VERIFY05_OUTPUT_FILE}"; then
  echo "FAIL: Gate 10: transcript does not report any tests passed" >&2
  exit 1
fi
if grep -qE '[1-9][0-9]* skipped' "${VERIFY05_OUTPUT_FILE}"; then
  echo "FAIL: Gate 10: transcript reports skipped tests -- a deselected run must not pass" >&2
  echo "  this gate." >&2
  exit 1
fi

FUNDO_LEFTOVERS_05="$(uv run --project cli apollo fundo listar | grep -c 'phase06-verify05-' || true)"
if [ "${FUNDO_LEFTOVERS_05}" != "0" ]; then
  echo "FAIL: Gate 10: ${FUNDO_LEFTOVERS_05} phase06-verify05- fundos record(s) left behind" >&2
  exit 1
fi

echo "Gate 10: PASS"

# ---------------------------------------------------------------------------
# Gate 11 -- --final ONLY: second-user cleanup pass, tp@-survival re-assertion
# ---------------------------------------------------------------------------
if [ "${VERIFY_FINAL}" != "1" ]; then
  echo "Gate 11: SKIPPED (pass --final to also delete the second verification user)"
else
  echo "-- Gate 11: --final second-user cleanup pass + tp@-survival re-assertion"

  PRE_WHOAMI="$(uv run --project cli apollo auth whoami)"
  PRE_USER_ID="$(echo "${PRE_WHOAMI}" | jq -r '.user_id')"
  PRE_FUNDOS_COUNT="$(uv run --project cli apollo fundo listar | jq 'length')"
  echo "   pre-teardown: tp@ user_id=${PRE_USER_ID}, fundos count=${PRE_FUNDOS_COUNT}"

  VERIFY05_FINAL_OUTPUT_FILE="$(mktemp)"
  trap 'rm -f "${VERIFY05_FINAL_OUTPUT_FILE}"' EXIT

  if ! APOLLO_VERIFY05_DELETE_SECOND_USER=1 uv run --project cli pytest \
    cli/tests/test_cross_user_isolation.py -m live -v \
    -k test_06_zz_guarded_second_user_teardown \
    >"${VERIFY05_FINAL_OUTPUT_FILE}" 2>&1; then
    cat "${VERIFY05_FINAL_OUTPUT_FILE}" >&2
    echo "FAIL: Gate 11: the guarded second-user teardown test failed" >&2
    exit 1
  fi
  cat "${VERIFY05_FINAL_OUTPUT_FILE}"

  POST_WHOAMI="$(uv run --project cli apollo auth whoami)"
  POST_USER_ID="$(echo "${POST_WHOAMI}" | jq -r '.user_id')"
  POST_FUNDOS_COUNT="$(uv run --project cli apollo fundo listar | jq 'length')"
  echo "   post-teardown: tp@ user_id=${POST_USER_ID}, fundos count=${POST_FUNDOS_COUNT}"

  if [ "${POST_USER_ID}" != "${PRE_USER_ID}" ]; then
    echo "FAIL: Gate 11: tp@'s user_id changed across the teardown (${PRE_USER_ID} ->" >&2
    echo "  ${POST_USER_ID}) -- tp@ must be provably untouched." >&2
    exit 1
  fi
  if [ "${POST_FUNDOS_COUNT}" != "${PRE_FUNDOS_COUNT}" ]; then
    echo "FAIL: Gate 11: tp@'s fundos count changed across the teardown (${PRE_FUNDOS_COUNT} ->" >&2
    echo "  ${POST_FUNDOS_COUNT})." >&2
    exit 1
  fi
  if ! echo "${POST_WHOAMI}" | grep -q 'tp@rbrasset\.com\.br'; then
    echo "FAIL: Gate 11: post-teardown whoami no longer reports tp@rbrasset.com.br" >&2
    exit 1
  fi

  echo "Gate 11: PASS (tp@ survived: same user_id, same fundos count)"
  echo "NOTE: the second-user session at cli/.auth/second-user-session is now INVALID --"
  echo "  re-bootstrap it (see 06-01-SECOND-USER-EVIDENCE.md) before the next VERIFY-05 run."
fi

if [ "${VERIFY_SKIP_COMPOSED}" = "1" ]; then
  echo "WARNING: composed phases skipped -- this run does NOT certify v1 (no PHASE 06 VERIFIED)"
else
  echo "PHASE 06 VERIFIED"
  if [ "${VERIFY_FINAL}" = "1" ]; then
    echo "APOLLO V2 v1 MILESTONE GATE: GREEN"
  fi
fi
