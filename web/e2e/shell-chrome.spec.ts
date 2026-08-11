import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (picked up automatically by its
// existing testMatch: /.*\.spec\.ts/ — no playwright.config.ts edit needed),
// which auto-runs the `setup` project first (dependencies: ["setup"]),
// producing a fresh live authenticated session for every test in this file.
// playwright.config.ts's workers: 1 / fullyParallel: false makes tests in
// this file run sequentially, matching shell-nav.spec.ts's own convention.
// No InstantDB write is triggered anywhere in this file — every assertion
// reads already-rendered chrome/nav state.

test("header/toolbar composition", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const header = page.getByTestId("shell-header");
  await expect(header).toBeVisible();

  const appName = header.getByTestId("shell-app-name");
  await expect(appName).toHaveCount(1);
  await expect(appName).toBeVisible();

  const logout = header.getByTestId("logout");
  await expect(logout).toHaveCount(1);
  const tagName = await logout.evaluate((el) => el.tagName);
  expect(tagName).toBe("BUTTON");

  const separator = page.locator('[data-slot="separator"]');
  await expect(separator).toHaveCount(1);

  const headerBox = await header.boundingBox();
  const separatorBox = await separator.boundingBox();
  const contentFrameBox = await page.getByTestId("shell-content-frame").boundingBox();

  if (!headerBox || !separatorBox || !contentFrameBox) {
    throw new Error("header/separator/content-frame bounding box unavailable");
  }

  // header → separator → content-frame visual order.
  expect(separatorBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
  expect(contentFrameBox.y).toBeGreaterThanOrEqual(separatorBox.y);
});

test("single content-frame consistency across entities", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const contentFrame = page.getByTestId("shell-content-frame");
  await expect(contentFrame).toHaveCount(1);

  async function readFrame() {
    const box = await contentFrame.boundingBox();
    const maxWidth = await contentFrame.evaluate((el) => getComputedStyle(el).maxWidth);
    return { box, maxWidth };
  }

  const initial = await readFrame();
  if (!initial.box) throw new Error("shell-content-frame bounding box unavailable");
  expect(initial.maxWidth).not.toBe("none");

  const navButtons = page.locator('[data-testid^="nav-"]');
  const count = await navButtons.count();
  expect(count).toBe(6);

  const indexesToCheck = [0, Math.floor(count / 2), count - 1];

  for (const index of indexesToCheck) {
    await navButtons.nth(index).click();
    const reading = await readFrame();
    if (!reading.box) throw new Error("shell-content-frame bounding box unavailable");
    expect(reading.maxWidth).toBe(initial.maxWidth);
    // Position and width must be byte-identical across entities — height
    // legitimately varies with each entity's own row/empty-state content,
    // so only x/y/width are compared here, per this task's <behavior> spec.
    expect(reading.box.x).toBe(initial.box.x);
    expect(reading.box.y).toBe(initial.box.y);
    expect(reading.box.width).toBe(initial.box.width);
  }
});

test("nav overflow strategy — single flat wrapping row, no Tabs, no scroll container", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const nav = page.locator("nav");
  await expect(nav).toHaveCount(1);

  const flexWrap = await nav.evaluate((el) => getComputedStyle(el).flexWrap);
  const overflowX = await nav.evaluate((el) => getComputedStyle(el).overflowX);

  expect(flexWrap).toBe("wrap");
  expect(overflowX).not.toBe("scroll");
  expect(overflowX).not.toBe("auto");

  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
});

test("single app-identity element when authenticated — exactly one root h1, not duplicated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await expect(page.getByText("Apollo v2", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Apollo v2", { exact: true })).toBeVisible();

  // The authenticated shell now owns a single top-level heading
  // (`shell-app-name`, promoted to `<h1>` to fix the skipped-heading-level
  // regression from WR-01) — this must never duplicate to 2+ instances,
  // and it is a structurally different element from `App.svelte`'s
  // signed-out `<h1>` (asserted separately in design-system.spec.ts).
  await expect(page.locator("h1", { hasText: "Apollo v2" })).toHaveCount(1);
});
