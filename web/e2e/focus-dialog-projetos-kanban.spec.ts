import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring focus-dialog-ticket.spec.ts's
// (Plan 23-01) established CLI-fixture/sweep-leftovers pattern.
//
// This file proves Plan 23-03's own scope: TaskDialog.svelte/EtapaDialog.svelte
// wired into BOTH ProjetosSection.svelte's "etapas ▾ kanban" toggle
// (etapa-kanban-column/etapa-kanban-card, converted from plain <div>s into
// real <button>s -- Pitfall 3) AND the default list view (the additive
// etapa-row-abrir/etapa-tarefa-row-abrir targets, per the resolved
// ProjetosSection-wiring-scope decision) -- with zero regression to the
// pre-existing NEST-02/NEST-03/NEST-05 assertions already covered by
// projetos-section.spec.ts (run as a separate, unedited regression gate).

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
    apolloCli([group, "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

function sweepLeftovers(): void {
  // Order matters: subtarefas before tarefas before etapas before projetos
  // before fundos -- InstantDB does not cascade-delete linked rows (same
  // discipline as projetos-section.spec.ts's own sweepLeftovers).
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

test.describe("Phase 23 Plan 03: Etapa/Tarefa focus dialogs in ProjetosSection", () => {
  let fundoId = "";
  let fundoNome = "";
  let projetoId = "";
  let projetoNome = "";
  let etapaId = "";
  let etapaNome = "";
  let tarefaAtrasadaId = "";
  let tarefaAtrasadaTitulo = "";
  let tarefaFuturaId = "";
  let tarefaFuturaTitulo = "";
  const tarefaAtrasadaCompetencia = "2026-01";
  const tarefaFuturaCompetencia = "2026-06";

  test.beforeAll(() => {
    sweepLeftovers();

    fundoNome = uniqueName("fundo");
    const fundoCreated = JSON.parse(
      apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23K")]),
    ) as { id: string };
    fundoId = fundoCreated.id;

    projetoNome = uniqueName("projeto");
    const projetoCreated = JSON.parse(
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
    ) as { id: string };
    projetoId = projetoCreated.id;

    etapaNome = uniqueName("etapa");
    const etapaCreated = JSON.parse(
      apolloCli([
        "etapa",
        "criar",
        "--nome",
        etapaNome,
        "--ordem",
        "5",
        "--status",
        "ativo",
        "--projeto-id",
        projetoId,
      ]),
    ) as { id: string };
    etapaId = etapaCreated.id;

    // Overdue, hard-deadline tarefa -- not concluida (its one subtarefa is
    // --nao-concluida), so vencido() reads true.
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
        "--competencia",
        tarefaAtrasadaCompetencia,
        "--etapa-id",
        etapaId,
      ]),
    ) as { id: string };
    tarefaAtrasadaId = tarefaAtrasadaCreated.id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub-atrasada"),
      "--ordem",
      "1",
      "--nao-concluida",
      "--tarefa-id",
      tarefaAtrasadaId,
    ]);

    // Future, soft-deadline tarefa -- concluida subtarefa, future date, never
    // vencido regardless.
    tarefaFuturaTitulo = uniqueName("tarefa-futura");
    const tarefaFuturaCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaFuturaTitulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        "2030-01-01",
        "--competencia",
        tarefaFuturaCompetencia,
        "--etapa-id",
        etapaId,
      ]),
    ) as { id: string };
    tarefaFuturaId = tarefaFuturaCreated.id;
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      uniqueName("sub-futura"),
      "--ordem",
      "1",
      "--concluida",
      "--tarefa-id",
      tarefaFuturaId,
    ]);
  });

  test.afterAll(() => {
    tryDelete("tarefa", tarefaAtrasadaId);
    tryDelete("tarefa", tarefaFuturaId);
    tryDelete("etapa", etapaId);
    tryDelete("projeto", projetoId);
    tryDelete("fundo", fundoId);
    sweepLeftovers();
  });

  async function gotoEtapaKanban(page: import("@playwright/test").Page): Promise<void> {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();
    await expect(page.getByTestId("project-etapas-list")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await page.getByTestId("etapas-view-kanban").click();
    await expect(page.getByTestId("etapas-kanban")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  }

  // `etapa-kanban-column`'s own <button> wraps its header (ordem/nome/
  // feitas-total) AND every one of its `etapa-kanban-card` <button>s
  // stacked below it -- a real, deliberate button-in-button nesting this
  // plan's own action text calls for (see 23-03-SUMMARY.md's documented
  // design note). A plain `.click()` on the column locator targets the
  // CENTER of its full bounding box, which -- once the column holds more
  // than a sliver of cards -- lands on a nested card instead of the column
  // itself. Click the header text specifically (never covered by any card)
  // to reliably exercise the column's OWN handler.
  function columnHeader(page: import("@playwright/test").Page, nome: string) {
    return page
      .getByTestId("etapa-kanban-column")
      .filter({ hasText: nome })
      .locator("span.font-mono");
  }

  test("(a) etapa-kanban-column and etapa-kanban-card both resolve to tagName === 'button'", async ({
    page,
  }) => {
    await gotoEtapaKanban(page);

    const column = page.getByTestId("etapa-kanban-column").filter({ hasText: etapaNome });
    await expect(column).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await column.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const card = column.getByTestId("etapa-kanban-card").filter({ hasText: tarefaAtrasadaTitulo });
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => el.tagName.toLowerCase())).toBe("button");
  });

  test("(b) clicking etapa-kanban-column opens the Etapa dialog at M width with nome/ordem/BOTH tarefas uncapped, correct overdue styling", async ({
    page,
  }) => {
    await gotoEtapaKanban(page);

    await columnHeader(page, etapaNome).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(etapaNome);
    await expect(dialog).toContainText("5"); // ordem

    const tarefasList = dialog.getByTestId("etapa-dialog-tarefas");
    await expect(tarefasList).toContainText(tarefaAtrasadaTitulo);
    await expect(tarefasList).toContainText(tarefaFuturaTitulo);

    const atrasadaRow = tarefasList.locator("div").filter({ hasText: tarefaAtrasadaTitulo }).first();
    await expect(atrasadaRow.locator(".text-destructive")).toBeVisible();
    const futuraRow = tarefasList.locator("div").filter({ hasText: tarefaFuturaTitulo }).first();
    await expect(futuraRow.locator(".text-destructive")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(c) clicking etapa-kanban-card opens the Tarefa dialog at S width with titulo/competencia/subtarefas and a fundo·projeto·etapa context line", async ({
    page,
  }) => {
    await gotoEtapaKanban(page);

    const column = page.getByTestId("etapa-kanban-column").filter({ hasText: etapaNome });
    const card = column.getByTestId("etapa-kanban-card").filter({ hasText: tarefaAtrasadaTitulo });
    await card.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(dialog).toContainText(tarefaAtrasadaTitulo);
    await expect(dialog).toContainText(tarefaAtrasadaCompetencia);

    const contexto = dialog.locator('[data-slot="dialog-description"]');
    await expect(contexto).toHaveText(`${fundoNome} · ${projetoNome} · ${etapaNome}`);

    const subtarefas = dialog.getByTestId("task-dialog-subtarefas");
    await expect(subtarefas).toBeVisible();
    await expect(subtarefas.locator("span")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(d) etapa-row-abrir is a real button distinct from etapa-row -- opens the Etapa dialog WITHOUT toggling the accordion", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const etapaRow = page.getByTestId("etapa-row").filter({ hasText: etapaNome });
    await expect(etapaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(etapaRow).toHaveAttribute("aria-expanded", "false");

    const abrirButton = page
      .locator(`[data-testid="etapa-row-abrir"][aria-label="Abrir ${etapaNome}"]`)
      .first();
    await expect(abrirButton).toBeVisible();
    expect(await abrirButton.evaluate((el) => el.tagName.toLowerCase())).toBe("button");
    // Distinct element from the accordion trigger itself.
    expect(await abrirButton.getAttribute("data-testid")).not.toBe(
      await etapaRow.getAttribute("data-testid"),
    );

    await abrirButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toContainText(etapaNome);

    // The accordion's own toggle state is untouched by this click.
    await expect(etapaRow).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
    await expect(etapaRow).toHaveAttribute("aria-expanded", "false");
  });

  test("(e) etapa-tarefa-row-abrir opens the Tarefa dialog for that exact tarefa; the subtarefas chip on the same row still opens SubtarefasPanel", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();

    const etapaRow = page.getByTestId("etapa-row").filter({ hasText: etapaNome });
    await expect(etapaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await etapaRow.click();

    const tarefasList = page.getByTestId("etapa-tarefas-list");
    await expect(tarefasList).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const tarefaRow = tarefasList
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaFuturaTitulo });
    await expect(tarefaRow).toBeVisible();

    await tarefaRow.getByTestId("etapa-tarefa-row-abrir").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(dialog).toContainText(tarefaFuturaTitulo);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // NEST-05's pre-existing chip behavior on the SAME row is unaffected --
    // it still opens the unrelated SubtarefasPanel, never the Tarefa dialog.
    await tarefaRow.getByTestId("etapa-tarefa-subtarefas-chip").click();
    await expect(page.getByTestId("subtarefas-panel")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("(f) focus-dialog-editar drives the real EntityScreen(etapas|tarefas) row-edit form; focus-dialog-ver-pagina returns to Projetos", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // Etapa dialog: editar.
    await gotoEtapaKanban(page);
    await columnHeader(page, etapaNome).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("focus-dialog-editar").click();
    const fieldNome = page.getByTestId("field-nome");
    await expect(fieldNome).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(fieldNome).toHaveValue(etapaNome);
    await page.getByTestId("entity-cancel").click();

    // Etapa dialog: ver na página completa.
    await expect(page.getByTestId("focus-dialog-ver-pagina")).toBeVisible({
      timeout: RESYNC_TIMEOUT,
    });
    await page.getByTestId("focus-dialog-ver-pagina").click();
    await expect(page.getByTestId("nav-projetos")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Tarefa dialog: editar.
    await gotoEtapaKanban(page);
    const card = page
      .getByTestId("etapa-kanban-column")
      .filter({ hasText: etapaNome })
      .getByTestId("etapa-kanban-card")
      .filter({ hasText: tarefaAtrasadaTitulo });
    await card.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("focus-dialog-editar").click();
    const fieldTitulo = page.getByTestId("field-titulo");
    await expect(fieldTitulo).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(fieldTitulo).toHaveValue(tarefaAtrasadaTitulo);
    await page.getByTestId("entity-cancel").click();

    // Tarefa dialog: ver na página completa.
    await expect(page.getByTestId("focus-dialog-ver-pagina")).toBeVisible({
      timeout: RESYNC_TIMEOUT,
    });
    await page.getByTestId("focus-dialog-ver-pagina").click();
    await expect(page.getByTestId("nav-projetos")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
