# Phase 1: Repo Scaffold & Live Schema - Research

**Researched:** 2026-08-09
**Domain:** Monorepo scaffolding (uv Python package + Bun/Vite/Svelte 5 SPA) + InstantDB schema/permissions push via `instant-cli`
**Confidence:** MEDIUM-HIGH (tooling versions and CLI flags verified live; end-to-end push against a real InstantDB app not executed in this research session — flagged as an execution-time verification, not a knowledge gap)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

No user-facing `## Decisions` section exists in CONTEXT.md (discuss phase was skipped via `workflow.skip_discuss`). The binding locked constraints instead come from PROJECT.md's Constraints section (C-01 through C-10), which CONTEXT.md explicitly reaffirms as authoritative:

> "PROJECT.md constraints (C-01 through C-10) are LOCKED and must be followed exactly: monorepo layout (`shared/`, `web/`, `cli/`), 8+1 entity schema shape, `donoId` denormalization, quality gates (ruff+ty on cli/, bun+formatter+linter on web/)."

Relevant locked constraints for this phase specifically: C-01 (repo layout), C-04 (schema — 8 entities + `logInferenciaClaude`, `donoId` denormalized), C-05 (auth/perms — magic-code auth, no admin token in normal operation), C-08 (quality gates — ruff+ty on `cli/`, bun+formatter+linter on `web/`).

### Claude's Discretion

Verbatim from CONTEXT.md:

> All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Concretely, this phase leaves the following open for this research/planning pass to resolve: `web/` formatter+linter choice (Prettier+ESLint vs. Biome+`svelte-check`) — resolved in this document's Standard Stack section (recommendation: Biome + `svelte-check`).

### Deferred Ideas (OUT OF SCOPE)

Verbatim from CONTEXT.md:

> None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Monorepo layout exists exactly as specified (`shared/`, `web/`, `cli/`, `.env.instantdb`) | Recommended Project Structure section; Environment Availability (`.env.instantdb` provisioning is the hard prerequisite) |
| SETUP-02 | `cli/` is a `uv`-managed Python 3.12 package that installs cleanly (`uv sync`) with entrypoint `apollo` | Standard Stack (uv/Python 3.12 versions verified locally), Code Examples (`pyproject.toml` `[project.scripts]` pattern), Don't Hand-Roll (`uv init --package` scaffolding) |
| SETUP-03 | `web/` is a `bun`-managed pure Svelte 5 + Vite SPA (no SvelteKit) that installs and runs a dev server cleanly | Standard Stack (bun/svelte/vite versions verified), Recommended Project Structure, `ultima-missao` reference config files (tsconfig, vite.config.ts, index.html) |
| SETUP-04 | `ruff` (curated rule set) and `ty` are configured for `cli/` and pass clean on scaffold files | Standard Stack (ruff 0.16.x default-rule-expansion finding), Code Examples (`[tool.ruff]`/`[tool.ty]` minimal config), Anti-Patterns (don't hand-curate a giant `select` list) |
| SETUP-05 | A formatter (Prettier or Biome) and lint/type checker (ESLint or Biome + `svelte-check`) are configured for `web/` and pass clean | Standard Stack (Biome recommendation + rationale), Alternatives Considered, Pitfall 3 (Biome's experimental Svelte support and its limits) |
| SETUP-06 | Developer can authenticate to InstantDB (CLI login) using the app's `APP_ID` stored in `.env.instantdb`, with no admin token required | Pitfall 4 (distinguishes `instant-cli login` from end-user magic-code auth), Summary point 3, Open Question 3 (app provisioning) |
| SETUP-07 | `shared/instant.schema.ts` defines all 8 domain entities and links and is pushed live to InstantDB | Pattern 1 (schema import source), Pattern 2 (push invocation from `web/`), Pitfall 2 (module resolution), Code Example (schema file skeleton) |
| SETUP-08 | `shared/instant.perms.ts` defines the `donoId`-based permission rules and is pushed live to InstantDB | Context7-verified permissions syntax (CEL-style `allow`/`bind` rules matching the SPEC's exact `auth.id`/`data.donoId` shape), Security Domain (V4 Access Control), Pattern 2 (same push command covers both schema and perms) |
</phase_requirements>

## Summary

Phase 1 has two independent halves that only touch each other through `shared/`: a `uv`-managed Python 3.12 package (`cli/`) and a Bun-executed, plain-Vite Svelte 5 SPA (`web/`, no SvelteKit). Both halves are mature, well-documented ecosystems — the actual risk in this phase is not "which library" but three concrete plumbing problems that are easy to get wrong on the first attempt:

1. **`shared/` has no `package.json` of its own** (per the LOCKED tree in PROJECT.md), yet `instant-cli push` needs to evaluate `shared/instant.schema.ts` / `shared/instant.perms.ts`, which import `i`/`InstantRules` from an `@instantdb/*` package. That package must be resolvable from *some* `node_modules` tree. `web/`'s `node_modules` is the natural place, since `web/` already depends on `@instantdb/svelte` for the app itself — and `@instantdb/svelte` re-exports everything schema authoring needs (`i`, `id`, `tx`, `lookup`, `InstantRules`), so no separate `@instantdb/admin` dependency is needed. `instant-cli` must be invoked from `web/` with `INSTANT_SCHEMA_FILE_PATH=../shared/instant.schema.ts` / `INSTANT_PERMS_FILE_PATH=../shared/instant.perms.ts` env overrides.
2. **Vite does not read `.env.instantdb`.** Vite's env loader only recognizes `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local` — a literally-named `.env.instantdb` is invisible to `import.meta.env` unless the app explicitly loads it (via `dotenv` in `vite.config.ts` + the `define` config option). This is a locked filename (C-01), so the workaround must live in `web/vite.config.ts`, not in a renamed env file.
3. **`instant-cli` auth is two distinct, unrelated credentials.** SETUP-06 ("authenticate using only APP_ID, no admin token") is about `instant-cli login` — the *developer's personal InstantDB account* login (browser magic-link or `--headless`/`-p` token print for CI), which is stored outside the repo and lets the CLI push schema/perms to any app that account owns. It has nothing to do with the *end-user* magic-code auth flow (`apollo auth login`, Phase 3) that InstantDB app users go through. Do not conflate the two in planning — `.env.instantdb` only ever needs to hold `INSTANT_APP_ID` (never `INSTANT_APP_ADMIN_TOKEN`), matching C-05.

For Python quality gates, `ruff` 0.16.x now enables ~413 rules across 34 categories by default (a big jump from the old `E4,E7,E9,F` baseline) — the "curated, not `ALL`" instruction in C-08 is now easier to satisfy by mostly trusting the new default set plus a small `extend-select` for `I` (isort) and `ANN` (require full annotations, matching the "100% typed" mandate), rather than hand-picking dozens of categories. `ty` (Astral's type checker, v0.0.69, pre-1.0) reads `[tool.ty]` from `pyproject.toml` and is invoked as `ty check`.

For `web/`, this research recommends **Biome** (single binary, formatter+linter, native Bun-era tool) over Prettier+ESLint, paired with `svelte-check` for `.svelte`/`.ts` type-checking — this matches the SPEC's own explicit pairing ("ESLint or Biome + `svelte-check`") and keeps the toolchain to two commands. Biome's Svelte support is still labeled experimental (`html.experimentalFullSupportEnabled`), which is an acceptable risk for a near-empty Phase 1 scaffold (one `.svelte` file) but should be re-evaluated if it produces false positives once real components land in Phase 4.

**Primary recommendation:** Scaffold `cli/` with `uv init --package` (entrypoint `apollo` via `[project.scripts]`), scaffold `web/` by hand-copying the proven `ultima-missao` Vite+Svelte5+TS config (not `create-instant-app`, to keep control over the monorepo-non-standard `shared/` and `.env.instantdb` paths), author `shared/instant.schema.ts`/`shared/instant.perms.ts` importing from `@instantdb/svelte`, and push live via `instant-cli` invoked from `web/` with explicit env-var path overrides.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain schema definition (entities, links, field types) | Shared source (`shared/`) | Database (InstantDB) | `shared/instant.schema.ts` is the single TS source; InstantDB is where it becomes live/enforced after `push` |
| Permission rules (`donoId` scoping) | Database (InstantDB) | Shared source (`shared/`) | Rules are authored in `shared/instant.perms.ts` but *enforced* server-side by InstantDB on every query/transact — this is the actual access-control boundary, not a client-side concern |
| Python package tooling (`uv sync`, ruff, ty) | Backend/CLI tier | — | Self-contained in `cli/`; no network dependency for this phase |
| SPA build tooling (`bun install`, Vite, Biome, svelte-check) | Browser/Client tier (build-time) | — | Self-contained in `web/`; Vite is a dev-time/build-time tool, not a runtime server |
| InstantDB app provisioning + schema/perms push | CDN/Static-adjacent (external managed service) | Shared source (`shared/`) | InstantDB is a fully external managed backend; `instant-cli` is the only bridge from repo state to live state |
| `.env.instantdb` (APP_ID) distribution | Shared source (repo root) | Browser/Client + CLI (both read it) | Single source of truth for the app id both runtimes need; consumption mechanism differs per runtime (see Pitfall 1) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `uv` | 0.9.21 [VERIFIED: installed locally] | Python package/dependency manager for `cli/` | Already locked by PROJECT.md; fastest resolver, manages Python 3.12 toolchain itself |
| Python | 3.12.12 (uv-managed) [VERIFIED: `uv python list`] | `cli/` runtime | Locked by PROJECT.md; system `python3` on this machine is only 3.10, so `uv` must provision 3.12 itself — not a blocker, just don't rely on system `python3` |
| `click` | 8.4.2 [VERIFIED: PyPI] | CLI framework for `apollo` entrypoint | Explicitly locked by C-07 |
| `ruff` | 0.16.2 [VERIFIED: PyPI] | Lint + format for all `.py` files | Locked by C-08 ("curated rule set"); single Rust binary replaces flake8+isort+black |
| `ty` | 0.0.69 [VERIFIED: PyPI] | Type checker for `cli/` | Explicitly named in SPEC ("verificador de tipos da Astral"); still pre-1.0, expect API churn |
| `bun` | 1.3.12 [VERIFIED: installed locally] | Sole JS/TS executor for `web/` | Locked by C-08 |
| `svelte` | 5.55.5–5.56.8 range; latest 5.56.8 [VERIFIED: npm] | UI framework | Locked by PROJECT.md; use runes (`$state`, `$props`) |
| `vite` | latest 8.2.1 [VERIFIED: npm]; `ultima-missao` reference pins `^8.2.0`/`^8.0.10` | Build tool, plain SPA (no SvelteKit) | Locked ("Vite puro, sem SvelteKit") |
| `@sveltejs/vite-plugin-svelte` | latest 7.3.0 [VERIFIED: npm] | Svelte↔Vite integration | Required for `.svelte` compilation under plain Vite |
| `@instantdb/svelte` | 1.0.63 [VERIFIED: npm] | InstantDB client SDK for Svelte, plus schema-authoring helpers | Only package needed in `web/` — re-exports `i`, `id`, `tx`, `lookup`, `InstantRules` (confirmed by inspecting the package's `dist/index.d.ts`), so a separate `@instantdb/admin` dependency is unnecessary |
| `instant-cli` | v1.0.63 [VERIFIED: `npx instant-cli@latest --version`] | Pushes/pulls `instant.schema.ts`/`instant.perms.ts` to the live app | Official InstantDB CLI; invoked via `npx`/`bunx`, no need to add as a persistent dependency unless pinning is desired |
| `instantdb` (Python) | 1.0.63 [VERIFIED: PyPI, `pip install instantdb` / `uv add instantdb`] | Official **Server-side Python Admin SDK** for InstantDB | Confirmed to exist on PyPI, published by InstantDB itself, requires Python ≥3.10. Not required to *function* in Phase 1 (no CLI commands do real work yet) but should be added as a `cli/` dependency now so `uv sync` proves the real dependency tree resolves — see Open Questions for the auth-model caveat |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-dotenv` | 1.2.2 [VERIFIED: PyPI] | Load `.env.instantdb` into `cli/` process env | Needed because `.env.instantdb` lives at repo root, not inside `cli/` — CLI must resolve the path explicitly (e.g. walk up from `cli/` to find repo root, or accept a `--env-file` override) |
| `@biomejs/biome` | 2.5.7 [VERIFIED: npm] | Formatter + linter for `web/` | Recommended over Prettier+ESLint — see rationale below and Pitfall 3 |
| `svelte-check` | latest 4.7.5 [VERIFIED: npm]; reference pins `^4.7.3` | Type-checks `.svelte` + `.ts` against `tsconfig` | Required regardless of Biome/ESLint choice — SPEC explicitly pairs it with either option |
| `typescript` | ~5.9.3 [VERIFIED: npm, matches `ultima-missao`] | Type-checking substrate for `svelte-check`/`tsc` | Peer dependency of `svelte-check` and `@sveltejs/vite-plugin-svelte` |
| `@tsconfig/svelte` | ^5.0.8 (from reference) | Base `tsconfig` for Svelte projects | Used by `ultima-missao`'s `tsconfig.app.json`; saves hand-writing Svelte-specific compiler flags |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Biome | Prettier + ESLint + `eslint-plugin-svelte` | More mature/stable Svelte lint coverage (no "experimental" flag needed), but 3 tools/configs instead of 1, slower, and not what the reference project (`ultima-missao`) or the old `apollo` uses. SPEC explicitly allows either; Biome fits the "bun as sole executor, minimize tooling surface" spirit better |
| `@instantdb/svelte` for schema authoring | `@instantdb/admin` | `@instantdb/admin` is the canonical package `create-instant-app` scaffolds with for schema files, and works identically since both re-export the same `i` builder — but it would be an extra dependency in `web/` with no runtime purpose (it's a Node-oriented server SDK) when `@instantdb/svelte` already provides everything needed |
| `uv init --package` scaffold | Hand-written `pyproject.toml` (like original `apollo`, which used bare `hatchling` config) | `uv init --package` gets `[project.scripts]`, `.python-version`, and a build-backend wired automatically; hand-writing risks missing the console-script entrypoint wiring that SETUP-02 explicitly checks |
| Manual `dotenv` + Vite `define` for `.env.instantdb` | Renaming the file to `.env` or `.env.local` | Renaming would violate the LOCKED filename in C-01/PROJECT.md tree; must keep `.env.instantdb` and work around Vite's loader instead |

**Installation:**
```bash
# cli/
cd cli
uv init --package --app --name apollo-cli --python 3.12
uv add click instantdb python-dotenv
uv add --dev ruff ty

# web/
cd web
bun init -y   # or hand-write package.json per ultima-missao reference
bun add @instantdb/svelte
bun add -d @sveltejs/vite-plugin-svelte @tsconfig/svelte svelte-check typescript vite @biomejs/biome @types/bun
```

**Version verification:** All versions above were checked live against PyPI/npm registries and installed local tool versions on 2026-08-09 — see Sources. `ty` and `instantdb` (Python) are both young/pre-1.0-adjacent packages; re-check versions at execution time since both ship frequently.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │   shared/ (TS source, no     │
                     │   package.json)              │
                     │   instant.schema.ts          │
                     │   instant.perms.ts           │
                     └───────────────┬──────────────┘
                                     │ imported by (relative path)
                 ┌───────────────────┴───────────────────┐
                 │                                        │
                 ▼                                        ▼
      ┌─────────────────────┐                  ┌────────────────────────┐
      │ web/ (Bun + Vite)    │                  │ instant-cli (via npx,  │
      │ node_modules has     │◄─── invoked from ┤ cwd = web/)            │
      │ @instantdb/svelte    │     web/ so it   │ reads INSTANT_SCHEMA_  │
      │                      │     can resolve  │ FILE_PATH / INSTANT_   │
      │ web/src/lib/db.ts    │     the `i`      │ PERMS_FILE_PATH env    │
      │ init({appId, schema})│     import       │ vars pointing at       │
      └──────────┬───────────┘                  │ ../shared/instant.*    │
                 │                               └───────────┬────────────┘
                 │ reads VITE_INSTANT_APP_ID                 │ push (schema+perms)
                 │ (injected via vite.config.ts               │
                 │  dotenv+define workaround —                ▼
                 │  see Pitfall 1)                  ┌───────────────────────┐
                 │                                  │   InstantDB (live,    │
                 └─────────────────────────────────►│   hosted) — the app's │
                                                     │   only backend        │
                 ┌─────────────────────────────────►│                       │
                 │ reads INSTANT_APP_ID directly     └───────────────────────┘
                 │ (no bundler, no prefix needed)
      ┌──────────┴───────────┐
      │ cli/ (uv + Python)    │
      │ apollo_cli package    │
      │ entrypoint: apollo    │
      │ dep: instantdb (Admin │
      │ SDK, Python), click   │
      └───────────────────────┘

Root: .env.instantdb  (INSTANT_APP_ID only — no admin token, per C-05/SETUP-06)
      ├─ read by web/vite.config.ts (dotenv + define workaround)
      └─ read by cli/ via python-dotenv (direct os.environ, no prefix issue)
```

### Recommended Project Structure

```
apollo-v2/
├── .env.instantdb                  # INSTANT_APP_ID=... (gitignored)
├── .gitignore                      # must ignore .env.instantdb, node_modules, .venv, dist/, .svelte-kit not applicable
├── shared/
│   ├── instant.schema.ts           # imports { i } from "@instantdb/svelte"
│   └── instant.perms.ts            # imports { type InstantRules } from "@instantdb/svelte"
├── web/
│   ├── package.json                # deps: @instantdb/svelte; devDeps: vite, svelte, svelte-check, biome, etc.
│   ├── biome.json
│   ├── index.html
│   ├── vite.config.ts              # dotenv(../.env.instantdb) + define workaround; svelte() plugin
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   └── src/
│       ├── main.ts
│       ├── App.svelte
│       └── lib/
│           └── db.ts               # init({ appId: import.meta.env.VITE_INSTANT_APP_ID, schema })
└── cli/
    ├── pyproject.toml              # [project.scripts] apollo = "apollo_cli.cli:main"; [tool.ruff] / [tool.ty]
    ├── uv.lock
    └── apollo_cli/
        ├── __init__.py
        └── cli.py                  # click group, stub `apollo` command for Phase 1
```

### Pattern 1: Schema file imports from the client SDK, not the admin SDK

**What:** `shared/instant.schema.ts` and `shared/instant.perms.ts` import `i` / `InstantRules` from `@instantdb/svelte`, since that package re-exports the full schema-authoring surface.
**When to use:** Whenever the only JS/TS runtime in the monorepo is the client SPA (no Node backend), avoiding an otherwise-unused `@instantdb/admin` dependency.
**Example:**
```typescript
// shared/instant.schema.ts
// Source: verified via `npm pack @instantdb/svelte` -> dist/index.d.ts re-export list
import { i } from "@instantdb/svelte";

const _schema = i.schema({
  entities: {
    fundos: i.entity({
      nome: i.string(),
      codigo: i.string(),
      ativo: i.boolean(),
      donoId: i.string().indexed(),
      createdAt: i.date(),
    }),
    // ...remaining 7 entities per SPEC "Schema do InstantDB" table
  },
  links: {
    fundoProjetos: {
      forward: { on: "projetos", has: "one", label: "fundo" },
      reverse: { on: "fundos", has: "many", label: "projetos" },
    },
    // ...
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
```

### Pattern 2: `instant-cli` invoked from `web/` with path overrides

**What:** Since `shared/` has no `node_modules`, run `instant-cli` from `web/` (where `@instantdb/svelte` is installed) and redirect it to the actual schema/perms location via env vars.
**When to use:** Every `push`/`pull` operation in this repo layout.
**Example:**
```jsonc
// web/package.json (scripts section)
{
  "scripts": {
    "instant:push": "INSTANT_SCHEMA_FILE_PATH=../shared/instant.schema.ts INSTANT_PERMS_FILE_PATH=../shared/instant.perms.ts instant-cli push all --env ../.env.instantdb --package svelte --yes",
    "instant:pull": "INSTANT_SCHEMA_FILE_PATH=../shared/instant.schema.ts INSTANT_PERMS_FILE_PATH=../shared/instant.perms.ts instant-cli pull all --env ../.env.instantdb --package svelte --yes"
  }
}
```
Run with `bun run instant:push` from `web/`. `instant-cli` is resolved via `bunx`/npm's local-bin lookup if added as a devDependency, or falls back to `npx` resolution if not installed locally — pin it as a devDependency (`bun add -d instant-cli`) for reproducibility. [CITED: `instant-cli push --help` output, `--env` flag and `INSTANT_SCHEMA_FILE_PATH`/`INSTANT_PERMS_FILE_PATH` env vars — verified live via `npx instant-cli@latest push --help`]

### Pattern 3: Vite must be told to load `.env.instantdb` explicitly

**What:** Vite's built-in env loader ignores non-conforming filenames. Load `.env.instantdb` manually and inject the value.
**When to use:** Any time `web/` needs `VITE_INSTANT_APP_ID` at build/dev time.
**Example:**
```typescript
// web/vite.config.ts
// Source: https://vite.dev/guide/env-and-mode.html (confirms Vite only auto-loads
// .env / .env.local / .env.[mode] / .env.[mode].local — verified via WebFetch)
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv({ path: path.resolve(__dirname, "../.env.instantdb") });

export default defineConfig({
  plugins: [svelte()],
  define: {
    "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(process.env.INSTANT_APP_ID),
  },
});
```
`dotenv` ships as a transitive dependency of Vite already, but add it explicitly (`bun add -d dotenv`) so `web/`'s own `node_modules` resolution doesn't depend on Vite's internal layout.

### Anti-Patterns to Avoid

- **Renaming `.env.instantdb` to fit Vite's convention:** Violates the LOCKED filename in PROJECT.md/C-01. Fix Vite's config instead (Pattern 3).
- **Adding `@instantdb/admin` to `web/` "just to author the schema":** Unnecessary — `@instantdb/svelte` already re-exports `i`/`InstantRules`. Extra dependency with zero runtime use.
- **Running `instant-cli` from repo root or from `shared/`:** Will fail to resolve `@instantdb/*` imports inside the schema/perms files unless a `node_modules` tree exists at that location. Always run from `web/` (or wherever the `@instantdb/*` package is actually installed).
- **Hand-rolling a "curated" `ruff` `select` list from scratch:** Ruff 0.16.x's default (413 rules, 34 categories) is already curated by Astral. Start from defaults, `extend-select` only `I` and `ANN` for the 100%-typed mandate, and use `ignore`/per-file-ignores to trim noise — don't rebuild the wheel with a giant manual `select` list.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Reading a non-standard `.env` filename in Vite | Custom Vite plugin | `dotenv` + `define` in `vite.config.ts` (Pattern 3) | Two-line, well-understood workaround; a custom plugin is unnecessary ceremony for one variable |
| CLI console-script wiring | Manual `setup.py`/`entry_points` | `uv init --package` + `[project.scripts]` | uv's scaffolder wires the build backend and script table correctly in one command; hand-writing risks a broken/missing entrypoint that SETUP-02 explicitly checks |
| Schema/perms TS typing helpers | Hand-written interfaces for entities/links | `i.schema()` / `i.entity()` from `@instantdb/svelte` (the same builder InstantDB's own docs and `create-instant-app` scaffold use) | InstantDB's schema builder generates the exact shape their backend and client SDK expect; hand-rolled types will drift and won't be understood by `instant-cli push` |
| Ruff "curated" rule selection | 40+ line manual `select = [...]` list | Ruff 0.16.x defaults + small `extend-select` | Astral already curated ~413 rules across 34 categories as the new default in 0.16; re-curating from zero duplicates their work and risks missing rule interactions they've already tuned |

**Key insight:** Everything in this phase that looks like "custom glue code" (env loading, schema types, CLI entrypoints) already has an official, maintained mechanism one level up the stack (Vite's `define`, InstantDB's `i` builder, uv's package scaffolder, Ruff's default ruleset). The actual engineering work in Phase 1 is *wiring these together correctly across the monorepo's non-standard `shared/` boundary*, not building new abstractions.

## Common Pitfalls

### Pitfall 1: Vite silently serves `undefined` for `VITE_INSTANT_APP_ID`
**What goes wrong:** Developer sets `INSTANT_APP_ID=xxx` in `.env.instantdb`, runs `bun run dev`, and `import.meta.env.VITE_INSTANT_APP_ID` is `undefined` — InstantDB's `init()` call either throws or silently connects to no app.
**Why it happens:** Vite only auto-loads `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. `.env.instantdb` matches none of these patterns (unless Vite is run with `--mode instantdb`, which is not what anyone intends). [CITED: vite.dev/guide/env-and-mode.html]
**How to avoid:** Explicit `dotenv` load + `define` injection in `vite.config.ts` (Pattern 3 above).
**Warning signs:** `db.useAuth()` never resolves, network tab shows requests to InstantDB with `appId=undefined` or a 400 from InstantDB's API.

### Pitfall 2: `instant-cli push` fails with a module-resolution error, not a helpful one
**What goes wrong:** Running `npx instant-cli push` from repo root (or from `shared/`) fails because `shared/instant.schema.ts`'s `import { i } from "@instantdb/svelte"` can't be resolved — there's no `node_modules` at or above `shared/` in the LOCKED layout.
**Why it happens:** `shared/` intentionally has no `package.json` per C-01. `instant-cli` bundles/evaluates the TS file using Node module resolution from its own cwd.
**How to avoid:** Always invoke `instant-cli` with cwd = `web/`, using `INSTANT_SCHEMA_FILE_PATH`/`INSTANT_PERMS_FILE_PATH` to point at the real files (Pattern 2).
**Warning signs:** Error mentions "Cannot find module '@instantdb/...'" or similar during the push/pull's internal build step.

### Pitfall 3: Biome's Svelte support is still "experimental" — don't assume full lint coverage
**What goes wrong:** Biome reports zero errors on a `.svelte` file that actually has issues, or (once real components exist in Phase 4) mis-parses newer Svelte 5 syntax.
**Why it happens:** Biome's HTML-ish-language support (Vue/Svelte/Astro) requires the explicit `html.experimentalFullSupportEnabled` flag and is described by Biome's own changelog as not yet covering "newer features, rare syntax, or edge cases." [CITED: biomejs.dev/blog/biome-v2-4/ via WebSearch, cross-referenced with alternativeto.net's Biome 2.3 coverage note — MEDIUM confidence]
**How to avoid:** Keep `svelte-check` as the authoritative type/logic checker for `.svelte` files (it wraps the real Svelte compiler + TS), and treat Biome as formatting + plain `.ts` linting. If Biome's Svelte linting produces false positives on the Phase 1 scaffold, disable Svelte-specific Biome lint rules rather than fighting them, and lean on `svelte-check`.
**Warning signs:** `bun run check` (Biome) is clean but `svelte-check` reports errors Biome missed, or vice versa with confusing overlapping diagnostics.

### Pitfall 4: Confusing `instant-cli login` with end-user magic-code auth
**What goes wrong:** Planner/implementer assumes SETUP-06 requires building the app-user magic-code flow in Phase 1, or conversely assumes `instant-cli push` needs `INSTANT_APP_ADMIN_TOKEN` in `.env.instantdb`.
**Why it happens:** InstantDB has two unrelated auth surfaces that both involve "no admin token" language: (a) `instant-cli login` — a personal developer-account login (via browser or `-p`/`--headless` token print) used only to authorize schema/perms pushes; (b) end-user magic-code auth (`db.auth.sendMagicCode`/`signInWithMagicCode` on the client, or the equivalent flow the Python `instantdb` Admin SDK would need to proxy for `apollo auth login` in Phase 3).
**How to avoid:** Phase 1 only needs (a). Document `.env.instantdb` as containing `INSTANT_APP_ID` only; the developer runs `npx instant-cli login` once (interactively) before the first push, and that credential is stored by `instant-cli` outside the repo (or via `INSTANT_CLI_AUTH_TOKEN` env var for CI/headless use — obtained via `instant-cli login -p`).
**Warning signs:** A plan step that tries to embed `INSTANT_APP_ADMIN_TOKEN` in `.env.instantdb`, or that tries to implement full user auth as part of "push schema live."

### Pitfall 5: `ty` and the Python `instantdb` Admin SDK are both pre-1.0 / young
**What goes wrong:** Exact CLI flags, config schema, or SDK method names shift between patch releases.
**Why it happens:** `ty` is 0.0.69 (explicitly pre-1.0). The Python `instantdb` package is versioned in lockstep with the rest of the InstantDB monorepo (1.0.63) but is a comparatively new addition (Python support is documented at `instantdb.com/docs/start-python`, a page not deeply explored in this research pass).
**How to avoid:** Pin exact versions in `cli/pyproject.toml` (not loose `^`/`>=` ranges) and re-verify `ty check`/`instantdb` API surface at execution time rather than trusting this document's exact flag names beyond what's already `[VERIFIED]` here.
**Warning signs:** `ty check` CLI flags in this document not matching `ty --help` output at execution time.

## Code Examples

### Minimal `cli/pyproject.toml` ruff + ty config
```toml
# Source: ruff defaults per pydevtools.com/blog/ruff-0-16-0-default-rules/ (MEDIUM confidence,
# cross-check against `ruff check --show-settings` at execution time)
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
extend-select = ["I", "ANN"]  # isort + require type annotations (100%-typed mandate, C-08)

[tool.ty.environment]
python-version = "3.12"
```

### Minimal `cli/pyproject.toml` script entrypoint
```toml
# Source: uv init --package scaffolding convention (VERIFIED via `uv init --help`)
[project]
name = "apollo-cli"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["click>=8.4", "instantdb>=1.0.63", "python-dotenv>=1.2"]

[project.scripts]
apollo = "apollo_cli.cli:main"

[dependency-groups]
dev = ["ruff>=0.16", "ty>=0.0.69"]
```

### Minimal `web/biome.json`
```jsonc
// Source: biomejs.dev/blog/biome-v2-4/ (MEDIUM confidence — experimental Svelte flag)
{
  "$schema": "https://biomejs.dev/schemas/2.5.7/schema.json",
  "files": { "includes": ["src/**/*.ts", "src/**/*.svelte", "*.ts"] },
  "html": { "experimentalFullSupportEnabled": true },
  "formatter": { "enabled": true, "indentStyle": "space" },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `ruff` default = `E4,E7,E9,F` (~4 categories) | `ruff` default = 413 rules / 34 categories | Ruff 0.16.0 | "Curated, not `ALL`" (C-08) is now closer to "trust defaults + small extend-select" than "hand-pick a large select list" |
| Prettier + ESLint for Svelte/TS projects | Biome (single binary) as a viable single-tool alternative | Biome 2.3–2.5 (2025-2026) added Vue/Svelte/Astro parsing | Fewer config files, but Svelte support is explicitly still experimental — verify before fully trusting it in later phases |
| `@instantdb/admin` as the default schema-authoring import in InstantDB examples/scaffolds | Each framework package (`@instantdb/svelte`, `@instantdb/react`, etc.) now re-exports the same `i`/`InstantRules` builder | Confirmed on `@instantdb/svelte@1.0.63` (current) | No need for a second `@instantdb/admin` dependency in a client-only monorepo half |

**Deprecated/outdated:**
- None identified as deprecated within this phase's scope; all recommended tools are actively maintained current releases.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `instant-cli push` invoked from `web/` with `INSTANT_SCHEMA_FILE_PATH`/`INSTANT_PERMS_FILE_PATH` pointing at `../shared/*.ts` will successfully resolve `@instantdb/svelte` imports inside those files | Pattern 2, Pitfall 2 | If wrong, the first concrete Phase 1 task (pushing schema live) fails immediately; fallback is adding a minimal root-level `package.json`+`node_modules` solely for running `instant-cli`, or moving schema/perms files temporarily during push (not recommended) |
| A2 | `instant-cli --package svelte` correctly detects/uses `@instantdb/svelte` when installed in `web/node_modules` without needing `@instantdb/admin` present | Standard Stack, Pattern 1 | If wrong, add `@instantdb/admin` as an additional `web/` devDependency — low-cost fallback |
| A3 | The Python `instantdb` Admin SDK (PyPI `instantdb` 1.0.63) is the package the SPEC intends when it says "CLI Python usando o SDK do InstantDB" | Standard Stack | If wrong (e.g. Phase 3 discovers the Admin SDK's `admin_token`-only design conflicts with C-05's "no admin token in normal operation"), Phase 3 may need to hand-roll HTTP calls to InstantDB's public (non-admin) auth endpoints instead — does not block Phase 1, since Phase 1 only needs `uv sync` to succeed with this dependency declared |
| A4 | Biome's experimental Svelte support (`html.experimentalFullSupportEnabled`) will not produce false-positive lint errors against the trivial Phase 1 scaffold (one `App.svelte` file with minimal markup) | Standard Stack, Pitfall 3 | If wrong, SETUP-05's "pass clean" gate fails on a Biome false positive; fallback is disabling the specific Svelte lint rule or excluding `.svelte` files from Biome's linter (keep only formatter) and relying on `svelte-check` for `.svelte` correctness |
| A5 | A root-level `package.json` is not required by the LOCKED tree and all push/pull tooling can live inside `web/package.json` | Architecture Patterns | If wrong (e.g. planner/user wants push tooling decoupled from the SPA's own dependencies), an alternative is a minimal root `package.json` with only `@instantdb/svelte`+`instant-cli` as devDependencies purely for schema management — not a blocking risk either way |

**If this table is empty:** N/A — see entries above. All are LOW-to-MEDIUM risk and have documented fallbacks; none block starting Phase 1 execution.

## Open Questions

1. **Does the Python `instantdb` Admin SDK support a non-admin-token magic-code login path?**
   - What we know: The SDK's top-level `Instant(app_id=..., admin_token=...)` constructor requires an admin token (it's explicitly the "Admin SDK"). It exposes `db.auth.create_token(email=...)` (admin-only, mints a session without a code) and `db.as_user(...)` for permission-scoped impersonation.
   - What's unclear: Whether `apollo auth login`'s magic-code flow (Phase 3, C-05: "no admin token in normal operation") is meant to call InstantDB's *public* (non-admin) magic-code REST endpoints directly via HTTP (bypassing the Python `instantdb` package's admin-gated methods), or whether the Python SDK has an undocumented non-admin client mode.
   - Recommendation: Not a Phase 1 blocker (Phase 1 only needs `uv sync` to succeed with `instantdb` declared as a dependency). Flag explicitly for Phase 3 research to resolve before CLI auth implementation begins — check `instantdb.com/docs/start-python` in depth and inspect the PyPI package's `_async`/`_sync` source for a non-admin client class.

2. **Will `instant-cli push --package svelte` require any interactive confirmation the first time it creates entities on a brand-new (empty-schema) app?**
   - What we know: The `push` command accepts `--yes`/`-y` (global option) to skip prompts, and `push schema` also accepts `--skip-check-types`.
   - What's unclear: Whether the very first push to a freshly created InstantDB app (0 existing entities) behaves differently from an incremental push, and whether `--yes` alone is sufficient for a fully non-interactive first push (relevant given this project runs autonomously per C-10/PROJECT.md).
   - Recommendation: Plan the first push as an explicit, closely-observed task (not assumed to be silent/automatic); include `--yes` and check exit code, not just stdout.

3. **Does the InstantDB app referenced by the (inaccessible) old `apollo/.env.instantdb` already exist and match this project's needs, or must a brand-new app be created for `apollo-v2`?**
   - What we know: PROJECT.md/STATE.md flag "InstantDB app must exist and `.env.instantdb` (`APP_ID`) must be provisioned before Phase 1 can push" as the first concrete blocker. The old `apollo` repo's `.env.instantdb` file exists but its contents could not be read (permission-denied by design).
   - What's unclear: Whether that old file refers to a scratch/test app unrelated to `apollo-v2`, or something reusable.
   - Recommendation: Treat this as a fresh-app decision for the planner/user — run `npx instant-cli login` then `npx instant-cli init` (or `app list` to check existing apps) as the literal first task of Phase 1, rather than assuming an app already exists.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `uv` | `cli/` package management | ✓ | 0.9.21 | — |
| Python 3.12 (uv-managed) | `cli/` runtime | ✓ | 3.12.12 (via `uv python`) | System `python3` is 3.10 — do not invoke bare `python3`, always go through `uv run`/`uv sync` |
| `bun` | `web/` package management + execution | ✓ | 1.3.12 | — |
| `ruff` | `cli/` lint/format gate | ✗ (not globally installed) | — | Install as `cli/` dev dependency via `uv add --dev ruff`; invoke via `uv run ruff` |
| `ty` | `cli/` type-check gate | ✗ (not globally installed) | — | Install as `cli/` dev dependency via `uv add --dev ty`; invoke via `uv run ty check` |
| `instant-cli` | Schema/perms push | ✓ (via `npx`/`bunx`, not globally installed) | v1.0.63 (latest, verified live) | Pin as `web/` devDependency (`bun add -d instant-cli`) for reproducibility instead of relying on `npx` fetching latest each time |
| Live InstantDB app + credentials | SETUP-06, SETUP-07, SETUP-08 | ✗ (not yet provisioned — see Open Question 3) | — | No fallback; this is a hard prerequisite. First Phase 1 task must be: `instant-cli login` (developer's personal account) then create/select the app and populate `.env.instantdb` with its `INSTANT_APP_ID` |

**Missing dependencies with no fallback:**
- A live, provisioned InstantDB app + `.env.instantdb` populated with its `INSTANT_APP_ID`. This must be the literal first task of Phase 1 execution.

**Missing dependencies with fallback:**
- `ruff`, `ty` — installed on-demand as `cli/` dev dependencies, not a machine-wide prerequisite.
- `instant-cli` — usable via `npx`/`bunx` without a persistent install; pinning is a nice-to-have, not a blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed yet in either `cli/` or `web/` (fresh repo). Phase 1's requirements are infrastructure/tooling gates, not application behavior — most "tests" for this phase are shell-command exit-code checks, not pytest/vitest assertions |
| Config file | none — see Wave 0 |
| Quick run command | Per-requirement shell commands (see table below); no single "quick suite" exists yet |
| Full suite command | N/A for this phase — a real test suite starts in Phase 3 (CLI CRUD) / Phase 4 (SPA) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | Monorepo layout matches locked tree | smoke | `test -d shared && test -d web && test -d cli && test -f .env.instantdb` | ❌ Wave 0 (just a shell check, no file needed) |
| SETUP-02 | `cli/` installs cleanly, entrypoint `apollo` exists | smoke | `cd cli && uv sync && uv run apollo --help` | ❌ Wave 0 |
| SETUP-03 | `web/` installs and runs dev server cleanly | smoke | `cd web && bun install && timeout 5 bun run dev` (or check `vite build` exits 0) | ❌ Wave 0 |
| SETUP-04 | `ruff` + `ty` clean on `cli/` | lint gate | `cd cli && uv run ruff check . && uv run ty check` | ❌ Wave 0 |
| SETUP-05 | `web/` formatter+linter+`svelte-check` clean | lint gate | `cd web && bunx biome check . && bun run check` (svelte-check script) | ❌ Wave 0 |
| SETUP-06 | `instant-cli` auth works with only `APP_ID` in `.env.instantdb` | manual/smoke | `npx instant-cli login` (once, interactive) then `cd web && bun run instant:push --dry-run`-equivalent, or just confirm push succeeds in SETUP-07 | ❌ Wave 0 — inherently requires a one-time human/interactive login step, cannot be fully automated in CI without `INSTANT_CLI_AUTH_TOKEN` |
| SETUP-07 | `shared/instant.schema.ts` (8 entities+links) pushed live | integration (against real external service) | `cd web && bun run instant:push` then `npx instant-cli pull schema --env ../.env.instantdb` and diff against source | ❌ Wave 0 |
| SETUP-08 | `shared/instant.perms.ts` (donoId rules) pushed live | integration | Same push command as SETUP-07 (`push all` covers both); verify via InstantDB dashboard/Explorer or `instant-cli pull perms` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Run the specific shell command(s) for the requirement(s) that task touches (table above).
- **Per wave merge:** Re-run all SETUP-01..08 commands in sequence.
- **Phase gate:** All 8 commands must exit 0 before `/gsd-verify-work`; SETUP-07/08 additionally require a manual/automated `pull` + diff confirming the live app matches `shared/` source (idempotency check — a second `push` should be a no-op).

### Wave 0 Gaps
- [ ] No test framework needed for this phase specifically — first real pytest/vitest setup is a Phase 3/Phase 4 concern, not Phase 1.
- [ ] `cli/apollo_cli/cli.py` — stub `apollo` click group must exist for `uv run apollo --help` to succeed (SETUP-02).
- [ ] `web/vite.config.ts` — must implement the dotenv+define workaround (Pitfall 1) before any smoke test involving `VITE_INSTANT_APP_ID` can pass.
- [ ] A documented one-time manual step: `npx instant-cli login` — this cannot be scripted into an automated gate without also setting up `INSTANT_CLI_AUTH_TOKEN` for the executing environment; the plan should call this out explicitly as a human-in-the-loop or pre-authorized-headless step (project runs via `/gsd:autonomous`, so consider capturing `INSTANT_CLI_AUTH_TOKEN` once and storing it wherever the autonomous session's secrets live, analogous to how C-10 already authorizes reading magic-code emails unattended).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Partial (deferred to Phase 3) | `instant-cli login` (developer) is out of app-scope; end-user magic-code auth is Phase 3 — not implemented in Phase 1 |
| V3 Session Management | No (Phase 1 has no sessions) | — |
| V4 Access Control | **Yes — this is the core of the phase** | `shared/instant.perms.ts` rules (`auth.id != null && auth.id == data.donoId` / `newData.donoId`), enforced server-side by InstantDB on every query/transact once pushed live |
| V5 Input Validation | No (no user input handling in Phase 1) | — |
| V6 Cryptography | No (InstantDB manages its own transport/at-rest crypto; nothing hand-rolled here) | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Committing `.env.instantdb` (or worse, an admin token) to git | Information Disclosure | `.gitignore` must include `.env.instantdb` from the very first commit of Phase 1; C-05 already forbids an admin token from existing in the file at all — enforce by never adding `INSTANT_APP_ADMIN_TOKEN` to any tracked file or script default |
| Misconfigured/typo'd `instant.perms.ts` rule (e.g. `data.donoId` on one entity, `data.dono_id` typo on another) allowing cross-`donoId` access | Elevation of Privilege / Tampering | Rules must be identical, verbatim, across all 8 domain entities (per SPEC); Phase 6's VERIFY-05 is the actual test for this, but Phase 1 should write the rules from a single template/loop rather than hand-copy-pasting 8 times, to reduce typo risk |
| Pushing schema/perms via `instant-cli` from an untrusted/shared CI runner using a broadly-scoped personal `INSTANT_CLI_AUTH_TOKEN` | Information Disclosure / Elevation of Privilege | Given this project runs locally/autonomously for one developer (not a shared CI fleet per RNF-03-style single-user constraints inherited from the original `apollo`), this risk is low but worth noting: `INSTANT_CLI_AUTH_TOKEN` grants push access to *all* apps on the developer's InstantDB account, not just this one — treat it with the same care as any personal credential |

## Sources

### Primary (HIGH confidence)
- `npx instant-cli@latest --version` / `push --help` / `login --help` / `init --help` / `auth --help` / `app --help` — live CLI introspection, 2026-08-09
- `npm view` / `curl https://registry.npmjs.org/...` for `svelte`, `vite`, `@instantdb/svelte`, `@instantdb/admin`, `@sveltejs/vite-plugin-svelte`, `@biomejs/biome`, `prettier`, `eslint`, `svelte-check`, `eslint-plugin-svelte` — live registry queries, 2026-08-09
- `curl https://pypi.org/pypi/{ruff,ty,click,python-dotenv,instantdb}/json` — live PyPI queries, 2026-08-09
- `npm pack @instantdb/svelte@latest` + inspection of `dist/index.d.ts` and `dist/cli.d.ts` — confirms `i`, `id`, `tx`, `lookup`, `InstantRules` are all re-exported, and a dedicated `./dist/cli` export exists for `instant-cli --package svelte` detection
- Context7 (`/websites/instantdb` via `ctx7` CLI fallback) — schema/entity/link/permission syntax (`i.schema`, `i.entity`, `bind`, CEL-style rules), Svelte quickstart (`init`, `db.useAuth()`, `db.auth.signInWithMagicCode`)
- `~/pessoal/ultima-missao` (working reference repo: `package.json`, `src/lib/db.ts`, `instant.schema.ts`, `instant.perms.ts`, `vite.config.ts`, `svelte.config.js`, `tsconfig*.json`, `DEPLOY.md`) — every config file in this research's "Recommended Project Structure" is grounded in a file actually read from this repo
- `uv init --help`, `uv python list` — live local tool introspection, 2026-08-09
- vite.dev/guide/env-and-mode.html via WebFetch — confirms Vite's exact env-file naming convention

### Secondary (MEDIUM confidence)
- pydevtools.com/blog/ruff-0-16-0-default-rules/ (via WebFetch) — Ruff 0.16 default rule expansion; cross-check against `ruff check --show-settings` at execution time since this is a third-party summary, not Astral's own changelog
- biomejs.dev/blog/biome-v2-4/ + alternativeto.net Biome 2.3 coverage note (via WebSearch) — Biome's experimental Svelte support status
- docs.astral.sh/ty/reference/configuration + CLI reference (via WebSearch/WebFetch) — `ty check`, `[tool.ty]` config table; `ty` is young enough that exact flags should be re-verified at execution time

### Tertiary (LOW confidence)
- WebSearch summary claiming "InstantDB offers a Python SDK" was initially vague/uncertain — upgraded to HIGH confidence after directly confirming via `pypi.org/pypi/instantdb/json` (the PyPI JSON API), so no LOW-confidence claims remain in this document's final form regarding the Python SDK's *existence*. Its exact non-admin auth capabilities (Open Question 1) remain unverified and are explicitly flagged as such.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number was checked against a live registry/PyPI/local-tool-introspection call, not training-data recall
- Architecture (monorepo wiring, `instant-cli` path resolution, Vite env workaround): MEDIUM — individually verified pieces (CLI flags, Vite docs) combined into a novel-for-this-repo integration pattern that has not been executed end-to-end in this research session
- Pitfalls: MEDIUM-HIGH — Pitfalls 1, 2, 4 are grounded in verified official docs/CLI output; Pitfall 3 (Biome+Svelte) and Pitfall 5 (young-package churn) are inherently speculative/forward-looking by nature

**Research date:** 2026-08-09
**Valid until:** 2026-08-23 (14 days) — shorter than the default 30-day window because `ty`, the Python `instantdb` SDK, and Biome's Svelte support are all fast-moving, pre-1.0-or-recently-stabilized tools where flags/behavior can shift between patch releases
