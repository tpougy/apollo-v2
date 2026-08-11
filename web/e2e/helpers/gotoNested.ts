import type { Page } from "@playwright/test";

// Navigates to a standalone full-screen EntityScreen for a `nav: "nested"`
// entity (etapas, tarefas, templatesRotina, subtarefas) — mirrors
// form-controls.ts/magic-code.ts's plain exported-async-function style, no
// class.
//
// PUBLIC SIGNATURE IS STABLE ACROSS PHASES: only this function's body
// changes when Phase 19/20 ship the real parent-hosted nested UI. As of
// Phase 19, "etapas"/"tarefas" no longer resolve through the interim
// `nested-goto` Select in Shell.svelte — both now have a real, parent-hosted
// home inside ProjetosSection.svelte, so this function drives real UI to
// land on equivalent markup instead. As of Plan 20-02, "templatesRotina" no
// longer resolves through the interim `nested-goto` Select either — it now
// has a real home as RotinasSection.svelte's second tab. As of Plan 20-05,
// the interim `nested-goto` dropdown itself no longer exists in Shell.svelte
// at all (Plan 20-04 already migrated every remaining "subtarefas" call site
// off this helper onto the parent-scoped `SubtarefasPanel` helpers in
// subtarefasPanel.ts, so no "subtarefas" branch is ever added here). Every
// one of the 4 `nav: "nested"` entities now has an explicit branch below;
// there is no remaining etype this function can legitimately be called with
// that isn't already handled, so the fallback below throws instead of
// silently trying to click a testid that no longer renders.
export async function gotoNested(page: Page, etype: string): Promise<void> {
  await page.goto("/");

  if (etype === "etapas") {
    // Etapas no longer has an unscoped table destination of its own since
    // Phase 19 moved it inside a selected projeto's own detail column
    // (ProjetosSection.svelte's etapas accordion/kanban) — the closest
    // equivalent "go look at etapas" destination is: open Projetos, select
    // the first project in the master list, which reveals that projeto's
    // own etapas list. Callers relying on this case must guarantee at least
    // one projeto exists in the live app at call time.
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").first().click();
    return;
  }

  if (etype === "tarefas") {
    // "Todas as tarefas" is the Projetos detail column's second tab, per
    // spec-ui.md §2.2 — it reproduces the exact unscoped
    // EntityScreen(tarefasConfig) markup every other gotoNested("tarefas")
    // call site already depends on (entity-table-frame etc.), with zero
    // call-site changes required.
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("projetos-tab-todas").click();
    return;
  }

  if (etype === "templatesRotina") {
    // Templates is RotinasSection's second tab (Phase 20), per spec-ui.md
    // §2.3 — it reproduces the exact unscoped EntityScreen(templatesRotinaConfig)
    // markup every other gotoNested("templatesRotina") call site already
    // depends on, with zero call-site changes required
    // (entities-rotina-log.spec.ts's WEB-06 test).
    await page.getByTestId("nav-instanciasRotina").click();
    await page.getByTestId("rotinas-tab-templates").click();
    return;
  }

  throw new Error(
    `gotoNested: unhandled etype '${etype}' — the interim nested-goto dropdown this ` +
      "fallback used to drive was deleted from Shell.svelte in Plan 20-05 (per 20-RESEARCH.md's " +
      "Code Example: delete the whole block rather than leaving a permanently-empty dropdown " +
      "mounted). Every nav:'nested' entity (etapas, tarefas, templatesRotina) now has its own " +
      "explicit branch above; 'subtarefas' was migrated off this helper entirely in Plan 20-04 " +
      "onto openSubtarefasPanelForTicket/openSubtarefasPanelForTarefa (./subtarefasPanel.ts). " +
      "Add a real branch here (or use the correct helper) instead of relying on this fallback.",
  );
}
