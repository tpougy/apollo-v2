#!/usr/bin/env bash
# Re-runs every CLI-01 through CLI-11 gate for Phase 3 (CLI auth + CRUD) in
# one command, plus the C-08 quality gates. Exits 0 and prints
# "PHASE 03 VERIFIED" as its final line only if every gate passes.
#
# Never sends a magic code and never authenticates with the admin token — it
# asserts the already-persisted real session at ~/.config/apollo-cli/session
# works, per plan 03-01's evidence. Never leaves a junk record behind in the
# live InstantDB app (a trap cleans up temp files; the guest/mismatched-owner
# probes are denied by design and create nothing). Safe to run twice in a
# row, from any cwd.
#
# Usage: bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

echo "== Phase 3 verification starting in ${REPO_ROOT} =="

# Pinned drift-guard: the real InstantDB user_id proven end-to-end in plan
# 03-01's live magic-code round trip (see 03-01-SUMMARY.md /
# 03-01-LOGIN-EVIDENCE.md), for tp@rbrasset.com.br. If this ever drifts, the
# session at ~/.config/apollo-cli/session was regenerated for a different
# user and every later gate's premise ("the same real authenticated user")
# needs re-checking.
EXPECTED_USER_ID="adf0d402-06df-4406-a5c7-ce82ee1bcb7e"

# ---------------------------------------------------------------------------
# Cleanup trap: temp files only. The live write-based probes below are all
# *denied* by design (permission-denied) so they create nothing to clean up.
# ---------------------------------------------------------------------------
TMP_FILES=()
cleanup() {
  local exit_code=$?
  for f in "${TMP_FILES[@]:-}"; do
    [ -n "${f:-}" ] && rm -f "${f}"
  done
  # `${TMP_FILES[@]:-}` on an empty array still yields one empty word, so the
  # loop's last command is `[ -n "" ]` (exit 1) even when nothing needed
  # cleaning up. Without capturing/restoring the real exit code, this trap
  # silently turned every successful run of this script into a non-zero
  # exit -- while still printing "PHASE 03 VERIFIED" -- undetected until
  # verify-phase-06.sh started checking exit status, not just transcript
  # markers.
  return "${exit_code}"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# CLI-01: magic-code auth substrate, session hardening, evidence file
# ---------------------------------------------------------------------------
echo "-- CLI-01: apollo auth whoami against the persisted live session"

WHOAMI_JSON="$(uv run --project cli apollo auth whoami)"
echo "${WHOAMI_JSON}" | grep -q "\"user_id\": \"${EXPECTED_USER_ID}\"" || {
  echo "FAIL: apollo auth whoami did not report the pinned user_id ${EXPECTED_USER_ID}: ${WHOAMI_JSON}" >&2
  exit 1
}

SESSION_FILE="${HOME}/.config/apollo-cli/session"
SESSION_DIR="${HOME}/.config/apollo-cli"
test -f "${SESSION_FILE}"
SESSION_FILE_MODE="$(stat -c '%a' "${SESSION_FILE}")"
SESSION_DIR_MODE="$(stat -c '%a' "${SESSION_DIR}")"
[ "${SESSION_FILE_MODE}" = "600" ] || {
  echo "FAIL: session file mode is ${SESSION_FILE_MODE}, expected 600" >&2
  exit 1
}
[ "${SESSION_DIR_MODE}" = "700" ] || {
  echo "FAIL: session dir mode is ${SESSION_DIR_MODE}, expected 700" >&2
  exit 1
}

test -f .planning/phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md

echo "CLI-01: PASS"

# ---------------------------------------------------------------------------
# CLI-02..CLI-06, CLI-08, CLI-09: live full-CRUD pytest modules per entity
# ---------------------------------------------------------------------------
echo "-- CLI-02: apollo fundo CRUD"
(cd cli && uv run pytest tests/test_crud_fundo.py -q)
echo "CLI-02: PASS"

echo "-- CLI-03: apollo projeto CRUD"
(cd cli && uv run pytest tests/test_crud_projeto.py -q)
echo "CLI-03: PASS"

echo "-- CLI-04: apollo etapa CRUD"
(cd cli && uv run pytest tests/test_crud_etapa.py -q)
echo "CLI-04: PASS"

echo "-- CLI-05: apollo tarefa CRUD"
(cd cli && uv run pytest tests/test_crud_tarefa.py -q)
echo "CLI-05: PASS"

echo "-- CLI-06: apollo rotina template CRUD"
(cd cli && uv run pytest tests/test_crud_rotina_template.py -q)
echo "CLI-06: PASS"

# ---------------------------------------------------------------------------
# CLI-07: apollo rotina instancia is list+status-only (never create/delete)
# ---------------------------------------------------------------------------
echo "-- CLI-07: apollo rotina instancia (list+status only, never create/delete)"

(cd cli && uv run pytest tests/test_rotina_instancia.py -q)

INSTANCIA_HELP="$(uv run --project cli apollo rotina instancia --help)"
INSTANCIA_CMDS="$(printf '%s\n' "${INSTANCIA_HELP}" | awk '/^Commands:/{found=1; next} found && NF {print $1}' | sort)"
EXPECTED_INSTANCIA_CMDS="$(printf 'listar\nstatus\n' | sort)"
[ "${INSTANCIA_CMDS}" = "${EXPECTED_INSTANCIA_CMDS}" ] || {
  echo "FAIL: apollo rotina instancia --help command set drifted from {listar, status}: ${INSTANCIA_CMDS}" >&2
  exit 1
}

# NOTE: this gate originally also asserted `apollo rotina --help` did NOT
# mention `gerar-instancias`, since that command was explicitly out of scope
# for Phase 3 (JOB-02, added for real by Phase 5). That assertion was
# time-bound to "before Phase 5 exists" and would now permanently fail this
# script for every run composed after Phase 5 shipped its own
# `apollo rotina gerar-instancias` command -- a legitimate later addition,
# not a Phase 3 regression. Removed rather than left to rot; JOB-02's actual
# behavior is proven by Phase 5's own verify-phase-05.sh.

echo "CLI-07: PASS"

echo "-- CLI-08: apollo ticket CRUD"
(cd cli && uv run pytest tests/test_crud_ticket.py -q)
echo "CLI-08: PASS"

echo "-- CLI-09: apollo subtarefa CRUD"
(cd cli && uv run pytest tests/test_crud_subtarefa.py -q)
echo "CLI-09: PASS"

# ---------------------------------------------------------------------------
# CLI-10: apollo log-inferencia registrar|listar (append-only)
# ---------------------------------------------------------------------------
echo "-- CLI-10: apollo log-inferencia registrar|listar"
(cd cli && uv run pytest tests/test_log_inferencia.py -q)
echo "CLI-10: PASS"

# ---------------------------------------------------------------------------
# CLI-11: permission-denied on writes (never proven via an empty query)
# ---------------------------------------------------------------------------
echo "-- CLI-11: guest/mismatched-donoId writes are denied; admin token confined"

(cd cli && uv run pytest tests/test_auth_rejection.py -q)

# Independent live guest-write probe (does not rely on the pytest module
# above having actually executed a real network call — this is a second,
# freestanding proof run directly by this script).
GUEST_PROBE_OUTPUT="$(uv run --project cli python - <<'PYEOF'
import json

from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.config import load_instant_config
from apollo_cli.crud_helpers import now_iso

config = load_instant_config()
client = Instant(app_id=config.app_id, admin_token="").as_user(guest=True)
try:
    client.transact(
        client.tx.fundos[new_id()].create(
            {
                "nome": "verify-phase-03 guest probe (never persisted)",
                "codigo": "VERIFY-PHASE-03-GUEST-PROBE",
                "ativo": True,
                "createdAt": now_iso(),
                "donoId": "anyone",
            }
        )
    )
    print(json.dumps({"denied": False}))
except InstantAPIError as error:
    body = error.body if isinstance(error.body, dict) else {}
    print(json.dumps({"denied": True, "type": body.get("type")}))
PYEOF
)"

echo "${GUEST_PROBE_OUTPUT}" | grep -q '"denied": true' || {
  echo "FAIL: live guest-write probe did not raise an error at all: ${GUEST_PROBE_OUTPUT}" >&2
  exit 1
}
echo "${GUEST_PROBE_OUTPUT}" | grep -q '"type": "permission-denied"' || {
  echo "FAIL: live guest-write probe did not report permission-denied: ${GUEST_PROBE_OUTPUT}" >&2
  exit 1
}

if grep -rn --include='*.py' 'INSTANT_APP_ADMIN_TOKEN' cli/apollo_cli/ | grep -v instant_client.py | grep -v config.py; then
  echo "FAIL: INSTANT_APP_ADMIN_TOKEN is referenced outside instant_client.py/config.py" >&2
  exit 1
fi

echo "CLI-11: PASS"

# ---------------------------------------------------------------------------
# Quality gates (C-08): ruff, ruff format, ty, zero suppressions
# ---------------------------------------------------------------------------
echo "-- Quality gates: ruff/ruff-format/ty across cli/ and shared/scripts/, zero suppressions"

(cd cli && uv run ruff check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ruff format --check --config pyproject.toml . ../shared/scripts)
(cd cli && uv run ty check . ../shared/scripts)

SUPPRESSION_MARKER_NOQA="#$(printf ' noqa')"
SUPPRESSION_MARKER_IGNORE="#$(printf ' type: ignore')"
SUPPRESSIONS="$(
  grep -rn -e "${SUPPRESSION_MARKER_NOQA}" -e "${SUPPRESSION_MARKER_IGNORE}" \
    --include='*.py' cli/apollo_cli cli/tests \
    | grep -v 'cli/tests/test_cli_surface.py' \
    || true
)"
if [ -n "${SUPPRESSIONS}" ]; then
  echo "FAIL: lint/type suppression markers found: ${SUPPRESSIONS}" >&2
  exit 1
fi

echo "Quality gates: PASS"

# ---------------------------------------------------------------------------
# Idempotency / no-junk-left-behind proof
# ---------------------------------------------------------------------------
echo "-- Idempotency: no test-prefixed junk left in the live app"

LEFTOVER_COUNT="$(
  uv run --project cli apollo fundo listar \
    | uv run --project cli python -c '
import json
import sys

records = json.load(sys.stdin)
prefixes = (
    "Fundo Teste",
    "Renomeado",
    "Guest Probe",
    "Fake Token Probe",
    "Mismatched Owner Probe",
    "Invalid Session Probe",
    "verify-phase-03",
)
leftover = [r for r in records if any(r.get("nome", "").startswith(p) for p in prefixes)]
print(len(leftover))
'
)"
[ "${LEFTOVER_COUNT}" = "0" ] || {
  echo "FAIL: ${LEFTOVER_COUNT} test-prefixed fundo record(s) left behind in the live app" >&2
  exit 1
}

echo "Idempotency: PASS"

echo "PHASE 03 VERIFIED"
