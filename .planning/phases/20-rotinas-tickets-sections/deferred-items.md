# Deferred Items — Phase 20 (out of scope for Plan 20-03)

## DEF-01: `cross-phase-verification.spec.ts`'s instanciasRotina Tab-order test broken by Plan 20-02

**Discovered during:** Plan 20-03's regression sweep (running the broader e2e suite after
implementing the tarefa-parented SubtarefasPanel wiring, to check for unrelated fallout).

**Test:** `web/e2e/cross-phase-verification.spec.ts` — `"VERIFY-05: keyboard/focus-visible smoke
-- instanciasRotina (restricted, update-only): Tab reaches row-edit (the only row action
available) with a real, unclipped focus-visible affordance"` (line 441).

**Failure:**
```
Expected: "row-edit"
Received: "rotinas-tab-instancias"
```

**Root cause:** This test computes a fixed Tab-press count
(`navTestIds.length - idx + 1`) to walk from the `nav-instanciasRotina` button to the
`row-edit` button, based on the pre-Plan-20-02 DOM (nav buttons, then the interim
`nested-goto` Select, then straight into the active screen's table). Plan 20-02
(`eb75e74`, `1c7d1bc`, `180e86b` — already committed before this plan started) inserted
`RotinasSection.svelte`'s new `Tabs.Root` (`rotinas-tab-instancias`/`rotinas-tab-templates`
triggers) between the nav bar and the `EntityScreen(instanciasRotina)` table, adding one more
Tab-stop the fixed count does not account for.

**Why this is out of scope for Plan 20-03:** Neither `RotinasSection.svelte` nor
`cross-phase-verification.spec.ts` is in Plan 20-03's `files_modified`
(`web/src/lib/sections/ProjetosSection.svelte`, `web/e2e/projetos-section.spec.ts`), and
Plan 20-03 never touches `RotinasSection.svelte`/`Shell.svelte`/`gotoNested.ts` per this
plan's own explicit boundary (Plan 20-02 runs concurrently, disjoint file set). This
regression is caused entirely by Plan 20-02's already-committed changes, not by anything in
this plan's diff — confirmed live: the failure reproduces identically with
`git stash`-free HEAD before Plan 20-03's two changed files are touched at all (the failing
test never navigates to `nav-projetos`/`ProjetosSection` — it Tabs from `nav-instanciasRotina`
into `RotinasSection`'s own content, a route this plan's diff never renders).

**Suggested fix (for whichever future plan owns this):** Update the fixed Tab-count math in
`cross-phase-verification.spec.ts`'s instanciasRotina test to account for the one additional
Tabs.Trigger stop Plan 20-02 introduced (either add `+1` to `tabsToRowEdit`, or assert on
`rotinas-tab-templates` as an intermediate expected stop before continuing to `row-edit`).

**Status:** RESOLVED — fixed during Plan 20-05's phase-gate regression pass.

**Actual fix applied:** Live probing (`document.activeElement` after each `Tab` press, from
`nav-instanciasRotina` focused) revealed the real Tab sequence has **two** additional stops
inside `RotinasSection`'s `Tabs.Root`, not one:
1. `rotinas-tab-instancias` — the active tab's own bits-ui `Tabs.Trigger`. Confirmed live that
   bits-ui's `Tabs.List` uses roving `tabindex` (only the currently-active trigger is ever a Tab
   stop, `rotinas-tab-templates` is skipped since it's inactive) — so this is exactly ONE stop,
   matching the original suggested fix's assumption.
2. bits-ui's own `Tabs.Content` tabpanel wrapper `<div>` (`role="tabpanel"`, `tabindex="0"`, no
   `data-testid`) — a real, separate focus stop per the ARIA tabs pattern, verified live in
   `node_modules/bits-ui/dist/bits/tabs/tabs.svelte.js`. This second stop was not anticipated by
   either 20-03-SUMMARY.md's or this deferred item's own root-cause analysis.

Because Plan 20-05 (this same wave) also deleted the interim `nested-goto` Select trigger that
used to occupy one DOM stop in this exact path, the net change versus the pre-Plan-20-02 DOM is
+1 stop (+2 from `RotinasSection`'s `Tabs.Root`, -1 from the retired dropdown), not the 0 a naive
"one stop added, one stop removed" reading would suggest — confirmed by first re-running the
test unmodified immediately after Plan 20-05's Task 1 dropdown removal, which produced a
DIFFERENT failure (`Received: null`, i.e. focus ran out of stops before reaching `row-edit`),
proving the fixed-count approach itself needed replacing, not just a `+1`/`+2` tweak.

`web/e2e/cross-phase-verification.spec.ts`'s instanciasRotina test now replaces the single fixed
`tabsToRowEdit` count with three explicit, individually-asserted stops (remaining nav buttons →
`rotinas-tab-instancias` focused-assertion → the bits-ui tabpanel `<div>` → `row-edit`), so any
future DOM change to this path fails loud with a clear "expected X, got Y" instead of silently
going stale the way this original fixed-count bug did. Verified: full
`cross-phase-verification.spec.ts` run, 9/9 pass, including this test.
