import { expect, test } from "@playwright/test";

// This spec runs in the `anon` project, which uses an explicitly empty
// storageState (no cookies, no origins) — no dependency on the `setup`
// project, so it never triggers a magic-code send.
const ENTITY_NAMES = [
  "fundos",
  "projetos",
  "etapas",
  "tarefas",
  "templatesRotina",
  "instanciasRotina",
  "tickets",
  "subtarefas",
  "logInferenciaClaude",
];

test("unauthenticated load shows only the login screen with zero entity data", async ({ page }) => {
  const observedInstantdbResponses: { url: string; status: number; length: number }[] = [];

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("instantdb.com")) return;
    let length = 0;
    try {
      const body = await response.body();
      length = body.length;
    } catch {
      // Some responses (e.g. websocket upgrades) have no readable body.
      length = 0;
    }
    observedInstantdbResponses.push({ url, status: response.status(), length });
  });

  await page.goto("/");

  await expect(page.getByTestId("login-screen")).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveCount(0);
  await expect(page.locator("table")).toHaveCount(0);

  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  for (const entity of ENTITY_NAMES) {
    expect(bodyText).not.toContain(entity.toLowerCase());
  }

  console.log(
    `[no-leakage] observed instantdb.com responses: ${JSON.stringify(observedInstantdbResponses, null, 2)}`,
  );

  const queryOrTransactWithBody = observedInstantdbResponses.filter(
    (r) =>
      r.length > 0 &&
      (r.url.includes("/runtime/session") ||
        r.url.includes("/runtime/query") ||
        r.url.includes("/runtime/transact")),
  );
  expect(queryOrTransactWithBody).toHaveLength(0);
});
