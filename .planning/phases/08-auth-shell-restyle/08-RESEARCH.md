# Phase 8: Auth & Shell Restyle - Research

**Researched:** 2026-08-09
**Domain:** shadcn-svelte 1.5.0 (bits-ui 2.x based) component adoption into two existing plain-CSS Svelte 5 screens (magic-code login, authenticated shell/nav), zero functional regression, zero human UAT
**Confidence:** HIGH (component source pulled live from the exact registry URL the installed CLI resolves against; CLI flags confirmed by running the installed binary's own `--help`; existing screens read in full this session)

## Summary

`web/src/lib/auth/LoginScreen.svelte` and `web/src/lib/Shell.svelte` are today two small, plain-HTML Svelte 5 components (91 and 72 lines) with zero shadcn-svelte components in use anywhere in the repo — Phase 7 only wired the Tailwind v4 + shadcn-svelte *foundation* (`components.json`, `src/lib/utils.ts`'s `cn()`, CSS tokens) and added no `.svelte` component under `src/lib/components/ui/`. This phase's first mechanical step is `bunx shadcn-svelte@latest add button input label card alert -y` from `web/`, which this session confirmed generates exactly five self-contained component groups from the `nova` style registry (fetched live from `https://shadcn-svelte.com/registry/styles/nova/<name>.json`, the identical URL the installed CLI itself resolves against). None of the five wraps an interactive bits-ui primitive with a render-prop/`asChild` API — `Button`, `Input`, `Card`, and `Alert` are plain native-element wrappers using `tv()` (tailwind-variants) for variant classes; only `Label` wraps a bits-ui primitive (`LabelPrimitive.Root`), and it exposes no special child-snippet API either. This means the asChild/child-snippet gotcha class of bugs that affects Dialog/Select/Popover-style shadcn-svelte components (deferred to Phase 10) simply does not apply to this phase's five components — every one of them forwards `...restProps` (including `data-testid`, `disabled`, `id`, `for`, `aria-current`, `onclick`) straight onto the native element it renders.

The one real, concrete gotcha: shadcn-svelte's generated `Button.svelte` defaults `type` to `"button"`, not `"submit"`. The current `LoginScreen.svelte` relies on native `<button type="submit">` semantics inside `<form onsubmit={...}>` — if the restyle omits an explicit `type="submit"` prop on the two submit buttons, clicking them will silently stop triggering the form's `onsubmit` handler (no error, just broken behavior), which is exactly the kind of "the flow looks right but doesn't work" bug this milestone's C-12 (zero human UAT) makes expensive to catch late. Every other testid/prop-forwarding path (`login-email`, `login-code`, `login-error`, `login-resend`, `logout`, `nav-${etype}`, `aria-current`) is a straight pass-through with no special handling needed.

A second correction to carry into planning: `08-PATTERNS.md` states `data-testid="app-shell"` lives inside `Shell.svelte`. Reading `web/src/App.svelte` directly this session shows the testid actually lives on a `<div>` in **App.svelte**, wrapping `<Shell />` — not inside `Shell.svelte`'s own template at all. This means the Shell restyle never touches `app-shell` directly; `auth.setup.ts`'s `app-shell` assertions are satisfied automatically as long as `App.svelte`'s wrapper div is left untouched (which it should be — it is out of this phase's file scope).

**Primary recommendation:** Run `bunx shadcn-svelte@latest add button input label card alert -y` from `web/` (installs `bits-ui` fresh as a `Label` dependency; `tailwind-variants`/`clsx`/`tailwind-merge` are already present from Phase 7). Restyle `LoginScreen.svelte` in place: `Card`/`CardContent` wraps both form steps, `Label`+`Input` pairs replace the raw `<label>`/`<input>`, `Button` replaces both submit buttons (explicit `type="submit"`) and the resend button (`type="button"`), a `LoaderCircle` icon (`@lucide/svelte/icons/loader-circle`, `class="animate-spin"`) renders inside the submit `Button`'s children when `ocupado` is true, and the error paragraph becomes `Alert variant="destructive"` > `CircleAlert` icon + `AlertDescription` carrying `data-testid="login-error"` verbatim. Restyle `Shell.svelte`: the logout button becomes a `Button` (e.g. `variant="outline"`), each nav button becomes a `Button` toggling `variant={ativo === cfg.etype ? "secondary" : "ghost"}` while keeping `aria-current`, `data-testid`, and the `onclick` handler byte-identical. Every `data-testid` currently in the two files must survive the restyle with the exact same string.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-code auth form rendering (Input/Label/Button/Card) | Browser/Client | — | Pure client-rendered Svelte components; no SSR tier exists in this Vite-only SPA |
| Auth request/response handling (`db.auth.sendMagicCode`/`signInWithMagicCode`/`signOut`) | Browser/Client (via `@instantdb/svelte` SDK) | Database/Storage (InstantDB backend validates the code) | The SDK call is client-side; the actual code validation and session issuance happens on InstantDB's hosted backend — this phase does not touch that boundary, only the UI wrapping the existing calls |
| Auth session reactivity (`db.useAuth()` flipping `SignedIn`/`SignedOut`) | Browser/Client | — | Reactive Svelte state (`$state`/rune-derived), resolved entirely in-browser; `App.svelte` owns the `SignedIn`/`SignedOut` boundary, untouched by this phase |
| Entity nav / active-route indication | Browser/Client | — | `Shell.svelte`'s `ativo` is a plain client-side `$state` string, not a URL route (no client-side router exists in this SPA) — "active route" in this app means "active in-memory nav selection," not a URL change |
| Component styling/tokens (shadcn-svelte `nova` preset) | Browser/Client (CSS custom properties resolved at paint time) | Build tooling (Vite bundles the generated `.svelte` files) | No new build-time concern beyond what Phase 7 already wired; components are static Svelte files copied into the repo by the CLI, then bundled normally |

## User Constraints

<user_constraints>
### Locked Decisions (from CONTEXT.md, do not reopen)

- **C-11**: shadcn-svelte via its own CLI default (`--preset b0` = nova/neutral/lucide, already initialized in Phase 7). No custom colors/tokens.
- **C-12**: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`, never `<human-check>`.
- **C-08**: `bun`/`bunx` only.

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Key operational note (carried forward from v1.0, verified still true this phase)

- The real magic-code auth round trip (`web/e2e/auth.setup.ts` + `web/e2e/helpers/magic-code.ts`) works by shelling out directly to `powershell.exe` on the Windows host from WSL (Outlook Classic COM bridge, `orules.ps1 peek`) — this is a plain OS subprocess call, NOT an MCP tool, so it is reachable from any Bash-capable process on this machine including a plan-executor subagent. **Verified this session:** `command -v powershell.exe` resolves to `/mnt/c/windows/System32/WindowsPowerShell/v1.0//powershell.exe` from this environment [VERIFIED: `command -v powershell.exe`, run this session]. There is no need to route magic-code auth through the orchestrator specifically for this milestone. The executor should feel free to run `bunx playwright test --project=setup` (and full `authed`-project specs) directly.
- Real inbox used: `tp@rbrasset.com.br`. Codes expire fast (~60-90s) — `auth.setup.ts` already handles the resend-on-expiry retry loop; do not add pauses between send and read.

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped.
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| AUTHUI-01 | `LoginScreen.svelte` rebuilt with shadcn-svelte `Input`, `Label`, `Button`, `Card`/`Alert` for error states, preserving the two-step auth flow exactly | See "Code Examples" for the exact registry source of all 5 components and a full restyled skeleton preserving every testid and handler; see "Common Pitfalls" for the `type="submit"` gotcha |
| AUTHUI-02 | Loading/error/success states of the login flow visually distinguishable via shadcn-svelte primitives, no bespoke CSS | See "Architecture Patterns: loading/error/success state mapping" and "Validation Architecture" for the concrete Playwright proof of each state |
| SHELLUI-01 | `Shell.svelte` rebuilt with shadcn-svelte `Button` + Tailwind flex/grid, no dashboard/panel | See "Code Examples: Shell.svelte restyle skeleton" |
| SHELLUI-02 | Active entity/section visually indicated in nav via shadcn convention | See "Architecture Patterns: active-nav-state pattern" — `variant={ativo === cfg.etype ? "secondary" : "ghost"}` toggle, verified against the live `button.json` registry source |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shadcn-svelte` | `1.5.0` [VERIFIED: npm registry, `npm view shadcn-svelte version`, run this session — already a devDependency, confirmed in `web/package.json`] | CLI that copies `button`/`input`/`label`/`card`/`alert` component source into `web/src/lib/components/ui/` | Already the project's chosen component-generation tool (C-11, Phase 7) |
| `bits-ui` | `2.18.1` [VERIFIED: npm registry, `npm view bits-ui version`, run this session] | Headless primitive that shadcn-svelte's `Label` wraps (`LabelPrimitive.Root`) | Installed automatically the first time `label` is added — **not yet in `web/package.json`** [VERIFIED: `web/package.json` devDependencies list read in full this session, `bits-ui` absent] — this phase is what pulls it in |
| `tailwind-variants` | `^3.3.1` [VERIFIED: already present in `web/package.json` devDependencies, installed by Phase 7's `shadcn-svelte init`] | Powers `Button`'s and `Alert`'s `tv()`-based variant classes | Already satisfied — no new install; `button.json`/`alert.json` registry entries declare `tailwind-variants@^3.3.0` as a devDependency, already exceeded by the installed `^3.3.1` |
| `@lucide/svelte` | `1.31.0` [VERIFIED: already present, Phase 7] | `LoaderCircle` (loading spinner) and `CircleAlert` (error icon) subpath imports | Already installed (C-11); subpath import pattern `@lucide/svelte/icons/<kebab-name>` confirmed via official shadcn-svelte Alert docs example [CITED: shadcn-svelte.com/docs/components/alert] |

### Supporting

None beyond the Core table — this phase adds no new runtime dependency beyond `bits-ui` (transitively pulled by `Label`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A dedicated `Spinner` component (`shadcn-svelte add spinner`) | `@lucide/svelte`'s `LoaderCircle` icon + `animate-spin` Tailwind class inside `Button`'s children | Chosen the icon approach — REQUIREMENTS.md AUTHUI-01 names exactly `Input`/`Label`/`Button`/`Card`/`Alert`; adding a 6th component (`Spinner`) is scope creep the requirement doesn't call for, and the icon approach is the documented fallback pattern for exactly this case [CITED: shadcn-svelte.com/docs/components/button, WebSearch-corroborated] |
| Wrapping the two-step form in `Card` (chosen) | Leaving the form bare, using `Card` only around the error `Alert` | Rejected leaving it bare — REQUIREMENTS.md AUTHUI-01's literal text is "Card/Alert for error states," and ROADMAP Phase 8 success criterion 1 explicitly lists `Card` as markup Playwright must locate at each auth step (not just on error), so `Card` wraps the whole two-step form, not just the error branch |

**Installation:**
```bash
cd web
bunx shadcn-svelte@latest add button input label card alert -y
```

**Version verification:** Confirmed live this session:
```bash
npm view shadcn-svelte version   # 1.5.0 (matches installed devDependency)
npm view bits-ui version         # 2.18.1
bunx shadcn-svelte@latest add --help   # confirms -y/--yes, -o/--overwrite, --skip-preflight, --no-deps-install flags
```
No package versions in this table are stale relative to training data — all were re-verified against the live registry and the installed CLI binary this session, matching Phase 7's `07-RESEARCH.md` findings (0 days of drift observed then; still current now).

## Package Legitimacy Audit

| Package | Registry | Age (latest version) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|-------------------|--------------|---------|-------------|
| `bits-ui` | npm | ~3 months (2026-05-03) | 941,914 | github.com/huntabyte/bits-ui | OK | Approved — new install this phase, ran `package-legitimacy check` this session |
| `@lucide/svelte` | npm | 0 days (2026-08-09) | 707,362 | github.com/lucide-icons/lucide | SUS ("too-new") | Approved — false positive, already installed since Phase 7, re-confirmed identical to Phase 7's own audit disposition (high downloads, recognizable org, zero postinstall, routine version bump not a new/hallucinated package) |
| `tailwind-variants` | npm | ~6 days at Phase 7 audit time | 3,426,441 | github.com/heroui-inc/tailwind-variants | SUS ("too-new") at Phase 7 | Already approved in `07-RESEARCH.md`; no new install this phase, no re-audit needed |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` requiring extra scrutiny (not a human checkpoint, per C-12):** `@lucide/svelte` — same false-positive disposition as Phase 7 (download-count + repo-provenance evidence stands in place of a human checkpoint, consistent with C-12's "no human-check anywhere" constraint).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────── Browser (Chromium, no server tier) ───────────────────────┐
│                                                                                    │
│  App.svelte                                                                       │
│   <SignedOut>  ──►  LoginScreen.svelte (restyled)                                 │
│                       step="email" ──[Input+Label+Button, type=submit]──►         │
│                       db.auth.sendMagicCode({email})                              │
│                       ├─ success ──► step="code"                                  │
│                       └─ error   ──► Alert[variant=destructive] (login-error)     │
│                       step="code" ──[Input+Label+Button, type=submit]──►          │
│                       db.auth.signInWithMagicCode({email, code})                  │
│                       ├─ success ──► db.useAuth() flips reactively                │
│                       └─ error   ──► Alert[variant=destructive] (login-error),    │
│                                       Button[login-resend] re-sends               │
│                                                                                    │
│   <SignedIn>  ──►  <div data-testid="app-shell">  ──►  Shell.svelte (restyled)    │
│                       nav Button×9 (variant=secondary if ativo===etype else ghost)│
│                       onclick sets ativo=cfg.etype ──► {#key ativo} remounts      │
│                                       EntityScreen(config=configByEtype(ativo))   │
│                       logout Button ──► db.auth.signOut() ──► SignedOut re-renders│
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
                         ▲
                         │ real magic-code round trip (async, live)
                         ▼
              InstantDB hosted backend (verify@auth-pm.instantdb.com sender)
```

### Recommended Project Structure

No new directories — `shadcn-svelte add` writes into the already-aliased path:
```
web/src/lib/
├── components/ui/
│   ├── button/{button.svelte,index.ts}      # new, from `add`
│   ├── input/{input.svelte,index.ts}        # new, from `add`
│   ├── label/{label.svelte,index.ts}        # new, from `add`
│   ├── card/{card.svelte,card-*.svelte,index.ts}   # new, from `add`
│   └── alert/{alert.svelte,alert-*.svelte,index.ts}# new, from `add`
├── auth/LoginScreen.svelte                  # restyled in place, same path
└── Shell.svelte                             # restyled in place, same path
```

### Pattern 1: Loading/error/success state mapping (AUTHUI-02)

**What:** Map the login flow's three states to three visually distinct shadcn primitives, with no bespoke CSS.
**When to use:** Both `enviarCodigo()` and `verificarCodigo()` in `LoginScreen.svelte`.

| State | Trigger | Primitive | Concrete markup |
|-------|---------|-----------|------------------|
| Loading | `ocupado === true` (while either `db.auth.*` call is in flight) | `Button` with `disabled` + `LoaderCircle` icon child | `<Button type="submit" disabled={ocupado}>{#if ocupado}<LoaderCircle class="animate-spin size-4" />{/if}Enviar código</Button>` |
| Error | `erro !== null` | `Alert variant="destructive"` | `<Alert variant="destructive"><CircleAlert class="size-4" /><AlertDescription data-testid="login-error">{erro}</AlertDescription></Alert>` |
| Success | `db.useAuth()` flips (`auth.user` becomes non-null) | No new primitive needed — success *is* the disappearance of `LoginScreen` and appearance of `Shell` inside `app-shell` | Already provable via the existing `app-shell` visibility assertion in `auth.setup.ts`; do not invent a "success" banner not asked for by any requirement |

**Example (registry-verified Alert usage with icon):**
```svelte
<!-- Source: https://www.shadcn-svelte.com/docs/components/alert (CITED, fetched via WebSearch this session) -->
<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
</script>

<Alert variant="destructive">
  <CircleAlert class="size-4" />
  <AlertDescription data-testid="login-error">{erro}</AlertDescription>
</Alert>
```

### Pattern 2: Active-nav-state via Button variant toggle (SHELLUI-02)

**What:** Represent "active route" (in this app, active in-memory `ativo` selection — there is no client-side router) by switching each nav `Button`'s `variant` prop, not a hand-rolled `.active` class.
**When to use:** `Shell.svelte`'s `{#each entityConfigs as cfg (cfg.etype)}` nav loop.
**Verified against the live `nova`-style `button.json` registry source** [VERIFIED: `curl https://shadcn-svelte.com/registry/styles/nova/button.json`, run this session] — the six available variants are `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. `secondary` (`bg-secondary text-secondary-foreground`) vs `ghost` (`hover:bg-muted`, no resting background) gives a resting-state background difference — assertable via `getComputedStyle(...).backgroundColor` even with no interaction, unlike `default`-vs-`ghost` which would look identical to `outline` at a glance in this nav context. `default` is reserved to avoid visually implying the nav item is a primary CTA.

```svelte
<!-- Source: registry-verified button.json variants + existing Shell.svelte handler (unchanged) -->
<nav>
  {#each entityConfigs as cfg (cfg.etype)}
    <Button
      type="button"
      variant={ativo === cfg.etype ? "secondary" : "ghost"}
      data-testid={`nav-${cfg.etype}`}
      aria-current={ativo === cfg.etype}
      onclick={() => (ativo = cfg.etype)}
    >
      {cfg.titulo}
    </Button>
  {/each}
</nav>
```

### Anti-Patterns to Avoid

- **Omitting `type="submit"` on restyled submit `Button`s:** `Button.svelte`'s generated default is `type = "button"` [VERIFIED: `https://shadcn-svelte.com/registry/styles/nova/button.json`, `let { ..., type = "button", ... }: ButtonProps = $props();`, run this session]. The current code's two submit buttons are native `<button type="submit">` inside `<form onsubmit={...}>`; losing the explicit `type="submit"` prop silently breaks the two-step flow with no console error.
- **Adding a `Spinner` or other 6th component not named in AUTHUI-01/ROADMAP criterion 1:** use the `LoaderCircle` icon-in-`Button` pattern instead (see Pattern 1) — keeps the component surface exactly what the requirement lists.
- **Re-deriving `app-shell` inside `Shell.svelte`:** that testid lives in `App.svelte`'s wrapper `<div>`, not `Shell.svelte`'s own template [VERIFIED: `web/src/App.svelte:15`, `<div data-testid="app-shell">`, read in full this session] — do not add a second `app-shell` element inside `Shell.svelte`, and do not remove/rename the one in `App.svelte` (out of this phase's file scope).
- **Refactoring `onMount` to `$effect` in `Shell.svelte`:** the existing code has a deliberate, commented rationale (lines 12-18) for `onMount`-not-`$effect` semantics; a visual restyle must not touch this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button variant/size class composition | Bespoke `class="btn btn-primary"`-style CSS | `Button`'s own `tv()`-generated `buttonVariants()` | Already ships focus-ring, disabled-opacity, and icon-sizing rules (`[&_svg:not([class*='size-'])]:size-4`) that a hand-rolled class would have to reinvent to match the rest of the app after Phases 9-10 add more shadcn components |
| Error-banner styling (border/background/icon layout for destructive state) | A custom `.error-box` CSS class | `Alert variant="destructive"` | The registry's `alertVariants` already encodes the icon-grid layout (`has-[>svg]:grid-cols-[auto_1fr]`) and dark-mode-aware destructive color tokens (`dark:bg-destructive/20`) — reinventing this loses automatic dark-mode correctness that Phase 7 already wired |
| Loading-spinner animation | Custom `@keyframes spin` CSS | Tailwind's built-in `animate-spin` utility class on the lucide icon | Zero-CSS, already available via Tailwind v4 (Phase 7), matches the exact class used in the official shadcn-svelte Button loading example |

**Key insight:** Every one of this phase's five components is a thin, already-styled wrapper around a native HTML element or (for `Label`) a single unstyled bits-ui primitive — there is no case in this phase where hand-writing CSS is faster or safer than using the generated component's own prop surface.

## Common Pitfalls

### Pitfall 1: `Button`'s default `type` breaks native form submission

**What goes wrong:** Clicking the restyled submit button does nothing — no network call, no error, no `erro` state change.
**Why it happens:** `Button.svelte`'s destructured default is `type = "button"` [VERIFIED: registry source, quoted in Anti-Patterns above]. A native `<button type="button">` inside a `<form>` never triggers `onsubmit`.
**How to avoid:** Pass `type="submit"` explicitly on both step's submit `Button` (mirroring the current plain-HTML code's explicit `type="submit"` at lines 65 and 80 of `LoginScreen.svelte`).
**Warning signs:** A Playwright test clicking `login-submit` and then waiting for `login-code`/`login-error`/`app-shell` to appear will time out with no page error logged — the click event fires, nothing downstream happens.

### Pitfall 2: `data-testid="login-submit"` reused across two different `Button` instances

**What goes wrong:** If the restyle accidentally gives the two submit buttons different testids (e.g. `login-submit-email`/`login-submit-code`), `auth.setup.ts` lines 29 and 33 (`page.getByTestId("login-submit").click()`, called twice, once per step) will resolve to zero or the wrong element on the second call.
**Why it happens:** It is visually tempting to give each step's button a more "semantic" distinct testid during a restyle, since they are now two separate `Button` component instances instead of two `{#if}`-branched raw `<button>` tags.
**How to avoid:** Keep the literal string `"login-submit"` on both `Button` instances — `{#if step === "email"}...{:else}...{/if}` branching already ensures only one is ever mounted at a time, so no collision risk exists.
**Warning signs:** `auth.setup.ts`'s live round trip fails at the code-entry step specifically (first click on `login-submit` for the email step still works, second click for the code step fails).

### Pitfall 3: Inducing the "error" state without a flaky wait for real code expiry

**What goes wrong:** Waiting ~60-90s for a real magic code to expire (per `PROJECT.md` C-10) to test the error/`Alert` path makes the new spec slow and non-deterministic in CI-like unattended runs.
**Why it happens:** The most "obvious" way to induce InstantDB's `record-expired` error is to wait for the natural expiry window.
**How to avoid:** Request a real magic code (live round trip, same as `auth.setup.ts`), then submit a deliberately wrong 6-digit value (e.g. increment the last digit) instead of the real code read from the inbox. InstantDB's live `signInWithMagicCode` rejects an incorrect code immediately with the same error path (`erro` set, `Alert` rendered) — this is a genuine live rejection from the real backend, not a mock, and completes in the same timeframe as the rest of the round trip, no expiry wait needed.
**Warning signs:** A new "error state" test takes >60s per run or is flaky across runs — a sign it is waiting for natural expiry instead of submitting a wrong code.

### Pitfall 4: Assuming `Card`'s root div needs the `login-screen` testid

**What goes wrong:** Moving `data-testid="login-screen"` off the outer wrapping `<div>` and onto `Card`'s root risks losing it if `Card` is later restructured (e.g. Phase 9/10 introduce a shared page-shell wrapper).
**Why it happens:** It looks redundant to have both an outer `<div data-testid="login-screen">` and an inner `<Card>` — tempting to collapse them into one element.
**How to avoid:** Keep the existing outer `<div data-testid="login-screen">` wrapping the `Card` (matches `08-PATTERNS.md`'s own guidance: "`data-testid="login-screen"` stays on the outermost wrapping `<div>`, can wrap the Card"). This costs nothing and decouples the testid from whatever `Card` internally renders.
**Warning signs:** None currently — this is a forward-looking pitfall, not something that will fail this phase's own tests, but will make Phase 9/10 easier if followed now.

## Code Examples

### `LoginScreen.svelte` restyle skeleton (script section unchanged verbatim; markup restyled)

```svelte
<!-- Script block: byte-identical to current LoginScreen.svelte lines 1-51 (read in full this
     session) — step/email/code/erro/ocupado $state, enviarCodigo/verificarCodigo/onSubmitEmail/
     onSubmitCode/reenviar — no changes to this phase's business logic. -->

<div data-testid="login-screen">
  <Card>
    <CardContent>
      {#if step === "email"}
        <form onsubmit={onSubmitEmail}>
          <Label for="login-email">E-mail</Label>
          <Input
            id="login-email"
            data-testid="login-email"
            type="email"
            bind:value={email}
            required
            disabled={ocupado}
          />
          <Button type="submit" data-testid="login-submit" disabled={ocupado}>
            {#if ocupado}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            Enviar código
          </Button>
        </form>
      {:else}
        <p>Código enviado para {email}</p>
        <form onsubmit={onSubmitCode}>
          <Label for="login-code">Código</Label>
          <Input
            id="login-code"
            data-testid="login-code"
            type="text"
            inputmode="numeric"
            bind:value={code}
            required
            disabled={ocupado}
          />
          <Button type="submit" data-testid="login-submit" disabled={ocupado}>
            {#if ocupado}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            Entrar
          </Button>
          <Button type="button" variant="ghost" data-testid="login-resend" onclick={reenviar} disabled={ocupado}>
            Reenviar código
          </Button>
        </form>
      {/if}

      {#if erro}
        <Alert variant="destructive">
          <CircleAlert class="size-4" />
          <AlertDescription data-testid="login-error">{erro}</AlertDescription>
        </Alert>
      {/if}
    </CardContent>
  </Card>
</div>
```

Every `data-testid` above is copied verbatim from `web/src/lib/auth/LoginScreen.svelte` lines 53, 59, 65, 73, 80, 81, 88 (read in full this session — quoted in the Summary/Pitfalls above). No testid string differs from the current file.

### `Shell.svelte` restyle skeleton (script section, `routine-job-state` div, and `{#key ativo}` block unchanged verbatim)

```svelte
<!-- Script block and the hidden data-testid="routine-job-state" div: byte-identical to current
     Shell.svelte lines 1-46 (read in full this session) — onMount job-tracking logic untouched. -->

{#if !auth.isLoading && auth.user}
  <p>autenticado como {auth.user.email}</p>
{/if}
<Button type="button" variant="outline" data-testid="logout" onclick={() => db.auth.signOut()}>
  Sair
</Button>

<nav class="flex gap-2">
  {#each entityConfigs as cfg (cfg.etype)}
    <Button
      type="button"
      variant={ativo === cfg.etype ? "secondary" : "ghost"}
      data-testid={`nav-${cfg.etype}`}
      aria-current={ativo === cfg.etype}
      onclick={() => (ativo = cfg.etype)}
    >
      {cfg.titulo}
    </Button>
  {/each}
</nav>

<!-- {#key ativo} block: byte-identical to current Shell.svelte lines 66-71 -->
```

`logout`, `nav-${cfg.etype}`, `aria-current`, and the `onclick` handlers are copied verbatim from `web/src/lib/Shell.svelte` lines 51, 57-59 (read in full this session).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| shadcn-svelte components importing bits-ui's `Button.Root`/`asChild` render-prop pattern | shadcn-svelte's `nova`-style `Button`/`Input`/`Card`/`Alert` are plain native-element wrappers with zero bits-ui import | Confirmed live in the currently-installed `1.5.0` CLI's `nova` registry this session — this is a departure from older shadcn-svelte styles/versions that did wrap bits-ui `Button` primitives | No `asChild`/child-snippet handling needed for this phase's 5 components — simpler restyle than a stale mental model of shadcn-svelte would predict |
| shadcn-svelte class-based `.dark` dark mode | `prefers-color-scheme` media query (Phase 7) | Phase 7, this milestone | Already resolved — nothing for Phase 8 to do, just use `bg-background`/`text-foreground`-style utility classes and let existing tokens swap automatically |

**Deprecated/outdated:** None specific to this phase — the components fetched this session are the current registry output for the exact style/version already pinned in `web/components.json` (`"style": "nova"`) and `web/package.json` (`shadcn-svelte@^1.5.0`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `secondary` (not `default`) is the right "active" nav variant, chosen for a resting-state background difference vs `ghost` | Architecture Patterns: Pattern 2 | Low — purely cosmetic; if the planner/executor prefers `default` for a stronger visual pop, SHELLUI-02's Playwright proof strategy (computed-style diff between active/inactive) works identically regardless of which two variants are chosen, as long as they differ |
| A2 | Submitting a deliberately-wrong 6-digit code (not natural expiry) is an acceptable "real induced error case" for ROADMAP Phase 8 success criterion 2 | Common Pitfalls: Pitfall 3 | Medium — if a stricter reading of "real induced error" requires the literal expiry path (not a wrong-code rejection), the new error-state test would need a ~60-90s wait instead; both are genuine live-backend rejections, just triggered differently |
| A3 | `LoaderCircle` + `animate-spin` (icon-in-Button) satisfies AUTHUI-02's "loading state" requirement without adding a `Spinner` component | Architecture Patterns: Pattern 1 | Low — this is the officially documented shadcn-svelte fallback pattern for projects that haven't added the `Spinner` component; if a future phase adds `Spinner` anyway (e.g. for entity-form loading in Phase 10), this phase's icon-based approach can be swapped later with no testid impact |

## Open Questions

1. **Should `Shell.svelte`'s main content area (`{#key ativo}...{/key}` block) be wrapped in a `Card` for visual consistency with the restyled `LoginScreen`?**
   - What we know: REQUIREMENTS.md's SHELLUI-01 only names `Button` + "standard layout utilities (flex/grid via Tailwind)" for `Shell.svelte` — `Card` is not named.
   - What's unclear: Whether omitting it looks visually inconsistent next to the `Card`-wrapped login screen.
   - Recommendation: Leave it unwrapped per the literal requirement text (matches `08-PATTERNS.md`'s own read: "`Card` could optionally wrap the main content area... but this is discretionary"). Phase 9/10 own the entity-screen visual design in depth; Phase 8 should not preempt that.

2. **Does the new e2e coverage for this phase belong in a new spec file, or as additions to `design-system.spec.ts`/`auth.setup.ts`/`auth.spec.ts`?**
   - What we know: `design-system.spec.ts` runs in the auth-free `anon` project; `auth.spec.ts` runs in the `authed` project (reuses `setup`'s persisted storageState, no live email needed); `auth.setup.ts` is the `setup` project itself (one real live round trip, already proves the happy path).
   - What's unclear: Whether the planner should extend `auth.setup.ts` in place (risk: making the `setup` project's one test do double duty as both session-bootstrap and error-state proof) vs. adding a dedicated new spec.
   - Recommendation: See Validation Architecture below — add a new spec dedicated to the wrong-code error case and loading-state assertions (own live round trip, added to the `anon` project's `testMatch`), and add a new spec for nav/active-state/logout assertions to the `authed` project (reuses persisted session, no new live email needed). Do not overload `auth.setup.ts` itself, which Phase 11's VERIFY-01/02 explicitly still needs to pass unmodified as the session-bootstrap contract.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun`/`bunx` | C-08, running `shadcn-svelte add` and Playwright | ✓ | `1.3.12` [VERIFIED: `bun -v`, run this session] | — |
| `node` | tooling scripts | ✓ | `v20.20.2` [VERIFIED: `node -v`, run this session] | — |
| `powershell.exe` (WSL→Windows host) | live magic-code round trip in Playwright `setup`/`anon` projects | ✓ | resolves to `/mnt/c/windows/System32/WindowsPowerShell/v1.0//powershell.exe` [VERIFIED: `command -v powershell.exe`, run this session] | — |
| Network access to `shadcn-svelte.com` registry | `shadcn-svelte add` fetching component source | ✓ | confirmed via direct `curl` to the registry API this session | — |
| Network access to InstantDB (`instantdb.com`) | live auth round trip | ✓ (implied — Phase 7's `design-system.spec.ts`/`no-leakage.spec.ts` already pass against the live app; not independently re-checked this session) | — | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` `^1.62.1` [VERIFIED: `web/package.json` devDependencies, read this session] |
| Config file | `web/playwright.config.ts` (three projects: `setup`, `authed` depends-on `setup`, `anon` with empty storageState) [VERIFIED: `web/playwright.config.ts`, read in full this session] |
| Quick run command | `bun run test:e2e:auth` (runs only `setup` — real magic-code round trip) or a targeted `bunx playwright test <file> --project=<name>` |
| Full suite command | `bun run test:e2e` (all three projects) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTHUI-01 (happy-path structural) | Login form at each step renders shadcn `Input`/`Label`/`Button`/`Card` markup, real magic-code round trip completes | e2e (live, `setup` project) | `bunx playwright test e2e/auth.setup.ts --project=setup` | ✅ `web/e2e/auth.setup.ts` exists — already asserts `login-screen`/`login-email`/`login-submit`/`login-code`/`app-shell`; needs no new assertions, just needs to keep passing against the restyled markup |
| AUTHUI-02 (loading state) | Submit `Button` shows `disabled` + `LoaderCircle` while `ocupado` | e2e (live, new spec) | `bunx playwright test e2e/login-flow.spec.ts --project=anon` | ❌ Wave 0 — new file, added to `anon` project's `testMatch` in `playwright.config.ts` |
| AUTHUI-02 (error state) | Submitting a wrong code renders `Alert[variant=destructive]` with `data-testid="login-error"` containing the real backend's rejection message | e2e (live, new spec, same file as above) | same command as above | ❌ Wave 0 — same new file |
| AUTHUI-02 (success state) | After correct code, `app-shell` becomes visible and `login-screen` becomes not-visible | e2e (live, already covered) | `bunx playwright test e2e/auth.setup.ts --project=setup` | ✅ already asserted, lines 57-63 |
| SHELLUI-01 | Clicking each of the 9 nav `Button`s renders the corresponding `EntityScreen` | e2e (authed, new spec) | `bunx playwright test e2e/shell-nav.spec.ts --project=authed` | ❌ Wave 0 — new file, reuses persisted storageState from `auth.spec.ts`'s established pattern |
| SHELLUI-02 | Exactly one nav `Button` shows the active-state variant (computed-style diff) at a time, tracking `ativo` | e2e (authed, same new spec) | same command as above | ❌ Wave 0 — same new file |
| SHELLUI-01/02 (logout) | Clicking `logout` ends the session, `login-screen` reappears | e2e (authed, same new spec) | same command as above | ❌ Wave 0 — same new file |

### Sampling Rate

- **Per task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=<matching project>` — no need to run the full suite after every task.
- **Per wave merge:** `bun run test:e2e` (full suite — `setup` → `authed` → `anon`, all live against InstantDB).
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `bun run check` and `bun run lint` (Biome + `svelte-check`, per C-08/QUAL-01) clean.

### Wave 0 Gaps

- [ ] `web/e2e/login-flow.spec.ts` — covers AUTHUI-02 loading/error states via a live round trip + deliberate wrong-code submission (see Pitfall 3), added to `playwright.config.ts`'s `anon` project `testMatch` regex (additive edit, same pattern Phase 7 used for `design-system.spec.ts`).
- [ ] `web/e2e/shell-nav.spec.ts` — covers SHELLUI-01/02 nav/active-state/logout, added to the `authed` project's default `testMatch` (no config edit needed — `authed`'s `testMatch: /.*\.spec\.ts/` already includes any new `*.spec.ts` file not explicitly ignored).
- [ ] Framework install: none — `@playwright/test` already installed and configured (Phase 6/7).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes | Unchanged this phase — `db.auth.sendMagicCode`/`signInWithMagicCode` calls are visual-wrapper-only, InstantDB's own magic-code backend logic is untouched. No new auth mechanism introduced. |
| V3 Session Management | yes | Unchanged — session storage (`localStorage`/IndexedDB via `@instantdb/svelte`) is not touched by this phase; `App.svelte`'s `SignedIn`/`SignedOut` boundary is out of file scope |
| V4 Access Control | no | This phase touches no permission logic (`instant.perms.ts` untouched) |
| V5 Input Validation | yes | `Input`'s `required`/`type="email"`/`type="text" inputmode="numeric"` attributes are preserved verbatim from the existing markup — no new validation logic added or removed |
| V6 Cryptography | no | No cryptographic code in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Error message leaking backend internals via `Alert`'s rendered text | Information Disclosure | Unchanged from current behavior — `erro` is set from `err.body?.message ?? "<hardcoded PT-BR fallback>"`, identical fallback pattern preserved; this phase does not change what error text is shown, only how it's styled |
| XSS via unsanitized `erro`/`email`/`code` interpolation into markup | Tampering | Svelte's default text interpolation (`{erro}`, `{email}`) is auto-escaped — unchanged by this restyle; no `{@html}` is introduced anywhere in either restyled file |

## Sources

### Primary (HIGH confidence)

- `https://shadcn-svelte.com/registry/styles/nova/button.json` — full `Button.svelte` source, fetched live via `curl` this session [VERIFIED]
- `https://shadcn-svelte.com/registry/styles/nova/input.json` — full `Input.svelte` source, fetched live this session [VERIFIED]
- `https://shadcn-svelte.com/registry/styles/nova/label.json` — full `Label.svelte` source, fetched live this session [VERIFIED]
- `https://shadcn-svelte.com/registry/styles/nova/card.json` — full `Card` component group source, fetched live this session [VERIFIED]
- `https://shadcn-svelte.com/registry/styles/nova/alert.json` — full `Alert` component group source, fetched live this session [VERIFIED]
- `bunx shadcn-svelte@latest add --help` / `... --help` — CLI flags confirmed by running the installed binary this session [VERIFIED]
- `npm view shadcn-svelte version`, `npm view bits-ui version` — registry versions confirmed this session [VERIFIED]
- `gsd_run query package-legitimacy check --ecosystem npm bits-ui / @lucide/svelte` — legitimacy verdicts this session [VERIFIED]
- `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/Shell.svelte`, `web/src/App.svelte`, `web/src/lib/utils.ts`, `web/e2e/auth.setup.ts`, `web/e2e/auth.spec.ts`, `web/e2e/design-system.spec.ts`, `web/playwright.config.ts`, `web/package.json`, `web/components.json` — all read in full this session [VERIFIED]

### Secondary (MEDIUM confidence)

- shadcn-svelte official Alert docs (icon usage example) — via WebSearch this session [CITED: shadcn-svelte.com/docs/components/alert]
- shadcn-svelte official Button docs (loading-state icon example) — via WebSearch this session [CITED: shadcn-svelte.com/docs/components/button]

### Tertiary (LOW confidence)

- None — every claim in this document that could be verified directly against installed tooling, live registry source, or in-repo files was verified that way rather than left as training-data recall.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and component source pulled live from the exact registry the installed CLI uses, not training data
- Architecture: HIGH — the two files being restyled were read in full this session; the App.svelte correction (`app-shell` location) was caught by direct reading, not assumed from `08-PATTERNS.md`
- Pitfalls: HIGH — the `type="submit"` default was confirmed by reading the actual generated `Button.svelte` source, not inferred from a general shadcn-svelte mental model

**Research date:** 2026-08-09
**Valid until:** 30 days (stable component registry; re-verify `shadcn-svelte`/`bits-ui` versions if this phase's execution slips past early September 2026, per this stack's observed release cadence)
