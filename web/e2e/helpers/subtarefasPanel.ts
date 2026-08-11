import type { Page } from "@playwright/test";

// Opens the shared, parent-scoped `SubtarefasPanel.svelte` for a concrete
// ticket or tarefa parent -- mirrors gotoNested.ts/form-controls.ts's plain
// exported-async-function style, no class. Retires every remaining call
// site that reached the `gotoNested` helper's "subtarefas" branch
// (20-RESEARCH.md Pitfall 3): `SubtarefasPanel` is, by design, always scoped
// to ONE concrete parent, so there is no unscoped "subtarefas" destination
// left to land on -- callers must supply the exact parent id they want the
// panel scoped to.
//
// Neither function asserts `subtarefas-panel` visibility itself, matching
// gotoNested.ts's own convention of not asserting inside the helper --
// callers assert that themselves.

/**
 * Opens `TicketsSection`'s `SubtarefasPanel`, scoped to `ticketId` --
 * navigates to the tickets list, then clicks the row whose `data-eid`
 * matches `ticketId` (TicketsSection.svelte's click-delegation wrapper,
 * Plan 20-01), which sets `selectedTicketId` and mounts the panel inline.
 */
export async function openSubtarefasPanelForTicket(page: Page, ticketId: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nav-tickets").click();
  await page.locator(`[data-testid="row"][data-eid="${ticketId}"]`).click();
}

/**
 * Opens `ProjetosSection`'s "Todas as tarefas" tab and clicks the row whose
 * `data-eid` matches `tarefaId` (ProjetosSection.svelte's click-delegation
 * wrapper, Plan 20-03), which mounts the same `SubtarefasPanel` scoped to
 * that tarefa. Works for any tarefa regardless of whether it has an etapa --
 * exactly why this helper does not need a projeto/etapa parameter.
 */
export async function openSubtarefasPanelForTarefa(page: Page, tarefaId: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nav-projetos").click();
  await page.getByTestId("projetos-tab-todas").click();
  await page.locator(`[data-testid="row"][data-eid="${tarefaId}"]`).click();
}
