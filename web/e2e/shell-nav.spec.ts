import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (picked up automatically by its
// existing testMatch: /.*\.spec\.ts/ — no playwright.config.ts edit needed),
// which auto-runs the `setup` project first (dependencies: ["setup"]),
// producing a fresh live authenticated session for every test in this file.
// playwright.config.ts's workers: 1 / fullyParallel: false makes tests in
// this file run sequentially in declaration order — the Logout test is
// declared last so ending the session cannot affect the earlier two.

const NAV_TESTID_SELECTOR = '[data-testid^="nav-"]';

test("each nav Button renders its corresponding EntityScreen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();
  expect(count).toBe(9);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    const label = (await button.innerText()).trim();
    await button.click();
    await expect(page.locator("h2")).toHaveText(label);
  }
});

test("exactly one nav Button shows the active-state indicator at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();

  // `ativo` defaults to entityConfigs[0].etype on mount, so the first entry
  // is already active before any click.
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    await button.click();

    const active = page.locator('[aria-current="true"]');
    await expect(active).toHaveCount(1);

    const activeTestId = await active.getAttribute("data-testid");
    const clickedTestId = await button.getAttribute("data-testid");
    expect(activeTestId).toBe(clickedTestId);

    // Covers the visual half of SHELLUI-02: the active Button's shadcn
    // `secondary` variant must have a different resting-state background
    // color than an inactive `ghost`-variant nav Button.
    const activeBg = await active.evaluate((el) => getComputedStyle(el).backgroundColor);
    const otherIndex = (i + 1) % count;
    const otherBg = await navButtons
      .nth(otherIndex)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(activeBg).not.toBe(otherBg);
  }
});

test("clicking Logout ends the session and returns to the restyled LoginScreen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await page.getByTestId("logout").click();

  await expect(page.getByTestId("app-shell")).not.toBeVisible();
  await expect(page.getByTestId("login-screen")).toBeVisible();
});
