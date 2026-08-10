import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Shared AlertDialog delete-confirmation interaction for e2e specs, replacing
// the pre-existing window.confirm()-era page.on("dialog", ...)/dialog.accept()
// pattern (DELCONF-01). Mirrors form-controls.ts's style — plain exported
// async functions, no class.

/**
 * Clicks `row`'s `row-delete` Button, waits for the AlertDialog to open,
 * clicks the destructive `delete-confirm` action, then waits for the
 * AlertDialog to close — the confirm path (record deleted).
 */
export async function confirmRowDelete(page: Page, row: Locator): Promise<void> {
  await row.getByTestId("row-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByTestId("delete-confirm").click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

/**
 * Clicks `row`'s `row-delete` Button, waits for the AlertDialog to open,
 * clicks `delete-cancel`, then waits for the AlertDialog to close — the
 * cancel path (record retained).
 */
export async function cancelRowDelete(page: Page, row: Locator): Promise<void> {
  await row.getByTestId("row-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByTestId("delete-cancel").click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}
