import { expect, test } from "@playwright/test";

// This spec runs in the `anon` project (see playwright.config.ts), which uses
// an explicitly empty storageState (no cookies, no origins) — no dependency
// on the `setup` project's live magic-code round trip. None of the four
// ROADMAP Phase 7 success criteria proven here need an authenticated session:
// the Preflight/tokens/dark-mode assertions run against pre-login DOM/CSS
// state, and the "boots clean" assertion only needs the login screen itself.

test("Tailwind preflight resets heading and body styles", async ({ page }) => {
  await page.goto("/");

  const h1 = page.locator("h1", { hasText: "Apollo v2" });
  const [h1Font, bodyFont] = await Promise.all([
    h1.evaluate((el) => getComputedStyle(el).fontSize),
    page.evaluate(() => getComputedStyle(document.body).fontSize),
  ]);
  expect(h1Font).toBe(bodyFont);

  const h1Weight = await h1.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(h1Weight).toBe("400");

  const bodyMargin = await page.evaluate(() => getComputedStyle(document.body).marginTop);
  expect(bodyMargin).toBe("0px");
});

test("app boots to the login screen with zero console or page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByTestId("login-screen")).toBeVisible();
  expect(errors).toEqual([]);
});
