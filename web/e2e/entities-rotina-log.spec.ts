import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import {
  deleteAdminRecord,
  deleteInstance,
  readInstance,
  seedInstance,
} from "./fixtures/instancia-admin-fixture.ts";
import { openAndReadSelectOptions, selectByText } from "./helpers/form-controls.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts — see 04-01). Every generated record uses the
// `phase04-e2e-` prefix so leftovers are greppable/removable, and every test
// cleans up what it created (success path + afterEach guard), per T-04-08.
//
// Test 2 (instanciasRotina) is the one exception to "records are created via
// the CLI or the SPA": neither channel may create an instance by design
// (C-06). That test seeds/tears down its single fixture instance directly
// via the InstantDB admin API — see `./fixtures/instancia-admin-fixture.ts`
// for the full rationale. That fixture is TEST-ONLY: it lives under
// `web/e2e/`, is never imported by `web/src/`, and is therefore never
// bundled into the shipped app (verified below and by this task's own
// acceptance criteria).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase04-e2e-";
const OWNER_EMAIL = "tp@rbrasset.com.br";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function tryDeleteTemplate(eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli(["rotina", "template", "deletar", "--id", eid]);
  } catch {
    // Already gone — fine.
  }
}

function sweepLeftovers(): void {
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  // sucessores must be deleted before their antecessor to avoid a dangling
  // self-link reference, though delete_entity does not itself enforce order
  // — sorted defensively regardless.
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDeleteTemplate(record.id);
  }
}

// logInferenciaClaude has no `deletar` command on the CLI by design
// (append-only). Sweeping its `phase04-e2e-` leftovers via the admin-only
// test fixture is the only way to keep this spec's own re-runs from leaving
// permanent debris in the live app — see
// ./fixtures/instancia-admin-fixture.ts's `deleteAdminRecord` doc comment.
async function sweepLogLeftovers(): Promise<void> {
  const records = JSON.parse(apolloCli(["log-inferencia", "listar"])) as {
    id: string;
    campo: string;
  }[];
  for (const record of records) {
    if (record.campo.startsWith(PREFIX)) {
      await deleteAdminRecord("logInferenciaClaude", record.id);
    }
  }
}

// Click "salvar", tolerating the same rare DOM-actionability race documented
// in 04-03/04-04's specs: InstantDB's reactive link-target queries can
// re-render the form at the exact instant Playwright's click actionability
// check re-verifies "stable". If the form is already gone by the time the
// click throws, the submit succeeded.
async function submitForm(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  try {
    await page.getByTestId("entity-submit").click({ timeout: 10_000 });
  } catch (err) {
    const formGone = (await page.locator("form").count()) === 0;
    if (!formGone) throw err;
  }
}

async function waitForSettle(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
}

test.beforeEach(async () => {
  sweepLeftovers();
  await sweepLogLeftovers();
});

test.afterEach(async () => {
  sweepLeftovers();
  await sweepLogLeftovers();
});

test("WEB-06: templatesRotina full CRUD, including the self-referential antecessor link", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const nomeA = uniqueName("template-a");
  const nomeB = uniqueName("template-b");

  await page.goto("/");
  await page.getByTestId("nav-templatesRotina").click();

  // tipoGeracao offers exactly du_fixo, corrido_fixo, encadeado — matching
  // the CLI's click.Choice(_TIPO_GERACAO_CHOICES), no free text.
  await page.getByTestId("entity-create-start").click();
  const optionValues = await openAndReadSelectOptions(page, "field-tipoGeracao");
  expect(optionValues.sort()).toEqual(["corrido_fixo", "du_fixo", "encadeado"]);

  // Create A with neither fundo nor antecessor.
  await page.getByTestId("field-nome").fill(nomeA);
  await selectByText(page, "field-tipoGeracao", "du_fixo");
  await page.getByTestId("field-regraCompetencia").fill("mes-corrente");
  await submitForm(page);

  const rowA = page.getByTestId("row").filter({ hasText: nomeA });
  await expect(rowA).toBeVisible();
  const eidA = await rowA.getAttribute("data-eid");
  expect(eidA).toBeTruthy();

  // Both link columns blank (listColumns: nome, tipoGeracao, offsetDias,
  // ativo, fundo, antecessor).
  const cellsA = rowA.locator("td");
  await expect(cellsA.nth(4)).toHaveText("");
  await expect(cellsA.nth(5)).toHaveText("");

  // Create B with antecessor = A.
  await page.getByTestId("entity-create-start").click();
  await page.getByTestId("field-nome").fill(nomeB);
  await selectByText(page, "field-tipoGeracao", "encadeado");
  await page.getByTestId("field-regraCompetencia").fill("encadeado-de-a");
  await selectByText(page, "link-antecessor", nomeA);
  await submitForm(page);

  const rowB = page.getByTestId("row").filter({ hasText: nomeB });
  await expect(rowB).toBeVisible();
  const eidB = await rowB.getAttribute("data-eid");
  expect(eidB).toBeTruthy();
  const cellsB = rowB.locator("td");
  await expect(cellsB.nth(5)).toHaveText(nomeA);

  // Open B's edit form: the antecessor select must NOT contain B itself.
  await waitForSettle(page);
  await rowB.getByTestId("row-edit").click();
  const antecessorOptionLabels = await openAndReadSelectOptions(page, "link-antecessor");
  expect(antecessorOptionLabels).not.toContain(nomeB);

  // Set ativo false, reload, assert the column reads "não".
  const ativoCheckbox = page.getByTestId("field-ativo");
  if (await ativoCheckbox.isChecked()) await ativoCheckbox.uncheck();
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await waitForSettle(page);
  await page.reload();
  await page.getByTestId("nav-templatesRotina").click();
  const reloadedRowB = page.getByTestId("row").filter({ hasText: nomeB });
  await expect(reloadedRowB.locator("td").nth(3)).toHaveText("não", {
    timeout: RESYNC_TIMEOUT,
  });

  // Delete both (B before A — A is B's antecessor).
  page.once("dialog", (dialog) => void dialog.accept());
  await reloadedRowB.getByTestId("row-delete").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeB })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });

  const reloadedRowA = page.getByTestId("row").filter({ hasText: nomeA });
  page.once("dialog", (dialog) => void dialog.accept());
  await reloadedRowA.getByTestId("row-delete").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeA })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-07: instanciasRotina offers no create, no delete, and status-only edit", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.goto("/");
  await page.getByTestId("nav-instanciasRotina").click();

  // (a) No create affordance anywhere on this screen.
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);

  // (b) No delete affordance anywhere on this screen, regardless of how many
  // rows are present.
  await expect(page.getByTestId("row-delete")).toHaveCount(0);

  // Let the initial InstantDB subscription settle before counting rows: right
  // after `nav-instanciasRotina` is clicked the query is still `isLoading`,
  // which also reports zero "row" testids, so an immediate count() races the
  // subscription rather than reflecting the live app's actual instance count
  // (which is non-zero once Phase 5's job has run at least once for real).
  await waitForSettle(page);
  const hasRows = (await page.getByTestId("row").count()) > 0;
  if (!hasRows) {
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  }

  // Seed exactly ONE instance via the admin-only test fixture (see
  // ./fixtures/instancia-admin-fixture.ts) to exercise the status-only
  // update path — this is the ONLY create path used anywhere in this spec
  // for instanciasRotina, and it is not the SPA and not the CLI.
  const dedupeKey = uniqueName("dedupe");
  const dataPrevista = "2026-03-01T00:00:00.000Z";
  const competencia = uniqueName("competencia");
  const eid = await seedInstance(
    {
      dedupeKey,
      dataPrevista,
      competencia,
      tipoPrazo: "hard",
      status: "pendente",
    },
    OWNER_EMAIL,
  );

  try {
    await page.reload();
    await page.getByTestId("nav-instanciasRotina").click();
    const row = page.getByTestId("row").filter({ hasText: competencia });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // Still no create, still no delete, even with a row present.
    await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
    await expect(page.getByTestId("row-delete")).toHaveCount(0);

    await row.getByTestId("row-edit").click();
    // ONLY field-status is reachable — dedupeKey, dataPrevista, and
    // competencia are not editable (updatableFields: ["status"]).
    await expect(page.getByTestId("field-status")).toHaveCount(1);
    await expect(page.getByTestId("field-dedupeKey")).toHaveCount(0);
    await expect(page.getByTestId("field-dataPrevista")).toHaveCount(0);
    await expect(page.getByTestId("field-competencia")).toHaveCount(0);

    await page.getByTestId("field-status").fill("concluida");
    await submitForm(page);
    await expect(page.getByTestId("entity-submit")).toHaveCount(0);
    await waitForSettle(page);

    // Verify server-side: status changed, dedupeKey and dataPrevista are
    // byte-identical to before.
    const after = await readInstance(eid);
    expect(after?.status).toBe("concluida");
    expect(after?.dedupeKey).toBe(dedupeKey);
    expect(after?.dataPrevista).toBe(dataPrevista);
  } finally {
    await deleteInstance(eid);
  }
});

test("WEB-09: logInferenciaClaude is a pure read-only table showing CLI-written entries", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const campo = uniqueName("campo");
  const valorInferido = uniqueName("valor");

  const created = JSON.parse(
    apolloCli([
      "log-inferencia",
      "registrar",
      "--campo",
      campo,
      "--valor-inferido",
      valorInferido,
      "--entidade-tipo",
      "tarefas",
      "--entidade-id",
      "phase04-e2e-fixture-entidade",
    ]),
  ) as { id: string };

  try {
    await page.goto("/");
    await page.getByTestId("nav-logInferenciaClaude").click();
    const row = page.getByTestId("row").filter({ hasText: campo });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(row).toContainText(valorInferido);

    // No write affordance of any kind.
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
    await expect(page.getByTestId("row-edit")).toHaveCount(0);
    await expect(page.getByTestId("row-delete")).toHaveCount(0);
  } finally {
    // No `deletar` command exists on this CLI group by design (append-only,
    // PROJECT.md threat T-03-26) — clean up via the admin-only test fixture
    // instead so this spec's own leftovers do not accumulate forever in the
    // live app.
    await deleteAdminRecord("logInferenciaClaude", created.id);
  }
});
