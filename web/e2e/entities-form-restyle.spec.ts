import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { openAndReadSelectOptions, pickDate, selectByText } from "./helpers/form-controls.ts";

// Proves ENTFRM-01/02 for the fundos (full-CRUD) capability class against the
// restyled shadcn Dialog/Input/Textarea/Checkbox/Popover+Calendar form, live
// against InstantDB. This spec runs in the `authed` project (restores the
// storageState persisted by auth.setup.ts — see 04-01), mirroring
// entities-fundos.spec.ts's CLI-fixture/sweep/cleanup discipline exactly.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase10-e2e-";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function sweepLeftovers(): void {
  const listed = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of listed) {
    if (!record.nome.startsWith(PREFIX)) continue;
    try {
      apolloCli(["fundo", "deletar", "--id", record.id]);
    } catch {
      // Already gone — fine.
    }
  }
}

test.beforeEach(() => {
  sweepLeftovers();
});

test.afterEach(() => {
  sweepLeftovers();
});

test("ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nome = uniqueName("dialog");
  const nomeEditado = `${nome}-editado`;
  const codigo = uniqueName("dialog-cod");

  await page.goto("/");
  await page.getByTestId("nav-fundos").click();

  // (1) Open create — a real shadcn Dialog (role="dialog"), not a bare form.
  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-codigo").fill(codigo);
  const ativoCheckbox = page.getByTestId("field-ativo");
  if (!(await ativoCheckbox.isChecked())) {
    await ativoCheckbox.check();
  }
  const createdAtValue = await pickDate(page, "field-createdAt");

  await page.getByTestId("entity-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // Reload and assert the picked date persisted correctly to live InstantDB
  // (ENTFRM-02) — not just an optimistic local view.
  await page.reload();
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("row").filter({ hasText: nome })).toContainText(createdAtValue, {
    timeout: RESYNC_TIMEOUT,
  });

  // (2) Edit — Dialog reopens, nome field prefilled, resubmit persists change.
  await row.getByTestId("row-edit").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("field-nome")).toHaveValue(nome);
  await page.getByTestId("field-nome").fill(nomeEditado);
  await page.getByTestId("entity-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const editedRow = page.getByTestId("row").filter({ hasText: nomeEditado });
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toHaveAttribute("data-eid", eid ?? "");

  // (3) Delete — accept the native confirm(), assert the row is gone.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await editedRow.getByTestId("row-delete").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeEditado })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

// ENTFRM-01/03: templatesRotina smoke test — proves the static-option Select
// (tipoGeracao) AND the relationship-link Select (fundo) both render via
// shadcn Select and persist correctly. Does not duplicate
// entities-rotina-log.spec.ts's own full-CRUD/antecessor-self-exclude
// coverage — that stays exclusively in that pre-existing spec (fixed in this
// phase's own 10-04 plan).
test.describe("templatesRotina — Select field conversion", () => {
  // NOTE: the outer `test.beforeEach`/`afterEach` above (scoped to fundos
  // via the same PREFIX) run for every test in this file, including this
  // nested describe — outer beforeEach fires BEFORE any local hook. If the
  // fundo fixture were created in a `beforeAll` here, it would already exist
  // by the time the outer `beforeEach` sweeps every phase10-e2e-* fundo,
  // deleting the fixture right before the test body runs. Creating it in a
  // local `beforeEach` (which fires AFTER the outer one) avoids that race,
  // and the outer `afterEach`'s sweep is exactly the cleanup this fixture
  // needs afterward — no separate afterAll delete required.
  let fundoNome = "";

  function sweepTemplateLeftovers(): void {
    const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
      id: string;
      nome: string;
    }[];
    for (const record of templates) {
      if (!record.nome.startsWith(PREFIX)) continue;
      try {
        apolloCli(["rotina", "template", "deletar", "--id", record.id]);
      } catch {
        // Already gone — fine.
      }
    }
  }

  test.beforeEach(() => {
    sweepTemplateLeftovers();
    fundoNome = uniqueName("template-fundo");
    apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueName("template-fundo-cod")]);
  });

  test.afterEach(() => {
    sweepTemplateLeftovers();
  });

  test("ENTFRM-01/03: templatesRotina — static-option Select (tipoGeracao) and relationship-link Select (fundo) render and persist", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const nome = uniqueName("template");

    await page.goto("/");
    await page.getByTestId("nav-templatesRotina").click();
    await page.getByTestId("entity-create-start").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Assert tipoGeracao's Select offers exactly the three static options.
    const tipoGeracaoOptions = await openAndReadSelectOptions(page, "field-tipoGeracao");
    expect(tipoGeracaoOptions.sort()).toEqual(["corrido_fixo", "du_fixo", "encadeado"]);

    await page.getByTestId("field-nome").fill(nome);
    await page.getByTestId("field-regraCompetencia").fill("regra teste");
    await selectByText(page, "field-tipoGeracao", "du_fixo");
    await selectByText(page, "link-fundo", fundoNome);

    await page.getByTestId("entity-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const row = page.getByTestId("row").filter({ hasText: nome });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(row).toContainText(fundoNome);

    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByTestId("row-delete").click();
    await expect(page.getByTestId("row").filter({ hasText: nome })).toHaveCount(0, {
      timeout: RESYNC_TIMEOUT,
    });
  });
});
