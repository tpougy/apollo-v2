import { expect, test } from "@playwright/test";

// This spec runs in the `anon` project (see playwright.config.ts) — same
// empty-storageState setup as login-flow.spec.ts — and performs one real
// live magic-code send (no code read/submit) to prove LOGIN-01/LOGIN-02's
// Card composition, full-viewport centering, and spacing-scale parity
// against the real InstantDB backend, not a mock. The full sign-in round
// trip is already proven by auth.setup.ts / bun run test:e2e:auth.

const EMAIL = "tp@rbrasset.com.br";

test("LoginScreen composes a centered Card with a consistent spacing scale at both auth steps", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.goto("/");
  const loginScreen = page.getByTestId("login-screen");
  await expect(loginScreen).toBeVisible();

  // 1. Card composition on the email step.
  await expect(loginScreen.locator('[data-slot="card-header"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-title"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-description"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-header"]')).toBeVisible();
  await expect(loginScreen.locator('[data-slot="card-title"]')).toBeVisible();
  await expect(loginScreen.locator('[data-slot="card-description"]')).toBeVisible();

  // 2. Full-viewport centering.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewportSize() returned null");

  const cardBox = await loginScreen.locator('[data-slot="card"]').boundingBox();
  if (!cardBox) throw new Error("Card bounding box unavailable");
  const cardCenterX = cardBox.x + cardBox.width / 2;
  expect(Math.abs(cardCenterX - viewport.width / 2)).toBeLessThanOrEqual(3);

  const screenBox = await loginScreen.boundingBox();
  if (!screenBox) throw new Error("login-screen bounding box unavailable");
  expect(screenBox.height).toBeGreaterThanOrEqual(viewport.height);

  // 3. Email-step gap measurements (space-y-4 form gap, space-y-2 field gap).
  const emailFieldBox = await page.getByTestId("login-email-field").boundingBox();
  const emailSubmitBox = await page.getByTestId("login-submit").boundingBox();
  if (!emailFieldBox || !emailSubmitBox) throw new Error("Email-step boxes unavailable");
  const emailFormGap = emailSubmitBox.y - (emailFieldBox.y + emailFieldBox.height);

  const emailLabelBox = await page.locator('label[for="login-email"]').boundingBox();
  const emailInputBox = await page.locator("#login-email").boundingBox();
  if (!emailLabelBox || !emailInputBox) throw new Error("Email label/input boxes unavailable");
  const emailFieldGap = emailInputBox.y - (emailLabelBox.y + emailLabelBox.height);

  // 4. Real live send — advance to the code step.
  await page.getByTestId("login-email").fill(EMAIL);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-code")).toBeVisible({ timeout: 30_000 });

  // 5. Card composition on the code step, with the step-aware description.
  await expect(loginScreen.locator('[data-slot="card-header"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-title"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-description"]')).toHaveCount(1);
  await expect(loginScreen.locator('[data-slot="card-header"]')).toBeVisible();
  await expect(loginScreen.locator('[data-slot="card-title"]')).toBeVisible();
  const codeDescription = loginScreen.locator('[data-slot="card-description"]');
  await expect(codeDescription).toBeVisible();
  await expect(codeDescription).toContainText(EMAIL);

  // 6. Code-step gap measurements, asserted equal to the email step's.
  const codeFieldBox = await page.getByTestId("login-code-field").boundingBox();
  const codeSubmitBox = await page.getByTestId("login-submit").boundingBox();
  if (!codeFieldBox || !codeSubmitBox) throw new Error("Code-step boxes unavailable");
  const codeFormGap = codeSubmitBox.y - (codeFieldBox.y + codeFieldBox.height);

  const codeLabelBox = await page.locator('label[for="login-code"]').boundingBox();
  const codeInputBox = await page.locator("#login-code").boundingBox();
  if (!codeLabelBox || !codeInputBox) throw new Error("Code label/input boxes unavailable");
  const codeFieldGap = codeInputBox.y - (codeLabelBox.y + codeLabelBox.height);

  expect(Math.abs(codeFormGap - emailFormGap)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(codeFieldGap - emailFieldGap)).toBeLessThanOrEqual(0.5);
});
