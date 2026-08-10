# Pitfalls Research

**Domain:** Spacing/composition polish pass on an already-functional, already-tested shadcn-svelte + Tailwind v4 SPA (apollo-v2 v1.2 "Lapidação de UI")
**Researched:** 2026-08-10
**Confidence:** HIGH (codebase-grounded — every pitfall below is anchored to actual files/patterns in `web/src` and `web/e2e`, cross-checked against verified external sources for the general mechanisms cited)

This research is scoped tightly to v1.2's actual constraints, read from `.planning/PROJECT.md` and the live source tree:

- `EntityScreen.svelte` (676 lines) is a **single generic, registry-driven component** rendering all 9 domain entities — there are not 9 separate screens to "harmonize," there is one component whose config varies. Any new abstraction here is almost certainly redundant.
- 39 Playwright tests, several scoping assertions to a `row` locator via `page.getByTestId("row").filter({ hasText }).getByTestId("row-edit")` (see `web/e2e/entities-fundos.spec.ts`) — these depend on `row-edit`/`row-delete` staying **inside** the row's DOM subtree, not portaled elsewhere.
- `web/e2e/design-system.spec.ts` asserts `--background`/`--foreground`/`--primary` CSS custom properties differ between light/dark `prefers-color-scheme`, and asserts `.dark` class is **never** applied to `<html>` under either scheme — dark mode is media-query-only per C-11.
- `web/src/app.css` defines a fully neutral OKLCH palette (chroma `0` on every token except `--destructive`) — there is no brand color to "helpfully" reintroduce.
- Prior milestone already hit and documented a real regression class: installing the stock `sonner` shadcn-svelte component would have silently reintroduced `mode-watcher` (a manual dark-mode toggle), a direct C-11 violation caught only by Phase 10 research before it landed (see PROJECT.md Key Decisions).
- Known, explicitly-logged, **out-of-scope** technical debt exists (`window.confirm` → shadcn `AlertDialog`) that is exactly the kind of item a "polish pass" tempts a team to fold in.

## Critical Pitfalls

### Pitfall 1: Row-action restructuring breaks scoped Playwright locators via portaling

**What goes wrong:**
A natural "polish" move is collapsing the two always-visible `row-edit`/`row-delete` buttons in each table row into a single kebab-menu (shadcn/bits-ui `DropdownMenu`) for a cleaner, denser row. `web/e2e/entities-fundos.spec.ts` (and the equivalent specs for all 9 entities) do `row.getByTestId("row-edit").click()` — a locator scoped to the row's DOM subtree. bits-ui/Radix-style `DropdownMenu.Content` renders through a **Portal** appended near `document.body`, not inside the triggering row. The moment `row-edit`/`row-delete` move into portaled dropdown content, every scoped lookup that assumes "the action button is inside this row" silently stops finding it, or matches the wrong instance if two rows' menus are open in different renders.

**Why it happens:**
The visual improvement (denser rows, fewer icons) is real and legitimate SaaS polish, but the DOM-topology cost of portaling is invisible from Figma-style visual review — it only shows up when the same element is queried in two places (row-scoped test vs. rendered-at-body-end DOM).

**How to avoid:**
- Prefer non-portaled compositional changes for row actions (e.g., reveal-on-hover, tighter icon-only buttons, `ButtonGroup`) over anything from the `DropdownMenu`/`Popover`/`Select` family for in-row actions.
- If a dropdown/menu pattern is unavoidable, keep `data-testid="row-edit"`/`row-delete"` on the **trigger button** (which does stay in the row) and never require the action itself to be found via `row.getByTestId(...)` — clicking the trigger, then querying the portaled menu item globally (`page.getByTestId("row-edit-confirm")`) is fine; silently moving the *existing* testid into portaled content is not.
- Any component with `forceMount`/portal semantics needs its e2e coverage runs before merging, not deferred to a later verification phase.

**Warning signs:**
- Any use of `Dialog`, `Popover`, `Select`, `DropdownMenu` (all confirmed portal-based in this codebase — see `Select.Trigger`/`Select.Content` usage in `EntityScreen.svelte`) introduced inside a `TableRow`.
- A previously-passing `row.getByTestId(...)` assertion starting to time out with "element not found" rather than a strict-mode violation.

**Phase to address:** The phase that touches the entity table's row-action composition (table/list polish phase). Verification step: re-run the full existing 39-test suite (not just the touched entity's spec) after any row-action restructuring, since all 9 entities share `EntityScreen.svelte`.

---

### Pitfall 2: Duplicate `data-testid` from wrapper-element additions causes Playwright strict-mode failures

**What goes wrong:**
Spacing polish frequently means wrapping an existing interactive element in a new `<div>` for padding/alignment (e.g., wrapping `Button` in a flex container, or wrapping a `Select.Trigger` in a labeled field group). If the *existing* `data-testid` attribute gets copied onto the new wrapper "just to be safe" while also remaining on the inner element, Playwright's `getByTestId` resolves to two elements and throws a strict-mode violation (confirmed general Playwright behavior — locators require exactly one match for actions/assertions). This is easy to introduce silently because Svelte doesn't warn about duplicate `data-*` attributes across a subtree.

**Why it happens:**
Copy-pasting an existing element's attributes onto a new wrapper "to preserve the hook" instead of moving them, or leaving the old attribute in place after refactoring, out of caution.

**How to avoid:**
- Rule: a given `data-testid` value moves, it never duplicates. When adding a wrapper for spacing, the testid stays on exactly one element — decide up front whether that's the new wrapper or the original node, and remove it from the other.
- Grep for testid values before and after each file's edit: `grep -c 'data-testid="field-nome"' file.svelte` should stay `1`.
- Run the affected spec file locally in headed/trace mode after each structural edit, not only at the end of the phase — strict-mode errors are cheap to catch immediately and expensive to bisect later once several files have moved.

**Warning signs:** Playwright error text `strict mode violation: locator('...') resolved to 2 elements` appearing on tests that passed before the polish edit touched that component.

**Phase to address:** Every phase that restructures markup (all of them, by definition, in this milestone). Make "grep each touched testid for count==1" an explicit per-plan verification step rather than relying on the final cross-cutting phase to catch it.

---

### Pitfall 3: Spacing/background changes silently break dark-mode contrast because both schemes were never re-verified after the edit

**What goes wrong:**
`app.css` defines two separate OKLCH token blocks (light `:root`, dark under `@media (prefers-color-scheme: dark)`), and there is no manual toggle to flip during development — a developer working with their OS in light mode will visually check every change in light mode only, by default. A common polish pattern like adding `bg-muted/40` to a card for subtle separation, or lightening a border with an arbitrary opacity value, looks fine against light OKLCH tokens (`--muted: oklch(0.97 0 0)`) but can crush contrast or create a barely-visible seam against the dark tokens (`--muted: oklch(0.269 0 0)`, `--background: oklch(0.145 0 0)` — a narrow range). Since `design-system.spec.ts` only asserts that light/dark tokens *differ*, not that any given composed surface remains legible, a real contrast regression on a new spacing/elevation treatment will not fail any existing automated test.

**Why it happens:** `prefers-color-scheme`-only dark mode (no toggle) means dark mode is easy to forget to check manually, and no automated contrast test currently exists to catch it.

**How to avoid:**
- For every new surface/spacing treatment (card backgrounds, table row hover, dividers, empty-state panels), use only semantic tokens (`bg-muted`, `bg-accent`, `border-border`, `text-muted-foreground`) rather than raw opacity modifiers on `background`/`foreground` (e.g., avoid `bg-foreground/5` as an ad hoc "subtle tint" — it composes unpredictably against the two very different foreground OKLCH values in light vs. dark).
- Playwright already supports `page.emulateMedia({ colorScheme: "dark" })` (used in `design-system.spec.ts`) — extend this pattern: any new spacing/polish e2e assertion added this milestone should run once per color scheme, at least for one representative screen per phase, even if full-suite duplication isn't practical.
- Manually toggle OS-level dark mode (or use `emulateMedia` in an ad hoc Playwright script) as a mandatory check before considering a plan's visual work done — not just at the final verification phase.

**Warning signs:** Any new Tailwind class using `/NN` opacity suffix on `bg-*`/`text-*`/`border-*` utilities tied to `background`/`foreground` rather than `muted`/`accent`/`border` tokens; any hard-coded `gray-*`/`zinc-*`/`slate-*` Tailwind palette class (these do not repaint under the dark-mode media query since they're not wired to CSS custom properties).

**Phase to address:** Each visual-polish phase should include a "verify in both color schemes" checklist item; the final cross-cutting verification phase should add at least one automated per-screen light+dark screenshot or token-contrast check rather than relying on token-difference alone.

---

### Pitfall 4: "Just this once" custom color creeps in via a plausible-sounding UX justification

**What goes wrong:** The palette in `app.css` is intentionally flat (`oklch(_, 0, 0)` chroma-zero on every token except `--destructive`). Polish work invites exactly the kind of decision that breaks this: a colored accent to make an empty state feel less sterile, a green "success" tint distinct from the neutral badge system, a subtle blue focus glow "to match modern SaaS apps," or a custom shadow color for elevation. Each individually is defensible as good UX and none of them require a new dependency, which is the specific trap — the constraint (C-11, and this milestone's explicit restatement "no custom color palette") isn't guarded by a technical barrier here, only by discipline, because adding an arbitrary OKLCH/hex value to a `class="..."` string requires no new import and passes `svelte-check`/lint cleanly.

**Why it happens:** Constraint fatigue plus genuine design instinct — grayscale-only UI legitimately can look "unfinished" compared to competitors, and the fix (one hex value) is nearly free to write.

**How to avoid:**
- Treat this as a **lint-enforceable** rule, not just a reviewed-by-eye rule: grep-gate every touched `.svelte` file for raw color literals before committing — `grep -nE 'oklch\(|#[0-9a-fA-F]{3,8}\b|rgba?\(' web/src/lib/**/*.svelte` (excluding `app.css` itself) should return nothing new. Bake this into the phase's verification step, not left to a human aesthetic judgment call.
- Any felt "need" for a new visual signal (success state, emphasis, warning) must map to an *existing* shadcn semantic token or variant (`destructive`, `secondary`, `muted`, `Badge` variants already in use) — if none fits, that is a signal the request has drifted into a design-system decision, which is explicitly out of scope for this milestone, not a spacing/polish decision.
- Icons (`@lucide/svelte`, already a dependency) can carry meaning/hierarchy without color — use icon choice, weight, size, and `text-muted-foreground` vs. `text-foreground` opacity of meaning instead of hue.

**Warning signs:** Any new literal color value anywhere outside `app.css`; any PR/plan description containing phrases like "just a touch of color to..." or "a subtle brand accent."

**Phase to address:** Should be an explicit, standing success-criterion on *every* phase in this milestone (not one specific phase) — recommend making it part of the milestone-wide Definition of Done alongside "no `.dark` class," mirroring how C-11 was verified in v1.1.

---

### Pitfall 5: Over-abstracting the single generic `EntityScreen.svelte` into per-entity or per-concern wrapper components

**What goes wrong:** Because there are 9 domain entities, it's tempting to reach for "let's extract a reusable `<PageHeader>`, `<EmptyState>`, `<EntityCard>` component" during a polish pass, or worse, to special-case one or two entities' layout inside new per-entity Svelte files. But `EntityScreen.svelte` is *already* the shared abstraction — it is config/registry-driven (`EntityConfig` from `./types`, entity-specific behavior lives in `web/src/lib/entities/defs/*.ts`), and all 9 entities' e2e coverage exercises this one file. Introducing new component boundaries mid-polish multiplies the surface area that must stay in sync with the registry pattern, risks divergent spacing between entities (defeating the point of "consistent hierarchy" the milestone wants), and turns a "swap classes and refine markup" diff into an architecture change that re-litigates a decision from v1.0/v1.1 no one asked to reopen.

**Why it happens:** Extracting small presentational components (`PageHeader`, `EmptyState`) feels like good practice in isolation, and each individual extraction is small — but it works against a codebase that solved entity-uniformity by using one component with data-driven config, not composition of many small components.

**How to avoid:**
- Default to editing markup/classes *inside* `EntityScreen.svelte`, `Shell.svelte`, and `LoginScreen.svelte` directly. Any new child component must justify itself against "does the registry/config pattern already solve this?" first.
- If genuine duplication across the three top-level files (e.g., a shared "page header" treatment used by both Shell and EntityScreen) makes a small presentational extraction clearly justified, keep it to pure layout/markup (no new state, no new config surface) and keep it inside `web/src/lib` alongside existing structure — not a new `components/` subtree or design-system layer.
- No new npm/bun dependency for layout (no new grid/flex helper libraries, no headless layout primitives) — Tailwind v4 utilities plus existing shadcn-svelte primitives are sufficient per the milestone's own framing ("no new component library").

**Warning signs:** A plan whose task list includes creating a new file under `web/src/lib/components/` (outside the existing generated `ui/` primitives) or a new per-entity `.svelte` file; any diff that changes `EntityConfig`/`types.ts` "while we're in there."

**Phase to address:** Any phase touching `EntityScreen.svelte` composition; the phase's plan review should explicitly check proposed file list against "does this add a new component file?"

---

### Pitfall 6: Denser layouts shrink hit targets and clip/hide focus rings, regressing accessibility that visual review won't catch

**What goes wrong:** "Better information density" is a stated goal, and the most direct way to get it is smaller padding, tighter row heights, smaller icon buttons. Two specific regressions follow: (1) icon-only row actions (`row-edit`/`row-delete` buttons) shrinking below a comfortable tap/click target, particularly bad since this is a data-entry-heavy controladoria tool used repeatedly, not a marketing page; (2) adding `overflow-hidden` to newly-introduced card/container wrappers (a very common "clean edges" polish move) clips the `focus-visible` ring shadcn/Tailwind renders via `box-shadow`/`outline` on focused interactive descendants — a confirmed, documented shadcn/Tailwind interaction gotcha, not hypothetical. Both regressions are invisible to a sighted mouse-driven visual review and only appear under keyboard navigation or careful measurement, which nothing in the existing 39 e2e tests currently checks.

**Why it happens:** Visual QA of a "polish" pass is done by looking at the screen, mouse in hand; keyboard-only navigation and precise target-size measurement aren't naturally exercised by that workflow, and none of the existing tests assert focus-visibility or element dimensions.

**How to avoid:**
- Never apply `overflow-hidden` to a wrapper containing focusable interactive elements without checking that `focus-visible` rings on children remain fully visible (increase inner padding to keep the ring inside the clip box, or move the rounded-corner treatment to a non-clipping technique).
- Keep interactive element minimum size at or above the current shadcn `Button`/`Checkbox` default sizes; if a "denser" variant is introduced, verify it against a documented minimum (roughly 24x24 CSS px absolute floor, 44x44 preferred for primary actions) rather than shrinking until it "looks" fine.
- Add at least one keyboard-navigation smoke check to the milestone's e2e coverage (e.g., `page.keyboard.press("Tab")` through a row's actions and assert `:focus-visible` is present and not clipped) — this doesn't exist today and is the single highest-leverage new test to add for this specific milestone's risk profile.

**Warning signs:** Any new `overflow-hidden`/`overflow-clip` on a container that also contains a `Button`, `Select.Trigger`, `Checkbox`, or link; row/button height reduced below the current computed height without an explicit measurement check.

**Phase to address:** The entity table polish phase (row density) and the final cross-cutting verification phase (add the keyboard/focus-visible smoke test once, apply it to representative screens).

---

### Pitfall 7: Editing shared component internals via `shadcn-svelte add` re-runs silently reintroduces removed behavior (recurrence of a known incident)

**What goes wrong:** This exact failure mode already happened once in v1.1: the stock `sonner` registry component pulls in `mode-watcher`, which would have silently reintroduced the manual dark-mode toggle that C-11 explicitly requires removed — caught only by pre-emptive research, not by a test. Nothing about v1.2 removes this risk: if a polish task decides an existing primitive (e.g., `Calendar`, `Select`, `Dialog`) needs a newer/richer variant and the natural move is `bunx shadcn-svelte add <component> --overwrite`, that command regenerates the file from the current upstream registry and can reintroduce dependencies, class names, or structural choices (including anything registry-default around theming) that this project deliberately deviated from.

**Why it happens:** Re-running the generator feels like the "correct," low-effort way to get an updated component, and it's easy to forget that this project's `app.css`/dark-mode setup, and specific hand-installed exceptions (Sonner), are deliberate deviations from the vanilla `shadcn-svelte` output.

**How to avoid:**
- Treat every existing file under `web/src/lib/components/ui/` as hand-tuned, not regeneratable by default. Prefer editing the existing `.svelte` file's classes/markup directly for spacing polish over re-running the CLI generator.
- If a component genuinely needs to be regenerated/upgraded, diff the new output against the current file before accepting it, specifically checking for: new imports (especially anything theme/mode-related), new `class` defaults that hard-code colors, and confirm `.dark`-class-based logic hasn't been reintroduced anywhere.
- Re-run `web/e2e/design-system.spec.ts`'s three assertions (tokens present, tokens differ, `.dark` class never applied) immediately after any `shadcn-svelte add`/`--overwrite` invocation, before doing anything else.

**Warning signs:** A `bunx shadcn-svelte add ...` command appearing in a phase's task list at all; a diff to a `ui/` primitive file that adds an import not already present in the file.

**Phase to address:** Should be a standing constraint check across all phases (mirrors C-11 verification pattern from v1.1); explicitly call out in any phase plan that touches a `ui/` primitive file.

---

### Pitfall 8: Scope creep — folding in the already-logged, explicitly out-of-scope `window.confirm` → `AlertDialog` conversion, or other "while we're in there" functional changes

**What goes wrong:** PROJECT.md explicitly logs "delete-confirmation still uses native `window.confirm` (candidate for a shadcn `AlertDialog` conversion, non-blocking...)" as known technical debt from v1.1. This is exactly the kind of item that a polish-pass developer, staring at the delete-row flow while adjusting spacing around it, will feel compelled to "just fix while I'm here" — it even touches UI composition, making it feel in-scope. But it is a **functional/behavioral** change (new confirmation dialog component, new interaction flow, new keyboard/focus trap semantics) wrapped in a UI decision, not a spacing/composition change, and it wasn't scoped, planned, or research-flagged for v1.2. The same risk applies more broadly: any change to *what* happens (validation timing, error message wording/logic, which fields are required, capability-class behavior for restricted-create/status-only/read-only entities) is scope creep even if the diff looks small and lives in a file this milestone is already touching.

**Why it happens:** The three functional entity capability classes (full-CRUD, restricted-create/status-only, read-only) and the delete-confirmation flow all live inside the exact files (`EntityScreen.svelte`) this milestone must touch for pure visual reasons, so the boundary between "restyle this button" and "change what this button does" is easy to blur mid-edit.

**How to avoid:**
- Before touching any interactive flow (delete confirm, form validation, capability gating), ask: "does this change what the user can do, or only how it looks/feels visually?" If the former, it's out of scope for v1.2 regardless of how small.
- The `window.confirm` → `AlertDialog` conversion specifically should be evaluated (if at all) as a separate, explicitly-scoped micro-decision with its own success criteria — not silently absorbed into a table-row spacing plan. Recommend the roadmap either explicitly excludes it again or explicitly carves out a single small phase/plan for it with its own UAT-equivalent Playwright coverage, rather than letting it land as an incidental line in an unrelated diff.
- Reuse PROJECT.md's own "Out of Scope" reasoning pattern: log why a functional-adjacent idea was deferred, don't just silently skip discussing it.

**Warning signs:** A plan diff touching `confirm(...)`, `onclick` handlers with new conditional logic, or any change to which fields/entities a form renders, inside a plan whose stated goal is spacing/visual.

**Phase to address:** Should be an explicit exclusion re-stated in every phase's plan (particularly the entity table/form phases, since delete-confirm and capability-class rendering both live in `EntityScreen.svelte`); the roadmap should decide up front whether `window.confirm`→`AlertDialog` is in v1.2 at all, rather than leaving it to be silently decided mid-execution.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Copying a `data-testid` onto a new wrapper instead of moving it | Fast, "safe-feeling" edit, no test-file changes needed | Silent strict-mode failures later, unclear which element the test actually now checks | Never — always move, verify uniqueness |
| Using arbitrary Tailwind opacity modifiers (`bg-foreground/5`, `border-black/10`) instead of semantic tokens | Quick visual tweak, doesn't require touching `app.css` | Breaks or looks wrong in the scheme not currently being viewed; invisible until someone checks dark mode | Never for `background`/`foreground`; borderline acceptable only for one-off decorative elements with zero semantic meaning, still requires dual-scheme check |
| Re-running `shadcn-svelte add --overwrite` to "refresh" a primitive | Gets latest upstream markup/behavior for free | Can reintroduce `mode-watcher`/theme deviations already deliberately removed (happened once already in v1.1) | Only with a full diff review + immediate `design-system.spec.ts` re-run |
| Extracting a new small presentational component mid-polish (`PageHeader`, `EmptyState`) | Feels like "clean code," reduces perceived duplication | Fragments the registry-driven single-source-of-truth pattern (`EntityScreen.svelte` + config), inconsistent spacing across entities if not perfectly kept in sync | Only if it stays pure-layout, zero new state/config, and is reviewed against "does this fragment the existing pattern" |
| Folding `window.confirm`→`AlertDialog` into an unrelated spacing plan | Removes a known wart while the file is already open | Introduces an unplanned functional/UX change with no dedicated success criteria or Playwright coverage in a milestone whose entire premise is zero-functional-change | Never inside this milestone unless explicitly re-scoped as its own phase first |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| bits-ui/shadcn-svelte `DropdownMenu`/`Popover`/`Select` (portal-based) | Assuming portaled content is reachable via a locator scoped to its trigger's row/container | Query portaled content globally (`page.getByTestId(...)` unscoped) after clicking the trigger; keep only the trigger's testid inside the row |
| `shadcn-svelte` CLI regeneration | Running `add --overwrite` on an existing hand-tuned primitive assuming it's a no-op refresh | Diff against current file first; specifically check for reintroduced `mode-watcher`/theme-toggle logic; re-run `design-system.spec.ts` immediately after |
| Tailwind v4 `@media (prefers-color-scheme: dark)` token block in `app.css` | Verifying new spacing/surface treatments only in the developer's current OS color scheme | Use `page.emulateMedia({ colorScheme })` (already used in `design-system.spec.ts`) or manually toggle OS dark mode for every new surface treatment before considering it done |
| Playwright `getByTestId` + Svelte markup restructuring | Treating testid attributes as inert metadata that survives arbitrary wrapper/portal changes | Treat every `data-testid` as part of the component's public contract; any structural change is a breaking-change review, not a pure style change |

## Performance Traps

Not a primary risk for this milestone (small, single-user local app, no new data-fetching patterns), but relevant to spacing/polish specifically:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Arbitrary-value Tailwind classes proliferating (`p-[13px]`, `gap-[7px]`) instead of using the spacing scale | Growing, inconsistent generated CSS; harder-to-audit "no custom values" constraint compliance | Stick to Tailwind's default spacing scale (`p-1`...`p-12`, etc.) for all polish work; treat any arbitrary-value class as a signal to reconsider the spacing choice | Not a runtime performance issue at this app's scale — the cost is maintainability/consistency, not load time |

## Security Mistakes

Not a meaningful category for a pure CSS/composition pass — no new data flows, auth paths, or permission logic are touched by definition. The one relevant risk is indirect:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Letting the `window.confirm`→`AlertDialog` scope-creep item (Pitfall 8) land unreviewed inside a visual-only diff | A rushed dialog-focus-trap implementation could introduce a genuinely new interaction bug (e.g., a delete action confirmable via a mis-wired keyboard shortcut) that wouldn't get the same UAT/e2e scrutiny a dedicated phase would give it | Keep functional changes out of visual-only plans (see Pitfall 8); if pursued, scope it as its own phase with its own Playwright coverage of the confirm/cancel/keyboard paths |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Increasing information density uniformly across all 9 entities without checking each capability class (full-CRUD vs. restricted-create/status-only vs. read-only) | Read-only/status-only screens may end up with awkward whitespace or cramped controls that a full-CRUD screen's spacing doesn't suit, since they render different subsets of `EntityScreen.svelte` | Explicitly test the polish against one representative entity from each of the three capability classes, not just the entity happened to be edited first |
| Removing/softening focus rings for a "cleaner" look | Keyboard users lose the ability to tell which control is active, especially painful in a data-entry-heavy tool used repeatedly by one power user who may rely on keyboard navigation for speed | Keep `focus-visible` rings fully intact and unclipped (see Pitfall 6); "cleaner" should come from spacing/alignment, not from removing state indicators |
| Treating "empty state" and "loading state" polish as purely decorative | An empty table can currently render as a `TableRow` with `data-testid="empty-state"` (i.e., inside `<table>`/`<tbody>`) — replacing it with a full illustration/card breaks valid table markup (a block-level illustration nested in `<tbody>` outside a `<tr>`/`<td>` is invalid HTML and can cause unpredictable browser layout/hydration behavior) | If redesigning the empty state beyond a styled `TableRow`/`TableCell`, restructure it as a sibling to the `<Table>` entirely (conditionally rendering the illustration instead of the table), not as invalid content inside `<tbody>` |

## "Looks Done But Isn't" Checklist

- [ ] **Any row-action restructuring:** Often missing a check that `row.getByTestId(...)` still resolves — verify against the *portaled* DOM location, not just visual placement, for every entity's spec, not only the one manually eyeballed.
- [ ] **Any new surface/background treatment:** Often missing a dark-mode check — verify by toggling `prefers-color-scheme` (OS setting or `page.emulateMedia`) before calling a card/row/panel treatment done.
- [ ] **Any color-adjacent decision ("just a subtle accent"):** Often missing the grep-for-raw-color-literal check — verify with `grep -nE 'oklch\(|#[0-9a-fA-F]{3,8}|rgba?\('` against every touched file outside `app.css`.
- [ ] **Any denser/smaller interactive element:** Often missing a keyboard/focus-visible check and a hit-target-size check — verify by tabbing through the changed screen and confirming the ring is fully visible and unclipped.
- [ ] **Any `shadcn-svelte add`/`--overwrite` invocation:** Often missing a diff review against the current hand-tuned file — verify no new theme/mode-related import was reintroduced, then re-run `design-system.spec.ts`.
- [ ] **Any plan touching `EntityScreen.svelte`'s delete/confirm or capability-class branches:** Often missing an explicit "this is layout-only, no behavior changed" confirmation — verify by diffing for any change to conditionals, not just class attributes.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| Portaled row-action broke scoped test locators | LOW | Update the test to query the portaled content unscoped (post-click), or revert the portal-based composition choice if it doesn't earn its visual benefit |
| Duplicate testid strict-mode violation | LOW | Remove the testid from the wrapper (or the original element, whichever is now non-canonical); re-run the one affected spec to confirm |
| Dark-mode contrast regression discovered late | MEDIUM | Swap the offending arbitrary-opacity/hard-coded-gray class for the matching semantic token (`muted`/`accent`/`border`); re-check both color schemes before re-merging |
| Custom color literal merged | LOW–MEDIUM | Grep-find and replace with the nearest existing semantic token or icon/weight-based alternative; re-verify against the "no custom palette" constraint |
| Over-abstracted new component fragments the registry pattern | MEDIUM–HIGH | Fold the new component's markup back into `EntityScreen.svelte`/`Shell.svelte` directly, deleting the extraction, before it multiplies further across entities |
| `shadcn-svelte add --overwrite` reintroduced `mode-watcher`/toggle | MEDIUM | `git diff` the regenerated file, strip the reintroduced import/logic, re-run `design-system.spec.ts`'s `.dark`-class-never-applied assertion until it passes again (mirrors the exact recovery already performed once in v1.1) |
| `window.confirm`→`AlertDialog` scope creep landed inside a visual plan | LOW–MEDIUM | Split it out: revert the confirm-flow change from the visual diff, re-propose it (if desired) as its own scoped phase with its own Playwright coverage |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Row-action portaling breaks scoped locators | Entity table/row-action polish phase | Full 39-test suite green, not just the entity manually eyeballed; confirm `row.getByTestId(...)` chains still resolve |
| 2. Duplicate testid strict-mode violations | Every markup-restructuring phase | Per-file testid-count grep (`==1`) as an explicit plan-level verification step |
| 3. Dark-mode contrast regressions | Every visual-surface-touching phase + final cross-cutting verification phase | Manual/`emulateMedia` check in both color schemes per new surface; final phase adds at least one automated per-screen dual-scheme check |
| 4. Custom color creep | Standing constraint across all phases | Grep-gate for raw color literals outside `app.css` on every touched file |
| 5. Over-abstraction of `EntityScreen.svelte` | Any phase touching `EntityScreen.svelte`/`Shell.svelte` composition | Plan review checks proposed file list for new component files under `components/`; reject unless justified against the registry pattern |
| 6. Hit-target/focus-ring regressions from density | Entity table density phase + final cross-cutting verification phase | New keyboard-navigation/focus-visible smoke test added once, run against one screen per capability class |
| 7. `shadcn-svelte add` regeneration reintroducing removed behavior | Standing constraint across all phases (mirrors C-11 verification pattern) | `design-system.spec.ts`'s three assertions re-run immediately after any CLI regeneration, before other work continues |
| 8. Scope creep into functional changes (`window.confirm`, capability-class logic) | Roadmap-level decision (should be resolved before phase planning, not mid-execution) + every phase's plan review | Diff review confirms zero behavioral/conditional changes in any "visual polish" plan |

## Sources

- Direct codebase inspection (HIGH confidence): `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/app.css`, `web/e2e/*.spec.ts` (all 12 spec/helper files), `.planning/PROJECT.md` (v1.1 Key Decisions, especially the documented Sonner/`mode-watcher` incident and the logged `window.confirm` technical debt).
- [Radix Primitives — Portal docs](https://www.radix-ui.com/primitives/docs/utilities/portal) (MEDIUM confidence, general mechanism corroboration for portal-based menu/select/dialog components used via bits-ui in this codebase)
- [radix-ui/primitives Discussion #1130 — testing portalled elements](https://github.com/radix-ui/primitives/discussions/1130) (MEDIUM confidence)
- [shadcn/ui Issue #2885 — Card overflow-hidden best practices](https://github.com/shadcn-ui/ui/issues/2885) (MEDIUM confidence, corroborates the overflow-hidden/focus-ring interaction risk)
- [Playwright Locators docs — strict mode](https://playwright.dev/docs/locators) (HIGH confidence, official docs; strict-mode-violation behavior on multi-match locators)
- [ObserveOne — "strict mode violation: locator resolved to N elements"](https://www.observeone.com/community/errors/playwright/strict-mode-violation) (MEDIUM confidence, community corroboration of common causes/fixes)

---
*Pitfalls research for: spacing/composition polish on a tested shadcn-svelte + Tailwind v4 SPA*
*Researched: 2026-08-10*
