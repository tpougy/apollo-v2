# Synthesis Summary

## Docs synthesized

- Total: 1
- By type: SPEC: 1 (ADR: 0, PRD: 0, DOC: 0)
- Source: `docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md` (confidence: high, precedence: default)

## Decisions locked

- 0 (no ADR-classified documents in this batch — see `decisions.md`)

## Requirements extracted

- 0 discrete requirements with acceptance criteria (no PRD-classified documents — see `requirements.md`)
- Scope statements captured as constraints C-02 (v1 full schema + CRUD) and C-09 (out of scope) in `constraints.md`

## Constraints

- 9 constraints extracted from the single SPEC, in `constraints.md`:
  - schema: 1 (C-04 — InstantDB 8-entity domain schema)
  - protocol: 2 (C-05 — auth/permissions, C-06 — idempotent instance-generation job)
  - api-contract: 1 (C-07 — CLI command surface)
  - nfr: 5 (C-01 monorepo structure, C-02 v1 scope, C-03 ANBIMA calendar single source of truth, C-08 quality tooling gates, C-09 out of scope)

## Context topics

- 1 topic captured in `context.md`: migration motivation / rationale (Apollo → apollo-v2 rewrite rationale, reference implementation, cross-refs to non-classified sources)

## Conflicts

- 0 blockers, 0 competing-variants, 0 auto-resolved
- Full report: `/home/thomaz/pessoal/apollo-v2/.planning/INGEST-CONFLICTS.md`

## Per-type intel files

- `/home/thomaz/pessoal/apollo-v2/.planning/intel/decisions.md`
- `/home/thomaz/pessoal/apollo-v2/.planning/intel/requirements.md`
- `/home/thomaz/pessoal/apollo-v2/.planning/intel/constraints.md`
- `/home/thomaz/pessoal/apollo-v2/.planning/intel/context.md`
