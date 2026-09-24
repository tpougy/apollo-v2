# Quick Task 260924-f7m: Research

**Researched:** 2026-09-24
**Domain:** Docs sync (fundo->entidade rename) + new `apollo init <path>` CLI command
**Confidence:** HIGH (all findings are direct file reads this session; zero external packages)

## Summary

This is a code/config-only task inside an already-mature monorepo — no new external
dependency, no ecosystem research needed. The two deliverables are (1) a mechanical
find/replace pass over `docs/ai-usage/{README,CLAUDE}.md` to catch up with the
`fundo`->`entidade` rename shipped in quick task `260922-vbt`, and (2) a new top-level
`apollo init <path>` command mirroring the existing `doctor`/`import` registration pattern
in `cli/apollo_cli/cli.py`.

All facts below are `[VERIFIED: <path>:<lines>]` against files read in full this session —
no `[ASSUMED]`/`[CITED]` claims remain except one explicit correction to a CONTEXT.md
premise (see **Correction to CONTEXT.md D3's premise** below), which the planner/user
should see before locking scope.

**Primary recommendation:** Do the doc find/replace exactly per the line-by-line diff list
below (Finding 1), register `init` in `cli.py` exactly like `import_batch`/`doctor` are
registered (Finding 2), reuse `--force/--no-force` from `rotina.py`'s `deletar` verbatim
(Finding 4), and reuse `load_session()`/`MissingSessionError` from `session.py` read-only
(Finding 3) — every piece D4 needs already has a proven in-repo precedent, nothing here
needs to be invented.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Docs terminology sync (README/CLAUDE.md) | Docs (monorepo) | CLI (vendored copy) | `docs/ai-usage/*.md` is the human-readable source; `cli/apollo_cli/data/scaffold/*.md` is a build-time vendored copy, same pattern as the ANBIMA calendar |
| `apollo init <path>` scaffold | CLI (`cli/apollo_cli/init.py`) | — | Pure local filesystem + read-only session check, no new backend surface |
| Auth status check inside `init` | CLI (`session.py`/`auth.py` reuse) | — | Read-only reuse of `load_session()`; `init` must never itself perform a login POST |

<phase_requirements>
## Phase Requirements

This is a quick task (no REQUIREMENTS.md phase IDs). CONTEXT.md's decisions D1-D5 serve as
the requirement set; each is addressed by a Finding below.

| Decision | Description | Research Support |
|----------|-------------|-------------------|
| D1 | `apollo init <path>` registered top-level in `cli.py`, logic in `cli/apollo_cli/init.py` | Finding 2 — exact registration pattern confirmed |
| D2 | Docs are source of truth; CLI vendors a byte-identical copy under `cli/apollo_cli/data/scaffold/` | Finding 5 — exact vendoring/parity-test pattern confirmed |
| D3 | Content updates: fundo->entidade rename throughout both docs | Finding 1 — exact line-by-line diff list, all instances found via full-file grep |
| D4 | `init` behavior: mkdir -p, write scaffold files with `--force` guard, read-only auth status check, JSON next-steps output | Findings 2-4 — exact flag patterns and auth mechanism confirmed |
| D5 | Live test coverage mirroring calendar parity test | Finding 6 — exact test fixture/pattern confirmed |
</phase_requirements>

## Finding 1 — Exact diff list for `docs/ai-usage/{README,CLAUDE}.md` (D3)

Verified via `grep -n -i "fundo"` over the full text of both files (both already read in
full this session) — every occurrence found, none omitted.

### `docs/ai-usage/README.md`

| Line | Current (verbatim) | Proposed replacement | Notes |
|------|---------------------|------------------------|-------|
| 4 | `pessoal para organizar fundos, projetos, rotinas e tarefas usando o` | `pessoal para organizar entidades, projetos, rotinas e tarefas usando o` | Generic prose listing domain concepts — same rename intent as CLI |
| 84 | `- Qualquer outro arquivo de apoio (notas, listas de fundos/rotinas a` | `- Qualquer outro arquivo de apoio (notas, listas de entidades/rotinas a` | |
| 91 | `os fundos/projetos/rotinas/tarefas que quer cadastrar (colar e-mails,` | `as entidades/projetos/rotinas/tarefas que quer cadastrar (colar e-mails,` | |
| 95 | `- criar as entidades na ordem certa (fundo → projeto → etapa → tarefa →` | `- criar as entidades na ordem certa (entidade → projeto → etapa → tarefa →` | The word "entidades" already appears generically here (predates the rename) — only the `(fundo → ...)` parenthetical needs the swap |
| 104 | `apollo fundo listar` | `apollo entidade listar` | Literal CLI invocation inside the "Comandos úteis" code block |
| 144 | `notas com nomes reais de fundos/clientes em texto livre, e mantenha o` | Leave as-is, OR `entidades/clientes` | **Ambiguous — flagged in Open Questions.** This is a privacy-note example of sensitive-data categories, not a CLI reference; "Fundo"/"Cliente" are literally two of the example `--tipo-entidade` values (`entidade.py:46`), so either reading is defensible |

Line 110 (`apollo <entidade> <ação> --help`) already uses the generic `<entidade>`
placeholder — `[VERIFIED: docs/ai-usage/README.md:110]` — **no change needed**, it predates
this rename and was already correct.

### `docs/ai-usage/CLAUDE.md`

| Line | Current (verbatim) | Proposed replacement | Notes |
|------|---------------------|------------------------|-------|
| 3 | `Você está ajudando o usuário a fazer o **onboarding inicial** dos fundos,` | `Você está ajudando o usuário a fazer o **onboarding inicial** das entidades,` | Lists domain entity types being onboarded |
| 5 | `controladoria de fundos. Este repositório não contém o código do Apollo; ele` | Leave as-is | **Ambiguous — flagged in Open Questions.** This describes the overall business domain ("fund-controladoria professional"), matching PROJECT.md's own unchanged framing ("Apollo v2 is ... for a fund-controladoria professional") — not a CLI/entity reference |
| 32 | `fundo` (root node of the ASCII domain-hierarchy diagram) | `entidade` | |
| 33 | ` └─ projeto (opcionalmente ligado a um fundo)` | ` └─ projeto (opcionalmente ligado a uma entidade)` | |
| 38 | `ticket (demanda avulsa, ex. e-mail recebido; opcionalmente ligado a um fundo)` | `ticket (demanda avulsa, ex. e-mail recebido; opcionalmente ligado a uma entidade)` | |
| 41 | `templatesRotina (modelo de rotina recorrente, opcionalmente ligado a um fundo)` | `templatesRotina (modelo de rotina recorrente, opcionalmente ligado a uma entidade)` | |
| 59-64 | See full block below | See full replacement block below | `apollo fundo criar` -> `apollo entidade criar`, gains `--tipo-entidade` |
| 73 | `--fundo-id TEXT (precisa já existir — use \`apollo fundo listar\` para achar o id)` | `--entidade-id TEXT (precisa já existir — use \`apollo entidade listar\` para achar o id)` | Inside `apollo projeto criar` block |
| 105 | `--fundo-id TEXT (precisa já existir)` | `--entidade-id TEXT (precisa já existir)` | Inside `apollo ticket criar` block |
| 124 | `--fundo-id TEXT` | `--entidade-id TEXT` | Inside `apollo rotina template criar` block |
| 138-139 | `1. Pergunte/receba a lista de fundos primeiro (tudo mais pode linkar a um` / `   fundo). Crie-os com \`apollo fundo criar\`.` | `1. Pergunte/receba a lista de entidades primeiro (tudo mais pode linkar a` / `   uma entidade). Crie-os com \`apollo entidade criar\`.` | |
| 141-142 | `   ele pertence a um fundo já criado; use \`apollo fundo listar\` para` / `   recuperar o \`id\` antes de usar \`--fundo-id\`.` | `   ele pertence a uma entidade já criada; use \`apollo entidade listar\` para` / `   recuperar o \`id\` antes de usar \`--entidade-id\`.` | |
| 151 | `6. Rotinas são a última coisa a cadastrar (dependem de fundo, se ligadas a` | `6. Rotinas são a última coisa a cadastrar (dependem de entidade, se ligadas a` | |
| 176 | `- Escolher um \`--fundo-id\`/\`--projeto-id\`/\`--etapa-id\` por similaridade de` | `- Escolher um \`--entidade-id\`/\`--projeto-id\`/\`--etapa-id\` por similaridade de` | |
| 194 | `` `fundos`, `projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`, `` | `` `entidades`, `projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`, `` | `--entidade-tipo` enumeration — see Finding 1a below for schema confirmation |

**Exact replacement block for the `apollo fundo criar` field block (D3's 3rd bullet):**

Current (`docs/ai-usage/CLAUDE.md:59-64`, verbatim):
```
### `apollo fundo criar`
```
--nome TEXT (obrigatório)
--codigo TEXT (obrigatório, curto, tipo sigla)
--ativo / --inativo (default: --ativo)
```
```

Proposed replacement — field order and wording match the real CLI exactly
(`[VERIFIED: cli/apollo_cli/entities/entidade.py:40-52]`, option decorator order `--nome`,
`--codigo`, `--tipo-entidade`, `--ativo/--inativo`, quoted verbatim there):
```
### `apollo entidade criar`
```
--nome TEXT (obrigatório)
--codigo TEXT (obrigatório, curto, tipo sigla)
--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)
--ativo / --inativo (default: --ativo)
```
```

### Finding 1a — `entidadeTipo` enumeration confirmed against schema (D3's 4th bullet)

`[VERIFIED: shared/instant.schema.ts:11-129]` — read the full `entities: {...}` block. The
9 live namespace keys, quoted verbatim as they appear as object keys in the file, are:
`entidades` (line 19), `projetos` (line 28), `etapas` (line 37), `tarefas` (line 44),
`templatesRotina` (line 78), `instanciasRotina` (line 92), `tickets` (line 102),
`subtarefas` (line 113), `logInferenciaClaude` (line 120).

The doc's existing list (`docs/ai-usage/CLAUDE.md:194-195`) already correctly excludes
`logInferenciaClaude` (an inference can't target the log itself) both before and after this
change — the only edit needed is `fundos` -> `entidades` at the head of the list; the other
7 names (`projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`, `templatesRotina`,
`instanciasRotina`) are unchanged, confirmed identical to the schema's current casing and
pluralization.

### Correction to CONTEXT.md D3's premise — "no other CLI behavior changed" is not accurate

D3 states: *"Everything else (domain hierarchy diagram, subtarefa/ticket/rotina sections,
the log-inferencia rules, the 'what not to do' list) stays as-is — only the fundo->entidade
surface changed, no other CLI behavior changed since these docs were written."*

`[VERIFIED: cli/apollo_cli/routine_job.py:165-181]` and
`[VERIFIED: cli/apollo_cli/entities/rotina.py:213-323, 458-620, 622-712]` — this is
**false** for the `apollo rotina template criar`/`gerar-instancias` surface specifically
(unrelated to the fundo->entidade rename, but real drift since these docs were written,
from milestone v1.5 Phases 27-31):

- `--tipo-geracao` now has **4** choices, not 3: `TIPO_GERACAO_CHOICES = ("du_fixo",
  "corrido_fixo", "encadeado", "semanal")` — the doc's current block
  (`docs/ai-usage/CLAUDE.md:120`) still lists only `[du_fixo|corrido_fixo|encadeado]`.
- `rotina template criar`/`editar` gained a new `--dia-semana` option
  (`[VERIFIED: cli/apollo_cli/entities/rotina.py:282-292]`, required when
  `--tipo-geracao=semanal`) — entirely absent from the doc.
- `--offset-dias`'s semantics for `du_fixo` changed: values `<= 0` now count **backward**
  from the month's last business day (`[VERIFIED: cli/apollo_cli/entities/rotina.py:266-280]`)
  — the doc's one-line summary (`--offset-dias INTEGER (significado depende de
  --tipo-geracao: dia útil do mês / dia corrido do mês / dias úteis após o antecessor)`,
  `docs/ai-usage/CLAUDE.md:126`) doesn't mention this.
- `gerar-instancias` gained `--competencia`/`--de`/`--ate` range-recorte flags
  (`[VERIFIED: cli/apollo_cli/entities/rotina.py:622-672]`) — entirely absent from the doc's
  two-line `gerar-instancias --dry-run`/`gerar-instancias` example
  (`docs/ai-usage/CLAUDE.md:131-134`).
- `rotina template deletar` gained a `--force/--no-force` linked-instances guard, and a new
  `rotina instancia limpar-orfas` command exists (`[VERIFIED:
  cli/apollo_cli/entities/rotina.py:458-505, 582-619]`) — neither is mentioned anywhere in
  the doc.
- A new top-level `apollo import --from-json <arquivo>` batch command exists
  (`[VERIFIED: cli/apollo_cli/cli.py:73-125]`) — not mentioned in the doc at all, and not
  covered by D3.

**This is out of CONTEXT.md's locked D3 scope as written** (D3 explicitly scopes only the
fundo->entidade rename). Flagging for the planner/user: either (a) proceed with D3 exactly
as locked (fundo->entidade only, leaving this other drift undocumented, as originally
decided), or (b) treat this as a scope question to raise before planning, since the doc
will still be meaningfully stale on the `rotina`/`import` surface even after this task
ships. Recorded as an open question below, not applied to the diff list above (D3's literal
scope is respected).

## Finding 2 — Exact `init.py` registration pattern to mirror (D1, D4)

`[VERIFIED: cli/apollo_cli/cli.py:1-131]`, full file read. `doctor` and `import` (aliased
`import_batch`) are the two precedents for a **standalone, non-entity-group** top-level
command:

```python
# cli.py:16-20 (imports)
from apollo_cli import auth
from apollo_cli.batch_import import run_batch_import
from apollo_cli.config import load_instant_config
from apollo_cli.crud_helpers import client_for_session, emit
from apollo_cli.entities import register_entity_groups
```

`import` registration pattern (`cli.py:73-125`, quoted structure): `@apollo.command(name=
"import")` decorator with `click.option`s, a thin function body that calls a dedicated
module's function (`run_batch_import`) and `emit(report)`s the result. **`init` should
follow this exact shape**: `@apollo.command(name="init")` in `cli.py`, delegating to a new
`cli/apollo_cli/init.py` module (per D1), calling `emit(...)` on the result — matches the
`import` precedent, not the `doctor` one (see below).

### Important correction to D4's stated JSON-output precedent

D4 says *"Print a clear next-steps summary as structured JSON (this project's established
CLI output convention — `doctor`/`import` both emit JSON)"*. This is **only half true**.

`[VERIFIED: cli/apollo_cli/cli.py:43-70]` — `doctor`'s full body uses **plain
`click.echo(str(...))`** three times (lines 61, 63, 66/68/70), never `json.dumps`. It is
explicitly **not** JSON output.

This is independently confirmed by the project's own structural test:
`[VERIFIED: cli/tests/test_cli_surface.py:164-174]`, quoted verbatim:
```python
def _leaf_entity_python_files() -> list[Path]:
    """Every module under `entities/` plus `crud_helpers.py`/`auth.py`.

    Deliberately excludes `cli.py` (the `doctor` diagnostic command prints
    deliberate human-readable plain text, not JSON -- it is not part of the
    entity CRUD surface this contract governs) and `bizdays.py`/`config.py`/
    `instant_client.py`/`session.py` (no `click.echo` call sites at all).
    """
```

`import` (`import_batch`), by contrast, genuinely does emit JSON via
`crud_helpers.emit()` (`cli.py:124-125`: `report = run_batch_import(...); emit(report)`).

**Recommendation for the planner:** `init` should follow the `import` precedent (JSON via
`emit()`), matching D4's *intent* ("structured JSON output") — just correct the doc
comment/plan language so it doesn't cite `doctor` as a JSON precedent, since it isn't one.

`emit()` itself: `[VERIFIED: cli/apollo_cli/crud_helpers.py:35-40]`, quoted verbatim:
```python
def emit(payload: object) -> None:
    """Emit exactly one JSON document to stdout.

    `sort_keys=True` keeps output byte-stable across runs/tests.
    """
    click.echo(json.dumps(payload, sort_keys=True))
```
`init.py` should reuse this exact helper (already imported in `cli.py:19`), not hand-roll
its own `json.dumps`/`click.echo` call.

### `test_cli_surface.py`'s AST JSON-contract check does not (and by precedent should not) scan `init.py`

`[VERIFIED: cli/tests/test_cli_surface.py:159-174]` — `_leaf_entity_python_files()` returns
only `entities/*.py` + `crud_helpers.py` + `auth.py`. `batch_import.py` (the `import`
command's logic module) is **also** absent from this list today, despite being a real
top-level standalone command that does emit JSON — confirming this is an established,
intentional exclusion pattern for standalone (non-entity-group) command modules, not an
oversight. `init.py` following the same placement precedent (a new top-level module, not
under `entities/`) will **not** be auto-covered by `test_click_echo_only_ever_emits_json`,
matching `batch_import.py`'s existing status quo — no gap to fix, just don't expect that
test to catch a stray `click.echo("plain text")` inside `init.py` if one is ever introduced.

## Finding 3 — Exact auth-status-check mechanism for `init` (D4, step 3)

`[VERIFIED: cli/apollo_cli/auth.py:145-176]` — `whoami`'s full body is the mechanism D4
mandates. Quoted verbatim:

```python
@group.command()
def whoami() -> None:
    """Verify the persisted session against the live InstantDB app."""
    try:
        session = load_session()
    except MissingSessionError:
        _emit(
            {
                "error": "no_session",
                "hint": "run: apollo auth login --email <seu-email>",
            },
            err=True,
        )
        raise SystemExit(EXIT_NO_SESSION) from None

    try:
        config = load_instant_config()
        # Unauthenticated endpoint — no admin token, no impersonation header.
        # Do NOT use session_client() or login_client() here.
        client = Instant(app_id=config.app_id, admin_token="")
        user = client.auth.verify_token(session.refresh_token)
        _emit(
            {
                "user_id": user["id"],
                "email": user["email"],
                "session_file": str(session_path()),
            }
        )
    except InstantAPIError as error:
        _emit_api_error(error, error_type="invalid_session")
    except httpx.HTTPError as error:
        _emit_network_error(error)
```

For `init`, D4 requires this check be **read-only and never fatal** ("init must never
itself crash or exit non-zero just because the machine isn't authenticated yet"). The
`MissingSessionError` branch above is the right model — catch it and continue with the
"not authenticated, run these commands" guidance rather than `raise SystemExit`. Note
`session.py`'s second failure mode, `CorruptSessionError`
(`[VERIFIED: cli/apollo_cli/session.py:43-48]`, raised by `load_session()` for invalid
JSON/missing keys/non-UTF8 content — quoted verbatim: `"""Raised when the session file
exists but cannot be parsed as a Session. Never includes the file's raw contents in its
message -- the file may contain a partially-written credential."""`) — `init` should catch
**both** `MissingSessionError` and `CorruptSessionError` (D4 names both explicitly) and
treat both as "not authenticated yet", not just the missing-file case. `whoami` itself does
NOT catch `CorruptSessionError` separately (it only catches `MissingSessionError` at that
call site) — `init` needs a slightly wider catch than the `whoami` precedent to satisfy D4.

`crud_helpers.require_session()` (`[VERIFIED: cli/apollo_cli/crud_helpers.py:77-101]`)
**does** catch both exceptions already, but it `_emit_err(...)` + `SystemExit(1)`s on
either — the exact opposite of D4's "must never exit non-zero" requirement, so `init` must
NOT reuse `require_session()` directly; it needs its own try/except around
`load_session()`.

`session_path()`/`DEFAULT_SESSION_FILE`/`APOLLO_SESSION_FILE` signatures
(`[VERIFIED: cli/apollo_cli/session.py:19-21, 51-59]`, quoted verbatim):
```python
SESSION_ENV_VAR: Final[str] = "APOLLO_SESSION_FILE"
DEFAULT_SESSION_DIR: Final[Path] = Path.home() / ".config" / "apollo-cli"
DEFAULT_SESSION_FILE: Final[Path] = DEFAULT_SESSION_DIR / "session"
...
def session_path() -> Path:
    """Return the resolved session file path.

    Reads `APOLLO_SESSION_FILE` from the environment at call time (not at
    import time) so tests can `monkeypatch.setenv` it. Falls back to
    `DEFAULT_SESSION_FILE` when unset.
    """
    override = os.environ.get(SESSION_ENV_VAR)
    return Path(override) if override else DEFAULT_SESSION_FILE
```
This confirms D5(c)'s plan ("`APOLLO_SESSION_FILE` pointed at a nonexistent path to
simulate a fresh machine") works exactly as CONTEXT.md assumed — `session_path()` re-reads
the env var per call, so a test can `monkeypatch.setenv("APOLLO_SESSION_FILE", <tmp path
that doesn't exist>)` and `load_session()` will raise `MissingSessionError` deterministically.

### `apollo auth login`'s exact flag contract, confirmed for D4's next-steps text

`[VERIFIED: cli/apollo_cli/auth.py:83-135]`, full `login` command read. `--email` is
`required=True` on **every** call (not just the first) — quoted verbatim:
```python
@group.command()
@click.option("--email", required=True, help="Email address to authenticate as.")
@click.option(
    "--code",
    default=None,
    help="Magic code from email. Omit to request a new code.",
)
def login(email: str, code: str | None) -> None:
```
Calling `login` with `--code` omitted always (re-)sends a new code and emits `{"status":
"code_sent", "email": email, "next": f"apollo auth login --email {email} --code
<codigo-do-email>"}` (`auth.py:100-106`, quoted) — there is no separate "already logged in,
calling login again is a no-op" behavior; login is always send-or-verify, stateless per
call. This confirms D4's exact two-command sequence
(`apollo auth login --email <voce@exemplo.com>` then `... --code <codigo>`) is correct and
requires no further caveat.

## Finding 4 — Exact `--force/--no-force` idiom to mirror (D4, step 2)

`[VERIFIED: cli/apollo_cli/entities/rotina.py:458-505]`, `template deletar`, full command
read. Quoted verbatim, the decorator + blocking-error shape:

```python
@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to delete.")
@click.option(
    "--force/--no-force",
    default=False,
    help=(
        "Bypass the linked-instances block (D-01). NEVER cascades onto "
        "linked instances — they become orphans, cleanable via "
        "`apollo rotina instancia limpar-orfas`. With zero linked instances, "
        "this flag is a silent no-op (not an error to pass it anyway)."
    ),
)
def deletar(eid: str, force: bool) -> None:
    ...
    linked_count = _count_linked_instances(eid)
    if linked_count > 0 and not force:
        click.echo(
            json.dumps(
                {
                    "error": "instances_linked",
                    "template_id": eid,
                    "instance_count": linked_count,
                    "hint": "pass --force to delete anyway (instances become orphans, "
                    "cleanable via `apollo rotina instancia limpar-orfas`)",
                },
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(_EXIT_INSTANCES_LINKED)
    delete_entity(etype=_ETYPE_TEMPLATE, eid=eid)
    emit(...)
```

The exit-code constant, quoted verbatim with its rationale
(`[VERIFIED: cli/apollo_cli/entities/rotina.py:79-88]`):
```python
# D-01/WR-01: exit code 5 for the "template has linked instancias, --force
# not passed" guard — deliberately distinct from crud_helpers.EXIT_API_ERROR
# = 3 (and the sibling EXIT_NO_SESSION = 1 / EXIT_NETWORK_ERROR = 4 constants
# there), since this is a business-rule/state guard discovered only after a
# query, not a Click argument-parsing failure. Must NOT be 2: Click's own
# UsageError/BadParameter (bad flags, missing required options, this same
# module's own `_resolve_range_override` XOR-validation) already exits 2 by
# default, and reusing that value here would make the two failure classes
# indistinguishable to a caller branching on exit code alone.
_EXIT_INSTANCES_LINKED: Final[int] = 5
```

**Applied to `init`:** define a new distinct exit-code constant in `init.py` (must not
reuse 1/3/4/5, and must not reuse Click's own default 2) for "target file exists, content
differs, `--force` not passed" — mirroring this exact reasoning. Full existing exit-code
inventory found this session, so the planner can pick a non-colliding value:
`EXIT_NO_SESSION=1` (auth.py/crud_helpers.py), Click's default UsageError/BadParameter=2,
`EXIT_API_ERROR=3`, `EXIT_NETWORK_ERROR=4` (crud_helpers.py), `_EXIT_INSTANCES_LINKED=5`
(rotina.py). `6` is the next unused value.

## Finding 5 — Exact vendoring + `importlib.resources` pattern to mirror (D2)

`[VERIFIED: cli/apollo_cli/bizdays.py:1-57]`, full header read. Quoted verbatim, the exact
import/usage pattern:
```python
from importlib import resources
...
_CALENDAR_RESOURCE: Final = resources.files("apollo_cli.data").joinpath("anbima-calendar.json")
# Let a missing/unparseable file raise loudly at import time — never fall
# back to a bundled or algorithmic calendar.
_PAYLOAD: Final[dict[str, object]] = json.loads(_CALENDAR_RESOURCE.read_text(encoding="utf-8"))
```

For `init.py` reading two `.md` files (not JSON), the equivalent call is
`resources.files("apollo_cli.data.scaffold").joinpath("README.md").read_text(encoding=
"utf-8")` (and the same for `CLAUDE.md`) — `resources.files(...)` accepts any importable
package path, confirmed by this existing usage against `apollo_cli.data`. This requires
`cli/apollo_cli/data/scaffold/` to be a real Python subpackage (i.e. needs its own
`__init__.py`, mirroring `[VERIFIED: cli/apollo_cli/data/__init__.py exists — found via
Bash `find` this session]`) OR the scaffold dir can be read via `resources.files(
"apollo_cli.data").joinpath("scaffold", "README.md")` without its own `__init__.py`, since
`importlib.resources.files()` on a package's `Traversable` supports `joinpath` into
subdirectories that aren't themselves packages — both are viable; either satisfies D2, the
planner should pick one and be consistent with `data/__init__.py`'s existing role.

`module-root = ""` confirmed live: `[VERIFIED: cli/pyproject.toml:25-26]`, quoted verbatim:
```
[tool.uv.build-backend]
module-root = ""
```
This is the exact config CONTEXT.md D2 cites as already covering non-`.py` files under
`cli/apollo_cli/data/` automatically — confirmed present and unchanged, no new
`pyproject.toml` edit needed for the two new vendored `.md` files.

### Exact parity-test pattern to mirror (D2, D5-d)

`[VERIFIED: cli/tests/test_calendar_vendored_parity.py]`, full file (27 lines) read.
Quoted verbatim in full:
```python
"""Byte-parity gate (PKG-02): shared/anbima-calendar.json vs the vendored
cli/apollo_cli/data/ copy consumed by the installed package. Fails loudly if
someone edits one file and forgets the other — the whole point of vendoring
is that both copies never silently diverge.
"""

from __future__ import annotations

from importlib import resources
from pathlib import Path
from typing import Final

from apollo_cli.config import find_repo_root

_SOURCE_PATH: Final[Path] = find_repo_root() / "shared" / "anbima-calendar.json"
_VENDORED_RESOURCE: Final = resources.files("apollo_cli.data").joinpath("anbima-calendar.json")


def test_vendored_calendar_is_byte_identical_to_shared_source() -> None:
    source_bytes: bytes = _SOURCE_PATH.read_bytes()
    vendored_bytes: bytes = _VENDORED_RESOURCE.read_bytes()
    assert source_bytes == vendored_bytes, (
        f"{_SOURCE_PATH} and cli/apollo_cli/data/anbima-calendar.json "
        "(read via importlib.resources) have diverged — update the vendored "
        "copy (see PKG-01/PKG-02)."
    )
```
The new test for D2/D5-d should follow this exact shape, doubled for the two `.md` files:
`_SOURCE_PATH = find_repo_root() / "docs" / "ai-usage" / "README.md"` (and `CLAUDE.md`)
vs. `resources.files("apollo_cli.data.scaffold").joinpath("README.md")` (or
`.data").joinpath("scaffold", "README.md")`, `.read_bytes()` compared with `==`, same
assertion-message style. This test — like the calendar one — needs no `pytest.mark.live`
(pure filesystem read, no network), unlike the D5(a)-(c) tests below.

## Finding 6 — Exact live-test fixture pattern to reuse (D5)

`[VERIFIED: cli/tests/conftest.py]` (fixture names/signatures) and
`[VERIFIED: cli/tests/test_batch_import.py:1-30]` (usage pattern), both read this session.

Available fixtures, confirmed present in `conftest.py`: `live_session` (session-scoped),
`live_client(live_session)`, `run_cli` (a `click.testing.CliRunner`-backed callable,
docstring: *"`click.testing.CliRunner`-backed `run_cli` fixture"*), `json_out(result)`
(parses a `Result`'s JSON output), `cleanup_records(live_client)` (best-effort teardown of
anything a test creates), `unique_suffix()`.

`test_batch_import.py`'s marker convention, quoted verbatim (`test_batch_import.py:30`):
```python
pytestmark = pytest.mark.live
```
— applied at module level once, not per-test. The planner should follow this exact
convention for a new `cli/tests/test_init.py` (or wherever `init`'s tests land): a single
`pytestmark = pytest.mark.live` line for the `run_cli`-based tests (D5 a/b/c, which invoke
the real installed CLI against a real temp dir and, for the "already authenticated" case,
the real session), and the byte-parity test (D5-d) in its own module without that marker
(pure filesystem, no live dependency) — exactly mirroring how
`test_calendar_vendored_parity.py` is a separate, non-`live`-marked file from
`test_batch_import.py`.

**Test file location — resolves one of CONTEXT.md's "Claude's Discretion" items directly:**
`[VERIFIED: cli/tests/ directory listing]` — there is **no** existing `test_doctor.py` or
similar single-purpose file for a standalone (non-entity) command; `doctor` has no
dedicated test file at all (only implicitly touched, if at all, by
`test_packaging_live.py`'s install round-trip). `test_cli_surface.py` is a
structural/offline test file (schema coverage, help-text completeness, JSON-echo AST scan,
suppression scan) — not a home for live command-behavior tests. The closest precedent for
"a single standalone top-level command's live behavior tests" is `test_batch_import.py`
itself (for `import`). Recommendation: a new dedicated `cli/tests/test_init.py`, following
`test_batch_import.py`'s file-per-standalone-command precedent, not `test_cli_surface.py`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON stdout emission | A local `json.dumps`/`click.echo` pair in `init.py` | `apollo_cli.crud_helpers.emit()` | Already imported in `cli.py:19`; guarantees `sort_keys=True` byte-stability matching every other command |
| Auth-status check | Re-implementing token verification | `load_session()` (session.py) — **read-only**, do not call `client.auth.verify_token(...)` unless D4 explicitly wants live verification (it doesn't say to hit the network, just report session presence) | D4 says "READ-ONLY status check" — `whoami`'s network-hitting verify step is arguably heavier than D4 requires; the planner should decide whether `init` needs live token verification or just presence-of-a-parseable-session-file. Flagged as an open question below since D4's text is ambiguous here too |
| Overwrite-guard exit code | Reusing exit code 1/2/3/4/5 | A new distinct constant (6, per Finding 4) | Every existing exit code in this codebase maps to one specific failure class; colliding would make exit-code-branching callers (Claude) unable to distinguish failures |
| `.md` file reading in `init.py` | `open()`/`Path.read_text()` against a hardcoded install-relative path | `importlib.resources.files(...)` (Finding 5) | Only mechanism proven to work identically for an editable dev install AND a real installed wheel with no monorepo checkout on disk (this is literally why `bizdays.py` uses it, per its own module docstring, `bizdays.py:1-12`) |

**Key insight:** every piece of `init`'s D4 behavior — JSON output, force-guard, read-only
auth check, resource reading, test fixtures — has a **direct, already-proven precedent
elsewhere in this exact codebase**. This task requires zero new patterns, only composition
of four existing ones.

## Common Pitfalls

### Pitfall 1: Citing `doctor` as a JSON-output precedent
**What goes wrong:** A plan or executor assumes `doctor`'s plain-text `click.echo` calls
are a JSON example to follow.
**Why it happens:** CONTEXT.md D4 itself says "doctor/import both emit JSON" — this is
factually wrong for `doctor` (Finding 2).
**How to avoid:** Follow `import`'s (`import_batch`'s) pattern only — `emit(payload)` via
`crud_helpers.emit`. `doctor` uses three bare `click.echo(f"...")` calls with no
`json.dumps` at all.
**Warning signs:** Any `init.py` code path with `click.echo(f"...")` (an f-string, not a
`json.dumps(...)` call) is a contract violation, and (per Finding 2) won't even be caught
by `test_click_echo_only_ever_emits_json` since that test doesn't scan `init.py` — so this
would ship silently broken unless caught by code review or a new test.

### Pitfall 2: Reusing `require_session()`/`whoami`'s exception handling directly
**What goes wrong:** `init` crashes with a non-zero exit + stderr JSON error on a fresh,
unauthenticated machine — the single most common real-world first-run state.
**Why it happens:** `crud_helpers.require_session()` (the obvious "load the session"
helper every other command uses) calls `raise SystemExit(EXIT_NO_SESSION)` on
`MissingSessionError`/`CorruptSessionError` — exactly the behavior D4 forbids for `init`.
**How to avoid:** `init.py` needs its own narrow `try: load_session() except
(MissingSessionError, CorruptSessionError): <treat as "not authenticated yet", continue>`
— do not call `require_session()` or `client_for_session()` from `init`.
**Warning signs:** A live test asserting `init` exits 0 with `APOLLO_SESSION_FILE` pointed
at a nonexistent path (D5-c) failing with a non-zero exit code.

### Pitfall 3: Scaffold-file overwrite guard comparing against the WRONG "current" content
**What goes wrong:** D4 says refuse-unless-`--force` "if either file already exists at the
target AND its content differs from the vendored template" — a naive implementation might
instead compare against the file that was JUST written this run (post-write), not the
pre-write on-disk content, silently no-op'ing the guard.
**Why it happens:** The check must happen BEFORE writing (read old content first, compare,
decide, then conditionally write) — a common off-by-one-step bug in this exact
"check-then-write" shape (mirrors `crud_helpers.update_entity`'s own
"call `get_entity` first" ordering comment, `crud_helpers.py:198-211`, for the same reason:
sequencing matters).
**How to avoid:** Read target file bytes first (if it exists), compare to vendored bytes,
THEN decide whether to write — exactly mirroring `rotina.py`'s `deletar`: query
(`_count_linked_instances`) fully BEFORE the write decision.

## Environment Availability

No new external dependency, tool, service, or runtime is introduced by this task — `init`
uses only `click`, `importlib.resources`, and stdlib `pathlib`/`os`, all already vendored
transitive dependencies of this package. Skipping this section per the "no external
dependencies" exemption.

## Package Legitimacy Audit

Not applicable — this task installs zero new packages (npm/PyPI/crates or otherwise).

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. (The underlying
fundo->entidade rename this task's docs catch up with was already fully executed and its
own Runtime State Inventory completed in quick task `260922-vbt`.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | README.md line 144's "fundos/clientes" and CLAUDE.md line 5's "controladoria de fundos" should be left as generic prose, not renamed | Finding 1 | Low — cosmetic only; if wrong, a planner/user preference, not a functional bug |
| A2 | `init`'s auth-status check should call `load_session()` only (file presence/parseability) and NOT `client.auth.verify_token(...)` (live network call) | Don't Hand-Roll table | Medium — if D4 actually wants live token verification (matching `whoami` fully), `init` needs an extra try/except branch for `InstantAPIError`/`httpx.HTTPError` on an expired/invalid session that a presence-only check would miss, reporting "already authenticated" when the token is actually stale |

## Open Questions

1. **Should README.md:144 and CLAUDE.md:5's generic "fundos" prose be renamed too?**
   - What we know: D3's bullets are specific to CLI command syntax (`apollo fundo
     criar`, `--fundo-id`) and one enumeration list; these two lines are prose describing
     the business domain/privacy example, not CLI syntax.
   - What's unclear: Whether D3's intent extends to every prose occurrence of "fundo(s)" or
     only the CLI-syntax ones already enumerated.
   - Recommendation: Leave both as-is (my Finding 1 default) since PROJECT.md itself still
     describes Apollo as being "for a fund-controladoria professional" — the business
     domain language legitimately survives the entity-model generalization. Flag as
     confirm-before-lock if the planner wants full-prose consistency instead.

2. **Should `docs/ai-usage/CLAUDE.md`'s `rotina`/`import` sections be updated in this same
   task, given the "Correction to CONTEXT.md D3's premise" finding above?**
   - What we know: D3 explicitly scopes only the fundo->entidade rename; the `semanal`
     tipo-geracao, `--dia-semana`, extended `--offset-dias` semantics, `--competencia`/
     `--de`/`--ate`, `template deletar --force`, `instancia limpar-orfas`, and the whole
     `apollo import` command are real, verified gaps in the doc that predate and are
     unrelated to this task's trigger.
   - What's unclear: Whether the user wants this task to also close that gap (expanding
     scope beyond D3) or leave it for a future dedicated docs-sync task.
   - Recommendation: Given CONTEXT.md's D3 is explicit and locked, apply only the
     fundo->entidade diff (Finding 1) in this task; surface this finding to the user before
     planning finalizes, since silently expanding a locked decision's scope is exactly the
     kind of drift GSD's provenance rules exist to catch.

## Sources

### Primary (HIGH confidence — all direct file reads this session)
- `docs/ai-usage/README.md` (full file, 146 lines)
- `docs/ai-usage/CLAUDE.md` (full file, 216 lines)
- `shared/instant.schema.ts` (full file, 180 lines)
- `cli/apollo_cli/entities/entidade.py` (full file, 114 lines)
- `cli/apollo_cli/auth.py` (full file, 177 lines)
- `cli/apollo_cli/session.py` (full file, 147 lines)
- `cli/apollo_cli/cli.py` (full file, 131 lines)
- `cli/apollo_cli/crud_helpers.py` (full file, 229 lines)
- `cli/apollo_cli/entities/rotina.py` (full file, 712 lines)
- `cli/apollo_cli/bizdays.py` (lines 1-60)
- `cli/tests/test_calendar_vendored_parity.py` (full file, 27 lines)
- `cli/tests/test_cli_surface.py` (full file, 240+ lines)
- `cli/tests/conftest.py` (grep-scoped: fixture names/signatures, lines 1-107)
- `cli/tests/test_batch_import.py` (grep-scoped: test/function names + marker, lines 1-40)
- `cli/pyproject.toml` (grep-scoped: `[tool.uv.build-backend]` section)
- `.planning/STATE.md`, `.planning/PROJECT.md`, this task's own CONTEXT.md (full reads)

No secondary/tertiary sources were needed — this task has no external-ecosystem surface.

## Metadata

**Confidence breakdown:**
- Doc diff list (Finding 1): HIGH — exhaustive grep + full-file read, zero omissions possible
- `init` command patterns (Findings 2-4): HIGH — every cited pattern read in full from the actual source file this session
- Vendoring/test patterns (Findings 5-6): HIGH — exact files this task must mirror, read in full

**Research date:** 2026-09-24
**Valid until:** Effectively indefinite for this quick task's lifetime (single-session, no external dependency drift risk) — do not reuse for a future unrelated task without re-verifying against then-current source.
