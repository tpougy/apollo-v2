import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { adminQuery, sweepInstancesByDedupeKeyPrefix } from "./fixtures/instancia-admin-fixture.ts";
import { openAndReadSelectOptions, selectByText } from "./helpers/form-controls.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase04-e2e-` prefix so
// leftovers are greppable/removable, and every test cleans up what it
// created (success path + afterEach guard), mirroring
// entities-rotina-log.spec.ts's established shape.
//
// Task 1 (TOOLTIP-01) creates no templatesRotina record — a tooltip is pure
// client-side render inside the still-open create dialog — but the
// apolloCli/uniqueName/sweepLeftovers harness is scaffolded now so Tasks 2/3
// (TOOLTIP-02, CLEAR-01) can add tests without re-plumbing it.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const PREFIX = "phase04-e2e-";
const OWNER_EMAIL = "tp@rbrasset.com.br";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

// Exported (not merely module-local) so Task 1's own `bun run check` doesn't
// flag it as an unused local: TOOLTIP-01 (this task) doesn't need it, but
// it's scaffolded now — mirroring entities-rotina-log.spec.ts's shape — so
// Tasks 2/3's TOOLTIP-02/CLEAR-01 tests can use it without re-plumbing.
export function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function tryDeleteTemplate(eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli(["rotina", "template", "deletar", "--id", eid, "--force"]);
  } catch {
    // Already gone — fine.
  }
}

async function sweepLeftovers(): Promise<void> {
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDeleteTemplate(record.id);
  }
  await sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL);
}

// Click "salvar", tolerating the same rare DOM-actionability race documented
// in entities-rotina-log.spec.ts's local submitForm — InstantDB's reactive
// link-target queries can re-render the form at the exact instant
// Playwright's click actionability check re-verifies "stable". Duplicated
// locally per this file's own no-shared-helper convention.
async function submitForm(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  try {
    await page.getByTestId("entity-submit").click({ timeout: 10_000 });
  } catch (err) {
    const formGone = (await page.locator("form").count()) === 0;
    if (!formGone) throw err;
  }
}

test.beforeEach(async () => {
  await sweepLeftovers();
});

test.afterEach(async () => {
  await sweepLeftovers();
});

test("TOOLTIP-01: ativo's help tooltip appears on hover and on keyboard focus", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await gotoNested(page, "templatesRotina");
  await page.getByTestId("entity-create-start").click();

  const helpTrigger = page.getByTestId("field-help-ativo");
  const tooltipContent = page.locator('[data-slot="tooltip-content"]');

  // Hover trigger mode.
  await helpTrigger.hover();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("job de geração");
  await page.keyboard.press("Escape");
  await expect(tooltipContent).toBeHidden();

  // Keyboard-focus trigger mode — no mouse action at all.
  await helpTrigger.focus();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("job de geração");

  await page.getByTestId("entity-cancel").click();
});

test("CLEAR-01: diaSemana can be set then cleared back to empty, and the persisted value is actually absent afterward", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nome = uniqueName("clear");
  const created = JSON.parse(
    apolloCli([
      "rotina",
      "template",
      "criar",
      "--nome",
      nome,
      "--tipo-geracao",
      "semanal",
      "--regra-competencia",
      "M0",
      "--dia-semana",
      "segunda",
    ]),
  ) as { id: string };
  const templateId = created.id;

  try {
    await gotoNested(page, "templatesRotina");
    const row = page.getByTestId("row").filter({ hasText: nome });
    await expect(row).toBeVisible();
    await row.getByTestId("row-edit").click();

    // diaSemana currently reads "segunda".
    await expect(page.getByTestId("field-diaSemana")).toHaveText("segunda");

    // Clear it back to blank via the real UI — only possible because Part
    // A's fix now renders a blank "—" option.
    await selectByText(page, "field-diaSemana", "—");
    await submitForm(page);
    await page.waitForTimeout(1500);

    // The actual server-side proof (D4): a live admin re-query, not the UI.
    const result = await adminQuery<{
      templatesRotina: { id: string; diaSemana?: string | null }[];
    }>({
      templatesRotina: { $: { where: { id: templateId } } },
    });
    const persisted = result.templatesRotina[0];
    expect(persisted?.diaSemana ?? null).toBeNull();

    // tipoGeracao must NOT gain a blank option — Part A's fix should not
    // weaken the required-field guarantee. (The edit dialog already
    // auto-closed on successful submit — handleSubmit sets mode = null on
    // both create and edit success — so no extra cancel click is needed
    // before opening the create dialog here.)
    await page.getByTestId("entity-create-start").click();
    const tipoGeracaoOptions = await openAndReadSelectOptions(page, "field-tipoGeracao");
    expect(tipoGeracaoOptions).not.toContain("—");
    await page.getByTestId("entity-cancel").click();
  } finally {
    tryDeleteTemplate(templateId);
  }
});

test("TOOLTIP-02: propagarAtrasoSoft's help tooltip appears on hover and keyboard focus, and honestly states its no-op status", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await gotoNested(page, "templatesRotina");
  await page.getByTestId("entity-create-start").click();

  const helpTrigger = page.getByTestId("field-help-propagarAtrasoSoft");
  const tooltipContent = page.locator('[data-slot="tooltip-content"]');

  // Hover trigger mode.
  await helpTrigger.hover();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("reservado");
  await expect(tooltipContent).toContainText("soft");
  await page.keyboard.press("Escape");
  await expect(tooltipContent).toBeHidden();

  // Keyboard-focus trigger mode — no mouse action at all.
  await helpTrigger.focus();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("reservado");
  await expect(tooltipContent).toContainText("soft");

  await page.getByTestId("entity-cancel").click();
});
