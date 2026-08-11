import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). RotinasSection mounts EntityScreen(instanciasRotinaConfig)/
// EntityScreen(templatesRotinaConfig) verbatim (zero new props, zero new
// capability), so this file needs no CLI fixture creation, no sweepLeftovers,
// and no cleanup -- it only asserts on the tabbed wrapper's own structure and
// on the two unchanged, already-tested EntityScreen mounts' presence.
//
// NEST-04 coverage: default tab, no create/delete affordance on Instâncias,
// switching to Templates shows the static context paragraph.

const RESYNC_TIMEOUT = 15_000;

test("NEST-04: Rotinas shows Instâncias by default (no create/delete affordance) and Templates (with context paragraph) as two tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-instanciasRotina").click();

  // (a) Lands on the Instâncias tab by default.
  await expect(page.locator("h2")).toHaveText("Instâncias de rotina");
  await expect(page.locator("h2")).toHaveCount(1);

  // (b) No create/delete affordance anywhere on the Instâncias tab.
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
  await expect(page.getByTestId("row-delete")).toHaveCount(0);

  // (c) Clicking the Templates tab switches the sole <h2> and shows the
  // static context paragraph.
  await page.getByTestId("rotinas-tab-templates").click();
  await expect(page.locator("h2")).toHaveText("Templates de rotina", { timeout: RESYNC_TIMEOUT });
  await expect(page.locator("h2")).toHaveCount(1);
  await expect(page.getByText(/configuração que gera as instâncias/i)).toBeVisible();
});
