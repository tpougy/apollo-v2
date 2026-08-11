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

**Status:** Open — not fixed by Plan 20-03 (scope boundary). Flagged for the phase's
regression-proof wave or a follow-up plan.
