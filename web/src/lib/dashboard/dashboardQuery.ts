// The Dashboard feature's ONE `db.useQuery` call site (DASH-07: "uma query,
// não sete", spec-ui.md §5.1). Every other Dashboard component (TicketQueue
// this plan, WeekCalendar in Plan 21-03) must receive its rows as props from
// Dashboard.svelte — never call `db.useQuery`/`useDashboardQuery` itself.
//
// The `instanciasRotina.template.fundo` two-hop path exists at the schema
// level (`instanciasRotina --template--> templatesRotina --fundo--> fundos`,
// shared/instant.schema.ts) but is deliberately absent from
// `defs/instanciasRotina.ts`'s presentation-layer `EntityConfig` — declaring
// it there would make `EntityScreen` render an always-editable `<select>`
// that could re-parent an instance and desync its `dedupeKey`. This query
// bypasses `EntityConfig`/`buildQuery` entirely, reading straight from `db`.
//
// No `donoId` where-clause is added: `instant.perms.ts`'s `view` rule already
// scopes every row server-side, and every existing bespoke query in this
// codebase (`EntityScreen.svelte`, `ProjetosSection.svelte`) omits one too.
// Plan 23-06 (Task 1): widened `projetos.etapas.tarefas` by one nesting
// level to also fetch `subtarefas` -- closes a pre-existing, Phase-22-
// documented query-completeness gap (STATE.md: "DASHBOARD_QUERY's
// projetos.etapas.tarefas branch omits subtarefas... so tarefaConcluida() on
// a nested strip card always evaluates false"). This deepens the SAME query
// object by one nesting level -- it does NOT add a new `db.useQuery` call
// site anywhere, so DASH-07's "uma query, não sete" is unaffected. Every
// reader of this nested path (ProjectStrips.svelte's own
// project-strip-column-header `{feitas}/{total}`, and this plan's own new
// ProjectDialog.svelte column headers) reads through `progressoEtapa`/
// `tarefaConcluida` (derive.ts), both of which require `subtarefas` to be
// present to compute a non-zero `feitas` count -- without this fix, both
// surfaces would silently show 0/N regardless of reality.
export const DASHBOARD_QUERY = {
  projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } },
  tarefas: { etapa: { projeto: {} }, subtarefas: {} },
  instanciasRotina: { template: { fundo: {} } },
  tickets: { fundo: {}, subtarefas: {} },
  fundos: {},
};

// This module deliberately has ZERO runtime imports (in particular, no
// import of "../db"). `web/e2e/dashboard.spec.ts` imports `DASHBOARD_QUERY`
// directly (Task 2's live DASH-07 proof, running the exact same query object
// through the admin API) from its plain Node/Playwright test process, which
// cannot load `db.ts` → `@instantdb/svelte`'s module graph: that package's
// dist includes `.svelte` component files (e.g. `SignedIn.svelte`) that only
// Vite's svelte plugin knows how to parse — verified live this session,
// Playwright's Node-based TS transform throws `Unknown file extension
// ".svelte"` the instant anything imports "../db" transitively. Taking `db`
// as a parameter instead of importing it keeps this file's only dependency
// on InstantDB confined to a minimal structural type, so the e2e process
// only ever evaluates a plain object literal.
//
// Cast-at-the-InstaQL-boundary idiom already used by `EntityScreen.svelte`
// (`db.useQuery(() => buildQuery(config) as never)`) and
// `ProjetosSection.svelte` (`db.useQuery(() => ({...}) as never)`) for a
// bespoke multi-entity query shape the generated schema union cannot express
// literally.
type DashboardQueryResult = {
  isLoading: boolean;
  error?: { message: string } | null;
  data?: unknown;
};

// `db` is typed `unknown` at this boundary (rather than InstantDB's own
// generated, heavily-overloaded `useQuery<Q extends ...>` signature) because
// this module cannot import that type without importing `db.ts` itself
// (defeating the whole point of this file having zero runtime imports — see
// the comment above). The cast below is the same "cast at the InstaQL
// boundary" idiom `EntityScreen.svelte:82`/`ProjetosSection.svelte:68-73`
// already use for a bespoke query shape the generic engine can't express
// literally; here it is applied to `db` itself instead of only the query
// object, for the same underlying reason (a runtime value whose full generic
// type this file must not statically reference).
export function useDashboardQuery(db: unknown): DashboardQueryResult {
  return (db as { useQuery: (queryFn: () => unknown) => DashboardQueryResult }).useQuery(
    () => DASHBOARD_QUERY as never,
  );
}
