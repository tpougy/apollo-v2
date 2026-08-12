import { db } from "../db";

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
export const DASHBOARD_QUERY = {
  projetos: { fundo: {}, etapas: { tarefas: {} } },
  tarefas: { etapa: { projeto: {} }, subtarefas: {} },
  instanciasRotina: { template: { fundo: {} } },
  tickets: { fundo: {}, subtarefas: {} },
  fundos: {},
};

// Cast-at-the-InstaQL-boundary idiom already used by `EntityScreen.svelte`
// (`db.useQuery(() => buildQuery(config) as never)`) and
// `ProjetosSection.svelte` (`db.useQuery(() => ({...}) as never)`) for a
// bespoke multi-entity query shape the generated schema union cannot express
// literally.
export function useDashboardQuery() {
  return db.useQuery(() => DASHBOARD_QUERY as never);
}
