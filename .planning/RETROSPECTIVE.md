# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Apollo v2 MVP

**Shipped:** 2026-08-09
**Phases:** 6 | **Plans:** 27 | **Sessions:** 1 (single unattended autonomous run)

### What Was Built
- Live InstantDB schema (9 entities) and `donoId` permission rules, pushed as the single source of truth for both runtimes
- Shared vendored ANBIMA business-day calendar, byte-identical between `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py`
- Full magic-code-authenticated CRUD for every domain entity on both the Python CLI and the Svelte 5 SPA
- Idempotent routine-instance-generation job (all 3 generation types: `du_fixo`, `corrido_fixo`, `encadeado`) running identically from both channels
- A composed `verify-phase-06.sh` end-to-end gate proving cross-channel parity, interrupted-job atomicity, and cross-user permission isolation against the live app

### What Worked
- Delegating magic-code email round trips to the orchestrator (not subagents) — subagents never inherit the orchestrator's MCP tool scoping, so this pattern had to be established once (Phase 3) and then reapplied identically through Phase 6 without rediscovery
- Insisting on live, non-mocked proofs for every phase (`verify-phase-0N.sh`) surfaced real bugs that fixture-based tests would have hidden — the missing `antecessor` link query and the lookup-vs-update InstantDB conflict were both found this way
- Composing all prior verify scripts into one Phase 6 gate, rather than writing new checks from scratch, surfaced 8 latent defects in Phases 2-5's own verification tooling that had been silently masking a false-positive exit code since Phase 3

### What Was Inefficient
- The original CONTEXT.md for Phase 6 assumed the M365 Outlook MCP tool would reach `tp@rbrasset.com.br`; it didn't, and the correction (Outlook Classic via WSL/PowerShell COM bridge) had to be discovered mid-execution and retrofitted into `PROJECT.md` constraint C-10
- `06-VALIDATION.md` was missing until a plan-checker BLOCKER caught it at Phase 6 — the same gap likely existed silently in Phases 1-5 (not retroactively fixed, judged low-value since those phases' actual verification was already rigorous)
- One executor subagent misread a context-usage system warning meant for the orchestrator's conversation as applying to itself and aborted a ~2.5-hour plan prematurely; had to be re-invoked with an explicit context-budget clarification

### Patterns Established
- Orchestrator performs all mailbox-dependent auth steps directly; subagents get session state handed to them, never mailbox access
- Every phase ships a `verify-phase-0N.sh` that independently re-proves that phase's requirements against the live system; later phases compose earlier ones rather than duplicating checks
- Schema gaps discovered mid-milestone (e.g., `templatesRotina.offsetDias`) are added as `.optional()` fields, since InstantDB cannot backfill required attributes onto existing live rows

### Key Lessons
1. When a milestone requires unattended, multi-hour execution with real external auth (email-based magic codes), verify which MCP/tool channel actually reaches the target mailbox *before* committing it to a locked constraint — test it live in Phase 1, not assumed from documentation.
2. Nyquist Dimension 8 (`06-VALIDATION.md`) should be checked at roadmap-creation time for every phase with a "Validation Architecture" RESEARCH section, not discovered reactively at the last phase.
3. Composing all per-phase verification scripts into a single end-to-end gate is a high-value final phase — it is often the first time all scripts are actually run together, and latent tooling bugs surface there.

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: 1 continuous autonomous run (~hours, spanning Phases 1-6)
- Notable: zero human interaction required after the initial "execute autonomously" directive; all blockers were resolved by the orchestrator performing real external actions (email auth) itself rather than pausing for the user

---

## Milestone: v1.3 — Navegação reorganizada + Dashboard de acompanhamento

**Shipped:** 2026-08-12
**Phases:** 6 | **Plans:** 24 | **Sessions:** 1 (single unattended autonomous run, built entirely from a standalone spec file)

### What Was Built
- 6-section topbar (Dashboard, Rotinas, Tickets, Projetos, Fundos, Log) with `etapas`/`templatesRotina`/`subtarefas`/`tarefas` nested inside their parent sections, driven by a new `EntityConfig.nav`/`navTitulo` pair and a derived `navConfigs` selector — zero manual entity list
- `EntityScreen.svelte`'s exactly-one additive extension (`scopeWhere`/`presetLinks`), proven byte-identical to prior behavior via a controlled A/B full-suite comparison, reused unmodified by every downstream section and dialog for the rest of the milestone
- `ProjetosSection`/`RotinasSection`/`TicketsSection` + shared `SubtarefasPanel` master-detail screens, all composing the generic `EntityScreen` from the outside via a hidden-instance-plus-driven-DOM-click pattern
- A real Dashboard landing screen: pure `derive.ts` + single-query `dashboardQuery.ts`, 5-weekday calendar, hard-deadline-first ticket queue, fixed-width non-compressing per-project mini-kanbans (measured `ResizeObserver` overflow indicator), fundo-grouped routines, and a 5-band monthly heatmap using only existing grayscale tokens
- A 7-dialog focus system (Ticket/Dia/Tarefa/Projeto/Fundo/Etapa/Rotina) sharing one `FocusDialog.svelte` chrome wrapper and a depth-capped (`≤2`) dialog stack, wiring all 16 previously-inert click targets built across the milestone

### What Worked
- Building the entire milestone from one exhaustive, pre-written spec file (`spec-ui.md`) rather than interactive discuss-phase sessions — the spec was detailed enough that `workflow.skip_discuss` + auto-generated CONTEXT.md produced zero loss of design intent, and every phase's plan-checker verification passed on the first pass
- Reusing one hidden-`EntityScreen`-instance + driven-DOM-click idiom for every "+" affordance outside the generic table (first established in Phase 19's `ProjetosSection`) instead of ever extending `EntityScreen.svelte` a second time — held for 5 phases with zero drift, confirmed by grep at every phase-checker and integration-check pass
- Resolving the spec's one deliberately-open decision (§5.3: how to count a completed task, given `status` is free text) once, up front, in REQUIREMENTS.md — every phase downstream referenced that single documented decision instead of re-litigating it
- Spawning research → plan-checker → executor → verifier as separate subagent roles per phase caught real bugs before they landed: RESEARCH.md's own audits found hidden wildcard-count e2e assertions and a query-traversal citation error that a less-thorough single-pass approach would have missed
- Delegating the milestone-completion mechanics (archive, requirements traceability, tag) to `gsd-tools.cjs` query verbs kept the AI's job to genuinely judgment-requiring steps (PROJECT.md evolution, ROADMAP.md reorganization) rather than bookkeeping

### What Was Inefficient
- No git worktree isolation between concurrently-run plan executors in the same wave (e.g. 19-01/19-02, 21-01/21-02, 20-02/20-03) caused several near-miss git-index collisions where one executor's commit briefly swept up another's staged files — always self-corrected via `git reset --soft`/pathspec-scoped re-commits, but this is a recurring tax that worktree isolation (`isolation: "worktree"` on the Agent tool) would eliminate
- Three separate plan executors (19-03, 22-02, 23-07) stopped mid-task with a "waiting for background notification" placeholder instead of finishing and returning `PLAN COMPLETE` — each required a `SendMessage` resume to actually finish (write SUMMARY.md, run final validation, commit). Worth flagging in future executor prompts: explicitly instruct "do not end your turn on an intermediate wait — poll to completion yourself."
- A handful of RESEARCH.md pitfalls understated their own findings (e.g. Phase 18's "3 hidden wildcard-count files" turned out to be more once the planner's own audit ran; Phase 20's DEF-01 root cause was initially mis-diagnosed as "+1 Tab stop" and was actually "+2, -1 net +1") — the planner's and executor's own independent re-audits caught what the researcher missed each time, validating the multi-role pipeline over trusting a single research pass

### Patterns Established
- One shared chrome/wrapper component (`FocusDialog.svelte`) factoring out common rules (widths, footer, `escapeKeydownBehavior`) is worth building even when the 7 consumers have different content shapes — it made the depth-cap-2 and close-behavior invariants trivially grep-checkable across all 7 at once
- A capped `$state` array (not a tree/router) is the simplest correct structure for a fixed-max-depth UI navigation stack
- When a generic engine (`EntityScreen`) is capped at exactly one extension point by design, every subsequent feature composes it from the outside (hidden instance + driven click) rather than re-opening that cap — this held for the entire milestone and is now the established idiom for this codebase

### Key Lessons
1. A sufficiently detailed, pre-written spec file can fully replace interactive discuss-phase sessions for an autonomous milestone — but the researcher/planner/plan-checker/executor/verifier role separation must stay intact; skipping discuss does not mean skipping rigor.
2. When running concurrent plan executors without worktree isolation, expect (and tolerate) occasional git-index races; each incident here self-corrected cleanly, but `isolation: "worktree"` would remove the tax entirely for future concurrent waves.
3. Executor subagents can stall on a self-imposed "wait for background work" pause instead of finishing their own turn — a resumable orchestrator (SendMessage) recovers this cleanly, but an explicit "poll to completion yourself, do not end your turn on an intermediate wait" instruction would prevent it up front.

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: 1 continuous autonomous run spanning all 6 phases plus milestone audit/completion, zero human interaction after the initial directive
- Notable: 3 subagents required a mid-task resume (SendMessage) to actually finish and commit; otherwise every phase's discuss→research→plan→plan-check→execute→verify chain ran to completion unattended

---

## Milestone: v1.5 — Correções descobertas no onboarding real do calendário de rotinas (RBR)

**Shipped:** 2026-09-22
**Phases:** 6 | **Plans:** 11 | **Sessions:** 2 (paused/resumed twice across a multi-day span; second session ran the bulk of execution plus the reconfiguration and milestone close)

### What Was Built
- Write-time validation for `templatesRotina` (`--regra-competencia` `click.Choice`, corrected `--propagar-atraso-soft`/`dedupeKey` docs) closing a silent-failure class that previously only surfaced deep inside `gerar-instancias`
- `du_fixo` accepting `offsetDias <= 0` (last-business-day-of-month semantics), `_is_concluida`/`isConcluida` status normalization for `encadeado` chains, and `nome` threaded through every `skipped` entry — all mirrored byte-identically across `routine_job.py`/`routineJob.ts`
- A fourth `tipoGeracao`, `"semanal"` (weekday-anchored via `diaSemana`), live-proven against the real "Atualiz Calc RF" case (7 real Fridays) plus full SPA form parity
- `gerar-instancias --competencia`/`--de`/`--ate`, generalizing month-candidate derivation (`months_in_range`) to accept an explicit range override instead of the hardcoded `[today, end_of_next_month]` window
- `apollo rotina template deletar --force` (blocks by default on linked instances) and `apollo rotina instancia limpar-orfas` (found and removed 22 real orphaned rows in production), plus a root-cause fix to the e2e test suite's own leftover-sweep mechanism
- `apollo import --from-json` — a new bulk-cadastro command with cross-entity `$local_id` references, two-pass collect-all-errors validation, natural-key idempotency, and one atomic heterogeneous `transact()`, live-proven at the literal 18-fundo/84-template onboarding scale in a single invocation

### What Worked
- Verifying every one of the report's 8 original findings against the live code BEFORE writing a requirement — this caught that LIFE-03's originally-proposed mechanism (a second InstantDB test app) wasn't actually needed once the real root cause (`sweepLeftovers()` never touching `instanciasRotina`) was traced
- The review→fix→re-review loop (capped at 2 iterations after a mid-milestone speed reconfiguration) found a genuine, non-cosmetic Critical or Warning in 5 of 6 phases — a real TS/Python parity bug (Phase 27), a type-guard crash + cross-runtime divergence (Phase 28), a missing year-bounds check that could crash the whole job (Phase 29), and a missing in-batch natural-key duplicate check that could create real duplicate rows (Phase 31) — none were false positives
- Requesting a targeted research pass before planning Phase 31 (the milestone's largest, most novel surface) to resolve 3 concrete InstaQL/transact questions live against production, rather than guessing or discovering them mid-execution
- The milestone integration checker, run independently at the very end, re-read the actual current source for every cross-phase join point rather than trusting phase-level self-reports — it found one genuine gap (no automated test chaining `apollo import` into `gerar-instancias`) that no single phase's own verification would have caught, since each phase's tests were scoped to its own diff

### What Was Inefficient
- Enabling `workflow.use_worktrees`/`parallelization` mid-milestone (to address a user complaint about slow phase turnaround) delivered zero realized speedup — every wave in the remaining 3 phases was either single-plan or a strict dependency chain, never independent same-wave plans — while introducing real friction: every worktree spawned stale (many commits behind `main`, requiring a manual fast-forward merge before work could start) and Phase 30's e2e tests hit a hard, correct block when the secret-read guard refused to copy the real InstantDB admin token into the isolated worktree. Disabled again one phase later.
- The account-wide-accumulation test-fragility class (unscoped assertions against a shared, growing production account) surfaced 4 separate times across Phases 26, 29, and 30 as the same root cause — each time correctly diagnosed as pre-existing/unrelated via `git diff`, but re-documenting the same finding 4 times across 3 separate `deferred-items.md` files is real overhead a single cross-cutting fix (in a future milestone) would eliminate
- `phase.complete`'s staleness check flagged Phases 28-31 as `stale`/`phase_complete: false` at milestone-close time, because later phases in the same milestone kept editing the same shared file (`routine_job.py`) after each phase's own `VERIFICATION.md` was written — a false-positive requiring manual investigation (confirming the full offline suite was still green at HEAD) rather than blind trust in either direction

### Patterns Established
- Reading the live INSTAQL query shape/edge cases (empty `$in`, link dot-path filters, heterogeneous `transact()` chunks) via a targeted, narrowly-scoped research pass — rather than a full open-ended research phase — is the right size when only 2-3 concrete technical questions block planning, not the phase's entire design
- A code-review finding that's genuinely a design gap (not just a missing test) should trigger a plan revision that adds BOTH the missing behavior AND its test in the same fix cycle — Phase 31's blocker (no negative test for a top-level `instanciasRotina` key) turned out to need only the test, since the rejection logic already existed; verifying which case applies before assuming a design change is needed saved a redundant edit
- When a milestone's own root-cause investigation finds that its ORIGINAL proposed mechanism (LIFE-03's second test app) isn't actually what's needed, surface the mid-course correction to the user explicitly and get their decision, rather than silently substituting the agent's own judgment for a requirement the user hadn't yet revisited

### Key Lessons
1. Worktree isolation is a tool for realized parallelism, not a default-on speed lever — enable it only when a wave genuinely has independent same-wave plans; otherwise it adds merge/staleness overhead with no offsetting benefit, and disabling it again mid-milestone is the correct response once that's confirmed, not a mistake to avoid repeating.
2. A milestone-closing integration check that independently re-reads source (not phase self-reports) is worth running even when every phase individually passed — it is the only mechanism that catches a missing END-TO-END test across phase boundaries, since each phase's own test suite is, by construction, scoped to its own diff.
3. When the same test-fragility root cause recurs across multiple phases in one milestone, flag it as a candidate for its own dedicated future milestone/phase rather than re-fixing pieces of it inline each time it resurfaces — recognizing the pattern early (after occurrence 2, not occurrence 4) would have saved real documentation overhead.

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: 2 (a first session planned Phase 28 and paused twice — once on an external interrupt, once proactively at 65% context usage; a second session resumed and drove Phases 28-31 plus the full audit/complete/archive cycle to completion)
- Notable: the mid-milestone speed reconfiguration (worktrees on, code-review depth lowered to `quick`, review-iteration cap lowered from 3 to 2) was itself explicitly requested by the user mid-session, not a unilateral agent optimization — worth normalizing as a checkpoint to offer proactively on any milestone running long, rather than waiting for the user to notice and ask

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 6 | First milestone — established the orchestrator-performs-auth pattern and live-proof-only verification discipline |
| v1.3 | 1 | 6 | First milestone built entirely from a standalone pre-written spec file (no interactive discuss-phase); established the hidden-EntityScreen-instance + driven-DOM-click idiom as the standard way to extend the generic engine from the outside |
| v1.5 | 2 | 6 | First milestone born from a real production onboarding report rather than a spec/discussion; first to try (and then deliberately roll back) worktree-based parallel execution; milestone-closing integration check independently re-verified cross-phase wiring by re-reading source, catching a gap no single phase's own tests could have caught |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | live pytest + bun test suites across cli/ and web/ | ruff+ty clean on cli/, Biome+svelte-check clean on web/ | InstantDB SDKs, click, bizdays, Playwright |
| v1.3 | 174 unit tests (`bun test src`) + full 3-project Playwright e2e suite, all live against the hosted InstantDB app | `bun run check`/`bun run lint` clean, zero human UAT | `tabs`/`scroll-area`/`accordion` shadcn-svelte registry components only — no new npm dependency |
| v1.5 | 406 offline pytest + full live suite across `cli/`, `bun run check`/`lint` clean on `web/`, all live against the real production InstantDB app (including a literal 18-fundo/84-template scale proof) | `ruff`/`ty`/`ruff format` clean on `cli/`, zero human UAT, code review found a genuine defect in 5/6 phases | Zero new dependencies — every fix built on already-present `instantdb`/`click`/`pytest`/Playwright |

### Top Lessons (Verified Across Milestones)

1. Live, non-mocked verification catches real integration bugs that fixtures cannot — established v1.0, reconfirmed every phase of v1.3 (RESEARCH.md pitfalls, plan-checker gaps, and integration-check findings were consistently caught by live Playwright runs, never by static review alone).
2. A generic, single-extension-point engine (`EntityScreen.svelte`) stays maintainable across many phases only if every new consumer composes it from the outside rather than reopening its extension surface — v1.3 held this discipline for 5 phases straight with zero drift, grep-verified at every checkpoint.
