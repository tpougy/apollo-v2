---
status: clean
phase: 04-web-spa-auth-crud-smoke-ui
reviewed: 2026-08-09
depth: standard
---

# Phase 04 Code Review — Web SPA Auth + CRUD UI

## Scope

Reviewed: `web/README.md`, `web/e2e/{auth.setup.ts,helpers/magic-code.ts,no-leakage.spec.ts}`,
`web/package.json`, `web/playwright.config.ts`, `web/vite.config.ts`, `web/src/{App.svelte,main.ts,db.ts}`,
`web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`,
`web/src/lib/entities/{registry.ts,registry.test.ts,types.ts}`, all 9 `web/src/lib/entities/defs/*.ts`,
`shared/instant.schema.ts`, `.planning/PROJECT.md`, and the phase's `04-04-SUMMARY.md`/`04-06-SUMMARY.md` for
context on the two items called out for special attention.

## Findings by focus area

### 1. Admin token (`INSTANT_APP_ADMIN_TOKEN` / `@instantdb/admin`) — CLEAN

`@instantdb/admin` is a `devDependency` (`web/package.json`), used only by the `instant:push`/`instant:pull`/
`instant:verify` npm scripts, which shell out to `instant-cli` — a Node/Bun-side CLI process, never bundled into
the browser build. `grep -rn "INSTANT_APP_ADMIN_TOKEN|@instantdb/admin|adminToken" web/src web/index.html
web/vite.config.ts` returns exactly one hit: a **comment** in `web/vite.config.ts` explaining *why* the admin
token is deliberately excluded from the env-injection path (it parses `.env.instantdb` manually into a local
constant and injects only `VITE_INSTANT_APP_ID`, specifically to avoid baking the admin token into the bundle —
this is threat T-01-02's mitigation, and it's correctly implemented, not just asserted). The Vite entry point
(`web/index.html` → `/src/main.ts`) never touches `web/e2e/`, so the Playwright/Outlook-COM helper code (which
also never imports `@instantdb/admin`) is not reachable from the shipped bundle either. Confirmed no admin token
in source or build path.

### 2. `donoId` never form-fillable — CLEAN

`grep -rn "donoId" web/src | grep -v EntityScreen.svelte` returns nothing — the only occurrence anywhere in
`web/src` is in `EntityScreen.svelte`'s create handler (`const donoId = auth.user?.id; ...
tx[config.etype][newId].update({ ...payload, donoId })`), read from `db.useAuth()` at submit time, never from
a form field. `FieldDef`'s type union (`types.ts`) has no notion of an owner-id kind, and none of the 9
`defs/*.ts` files declare a `dono`-named field (also structurally enforced by `registry.test.ts`, which the
phase's own suite runs). The guard degrades safely too: if `auth.user` is falsy at submit time, the handler sets
a `formError` and returns before any `transact()` call — it does not fall through to submitting with an
`undefined` owner.

### 3. `SignedIn`/`SignedOut` gate prevents pre-auth data leakage — CLEAN

`App.svelte` puts `LoginScreen` exclusively inside `<SignedOut {db}>` and `Shell` (which owns the nav +
`EntityScreen` mount) exclusively inside `<SignedIn {db}>` with no sibling rendering path. The only
`db.useQuery` calls in the codebase live in `EntityScreen.svelte`, which is only ever instantiated from
`Shell.svelte`, which is only ever instantiated from inside `<SignedIn>`. `Shell.svelte` itself calls
`db.useAuth()` (auth state only, not an entity query) unconditionally, which is intentional and does not leak
entity data. This is verified at the network layer, not just the DOM, by `web/e2e/no-leakage.spec.ts`, which
listens on all `instantdb.com` responses and asserts zero non-empty `/runtime/session|query|transact` response
bodies while unauthenticated — a materially stronger check than a UI-only assertion. Confirmed clean.

### 4. `EntityScreen.svelte` XOR-unlink fix — CORRECT for the general two-choice engine, with one low-severity theoretical gap

The fix (`originalXorParentType`/`originalXorParentId` snapshotted in `startEdit`, diffed against the submitted
`xorParentType` at submit time to build an explicit `unlinkPayload` alongside the `link()` call) is engine-level,
not special-cased to `subtarefas`/tarefa-ticket — it operates purely on `config.xorLink.choices` labels and is
exercised by `entities-ticket-subtarefa.spec.ts`'s "editing a subtarefa's parent type" test, which the phase
summary documents was demonstrated to genuinely fail without the fix (temporarily reverted the `unlink()` call,
re-ran, got `expect(received).toBe(expected)... Expected: false, Received: true`, restored, re-ran green). This
demonstration + the generic (non-etype-specific) implementation gives good confidence it is not "accidentally
correct only for subtarefas."

One theoretical gap, not currently reachable through the shipped UI/engine but worth flagging for any future
xorLink consumer: `startEdit`'s loop over `config.xorLink.choices` to detect the currently-linked choice does not
`break` on the first match —

```ts
for (const choice of config.xorLink.choices) {
  const linked = row[choice.label] as LinkedRow | LinkedRow[] | undefined;
  const one = Array.isArray(linked) ? linked[0] : linked;
  if (one?.id) {
    xorParentType = choice.label;
    xorParentId = one.id;
    originalXorParentType = choice.label;
    originalXorParentId = one.id;
  }
}
```

If a record were ever already linked to **both** choices simultaneously (a state the engine's own create-time
and edit-time paths are designed to prevent, and which has no reachable path in the current UI), this loop would
silently let the *last* matching choice in declaration order win as "original," and the *first* stale link would
never be captured for unlinking — so opening edit and switching away from the (only-recorded) second choice
would still leave the first, never-snapshotted link in place. This requires the invariant to already be broken
by something outside this UI (e.g., a manual DB edit, a race between two concurrent edit sessions on the same
record) — it is not a way for the UI itself to produce a double-link, and does not undermine the fix's stated
purpose (preventing the UI's own edit path from *creating* a double-link). Recommend a minor follow-up: iterate
in reverse or `break` after the first match, or assert-and-surface an error if more than one choice is found
linked, so any already-corrupted record is visibly flagged rather than silently mishandled. Not a blocker for
this phase's UAT scope.

### 5. Capability gating for `instanciasRotina` / `logInferenciaClaude` — CLEAN

`instanciasRotina.ts`: `capabilities: { create: false, update: true, delete: false }`,
`updatableFields: ["status"]`. `logInferenciaClaude.ts`: `capabilities: { create: false, update: false, delete:
false }`, no `updatableFields`. In `EntityScreen.svelte`, the "novo" button, `row-edit`, and `row-delete` are
each individually gated on `config.capabilities.{create,update,delete}`, and `mode` (which gates whether the
`<form>` renders at all) can only be set to non-`null` via `startCreate()` (behind the "novo" button) or
`startEdit()` (behind `row-edit`) — so with all three capabilities false, `logInferenciaClaude`'s screen is
structurally a read-only table with no reachable path to a `<form>`. This is additionally pinned by
`registry.test.ts`'s schema-driven `EXPECTED_CAPABILITIES` map (which is derived from `shared/instant.schema.ts`
via regex, not hand-maintained, and self-checks `>= 9` entities so a schema reformat can't silently drop
coverage), with dedicated tests asserting `instanciasRotina`'s `create`/`delete` are `false` and
`updatableFields` is exactly `["status"]`, and that `logInferenciaClaude`'s three capabilities are all `false`.
The phase's own fail-loud demonstration (renaming `defs/etapas.ts`, flipping `instanciasRotina.capabilities.create`
to `true`) confirmed the gate actually fails when violated. Confirmed clean.

### 6. Lint/type suppressions — CLEAN

`grep -rn "@ts-ignore|biome-ignore|eslint-disable" web/src web/e2e` returns no results in the current tree. The
one documented suppression (`// biome-ignore lint: demo` temporarily added to `registry.ts` in 04-06's fail-loud
demonstration of `verify-phase-04.sh`'s suppression gate) is confirmed absent from the committed state — the
summary's own transcript shows it was added, caused the verify script to fail loudly (`FAIL: suppression gate:
lint/type suppression markers found: ...registry.ts:1:// biome-ignore lint: demo`), then removed before the
final green run, and the current `registry.ts` source (read directly in this review) has no such comment.

## Additional spot-checks (field/link correctness against `shared/instant.schema.ts`)

Cross-checked all 9 `defs/*.ts` files field-by-field and link-by-link against `shared/instant.schema.ts`:
`fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `tickets`, `subtarefas`, `logInferenciaClaude` all
declare exactly the schema's non-`donoId` scalar fields with matching `kind` (boolean→`boolean`,
date→`date`, number→`number`), and every declared `link`/`xorLink` target maps to a real schema link
(`fundoProjetos`, `fundoTemplatesRotina`, `fundoTickets`, `projetoEtapas`, `etapaTarefas`, `tarefaSubtarefas`,
`ticketSubtarefas`, `templateAntecessor`). `templatesRotina.antecessor` correctly sets `excludeSelf: true` for
the self-link. `instanciasRotina` deliberately omits the `template` link (`templateInstancias`) with a clearly
documented rationale (declaring it would make the owning template silently re-editable via the generic
always-editable-link render path, defeating the whole point of `capabilities.create/delete: false` +
`updatableFields: ["status"]`) — a reasonable, explicitly-flagged trade-off given the shared engine has no
read-only-link render mode, not an oversight.

One minor, non-security observation: `fundos.createdAt` is declared as a `required: true` form field, meaning a
user creating a `fundos` record must manually pick a "criado em" date rather than it being system-set. This is a
UX nit, not a correctness or security issue, and is out of scope for this review's focus areas.

## Verdict

No blocking issues found across all six focus areas. One low-severity, currently-unreachable theoretical edge
case is noted in the XOR-unlink fix (item 4) as a suggested minor hardening for future xorLink consumers, not a
required fix for this phase.
