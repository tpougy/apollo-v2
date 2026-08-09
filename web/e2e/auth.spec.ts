import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project, which restores the storageState
// persisted by auth.setup.ts (including IndexedDB — @instantdb/core's session
// store). It proves the persisted session survives a brand-new browser
// context, not merely a same-context reload (that reload is asserted inside
// auth.setup.ts itself).
test("a fresh context restored from storageState is already authenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("login-screen")).not.toBeVisible();
});
