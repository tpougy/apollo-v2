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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 6 | First milestone — established the orchestrator-performs-auth pattern and live-proof-only verification discipline |
| v1.3 | 1 | 6 | First milestone built entirely from a standalone pre-written spec file (no interactive discuss-phase); established the hidden-EntityScreen-instance + driven-DOM-click idiom as the standard way to extend the generic engine from the outside |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | live pytest + bun test suites across cli/ and web/ | ruff+ty clean on cli/, Biome+svelte-check clean on web/ | InstantDB SDKs, click, bizdays, Playwright |
| v1.3 | 174 unit tests (`bun test src`) + full 3-project Playwright e2e suite, all live against the hosted InstantDB app | `bun run check`/`bun run lint` clean, zero human UAT | `tabs`/`scroll-area`/`accordion` shadcn-svelte registry components only — no new npm dependency |

### Top Lessons (Verified Across Milestones)

1. Live, non-mocked verification catches real integration bugs that fixtures cannot — established v1.0, reconfirmed every phase of v1.3 (RESEARCH.md pitfalls, plan-checker gaps, and integration-check findings were consistently caught by live Playwright runs, never by static review alone).
2. A generic, single-extension-point engine (`EntityScreen.svelte`) stays maintainable across many phases only if every new consumer composes it from the outside rather than reopening its extension surface — v1.3 held this discipline for 5 phases straight with zero drift, grep-verified at every checkpoint.
