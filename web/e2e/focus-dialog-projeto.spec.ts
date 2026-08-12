import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { selectByText } from "./helpers/form-controls.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring every other Phase 23 spec's
// established CLI-fixture/sweep-leftovers pattern.
//
// This file is Plan 23-06's own complete proof of the Projeto dialog (dialog
// #4 of 7, L width) -- the second depth-2 launch point (with Dia) -- plus the
// three remaining ProjectStrips.svelte click surfaces
// (project-strip-nome/-column-header/-card) and the live before/after proof
// of dashboardQuery.ts's subtarefas-completeness fix on BOTH the new
// ProjectDialog and the pre-existing ProjectStrips column header.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase23-e2e-";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function uniqueCodigo(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli([...group.split(" "), "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

// Click "salvar", tolerating the same rare DOM-actionability race against the
// live hosted backend documented in projetos-section.spec.ts's own
// submitForm.
async function submitForm(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  try {
    await page.getByTestId("entity-submit").click({ timeout: 10_000 });
  } catch (err) {
    const formGone = (await page.locator("form").count()) === 0;
    if (!formGone) throw err;
  }
}

function sweepLeftovers(): void {
  // Order matters: subtarefas before tarefas before etapas before projetos
  // before fundos -- InstantDB does not cascade-delete linked rows (same
  // discipline as every other Phase 23 spec's own sweepLeftovers).
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

test.beforeAll(() => {
  sweepLeftovers();
});

test.afterAll(() => {
  sweepLeftovers();
});

test.describe("Phase 23 Plan 06: Projeto dialog (depth-2 launch point) + remaining ProjectStrips wiring + subtarefas query fix", () => {
  let fundoId = "";
  let fundoNome = "";
  let projetoId = "";
  let projetoNome = "";

  // etapaId holds 5 tarefas, exactly one with an all-concluida subtarefa --
  // proves progressoEtapa reads "1/5" (not "0/5") once dashboardQuery.ts's
  // subtarefas fix lands.
  let etapaId = "";
  let etapaNome = "";
  let tarefaComSubId = "";
  let tarefaComSubTitulo = "";
  const tarefaOutrasTitulos: string[] = [];

  // A second etapa with zero tarefas -- the "+ tarefa" test target, so the
  // created tarefa is unambiguously the column's only card afterward.
  let etapaVaziaId = "";
  let etapaVaziaNome = "";

  let novaTarefaId = "";

  test.beforeAll(() => {
    fundoNome = uniqueName("fundo");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23J")]),
      ) as { id: string }
    ).id;

    projetoNome = uniqueName("projeto");
    projetoId = (
      JSON.parse(
        apolloCli([
          "projeto",
          "criar",
          "--nome",
          projetoNome,
          "--status",
          "ativo",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    etapaNome = uniqueName("etapa-cheia");
    etapaId = (
      JSON.parse(
        apolloCli([
          "etapa",
          "criar",
          "--nome",
          etapaNome,
          "--ordem",
          "1",
          "--status",
          "ativo",
          "--projeto-id",
          projetoId,
        ]),
      ) as { id: string }
    ).id;

    etapaVaziaNome = uniqueName("etapa-vazia");
    etapaVaziaId = (
      JSON.parse(
        apolloCli([
          "etapa",
          "criar",
          "--nome",
          etapaVaziaNome,
          "--ordem",
          "2",
          "--status",
          "ativo",
          "--projeto-id",
          projetoId,
        ]),
      ) as { id: string }
    ).id;

    // 5 tarefas in etapaId. The first gets one all-concluida subtarefa (the
    // ONLY one of the 5 that counts as "feita" per tarefaConcluida's own
    // rule -- a tarefa with zero subtarefas never counts as done); the other
    // 4 have no subtarefas at all, so progressoEtapa must read exactly 1/5.
    tarefaComSubTitulo = uniqueName("tarefa-com-sub");
    tarefaComSubId = (
      JSON.parse(
        apolloCli([
          "tarefa",
          "criar",
          "--titulo",
          tarefaComSubTitulo,
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--data-prevista",
          "2030-01-01",
          "--etapa-id",
          etapaId,
        ]),
      ) as { id: string }
    ).id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub-concluida"),
      "--ordem",
      "1",
      "--concluida",
      "--tarefa-id",
      tarefaComSubId,
    ]);

    for (let i = 0; i < 4; i++) {
      const titulo = uniqueName(`tarefa-sem-sub-${i}`);
      tarefaOutrasTitulos.push(titulo);
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        titulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        "2030-01-01",
        "--etapa-id",
        etapaId,
      ]);
    }
  });

  test.afterAll(() => {
    tryDelete("tarefa", tarefaComSubId);
    tryDelete("tarefa", novaTarefaId);
    tryDelete("etapa", etapaId);
    tryDelete("etapa", etapaVaziaId);
    tryDelete("projeto", projetoId);
    tryDelete("fundo", fundoId);
    sweepLeftovers();
  });

  test('(a) project-strip-nome opens the Projeto dialog (L) with an unbounded kanban -- 5 cards, no cap, unlike the Dashboard strip\'s own 3-card+"+2" rendering for the same etapa visible simultaneously underneath', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // The Dashboard strip itself caps at 3 cards + "+2 tarefas" for this
    // 5-tarefa etapa.
    const stripColumn = strip.locator(
      `[data-testid="project-strip-column"][data-eid="${etapaId}"]`,
    );
    await expect(stripColumn.getByTestId("project-strip-card")).toHaveCount(3);
    await expect(stripColumn.getByTestId("project-strip-card-overflow")).toHaveText("+2 tarefas");

    await strip.getByTestId("project-strip-nome").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(dialog).toContainText(projetoNome);

    const dialogColumn = dialog.locator(
      `[data-testid="project-dialog-column"][data-eid="${etapaId}"]`,
    );
    await expect(dialogColumn).toBeVisible();
    await expect(dialogColumn.getByTestId("project-dialog-card")).toHaveCount(5);

    // No cap, no "+N" text anywhere inside the dialog.
    const dialogText = await dialog.innerText();
    expect(dialogText).not.toMatch(/\+\d+\s+tarefas/);

    // The Dashboard strip's own 3-card+"+2" rendering is still visible on
    // the page, simultaneously, beneath the dialog -- proving the dialog's
    // unbounded view is genuinely a different rendering, not a mutation of
    // the strip's own capped one.
    await expect(stripColumn.getByTestId("project-strip-card-overflow")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(b) the query-completeness fix: project-dialog-column-header shows 1/5 (not 0/5), and ProjectStrips' own project-strip-column-header ALSO now shows 1/5 for the same etapa", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // Direct proof on the pre-existing, page-level, not-inside-any-dialog
    // ProjectStrips surface -- this benefits from the SAME one-line
    // dashboardQuery.ts widening, with zero edits to ProjectStrips.svelte's
    // own progressoEtapa call.
    const stripColumn = strip.locator(
      `[data-testid="project-strip-column"][data-eid="${etapaId}"]`,
    );
    await expect(stripColumn.getByTestId("project-strip-column-header")).toContainText("1/5");

    await strip.getByTestId("project-strip-nome").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const dialogHeader = dialog.locator(
      `[data-testid="project-dialog-column-header"][data-eid="${etapaId}"]`,
    );
    await expect(dialogHeader).toContainText("1/5");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(c) project-dialog-add-tarefa creates a real tarefa immediately linked to the clicked column's exact etapa (verified via the CLI)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const novaTarefaTitulo = uniqueName("nova-tarefa");

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await strip.getByTestId("project-strip-nome").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const vaziaColumn = dialog.locator(
      `[data-testid="project-dialog-column"][data-eid="${etapaVaziaId}"]`,
    );
    await expect(vaziaColumn).toBeVisible();
    await vaziaColumn.getByTestId("project-dialog-add-tarefa").click();

    await expect(page.getByTestId("field-titulo")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    // The etapa link select is pre-filled to the clicked column's own etapa,
    // per this component's live-`$state` `presetLinks` read.
    await expect(page.getByTestId("link-etapa")).toHaveText(etapaVaziaNome, {
      timeout: RESYNC_TIMEOUT,
    });

    await page.getByTestId("field-titulo").fill(novaTarefaTitulo);
    await selectByText(page, "field-tipoPrazo", "soft");
    await page.getByTestId("field-status").fill("pendente");
    await submitForm(page);

    // CLI proof: the new tarefa's `etapa` link resolves to exactly the
    // clicked column's etapa id.
    await page.waitForTimeout(500);
    const tarefasDaEtapaVazia = JSON.parse(
      apolloCli(["tarefa", "listar", "--etapa-id", etapaVaziaId]),
    ) as { id: string; titulo: string }[];
    const created = tarefasDaEtapaVazia.find((t) => t.titulo === novaTarefaTitulo);
    expect(created).toBeTruthy();
    novaTarefaId = created?.id ?? "";
  });

  test("(d) project-dialog-column-header opens the Etapa dialog as depth 2 -- exactly one Dialog.Content, breadcrumb reads the projeto's nome, no third level reachable", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await strip.getByTestId("project-strip-nome").click();

    const projetoDialog = page.getByRole("dialog");
    await expect(projetoDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(projetoDialog).toHaveClass(/sm:max-w-\[90vw\]/);

    const columnHeader = projetoDialog.locator(
      `[data-testid="project-dialog-column-header"][data-eid="${etapaId}"]`,
    );
    await columnHeader.click();

    // Never two simultaneously-open Dialog.Content instances -- the Projeto
    // dialog is swapped out, not stacked underneath a second one.
    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const etapaDialog = page.getByRole("dialog");
    await expect(etapaDialog).toHaveClass(/sm:max-w-3xl/);
    await expect(etapaDialog).not.toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(etapaDialog).toContainText(etapaNome);

    const breadcrumb = etapaDialog.getByTestId("focus-dialog-breadcrumb");
    await expect(breadcrumb).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(breadcrumb).toContainText(projetoNome);

    // No third level reachable: the Etapa dialog's own task rows are plain,
    // non-button rows.
    await expect(etapaDialog.getByTestId("etapa-dialog-tarefas").locator("button")).toHaveCount(0);

    await breadcrumb.click();

    // Back to the Projeto dialog -- still open, same kanban visible, still
    // exactly one Dialog.Content.
    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const backToProjeto = page.getByRole("dialog");
    await expect(backToProjeto).toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(backToProjeto.getByTestId("project-dialog-kanban")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(e) project-dialog-card opens the Tarefa dialog as depth 2 with identical breadcrumb behavior", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await strip.getByTestId("project-strip-nome").click();

    const projetoDialog = page.getByRole("dialog");
    await expect(projetoDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = projetoDialog.locator(
      `[data-testid="project-dialog-card"][data-eid="${tarefaComSubId}"]`,
    );
    await card.click();

    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const tarefaDialog = page.getByRole("dialog");
    await expect(tarefaDialog).toHaveClass(/sm:max-w-md/);
    await expect(tarefaDialog).toContainText(tarefaComSubTitulo);

    const breadcrumb = tarefaDialog.getByTestId("focus-dialog-breadcrumb");
    await expect(breadcrumb).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(breadcrumb).toContainText(projetoNome);

    await breadcrumb.click();

    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    await expect(page.getByRole("dialog")).toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(page.getByRole("dialog").getByTestId("project-dialog-kanban")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(f) on the page, outside any dialog, project-strip-nome/-column-header/-card are all real <button>s and each opens its correct dialog kind directly at depth 1", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const nome = strip.getByTestId("project-strip-nome");
    expect(await nome.evaluate((el) => el.tagName)).toBe("BUTTON");
    await nome.click();
    const projetoDialog = page.getByRole("dialog");
    await expect(projetoDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(projetoDialog).toHaveClass(/sm:max-w-\[90vw\]/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    const stripColumn = strip.locator(
      `[data-testid="project-strip-column"][data-eid="${etapaId}"]`,
    );
    const columnHeader = stripColumn.getByTestId("project-strip-column-header");
    expect(await columnHeader.evaluate((el) => el.tagName)).toBe("BUTTON");
    await columnHeader.click();
    const etapaDialog = page.getByRole("dialog");
    await expect(etapaDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(etapaDialog).toHaveClass(/sm:max-w-3xl/);
    // Depth 1: no breadcrumb, since this was opened directly from the page,
    // never via the Projeto dialog.
    await expect(etapaDialog.getByTestId("focus-dialog-breadcrumb")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    const card = stripColumn.getByTestId("project-strip-card").first();
    expect(await card.evaluate((el) => el.tagName)).toBe("BUTTON");
    await card.click();
    const tarefaDialog = page.getByRole("dialog");
    await expect(tarefaDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(tarefaDialog).toHaveClass(/sm:max-w-md/);
    await expect(tarefaDialog.getByTestId("focus-dialog-breadcrumb")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });
});
