# STATE Archive

Pruned entries from STATE.md. Recoverable but no longer loaded into agent context.

## Pruned 2026-08-09 (phases 1-1, kept recent 3)

### Performance Metrics

| 1 | 3 | - | - |

## Pruned 2026-08-09 (phases 1-2, kept recent 3)

### Performance Metrics

| 2 | 3 | - | - |

## Pruned 2026-08-09 (phases 1-3, kept recent 3)

### Performance Metrics

| 3 | 6 | - | - |

## Pruned 2026-08-09 (phases 1-5, kept recent 3)

### Performance Metrics

| 4 | 6 | - | - |
| 5 | 6 | - | - |

## Pruned 2026-08-09 (phases 1-6, kept recent 3)

### Performance Metrics

| 6 | 3 | - | - |

## Pruned 2026-08-09 (phases 1-7, kept recent 3)

### Decisions

- [Phase 7]: Phase 7: wired $lib alias before running shadcn-svelte init (CLI preflight validates alias resolution, stricter than research found)
- [Phase 7]: Phase 7: added DOM lib to tsconfig.e2e.json for Playwright page.evaluate() DOM assertions, fixed 3 pre-existing evaluateAll() casts it exposed
- [Phase 7]: Phase 7: replaced any with unknown in shadcn-svelte-generated utils.ts type helpers to keep Biome at zero suppressions

### Performance Metrics

| 7 | 1 | - | - |

## Pruned 2026-08-10 (phases 1-8, kept recent 3)

### Decisions

- [Phase 8]: Card wraps the whole two-step login form (not only the error branch), matching ROADMAP Phase 8 success criterion 1's literal Card-at-each-step requirement
- [Phase 8]: secondary/ghost Button variant pair chosen for nav active-state — gives a resting-state background-color difference assertable via getComputedStyle
- [Phase 8]: login-flow.spec.ts induces the live auth error via a deliberately-wrong-but-real-derived code instead of waiting for natural ~60-90s expiry

### Performance Metrics

| 8 | 1 | - | - |

## Pruned 2026-08-10 (phases 1-10, kept recent 3)

### Decisions

- [Phase 10]: Added `novalidate` to `EntityScreen.svelte`'s create/edit form — native HTML5 required-field constraint validation was silently blocking JS-level validation/Alert rendering.
- [Phase 10]: `svelte-sonner` hand-installed via `bun add` (no `shadcn-svelte add sonner`) to keep `mode-watcher` out of the tree.

## Pruned 2026-08-10 (phases 1-11, kept recent 3)

### Decisions

- [Phase 11]: Full-suite live re-run (39/39) + explicit screen x capability-class coverage audit found zero gaps at v1.1 close.

## Pruned 2026-08-10 (phases 1-12, kept recent 3)

### Decisions

- [Phase 12]: LoginScreen restyled inside Card/CardHeader/CardTitle/CardDescription, full-viewport centered, App.svelte's root <h1> left untouched (additive-only composition, per 12-PATTERNS.md Critical Constraint).
- [Phase 12]: Established the space-y-4/space-y-2 Tailwind spacing scale (first application in the codebase) identically on both auth steps — the baseline Phase 13-17 will reuse for POLISH-04.

### Performance Metrics

| 12 | 1 | - | - |

## Pruned 2026-08-10 (phases 1-13, kept recent 3)

### Decisions

- [Phase 13]: Shell.svelte restructured with shell-header toolbar + Separator + single shell-content-frame wrapper (mx-auto max-w-6xl + padding + space-y-6) inherited by all 9 entities; App.svelte's root <h1> relocated inside <SignedOut> to eliminate the duplicate app-identity text once signed in (SHELL-01/02/03).

### Performance Metrics

| 13 | 1 | - | - |

## Pruned 2026-08-10 (phases 1-14, kept recent 3)

### Decisions

- [Phase 14 P01]: EntityConfig.descricao made required (not optional) so bun run check enforces all 9 entity defs supply it — the ENTTBL-04 all-entities proof mechanism.
- [Phase 14 P01]: empty-state-create kept as a distinct testid from entity-create-start (both call startCreate()), preserving the load-bearing uniqueness constraint on entity-create-start.
- [Phase 14 P02]: Dedicated fresh-context-with-cleared-query-cache Playwright pattern established for reliably observing InstantDB's transient loading state under CDP network throttle, since the authed project's persisted storageState otherwise resolves query.isLoading instantly from a restored IndexedDB cache.
- [Phase 14 P02]: Fixed 2 pre-existing Biome violations (import-order, line-width) left by Plan 14-01's vendored Skeleton/Empty components, required for Task 2's bun run lint acceptance gate to exit 0.

### Performance Metrics

| 14 | 2 | - | - |

## Pruned 2026-08-11 (phases 1-16, kept recent 3)

### Decisions

- [Phase 15]: Fixed a busy-guard double-submit race in EntityScreen.svelte's handleSubmit (plan-checker-flagged deviation) — busy=true now set immediately after the re-entrancy guard, wrapping the entire validation+queryOnce+transact flow in try/finally, not just the transact try/catch.
- [Phase 16 P02]: Fixed bits-ui's AlertDialogCancelState never emitting a disabled HTML attribute (only gating its own onclick/onkeydown internally) via a child-snippet override in the vendored alert-dialog-cancel.svelte, discovered by the new busy-gating test.

## Pruned 2026-08-11 (phases 1-17, kept recent 3)

### Decisions

- [Phase 17]: Fixed EntityScreen.svelte's page-header sitting flush (0px gap) against table/loading/empty content via `space-y-6`, locked in with a permanent Playwright assertion — the closing v1.2 cross-phase audit's one genuine finding.

## Pruned 2026-08-11 (phases 1-18, kept recent 3)

### Decisions

- [Phase 18 P01]: gotoNested's interim (Phase 18) affordance groups the 4 nested entities by the first primary entity each links to (via links, never xorLink), falling back to 'Outros' -- data-driven, zero per-etype branching; only the helper body changes when Phase 19/20 ship real nested UI.

### Performance Metrics

| 18 | 3 | 210min | 70min |
