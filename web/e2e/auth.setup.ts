import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config.ts";
import { readLatestMagicCode, readMagicCodeAfter } from "./helpers/magic-code.ts";

const EMAIL = "tp@rbrasset.com.br";

test("real magic-code round trip authenticates the SPA", async ({ page }) => {
  // Real email delivery + the C-10 Outlook Classic COM peek roundtrip can
  // take well over the default 30s test timeout, especially across a resend
  // retry. This does not slacken the poll loop itself (still 2s intervals,
  // no artificial pauses) — it only gives the real-world round trip room to
  // complete.
  test.setTimeout(150_000);

  await page.goto("/");
  await expect(page.getByTestId("login-screen")).toBeVisible();

  // May be absent or stale from a previous run — tolerated.
  let priorCode: string | null = null;
  try {
    priorCode = await readLatestMagicCode();
  } catch {
    priorCode = null;
  }

  async function attempt(): Promise<string> {
    await page.getByTestId("login-email").fill(EMAIL);
    const sentAt = Date.now();
    await page.getByTestId("login-submit").click();
    const code = await readMagicCodeAfter(sentAt, priorCode);
    priorCode = code;
    await page.getByTestId("login-code").fill(code);
    await page.getByTestId("login-submit").click();
    return code;
  }

  let usedCode = await attempt();
  let attempts = 1;

  const errorLocator = page.getByTestId("login-error");
  const becameError = await errorLocator
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (becameError) {
    const message = await errorLocator.innerText();
    if (/expired|record-expired|inválido/i.test(message)) {
      await page.getByTestId("login-resend").click();
      usedCode = await attempt();
      attempts = 2;
    } else {
      throw new Error(`Unexpected login error: ${message}`);
    }
  }

  const appShell = page.getByTestId("app-shell");
  await expect(appShell).toBeVisible({ timeout: 15_000 });
  await expect(appShell).toContainText(EMAIL);

  await page.reload();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("login-screen")).not.toBeVisible();

  const userText = await appShell.innerText();
  const timestamp = new Date().toISOString();

  console.log(
    `[auth.setup] Authenticated ${EMAIL} at ${timestamp} using magic code (attempts: ${attempts}, code: ${usedCode})`,
  );
  console.log(`[auth.setup] app-shell content: ${userText}`);

  await page.context().storageState({ path: STORAGE_STATE, indexedDB: true });

  const evidence = [
    `timestamp: ${timestamp}`,
    `email: ${EMAIL}`,
    `attempts: ${attempts}`,
    `app-shell content: ${userText}`,
  ].join("\n");
  await import("node:fs/promises").then((fs) =>
    fs
      .mkdir("e2e/.auth", { recursive: true })
      .then(() => fs.writeFile("e2e/.auth/LOGIN-EVIDENCE.txt", `${evidence}\n`)),
  );
});
