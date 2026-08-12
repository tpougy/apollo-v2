import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { semanaUtil } from "../src/lib/dashboard/derive.ts";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring every other Phase 23 spec's
// established CLI-fixture/sweep-leftovers pattern.
//
// This is Plan 23-07's own consolidated completeness net -- the phase's final
// gate. It does NOT re-derive the narrower per-dialog content proofs each of
// Plans 23-01..23-06's own specs already own (context line format, editar/
// ver-pagina wiring, empty states, etc.) -- it asserts, in ONE run, against
// the SAME testids every prior plan already wired: (a) every one of the 16
// inventoried click targets is a real, keyboard-accessible <button>, (b) the
// depth-cap-2 swap-in-place invariant holds for both first-level launch
// points (Projeto and Dia), and (c) the ProjetosSection.svelte nested
// <button>-in-<button> conversion (Plan 23-03's own documented, deliberate
// design choice) is genuinely Tab-reachable/keyboard-activatable/
// stopPropagation-correct in a live browser, not just structurally plausible.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase23-e2e-";
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

function sweepLeftovers(): void {
  // Order matters: subtarefas before tarefas before etapas before projetos
  // before rotina templates before tickets before fundos -- InstantDB does
  // not cascade-delete linked rows (same discipline as every other Phase 23
  // spec's own sweepLeftovers).
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
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDelete("rotina template", record.id);
  }
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeSemana(): { dias: string[]; sabado: string; domingo: string } {
  return semanaUtil(hojeIso());
}

// -----------------------------------------------------------------------
// Exhaustive Inventory (DLG-02) -- the original 14-item inventory
// (23-RESEARCH.md) plus the 2 additive ProjetosSection.svelte list-view
// targets from the resolved wiring-scope decision (etapa-row-abrir,
// etapa-tarefa-row-abrir), totaling 16. `reachVia` documents which of the
// four navigation contexts below the target requires before it exists in
// the DOM: "dashboard" (visible on "/" with no extra toggle), "weekend"
// (requires opening the WeekCalendar's sáb/dom Popover first),
// "projetos-kanban" (requires Projetos > select project > "kanban" toggle),
// "projetos-lista" (requires Projetos > select project, default list view).
// -----------------------------------------------------------------------
const INVENTORY: { testid: string; dialogTestidHint: string; reachVia: string }[] = [
  { testid: "dash-week-day-header", dialogTestidHint: "day-dialog-items", reachVia: "dashboard" },
  { testid: "dash-week-item", dialogTestidHint: "focus-dialog-editar", reachVia: "dashboard" },
  {
    testid: "dash-weekend-day-header",
    dialogTestidHint: "day-dialog-items",
    reachVia: "weekend",
  },
  {
    testid: "dash-weekend-popover-item",
    dialogTestidHint: "focus-dialog-editar",
    reachVia: "weekend",
  },
  { testid: "dash-ticket-card", dialogTestidHint: "focus-dialog-editar", reachVia: "dashboard" },
  {
    testid: "project-strip-nome",
    dialogTestidHint: "project-dialog-kanban",
    reachVia: "dashboard",
  },
  {
    testid: "project-strip-fundo-badge",
    dialogTestidHint: "fundo-dialog-rotinas",
    reachVia: "dashboard",
  },
  {
    testid: "project-strip-column-header",
    dialogTestidHint: "etapa-dialog-tarefas",
    reachVia: "dashboard",
  },
  {
    testid: "project-strip-card",
    dialogTestidHint: "task-dialog-subtarefas",
    reachVia: "dashboard",
  },
  {
    testid: "rotinas-fundo-titulo",
    dialogTestidHint: "fundo-dialog-rotinas",
    reachVia: "dashboard",
  },
  { testid: "rotinas-row", dialogTestidHint: "focus-dialog-editar", reachVia: "dashboard" },
  { testid: "dash-heatmap-cell", dialogTestidHint: "day-dialog-items", reachVia: "dashboard" },
  {
    testid: "etapa-kanban-column",
    dialogTestidHint: "etapa-dialog-tarefas",
    reachVia: "projetos-kanban",
  },
  {
    testid: "etapa-kanban-card",
    dialogTestidHint: "task-dialog-subtarefas",
    reachVia: "projetos-kanban",
  },
  {
    testid: "etapa-row-abrir",
    dialogTestidHint: "etapa-dialog-tarefas",
    reachVia: "projetos-lista",
  },
  {
    testid: "etapa-tarefa-row-abrir",
    dialogTestidHint: "task-dialog-subtarefas",
    reachVia: "projetos-lista",
  },
];

test.beforeAll(() => {
  sweepLeftovers();
});

test.afterAll(() => {
  sweepLeftovers();
});

test.describe("Phase 23 Plan 07: Consolidated button-inventory + keyboard-accessibility + depth-cap-2 sweep", () => {
  const semana = computeSemana();

  expect(INVENTORY.length).toBe(16);

  let fundoId = "";
  let fundoNome = "";

  let projetoId = "";
  let projetoNome = "";

  let etapaComTarefasId = "";
  let etapaComTarefasNome = "";
  let etapaVaziaId = "";

  let tarefaAId = "";
  let tarefaATitulo = "";
  let tarefaBId = "";
  let tarefaBTitulo = "";

  let ticketId = "";
  let ticketTitulo = "";

  let templateId = "";
  let templateNome = "";
  let rotinaWeekdayId = "";
  let rotinaWeekendId = "";

  test.beforeAll(async () => {
    fundoNome = uniqueName("fundo");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23Z")]),
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

    etapaComTarefasNome = uniqueName("etapa-cheia");
    etapaComTarefasId = (
      JSON.parse(
        apolloCli([
          "etapa",
          "criar",
          "--nome",
          etapaComTarefasNome,
          "--ordem",
          "1",
          "--status",
          "ativo",
          "--projeto-id",
          projetoId,
        ]),
      ) as { id: string }
    ).id;

    const etapaVaziaNome = uniqueName("etapa-vazia");
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

    tarefaATitulo = uniqueName("tarefa-a");
    tarefaAId = (
      JSON.parse(
        apolloCli([
          "tarefa",
          "criar",
          "--titulo",
          tarefaATitulo,
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--data-prevista",
          "2030-06-15",
          "--etapa-id",
          etapaComTarefasId,
        ]),
      ) as { id: string }
    ).id;

    tarefaBTitulo = uniqueName("tarefa-b");
    tarefaBId = (
      JSON.parse(
        apolloCli([
          "tarefa",
          "criar",
          "--titulo",
          tarefaBTitulo,
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--data-prevista",
          "2030-06-15",
          "--etapa-id",
          etapaComTarefasId,
        ]),
      ) as { id: string }
    ).id;

    // Ticket dated Monday of the current week -- covers dash-ticket-card
    // (queue, date-agnostic) AND dash-week-item (tipo=ticket) simultaneously.
    ticketTitulo = uniqueName("ticket");
    ticketId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          ticketTitulo,
          "--corpo",
          "corpo do ticket de inventario",
          "--remetente",
          "inventario@example.com",
          "--data-recebimento",
          "2026-01-01",
          "--tipo-prazo",
          "hard",
          "--status",
          "pendente",
          "--data-prevista",
          semana.dias[0],
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    templateNome = uniqueName("template");
    templateId = (
      JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          templateNome,
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "mes-corrente",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    // Tuesday (weekday, week-scoped -- feeds rotinas-fundo-titulo/rotinas-row
    // and dash-week-item tipo=rotina).
    rotinaWeekdayId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-weekday"),
        dataPrevista: `${semana.dias[1]}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    // Saturday -- feeds dash-weekend-day-header/dash-weekend-popover-item.
    rotinaWeekendId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-weekend"),
        dataPrevista: `${semana.sabado}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );
  });

  test.afterAll(async () => {
    if (rotinaWeekdayId) await deleteInstance(rotinaWeekdayId);
    if (rotinaWeekendId) await deleteInstance(rotinaWeekendId);
    tryDelete("tarefa", tarefaAId);
    tryDelete("tarefa", tarefaBId);
    tryDelete("etapa", etapaComTarefasId);
    tryDelete("etapa", etapaVaziaId);
    tryDelete("projeto", projetoId);
    tryDelete("rotina template", templateId);
    tryDelete("ticket", ticketId);
    tryDelete("fundo", fundoId);
    sweepLeftovers();
  });

  async function gotoDashboard(page: Page): Promise<void> {
    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  }

  async function gotoProjeto(page: Page): Promise<void> {
    await page.goto("/");
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").filter({ hasText: projetoNome }).click();
    await expect(page.getByTestId("project-etapas-list")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  }

  async function gotoProjetoKanban(page: Page): Promise<void> {
    await gotoProjeto(page);
    await page.getByTestId("etapas-view-kanban").click();
    await expect(page.getByTestId("etapas-kanban")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  }

  function kanbanColumn(page: Page) {
    return page.getByTestId("etapa-kanban-column").filter({ hasText: etapaComTarefasNome });
  }

  async function activeElementAttrs(
    page: Page,
  ): Promise<{ testid: string | null; eid: string | null }> {
    return page.evaluate(() => ({
      testid: document.activeElement?.getAttribute("data-testid") ?? null,
      eid: document.activeElement?.getAttribute("data-eid") ?? null,
    }));
  }

  test("(a) all 16 inventoried targets resolve to a real <button> element", async ({ page }) => {
    test.setTimeout(90_000);

    // --- reachVia: dashboard (10 targets) ---
    await gotoDashboard(page);

    const dayHeader = page.locator(
      `[data-testid="dash-week-day-header"][data-eid="${semana.dias[0]}"]`,
    );
    await expect(dayHeader).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await dayHeader.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const weekItem = page.locator(`[data-testid="dash-week-item"][data-eid="${ticketId}"]`);
    await expect(weekItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await weekItem.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const ticketCard = page.getByTestId("dash-ticket-card").filter({ hasText: ticketTitulo });
    await expect(ticketCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await ticketCard.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const nome = strip.getByTestId("project-strip-nome");
    expect(await nome.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const fundoBadge = strip.getByTestId("project-strip-fundo-badge");
    expect(await fundoBadge.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const stripColumn = strip.locator(
      `[data-testid="project-strip-column"][data-eid="${etapaComTarefasId}"]`,
    );
    const columnHeader = stripColumn.getByTestId("project-strip-column-header");
    expect(await columnHeader.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const stripCard = stripColumn.getByTestId("project-strip-card").first();
    expect(await stripCard.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const fundoCard = page.locator(`[data-testid="rotinas-fundo-card"][data-eid="${fundoId}"]`);
    await expect(fundoCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const rotinasTitulo = fundoCard.getByTestId("rotinas-fundo-titulo");
    expect(await rotinasTitulo.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const rotinasRow = fundoCard.locator(
      `[data-testid="rotinas-row"][data-eid="${rotinaWeekdayId}"]`,
    );
    await expect(rotinasRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await rotinasRow.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const heatmapCell = page.locator(`[data-testid="dash-heatmap-cell"][data-eid="${hojeIso()}"]`);
    await expect(heatmapCell).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await heatmapCell.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    // --- reachVia: weekend (2 targets -- open the sáb/dom popover first) ---
    await page.getByTestId("dash-weekend-chip").click();
    const popover = page.getByTestId("dash-weekend-popover");
    await expect(popover).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const weekendDayHeader = popover.locator(
      `[data-testid="dash-weekend-day-header"][data-eid="${semana.sabado}"]`,
    );
    expect(await weekendDayHeader.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const weekendItem = popover.locator(
      `[data-testid="dash-weekend-popover-item"][data-eid="${rotinaWeekendId}"]`,
    );
    await expect(weekendItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await weekendItem.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    // --- reachVia: projetos-kanban (2 targets -- etapas ▾ kanban toggle) ---
    await gotoProjetoKanban(page);

    const column = kanbanColumn(page);
    await expect(column).toBeVisible({ timeout: RESYNC_TIMEOUT });
    expect(await column.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    const card = column.getByTestId("etapa-kanban-card").filter({ hasText: tarefaATitulo });
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    // --- reachVia: projetos-lista (2 targets -- default list view) ---
    await gotoProjeto(page);

    const etapaRow = page.getByTestId("etapa-row").filter({ hasText: etapaComTarefasNome });
    await expect(etapaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const abrirButton = page
      .locator(`[data-testid="etapa-row-abrir"][aria-label="Abrir ${etapaComTarefasNome}"]`)
      .first();
    await expect(abrirButton).toBeVisible();
    expect(await abrirButton.evaluate((el) => el.tagName.toLowerCase())).toBe("button");

    await etapaRow.click();
    const tarefaRow = page
      .getByTestId("etapa-tarefas-list")
      .getByTestId("etapa-tarefa-row")
      .filter({ hasText: tarefaBTitulo });
    await expect(tarefaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const tarefaRowAbrir = tarefaRow.getByTestId("etapa-tarefa-row-abrir");
    expect(await tarefaRowAbrir.evaluate((el) => el.tagName.toLowerCase())).toBe("button");
  });

  test("(b) keyboard reachability and activation across all 5 host files", async ({ page }) => {
    test.setTimeout(90_000);

    // 1. TicketQueue.svelte -- dash-ticket-card, activated with Space.
    await gotoDashboard(page);
    const ticketCard = page.getByTestId("dash-ticket-card").filter({ hasText: ticketTitulo });
    await ticketCard.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("dash-ticket-card");
      expect(attrs.eid).toBe(ticketId);
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Space");
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toContainText(ticketTitulo);
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // 2. WeekCalendar.svelte -- dash-week-day-header, activated with Enter.
    await gotoDashboard(page);
    const dayHeader = page.locator(
      `[data-testid="dash-week-day-header"][data-eid="${semana.dias[0]}"]`,
    );
    await dayHeader.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("dash-week-day-header");
      expect(attrs.eid).toBe(semana.dias[0]);
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog.getByTestId("day-dialog-items")).toContainText(ticketTitulo);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // 3. ProjectStrips.svelte -- project-strip-nome, activated with Enter.
    await gotoDashboard(page);
    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    const nome = strip.getByTestId("project-strip-nome");
    await nome.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("project-strip-nome");
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(dialog).toContainText(projetoNome);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // 4. RoutinesByFundo.svelte -- rotinas-fundo-titulo, activated with Enter
    //    (the seeded fundo's REAL card, never the "Sem fundo vinculado" one,
    //    which is a documented no-op per 23-05-SUMMARY.md).
    await gotoDashboard(page);
    const fundoCard = page.locator(`[data-testid="rotinas-fundo-card"][data-eid="${fundoId}"]`);
    const rotinasTitulo = fundoCard.getByTestId("rotinas-fundo-titulo");
    await rotinasTitulo.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("rotinas-fundo-titulo");
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(fundoNome);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // 5. ProjetosSection.svelte -- etapa-kanban-column, activated with Enter.
    await gotoProjetoKanban(page);
    const column = kanbanColumn(page);
    await column.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("etapa-kanban-column");
      expect(attrs.eid).toBe(etapaComTarefasId);
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(etapaComTarefasNome);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(c) never two simultaneously visible Dialog.Content, across both depth-2 launch points", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // --- Launch point 1: Projeto -> Etapa -> back -> Tarefa -> back ---
    await gotoDashboard(page);
    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await strip.getByTestId("project-strip-nome").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });

    const dialogColumnHeader = dialog.locator(
      `[data-testid="project-dialog-column-header"][data-eid="${etapaComTarefasId}"]`,
    );
    await dialogColumnHeader.click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const etapaDialog = page.getByRole("dialog");
    await expect(etapaDialog).toHaveClass(/sm:max-w-3xl/);
    await expect(etapaDialog).toContainText(etapaComTarefasNome);
    const breadcrumbToProjeto = etapaDialog.getByTestId("focus-dialog-breadcrumb");
    await expect(breadcrumbToProjeto).toContainText(projetoNome);
    await breadcrumbToProjeto.click();

    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    let backToProjeto = page.getByRole("dialog");
    await expect(backToProjeto).toHaveClass(/sm:max-w-\[90vw\]/);

    const dialogCard = backToProjeto.locator(
      `[data-testid="project-dialog-card"][data-eid="${tarefaAId}"]`,
    );
    await dialogCard.click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const tarefaDialog = page.getByRole("dialog");
    await expect(tarefaDialog).toHaveClass(/sm:max-w-md/);
    await expect(tarefaDialog).toContainText(tarefaATitulo);
    const breadcrumbToProjeto2 = tarefaDialog.getByTestId("focus-dialog-breadcrumb");
    await expect(breadcrumbToProjeto2).toContainText(projetoNome);
    await breadcrumbToProjeto2.click();

    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    backToProjeto = page.getByRole("dialog");
    await expect(backToProjeto).toHaveClass(/sm:max-w-\[90vw\]/);
    await expect(backToProjeto.getByTestId("project-dialog-kanban")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // --- Launch point 2: Dia -> item -> back (weekday, via the week calendar) ---
    await gotoDashboard(page);
    const dayHeader = page.locator(
      `[data-testid="dash-week-day-header"][data-eid="${semana.dias[0]}"]`,
    );
    await dayHeader.click();

    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const diaDialog = page.getByRole("dialog");
    await expect(diaDialog.getByTestId("day-dialog-items")).toContainText(ticketTitulo);

    const dayItem = diaDialog.locator(`[data-testid="day-dialog-item"][data-eid="${ticketId}"]`);
    await dayItem.click();

    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const ticketDialog = page.getByRole("dialog");
    await expect(ticketDialog).toContainText(ticketTitulo);
    await expect(ticketDialog.getByTestId("day-dialog-items")).toHaveCount(0);

    const breadcrumbToDia = ticketDialog.getByTestId("focus-dialog-breadcrumb");
    await expect(breadcrumbToDia).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await breadcrumbToDia.click();

    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const backToDia = page.getByRole("dialog");
    await expect(backToDia.getByTestId("day-dialog-items")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(d) the original div-based etapa-kanban-column/etapa-kanban-card selectors now match zero elements", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await gotoProjetoKanban(page);

    // The elements genuinely exist (proven by the button-typed selector
    // resolving to >0), but a selector still typed for the ORIGINAL,
    // pre-Plan-23-03 <div>-based markup must find nothing at all -- proving
    // the conversion to <button> is total, not a partial/duplicated markup
    // situation.
    await expect(page.getByTestId("etapa-kanban-column")).not.toHaveCount(0);
    await expect(page.getByTestId("etapa-kanban-card")).not.toHaveCount(0);

    await expect(page.locator('div[data-testid="etapa-kanban-column"]')).toHaveCount(0);
    await expect(page.locator('div[data-testid="etapa-kanban-card"]')).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // Additional verification requested for this plan: re-examine 23-03's
  // documented literal nested <button>-in-<button> choice for
  // etapa-kanban-column/etapa-kanban-card. 23-03-SUMMARY.md's own reasoning:
  // this app (web/index.html) is a plain client-rendered Vite SPA with an
  // empty `<div id="app">` shell and no SSR route (confirmed again here:
  // web/src/main.ts calls Svelte 5's `mount()` against that empty div, never
  // any string-based `render()`/hydration path) -- so the HTML tokenizer's
  // nested-<button> auto-close-on-parse quirk (a PARSER behavior) never
  // fires, since Svelte constructs the DOM via `createElement`/`appendChild`
  // calls, never by feeding an HTML string through `innerHTML` or the
  // browser's HTML parser. This test proves, live, in a real browser via
  // Playwright, that both nested buttons are genuinely: (1) structurally
  // both present in the DOM as real <button> descendants of one another,
  // (2) independently reachable via actual Tab-key traversal (not just
  // `.focus()`-callable), and (3) independently keyboard-activatable with
  // `stopPropagation` correctly preventing the outer column's handler from
  // ALSO firing when the inner card is keyboard-activated (not just
  // mouse-clicked, which 23-03's own spec already covered).
  // -------------------------------------------------------------------
  test("(e) etapa-kanban-column/etapa-kanban-card nested-button structure is genuinely Tab-reachable and independently keyboard-activatable (no-SSR reasoning verification)", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await gotoProjetoKanban(page);

    const column = kanbanColumn(page);
    const card = column.getByTestId("etapa-kanban-card").filter({ hasText: tarefaATitulo });

    // (1) Structural nesting: the card is a genuine DOM descendant of the
    // column -- both real <button> elements, confirmed via `closest()`.
    expect(await column.evaluate((el) => el.tagName.toLowerCase())).toBe("button");
    expect(await card.evaluate((el) => el.tagName.toLowerCase())).toBe("button");
    const cardIsDescendantOfColumn = await card.evaluate((cardEl, columnTestId) => {
      const columnEl = cardEl.closest(`[data-testid="${columnTestId}"]`);
      return columnEl?.contains(cardEl) && columnEl !== cardEl;
    }, "etapa-kanban-column");
    expect(cardIsDescendantOfColumn).toBe(true);

    // (2) Real Tab-key traversal (not `.focus()`) reaches the column first,
    // then the card immediately after -- proving the browser's natural tab
    // order genuinely includes both nested interactive elements in source
    // order, exactly as a sighted keyboard-only user would experience it.
    await page.getByTestId("etapas-view-kanban").focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("etapas-view-kanban");
    }).toPass({ timeout: RESYNC_TIMEOUT });

    await page.keyboard.press("Tab");
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("etapa-kanban-column");
      expect(attrs.eid).toBe(etapaComTarefasId);
    }).toPass({ timeout: RESYNC_TIMEOUT });

    await page.keyboard.press("Tab");
    const afterColumnTab = await page.evaluate((columnTestId) => {
      const active = document.activeElement;
      const parentColumn = active?.closest(`[data-testid="${columnTestId}"]`);
      return {
        testid: active?.getAttribute("data-testid") ?? null,
        parentEid: parentColumn?.getAttribute("data-eid") ?? null,
      };
    }, "etapa-kanban-column");
    expect(afterColumnTab.testid).toBe("etapa-kanban-card");
    expect(afterColumnTab.parentEid).toBe(etapaComTarefasId);

    // (3a) Keyboard-activating the OUTER column (via direct .focus(), per
    // the plan's own permitted alternative to a full Tab crawl) opens the
    // Etapa dialog.
    await column.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("etapa-kanban-column");
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).not.toHaveClass(/sm:max-w-md/);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // (3b) Keyboard-activating the INNER card opens the Tarefa dialog
    // instead -- NEVER the Etapa dialog, and NEVER both simultaneously --
    // proving `stopPropagation` inside the card's onclick handler correctly
    // suppresses the outer column's handler even for a keyboard-synthesized
    // click event (Enter on a focused native <button> dispatches a real
    // "click" event that bubbles exactly like a mouse click would).
    await gotoProjetoKanban(page);
    const cardAgain = kanbanColumn(page)
      .getByTestId("etapa-kanban-card")
      .filter({ hasText: tarefaATitulo });
    await cardAgain.focus();
    await expect(async () => {
      const attrs = await activeElementAttrs(page);
      expect(attrs.testid).toBe("etapa-kanban-card");
      expect(attrs.eid).toBe(tarefaAId);
    }).toPass({ timeout: RESYNC_TIMEOUT });
    await page.keyboard.press("Enter");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(dialog).not.toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(tarefaATitulo);
    // Exactly one dialog -- the column's Etapa dialog never ALSO opened.
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // (3c) Mouse click on the card, freshly re-verified here as this plan's
    // own regression net (not just relying on 23-03's own spec): same
    // independence.
    await gotoProjetoKanban(page);
    const cardMouse = kanbanColumn(page)
      .getByTestId("etapa-kanban-card")
      .filter({ hasText: tarefaATitulo });
    await cardMouse.click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });
});
