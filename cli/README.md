# apollo-cli

Apollo v2's Python CLI (`apollo`) — the AI-operated channel with full parity
with the web SPA. Every write operation available in the browser is also
available here, authenticated as the same real user under the same InstantDB
permission rules (see `../.planning/PROJECT.md` constraint C-05).

## Install

```bash
cd cli
uv sync
```

`uv` provisions and pins Python 3.12 itself (`cli/.python-version`) — never
invoke a bare `python3`/`pip` in this package.

## Run

```bash
uv run apollo --help
uv run apollo --version
uv run apollo doctor
```

`apollo doctor` resolves the repo-root `.env.instantdb` file (by walking
upward from the package's own location) regardless of the caller's current
working directory, and reports whether the InstantDB app id and admin token
are present — without ever printing either value in full.

## Quality gates

A Python file in this package is not done until all three of these exit 0 — run
from `cli/`, and always covering `shared/scripts/` alongside `cli/` itself:

```bash
uv run ruff check --config pyproject.toml . ../shared/scripts
uv run ruff format --check --config pyproject.toml . ../shared/scripts
uv run ty check . ../shared/scripts
```

`--config pyproject.toml` is required on the ruff commands whenever a path outside
`cli/` (such as `../shared/scripts`) is passed alongside `.`: ruff discovers
configuration by walking up from *each file being linted*, and neither `shared/`
nor the repo root has a `[tool.ruff]` section, so without an explicit `--config`
flag, files under `../shared/scripts` would silently fall back to ruff's defaults
and miss this project's `extend-select = ["I", "ANN"]` rules. `ty check` does not
have this problem — it resolves `cli/pyproject.toml`'s `[tool.ty]` settings by
walking up from the project root regardless of which paths are passed, so no extra
flag is needed there (confirmed via `uv run ty check --help`: a `--project <PATH>`
flag exists for pinning a different project root explicitly, but the default
walk-up behavior already covers `../shared/scripts` correctly).

These are the same three commands Phase 6's VERIFY-02/VERIFY-03 will run — do not
let this scope silently shrink back to `uv run ruff check .` with no `shared/scripts`
argument in future changes.

## Tests

```bash
uv run pytest
uv run pytest tests/test_bizdays.py -x
```

`uv run pytest` (no arguments) discovers and runs every test under `cli/tests/`,
including `test_calendar_json.py` (CAL-01 structural gate, which validates the
vendored `../shared/anbima-calendar.json` produced by
`../shared/scripts/update_calendar.py`) and `test_bizdays.py` (CAL-02/03/04
cross-runtime parity gate, driven by the shared fixture at
`../shared/bizdays.testcases.json`). See the repo-root `README.md` for
`update_calendar.py`'s regeneration command.

## About the admin token

`.env.instantdb` (at the repo root) may contain `INSTANT_APP_ADMIN_TOKEN`.
That token is for `instant-cli` schema/permission pushes only (developer
tooling, run from `web/`) — it bypasses every InstantDB permission rule and
is **deliberately never read by this CLI's runtime**. `apollo doctor` reports
only whether the token is present in the file, never its value, and no other
code path in `apollo_cli` touches it.

The *only* other place this CLI reads that token at all is inside
`apollo auth login` (via `apollo_cli/instant_client.py`'s `login_client()`),
because completing a magic-code login requires an admin-capable client to
verify the code server-side. It is never used for `fundo`, `projeto`,
`etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina`, or `log-inferencia` — nor
for `auth whoami`/`auth logout`. Every one of those goes through
`session_client()`, which impersonates the authenticated user and carries no
admin token, ever, even if `INSTANT_APP_ADMIN_TOKEN` is set in the process
environment. This confinement is enforced by an automated structural test
(`cli/tests/test_auth_rejection.py::test_admin_token_confinement`), and
independently re-checked by `verify-phase-03.sh`'s CLI-11 gate on every run.

## Autenticação

Magic-code login is a two-step flow:

```bash
apollo auth login --email voce@exemplo.com
# {"status": "code_sent", "email": "...", "next": "apollo auth login --email ... --code <codigo-do-email>"}

# read the numeric code from the email that arrives, then:
apollo auth login --email voce@exemplo.com --code 123456
# {"status": "logged_in", "user_id": "...", "email": "...", "created": false, "session_file": "..."}
```

Supplying `--code` on the *first* call skips sending a new code — do not
pass `--email ... --code ...` speculatively before a code has actually been
sent, since InstantDB magic codes are short-lived (observed ~60-90s) and a
premature verify attempt burns the one code that was about to arrive without
sending a replacement.

`apollo auth whoami` re-verifies the persisted session against the live
InstantDB app (never trusts local file contents alone) and prints the
authenticated `user_id`/`email`. `apollo auth logout` is **local-only** — it
deletes the session file and never calls out to InstantDB; there is no
server-side session to revoke in this flow.

## Sessão

- Default path: `~/.config/apollo-cli/session`, a `0700` directory containing
  a `0600` JSON file (re-tightened on every write, even if the file already
  existed with looser permissions).
- Contents: `user_id`, `email`, and a long-lived InstantDB refresh token —
  the CLI's equivalent of the browser SDK's `localStorage` session. Never
  print, log, or commit this file.
- `APOLLO_SESSION_FILE` overrides the session path — used by this package's
  own tests (and available to anyone scripting an isolated/parallel session)
  so a test run never touches your real session file.
- Never share or commit this file; anyone holding it can act as the
  authenticated user against the live InstantDB app until it is rotated by
  logging in again.

## Saída e códigos de saída

Every `apollo` command prints exactly one JSON document to stdout on
success. Errors are also exactly one JSON document, printed to **stderr**
instead of stdout, paired with a specific process exit code:

| Exit code | Meaning |
|-----------|---------|
| `0` | Success |
| `1` | No session, or a corrupt/unparsable session file (`apollo auth login` first) |
| `2` | Click usage error — bad/missing flag, invalid choice, invalid date, etc. |
| `3` | InstantDB API error, including `permission-denied` and `not_found`/`parent_not_found` guards |
| `4` | Network error reaching InstantDB |

## Superfície de comandos

```
apollo auth            login | logout | whoami
apollo doctor
apollo fundo           criar | editar | deletar | listar
apollo projeto         criar | editar | deletar | listar
apollo etapa           criar | editar | deletar | listar
apollo tarefa          criar | editar | deletar | listar
apollo ticket          criar | editar | deletar | listar
apollo subtarefa       criar | editar | deletar | listar
apollo rotina template  criar | editar | deletar | listar
apollo rotina instancia listar | status
apollo rotina gerar-instancias
apollo log-inferencia   registrar | listar
```

`apollo rotina instancia` is deliberately **list+status-only** — no
`criar`/`deletar` — because instances exist only to satisfy the Phase 5
idempotent generation job's `dedupeKey` invariant; a hand-created or
hand-re-dated instance would desynchronize from that key and cause the next
job run to create a duplicate. `apollo rotina gerar-instancias` (the job
trigger, at the top level of the `rotina` group, not under `instancia`) is
the ONLY sanctioned creator of `instanciasRotina` records.

`apollo log-inferencia` is **append-only** — `registrar`/`listar` only, no
`editar`/`deletar` — so the user can always audit Claude's past inferences.

### `apollo rotina gerar-instancias`

Runs the idempotent routine-instance generation job (Phase 5, JOB-02): queries the
authenticated user's active `templatesRotina` and existing `instanciasRotina`, computes the
expected set for `[--data-base (default: today), end of next month]`, and writes — via a
lookup-keyed upsert on `dedupeKey` — only the instances that do not already exist. Never
duplicates, never deletes.

| Flag | Meaning |
|---|---|
| `--data-base YYYY-MM-DD` | Overrides "today" for the range computation. Omit to use the real current UTC date. |
| `--dry-run` / `--no-dry-run` | `--dry-run` performs every query and the full diff but writes nothing, reporting the same JSON shape with the would-be keys under `created`. Defaults to `--no-dry-run`. |

Emits exactly one JSON document: `{"created": [...], "existing": [...], "skipped": [...]}`, all
three lists of `dedupeKey`/skip-entries sorted.

**Skip-reason table** — a misconfigured or unresolvable template is reported, never crashed on,
and never blocks any other template from generating:

| Reason | Generation type(s) | What the operator should do |
|---|---|---|
| `tipo_geracao_desconhecido` | any | Fix `--tipo-geracao` to one of `du_fixo`/`corrido_fixo`/`encadeado` via `apollo rotina template editar`. |
| `offset_dias_ausente` | all | Set `--offset-dias` on the template — it is required for every generation type. |
| `offset_dias_invalido` | all | Set `--offset-dias` to an integer within range: >= 1 for `du_fixo`/`corrido_fixo`, >= 0 for `encadeado`. A value that pushes the computed date past the vendored ANBIMA calendar's range also lands here. |
| `regra_competencia_nao_suportada` | `du_fixo`, `corrido_fixo` | Set `--regra-competencia` to one of `M0`/`M-1`/`M-2`/`M+1` (encadeado templates never hit this — their `regraCompetencia` is never consulted, D-05-D in `README.md`). |
| `antecessor_ausente` | `encadeado` | Set `--antecessor-id` to an existing `templatesRotina` id. |
| `antecessor_sem_instancia` | `encadeado` | The antecessor template has no instance yet (computed this run or persisted) for any competencia — run the job again once the antecessor itself has generated at least one instance. |
| `antecessor_ciclico` | `encadeado` | The antecessor chain never resolves within the sweep bound — a genuine cycle (A -> B -> A) or a chain through a dangling antecessor id. Break the cycle by editing one template's `--antecessor-id`. |

## Verificação

```bash
bash ../.planning/phases/03-cli-auth-crud/verify-phase-03.sh
bash ../.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
```

(from `cli/`; or with the full path from the repo root — each script resolves its own location
and `cd`s to the repo root regardless of the caller's cwd). `verify-phase-03.sh` exits `0` and
prints `PHASE 03 VERIFIED` as its final line only when every one of CLI-01..CLI-11 plus the
ruff/ruff-format/ty/zero-suppression quality gates pass, re-running twice in a row without
leaving any test record behind in the live app. `verify-phase-05.sh` does the same for
JOB-01/JOB-02 — the idempotent `gerar-instancias` job, its cross-channel recognition in both
directions, and its genuine-concurrency non-duplication proof — printing `PHASE 05 VERIFIED`
on success. Neither script sends a magic code or authenticates with the admin token by
default — both re-verify the session already persisted by a prior `apollo auth login`.
