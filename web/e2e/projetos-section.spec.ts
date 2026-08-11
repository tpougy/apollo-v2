import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase19-e2e-` prefix so
// leftovers are greppable/removable, and cleanup runs in both `beforeAll` and
// `afterAll`, mirroring entities-projeto-etapa-tarefa.spec.ts's established
// CLI-fixture/sweep-leftovers pattern.
//
// This spec is additive-only — it does not edit any pre-existing e2e file.
// entities-projeto-etapa-tarefa.spec.ts's WEB-03 (which still assumes the old
// flat EntityScreen table for nav-projetos) is a documented, deferred
// regression fixed by Plan 19-04 (T-19-01-03).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase19-e2e-";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

// Click "salvar", tolerating the same rare DOM-actionability race against the
// live hosted backend documented in entities-projeto-etapa-tarefa.spec.ts's
// own submitForm.
async function submitForm(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  try {
    await page.getByTestId("entity-submit").click({ timeout: 10_000 });
  } catch (err) {
    const formGone = (await page.locator("form").count()) === 0;
    if (!formGone) throw err;
  }
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli([group, "deletar", "--id", eid]);
  } catch {
    // Already gone — fine.
  }
}

function sweepLeftovers(): void {
  const projetos = JSON.parse(apolloCli(["projeto", "listar"])) as { id: string; nome: string }[];
  for (const record of projetos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("projeto", record.id);
  }
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

let fundoId = "";
let fundoNome = "";
let projetoComFundoId = "";
let projetoComFundoNome = "";
let projetoSemFundoId = "";
let projetoSemFundoNome = "";

test.beforeAll(() => {
  sweepLeftovers();

  fundoNome = uniqueName("fundo");
  const fundoCreated = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", fundoNome, "--ativo"]),
  ) as { id: string };
  fundoId = fundoCreated.id;

  projetoComFundoNome = uniqueName("projeto-com-fundo");
  const projetoComFundoCreated = JSON.parse(
    apolloCli([
      "projeto",
      "criar",
      "--nome",
      projetoComFundoNome,
      "--status",
      "ativo",
      "--fundo-id",
      fundoId,
    ]),
  ) as { id: string };
  projetoComFundoId = projetoComFundoCreated.id;

  projetoSemFundoNome = uniqueName("projeto-sem-fundo");
  const projetoSemFundoCreated = JSON.parse(
    apolloCli(["projeto", "criar", "--nome", projetoSemFundoNome, "--status", "ativo"]),
  ) as { id: string };
  projetoSemFundoId = projetoSemFundoCreated.id;
});

test.afterAll(() => {
  tryDelete("projeto", projetoComFundoId);
  tryDelete("projeto", projetoSemFundoId);
  tryDelete("fundo", fundoId);
  sweepLeftovers();
});

test("NEST-02: master column groups projetos by fundo, 'Sem fundo vinculado' last", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-projetos").click();

  await expect(page.locator("h2")).toHaveText("Projetos");
  await expect(page.locator("h2")).toHaveCount(1);

  const fundoItem = page.getByTestId("project-item").filter({ hasText: projetoComFundoNome });
  const semFundoItem = page.getByTestId("project-item").filter({ hasText: projetoSemFundoNome });
  await expect(fundoItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(semFundoItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(fundoItem).toHaveAttribute("data-eid", projetoComFundoId);
  await expect(semFundoItem).toHaveAttribute("data-eid", projetoSemFundoId);

  // The fundo-linked projeto is under a heading matching the fundo's nome.
  const fundoGroup = page.getByTestId("project-group").filter({
    has: page.getByTestId("project-group-heading").filter({ hasText: fundoNome }),
  });
  await expect(
    fundoGroup.getByTestId("project-item").filter({ hasText: projetoComFundoNome }),
  ).toBeVisible();

  // The fundo-less projeto is under "Sem fundo vinculado".
  const semFundoGroup = page.getByTestId("project-group").filter({
    has: page.getByTestId("project-group-heading").filter({ hasText: "Sem fundo vinculado" }),
  });
  await expect(
    semFundoGroup.getByTestId("project-item").filter({ hasText: projetoSemFundoNome }),
  ).toBeVisible();

  // "Sem fundo vinculado" is always sorted last among the group headings.
  const headings = page.getByTestId("project-group-heading");
  const lastHeadingText = await headings.last().textContent();
  expect(lastHeadingText?.trim()).toBe("Sem fundo vinculado");
});

test("NEST-02: name search filters client-side over already-loaded rows", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-projetos").click();

  await expect(
    page.getByTestId("project-item").filter({ hasText: projetoComFundoNome }),
  ).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(
    page.getByTestId("project-item").filter({ hasText: projetoSemFundoNome }),
  ).toBeVisible({ timeout: RESYNC_TIMEOUT });

  // A substring unique to projetoComFundoNome (its own generated name) hides
  // the other fixture's item while keeping this one visible.
  await page.getByTestId("project-search").fill(projetoComFundoNome);

  await expect(
    page.getByTestId("project-item").filter({ hasText: projetoComFundoNome }),
  ).toBeVisible();
  await expect(
    page.getByTestId("project-item").filter({ hasText: projetoSemFundoNome }),
  ).toHaveCount(0);
});

test("NEST-02: '+ novo projeto' opens EntityScreen's own create dialog, new projeto appears with no reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const nome = uniqueName("created-via-ui");

  await page.goto("/");
  await page.getByTestId("nav-projetos").click();

  await page.getByTestId("project-create-start").click();
  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-status").fill("ativo");
  await submitForm(page);

  const newItem = page.getByTestId("project-item").filter({ hasText: nome });
  await expect(newItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const eid = await newItem.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  tryDelete("projeto", eid);
});

test("NEST-02: selecting a project-item highlights it and shows its breadcrumb/header with correct counts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-projetos").click();

  const item = page.getByTestId("project-item").filter({ hasText: projetoComFundoNome });
  await expect(item).toBeVisible({ timeout: RESYNC_TIMEOUT });

  const otherItem = page.getByTestId("project-item").filter({ hasText: projetoSemFundoNome });
  const otherBgBefore = await otherItem.evaluate((el) => getComputedStyle(el).backgroundColor);

  await item.click();

  await expect(page.getByTestId("project-breadcrumb")).toHaveText(
    `PROJETOS › ${projetoComFundoNome}`,
  );
  const header = page.getByTestId("project-header");
  await expect(header.locator("h3")).toHaveText(projetoComFundoNome);
  await expect(header).toContainText(fundoNome);
  await expect(header).toContainText("0 etapas");
  await expect(header).toContainText("0 tarefas");

  const itemBg = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
  const otherBgAfter = await otherItem.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(itemBg).not.toBe(otherBgAfter);
  expect(otherBgAfter).toBe(otherBgBefore);
});

test("NEST-02: 'editar projeto' opens the same hidden EntityScreen(projetosConfig) instance's edit form, pre-filled, and updates in place", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const nomeOriginal = uniqueName("editavel");
  const nomeEditado = `${nomeOriginal}-editado`;
  const created = JSON.parse(
    apolloCli(["projeto", "criar", "--nome", nomeOriginal, "--status", "ativo"]),
  ) as { id: string };
  const eid = created.id;

  try {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();

    const item = page.getByTestId("project-item").filter({ hasText: nomeOriginal });
    await expect(item).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await item.click();

    await page.getByTestId("project-edit-start").click();
    await expect(page.getByTestId("field-nome")).toHaveValue(nomeOriginal);

    await page.getByTestId("field-nome").fill(nomeEditado);
    await submitForm(page);

    const editedItem = page.getByTestId("project-item").filter({ hasText: nomeEditado });
    await expect(editedItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(editedItem).toHaveAttribute("data-eid", eid);

    const header = page.getByTestId("project-header");
    await expect(header.locator("h3")).toHaveText(nomeEditado, { timeout: RESYNC_TIMEOUT });
  } finally {
    tryDelete("projeto", eid);
  }
});
