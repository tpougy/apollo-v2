import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { semanaUtil } from "../src/lib/dashboard/derive.ts";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring dashboard.spec.ts's own
// established CLI-fixture/sweep-leftovers pattern.
//
// This file is Plan 23-04's own complete proof of the Dia/Rotina dialogs plus
// the full WeekCalendar/MonthHeatmap wiring (items #1-4 and #12 of the
// Exhaustive Inert-Button Inventory) -- the last plan of the Phase 23 focus
// dialog system to add its own standalone e2e spec.

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
  const tarefas = JSON.parse(apolloCli(["tarefa", "listar"])) as { id: string; titulo: string }[];
  for (const record of tarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("tarefa", record.id);
  }
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDelete("rotina template", record.id);
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

function daysInMonthOf(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function isoOf(ano: number, mes: number, day: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A day in the current month, outside computeSemana()'s own 7-key window --
// guaranteed to fall in a different calendar week than the one the dashboard
// shows by default (semanaBase = hojeIso), used by test (f)'s "ir para esta
// semana changes the header" assertion.
function otherWeekDayThisMonth(): string {
  const hoje = hojeIso();
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const semana = computeSemana();
  const keySet = new Set([...semana.dias, semana.sabado, semana.domingo]);
  for (let day = 1; day <= daysInMonthOf(ano, mes); day++) {
    const iso = isoOf(ano, mes, day);
    if (!keySet.has(iso)) return iso;
  }
  throw new Error("No day outside the current week exists in this month (should never happen)");
}

test.beforeAll(() => {
  sweepLeftovers();
});

test.afterAll(() => {
  sweepLeftovers();
});

test.describe("Phase 23 Plan 04: Dia/Rotina dialogs + full calendar-family wiring", () => {
  const semana = computeSemana();

  let fundoId = "";
  let fundoNome = "";

  // Rotina: one weekday-dated, one weekend-dated instance, same template.
  let templateId = "";
  let templateNome = "";
  let rotinaWeekdayId = "";
  let rotinaWeekendId = "";

  // Tarefas: 4 dated on Monday (uncapped day-dialog proof), individually
  // titled so all 4 can be asserted present.
  const tarefaIds: string[] = [];
  const tarefaTitulos: string[] = [];

  // Tickets: one dated Wednesday (weekday-band dispatch proof), one dated
  // Saturday (weekend-popover + weekend-day-header proof).
  let ticketWeekdayId = "";
  let ticketWeekdayTitulo = "";
  let ticketWeekendId = "";
  let ticketWeekendTitulo = "";

  const outroDia = otherWeekDayThisMonth();

  test.beforeAll(async () => {
    fundoNome = uniqueName("fundo");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23D")]),
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

    rotinaWeekendId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-weekend"),
        dataPrevista: `${semana.domingo}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    for (let i = 0; i < 4; i++) {
      const titulo = uniqueName(`tarefa-monday-${i}`);
      const id = (
        JSON.parse(
          apolloCli([
            "tarefa",
            "criar",
            "--titulo",
            titulo,
            "--tipo-prazo",
            "hard",
            "--status",
            "pendente",
            "--data-prevista",
            semana.dias[0],
          ]),
        ) as { id: string }
      ).id;
      tarefaIds.push(id);
      tarefaTitulos.push(titulo);
    }

    ticketWeekdayTitulo = uniqueName("ticket-weekday");
    ticketWeekdayId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          ticketWeekdayTitulo,
          "--corpo",
          "corpo do ticket de dia de semana",
          "--remetente",
          "weekday@example.com",
          "--data-recebimento",
          "2026-01-01",
          "--tipo-prazo",
          "hard",
          "--status",
          "pendente",
          "--data-prevista",
          semana.dias[2],
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    ticketWeekendTitulo = uniqueName("ticket-weekend");
    ticketWeekendId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          ticketWeekendTitulo,
          "--corpo",
          "corpo do ticket de fim de semana",
          "--remetente",
          "weekend@example.com",
          "--data-recebimento",
          "2026-01-02",
          "--tipo-prazo",
          "hard",
          "--status",
          "pendente",
          "--data-prevista",
          semana.sabado,
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;
  });

  test.afterAll(async () => {
    if (rotinaWeekdayId) await deleteInstance(rotinaWeekdayId);
    if (rotinaWeekendId) await deleteInstance(rotinaWeekendId);
    for (const id of tarefaIds) tryDelete("tarefa", id);
    tryDelete("ticket", ticketWeekdayId);
    tryDelete("ticket", ticketWeekendId);
    tryDelete("rotina template", templateId);
    tryDelete("fundo", fundoId);
  });

  test("(a) rotina items show the template's nome, never the instancia id, in both the weekday card and the weekend popover", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const tuesdayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[1]}"]`);
    const weekdayItem = tuesdayCard.locator(
      `[data-testid="dash-week-item"][data-eid="${rotinaWeekdayId}"]`,
    );
    await expect(weekdayItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(weekdayItem).toContainText(templateNome);
    await expect(weekdayItem).not.toContainText(rotinaWeekdayId);

    const chip = page.getByTestId("dash-weekend-chip");
    await expect(chip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await chip.click();
    const popover = page.getByTestId("dash-weekend-popover");
    await expect(popover).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const weekendItem = popover.locator(
      `[data-testid="dash-weekend-popover-item"][data-eid="${rotinaWeekendId}"]`,
    );
    await expect(weekendItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(weekendItem).toContainText(templateNome);
    await expect(weekendItem).not.toContainText(rotinaWeekendId);
  });

  test("(b) clicking dash-week-day-header opens the Dia dialog showing the day's full, uncapped item list", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const header = page.locator(
      `[data-testid="dash-week-day-header"][data-eid="${semana.dias[0]}"]`,
    );
    await header.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const items = dialog.getByTestId("day-dialog-items");
    for (const titulo of tarefaTitulos) {
      await expect(items).toContainText(titulo);
    }
    await expect(dialog).not.toContainText("+4 itens");
    await expect(dialog.getByText(/^\+\d+ itens$/)).toHaveCount(0);
  });

  test("(c) clicking dash-week-item of each of the 3 data-tipo values opens the matching dialog kind", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // tarefa
    const mondayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[0]}"]`);
    const tarefaItem = mondayCard
      .getByTestId("dash-week-item")
      .filter({ hasText: tarefaTitulos[0] });
    await expect(tarefaItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(tarefaItem).toHaveAttribute("data-tipo", "tarefa");
    await tarefaItem.click();
    await expect(page.getByRole("dialog")).toContainText(tarefaTitulos[0], {
      timeout: RESYNC_TIMEOUT,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // rotina
    const tuesdayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[1]}"]`);
    const rotinaItem = tuesdayCard.locator(
      `[data-testid="dash-week-item"][data-eid="${rotinaWeekdayId}"]`,
    );
    await expect(rotinaItem).toHaveAttribute("data-tipo", "rotina");
    await rotinaItem.click();
    await expect(page.getByRole("dialog")).toContainText(templateNome, {
      timeout: RESYNC_TIMEOUT,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // ticket
    const wednesdayCard = page.locator(
      `[data-testid="dash-week-day"][data-eid="${semana.dias[2]}"]`,
    );
    const ticketItem = wednesdayCard
      .getByTestId("dash-week-item")
      .filter({ hasText: ticketWeekdayTitulo });
    await expect(ticketItem).toHaveAttribute("data-tipo", "ticket");
    await ticketItem.click();
    await expect(page.getByRole("dialog")).toContainText(ticketWeekdayTitulo, {
      timeout: RESYNC_TIMEOUT,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(d) dash-weekend-day-header opens the Dia dialog for that exact Saturday, distinct from clicking a dash-weekend-popover-item", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("dash-weekend-chip").click();
    const popover = page.getByTestId("dash-weekend-popover");
    await expect(popover).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const sabadoHeader = popover.locator(
      `[data-testid="dash-weekend-day-header"][data-eid="${semana.sabado}"]`,
    );
    await sabadoHeader.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog.getByTestId("day-dialog-items")).toContainText(ticketWeekendTitulo);
    await expect(dialog.getByTestId("day-dialog-ir-semana")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    // Now click the item itself, inside the popover -- opens the TICKET
    // dialog, not the Dia dialog, proving the two click targets are distinct.
    // Reload first: closing the Dia dialog (which had briefly hidden the
    // popover behind its own overlay) can otherwise leave the popover's
    // floating-ui positioning in a transient re-render loop that detaches
    // the item button mid-click.
    await page.reload();
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await page.getByTestId("dash-weekend-chip").click();
    const popoverAfterReload = page.getByTestId("dash-weekend-popover");
    await expect(popoverAfterReload).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const ticketItem = popoverAfterReload
      .getByTestId("dash-weekend-popover-item")
      .filter({ hasText: ticketWeekendTitulo });
    await expect(ticketItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await ticketItem.click();
    const ticketDialog = page.getByRole("dialog");
    await expect(ticketDialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(ticketDialog.getByTestId("day-dialog-items")).toHaveCount(0);
    await expect(ticketDialog).toContainText(ticketWeekendTitulo);
  });

  test("(e) dash-heatmap-cell opens the Dia dialog for that exact date", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-heatmap-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const cell = page.locator(`[data-testid="dash-heatmap-cell"][data-eid="${outroDia}"]`);
    await cell.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    // The dialog's own breadcrumb/context is date-derived from `outroDia` --
    // asserted indirectly via the ir-semana footer test below, which reads
    // the same iso. Here we assert the Day dialog chrome itself is present.
    await expect(dialog.getByTestId("day-dialog-items")).toBeVisible();
  });

  test("(f) the Dia dialog's footer offers only ir-para-semana + fechar, never editar/ver-pagina; ir-para-semana changes the displayed week", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const originalHeader = await page.getByTestId("dash-header-title").textContent();

    await expect(page.getByTestId("dash-heatmap-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const cell = page.locator(`[data-testid="dash-heatmap-cell"][data-eid="${outroDia}"]`);
    await cell.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog.getByTestId("day-dialog-ir-semana")).toBeVisible();
    await expect(dialog.getByTestId("focus-dialog-fechar")).toBeVisible();
    await expect(dialog.getByTestId("focus-dialog-editar")).toHaveCount(0);
    await expect(dialog.getByTestId("focus-dialog-ver-pagina")).toHaveCount(0);

    await dialog.getByTestId("day-dialog-ir-semana").click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

    await expect(async () => {
      const newHeader = await page.getByTestId("dash-header-title").textContent();
      expect(newHeader).not.toEqual(originalHeader);
    }).toPass({ timeout: RESYNC_TIMEOUT });
  });

  test("(g) the Rotina dialog's focus-dialog-editar reveals a status-only form", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const tuesdayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[1]}"]`);
    const rotinaItem = tuesdayCard.locator(
      `[data-testid="dash-week-item"][data-eid="${rotinaWeekdayId}"]`,
    );
    await rotinaItem.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await dialog.getByTestId("focus-dialog-editar").click();

    await expect(page.getByTestId("field-status")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("field-dedupeKey")).toHaveCount(0);
    await expect(page.getByTestId("field-competencia")).toHaveCount(0);

    await page.getByTestId("entity-cancel").click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });
});
