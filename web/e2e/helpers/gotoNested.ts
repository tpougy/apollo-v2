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
// land on equivalent markup instead. As of Phase 20, "templatesRotina" no
// longer resolves through the interim `nested-goto` Select either — it now
// has a real home as RotinasSection.svelte's second tab (20-02-PLAN.md). Only
// "subtarefas" still falls through to the original `nested-goto` dropdown,
// unchanged (20-RESEARCH.md Pitfall 3 — its 6+ call sites need individual,
// parent-id-aware rewrites in a later plan of this phase, not a body
// extension here). None of the call sites using `gotoNested(page, etype)`
// need to change again for the etypes already migrated above.
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

  await page.getByTestId("nested-goto").click();
  await page.getByTestId(`nested-goto-${etype}`).click();
}
