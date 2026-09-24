# Quick Task 260924-f7m: Atualizar docs/ai-usage + novo comando `apollo init` - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Task Boundary

Duas entregas:
1. Atualizar `docs/ai-usage/README.md` e `docs/ai-usage/CLAUDE.md` (o template de
   onboarding "Apollo Tasks" identificado nesta sessão) para refletir o rename
   fundos->entidades feito na quick task `260922-vbt`.
2. Novo comando `apollo init <path>` que faz scaffold de uma pasta "Apollo Tasks": cria
   `README.md` + `CLAUDE.md` nela, e orienta o usuário a autenticar.

No further clarifying questions asked here — user asked to route straight to GSD Quick.
Gray areas below resolved autonomously per this session's established convention,
documented for transparency (mirrors `260922-vbt-CONTEXT.md`/`260923-ivg-CONTEXT.md`).

</domain>

<decisions>
## Implementation Decisions

### D1 — Command name and registration
`apollo init <path>` (not `scaffold` — user offered both names, `init` chosen for the
`git init`/`npm init`-style "point at a folder, it becomes X" convention the user
literally described). Registered as a top-level standalone command in `cli.py`
(`@apollo.command(name="init")`), mirroring the existing `doctor`/`import` pattern (both
live inline in `cli.py`, delegating logic to a dedicated module) — NOT nested under an
entity subgroup, since it's not a domain-entity CRUD command. Logic lives in a new
`cli/apollo_cli/init.py`.

### D2 — Docs are the source of truth, CLI package vendors a copy
`docs/ai-usage/{README,CLAUDE}.md` (already tracked in git, human-readable reference in
the monorepo) become the SOURCE these two files are updated in first. The CLI package then
vendors a COPY into `cli/apollo_cli/data/scaffold/{README.md,CLAUDE.md}`, read via
`importlib.resources` at runtime (mirrors this project's own established vendoring
precedent for `shared/anbima-calendar.json` -> `cli/apollo_cli/data/anbima-calendar.json`,
including that precedent's byte-identity parity test — a new pytest test asserting the two
copies never silently diverge). No templating engine, no placeholder substitution — both
files are generic instructional content, not personalized per-user, so a plain byte copy
is correct. `.md` files under `cli/apollo_cli/data/` ship in the wheel automatically
(confirmed this session: `[tool.uv.build-backend] module-root = ""` includes all non-`.py`
files under the package dir, no explicit include list needed — same mechanism the calendar
file already relies on).

### D3 — Content updates required in both docs (source of truth for D2's copy)
- `apollo fundo criar/listar/...` -> `apollo entidade criar/listar/...` throughout.
- `--fundo-id` -> `--entidade-id` throughout (projeto, ticket, template-rotina examples).
- `apollo fundo criar`'s field block gains `--tipo-entidade TEXT (obrigatorio, ex: Fundo,
  Cliente, Area)` alongside the existing `--nome`/`--codigo`/`--ativo` (confirmed the
  current real CLI surface via `apollo entidade criar --help` earlier this session).
- `entidadeTipo: fundos` -> `entidades` in the `log-inferencia --entidade-tipo` enumeration
  list in `CLAUDE.md` (the list of valid `--entidade-tipo` values for the audit trail
  command — this is unrelated to the domain entity rename's `tipoEntidade` field, it's the
  schema namespace name `logInferenciaClaude.entidadeTipo` uses to record which InstaQL
  table an inference applied to; confirm against `shared/instant.schema.ts`'s actual
  namespace list before editing, don't guess).
- Everything else (domain hierarchy diagram, subtarefa/ticket/rotina sections, the
  log-inferencia rules, the "what not to do" list) stays as-is — only the fundo->entidade
  surface changed, no other CLI behavior changed since these docs were written.

### D4 — `apollo init <path>` behavior
1. Create `<path>` if it doesn't exist (`mkdir -p` semantics).
2. Write `README.md`/`CLAUDE.md` from the vendored `cli/apollo_cli/data/scaffold/` copies
   (D2) into `<path>`. If either file already exists at the target AND its content differs
   from the vendored template, refuse and require `--force` to overwrite (protects a
   user's own edits/notes they may have added to a previously-scaffolded folder) — mirrors
   this project's established `--force/--no-force` idiom (`rotina template deletar`,
   `click.option`, default `False`, structured JSON error + non-zero exit when blocked).
   Any OTHER file already in `<path>` (personal notes, lists) is never touched, per the
   existing README's own "fica a seu criterio" stance.
3. After writing, check current auth status via the SAME mechanism `apollo auth whoami`
   already uses (`load_session()` then `client.auth.verify_token(...)`), catching
   `MissingSessionError`/`CorruptSessionError`/network errors cleanly — this is a READ-ONLY
   status check, `init` must never itself crash or exit non-zero just because the machine
   isn't authenticated yet, since that's an expected, normal first-run state.
4. Print a clear next-steps summary as structured JSON (this project's established CLI
   output convention — `doctor`/`import` both emit JSON): if already authenticated, report
   the email; if not, report the exact two commands to run next
   (`apollo auth login --email <voce@exemplo.com>` then, after receiving the code,
   `apollo auth login --email <voce@exemplo.com> --code <codigo>`) — confirmed this
   session that `apollo auth login` is argument-driven (`--email`/`--code` options), NOT an
   interactive stdin prompt today, so `init` must NOT attempt to chain/automate the actual
   login call itself (that would require either reimplementing interactive prompting, out
   of this task's scope, or reusing `auth.login`'s Click callback directly, which the
   research this session found is not cleanly reusable — it prints JSON and raises
   `SystemExit` internally rather than returning/raising catchable values). Also mention in
   the summary that the scaffolded folder is ready to open directly in Claude Code (per the
   existing README's own step 5 guidance) — point at the README it just wrote rather than
   duplicating that text inline.

### D5 — Verification
Live tests per this project's convention: (a) a real `uv build`/CLI invocation of
`apollo init` against a real temp directory, asserting both files land with the exact
vendored content, (b) the `--force` refusal-then-override round trip, (c) the auth-status
branch tested BOTH ways live (once with the CLI's real current session present -- reports
"already authenticated" honestly using whatever real email is logged in on this dev
machine, not a fake value -- and once with `APOLLO_SESSION_FILE` pointed at a nonexistent
path to simulate a fresh machine, confirming the guidance-to-login branch fires and `init`
still exits 0), (d) the new parity test (D2) proving `docs/ai-usage/*.md` and
`cli/apollo_cli/data/scaffold/*.md` are byte-identical, run from a full repo checkout
(same convention as the calendar parity test).

### D6 — Resolution of RESEARCH.md's 2 open questions
- **Generic prose "fundos" (README.md, CLAUDE.md's domain diagram/opening paragraph):
  RENAME too**, not left as-is. D1 already established a full, clean-break rename for the
  product concept (no half-renamed state); leaving the domain-model prose/diagram saying
  "fundo" while every command now says `entidade` would recreate exactly the inconsistency
  D1 was meant to avoid. Reword naturally (e.g. "organizar entidades, projetos, rotinas e
  tarefas" / the hierarchy diagram's `fundo` node becomes `entidade`), not a mechanical
  find-replace that produces awkward phrasing — planner/executor judgment on exact wording,
  factual correctness is what's locked.
- **Newer rotina/import doc drift (semanal periodicity, `--dia-semana`, extended
  `--offset-dias`, `--competencia`/`--de`/`--ate`, `template deletar --force`,
  `instancia limpar-orfas`, the whole `apollo import` command) found by research to
  postdate these docs and be UNRELATED to the fundo rename: OUT OF SCOPE for this task.**
  The user's explicit ask was the fundo->entidade staleness specifically; expanding to
  reconcile every CLI surface change since these docs were written (Aug 14) is a
  materially larger, different task. Do not silently leave this invisible, though: add one
  new row to `.planning/STATE.md`'s Deferred Items table (or `.planning/WINDOWS.md`,
  whichever this task's executor finds more natural given current conventions) noting
  `docs/ai-usage/CLAUDE.md` is now known-stale on the rotina/import command surface as of
  this task's date, so a future pass knows to address it deliberately rather than by
  accident.

### Claude's Discretion
- Exact wording/formatting of `init`'s JSON success/guidance output (must satisfy D4's
  content requirements; phrasing is executor judgment, follow the project's existing
  `_emit`-style JSON conventions).
- Whether `init.py` needs its own small test file or whether tests land in an existing
  `cli/tests/test_cli_surface.py`-style location — planner's call based on existing test
  organization.
- Task/file breakdown — planner's call given precedent from this session's other --full
  quick tasks (2-4 tasks depending on genuine complexity, not artificially forced small).

</decisions>

<specifics>
## Specific Ideas

User's own words (paraphrased): point `apollo init` at a folder, it becomes the person's
"Apollo Tasks" folder with a README and a CLAUDE.md inside, so they can open Claude Code
there and ask it to organize their Apollo tasks; the init command should also guide them
to log into Apollo so the access token ends up saved and things work.

</specifics>

<canonical_refs>
## Canonical References

- `docs/ai-usage/README.md` / `docs/ai-usage/CLAUDE.md` — the existing onboarding template
  this task updates (D3) and then vendors a copy of (D2) — read in full earlier this
  session, reproduced in the surrounding conversation context.
- `cli/apollo_cli/data/anbima-calendar.json` + its parity test (v1.4 precedent) — the exact
  vendoring/parity-test pattern D2/D5 mirror.
- `cli/apollo_cli/auth.py` (login, whoami), `cli/apollo_cli/session.py` (`save_session`/
  `load_session`, `DEFAULT_SESSION_FILE`/`APOLLO_SESSION_FILE`) — the auth-status mechanism
  D4 reuses read-only, confirmed this session via direct source investigation.
  `cli/apollo_cli/entities/rotina.py`'s `--force/--no-force` idiom on `template deletar` —
  the exact pattern D4's overwrite guard mirrors.
- `cli/pyproject.toml`'s `[tool.uv.build-backend] module-root = ""` — confirmed this
  session that non-`.py` files under `cli/apollo_cli/data/` ship automatically, no new
  package-data declaration needed for the two new `.md` files.

</canonical_refs>
