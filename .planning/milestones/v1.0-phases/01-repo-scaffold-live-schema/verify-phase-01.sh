#!/usr/bin/env bash
# Re-runs every SETUP-01 through SETUP-08 gate for Phase 1 (repo scaffold +
# live schema) in one command. Exits 0 and prints "PHASE 01 VERIFIED" as its
# final line only if every gate passes. Never echoes the InstantDB app id or
# admin token — only pass/fail and non-secret diagnostics.
#
# Usage: bash .planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh
# Runs correctly from any cwd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

echo "== Phase 1 verification starting in ${REPO_ROOT} =="

# ---------------------------------------------------------------------------
# SETUP-01: locked monorepo layout, .env.instantdb present/gitignored/untracked,
# no tracked file contains the admin token value.
# ---------------------------------------------------------------------------
echo "-- SETUP-01: monorepo layout + secret hygiene"

test -d shared
test -d web
test -d cli
test -f .env.instantdb
test -f shared/instant.schema.ts
test -f shared/instant.perms.ts
test -d web/src/lib
test -f web/src/lib/bizdays.ts || true # bizdays.ts lands in Phase 2; do not hard-fail Phase 1 on it
test -d cli/apollo_cli

git check-ignore -q .env.instantdb
if git ls-files --error-unmatch .env.instantdb >/dev/null 2>&1; then
  echo "FAIL: .env.instantdb is tracked by git" >&2
  exit 1
fi

ADMIN_TOKEN_VALUE="$(grep '^INSTANT_APP_ADMIN_TOKEN=' .env.instantdb | cut -d= -f2-)"
if [ -z "${ADMIN_TOKEN_VALUE}" ]; then
  echo "FAIL: could not read INSTANT_APP_ADMIN_TOKEN from .env.instantdb" >&2
  exit 1
fi
LEAKED_FILES="$(git ls-files -z | xargs -0 grep -lF "${ADMIN_TOKEN_VALUE}" 2>/dev/null || true)"
if [ -n "${LEAKED_FILES}" ]; then
  echo "FAIL: admin token value found in tracked file(s): ${LEAKED_FILES}" >&2
  exit 1
fi
echo "SETUP-01: PASS"

# ---------------------------------------------------------------------------
# SETUP-02: cli/ is a uv-managed Python 3.12 package with entrypoint `apollo`.
# ---------------------------------------------------------------------------
echo "-- SETUP-02: cli/ uv package + apollo entrypoint"
(cd cli && uv sync)
(cd cli && uv run apollo --help >/dev/null)
(cd cli && uv run apollo --version >/dev/null)
echo "SETUP-02: PASS"

# ---------------------------------------------------------------------------
# SETUP-03: web/ is a bun-managed pure Svelte 5 + Vite SPA (no SvelteKit).
# ---------------------------------------------------------------------------
echo "-- SETUP-03: web/ bun SPA (no SvelteKit)"
(cd web && bun install)
(cd web && bun run build >/dev/null)
test ! -d web/src/routes
if grep -q '@sveltejs/kit' web/package.json; then
  echo "FAIL: @sveltejs/kit present in web/package.json" >&2
  exit 1
fi
echo "SETUP-03: PASS"

# ---------------------------------------------------------------------------
# SETUP-04: ruff + ty clean on cli/.
# ---------------------------------------------------------------------------
echo "-- SETUP-04: cli/ ruff + ty"
(cd cli && uv run ruff check .)
(cd cli && uv run ruff format --check .)
(cd cli && uv run ty check)
echo "SETUP-04: PASS"

# ---------------------------------------------------------------------------
# SETUP-05: Biome + svelte-check clean on web/ (and shared/ via Biome).
# ---------------------------------------------------------------------------
echo "-- SETUP-05: web/ Biome + svelte-check"
(cd web && bun run lint)
(cd web && bun run format:check)
(cd web && bun run check)
JS_FILES="$(find web/src shared -name '*.js' -not -path '*/node_modules/*' 2>/dev/null || true)"
if [ -n "${JS_FILES}" ]; then
  echo "FAIL: .js file(s) found under web/src or shared: ${JS_FILES}" >&2
  exit 1
fi
echo "SETUP-05: PASS"

# ---------------------------------------------------------------------------
# SETUP-06: apollo doctor works; built dist/ contains the app id and does NOT
# contain the admin token.
# ---------------------------------------------------------------------------
echo "-- SETUP-06: apollo doctor + built bundle secret hygiene"
(cd cli && uv run apollo doctor >/dev/null)

APP_ID_VALUE="$(grep '^NEXT_PUBLIC_INSTANT_APP_ID=' .env.instantdb | cut -d= -f2-)"
if [ -z "${APP_ID_VALUE}" ]; then
  echo "FAIL: could not read NEXT_PUBLIC_INSTANT_APP_ID from .env.instantdb" >&2
  exit 1
fi
if ! grep -qF "${APP_ID_VALUE}" web/dist/assets/*.js; then
  echo "FAIL: built web/dist/ does not contain the InstantDB app id" >&2
  exit 1
fi
if grep -qF "${ADMIN_TOKEN_VALUE}" web/dist/assets/*.js 2>/dev/null; then
  echo "FAIL: built web/dist/ contains the admin token value" >&2
  exit 1
fi
echo "SETUP-06: PASS"

# ---------------------------------------------------------------------------
# SETUP-07: shared/instant.schema.ts pushed live — pull and confirm entities.
# ---------------------------------------------------------------------------
echo "-- SETUP-07: live schema round-trip"
(cd web && bun run instant:verify >/dev/null)

REQUIRED_ENTITIES=(fundos projetos etapas tarefas templatesRotina instanciasRotina tickets subtarefas logInferenciaClaude)
for entity in "${REQUIRED_ENTITIES[@]}"; do
  if ! grep -q "${entity}: i.entity" web/.instant-verify/instant.schema.ts; then
    echo "FAIL: live schema is missing entity ${entity}" >&2
    exit 1
  fi
done
echo "SETUP-07: PASS"

# ---------------------------------------------------------------------------
# SETUP-08: shared/instant.perms.ts pushed live with donoId rules; guest write
# is rejected server-side.
# ---------------------------------------------------------------------------
echo "-- SETUP-08: live perms round-trip + guest-write denial"
if ! grep -q 'auth.id == data.donoId' web/.instant-verify/instant.perms.ts; then
  echo "FAIL: live perms missing 'auth.id == data.donoId'" >&2
  exit 1
fi
if ! grep -q 'auth.id == newData.donoId' web/.instant-verify/instant.perms.ts; then
  echo "FAIL: live perms missing 'auth.id == newData.donoId'" >&2
  exit 1
fi

# A guest READ cannot prove enforcement: InstantDB's `view` rule denials are
# evaluated per-row and silently filter disallowed rows out of a query result,
# so a guest query against an app with zero rows exits 0 with `[]` regardless
# of whether perms are enforced. Only a WRITE produces a real pass/fail signal
# (InstantDB rejects the whole transaction on a permission failure). See
# 01-01-SUMMARY.md "Substituted a write-based guest-rejection test" and
# guest-write-check.mjs alongside this script.
GUEST_WRITE_OUTPUT="$(cd web && bun run "${SCRIPT_DIR}/guest-write-check.mjs" 2>&1)" || {
  echo "FAIL: guest-write-check.mjs did not exit 0 (expected rejection, got an error running the probe itself)" >&2
  echo "${GUEST_WRITE_OUTPUT}" >&2
  exit 1
}
if ! echo "${GUEST_WRITE_OUTPUT}" | grep -q '^RESULT=EXPECTED_REJECTION$'; then
  echo "FAIL: guest write was not rejected — permission rules may have regressed" >&2
  echo "${GUEST_WRITE_OUTPUT}" >&2
  exit 1
fi
echo "SETUP-08: PASS"

echo "PHASE 01 VERIFIED"
