# Context (from DOCs)

No DOC-classified documents were present in this ingest batch.

Background/motivation prose from the single ingested SPEC (`docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md`) is summarized here for orientation only — normative content lives in `constraints.md`.

## Migration motivation

- source: docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md (§ "Contexto e motivação")

Original Apollo (repo `apollo`, `~/pessoal/apollo`) was planned and partially implemented on Python 3.12 + Litestar + litestar-vite + SvelteKit + AdvancedAlchemy + SQLite + `cofin/litestar-mcp`. Functional but complex enough to slow iteration for the sole user (a fund-controllership professional). This SPEC defines a rewrite in a new repo (`apollo-v2`) replacing:
- Backend Python/Litestar/SQLite → InstantDB as the sole data backend (native realtime sync).
- SvelteKit → pure Svelte 5 SPA (Vite, no SvelteKit), deployable as a static site on Cloudflare Pages.
- MCP server (`litestar-mcp`) → documented Python CLI using the InstantDB SDK, for local Claude Code usage with full UI parity.
- Business-day calculation via `bizdays`/ANBIMA (Python) → kept in the CLI, replicated via a thin TypeScript layer on the client, both reading the same vendored holiday table.

Core value unchanged: **full parity between UI and the AI-operated channel** — nothing in one is out of reach of the other. The migration changes *how* that parity is guaranteed (before: same Application Service layer behind HTTP controllers and MCP tools; now: same InstantDB backend and same permission rules consumed by two distinct clients).

Reference implementation used as a best-practices base: `~/pessoal/ultima-missao` (Svelte 5 + Vite + `@instantdb/svelte`, no SvelteKit, Cloudflare Pages deploy).

## Cross-references noted in source doc (not independently classified)

- `~/pessoal/apollo` — prior repo, kept intact as reference/archive
- `~/pessoal/ultima-missao` — reference implementation for Svelte+InstantDB patterns
- `github.com/ianliu/feriados-anbima` — source of the vendored ANBIMA holiday table
- `PROJECT.md` — referenced but does not yet exist in this new project (MODE=new, no existing `.planning/`)
