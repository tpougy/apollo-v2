# apollo-web

Apollo v2's pure Svelte 5 SPA (no SvelteKit) — the human-operated channel with
full parity with the Python CLI (`cli/`). Every write operation available
here is also available in the CLI, authenticated as the same real user under
the same InstantDB permission rules (see `../.planning/PROJECT.md` constraint
C-05).

## Install and run the dev server

```bash
cd web
bun install
bun run dev
```

Vite serves the SPA on its default port (5173) in normal development; the
Playwright harness runs its own dev server instance on port 5174 (see
`playwright.config.ts`) so the two never collide. `bun run build` produces a
static `dist/` (no server-side code — this is a pure client bundle, deployed
as-is to a static host).

## The login flow, as a user experiences it

1. On first load, an unauthenticated visitor sees only `LoginScreen.svelte` —
   an email field, then a 6-digit code field. No entity data, no nav, is ever
   rendered outside the `SignedIn` gate (`App.svelte`).
2. The user enters their email and requests a code. InstantDB's magic-code
   auth (`@instantdb/svelte`) sends a 6-digit code by email.
3. The user enters that code. On success, `@instantdb/svelte`'s `SignedIn`
   gate flips and `Shell.svelte` (the registry-driven nav + active entity
   screen) renders.
4. The session persists in IndexedDB (not `localStorage` — see `patterns`
   below) and survives a reload without re-authenticating.

There is no password, no admin-token login path, and no way to bypass this
gate from the browser: every data-bearing region of the app lives inside
`<SignedIn {db}>`, and `db.useQuery` is never called outside it (grep-checked
by `web/e2e/no-leakage.spec.ts`).

## Adding a screen: the `defs/*.ts` + registry pattern

**To add a screen, add a file under `web/src/lib/entities/defs/`. Never edit
`registry.ts`.**

`registry.ts` auto-discovers every module under `defs/*.ts` via
`import.meta.glob("./defs/*.ts", { eager: true })`, validates each module's
default export is a well-formed `EntityConfig`, sorts by `ordem`, and exposes
`entityConfigs`/`configByEtype()`. `Shell.svelte` renders one `nav-<etype>`
button per registry entry and mounts the single generic `EntityScreen.svelte`
component, keyed on the active entity — there is no per-entity Svelte
component anywhere in this codebase. Nine schema entities are nine
`defs/*.ts` files and zero bespoke markup.

### The `EntityConfig` contract (`web/src/lib/entities/types.ts`)

```typescript
export interface EntityConfig {
  etype: string; // InstantDB entity name, must match shared/instant.schema.ts
  titulo: string; // nav + heading text
  ordem: number; // nav sort order (must be unique across the registry)
  capabilities: { create: boolean; update: boolean; delete: boolean };
  updatableFields?: readonly string[]; // when set, the edit form exposes ONLY these
  fields: readonly FieldDef[];
  links?: readonly LinkDef[];
  xorLink?: XorLinkDef;
  listColumns: readonly string[]; // field names / link labels rendered as table columns
}
```

- `fields` — one entry per editable scalar field (`text`, `textarea`,
  `number`, `boolean`, `date`, or a strict-choice `select`). The owner-id
  field is **never** expressible here — see "The donoId injection rule"
  below.
- `links` — one-to-one relations to another entity, rendered as a `<select>`
  populated by a second `db.useQuery` over `targetEtype`. Every declared link
  is **always editable** in the create/edit form — there is no read-only-link
  render mode in the shipped `EntityScreen.svelte` (this is why
  `instanciasRotina.ts` deliberately omits its `template` link; see that
  file's header comment for the full trade-off).
- `xorLink` — exactly two `LinkDef` choices where exactly one must be linked
  (used by `subtarefas`: a subtarefa belongs to a `tarefa` or a `ticket`,
  never both, never neither). The engine enforces this before every
  `transact()` and, on an edit-time parent-type switch, explicitly `.unlink()`s
  the stale choice so a record can never end up linked to both.
- `listColumns` — must each name a declared field, a declared link label, or
  an `xorLink` choice label (enforced by `registry.test.ts`).

### The capability restrictions, and why

| Entity | create | update | delete | Rationale |
|---|---|---|---|---|
| `instanciasRotina` | **false** | true (status only) | **false** | C-06: instances are created and dated exclusively by the Phase 5 `dedupeKey`-keyed generation job. A hand-created or hand-re-dated instance would carry a wrong or absent `dedupeKey`, and the next job run would create a duplicate alongside it — silently breaking the one idempotency guarantee this system promises. `updatableFields: ["status"]` narrows the edit form to exactly the one field the CLI's `rotina instancia status` command also updates. |
| `logInferenciaClaude` | **false** | **false** | **false** | CLI-10 / append-only audit trail: a rewritable log of what Claude inferred (and why) cannot serve its purpose of letting the user check the AI's reasoning after the fact. The CLI mirrors this exactly — only `registrar` (create, admin-side) and `listar` exist, no `editar`/`deletar`. With all three capabilities false, `EntityScreen.svelte` never renders a "novo" button, `row-edit`, `row-delete`, or a `<form>` at all — this screen is a pure read-only table by construction. |

Every other entity (`fundos`, `projetos`, `etapas`, `tarefas`,
`templatesRotina`, `tickets`, `subtarefas`) has all three capabilities `true`.

### The donoId injection rule

The owner-id field (`donoId` in `shared/instant.schema.ts`) is **never**
expressible as a `FieldDef` and is **never** referenced anywhere in
`web/src` outside a single line in `EntityScreen.svelte`'s create handler,
where it is read from `db.useAuth().user.id` at submit time:

```typescript
const donoId = auth.user?.id;
// ...
const chunk = tx[config.etype][newId].update({ ...payload, donoId });
```

This is enforced structurally by `registry.test.ts` (no field name may
contain `"dono"`) and, repo-wide, by `verify-phase-04.sh`'s T-04-03 gate
(`grep -rn "donoId" web/src | grep -v EntityScreen.svelte` must be empty).

## Running the e2e suite

Three Playwright projects (`web/playwright.config.ts`):

| Project | What it proves | Sends a magic-code email? |
|---|---|---|
| `setup` (`auth.setup.ts`) | The real magic-code round trip end-to-end (WEB-01) against the real inbox (C-10), then persists `storageState({ indexedDB: true })` to `web/e2e/.auth/user.json` | **Yes** |
| `authed` | Every entity CRUD spec, full browser round trips against the real hosted InstantDB app, reusing the persisted `storageState` | No (depends on `setup`, but `--no-deps` reuses the persisted state) |
| `anon` (`no-leakage.spec.ts`) | An unauthenticated load renders zero entity data (WEB-10) | No |

```bash
bun run test:e2e:auth   # setup project only -- sends a real magic-code email
bunx playwright test --project=authed --no-deps   # reuse the persisted session
bunx playwright test --project=anon               # no session needed
bunx playwright test                              # all three projects (re-triggers setup)
```

The plain `bunx playwright test` invocation above — aliased as `bun run test:e2e` in
`package.json` — is the single command that reproduces the ENTIRE suite (all three
projects: `setup`, `authed`, `anon`) from a clean checkout with zero manual/human step
anywhere in the sequence, including the real magic-code round trip: `auth.setup.ts` plus
`web/e2e/helpers/magic-code.ts` perform that send-and-read automatically via the C-10
Outlook COM bridge, never by a human relaying an email. This is the concrete documented
proof of VERIFY-03 for the v1.1 milestone; Phase 11's own Task 1 most recently confirmed
it live, ending in an all-green summary (39 passed, 0 failed, 0 skipped).

Phase 17 of the v1.2 milestone ("Lapidação de UI") re-ran this same `bun run test:e2e`
command as the final cross-phase proof for the whole polish pass.
`web/e2e/cross-phase-verification.spec.ts` is the dedicated spec added for that proof: it
walks Login → Shell → an entity's table/create-Dialog/delete-confirmation surface in one
continuous pass, measuring the actual computed spacing scale
(space-y-4/space-y-2/gap-4/gap-2) established in Phase 12 against Phases 13–16's later
surfaces, and asserting the values are numerically equal — the concrete, measured proof
behind VERIFY-07 and POLISH-04's "one consistent scale" claim, not an assumption from
reading class names. This phase's own live run of the command above reported **68 passed,
0 failed, 0 skipped** (the pre-existing 60 plus this phase's 8 new tests).

The C-10 magic-code mechanism the `setup` project depends on reads the real
inbox (`tp@rbrasset.com.br`) via the Outlook Classic COM channel documented
in `../.planning/PROJECT.md` C-10 (`web/e2e/helpers/magic-code.ts`). Codes
expire in roughly 60-90 seconds, so the send→peek→verify sequence in
`auth.setup.ts` is intentionally tight.

## Verifying the phase

```bash
bash ../.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
```

Re-proves WEB-01 through WEB-10 plus the C-08 quality gates and the T-04-02/
T-04-03 threat mitigations, in one command, idempotently (safe to run twice
in a row; leaves the repo and the live app untouched). On a normal run it
**reuses** the persisted `web/e2e/.auth/user.json` and never sends a magic
code. To also re-prove the real magic-code send itself (a full WEB-01
re-proof, including a live email round trip):

```bash
bash ../.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh --with-magic-code
# or:
VERIFY_MAGIC_CODE=1 bash ../.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
```

## The routine-instance generation job trigger (`Shell.svelte`)

`Shell.svelte` fires the idempotent routine-instance generation job
(`runRoutineInstanceJob`, `src/lib/routineJob.ts`) exactly once per authenticated mount:

```typescript
let jobStarted = false; // plain, non-reactive -- deliberately NOT $state

onMount(() => {
  if (jobStarted) return;
  jobStarted = true;
  runRoutineInstanceJob({ donoId: user.id })
    .then(() => { jobState = "done"; })
    .catch((error) => {
      console.error("[routineJob] failed to run on mount", error);
      jobState = "done"; // a job failure must never block rendering
    });
});
```

This is `onMount`, never `$effect`: the trigger must fire exactly once per session, not
re-fire on every reactive dependency change a `$effect` would track (e.g. `user` object
identity churn on token refresh). `jobStarted` is a plain `let`, not `$state`, specifically so
nothing can make this guard itself reactive — grep-verified (`verify-phase-05.sh`) that no
`$effect` exists anywhere in this file.

Completion is exposed via a hidden test-only hook:

```svelte
<div data-testid="routine-job-state" data-job-state={jobState} hidden></div>
```

`web/e2e/routine-job.spec.ts` and `web/e2e/routine-job-cross-channel.spec.ts` poll this
element's `data-job-state` attribute for `"done"` instead of a fixed sleep, since the job's
own query -> compute -> write cycle against InstantDB has no other externally-observable
completion signal.

**No job UI exists by design** (PROJECT.md C-09: this milestone builds the data layer, auth,
CLI, and job end-to-end — no panel/dashboard UI design is in scope). There is no progress
indicator, no toast, no list of what the job did on this load; an operator who wants to see
the job's report runs `apollo rotina gerar-instancias --dry-run` from the CLI instead, which
prints the full JSON report.

## Verifying Phase 5

```bash
bash ../.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
```

Re-proves every JOB-01/JOB-02 gate — including this project's own `routine-job.spec.ts` and
`routine-job-cross-channel.spec.ts` — in one command, printing `PHASE 05 VERIFIED` on success.
See `../README.md`'s "Routine-instance generation job" section for what the job does and the
"Re-verifying Phase 5" section for the full gate list.
