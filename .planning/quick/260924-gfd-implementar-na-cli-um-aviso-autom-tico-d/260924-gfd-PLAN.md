---
phase: 260924-gfd
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - cli/apollo_cli/version_check.py
  - cli/apollo_cli/cli.py
  - cli/pyproject.toml
  - cli/tests/conftest.py
  - cli/tests/test_version_check.py
  - cli/README.md
autonomous: true

must_haves:
  truths:
    - "Every real apollo subcommand invocation best-effort checks GitHub (this repo's tags — tpougy/apollo-v2 has zero GitHub Releases, confirmed via a live 404 on GET https://api.github.com/repos/tpougy/apollo-v2/releases/latest this planning session) for a version newer than the installed apollo-cli package, and when one exists prints a short one-line warning to stderr naming both versions plus the exact `uv tool upgrade apollo-cli` command — without ever delaying, blocking, or failing the actual command."
    - "When GitHub is unreachable, times out (2s), or returns an unusable response, the check fails completely silently — no warning, no error, no traceback, no non-zero exit caused by the check itself."
    - "A second apollo invocation within 24h of the first reuses the cached result from ~/.config/apollo-cli/version_check_cache.json instead of hitting GitHub again."
    - "JSON-emitting commands (apollo entidade listar, apollo import, etc., via crud_helpers.emit) keep printing exactly one valid JSON document to stdout even when the warning fires, because the warning is stderr-only, live-proven end to end."
    - "The check is fully disabled by APOLLO_NO_VERSION_CHECK, and cli/tests/conftest.py disables it by default for every test via an autouse fixture, so the existing 'uv run pytest -m \"not live and not packaging\"' offline suite stays genuinely network-free and no slower than before this change."
    - "cli/pyproject.toml's version field is bumped from the stale 0.1.0 to 1.5 (matching the latest shipped milestone tag) and documented as the source of truth the check compares against, so the feature does not permanently nag about a fake update."
  artifacts:
    - cli/apollo_cli/version_check.py
    - cli/apollo_cli/cli.py
    - cli/pyproject.toml
    - cli/tests/conftest.py
    - cli/tests/test_version_check.py
    - cli/README.md
  key_links:
    - "apollo_cli.cli.apollo() group callback (runs before every subcommand) -> version_check.maybe_warn_outdated(), the whole call wrapped in a bare try/except at the cli.py call site as the single absolute never-block safety net -> click.echo(..., err=True), never stdout"
    - "version_check.get_latest_version_cached() -> GET https://api.github.com/repos/tpougy/apollo-v2/releases/latest (falls through on 404, this repo has no Releases) -> GET https://api.github.com/repos/tpougy/apollo-v2/tags?per_page=100 (the effective primary path today) -> local JSON cache at ~/.config/apollo-cli/version_check_cache.json, TTL 24h, path overridable via APOLLO_VERSION_CACHE_FILE for test isolation"
    - "cli/tests/conftest.py's new autouse _disable_version_check_by_default fixture (sets APOLLO_NO_VERSION_CHECK=1 for every test) -> cli/tests/test_version_check.py explicitly monkeypatch.delenv's it per-test to exercise the real live network path"
---

<objective>
Add a best-effort startup version-check warning to the `apollo` CLI: on invocation, compare the installed `apollo-cli` package version against the latest version published on GitHub for `tpougy/apollo-v2` (this repo ships no GitHub Releases — confirmed live this session via a 404 on the releases/latest endpoint — so the check's effective source is the repo's git tags, `v1.0`.."v1.4" currently pushed), and print a short stderr-only warning with the exact upgrade command when outdated. The check must never block, delay meaningfully, or fail the real command: any network failure, timeout, or parse error degrades to complete silence, and the check is cached (24h) and disableable (`APOLLO_NO_VERSION_CHECK`) for both real-world friendliness and test-suite hygiene.

Purpose: this CLI is distributed only via `uv tool install git+https://github.com/tpougy/apollo-v2.git#subdirectory=cli` (no PyPI, no auto-update channel — v1.4 packaging milestone), so a user has no other signal that a newer version exists; a passive startup nudge closes that gap without adding any new dependency or user friction.
Output: `apollo_cli/version_check.py` (new module), wired into the `apollo` group callback in `cli.py`, `cli/pyproject.toml`'s version bumped to match the real release cadence, a live-verified test suite proving all four required behaviors (warns when outdated, silent when unreachable, cache-hits within the TTL window, stdout stays clean JSON), and `cli/README.md` documentation.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@cli/apollo_cli/session.py
@cli/apollo_cli/config.py
@cli/apollo_cli/cli.py
@cli/apollo_cli/auth.py
@cli/pyproject.toml
@cli/tests/conftest.py
@cli/tests/test_init.py
@cli/tests/test_cli_surface.py
@cli/README.md

Read first (do not re-read once loaded):
- `cli/apollo_cli/session.py` (full, 147 lines) — the exact `~/.config/apollo-cli/` dir convention, env-var-override-read-at-call-time pattern (`session_path()`), and the "unconditionally re-tighten directory permissions to 0700 on every write" idiom Task 1 mirrors for the new cache file's parent directory (same shared directory, same trust boundary — no session secret involved, but keep the dir consistently 0700 regardless of which subsystem creates it first).
- `cli/apollo_cli/config.py:66-109` (`load_instant_config`) — the exact "explicit arg, then env var, then fallback default, never raises" resolution-order idiom Task 1's `get_latest_version_cached`/cache-freshness logic mirrors.
- `cli/apollo_cli/cli.py` (full, 156 lines) — `apollo()`'s group callback is currently an empty body (docstring only); Task 1 adds its only line of logic there. Note the existing `from apollo_cli import auth` then `auth.group` import style (module-level import, not name-level) Task 1's `from apollo_cli import version_check` mirrors.
- `cli/apollo_cli/auth.py:35-51` (`_post_public_auth`) — the project's only other raw `httpx.get`/`httpx.post` call site outside `instant_client.py`, for header/timeout style precedent (this task talks to GitHub, not InstantDB, so do not reuse `DEFAULT_API_URI`/`DEFAULT_TIMEOUT` — those are InstantDB-specific).
- `cli/tests/test_auth_rejection.py:298` — `monkeypatch.setattr("apollo_cli.auth.DEFAULT_API_URI", "http://127.0.0.1:1")`, the exact "point a monkeypatchable URL constant at an unreachable host to prove the unreachable-network path" idiom Task 2's silent-failure test reuses verbatim (same host:port).
- `cli/pyproject.toml` (full, 51 lines) — `version = "0.1.0"` (line 3, never bumped since project creation — confirmed via `git log -p -- cli/pyproject.toml`) is stale relative to the real `v1.0`.."v1.5" milestone tag cadence; `httpx>=0.27,<1` is already a dependency, no new dependency needed for this whole task.
- `cli/tests/conftest.py` (full, 108 lines) — `run_cli`/`live_session`/`json_out` fixtures Task 2 reuses; this is where Task 1 adds the new autouse fixture.
- `cli/tests/test_init.py` (full, 89 lines) — most recent precedent for a `pytest.mark.live`-marked, `run_cli`-based test file shape (module-level `pytestmark`, `tmp_path`, `monkeypatch`).
- `cli/tests/test_cli_surface.py` (full, 242 lines) — the structural regression gates this change must keep green: `test_click_echo_only_ever_emits_json` only scans `entities/*.py` + `crud_helpers.py` + `auth.py` (line 164-174's `_leaf_entity_python_files` — explicitly excludes `cli.py`'s `doctor` plain-text precedent), so `version_check.py`'s plain-text stderr warning is NOT in scope of that gate and needs no `json.dumps` wrapping; `test_zero_lint_or_type_suppressions` scans all of `apollo_cli/` and `tests/` for `noqa`/`type: ignore` — the new module must stay clean without needing either.
- `cli/README.md:158-172` (the "## Sessão" section) — exact tone/structure precedent for the new "## Verificação de nova versão" section Task 2 adds right after it; `docs/ai-usage/README.md:113-119` — the exact canonical `uv tool upgrade apollo-cli` / `uv tool install --force "git+https://github.com/tpougy/apollo-v2.git#subdirectory=cli"` update commands, reused verbatim in the warning text and the new README section.

Live-confirmed this planning session (do not re-derive): `GET https://api.github.com/repos/tpougy/apollo-v2/releases/latest` returns 404 (`{"message": "Not Found", ...}`) — this repo has zero GitHub Releases. `GET https://api.github.com/repos/tpougy/apollo-v2/tags?per_page=100` returns exactly 4 tags: `v1.4`, `v1.2`, `v1.1`, `v1.0` (NOT sorted by version — `v1.4` sorts first, `v1.2` second — never trust list order, always parse-and-compare every entry). Local git tags additionally have `v1.3`/`v1.5` that were never pushed to GitHub — irrelevant to this task's live behavior today, but explains why bumping `pyproject.toml` to `1.5` will correctly show "no update available" against the real current GitHub data (1.5 > 1.4) rather than permanently nagging.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: version_check.py core module, wired into the apollo group, with the first live proof</name>
  <files>cli/apollo_cli/version_check.py, cli/apollo_cli/cli.py, cli/pyproject.toml, cli/tests/conftest.py, cli/tests/test_version_check.py</files>
  <action>
Step A — bump `cli/pyproject.toml`: change line 3's `version = "0.1.0"` to `version = "1.5"` (matches the latest shipped milestone tag, stripped of its `v` prefix — mirrors the tag format 1:1 so no translation logic is ever needed). Add one TOML comment line directly above it stating this field is the "installed version" source of truth `apollo_cli/version_check.py` compares against GitHub's tags to decide whether to warn, and must be bumped to match each new milestone git tag going forward.

Step B — create `cli/apollo_cli/version_check.py`. Module docstring: best-effort, never-raising GitHub version check, run once per `apollo` invocation from the group callback; explains the cache/TTL/disable-env-var contract up front.

Imports: `from __future__ import annotations`; `import json`; `import os`; `import re`; `from datetime import datetime, timezone`; `from importlib.metadata import PackageNotFoundError`; `from importlib.metadata import version as pkg_version`; `from pathlib import Path`; `from typing import Final`; `import click`; `import httpx`.

Constants: `DISABLE_ENV_VAR: Final[str] = "APOLLO_NO_VERSION_CHECK"` (set to any non-empty value to disable entirely — no network, no cache read/write). `CACHE_ENV_VAR: Final[str] = "APOLLO_VERSION_CACHE_FILE"`. `DEFAULT_CACHE_DIR: Final[Path] = Path.home() / ".config" / "apollo-cli"` (same directory `session.py` uses). `DEFAULT_CACHE_FILE: Final[Path] = DEFAULT_CACHE_DIR / "version_check_cache.json"`. `_RELEASES_LATEST_URL: Final[str] = "https://api.github.com/repos/tpougy/apollo-v2/releases/latest"`. `_TAGS_URL: Final[str] = "https://api.github.com/repos/tpougy/apollo-v2/tags?per_page=100"` (both module-level so tests can `monkeypatch.setattr` them to an unreachable host, exactly like `auth.py`'s `DEFAULT_API_URI` precedent). `_REQUEST_HEADERS: Final[dict[str, str]] = {"User-Agent": "apollo-cli-version-check"}` (GitHub's documented best practice for unauthenticated requests). `_REQUEST_TIMEOUT: Final[float] = 2.0`. `_CACHE_TTL_SECONDS: Final[float] = 24 * 60 * 60`. `_TAG_VERSION_RE: Final[re.Pattern[str]] = re.compile(r"^v?(\d+(?:\.\d+)*)$")`.

`cache_path() -> Path`: reads `CACHE_ENV_VAR` from the environment at call time (not import time, same reasoning as `session_path()`), returns `Path(override)` if set else `DEFAULT_CACHE_FILE`.

`_parse_version(text: str) -> tuple[int, ...] | None`: matches `text.strip()` against `_TAG_VERSION_RE`; returns `None` on no match; otherwise splits the captured group on "." and returns a tuple of ints (the regex guarantees digit-only groups, so the `int()` conversion is always safe here — no exception handling needed inside this function).

`_installed_version() -> str | None`: returns `pkg_version("apollo-cli")` wrapped in try/except `PackageNotFoundError` returning `None` on that one exception. Deliberately a standalone module-level function (not inlined) so tests can `monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")` to simulate an old install without needing a real reinstall, per this task's own stated allowance.

`_fetch_latest_version() -> str | None`: the only network-touching function, wrapped in one try/except catching `(httpx.HTTPError, ValueError, KeyError, TypeError)` returning `None` on any of them (network error, timeout, non-JSON body, unexpected shape — all degrade to "no answer", never raise past this function). Body: GET `_RELEASES_LATEST_URL` with `headers=_REQUEST_HEADERS, timeout=_REQUEST_TIMEOUT`; if status is 200, read `.json().get("tag_name")`, and if it is a string that `_parse_version` accepts, return it with any leading "v" stripped. In every other case (non-200 including the real-world 404, or a 200 with an unusable `tag_name`) fall through to the tags endpoint: GET `_TAGS_URL` with the same headers/timeout; if status is not 200 return `None`; parse the body as a list (if it is not a list, return `None`); iterate every entry, skipping anything that is not a dict or whose `"name"` is not a string or whose parsed version is `None`; track the entry with the greatest parsed tuple (Python tuple comparison, not list order — this GitHub endpoint is empirically NOT sorted by version, confirmed live this session); return that entry's name with any leading "v" stripped, or `None` if nothing parseable was found.

`_read_cache() -> dict[str, object] | None`: returns `None` if `cache_path()` is not a file, or on any `(OSError, UnicodeDecodeError, json.JSONDecodeError)` while reading/parsing, or if the parsed JSON is not a dict containing both `"checked_at"` and `"latest_version"` keys; otherwise returns the parsed dict.

`_write_cache(latest_version: str | None) -> None`: best-effort — wraps its body in try/except `OSError` doing nothing on failure (a cache-write failure must never propagate). Body: `cache_path().parent.mkdir(parents=True, exist_ok=True)`, then `os.chmod(cache_path().parent, 0o700)` unconditionally (mirrors `session.py`'s "re-tighten every write" idiom — keeps `~/.config/apollo-cli/` consistently 0700 no matter which subsystem creates it first), then write `json.dumps({"checked_at": datetime.now(timezone.utc).isoformat(), "latest_version": latest_version})` to `cache_path()` via `.write_text(..., encoding="utf-8")`.

`_is_cache_fresh(cache: dict[str, object]) -> bool`: reads `cache.get("checked_at")`; returns `False` if it is not a string or fails `datetime.fromisoformat`; if the parsed datetime is naive (`tzinfo is None`), treat it as UTC; returns whether `0 <= (now_utc - checked_at).total_seconds() < _CACHE_TTL_SECONDS`.

`get_latest_version_cached() -> str | None`: reads `_read_cache()`; if it exists and `_is_cache_fresh`, returns its `"latest_version"` value (only if it is a string or `None` — anything else treated as `None`) WITHOUT any network call (this is the cache-hit path, including deliberately re-returning a cached `None` from a previously-failed check rather than retrying every invocation during an outage). Otherwise calls `_fetch_latest_version()`, writes the result via `_write_cache` (success or `None` alike — a failure is cached too, same reasoning), and returns it.

`_format_warning(installed: str, latest: str) -> str`: returns the exact one-line message `f"apollo: a new version is available (v{latest}, you have v{installed}). Update with: uv tool upgrade apollo-cli"`.

`maybe_warn_outdated() -> None`, the public entry point `cli.py` calls: if `os.environ.get(DISABLE_ENV_VAR)` is truthy, return immediately (no cache read, no network — the CI/test escape hatch). Otherwise: `installed = _installed_version()`; return if `None`. `installed_parsed = _parse_version(installed)`; return if `None`. `latest = get_latest_version_cached()`; return if `None`. `latest_parsed = _parse_version(latest)`; return if `None` or not strictly greater than `installed_parsed` (Python tuple comparison — element-wise, so e.g. (1,4) is not greater than (1,5,0)). Otherwise `click.echo(_format_warning(installed, latest), err=True)`. This function's own internals already only call functions with their own narrow except clauses, so no additional try/except is needed inside it — the single absolute safety net lives at the `cli.py` call site instead (Step C), by design, so a future edit to this module's internals can never accidentally remove the "never blocks the real command" guarantee.

Step C — wire it into `cli/apollo_cli/cli.py`: add `from apollo_cli import version_check` to the existing import block (alphabetically last, after the existing `apollo_cli.init` import). In `apollo()`'s body (currently docstring-only), add exactly: a bare `try:` wrapping a single call to `version_check.maybe_warn_outdated()`, `except Exception:` (deliberately broad — this is the one place in this codebase where that is correct, not a code smell: it is the absolute last-resort guarantee that this best-effort UX nicety can never fail or delay the real command underneath it, no matter what future bug lands in `version_check.py`; ruff's default rule set plus this project's `extend-select = ["I", "ANN"]` does not flag broad excepts, and this needs no `noqa`) followed by `pass` with a one-line comment explaining exactly that rationale. Append one sentence to `apollo()`'s existing docstring mentioning the best-effort version check and that `APOLLO_NO_VERSION_CHECK` disables it.

Step D — add an autouse fixture to `cli/tests/conftest.py` (near the top, after the existing imports/fixtures): `_disable_version_check_by_default(monkeypatch: pytest.MonkeyPatch) -> None`, decorated `@pytest.fixture(autouse=True)`, body `monkeypatch.setenv("APOLLO_NO_VERSION_CHECK", "1")`. Docstring explains this keeps every pre-existing test genuinely network-free now that `apollo()`'s group callback makes a real GitHub call by default — `cli/tests/test_version_check.py` is the one file that explicitly opts back in per-test via `monkeypatch.delenv`. This must land in the SAME commit as Step C's wiring — the check must never be live-wired into the group callback without this safety net already in place.

Step E — create `cli/tests/test_version_check.py` with its module docstring, `from __future__ import annotations`, `import pytest`, `from apollo_cli import version_check`, and ONE test for now: `test_warns_when_a_newer_version_is_available_on_github(monkeypatch: pytest.MonkeyPatch, tmp_path, capsys: pytest.CaptureFixture[str]) -> None`, marked `@pytest.mark.live` (real network — this repo's GitHub tags, no mocking of the HTTP layer itself). Body: `monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)`; `monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))`; `monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")`; call `version_check.maybe_warn_outdated()`; read `captured = capsys.readouterr()`; assert `captured.out == ""` (nothing on stdout); assert `"0.0.1"` is in `captured.err` and `"uv tool upgrade apollo-cli"` is in `captured.err`. This is the tracer's own live proof, in addition to the inline proof this task's `<verify>` runs directly.
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2/cli && uv run ruff check apollo_cli/version_check.py apollo_cli/cli.py tests/conftest.py tests/test_version_check.py && uv run ruff format --check apollo_cli/version_check.py apollo_cli/cli.py tests/conftest.py tests/test_version_check.py && uv run ty check apollo_cli/version_check.py apollo_cli/cli.py && uv run python -c "import os,io,sys,tempfile; from pathlib import Path; os.environ['APOLLO_VERSION_CACHE_FILE']=str(Path(tempfile.mkdtemp())/'c.json'); from apollo_cli import version_check as vc; vc._installed_version=lambda: '0.0.1'; old=sys.stderr; sys.stderr=io.StringIO(); vc.maybe_warn_outdated(); out=sys.stderr.getvalue(); sys.stderr=old; assert '0.0.1' in out and 'uv tool upgrade apollo-cli' in out, out; print('TRACER_WARN_OK')" && uv run pytest tests/test_version_check.py -v -m live && uv run pytest tests/test_cli_surface.py -v && uv run pytest tests -m "not live and not packaging" -q</automated>
  </verify>
  <done>`cli/apollo_cli/version_check.py` exists implementing the full fetch/cache/compare/format contract described above. `apollo()`'s group callback calls it, wrapped in the documented bare try/except. `cli/pyproject.toml`'s version is `1.5`. `cli/tests/conftest.py`'s new autouse fixture disables the check for every test by default. `cli/tests/test_version_check.py`'s one live test passes, proving a real GitHub call plus a synthetically-old installed version produces the exact expected stderr warning with nothing on stdout. `test_cli_surface.py` and the full offline (`not live and not packaging`) suite both stay green — proving the wiring introduced zero regressions and zero new network dependency in the offline suite.</done>
</task>

<task type="auto">
  <name>Task 2: Remaining live proofs (silent-on-unreachable, cache reuse, stdout stays clean JSON) + README docs</name>
  <files>cli/tests/test_version_check.py, cli/README.md</files>
  <action>
Step A — add `test_stays_silent_and_never_raises_when_github_is_unreachable(monkeypatch: pytest.MonkeyPatch, tmp_path, capsys: pytest.CaptureFixture[str]) -> None` to `cli/tests/test_version_check.py`, marked `@pytest.mark.live` (it still exercises the real code path end to end, only the target host is swapped). Body: `monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)`; `monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))`; `monkeypatch.setattr(version_check, "_RELEASES_LATEST_URL", "http://127.0.0.1:1/releases/latest")`; `monkeypatch.setattr(version_check, "_TAGS_URL", "http://127.0.0.1:1/tags")` (the exact unreachable host:port `test_auth_rejection.py:298` already uses for the same purpose — connection-refused, fails fast, no real timeout wait needed); `monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")`; call `version_check.maybe_warn_outdated()` with no try/except around the call itself in the test (if it raises, the test correctly fails loudly — that would be the exact regression this test exists to catch); assert `capsys.readouterr()` has both `out == ""` and `err == ""` (no warning, no traceback, nothing at all); additionally assert `version_check.cache_path().is_file()` and that its parsed JSON has `latest_version` equal to `None` (proving the failure itself was cached, not merely swallowed — the next invocation within the TTL window will not retry the network either).

Step B — add `test_cache_prevents_a_second_live_network_call_within_the_ttl_window(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None`, marked `@pytest.mark.live` (its first call is a real GitHub hit). Body: `monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)`; `monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))`; call `first = version_check.get_latest_version_cached()`; read the cache file's `checked_at` value right after (`json.loads(version_check.cache_path().read_text())["checked_at"]`) as `checked_at_after_first`; call `second = version_check.get_latest_version_cached()` immediately again; assert `second == first`; assert the cache file's `checked_at` is IDENTICAL to `checked_at_after_first` (proving the second call did not re-fetch and rewrite the timestamp — a re-fetch would produce a new, later `checked_at`). Needs `import json` at the top of the test file (add it alongside the existing imports).

Step C — add `test_stdout_of_a_json_emitting_command_stays_valid_json_when_the_warning_fires(run_cli: RunCli, live_session, monkeypatch: pytest.MonkeyPatch, tmp_path) -> None` (needs `from tests.conftest import RunCli` and, since it uses `live_session`, will skip cleanly on a machine with no persisted session — matching this file's sibling `test_init.py`'s own convention). Body: `monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)`; `monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))`; `monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")`; `invocation = run_cli(["entidade", "listar"])`; assert `invocation.result.exit_code == 0`; `body = invocation.json_out()`; assert `isinstance(body, list)` (the real, successfully-parsed JSON stdout `entidade listar` returns via `crud_helpers.emit`); assert `"0.0.1"` is in `invocation.result.stderr` and `"uv tool upgrade apollo-cli"` is in `invocation.result.stderr` (the warning genuinely landed on stderr, not mixed into stdout — this is the load-bearing assertion this test exists for; Click 8.4's `CliRunner` keeps `.stdout`/`.stderr` genuinely separate, confirmed this planning session).

Step D — add a new "## Verificação de nova versão" section to `cli/README.md`, placed immediately after the existing "## Sessão" section (before "## Saída e códigos de saída"), matching that section's tone (short bullet-style facts, Portuguese, no marketing language). Must state: (1) every `apollo` invocation best-effort checks GitHub for a version newer than the installed `apollo-cli` package (`cli/pyproject.toml`'s `version` field) — this repo has no GitHub Releases, so the check's real source is the repo's git tags; (2) when outdated, prints one line to **stderr** (never stdout, so JSON-emitting commands stay parseable) naming both versions plus `uv tool upgrade apollo-cli`; (3) never blocks, delays meaningfully, or fails the real command — any network error/timeout/parse issue degrades to complete silence; (4) result cached at `~/.config/apollo-cli/version_check_cache.json` for 24h, so most invocations hit no network at all; (5) `APOLLO_NO_VERSION_CHECK` (any non-empty value) disables the check entirely — useful for CI/scripting; (6) `APOLLO_VERSION_CACHE_FILE` overrides the cache path, used by this package's own test suite so a test run never touches the real cache (mirrors `APOLLO_SESSION_FILE`'s documented role in the "## Sessão" section immediately above it).
  </action>
  <verify>
    <automated>cd /home/thomaz/pessoal/apollo-v2/cli && uv run ruff check apollo_cli/version_check.py tests/test_version_check.py && uv run ruff format --check apollo_cli/version_check.py tests/test_version_check.py && uv run ty check apollo_cli/version_check.py && uv run pytest tests/test_version_check.py -v -m live && grep -qi "APOLLO_NO_VERSION_CHECK" README.md && grep -qi "APOLLO_VERSION_CACHE_FILE" README.md</automated>
  </verify>
  <done>All 4 live tests in `cli/tests/test_version_check.py` pass: warns with the exact upgrade command when a newer version exists, stays completely silent (stdout and stderr both empty, no exception) and caches the failure when GitHub is unreachable, a second call within the TTL window reuses the cache instead of re-fetching (proven via an unchanged `checked_at`), and a real JSON-emitting command's stdout stays valid, parseable JSON with the warning confirmed on stderr only. `cli/README.md` documents the feature, the disable env var, and the test-isolation env var.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `apollo` CLI -> GitHub public REST API | Unauthenticated outbound HTTPS call on every invocation (subject to the 24h cache); response JSON is untrusted input parsed by `version_check.py` |
| `apollo` CLI -> local cache file | `~/.config/apollo-cli/version_check_cache.json` — same directory `session.py`'s secret session file lives in, but this file itself holds no secret |
| `apollo` CLI -> the real command the user invoked | The version check runs first, in-process, inside the same group callback every subcommand depends on — a bug here has the power to break every single `apollo` invocation if not contained |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-gfd-01 | Denial of Service (crash-on-check blocks the real command) | `apollo_cli.cli.apollo()`'s call to `version_check.maybe_warn_outdated()` | high | mitigate | Every network/parse/cache failure is already caught by specific except clauses inside `version_check.py` (`httpx.HTTPError`/`ValueError`/`KeyError`/`TypeError`/`OSError`), PLUS a single deliberate bare `except Exception: pass` at the one `cli.py` call site as an absolute last-resort guarantee, live-proven by Task 2's unreachable-host test asserting zero exception and zero output. |
| T-gfd-02 | Denial of Service (network hang) | `httpx.get` calls in `_fetch_latest_version` | medium | mitigate | Explicit `timeout=2.0` on both GitHub calls; the 24h cache means this cost is paid at most once per day per machine, not per invocation. |
| T-gfd-03 | Tampering (malformed/malicious GitHub response) | JSON parsing of the releases/tags API response | medium | mitigate | Every field is `isinstance`-checked before use (`tag_name`/`name` must be `str`, the tags body must be a `list`, each entry a `dict`) before being handed to the digits-only `_TAG_VERSION_RE` regex — never `eval`'d or used to build a shell command/path. |
| T-gfd-04 | Information Disclosure | GitHub API call itself | low | accept | The request carries no credential, cookie, or session data — only a static `User-Agent` header; the installed package version being compared is not sensitive. |
| T-gfd-05 | Tampering | Local cache file readable/writable by any local process running as the same user | low | accept | Same single-user local trust model as the rest of this CLI (no privilege boundary crossed); worst case is a wrong or missing warning, never a security compromise — still defensively re-tightened to the shared `~/.config/apollo-cli/` directory's 0700 convention for consistency with the session file. |

</threat_model>

<verification>
1. Task 1: `uv run pytest tests/test_version_check.py -v -m live` (1 test) passes; `uv run pytest tests/test_cli_surface.py -v` passes unchanged; `uv run pytest tests -m "not live and not packaging" -q` passes with no new network dependency (proves the conftest autouse fixture works); the inline `python -c` tracer proof prints `TRACER_WARN_OK`.
2. Task 2: `uv run pytest tests/test_version_check.py -v -m live` (all 4 tests) passes; `cli/README.md` documents `APOLLO_NO_VERSION_CHECK` and `APOLLO_VERSION_CACHE_FILE`.
3. `cli/pyproject.toml`'s version is `1.5`, no longer permanently stale relative to GitHub's real tag data.
</verification>

<success_criteria>
- Every real `apollo` invocation best-effort warns on stderr when a newer version exists on GitHub, with the exact `uv tool upgrade apollo-cli` command, live-proven against the real repo.
- The check never blocks, delays meaningfully, or fails the real command — silent and cached-as-failed on any network problem, live-proven against a genuinely unreachable host.
- Repeated invocations within 24h reuse the cache instead of re-hitting GitHub, live-proven via an unchanged cache timestamp.
- JSON-emitting commands keep emitting valid, parseable JSON on stdout even when the warning fires, live-proven end to end through the real CLI.
- The check is fully disableable (`APOLLO_NO_VERSION_CHECK`) and disabled by default across this project's own test suite, so the existing offline inner loop stays offline.
</success_criteria>

<output>
Create `.planning/quick/260924-gfd-implementar-na-cli-um-aviso-autom-tico-d/260924-gfd-SUMMARY.md` when done
</output>
