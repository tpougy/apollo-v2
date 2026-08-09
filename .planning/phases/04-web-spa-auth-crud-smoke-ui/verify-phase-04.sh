#!/usr/bin/env bash
# Re-runs every WEB-01 through WEB-10 gate for Phase 4 (web SPA auth + CRUD +
# smoke UI) in one command, plus the C-08 quality gates and the T-04-02/
# T-04-03 threat mitigations. Exits 0 and prints "PHASE 04 VERIFIED" as its
# final line only if every gate passes.
#
# On a NORMAL run this never sends a magic-code email: it reuses the
# already-persisted storageState at web/e2e/.auth/user.json (mirroring how
# verify-phase-03.sh reuses the CLI's persisted session without
# re-authenticating). A full re-proof of WEB-01 (the real magic-code round
# trip itself) requires the `setup` Playwright project, which DOES send a
# real email to tp@rbrasset.com.br -- that project is opt-in behind
# --with-magic-code / VERIFY_MAGIC_CODE=1 so this script never spams the
# user's inbox on every run.
#
# Never creates a record it does not delete: the e2e specs it invokes clean
# up their own `phase04-e2e-` prefixed fixtures, and this script asserts
# zero such records remain afterward.
#
# Usage:
#   bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
#   VERIFY_MAGIC_CODE=1 bash .../verify-phase-04.sh   # also re-proves the
#                                                       # real magic-code send
#   bash .../verify-phase-04.sh --with-magic-code       # same as above
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

echo "== Phase 4 verification starting in ${REPO_ROOT} =="

# ---------------------------------------------------------------------------
# C-08 quality gates (ROADMAP SC-5; pre-stages Phase 6 VERIFY-03)
# ---------------------------------------------------------------------------
echo "-- C-08: web/ quality gates (check, lint, format:check, build, test)"

(cd web && bun run check)
(cd web && bun run lint)
(cd web && bun run format:check)
(cd web && bun run build)
(cd web && bun run test)

echo "C-08: PASS"

# ---------------------------------------------------------------------------
# Suppression gate: zero lint/type suppression markers under web/src, web/e2e
# ---------------------------------------------------------------------------
echo "-- Suppression gate: zero lint/type suppressions in web/src, web/e2e"

# Built from parts so this gate's own source text (which necessarily names
# the markers it looks for) never matches itself -- the same self-match trap
# Phase 3's test_cli_surface.py had to avoid.
MARKER_BIOME_IGNORE="biome-$(printf 'ignore')"
MARKER_TS_EXPECT="@ts-$(printf 'expect-error')"
MARKER_TS_IGNORE="@ts-$(printf 'ignore')"
MARKER_ESLINT_DISABLE="eslint-$(printf 'disable')"

THIS_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
SUPPRESSIONS="$(
  grep -rn \
    -e "${MARKER_BIOME_IGNORE}" \
    -e "${MARKER_TS_EXPECT}" \
    -e "${MARKER_TS_IGNORE}" \
    -e "${MARKER_ESLINT_DISABLE}" \
    web/src web/e2e 2>/dev/null \
    | grep -vF "$(basename "${THIS_SCRIPT}")" \
    || true
)"
if [ -n "${SUPPRESSIONS}" ]; then
  echo "FAIL: suppression gate: lint/type suppression markers found: ${SUPPRESSIONS}" >&2
  exit 1
fi

echo "Suppression gate: PASS"

# ---------------------------------------------------------------------------
# T-04-02: admin-token confinement + no @instantdb/admin in the browser bundle
# ---------------------------------------------------------------------------
echo "-- T-04-02: admin-token confinement (tracked files + built bundle)"

ADMIN_TOKEN_VALUE="$(grep '^INSTANT_APP_ADMIN_TOKEN=' .env.instantdb | cut -d= -f2-)"
if [ -z "${ADMIN_TOKEN_VALUE}" ]; then
  echo "FAIL: T-04-02: could not read INSTANT_APP_ADMIN_TOKEN from .env.instantdb" >&2
  exit 1
fi

LEAKED_TRACKED="$(git ls-files -z | xargs -0 grep -lF "${ADMIN_TOKEN_VALUE}" 2>/dev/null || true)"
if [ -n "${LEAKED_TRACKED}" ]; then
  echo "FAIL: T-04-02: admin token value found in tracked file(s): ${LEAKED_TRACKED}" >&2
  exit 1
fi

if [ -d web/dist ] && grep -rlF "${ADMIN_TOKEN_VALUE}" web/dist >/dev/null 2>&1; then
  echo "FAIL: T-04-02: admin token value found in built web/dist" >&2
  exit 1
fi

if grep -rn "@instantdb/admin" web/src >/dev/null 2>&1; then
  echo "FAIL: T-04-02: @instantdb/admin referenced from web/src (browser bundle)" >&2
  exit 1
fi

echo "T-04-02: PASS"

# ---------------------------------------------------------------------------
# T-04-03: donoId confined to EntityScreen.svelte's owner-id injection path
# ---------------------------------------------------------------------------
echo "-- T-04-03: donoId confinement"

DONOID_LEAKS="$(grep -rn "donoId" web/src | grep -v EntityScreen.svelte || true)"
if [ -n "${DONOID_LEAKS}" ]; then
  echo "FAIL: T-04-03: donoId referenced outside EntityScreen.svelte: ${DONOID_LEAKS}" >&2
  exit 1
fi

echo "T-04-03: PASS"

# ---------------------------------------------------------------------------
# WEB-01 / WEB-10: real magic-code auth substrate + no admin-token defence
# ---------------------------------------------------------------------------
echo "-- WEB-01 / WEB-10: magic-code auth substrate"

AUTH_STATE_FILE="web/e2e/.auth/user.json"

if [ "${WITH_MAGIC_CODE}" = "1" ]; then
  echo "   (--with-magic-code / VERIFY_MAGIC_CODE=1: re-proving the real magic-code send)"
  (cd web && bunx playwright test --project=setup)
fi

if [ ! -f "${AUTH_STATE_FILE}" ]; then
  echo "FAIL: WEB-01: ${AUTH_STATE_FILE} is missing -- run 'bun run test:e2e:auth' (the setup" >&2
  echo "  project) first to perform a real magic-code login and persist the session." >&2
  exit 1
fi

AUTHED_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${AUTHED_OUTPUT_FILE}"' EXIT

if ! (cd web && bunx playwright test --project=authed --no-deps) >"${AUTHED_OUTPUT_FILE}" 2>&1; then
  cat "${AUTHED_OUTPUT_FILE}" >&2
  if grep -qiE "not authenticated|unauthorized|401|please.*login|auth" "${AUTHED_OUTPUT_FILE}"; then
    echo "FAIL: WEB-01: the 'authed' project failed with what looks like an auth error --" >&2
    echo "  run 'bun run test:e2e:auth' (the setup project) to refresh ${AUTH_STATE_FILE}." >&2
  else
    echo "FAIL: WEB-01/WEB-02..WEB-09: the 'authed' Playwright project failed" >&2
  fi
  exit 1
fi
cat "${AUTHED_OUTPUT_FILE}"

echo "WEB-01 / WEB-10: PASS"

# ---------------------------------------------------------------------------
# WEB-02..WEB-09: all four entity spec files actually executed
# ---------------------------------------------------------------------------
echo "-- WEB-02..WEB-09: all entity spec files executed"

REQUIRED_SPECS=(
  "entities-fundos.spec.ts"
  "entities-projeto-etapa-tarefa.spec.ts"
  "entities-ticket-subtarefa.spec.ts"
  "entities-rotina-log.spec.ts"
)
for spec in "${REQUIRED_SPECS[@]}"; do
  if ! grep -qF "${spec}" "${AUTHED_OUTPUT_FILE}"; then
    echo "FAIL: WEB-02..WEB-09: expected spec file '${spec}' did not appear in the 'authed'" >&2
    echo "  Playwright run output -- it may have been silently renamed or skipped." >&2
    exit 1
  fi
done

ANON_OUTPUT_FILE="$(mktemp)"
if ! (cd web && bunx playwright test --project=anon) >"${ANON_OUTPUT_FILE}" 2>&1; then
  cat "${ANON_OUTPUT_FILE}" >&2
  rm -f "${ANON_OUTPUT_FILE}"
  echo "FAIL: WEB-10: the 'anon' Playwright project (no-leakage.spec.ts) failed" >&2
  exit 1
fi
rm -f "${ANON_OUTPUT_FILE}"

echo "WEB-02..WEB-09: PASS"

# ---------------------------------------------------------------------------
# Cleanliness: repo untouched, zero phase04-e2e- records left in the live app
# ---------------------------------------------------------------------------
echo "-- Cleanliness: git status + zero phase04-e2e- records in the live app"

# Scoped to this phase's own surface (web/, shared/, this phase directory)
# rather than the whole repo: unrelated pre-existing untracked scratch state
# elsewhere in the repo (outside Phase 4's scope) must never make this gate
# fail -- it exists to catch dirt THIS run produces, not to police the whole
# working tree.
PORCELAIN="$(git status --porcelain -- web shared .planning/phases/04-web-spa-auth-crud-smoke-ui)"
if [ -n "${PORCELAIN}" ]; then
  echo "FAIL: cleanliness: git status --porcelain (scoped to web/, shared/, this phase dir)" >&2
  echo "  is not empty:" >&2
  echo "${PORCELAIN}" >&2
  exit 1
fi

LEFTOVER_COUNT="$(
  {
    uv run --project cli apollo fundo listar
    uv run --project cli apollo projeto listar
    uv run --project cli apollo etapa listar
    uv run --project cli apollo tarefa listar
    uv run --project cli apollo ticket listar
    uv run --project cli apollo subtarefa listar
    uv run --project cli apollo rotina template listar
    uv run --project cli apollo rotina instancia listar
    uv run --project cli apollo log-inferencia listar
  } | uv run --project cli python -c '
import json
import sys

total = 0
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    records = json.loads(line)
    for r in records:
        text = json.dumps(r)
        if "phase04-e2e-" in text:
            total += 1
print(total)
'
)"
if [ "${LEFTOVER_COUNT}" != "0" ]; then
  echo "FAIL: cleanliness: ${LEFTOVER_COUNT} phase04-e2e- record(s) left behind in the live app" >&2
  exit 1
fi

echo "Cleanliness: PASS"

echo "PHASE 04 VERIFIED"
