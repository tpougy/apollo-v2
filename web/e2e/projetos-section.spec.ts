import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { selectByText } from "./helpers/form-controls";

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
  // Order matters: tarefas/subtarefas before etapas before projetos before
  // fundos, mirroring entities-projeto-etapa-tarefa.spec.ts's own
  // sweepLeftovers — InstantDB does not cascade-delete linked rows.
  const subtarefas = JSON.parse(apolloCli(["subtarefa", "listar"])) as {
    id: string;
    titulo: string;
  }[];
  for (const record of subtarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("subtarefa", record.id);
  }
  const tarefas = JSON.parse(apolloCli(["tarefa", "listar"])) as { id: string; titulo: string }[];
  for (const record of tarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("tarefa", record.id);
  }
  const etapas = JSON.parse(apolloCli(["etapa", "listar"])) as { id: string; nome: string }[];
  for (const record of etapas) {
    if (record.nome.startsWith(PREFIX)) tryDelete("etapa", record.id);
  }
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

test.describe("etapas accordion (NEST-02)", () => {
  let projetoId = "";
  let projetoNome = "";
  // Deliberately created out of `ordem` order: etapaAlta (ordem 20) first,
  // etapaBaixa (ordem 10) second — proves the row is sorted by the
  // row-level `etapas.ordem` field, never array insertion order.
  let etapaAltaId = "";
  let etapaAltaNome = "";
  let etapaBaixaId = "";
  let etapaBaixaNome = "";
  let tarefaDoneId = "";
  let tarefaDoneTitulo = "";
  let tarefaMistaId = "";
  let tarefaMistaTitulo = "";
  let tarefaSemSubId = "";
  let tarefaSemSubTitulo = "";
  let tarefaAtrasadaId = "";
  let tarefaAtrasadaTitulo = "";
  let tarefaAltaId = "";

  test.beforeAll(() => {
    projetoNome = uniqueName("acc-projeto");
    const projetoCreated = JSON.parse(
      apolloCli(["projeto", "criar", "--nome", projetoNome, "--status", "ativo"]),
    ) as { id: string };
    projetoId = projetoCreated.id;

    etapaAltaNome = uniqueName("etapa-alta");
    const etapaAltaCreated = JSON.parse(
      apolloCli([
        "etapa",
        "criar",
        "--nome",
        etapaAltaNome,
        "--ordem",
        "20",
        "--status",
        "ativo",
        "--projeto-id",
        projetoId,
      ]),
    ) as { id: string };
    etapaAltaId = etapaAltaCreated.id;

    etapaBaixaNome = uniqueName("etapa-baixa");
    const etapaBaixaCreated = JSON.parse(
      apolloCli([
        "etapa",
        "criar",
        "--nome",
        etapaBaixaNome,
        "--ordem",
        "10",
        "--status",
        "ativo",
        "--projeto-id",
        projetoId,
      ]),
    ) as { id: string };
    etapaBaixaId = etapaBaixaCreated.id;

    // etapaBaixa's tarefas: 1 feita (all subtarefas concluida) out of 4 total.
    tarefaDoneTitulo = uniqueName("tarefa-concluida");
    const tarefaDoneCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaDoneTitulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        "2020-01-01",
        "--etapa-id",
        etapaBaixaId,
      ]),
    ) as { id: string };
    tarefaDoneId = tarefaDoneCreated.id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub"),
      "--ordem",
      "1",
      "--concluida",
      "--tarefa-id",
      tarefaDoneId,
    ]);

    tarefaMistaTitulo = uniqueName("tarefa-mista");
    const tarefaMistaCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaMistaTitulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        "2030-01-01",
        "--etapa-id",
        etapaBaixaId,
      ]),
    ) as { id: string };
    tarefaMistaId = tarefaMistaCreated.id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub"),
      "--ordem",
      "1",
      "--concluida",
      "--tarefa-id",
      tarefaMistaId,
    ]);
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub"),
      "--ordem",
      "2",
      "--nao-concluida",
      "--tarefa-id",
      tarefaMistaId,
    ]);

    tarefaSemSubTitulo = uniqueName("tarefa-sem-subs");
    const tarefaSemSubCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaSemSubTitulo,
        "--tipo-prazo",
        "hard",
        "--status",
        "pendente",
        "--etapa-id",
        etapaBaixaId,
      ]),
    ) as { id: string };
    tarefaSemSubId = tarefaSemSubCreated.id;

    tarefaAtrasadaTitulo = uniqueName("tarefa-atrasada");
    const tarefaAtrasadaCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaAtrasadaTitulo,
        "--tipo-prazo",
        "hard",
        "--status",
        "pendente",
        "--data-prevista",
        "2020-01-01",
        "--etapa-id",
        etapaBaixaId,
      ]),
    ) as { id: string };
    tarefaAtrasadaId = tarefaAtrasadaCreated.id;

    // etapaAlta's tarefa: 1 feita / 1 total.
    const tarefaAltaCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        uniqueName("tarefa-alta-concluida"),
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--etapa-id",
        etapaAltaId,
      ]),
    ) as { id: string };
    tarefaAltaId = tarefaAltaCreated.id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub"),
      "--ordem",
      "1",
      "--concluida",
      "--tarefa-id",
      tarefaAltaId,
    ]);
  });

  test.afterAll(() => {
    tryDelete("tarefa", tarefaDoneId);
    tryDelete("tarefa", tarefaMistaId);
    tryDelete("tarefa", tarefaSemSubId);
    tryDelete("tarefa", tarefaAtrasadaId);
    tryDelete("tarefa", tarefaAltaId);
    tryDelete("etapa", etapaAltaId);
    tryDelete("etapa", etapaBaixaId);
    tryDelete("projeto", projetoId);
    sweepLeftovers();
  });

  test("NEST-02: etapas render ordered by row-level ordem asc regardless of creation order, with progress bar/counter from progressoEtapa", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    await expect(page.getByTestId("project-etapas-list")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const rows = page.getByTestId("etapa-row");
    await expect(rows).toHaveCount(2, { timeout: RESYNC_TIMEOUT });
    // ordem ascending: etapaBaixa (10) before etapaAlta (20), despite
    // etapaAlta having been created first via the CLI above.
    await expect(rows.nth(0)).toHaveAttribute("data-eid", etapaBaixaId);
    await expect(rows.nth(1)).toHaveAttribute("data-eid", etapaAltaId);

    // etapaBaixa: 1 feita (tarefaDone, subtarefas all concluida) / 4 total.
    await expect(rows.nth(0)).toContainText("1/4");
    // etapaAlta: 1 feita / 1 total.
    await expect(rows.nth(1)).toContainText("1/1");
  });

  test("NEST-02: accordion is single-open -- opening one etapa closes the other", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const baixaRow = page.getByTestId("etapa-row").filter({ hasText: etapaBaixaNome });
    const altaRow = page.getByTestId("etapa-row").filter({ hasText: etapaAltaNome });
    await expect(baixaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await baixaRow.click();
    await expect(baixaRow).toHaveAttribute("aria-expanded", "true");

    await altaRow.click();
    await expect(altaRow).toHaveAttribute("aria-expanded", "true");
    await expect(baixaRow).toHaveAttribute("aria-expanded", "false");
  });

  test("NEST-02: '+ etapa' creates via the hidden-instance pattern, presetLinks pre-fills but does not lock the projeto link", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const novaEtapaNome = uniqueName("nova-etapa");

    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    await page.getByTestId("project-add-etapa-start").click();
    await expect(page.getByTestId("field-nome")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // The projeto link select is still visible/editable, pre-filled to the
    // currently selected projeto (spec §2.1: "select do link continua
    // visível e editável").
    await expect(page.getByTestId("link-projeto")).toBeVisible();
    await expect(page.getByTestId("link-projeto")).toHaveText(projetoNome, {
      timeout: RESYNC_TIMEOUT,
    });

    await page.getByTestId("field-nome").fill(novaEtapaNome);
    await page.getByTestId("field-ordem").fill("15");
    await page.getByTestId("field-status").fill("ativo");
    await submitForm(page);

    const novaRow = page.getByTestId("etapa-row").filter({ hasText: novaEtapaNome });
    await expect(novaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const novaEid = await novaRow.getAttribute("data-eid");

    // Sorted position: ordem 15 lands between etapaBaixa (10) and etapaAlta (20).
    const rows = page.getByTestId("etapa-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toHaveAttribute("data-eid", novaEid as string);

    tryDelete("etapa", novaEid);
  });

  test("NEST-02: inline tarefas show a disabled completion checkbox matching tarefaConcluida", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const baixaRow = page.getByTestId("etapa-row").filter({ hasText: etapaBaixaNome });
    await expect(baixaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await baixaRow.click();

    const tarefasList = page.getByTestId("etapa-tarefas-list");
    await expect(tarefasList).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const doneRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaDoneTitulo });
    const mistaRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaMistaTitulo });
    const semSubRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaSemSubTitulo });

    // tarefaDone: ≥1 subtarefa, all concluida -> checked and disabled.
    const doneCheckbox = doneRow.getByTestId("etapa-tarefa-concluida");
    await expect(doneCheckbox).toBeChecked();
    await expect(doneCheckbox).toBeDisabled();

    // tarefaMista: mixed subtarefas -> unchecked, still disabled.
    const mistaCheckbox = mistaRow.getByTestId("etapa-tarefa-concluida");
    await expect(mistaCheckbox).not.toBeChecked();
    await expect(mistaCheckbox).toBeDisabled();

    // tarefaSemSub: zero subtarefas -> never counts as done.
    const semSubCheckbox = semSubRow.getByTestId("etapa-tarefa-concluida");
    await expect(semSubCheckbox).not.toBeChecked();
    await expect(semSubCheckbox).toBeDisabled();
  });

  test("NEST-02: prazo is styled text-destructive only per vencido()'s exact rule", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const baixaRow = page.getByTestId("etapa-row").filter({ hasText: etapaBaixaNome });
    await expect(baixaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await baixaRow.click();

    const tarefasList = page.getByTestId("etapa-tarefas-list");
    await expect(tarefasList).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // tarefaAtrasada: past dataPrevista, NOT concluida -> destructive.
    const atrasadaRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaAtrasadaTitulo });
    await expect(atrasadaRow.getByTestId("etapa-tarefa-prazo")).toHaveClass(/text-destructive/);

    // tarefaDone: past dataPrevista too, but concluida -> NOT destructive
    // (vencido()'s exact `!concluido` term).
    const doneRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaDoneTitulo });
    await expect(doneRow.getByTestId("etapa-tarefa-prazo")).not.toHaveClass(/text-destructive/);

    // tarefaMista: future dataPrevista, not concluida -> not vencido either.
    const mistaRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaMistaTitulo });
    await expect(mistaRow.getByTestId("etapa-tarefa-prazo")).not.toHaveClass(/text-destructive/);
  });

  test("NEST-02: subtarefa chip shows the exact concluida/total count from the fixture", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const baixaRow = page.getByTestId("etapa-row").filter({ hasText: etapaBaixaNome });
    await expect(baixaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await baixaRow.click();

    const tarefasList = page.getByTestId("etapa-tarefas-list");
    await expect(tarefasList).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const doneRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaDoneTitulo });
    await expect(doneRow.getByTestId("etapa-tarefa-subtarefas-chip")).toHaveText("1/1");

    const mistaRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaMistaTitulo });
    await expect(mistaRow.getByTestId("etapa-tarefa-subtarefas-chip")).toHaveText("1/2");

    const semSubRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaSemSubTitulo });
    await expect(semSubRow.getByTestId("etapa-tarefa-subtarefas-chip")).toHaveText("0/0");

    // The chip is a passive Badge, never an interactive <button> -- Phase 20
    // wires the click (NEST-05, deferred per CONTEXT.md).
    const chipTag = await doneRow
      .getByTestId("etapa-tarefa-subtarefas-chip")
      .evaluate((el) => el.tagName.toLowerCase());
    expect(chipTag).not.toBe("button");
  });

  test("NEST-02: '+ tarefa nesta etapa' creates via the hidden-instance pattern, pre-linked to the live open etapa", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const novaTarefaTitulo = uniqueName("nova-tarefa");

    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const baixaRow = page.getByTestId("etapa-row").filter({ hasText: etapaBaixaNome });
    await expect(baixaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await baixaRow.click();

    await page.getByTestId("etapa-add-tarefa-start").click();
    await expect(page.getByTestId("field-titulo")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // The etapa link select is still visible/editable, pre-filled to the
    // currently open etapa -- no need to re-select it.
    await expect(page.getByTestId("link-etapa")).toBeVisible();
    await expect(page.getByTestId("link-etapa")).toHaveText(etapaBaixaNome, {
      timeout: RESYNC_TIMEOUT,
    });

    await page.getByTestId("field-titulo").fill(novaTarefaTitulo);
    await selectByText(page, "field-tipoPrazo", "soft");
    await page.getByTestId("field-status").fill("pendente");
    await submitForm(page);

    const novaTarefaRow = page
      .getByTestId("etapa-tarefas-list")
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: novaTarefaTitulo });
    await expect(novaTarefaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const novaTarefaEid = await novaTarefaRow.getAttribute("data-eid");

    tryDelete("tarefa", novaTarefaEid);
  });
});
