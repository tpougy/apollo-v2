import { expect, test } from "@playwright/test";

// This spec runs in the `anon` project (see playwright.config.ts) — same
// empty-storageState setup as login-flow.spec.ts. Its assertions (Card
// composition slots, bounding-box centering, pixel-gap parity) are purely
// visual/structural and do not require a real network round trip to reach
// the code step — only that `step` becomes "code". The live
// `db.auth.sendMagicCode` endpoint (InstantDB's `/runtime/auth/send_magic_code`)
// is intercepted and fulfilled immediately here, so this spec never depends
// on the real inbox/backend. The full live sign-in round trip is already
// proven by login-flow.spec.ts and auth.setup.ts / bun run test:e2e:auth.

const EMAIL = "tp@rbrasset.com.br";
const CENTER_TOLERANCE_PX = 3; // subpixel layout rounding across engines
const GAP_PARITY_TOLERANCE_PX = 0.5; // subpixel rounding between measured boxes

test("LoginScreen composes a centered Card with a consistent spacing scale at both auth steps", async ({
  page,
}) => {
  // Fulfill the magic-code send instantly with a mocked success response —
  // no live network round trip, so this purely visual/layout spec cannot
  // flake on real backend/inbox latency.
  await page.route("**/runtime/auth/send_magic_code", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

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

  // 2. Full-viewport centering — asserts against the real viewport, not just
  // an in-flow box: `login-screen` must start at the document's top-left
  // (y === 0) and span exactly the viewport, so it can never be pushed down
  // by a sibling (e.g. App.svelte's root <h1>) or leave the Card off-center
  // relative to what the user actually sees.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewportSize() returned null");

  const screenBox = await loginScreen.boundingBox();
  if (!screenBox) throw new Error("login-screen bounding box unavailable");
  expect(Math.abs(screenBox.y)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(screenBox.height).toBeGreaterThanOrEqual(viewport.height);

  const cardBox = await loginScreen.locator('[data-slot="card"]').boundingBox();
  if (!cardBox) throw new Error("Card bounding box unavailable");
  const cardCenterX = cardBox.x + cardBox.width / 2;
  const cardCenterY = cardBox.y + cardBox.height / 2;
  expect(Math.abs(cardCenterX - viewport.width / 2)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(Math.abs(cardCenterY - viewport.height / 2)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

  // 3. Email-step gap measurements (space-y-4 form gap, space-y-2 field gap).
  const emailFieldBox = await page.getByTestId("login-email-field").boundingBox();
  const emailSubmitBox = await page.getByTestId("login-submit").boundingBox();
  if (!emailFieldBox || !emailSubmitBox) throw new Error("Email-step boxes unavailable");
  const emailFormGap = emailSubmitBox.y - (emailFieldBox.y + emailFieldBox.height);

  const emailLabelBox = await page.locator('label[for="login-email"]').boundingBox();
  const emailInputBox = await page.locator("#login-email").boundingBox();
  if (!emailLabelBox || !emailInputBox) throw new Error("Email label/input boxes unavailable");
  const emailFieldGap = emailInputBox.y - (emailLabelBox.y + emailLabelBox.height);

  // 4. Advance to the code step via the mocked send — no real email sent.
  await page.getByTestId("login-email").fill(EMAIL);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-code")).toBeVisible();

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

  expect(Math.abs(codeFormGap - emailFormGap)).toBeLessThanOrEqual(GAP_PARITY_TOLERANCE_PX);
  expect(Math.abs(codeFieldGap - emailFieldGap)).toBeLessThanOrEqual(GAP_PARITY_TOLERANCE_PX);
});
