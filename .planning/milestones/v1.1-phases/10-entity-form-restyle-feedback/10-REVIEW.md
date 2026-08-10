---
phase: 10-entity-form-restyle-feedback
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - web/src/lib/entities/EntityScreen.svelte
  - web/src/App.svelte
  - web/src/lib/auth/LoginScreen.svelte
  - web/src/lib/Shell.svelte
  - web/src/lib/components/ui/sonner/sonner.svelte
  - web/src/lib/components/ui/sonner/index.ts
  - web/package.json
  - web/bun.lock
  - web/e2e/entities-form-restyle.spec.ts
  - web/e2e/helpers/form-controls.ts
  - web/e2e/entities-ticket-subtarefa.spec.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: clean
fixed_at: 2026-08-10T00:00:00Z
resolved:
  - id: WR-01
    commit: b748198
    note: >-
      Reordered Popover.Trigger's {#snippet child({ props })} composition
      in web/src/lib/entities/EntityScreen.svelte so {...props} spreads
      FIRST and the explicit id/data-testid/class attributes override it
      (canonical shadcn-svelte pattern). Verified live via Playwright
      (authed project, --no-deps, reusing the persisted
      e2e/.auth/user.json storageState to avoid a new magic-code send):
      the fundos.createdAt date-picker trigger renders
      id="field-createdAt" with the full "w-full justify-start
      text-start font-normal" class list, and
      label[for="field-createdAt"] resolves to it. bun run check / bun
      run lint clean (0 new issues beyond the pre-existing baseline).
  - id: WR-02
    commit: eb8e84f
    note: >-
      Shell.svelte's logout handler now awaits db.auth.signOut() inside
      a try/catch, calling toast.success only after the promise
      resolves and toast.error (plus console.error for diagnosis) on
      rejection — matching the try/catch + outcome-matching toast
      pattern used by EntityScreen.svelte's
      handleSubmit/handleDelete. Verified live via Playwright (authed
      project, --no-deps, reusing the persisted e2e/.auth/user.json
      storageState): shell-nav.spec.ts's logout test still passes,
      asserting the success toast after a real signOut(). bun run
      check / bun run lint clean (0 new issues beyond the pre-existing
      baseline).
acknowledged_not_fixed:
  - id: IN-01
    note: >-
      CLI-generated Calendar boilerplate
      (web/src/lib/components/ui/calendar/calendar-caption.svelte:50)
      out of scope per review instructions — not touched.
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** standard
**Files Reviewed:** 11 (plus targeted traces into `web/node_modules/bits-ui` and generated `web/src/lib/components/ui/{popover,checkbox,select,button}/*` to verify one suspected prop-order bug)
**Status:** clean

**Fix pass (2026-08-10):** Both Warning findings (WR-01, WR-02) fixed and committed — see "Resolved:" notes under each finding below and the `resolved:` list in the frontmatter. IN-01 acknowledged, not fixed (CLI-generated boilerplate, out of scope per review instructions).

## Summary

Reviewed the hand-edited files from Phase 10 (Dialog/Select/Checkbox/Textarea/Popover+Calendar conversion of `EntityScreen.svelte`, the Alert-based validation surface, and the Sonner toast wiring in `App.svelte`/`LoginScreen.svelte`/`Shell.svelte`, plus the hand-written `sonner.svelte`).

Confirmed via `git diff 0c47544 HEAD -- web/src/lib/entities/EntityScreen.svelte`:
- `handleSubmit`/`handleDelete`/`startCreate`/`startEdit`/`cancelForm`/the xor-unlink-on-switch logic/the `parent_not_found` pre-check are byte-identical except for additive `toast.success()`/`toast.error()` calls alongside every pre-existing `formError` assignment and success path. No control-flow, no new state beyond `datePopoverOpen`, no business-logic change.
- Every load-bearing testid (`field-*`, `link-*`, `xor-parent-type`, `entity-submit`, `entity-cancel`, `entity-error`, `entity-create-start`, `row-edit`, `row-delete`) survives the conversion unchanged.
- Capability guards (`config.capabilities.create/update/delete`) are untouched.
- `sonner.svelte` is genuinely hand-written, imports only `Toaster as Sonner`/`type ToasterProps`, hardcodes `theme="system"`, contains zero `mode-watcher` reference. `web/package.json`/`web/bun.lock` confirm zero `mode-watcher` and exactly one new dependency (`svelte-sonner@1.1.1`).
- `web/e2e/entities-form-restyle.spec.ts` is a real, live spec (CLI-fixture sweep/cleanup, `db`-backed reload assertions, real `data-sonner-toast` DOM assertions) — not stubbed. `login-flow.spec.ts`/`shell-nav.spec.ts` toast assertions are likewise real, not placeholders.
- `bun run check` (svelte-check) is clean (0 errors, 1 pre-existing, phase-10-unrelated `state_referenced_locally` info on the `configProp` snapshot, present before this phase). `bun run lint` (Biome) is clean except one info-level finding in CLI-generated boilerplate (see IN-01).

Two genuine defects were found by tracing the date-picker's `Popover.Trigger` + `{#snippet child({ props })}` composition down through the installed `bits-ui`/shadcn-svelte wrapper chain, and one in `Shell.svelte`'s logout handler. Neither is a data-loss or security issue, but the first is a real, provable, phase-wide visual regression in a phase whose entire purpose is the visual restyle, and the second breaks the "outcome-matching toast" claim made in this phase's own SUMMARY.

## Warnings

### WR-01: Date-picker trigger Button loses its `id` and layout classes to bits-ui's own auto-generated props

**Resolved:** Fixed in commit `b748198`. `{...props}` now spreads first in `EntityScreen.svelte`'s `Popover.Trigger` snippet, with the explicit `id`/`data-testid`/`class` attributes listed after it so they override bits-ui's forwarded values (canonical shadcn-svelte pattern — see `calendar-month-select.svelte`/`calendar-year-select.svelte` for the same convention already in this codebase). Verified live via Playwright (`authed` project, `--no-deps`, reusing the persisted `e2e/.auth/user.json` storageState to avoid a new magic-code send): the fundos `createdAt` date-picker trigger renders `id="field-createdAt"` with the full `w-full justify-start text-start font-normal` class list, and `label[for="field-createdAt"]` resolves to it. `bun run check`/`bun run lint` clean (0 new issues beyond the pre-existing baseline).

**File:** `web/src/lib/entities/EntityScreen.svelte:525-545`

**Issue:** The date field's `Popover.Trigger` uses the `{#snippet child({ props })}` pattern, and spreads `{...props}` **after** the explicit `id`/`class` attributes:

```svelte
<Popover.Trigger>
  {#snippet child({ props })}
    <Button
      variant="outline"
      id={`field-${f.name}`}
      data-testid={`field-${f.name}`}
      class={cn(
        "w-full justify-start text-start font-normal",
        !formValues[f.name] && "text-muted-foreground",
      )}
      {...props}
    >
```

`props` here is bits-ui's `PopoverTriggerState.props` getter, which unconditionally includes its own `id` (`this.opts.id.current`, auto-generated via `createId(uid)` because no `id` was ever passed down to the real `PopoverPrimitive.Trigger`) and, transitively through the `popover-trigger.svelte` wrapper's own `class={cn("", className)}` forwarding, a `class: ""` key (confirmed by reading `web/node_modules/bits-ui/dist/bits/popover/popover.svelte.js:226-240` and `web/src/lib/components/ui/popover/popover-trigger.svelte`).

Because `{...props}` is spread **after** the explicit `id`/`class` in a Svelte component prop list, JS/Svelte's "last attribute wins" merge rule means:
- The rendered `<button>`'s `id` ends up as bits-ui's auto-generated id (e.g. `bits-3-trigger`), **not** `field-${f.name}` — breaking the `<Label for={`field-${f.name}`}>` association for every date field, on every entity that has one (fundos.createdAt, tarefas/tickets due dates, projetos/etapas planned dates, etc.).
- The `class` ends up as `""` (bits-ui's forwarded empty string overrides the explicit `cn(...)` call), so the button loses `w-full`, `justify-start`, `text-start`, `font-normal`, and the conditional `text-muted-foreground` placeholder styling entirely. Only `Button`'s own base `outline`-variant classes remain, so the date-picker trigger renders content-width and center-justified instead of full-width and left-aligned like every sibling `Input`/`Select.Trigger` in the same form — a visible, provable regression in the very phase whose purpose is this restyle.

`data-testid` survives (bits-ui's `props` never contains that key), which is why the Playwright suite stays green — the bug is invisible to the existing e2e assertions, which use `getByTestId` exclusively (see `web/e2e/helpers/form-controls.ts`'s `pickDate()`), not `id`/class snapshot/visual assertions.

**Fix:** Spread `{...props}` **first**, then let the explicit attributes override it (the canonical shadcn-svelte date-picker pattern):

```svelte
<Button
  {...props}
  variant="outline"
  id={`field-${f.name}`}
  data-testid={`field-${f.name}`}
  class={cn(
    "w-full justify-start text-start font-normal",
    !formValues[f.name] && "text-muted-foreground",
  )}
>
```

### WR-02: `Shell.svelte`'s logout toast fires unconditionally, not on confirmed success

**Resolved:** Fixed in commit `eb8e84f`. The logout handler now awaits `db.auth.signOut()` inside a `try/catch`: `toast.success` fires only after the promise resolves, and a rejection triggers `console.error` (for diagnosis) plus `toast.error("Falha ao sair.")` — matching the try/catch + outcome-matching toast pattern used by `EntityScreen.svelte`'s `handleSubmit`/`handleDelete`. Verified live via Playwright (`authed` project, `--no-deps`, reusing the persisted `e2e/.auth/user.json` storageState): `shell-nav.spec.ts`'s logout test still passes, asserting the success toast after a real `signOut()`. `bun run check`/`bun run lint` clean (0 new issues beyond the pre-existing baseline — a transient `noUnusedVariables` warning on the caught `err` was resolved by logging it via `console.error`).

**File:** `web/src/lib/Shell.svelte:53-63`

**Issue:**

```svelte
<Button
  ...
  onclick={() => {
    void db.auth.signOut();
    toast.success("Você saiu.");
  }}
>
```

`db.auth.signOut()` is fire-and-forgotten (`void`), and `toast.success(...)` runs synchronously right after, regardless of whether the sign-out call actually succeeds. Every other write path touched by this phase (`EntityScreen.svelte`'s `handleSubmit`/`handleDelete`, `LoginScreen.svelte`'s `enviarCodigo`/`verificarCodigo`) wraps the async call in `try/catch` and only calls `toast.success` after `await` resolves, calling `toast.error` in the `catch` — this is the one write path in the phase that doesn't follow that pattern, contradicting this phase's own SUMMARY claim that "logging out produces an outcome-matching toast." If `signOut()` ever rejects (e.g. transient network failure while clearing the session), the user is told "Você saiu." while the session may not actually have been cleared client-side, and no error is surfaced anywhere.

**Fix:**

```svelte
onclick={async () => {
  try {
    await db.auth.signOut();
    toast.success("Você saiu.");
  } catch (err) {
    toast.error("Falha ao sair.");
  }
}}
```

## Info

### IN-01: Biome flags a missing radix parameter in CLI-generated Calendar boilerplate

**Acknowledged, not fixed:** CLI-generated boilerplate, out of scope per review instructions — left untouched by the fix pass on 2026-08-10.

**File:** `web/src/lib/components/ui/calendar/calendar-caption.svelte:50`

**Issue:** `bun run lint` reports one info-level `lint/correctness/useParseIntRadix` finding: `Number.parseInt(e.currentTarget.value)` has no radix argument. This is CLI-generated boilerplate (out of this review's primary scope per the review instructions), but it is a real, tool-flagged defect that would fail a stricter CI gate (e.g. if `useParseIntRadix` were ever promoted from info to error in `biome.json`).

**Fix:** `Number.parseInt(e.currentTarget.value, 10)` (Biome's own suggested unsafe-fix).

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
