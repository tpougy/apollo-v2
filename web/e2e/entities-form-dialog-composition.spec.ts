import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";
import { pickDate } from "./helpers/form-controls.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// Proves ENTFRM-05/06/07/08 explicitly, live against InstantDB, on top of
// Plan 15-01's EntityScreen.svelte Dialog/form restructuring (space-y-4/
// space-y-2 spacing scale, Dialog.Description/Dialog.Footer composition, a
// busy/spinner submit state, and a required-field visual indicator). This
// spec runs in the `authed` project (restores the storageState persisted by
// auth.setup.ts), mirroring entities-header-states.spec.ts's/
// login-composition.spec.ts's own conventions (gap-parity measurement style,
// one-entity-per-capability-class coverage, RESYNC_TIMEOUT/PREFIX idioms).
//
// This spec never calls InstantDB's write API directly (grep-verified by
// this task's own acceptance criteria) — Test 3's one write goes through the
// real UI submit flow, and Test 4's one seeded record goes through the
// seedInstance/deleteInstance admin-API fixture helpers. Tests 1, 2, and 4's
// own assertions perform zero UI-triggered writes.

const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase15-e2e-";
const OWNER_EMAIL = "tp@rbrasset.com.br";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

test("ENTFRM-05: tarefas create Dialog uses a uniform two-tier space-y-4/space-y-2 spacing scale across fields and links", async ({
  page,
}) => {
  await gotoNested(page, "tarefas");
  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Primary proof: the actual applied CSS margin value at each tier, read via
  // getComputedStyle — deterministic and immune to the small per-control-type
  // rendering/subpixel variance a raw boundingBox() delta would pick up
  // between heterogeneous control kinds (e.g. a native inline-level <input>
  // vs. an explicitly flex-positioned <textarea>/Select.Trigger), which is a
  // rendering-engine nuance unrelated to the actual spacing scale applied.
  // space-y-2 sets `margin-block-end` on the field's own Label (the first of
  // its two children); space-y-4 sets `margin-block-end` on the field's
  // wrapper <div> itself (the form's own children, all but the last).
  async function labelMarginBlockEnd(forId: string): Promise<string> {
    return page
      .locator(`label[for="${forId}"]`)
      .evaluate((el) => getComputedStyle(el).marginBlockEnd);
  }
  async function wrapperMarginBlockEnd(forId: string): Promise<string> {
    return page
      .locator(`label[for="${forId}"]`)
      .locator("..")
      .evaluate((el) => getComputedStyle(el).marginBlockEnd);
  }

  for (const forId of ["field-titulo", "field-descricao", "field-tipoPrazo", "link-etapa"]) {
    expect(await labelMarginBlockEnd(forId)).toBe("8px");
  }
  // The last field-group's wrapper div has no margin-block-end (it is the
  // dialog's own last-child-before-the-links-loop within the space-y-4
  // form) — only assert the tier value on wrappers that precede a sibling.
  for (const forId of ["field-titulo", "field-descricao", "field-tipoPrazo"]) {
    expect(await wrapperMarginBlockEnd(forId)).toBe("16px");
  }

  // Two-tier proof, still visually observed via a real rendered gap (not just
  // the CSS declaration): the space-y-4 (field-group) gap renders strictly
  // larger than the space-y-2 (label/control) gap, comparing LIKE control
  // types only (titulo's own Label->Input gap vs. titulo's Input-> the next
  // field's Label gap) to avoid the cross-control-type subpixel noise above.
  await page.evaluate(() => document.fonts.ready);
  const tituloLabelBox = await page.locator('label[for="field-titulo"]').boundingBox();
  const tituloControlBox = await page.getByTestId("field-titulo").boundingBox();
  const descricaoLabelBox = await page.locator('label[for="field-descricao"]').boundingBox();
  if (!tituloLabelBox || !tituloControlBox || !descricaoLabelBox) {
    throw new Error("titulo/descricao boxes unavailable");
  }
  const space2Gap = tituloControlBox.y - (tituloLabelBox.y + tituloLabelBox.height);
  const space4Gap = descricaoLabelBox.y - (tituloControlBox.y + tituloControlBox.height);
  expect(space4Gap).toBeGreaterThan(space2Gap);

  await page.getByTestId("entity-cancel").click();
});

test("ENTFRM-06: tarefas create Dialog composes Dialog.Description (reusing config.descricao) and Dialog.Footer (wrapping entity-submit/entity-cancel)", async ({
  page,
}) => {
  await gotoNested(page, "tarefas");

  const headerDescription = page.getByTestId("entity-description");
  const headerDescriptionText = await headerDescription.textContent();

  await page.getByTestId("entity-create-start").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const dialogDescription = dialog.locator('[data-slot="dialog-description"]');
  await expect(dialogDescription).toHaveCount(1);
  await expect(dialogDescription).toBeVisible();
  await expect(dialogDescription).toHaveText(headerDescriptionText ?? "");

  const dialogFooter = dialog.locator('[data-slot="dialog-footer"]');
  await expect(dialogFooter).toHaveCount(1);
  await expect(dialogFooter.getByTestId("entity-submit")).toBeVisible();
  await expect(dialogFooter.getByTestId("entity-cancel")).toBeVisible();

  await page.getByTestId("entity-cancel").click();
});

test("ENTFRM-07: submitting fundos' create Dialog shows a genuinely observable busy/spinner state on entity-submit during the live write", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const nome = uniqueName("busy-fundo");
  const codigo = uniqueName("busy-fundo-cod");
  let eid: string | null = null;

  try {
    await page.goto("/");
    await page.getByTestId("nav-fundos").click();
    await page.getByTestId("entity-create-start").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByTestId("field-nome").fill(nome);
    await page.getByTestId("field-codigo").fill(codigo);
    const ativoCheckbox = page.getByTestId("field-ativo");
    if (!(await ativoCheckbox.isChecked())) {
      await ativoCheckbox.check();
    }
    await pickDate(page, "field-createdAt");

    const submitButton = page.getByTestId("entity-submit");
    await submitButton.click();

    // Auto-retrying assertions — proves the busy state is genuinely
    // observable during the in-flight InstantDB write round trip, not just
    // structurally wired but invisible.
    await expect(submitButton).toBeDisabled();
    await expect(submitButton.locator(".animate-spin")).toBeVisible();

    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    const row = page.getByTestId("row").filter({ hasText: nome });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    eid = await row.getAttribute("data-eid");
  } finally {
    if (eid) {
      try {
        apolloCli(["fundo", "deletar", "--id", eid]);
      } catch {
        // Already gone — fine.
      }
    }
  }
});

test("ENTFRM-08: required-indicator appears only on required fields, across full-CRUD and restricted capability classes, and is structurally inert for the read-only class", async ({
  page,
}) => {
  test.setTimeout(60_000);

  // (1) tarefas (full-CRUD): required fields show the indicator, optional
  // fields never do.
  await gotoNested(page, "tarefas");
  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const requiredFieldNames = ["titulo", "tipoPrazo", "status"];
  const optionalFieldNames = ["descricao", "dataPrevista", "dataPrevistaEstimada", "competencia"];

  for (const name of requiredFieldNames) {
    await expect(
      page.locator(`label[for="field-${name}"]`).locator(".text-destructive"),
    ).toHaveCount(1);
  }
  for (const name of optionalFieldNames) {
    await expect(
      page.locator(`label[for="field-${name}"]`).locator(".text-destructive"),
    ).toHaveCount(0);
  }

  await page.getByTestId("entity-cancel").click();

  // (2) instanciasRotina (restricted): the one editable field (status,
  // required: true) also shows the indicator.
  const dedupeKey = uniqueName("dedupe");
  const competencia = uniqueName("competencia");
  let instanceId = "";
  try {
    instanceId = await seedInstance(
      {
        dedupeKey,
        dataPrevista: "2026-05-01T00:00:00.000Z",
        competencia,
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
    );

    await page.getByTestId("nav-instanciasRotina").click();
    const row = page.getByTestId("row").filter({ hasText: competencia });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await row.getByTestId("row-edit").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await expect(
      page.locator('label[for="field-status"]').locator(".text-destructive"),
    ).toHaveCount(1);

    await page.getByTestId("entity-cancel").click();
  } finally {
    if (instanceId) await deleteInstance(instanceId);
  }

  // (3) logInferenciaClaude (read-only): structurally inert — no Dialog
  // trigger exists anywhere on the page for this capability class.
  await page.getByTestId("nav-logInferenciaClaude").click();
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
  await expect(page.getByTestId("row-edit")).toHaveCount(0);
});
