# Milestones

## v1.2 Lapidação de UI (SaaS-grade polish) (Shipped: 2026-08-10)

**Phases completed:** 6 phases, 9 plans, 22 tasks

**Key accomplishments:**

- LoginScreen restyled into a centered, full-viewport Card with CardHeader/CardTitle/step-aware CardDescription and an identical space-y-4/space-y-2 spacing scale on both auth steps, proven live end-to-end against the real InstantDB app.
- `Shell.svelte` restructured with a `shell-header` toolbar + `Separator` + single `shell-content-frame` wrapper inherited by all 9 entities, and `App.svelte`'s root `<h1>` scoped inside `<SignedOut>` to eliminate the duplicate "Apollo v2" once signed in.
- Restructured `EntityScreen.svelte`'s list-view template for all 9 entities — a page-header row (title + description + relocated create action), a content-shaped `Skeleton` loading grid, and an `Empty`-composition empty state as a sibling of `<Table>` inside a bounding `Card` — proven end-to-end against fundos (full-CRUD), all 9 entities' nav contract, and both the restricted (`instanciasRotina`) and read-only (`logInferenciaClaude`) capability classes.
- Added `entities-header-states.spec.ts` (6 live tests) proving ENTTBL-04/05/06/07 explicitly against Plan 14-01's restructured `EntityScreen.svelte` — including a genuinely CDP-throttled Skeleton-loading observation that required clearing InstantDB's persisted query cache to defeat storageState's instant-resolve-from-cache behavior — then closed the phase out with a clean 50-test full-suite regression, clean `svelte-check`/Biome, and a fix for two Biome violations Plan 14-01 had left behind.
- Restructured `EntityScreen.svelte`'s create/edit Dialog with a space-y-4/space-y-2 spacing scale, Dialog.Description/Footer composition, a busy/spinner submit state (with a plan-checker-flagged double-submit race closed), and a required-field indicator — proven live across all 9 entities and all 3 capability classes, including a dedicated new Playwright spec.
- Converted EntityScreen.svelte's row-delete confirmation from `window.confirm()` to a vendored shadcn `AlertDialog` with deliberate busy-gated dismissal and open/close focus management, migrated all 5 affected e2e specs off native-dialog handling, and right-aligned the row-action button pair.
- Added 6 tarefas-based Playwright tests proving ENTTBL-08's CSS-measured alignment and DELCONF-01's keyboard/focus/busy-gating/safety requirements independently of Plan 16-01's fundos tracer, uncovering and fixing a real bits-ui bug where AlertDialog.Cancel was never visually disabled while busy — then closed the phase with a clean 60/60 full-suite regression.
- All 60 Playwright tests re-confirmed green in one sequential run, a 15-cell VERIFY-07 coverage matrix recorded (8 covered / 7 source-confirmed N/A), zero human-checkpoint tasks across Phases 12-16, and one genuine duplicate-testid bug (`entity-error` on two non-mutually-exclusive branches) found and fixed during the cross-milestone grep sweeps.
- A single new live Playwright test measures the actual computed pixel values of Login's and EntityScreen Dialog's space-y-4/space-y-2 and Shell's and EntityScreen's gap-4 across phases and finds them numerically identical, 7 more live tests close every remaining dual-color-scheme and keyboard/focus-visible gap the milestone's success criteria required, `bun run check`/`bun run lint` are clean with zero new findings across the whole v1.2 diff after fixing one real pre-existing lint violation, and the full 68-test suite passes in one final clean run — closing out all 6 phases and 24/24 requirements of the v1.2 "Lapidação de UI" milestone.
- Closing cross-phase integration audit caught one genuine visual regression the phase-level tests had missed — `EntityScreen.svelte`'s page-header sat flush (0px gap) against the table/loading/empty content below it — fixed with `space-y-6` (matching Shell's own scale) and locked in with a new permanent Playwright assertion, bringing the final suite to 69/69 passing before the milestone was marked done. Two non-blocking warnings (a redundant but visually-obscured signed-out `<h1>`, and an unasserted single-row nav-wrap invariant) plus four items of test/edge-case tech debt from Phases 16-17 were logged for a future milestone, none blocking.

---

## v1.1 UI bonita com Tailwind + shadcn-svelte (Shipped: 2026-08-10)

**Phases completed:** 5 phases (7-11), 8 plans, 24 tasks

**Key accomplishments:**

- `web/` fully restyled on Tailwind CSS v4 + shadcn-svelte's own CLI default (`--preset b0` = style `nova`, base color `neutral`, icons `lucide`) — zero custom design tokens, exactly the "default, uncustomized" look requested. Class-based dark mode hand-converted to a bare `prefers-color-scheme` media query, verified live via Playwright's `emulateMedia` — no toggle anywhere in the DOM.
- LoginScreen and Shell/nav rebuilt on shadcn `Input`/`Label`/`Button`/`Card`/`Alert`, with the existing two-step magic-code auth flow and nav/logout behavior proven functionally unchanged via real, live email round trips (including a real wrong-code rejection).
- `EntityScreen.svelte` — the single generic table+form engine reused by all 9 domain entities — rebuilt end to end: list view on shadcn `Table`/`Badge` via a value-blind column-name-allowlist (zero new npm dependency), create/edit forms inside a real shadcn `Dialog` with `Input`/`Textarea`/`Checkbox`/`Select`/a `Popover`+`Calendar` date-picker per field type, validation errors on `Alert[variant=destructive]` (zero native `window.alert`, with a live-proven fix that JS-level validation — not the browser's native constraint validation — is what blocks a bad submit), all with zero testid/capability regression across full-CRUD, restricted-create/status-only, and read-only entities.
- `svelte-sonner` hand-installed with zero `mode-watcher` dependency (avoiding a silent reintroduction of a manual dark-mode toggle), mounted once in `App.svelte`, wired into every entity CRUD write path and both auth actions — proven live for every capability class plus the auth half.
- The three pre-existing e2e spec files broken by the Dialog/Select/date-picker restyle converted to shared `pickDate`/`selectByText`/`openAndReadSelectOptions` helpers; Playwright suite grew from 15 to 39 passing tests, fully green in one clean sequential run.
- Live-reconfirmed the entire restyle in one final pass — explicit screen×capability-class coverage audit (not trusting per-phase reports alone), Biome + `svelte-check` clean with zero new suppressions vs the v1.0 baseline, and the single documented command (`bun run test:e2e`) that reproduces the whole proof unattended.
- Zero human UAT anywhere in the milestone — every phase, including all real magic-code email round trips, verified by live automated Playwright runs against the real InstantDB app.
- Closing audit found 2 non-blocking, pre-existing/explicitly-out-of-scope tech-debt items (native delete-confirm dialog; occasional live-email-timing test flake) — logged for a future milestone, did not block completion.

---

## v1.0 Apollo v2 MVP (Shipped: 2026-08-09)

**Phases completed:** 6 phases, 27 plans, 70 tasks

**Key accomplishments:**

- Pure Svelte 5 + Vite SPA scaffolded under `web/`, and the 9-entity InstantDB domain schema + donoId permission rules are live on the real InstantDB app, with a write-based guest rejection proving server-side enforcement.
- uv-managed `apollo-cli` Python 3.12 package with the `apollo` click entrypoint, cwd-independent `.env.instantdb` discovery, and both `ruff`/`ty` quality gates green with zero suppressions on the first pass.
- Repo-root Biome (formatter+linter) covering `shared/` and `web/src`, a hardened `.gitignore`, a root `README.md`, and a single `verify-phase-01.sh` that re-proves all eight SETUP requirements — including a write-based live guest-permission-denial probe — in one command.
- Vendored `shared/anbima-calendar.json` (1003 federal ANBIMA holidays, 2000-01-01..2078-12-25) extracted offline from the MIT-licensed `bizdays` package's bundled `ANBIMA.cal`, plus a byte-idempotent, network-free regenerator and a 32-assertion structural pytest gate.
- Byte-identical `isBusinessDay`/`addBusinessDays`/`nextBusinessDay` across TypeScript and Python, both reading exclusively from the vendored ANBIMA JSON, proven by a single 42-case shared fixture (13 error cases) driving both `bun test` and `pytest` to green.
- Locked and mutation-proved the `--config pyproject.toml . ../shared/scripts` ruff/ty gate scope, documented the calendar workflow in both READMEs, and shipped `verify-phase-02.sh` as a single re-runnable, negative-control-tested proof of CAL-01 through CAL-05.
- Magic-code auth CLI (`apollo auth login|logout|whoami`) with 0600 session persistence and structural admin/session client separation, proven end-to-end with a real InstantDB magic-code email round trip.
- `crud_helpers` + `entities/` auto-discovery + `apollo fundo criar|editar|deletar|listar` proven live against the real InstantDB app, with CLI-11 proven via three real server-side `permission-denied`/rejection errors on writes (guest, fake-token, mismatched-donoId).
- `apollo projeto`
- `apollo ticket` and `apollo subtarefa` live CRUD, with subtarefa's tarefa/ticket parent enforced as a structural exclusive-or validated client-side before any InstantDB transact.
- `apollo rotina template` full CRUD (with fundo link and templateAntecessor self-link), `apollo rotina instancia listar|status` with no create/delete, and `apollo log-inferencia registrar|listar` append-only — all three surfaces structurally pinned against widening.
- A single `verify-phase-03.sh` re-proves CLI-01..CLI-11 end-to-end against the live InstantDB app; `test_cli_surface.py` asserts every schema entity has its mandated CLI surface (parsed from `shared/instant.schema.ts`, not a hand-maintained list) with rich `--help` everywhere and zero lint/type suppressions; `cli/README.md` now documents the full auth/session/output/exit-code contract for an operator.
- Real magic-code login proven end-to-end in headless Chromium via Playwright, with `@instantdb/svelte`'s `SignedIn`/`SignedOut` gate and a persisted `storageState({indexedDB: true})` reused by downstream specs.
- Config-driven `EntityScreen.svelte` (one table+form engine for all 9 future entity screens) proven end-to-end on `fundos` in real Chromium against the live InstantDB app, including a Phase 3 CLI-created record appearing in the SPA (SC-3).
- 1. [Rule 1 - Bug] `entity-submit` click occasionally reported "element detached from the DOM" despite the submit having actually landed
- Ticket and subtarefa CRUD screens shipped via declarative EntityConfig, plus a fix to EntityScreen.svelte's shared edit path that was silently leaving stale XOR links after a parent-type switch.
- Three restricted-capability entity screens (full-CRUD template with a self-link, status-only instance updates, and a pure read-only audit log) added as declarative config, with all three restrictions proven live in Chromium against the real hosted InstantDB backend.
- Closed Phase 4 with a schema-driven `bun test` coverage gate proving every entity in `shared/instant.schema.ts` has a correctly-capabilitied screen, a single `verify-phase-04.sh` that re-proves WEB-01..WEB-10 plus every C-08/T-04-02/T-04-03 gate end-to-end (twice in a row, from any cwd, `PHASE 04 VERIFIED`), and `web/README.md` documenting the SPA for the next operator (human or Claude).
- Added `templatesRotina.offsetDias: i.number().optional()`, pushed it live to the real InstantDB app, and wired it through both `apollo rotina template criar|editar --offset-dias` and the SPA templatesRotina screen — closing the schema gap that blocked the entire Phase 5 generation job.
- Built `web/src/lib/routineJob.ts` — a pure, zero-I/O TypeScript module that computes exactly which `du_fixo` routine instances should exist for `[today, endOfNextMonth(today)]`, proven correct via a hand-derived ANBIMA fixture and now the locked cross-runtime contract for the rest of Phase 5.
- Wired the pure `du_fixo` compute core to the live InstantDB app via a query -> diff -> lookup-upsert `runRoutineInstanceJob`, triggered once per authenticated SPA mount from `Shell.svelte`, and proved against the real app that two consecutive SPA loads produce zero duplicate `instanciasRotina` and never clobber a manually-set `concluida` status.
- Completed all three routine-generation types by implementing `corrido_fixo` (clamped Nth-calendar-day) and `encadeado` (bounded multi-pass topological chain resolution with inherited competencia and business-day offsets), then re-proved zero-duplicate idempotency live against the real InstantDB app with all three types running together.
- Ported the complete `web/src/lib/routineJob.ts` algorithm (all three generation types + bounded topological sweep) to `cli/apollo_cli/routine_job.py`, proved it byte-identical to the TypeScript implementation via the shared fixture, wired `apollo rotina gerar-instancias` to the same query -> diff -> lookup-upsert orchestration, and proved live against the real InstantDB app that two consecutive CLI runs produce zero duplicates, zero deletes, and preserve a manually-set `concluida` status.
- Proved ROADMAP SC-4 (records one channel writes are recognized, not duplicated, by the other) in both directions, proved the non-duplication guarantee holds under two genuinely overlapping real OS processes racing on `instanciasRotina.dedupeKey.unique()`, and packaged every JOB-01/JOB-02 gate into `verify-phase-05.sh`, a single command that re-proves the whole phase and ends `PHASE 05 VERIFIED`.
- Live write-based proof that InstantDB `donoRules` reject create/update/delete from a second real authenticated user against tp@'s records, with a guarded `delete_user` teardown and re-bootstrap, both magic-code round trips performed by the orchestrator due to subagent MCP-tool scoping.
- Env-var-gated sentinel hook around routine_job.py's single atomic transact, plus a live SIGKILL harness proving an interrupted `apollo rotina gerar-instancias` run always converges to exactly 0-or-all of its new `instanciasRotina` records, never a partial write.
- `verify-phase-06.sh` composes all five prior phase scripts plus the new VERIFY-04/05 gates into one command; running it for real (twice) surfaced and fixed eight genuine pre-existing defects in Phases 2-5's own verification tooling, then recorded two fully green runs certifying the entire v1 milestone.

---
