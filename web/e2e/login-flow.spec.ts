import { expect, test } from "@playwright/test";
import { readLatestMagicCode, readMagicCodeAfter } from "./helpers/magic-code.ts";

// This spec runs in the `anon` project (see playwright.config.ts) — same
// storageState-free setup as no-leakage.spec.ts/design-system.spec.ts — but,
// unlike those two, each test here performs its own real live magic-code
// round trip (send + Outlook Classic COM peek, per PROJECT.md C-10) to prove
// AUTHUI-02's loading/error states against the real InstantDB backend, not a
// mock. Success state needs no test here — already covered by auth.setup.ts.

const EMAIL = "tp@rbrasset.com.br";

test("submit Button shows disabled + spinner while the send request is in flight", async ({
  page,
}) => {
  // Real network round trip to InstantDB's live sendMagicCode endpoint —
  // generous timeout mirroring auth.setup.ts's precedent for real-world
  // round trips, not a sign this test itself is slow to assert.
  test.setTimeout(90_000);

  await page.goto("/");
  await expect(page.getByTestId("login-screen")).toBeVisible();

  await page.getByTestId("login-email").fill(EMAIL);
  const submit = page.getByTestId("login-submit");

  await submit.click();

  // Immediately after the click — no artificial delay — the live
  // db.auth.sendMagicCode call is in flight and `ocupado` is already true
  // (set synchronously before the awaited call), so the disabled+spinner
  // state must already be observable.
  await expect(submit).toBeDisabled();
  await expect(submit.locator(".animate-spin")).toBeVisible();

  // Let the real send complete (step flips to "code") before this test ends,
  // so it doesn't leave a dangling live request racing into the next test's
  // own send against the same real inbox.
  await expect(page.getByTestId("login-code")).toBeVisible({ timeout: 30_000 });
});

test("submitting a deliberately wrong code renders the destructive Alert", async ({ page }) => {
  // Real send + real inbox read + real signInWithMagicCode rejection —
  // generous timeout for the full live round trip.
  test.setTimeout(90_000);

  await page.goto("/");
  await expect(page.getByTestId("login-screen")).toBeVisible();

  // May be absent or stale from a previous run (or this file's own prior
  // test) — tolerated, exactly like auth.setup.ts's own priorCode handling.
  let priorCode: string | null = null;
  try {
    priorCode = await readLatestMagicCode();
  } catch {
    priorCode = null;
  }

  await page.getByTestId("login-email").fill(EMAIL);
  const sentAt = Date.now();
  await page.getByTestId("login-submit").click();
  const realCode = await readMagicCodeAfter(sentAt, priorCode);

  // Deliberately wrong code: increment the real code's last digit (wrapping
  // 9 -> 0) so this never coincidentally submits the real value, while
  // staying a genuine live-backend rejection — avoiding the ~60-90s natural
  // expiry wait (08-RESEARCH.md Pitfall 3).
  const lastDigit = Number(realCode[realCode.length - 1]);
  const wrongLastDigit = (lastDigit + 1) % 10;
  const wrongCode = `${realCode.slice(0, -1)}${wrongLastDigit}`;

  await page.getByTestId("login-code").fill(wrongCode);
  await page.getByTestId("login-submit").click();

  const errorText = page.getByTestId("login-error");
  await expect(errorText).toBeVisible({ timeout: 15_000 });
  await expect(errorText).not.toBeEmpty();

  const alertRoot = page.locator('[data-slot="alert"]').filter({ has: errorText });
  await expect(alertRoot).toHaveCount(1);
  await expect(alertRoot).toHaveClass(/destructive/);
});
