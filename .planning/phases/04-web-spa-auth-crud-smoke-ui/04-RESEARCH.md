# Phase 4: Web SPA Auth & CRUD Smoke UI - Research

**Researched:** 2026-08-09
**Domain:** `@instantdb/svelte` (v1.0.63) magic-code auth + InstaQL/InstaML CRUD in a Svelte 5 runes SPA, plus headless E2E proof of auth/data-leakage behavior
**Confidence:** HIGH (all core API claims verified directly against the installed package's TypeScript source/`.d.ts` files and source code, not training-data guesses)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
PROJECT.md C-05 is LOCKED: same magic-code auth, same `instant.perms.ts` rules as the CLI — SPA and CLI are equally-privileged, equally-authenticated clients of the same backend. Keep screens minimal: forms + tables, no visual design investment.

**Autonomous magic-code auth testing (LOCKED — see PROJECT.md C-10):** This phase's login screen requires a real magic-code email round trip to prove SC-1 and SC-4. The working channel on this machine is Outlook Classic (desktop) accessed via COM from WSL through `/mnt/c/Users/thomaz.pougy/Documents/RBR/Sandbox/outlook-rules`'s `orules.ps1 peek` command (NOT the Microsoft 365 MCP tool — no access to `tp@rbrasset.com.br` on this machine). Example: `powershell.exe -NoProfile -Command "Set-Location 'C:\Users\thomaz.pougy\Documents\RBR\Sandbox\outlook-rules'; .\orules.ps1 peek --folder Inbox --days 1 --grep 'nstant' --body 0 --max 5"` — the code is in the subject line. Codes expire in ~60-90 seconds; keep the send→peek→verify sequence tight. The EXECUTOR agent must do this itself.

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped, and UI-SPEC generation is disabled for this milestone (functional smoke UI only). This includes: routing approach, generic-vs-per-entity component design, exact form/table markup, and the E2E proof mechanism (as long as it is rigorous and automated).

### Deferred Ideas (OUT OF SCOPE)
Polished dashboard/panel UI (5 fixed panels, drag-and-drop, etc.) — explicit future milestone per PROJECT.md "Out of Scope". Do not build any of this in Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEB-01 | Magic-code login, session persists across reloads (localStorage) | `db.auth.sendMagicCode`/`signInWithMagicCode` verified API; SDK persists session automatically — no manual localStorage code needed |
| WEB-02 | Full CRUD screen: `fundos` | Generic CRUD component pattern + `fundos` schema/CLI field reference |
| WEB-03 | Full CRUD screen: `projetos` | Generic CRUD component pattern; optional fields + `fundo` link (select) |
| WEB-04 | Full CRUD screen: `etapas` | Generic CRUD component pattern; `projeto` link (select), `ordem` number |
| WEB-05 | Full CRUD screen: `tarefas` | Generic CRUD component pattern; `etapa` link, date fields, `tipoPrazo` select |
| WEB-06 | Full CRUD screen: `templatesRotina` | Generic CRUD pattern extended for two links incl. self-link `antecessor` |
| WEB-07 | List/update-status screen: `instanciasRotina` | Read-only list + narrow status-only update, mirrors CLI's `rotina instancia status` restriction |
| WEB-08 | Full CRUD screen: `tickets` + `subtarefas` | Generic pattern + XOR-parent link handling (`tarefa` vs `ticket`) mirroring CLI `_resolve_parent` |
| WEB-09 | View-only screen: `logInferenciaClaude` | Read-only table, no form |
| WEB-10 | Unauthenticated load shows login, no data leakage | `SignedIn`/`SignedOut` components verified to exist in `@instantdb/svelte`; Playwright-based automated proof |
</phase_requirements>

## Summary

`@instantdb/svelte@1.0.63` (already installed in `web/node_modules`, confirmed via direct inspection of its `.d.ts` and the underlying `@instantdb/core` source — not docs alone) exposes exactly the API this phase needs: `db.auth.sendMagicCode({email})` and `db.auth.signInWithMagicCode({email, code})` for the two-step magic-code flow, `db.useAuth()` returning a reactive `{isLoading, user, error}` object usable directly in Svelte 5 template blocks (no wrapping needed — Phase 1's `App.svelte` already does this), and pre-built `SignedIn`/`SignedOut` guard components that internally gate on `db.useAuth()` and render nothing when the condition fails — ideal for WEB-10's "no data leakage" requirement because a query never even mounts inside `SignedOut`. Session persistence across reloads is automatic (the SDK's Reactor persists the auth/refresh state itself); no bespoke localStorage code is needed or should be written.

`db.useQuery()` accepts either a plain InstaQL object or a **function** that returns one (or `null` to skip the query) — the function form is the "reactive query" pattern and re-runs automatically whenever `$state` values it reads change, which is exactly what a filterable/paginated CRUD table needs in Svelte 5 runes mode. Writes go through `db.transact(db.tx.<entity>[id].update({...}))`, chained with `.link({...})` for relations and `.delete()` for removal — this is the same InstaML API the CLI's Python SDK wraps, so field names, link labels, and `donoId`-based permission enforcement are identical on both channels by construction (nothing SPA-specific to invent).

Given the explicit "functional smoke UI, no polish" scope and a plain-Vite SPA (no SvelteKit, confirmed unchanged since Phase 1), the simplest correct approach is: no router library, a single `$state<ViewName>` in `App.svelte` switched via `{#if}`/`{:else if}` (or a lookup object of component references) to select among 9 entity screens; and **one generic, schema-driven CRUD component** parameterized by a small per-entity config object (field list with type/kind, link config, optional XOR-parent config) rather than 9 near-duplicate components — the 9 entities differ only in field *shape* (string/number/boolean/date, plain vs. select vs. link-select, single vs. XOR-parent), which a declarative config handles cleanly; `instanciasRotina` and `logInferenciaClaude` are then just the same generic screen with `create`/`delete` disabled (mirroring the CLI's `rotina instancia` restriction) or with only a read-only table (no form) respectively.

The environment has no browser-based E2E framework installed today (no Playwright/vitest-browser-svelte devDependency in `web/package.json`), but Playwright's Chromium binaries are already present in `~/.cache/ms-playwright` (used by a prior project on this machine) and `bun add -d playwright` + `bunx playwright install --with-deps chromium` (should be a no-op download-wise if the cached version matches) is the most rigorous feasible mechanism to prove WEB-01 (real magic-code round trip in an actual browser context, not just the CLI's Python SDK) and WEB-10 (unauthenticated load → assert login screen DOM, assert zero entity data rendered) in this headless WSL environment. A lower-cost complementary check — scripted REST calls against InstantDB's underlying HTTP endpoints (`POST https://api.instantdb.com/runtime/auth/send_magic_code`, `.../runtime/auth/verify_magic_code`, verified directly in `@instantdb/core/src/authAPI.ts`) — is useful for fast one-off session bootstrapping but does **not** prove the SPA/browser code path itself, so it is a supplement, not a substitute, for the Playwright proof of WEB-01/WEB-10.

**Primary recommendation:** Build one generic, config-driven CRUD Svelte component (entity config = field list + link config) instead of 9 bespoke components; wire auth with `SignedIn`/`SignedOut` + `db.useAuth()` (no manual guard logic); add Playwright as a `web/` devDependency to drive a real Chromium browser through the full magic-code flow (using the Outlook Classic peek mechanism from PROJECT.md C-10 to fetch the code) and to assert the unauthenticated/no-leakage behavior — this is the only way to prove WEB-01/WEB-04/SC-4 actually work in a browser, not just in the CLI's Python SDK.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-code auth (send/verify) | Browser / Client | — | `@instantdb/svelte`'s `db.auth.*` calls InstantDB's hosted auth API directly from the browser; there is no app backend in this architecture (InstantDB itself is the backend) |
| Session persistence | Browser / Client | — | SDK-internal (IndexedDB/localStorage-backed Reactor state); no app code needed |
| CRUD forms/tables (9 entity screens) | Browser / Client | — | Pure Svelte components; `db.useQuery`/`db.transact` talk to InstantDB directly, no intermediate API |
| Permission enforcement (`donoId` scoping) | Database / Storage | — | `instant.perms.ts` rules evaluated server-side by InstantDB on every query/transact; the SPA cannot bypass this even if it tried — same rules as CLI (C-05) |
| Data leakage prevention (WEB-10) | Browser / Client | Database / Storage | Client-side: `SignedOut`/`SignedIn` prevent queries from ever mounting while unauthenticated. Server-side backstop: `view` rule denies rows even if a query were issued — defense in depth, not either/or |
| E2E proof automation | Browser / Client (driven externally) | — | Playwright drives the actual built/dev Vite SPA in a real Chromium instance; this is test tooling, not app code, but belongs conceptually at the same tier it exercises |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@instantdb/svelte` | `1.0.63` (already installed, `web/package.json`) | Reactive InstantDB client for Svelte: `useQuery`, `useAuth`, `transact`, `SignedIn`/`SignedOut` | Official first-party Svelte SDK; already the locked stack (C-01), used successfully in Phase 1 scaffold |
| `svelte` | `5.56.8` (installed) | Runes-based UI (`$state`, `$derived`, `$props`) | Locked stack |
| `vite` | `8.2.1` (installed) | Dev server / build, no SvelteKit | Locked stack (C-08) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `playwright` | latest compatible with cached Chromium (`~/.cache/ms-playwright` has `chromium-1223`/`chromium-1234`) | Drive a real headless Chromium browser through the SPA for WEB-01/WEB-10 E2E proof | Add as `web/` devDependency for this phase only if no lighter mechanism suffices (see Environment Availability + Validation Architecture) |
| `dotenv` | `^17` (installed) | Parse `.env.instantdb` for the app id in `vite.config.ts` (existing pattern, do not change) | Already wired; reuse verbatim, do not call `dotenv.config()`/`loadEnv` against this file (admin token lives in the same file) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `{#if}`/`{:else if}` view switch | A router library (`svelte-spa-router`, etc.) | A router adds a dependency and URL-sync complexity for zero benefit in a smoke UI with no deep-linking requirement; explicitly against "no polish" scope |
| One generic CRUD component | 9 bespoke per-entity components | Bespoke components are more verbose to keep in sync with schema changes and directly duplicate field lists already declared in `shared/instant.schema.ts`; a config-driven generic component is less code and the entities' field-type variance (string/number/boolean/date/select/link/XOR-link) is fully expressible in a small discriminated-union config type |
| Playwright | Manual scripted REST calls only (`send_magic_code`/`verify_magic_code` HTTP) | REST-level scripting proves InstantDB's auth API works but does **not** exercise the actual Svelte SPA code (session persistence via the SDK's Reactor, `SignedIn`/`SignedOut` rendering, form/table wiring) — insufficient to prove WEB-01/WEB-10 as browser behaviors, only useful as a fast auxiliary check or fallback if Playwright cannot be installed |

**Installation:**
```bash
cd web
bun add -d playwright
bunx playwright install chromium   # verify it reuses ~/.cache/ms-playwright, does not force a fresh download
```

**Version verification:** `@instantdb/svelte`, `svelte`, `vite` versions above are read directly from the installed `web/package.json` and `web/node_modules/@instantdb/svelte/package.json` (VERIFIED, not npm registry lookups, since these are already pinned/installed in this repo — do not bump them in this phase). Playwright has no pinned version yet; verify current npm version before adding:
```bash
npm view playwright version
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (Vite dev server / built dist/)                             │
│                                                                       │
│  main.ts → mount(App.svelte)                                        │
│                                                                       │
│  App.svelte                                                          │
│    ├─ const auth = db.useAuth()          (reactive: isLoading/user) │
│    │                                                                  │
│    ├─ <SignedOut db={db}>  → <LoginScreen/>  (magic-code form)       │
│    │        │                                                        │
│    │        └─ db.auth.sendMagicCode({email})                        │
│    │           db.auth.signInWithMagicCode({email, code}) ───┐       │
│    │                                                          │       │
│    └─ <SignedIn db={db}>                                      │       │
│           ├─ let view = $state<ViewName>("fundos")             │       │
│           ├─ <NavBar bind:view/>                                │       │
│           └─ {#if view === "fundos"}                            │       │
│                 <EntityScreen config={fundosConfig}/>            │       │
│               {:else if view === "projetos"} ...                 │       │
│                                                                    │       │
│              EntityScreen (generic, config-driven)                │       │
│                ├─ db.useQuery(() => ({ [etype]: {...} }))  ◄──────┘       │
│                ├─ renders <table> of results                              │
│                ├─ renders <form> (fields from config)                     │
│                └─ onSubmit → db.transact(db.tx[etype][id].update(...)     │
│                                            .link({...}))                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTPS/WSS (InstaQL/InstaML over InstantDB's own protocol)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ InstantDB (hosted backend — sole persistence + auth + realtime)      │
│  - magic-code auth endpoints (/runtime/auth/send_magic_code, ...)    │
│  - instant.perms.ts: donoId-scoped view/create/update/delete rules   │
│  - instant.schema.ts: 9 entities + 9 links (same schema CLI writes)  │
└─────────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ same schema, same perms, different client
┌─────────────────────────────────────────────────────────────────────┐
│ Python CLI (`apollo` — Phase 3, already complete)                    │
│  writes records visible to the SPA above (SC-3 / VERIFY-01 proof)    │
└─────────────────────────────────────────────────────────────────────┘
```

A reader can trace WEB-01 end-to-end: unauthenticated load → `SignedOut` renders `LoginScreen` → `sendMagicCode` → user reads code from email (C-10 mechanism) → `signInWithMagicCode` → `db.useAuth()` flips to `user` set → `SignedIn` now renders the entity screens → `useQuery` fetches only that user's `donoId`-scoped rows (server-enforced) → any `transact` call round-trips to the same InstantDB app the CLI already wrote to.

### Recommended Project Structure
```
web/src/
├── App.svelte                  # top-level: SignedOut→LoginScreen, SignedIn→Shell
├── lib/
│   ├── db.ts                   # unchanged from Phase 1
│   ├── auth/
│   │   └── LoginScreen.svelte  # magic-code 2-step form (email → code)
│   ├── entities/
│   │   ├── config.ts           # per-entity field/link config (9 entries) — single source for screens
│   │   └── EntityScreen.svelte # generic table+form CRUD component, reads one config entry
│   ├── Shell.svelte            # post-auth: nav ($state view switch) + renders active EntityScreen
│   └── bizdays.ts              # unchanged from Phase 2
```

### Pattern 1: Magic-code auth flow
**What:** Two-step `sendMagicCode` → `signInWithMagicCode`, driven by local `$state` for the current step.
**When to use:** WEB-01, WEB-10 login screen.
**Example:**
```typescript
// Source: web/node_modules/@instantdb/core/src/index.ts (class Auth, verified in this session)
// db.auth.sendMagicCode({email: "example@gmail.com"})
//   .catch((err) => console.error(err.body?.message))
// db.auth.signInWithMagicCode({email: "example@gmail.com", code: "123456"})
//   .catch((err) => console.error(err.body?.message))

let step = $state<"email" | "code">("email");
let email = $state("");
let code = $state("");
let error = $state<string | null>(null);

async function requestCode() {
  error = null;
  try {
    await db.auth.sendMagicCode({ email });
    step = "code";
  } catch (err) {
    error = (err as { body?: { message?: string } }).body?.message ?? "Falha ao enviar código.";
  }
}

async function verifyCode() {
  error = null;
  try {
    await db.auth.signInWithMagicCode({ email, code });
    // no manual redirect needed — db.useAuth() flips reactively, SignedIn takes over
  } catch (err) {
    error = (err as { body?: { message?: string } }).body?.message ?? "Código inválido.";
  }
}
```

### Pattern 2: Auth-gated rendering with `SignedIn`/`SignedOut`
**What:** Pre-built guard components from `@instantdb/svelte` that wrap children in a `Snippet` and only render when `db.useAuth()` resolves to the matching state.
**When to use:** WEB-10 — this is the mechanism that prevents data leakage, since queries declared inside `SignedIn`'s children never execute/mount while signed out.
**Example:**
```svelte
<!-- Source: web/node_modules/@instantdb/svelte/dist/SignedIn.svelte, SignedOut.svelte (read directly, verified) -->
<script lang="ts">
  import { db } from "./lib/db";
  import { SignedIn, SignedOut } from "@instantdb/svelte";
  import LoginScreen from "./lib/auth/LoginScreen.svelte";
  import Shell from "./lib/Shell.svelte";
</script>

<SignedOut {db}>
  {#snippet children()}
    <LoginScreen />
  {/snippet}
</SignedOut>

<SignedIn {db}>
  {#snippet children()}
    <Shell />
  {/snippet}
</SignedIn>
```
Note: `SignedIn`/`SignedOut` internally check `!auth.isLoading && !auth.error && (!!/!)auth.user` — during the initial `isLoading` tick, **neither** renders, which is correct (avoids a flash of the login screen before the persisted session is checked). Confirmed by reading the compiled `.svelte` source directly (not assumed).

### Pattern 3: Reactive `useQuery` for a filterable table
**What:** `db.useQuery` accepts a **function** returning an InstaQL query (or `null` to skip); it re-subscribes when `$state` it reads changes.
**When to use:** Every `EntityScreen` — lets a status/fundo filter drive a live-reactive table without manual refetching.
**Example:**
```typescript
// Source: web/node_modules/@instantdb/core/dist/.../InstantSvelteDatabase.svelte.d.ts (JSDoc example, read directly)
let filtroFundo = $state<string | null>(null);
const query = db.useQuery(() =>
  filtroFundo
    ? { projetos: { $: { where: { "fundo.id": filtroFundo } } } }
    : { projetos: {} },
);
// query.isLoading, query.error, query.data.projetos
```

### Pattern 4: Writes via `transact` + `tx` builder (create/update/link/delete)
**What:** `db.transact(db.tx.<etype>[id].update({...}))`, optionally chained with `.link({...})`; `.delete()` for removal; `id()` from `@instantdb/svelte` mints a client-side UUID for create.
**When to use:** Every `EntityScreen`'s create/edit/delete actions — mirrors exactly what the CLI's `create_entity`/`update_entity`/`delete_entity` helpers do server-side.
**Example:**
```typescript
// Source: web/node_modules/@instantdb/core/src/instatx.ts (JSDoc examples, read directly)
import { id } from "@instantdb/svelte";
import { db } from "./lib/db";

// create + link in one transact (e.g. a projeto linked to a fundo)
const newId = id();
db.transact(
  db.tx.projetos[newId]
    .update({ nome, status: "planejado" })
    .link({ fundo: fundoId }),
);

// update
db.transact(db.tx.fundos[eid].update({ nome, codigo, ativo }));

// delete
db.transact(db.tx.fundos[eid].delete());
```
`donoId` must be set on every `create` (mirrors CLI's `create_entity` injecting it from the session) — obtain it from `db.useAuth().user.id` at submit time, never hard-code it, and never expose a form field for it (matches PROJECT.md C-05's identical-perms guarantee and the CLI's convention of never accepting owner id as a flag).

### Pattern 5: XOR-parent link (subtarefas → tarefa | ticket)
**What:** Exactly one of two link targets, mirroring the CLI's `_resolve_parent` in `cli/apollo_cli/entities/subtarefa.py`.
**When to use:** WEB-08 `subtarefas` create/edit form.
**Example:** Render a single "parent type" radio/select (`tarefa` | `ticket`) + one id-select scoped to the chosen type; on submit, `.link({ tarefa: id })` or `.link({ ticket: id })` — never both, matching the CLI's `required and len(given) != 1` validation. Validate the chosen parent id resolves (via a `queryOnce` lookup) before transacting, exactly as the CLI does with `get_entity` before linking — InstantDB does not validate link targets exist.

### Pattern 6: Self-link (templatesRotina.antecessor)
**What:** A `templatesRotina` may link to another `templatesRotina` as `antecessor`.
**When to use:** WEB-06 `templatesRotina` form — the "antecessor" select's options are simply `useQuery({ templatesRotina: {} })` results excluding the record being edited (to avoid a self-referential link, not enforced by InstantDB itself — client-side guard only, matching CLI's lack of a self-reference check too, so no stricter behavior needs to be invented here).

### Anti-Patterns to Avoid
- **Manually persisting the session to `localStorage`:** The SDK already does this internally; writing your own storage code risks a second, inconsistent source of truth. Trust `db.useAuth()` exclusively.
- **Querying inside a component that is NOT gated by `SignedIn`:** Even though `instant.perms.ts` would deny the rows server-side, issuing the query at all before auth resolves risks a visible flash of "0 results" vs. a real login screen, and defeats the intent of WEB-10 as a *client-visible* guarantee, not just a server one. Always nest entity screens under `SignedIn`.
- **Hand-writing 9 near-identical Svelte components:** Given the entities differ only in field-type shape (see Standard Stack "Alternatives Considered"), duplicating markup across 9 files is the exact kind of hand-rolling this phase's "minimal, no polish" instruction argues against — it also multiplies the surface area for the formatter/linter gate (VERIFY-03) to fail on.
- **Accepting `donoId` as a form field:** Violates C-05's equal-privilege guarantee and the CLI's own established convention (verified: `fundo.py`'s docstring explicitly notes the owner field is "never referenced by its schema name ... injected exclusively from the authenticated session").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state / session persistence | Custom localStorage read/write + expiry logic | `db.useAuth()` + SDK-internal Reactor persistence | Already handles refresh-token renewal, cross-tab sync, and reload persistence; reimplementing risks a session that silently diverges from what `transact`/`useQuery` actually authenticate with |
| Auth-gated rendering | Custom `{#if auth.user}` checks scattered across every screen | `SignedIn`/`SignedOut` wrapper components | Centralizes the exact same `isLoading`/`error`/`user` logic in one place, verified to already exist in the installed package — no reason to reinvent it per-screen |
| Per-entity CRUD boilerplate | 9 hand-written form+table Svelte components | 1 generic `EntityScreen.svelte` + a config table | See Standard Stack alternatives; the config table is the schema restated declaratively, which is far cheaper to keep correct than 9 divergent copies |
| Link-target existence validation | Trusting InstantDB to reject a dangling link | Client-side `queryOnce`/lookup check before `transact`, mirroring the CLI's `get_entity`-before-link pattern | Confirmed in the CLI codebase's own docstrings: "InstantDB does not check link targets exist" — this is a real gap the SPA must also guard against for parity, not an InstantDB limitation to route around differently per channel |
| E2E browser proof | A bespoke DOM-scraping script over raw CDP, or "trust me it works" | Playwright | Purpose-built for exactly this (drive real browser, assert DOM state, handle async waits); reinventing it with raw `chrome-remote-interface` calls is strictly more code for a worse result |

**Key insight:** Almost everything this phase needs is already exposed by `@instantdb/svelte` itself — the actual net-new code is the config table describing 9 entities' field shapes and one generic rendering/transact component built around it, plus the login screen and the E2E harness.

## Common Pitfalls

### Pitfall 1: Assuming `SignedIn`/`SignedOut` take a plain `{#if}`-style default slot
**What goes wrong:** Svelte 5 replaced default slots with `children` snippets; the compiled component signature is `{ db, children }: { db: ...; children: Snippet }`. Passing children without the `{#snippet children()}` wrapper (or Svelte 5's implicit children-from-tag-body, which *does* work automatically for simple cases) can silently render nothing if authored in an older Svelte 4 slot style.
**Why it happens:** Copy-pasting React SDK examples (which use `<SignedIn>{...}</SignedIn>` JSX children, a different mechanism) instead of Svelte-native snippet syntax.
**How to avoid:** Verified the exact prop shape (`db`, `children: Snippet`) directly from `SignedIn.svelte`/`SignedOut.svelte` source in this session — use plain `<SignedIn {db}>...</SignedIn>` (implicit children work automatically in Svelte 5 when there's no other named snippet) or the explicit `{#snippet children()}` form if mixing with other content.
**Warning signs:** Login screen or entity screens never render even though `auth.user` is set (check `auth.isLoading`/`auth.error` first — see Pitfall 2).

### Pitfall 2: Forgetting the `isLoading` tick before session restore
**What goes wrong:** On page reload, `db.useAuth()` starts with `isLoading: true` while the SDK restores a persisted session; a component that treats "not `auth.user`" as "show login" before checking `isLoading` will flash the login screen even for an already-authenticated user.
**Why it happens:** `SignedIn`/`SignedOut` both correctly gate on `!auth.isLoading`, but any *custom* auth check written outside those components (e.g. a nav bar showing the user's email) must repeat this guard manually.
**How to avoid:** Only branch on `auth.user`/`auth.error` after confirming `!auth.isLoading`, exactly as Phase 1's existing `App.svelte` scaffold already does (`{#if auth.isLoading}...{:else if auth.error}...{:else if auth.user}...{:else}...`) — extend that pattern, don't replace it.
**Warning signs:** Visible login-screen flash on reload in manual/E2E testing.

### Pitfall 3: Magic codes expire fast (~60-90s) — this is an operational pitfall for the EXECUTOR, not a code bug
**What goes wrong:** PROJECT.md C-10 explicitly documents that codes expire in ~60-90 seconds and the send→peek→verify sequence must be tight; a slow polling loop or unnecessary delay between reading the code and submitting it will produce `record-expired` errors that look like a bug in the login form.
**Why it happens:** Real email delivery + the Outlook Classic COM peek roundtrip both add latency before the code is even readable.
**How to avoid:** When the plan reaches the E2E execution step, script the Playwright flow to: trigger `sendMagicCode` → immediately shell out to the `orules.ps1 peek` command → parse the code from the subject line → immediately fill and submit → on `record-expired`, immediately resend and retry once, with no manual pauses in between (per C-10's own guidance).
**Warning signs:** Intermittent "invalid or expired code" failures that don't reproduce on a second attempt.

### Pitfall 4: Date fields round-trip as ISO strings by default, not `Date` objects
**What goes wrong:** `i.date()` fields (verified in `@instantdb/core/src/schema.ts`) are read back as strings unless the client is initialized with `useDateObjects: true` (verified default is `false` in `@instantdb/core/src/index.ts`, `web/src/lib/db.ts`'s `init()` call does not set this option). Binding an HTML `<input type="date">` directly to the raw query value can produce a mismatched format (InstantDB stores/returns full ISO datetime strings, `<input type="date">` needs a bare `YYYY-MM-DD`).
**Why it happens:** Assuming date fields behave like native `Date` objects without checking the SDK's actual (default) serialization mode.
**How to avoid:** Do not change `useDateObjects` (out of scope — not requested, and would be an unlocked stack change); in the generic `EntityScreen`, slice/convert ISO strings to `YYYY-MM-DD` for `<input type="date">` binding and re-serialize to a full ISO string on submit (`new Date(value).toISOString()` or similar), matching what the CLI's own `validate_iso_date`/`now_iso` helpers already assume about the stored format.
**Warning signs:** Date inputs showing blank or throwing a console warning about invalid input value format.

### Pitfall 5: `instant-cli`/schema cross-package resolution quirks (already solved in Phase 1, don't re-break)
**What goes wrong:** `shared/*.ts` has no `node_modules`/`package.json` of its own; Phase 1 fixed this with a `shared/node_modules` symlink + `vite.config.ts` alias + `tsconfig.app.json` paths mapping specifically for `@instantdb/svelte`. Any new import added to `shared/*.ts` in this phase (unlikely, since Phase 4 work is `web/src/**`, not `shared/**`) would hit the same problem.
**Why it happens:** `shared/` is a sibling of `web/`, not a descendant, so Node-style bare-specifier resolution doesn't reach `web/node_modules`.
**How to avoid:** Phase 4 should not need to touch `shared/*.ts` at all (schema/perms are already complete from Phase 1) — if it does, reuse the exact established pattern, don't reinvent it.
**Warning signs:** `Cannot find module '@instantdb/svelte'` errors from `svelte-check`/Vite build if a new `shared/` import is added.

## Code Examples

### `db.useAuth()` reactive state (already established, Phase 1)
```svelte
<!-- Source: web/src/App.svelte (existing code, read directly) -->
<script lang="ts">
  import { db } from "./lib/db";
  const auth = db.useAuth();
</script>
{#if auth.isLoading}
  <p>carregando...</p>
{:else if auth.error}
  <p>erro de autenticação: {auth.error.message}</p>
{:else if auth.user}
  <p>autenticado como {auth.user.email}</p>
{:else}
  <p>não autenticado</p>
{/if}
```

### Full magic-code round trip via raw REST (auxiliary/fallback proof mechanism, mimics the SDK exactly)
```bash
# Source: web/node_modules/@instantdb/core/src/authAPI.ts + index.ts defaultConfig
# (apiURI default = 'https://api.instantdb.com'), read directly, verified.
curl -s https://api.instantdb.com/runtime/auth/send_magic_code \
  -H 'Content-Type: application/json' \
  -d '{"app-id": "<APP_ID>", "email": "tp@rbrasset.com.br"}'

# ... fetch the code from the inbox via C-10's orules.ps1 peek mechanism ...

curl -s https://api.instantdb.com/runtime/auth/verify_magic_code \
  -H 'Content-Type: application/json' \
  -d '{"app-id": "<APP_ID>", "email": "tp@rbrasset.com.br", "code": "<CODE>"}'
# Returns a refresh token equivalent to what db.auth.signInWithMagicCode stores.
```
This proves InstantDB's auth backend works, but does **not** prove the SPA's own `db.auth.signInWithMagicCode` call, `SignedIn`/`SignedOut` rendering, or session persistence — use Playwright for the actual WEB-01/WEB-10 proof; use this REST path only for fast auxiliary checks (e.g. confirming C-10's Outlook-peek mechanism itself works, independent of the browser).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Svelte 4 slots (`<slot/>`, `let:` directives) | Svelte 5 snippets (`{#snippet}`, `{@render}`) | Svelte 5 (already the locked version here) | `SignedIn`/`SignedOut`'s `children: Snippet` prop shape is Svelte-5-native; do not port React-SDK JSX-children examples verbatim |
| `db.useAuth()` in React (hook) | `db.useAuth()` in Svelte (returns a reactive object directly usable in markup, not a hook) | N/A — this is a cross-framework distinction, not a version change | The Svelte SDK's `useAuth`/`useQuery` return plain reactive objects (Svelte 5 runes under the hood), not React hooks — read reactively via `.isLoading`/`.user`/`.data` directly in `{#if}` blocks, no `useEffect`-equivalent needed |

**Deprecated/outdated:** None identified specific to this phase — `@instantdb/svelte@1.0.63` is the version already locked and installed; this research did not surface any newer major version requiring a migration note.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A generic, config-driven single `EntityScreen` component is simpler/safer than 9 bespoke components for this specific schema | Standard Stack / Architecture Patterns | Low — this is a design recommendation at Claude's discretion (CONTEXT.md explicitly delegates this), not a locked constraint; if the executor finds the config abstraction awkward for `templatesRotina`'s two links or `subtarefas`' XOR-parent, falling back to a couple of bespoke components for just those two entities is a reasonable, low-risk deviation |
| A2 | `bun add -d playwright` + `bunx playwright install chromium` will reuse the cached browsers in `~/.cache/ms-playwright` without a large re-download | Environment Availability / Standard Stack | Medium — if the installed Playwright npm version's expected browser revision doesn't match the cached `chromium-1223`/`chromium-1234` folders, a fresh download will be triggered; verify with `npx playwright install --dry-run` equivalent or just check download size/time during Wave 0 |
| A3 | Converting ISO date strings to `YYYY-MM-DD` for `<input type="date">` and back is sufficient date handling for this "functional smoke UI" phase (no timezone-aware date-only vs. datetime distinction enforcement) | Common Pitfalls (Pitfall 4) | Low — matches the CLI's own `validate_iso_date` regex (`YYYY-MM-DD` only), so behavior stays consistent across channels; a mismatch would only matter for true datetime-precision fields, which none of the 9 entities appear to need beyond date-only semantics |

**If this table is empty:** N/A — see entries above; all are LOW-MEDIUM risk discretionary/implementation-detail assumptions, not disputed facts about locked constraints.

## Open Questions

1. **Should the Playwright E2E harness live under `web/` as a committed test file, or be a scratch/one-off script?**
   - What we know: `web/package.json` already has a `"test": "bun test"` script wired to `bun:test` for pure-logic tests (`bizdays.test.ts`); Playwright tests are typically run via `playwright test`, a different runner.
   - What's unclear: Whether this phase should add a permanent `web/e2e/` suite + a new `package.json` script (more infrastructure, reusable in Phase 6's VERIFY-01), or treat the Playwright script as an ad-hoc verification tool run once by the executor and not committed as a maintained test suite.
   - Recommendation: Add it as a committed, minimal `web/e2e/auth.spec.ts` (or similar) with a `test:e2e` script — Phase 6 (VERIFY-01, cross-channel parity) will very likely want to reuse the same browser-driving mechanism, so building it as throwaway would duplicate effort later.

2. **Exact HTML markup / CSS approach for "minimal, no polish" — how minimal is too minimal?**
   - What we know: CONTEXT.md explicitly says "plain HTML forms and tables per entity, no component library, no visual polish."
   - What's unclear: Whether any base stylesheet reuse from `web/src/app.css` (established in the original `apollo` reference, not this repo — apollo-v2 may not have an equivalent yet) is expected, or fully unstyled `<table>`/`<form>` markup is acceptable.
   - Recommendation: Default to unstyled semantic HTML (`<table>`, `<form>`, `<label>`) with at most trivial layout CSS (e.g. spacing) — sufficient for Playwright to interact with via labels/roles, and does not risk over-investing in visual design explicitly out of scope for this milestone.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@instantdb/svelte` | All of WEB-01..10 | ✓ | 1.0.63 (installed) | — |
| Bun | Package manager / test runner | ✓ | 1.3.12 | — |
| Playwright (npm package) | WEB-01/WEB-10 browser-driven E2E proof | ✗ (not yet a devDependency) | — | Install via `bun add -d playwright`; cached Chromium binaries already present, so install should be fast |
| Playwright Chromium browser binary | Same | ✓ (cached: `chromium-1223`, `chromium-1234`, `chromium_headless_shell-1223/1234`, `ffmpeg-1011` under `~/.cache/ms-playwright`) | matches some prior project's pinned version | If the newly-installed `playwright` npm version expects a different revision, `bunx playwright install chromium` will fetch it (network access required) |
| Outlook Classic COM peek tool (`orules.ps1`) | Reading the real magic-code email (C-10) | ✓ (per PROJECT.md C-10, proven working in Phase 3) | — | None — this is the only working channel per C-10; the Microsoft 365 MCP tool is explicitly confirmed NOT to have access to this mailbox |
| Live InstantDB app (`.env.instantdb` `APP_ID`) | Every InstaQL/InstaML call | ✓ (provisioned since Phase 1, schema/perms pushed) | — | — |

**Missing dependencies with no fallback:**
- None — Playwright has a clear install path with cached browser binaries already present, and the email-reading mechanism is already proven working from Phase 3.

**Missing dependencies with fallback:**
- `playwright` npm package — not yet installed, but installation is low-risk given cached Chromium binaries and no other blocking dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `bun:test` (pure logic, existing) + Playwright Test (new, for browser E2E) |
| Config file | none yet for Playwright — Wave 0 should add a minimal `playwright.config.ts` under `web/` |
| Quick run command | `bun run check` (svelte-check/tsc, existing) |
| Full suite command | `bun test && bunx playwright test` (proposed; exact script names TBD by planner) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEB-01 | Magic-code login + session persists across reload | e2e (Playwright) | `bunx playwright test e2e/auth.spec.ts` | ❌ Wave 0 |
| WEB-02..WEB-09 | Per-entity CRUD/list/view screens render and round-trip data | e2e (Playwright) or component-level assertion via the same auth'd session | `bunx playwright test e2e/entities.spec.ts` | ❌ Wave 0 |
| WEB-10 | Unauthenticated load shows login, zero data rendered | e2e (Playwright) | `bunx playwright test e2e/no-leakage.spec.ts` | ❌ Wave 0 |
| Type/format cleanliness (phase-wide) | `.ts`/`.svelte` files pass formatter+linter+`svelte-check` | static | `bun run check && bun run lint && bun run format:check` | ✓ (scripts exist in `web/package.json`) |

### Sampling Rate
- **Per task commit:** `bun run check` (fast type-check; run after every file added/edited)
- **Per wave merge:** `bun run check && bun run lint && bun run format:check` + relevant Playwright spec(s) for the entities touched in that wave
- **Phase gate:** Full Playwright suite (auth + all 9 entity screens + no-leakage) green, plus `bun run check`/`lint`/`format:check` clean, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/playwright.config.ts` — base config (headless Chromium, baseURL pointing at a locally-run `vite preview`/`vite dev` instance)
- [ ] `web/e2e/auth.spec.ts` — covers WEB-01 (send code → C-10 peek mechanism → verify → assert authenticated UI → reload → assert still authenticated)
- [ ] `web/e2e/no-leakage.spec.ts` — covers WEB-10 (fresh/incognito context, no stored session → assert login screen only, zero entity DOM nodes)
- [ ] `web/e2e/entities.spec.ts` (or one spec per entity/group) — covers WEB-02..WEB-09 CRUD/list/view round trips, reusing an authenticated fixture from `auth.spec.ts`'s flow
- [ ] Playwright install: `bun add -d playwright && bunx playwright install chromium`
- [ ] `web/src/lib/entities/config.ts` is not a test file but is a Wave 0 prerequisite artifact that every entity spec depends on

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | InstantDB-hosted magic-code auth (`db.auth.sendMagicCode`/`signInWithMagicCode`) — do not build any parallel/custom auth mechanism |
| V3 Session Management | yes | SDK-internal session/refresh-token persistence (do not hand-roll storage or expiry logic — see Don't Hand-Roll) |
| V4 Access Control | yes | `instant.perms.ts` `donoId`-scoped rules, enforced server-side by InstantDB on every query/transact regardless of client — SPA cannot bypass even with a compromised client |
| V5 Input Validation | yes | Client-side form validation (required fields, ISO date format, XOR-parent exactly-one-of) mirroring the CLI's `click.UsageError`/`validate_iso_date` patterns — necessary for UX, but not a substitute for server-side perms enforcement |
| V6 Cryptography | no | No custom crypto in scope — auth tokens/codes are entirely InstantDB-managed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Rendering entity data before auth resolves (flash of unauthenticated content) | Information Disclosure | Gate every data-bearing component under `SignedIn`; never issue `useQuery` calls outside that gate (Pitfall 2, Anti-Pattern list) |
| Dangling/forged link targets (writing a link to an id that doesn't belong to the user or doesn't exist) | Tampering | Client-side existence check via `queryOnce` before `transact`, mirroring the CLI's `get_entity`-before-link pattern; ultimate backstop is still the `donoId` view/update/delete rule denying access to rows not owned by the authenticated user |
| Client supplying its own `donoId` on create | Elevation of Privilege | Never render a `donoId` form field; always inject `db.useAuth().user.id` at submit time only — mirrors CLI's `create_entity` convention exactly |
| Magic code reuse/replay after expiry | Spoofing | Not application-controlled — InstantDB's `record-expired` server response already handles this; the SPA/E2E harness just needs to handle that error path gracefully (resend + retry, per C-10) |

## Sources

### Primary (HIGH confidence)
- `web/node_modules/@instantdb/svelte/dist/index.d.ts`, `InstantSvelteDatabase.svelte.d.ts`, `SignedIn.svelte`, `SignedOut.svelte` — read directly in this session; exact API surface (`useAuth`, `useQuery`, `useInfiniteQuery`, `transact`, `SignedIn`/`SignedOut` prop shapes)
- `web/node_modules/@instantdb/core/src/index.ts` (class `Auth`, `defaultConfig.apiURI`), `authAPI.ts` (REST endpoint paths), `instatx.ts` (`.update()`/`.link()`/`.delete()`/`.merge()` JSDoc examples), `schema.ts` (`i.date()` type), `attrTypes.ts` — read directly in this session
- `apollo-v2/shared/instant.schema.ts`, `shared/instant.perms.ts` — locked, live schema this phase's screens must mirror exactly
- `apollo-v2/cli/apollo_cli/entities/{fundo,subtarefa,rotina}.py`, `crud_helpers.py` — proven-correct field/validation/link semantics reference (Phase 3, already live-tested against the same schema)
- `apollo-v2/.planning/phases/01-repo-scaffold-live-schema/01-01-SUMMARY.md` — established cross-package resolution pattern, `.env.instantdb` parsing convention, `db.ts`/`App.svelte`/`vite.config.ts` current state
- `apollo-v2/.planning/{PROJECT.md,REQUIREMENTS.md,STATE.md}`, `04-CONTEXT.md` — locked constraints (C-01 through C-10) and phase scope

### Secondary (MEDIUM confidence)
- `~/pessoal/ultima-missao/src/lib/components/IdentityGate.svelte`, `AdminPanel.svelte`, `MainView.svelte` — working reference usage of `db.useQuery`/`db.transact` in a real deployed Svelte 5 + `@instantdb/svelte` app (though that project uses name-based identity, not magic-code auth, so it did not provide a magic-code example directly — the magic-code API itself was verified against `@instantdb/core` source instead)
- `~/.cache/ms-playwright` directory listing + `~/.bun/install/cache/playwright` — evidence Playwright has been used successfully in this environment before (informs the "cached browsers" Environment Availability claim)

### Tertiary (LOW confidence)
- None — every material claim in this document was verified against installed source code or the live repository, not against external web search or training-data recall.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions read directly from installed `package.json`/lockfile state, not assumed
- Architecture: HIGH — every API call pattern (`useAuth`, `useQuery`, `transact`, `SignedIn`/`SignedOut`, `auth.sendMagicCode`/`signInWithMagicCode`) verified against the actual installed package source in this session
- Pitfalls: HIGH for SDK-specific pitfalls (date serialization, snippet/slot mismatch, isLoading race — all confirmed against source); MEDIUM for the Playwright-cache-reuse assumption (A2) since it depends on version-matching behavior not directly testable without actually running the install

**Research date:** 2026-08-09
**Valid until:** 30 days (stable, locked dependency versions; re-verify if `@instantdb/svelte` is bumped past `1.0.63` before Phase 4 executes)
