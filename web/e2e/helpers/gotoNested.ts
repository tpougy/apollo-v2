import type { Page } from "@playwright/test";

// Navigates to a standalone full-screen EntityScreen for a `nav: "nested"`
// entity (etapas, tarefas, templatesRotina, subtarefas) — mirrors
// form-controls.ts/magic-code.ts's plain exported-async-function style, no
// class.
//
// PUBLIC SIGNATURE IS STABLE ACROSS PHASES: only this function's body
// changes when Phase 19/20 ship the real parent-hosted nested UI (replacing
// today's interim `nested-goto` Select in Shell.svelte with a real
// master-detail drill-down) — none of the call sites using
// `gotoNested(page, etype)` will need to change again.
export async function gotoNested(page: Page, etype: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nested-goto").click();
  await page.getByTestId(`nested-goto-${etype}`).click();
}
