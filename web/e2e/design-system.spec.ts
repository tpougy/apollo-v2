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

const TOKENS = ["--background", "--foreground", "--primary"] as const;

async function readTokens(page: import("@playwright/test").Page) {
  return page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]));
  }, TOKENS);
}

test("shadcn-svelte design tokens are present and swap under prefers-color-scheme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const light = await readTokens(page);
  for (const t of TOKENS) expect(light[t]).not.toBe("");

  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await readTokens(page);
  for (const t of TOKENS) expect(dark[t]).not.toBe(light[t]);
});

test("dark mode never applies a .dark class under either color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false,
  );

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false,
  );
});
