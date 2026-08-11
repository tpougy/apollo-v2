import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (picked up automatically by its
// existing testMatch: /.*\.spec\.ts/ — no playwright.config.ts edit needed),
// which auto-runs the `setup` project first (dependencies: ["setup"]),
// producing a fresh live authenticated session for every test in this file.
// playwright.config.ts's workers: 1 / fullyParallel: false makes tests in
// this file run sequentially in declaration order — the Logout test is
// declared last so ending the session cannot affect the earlier two.

const NAV_TESTID_SELECTOR = '[data-testid^="nav-"]';

// Some nav buttons show a short `navTitulo` (e.g. "Rotinas", "Log") that
// differs from the resulting EntityScreen's own `<h2>{config.titulo}</h2>` —
// so the per-button loop below asserts against this table (keyed by
// data-testid) instead of the clicked button's own visible label.
const EXPECTED_H2_BY_TESTID: Record<string, string> = {
  "nav-dashboard": "Dashboard",
  "nav-instanciasRotina": "Instâncias de rotina",
  "nav-tickets": "Tickets",
  "nav-projetos": "Projetos",
  "nav-fundos": "Fundos",
  "nav-logInferenciaClaude": "Log de inferências",
};

test("each nav Button renders its corresponding EntityScreen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();
  expect(count).toBe(6);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    const testid = await button.getAttribute("data-testid");
    await button.click();
    await expect(page.locator("h2")).toHaveText(EXPECTED_H2_BY_TESTID[testid ?? ""]);
  }
});

test("NAV-01/NAV-03: fresh load shows exactly the 6-item topbar in order, defaulting to the Dashboard route", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const testids = await page
    .locator('[data-testid^="nav-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(testids).toEqual([
    "nav-dashboard",
    "nav-instanciasRotina",
    "nav-tickets",
    "nav-projetos",
    "nav-fundos",
    "nav-logInferenciaClaude",
  ]);

  await expect(page.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator("h2")).toHaveText("Dashboard");
  await expect(page.getByTestId("entity-table-frame")).toHaveCount(0);
  await expect(page.getByTestId("entity-header")).toHaveCount(0);
});

test("exactly one nav Button shows the active-state indicator at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();

  // `rota` defaults to { section: "dashboard" } on mount, so nav-dashboard
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

  // FDBK-01: logging out produces a visible success toast — asserted before
  // the navigation-away assertion below, since the toast and the auth-state
  // flip can race.
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();

  await expect(page.getByTestId("app-shell")).not.toBeVisible();
  await expect(page.getByTestId("login-screen")).toBeVisible();
});
