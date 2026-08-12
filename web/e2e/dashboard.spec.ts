import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { DASHBOARD_QUERY } from "../src/lib/dashboard/dashboardQuery.ts";
// derive.ts has zero runtime imports (same reasoning as dashboardQuery.ts's
// own doc comment) -- safe for this Node/Playwright test process to import
// directly, so this file computes "this week" with the exact same plain-UTC
// Monday-anchor algorithm the app itself uses, instead of duplicating it.
import { semanaUtil } from "../src/lib/dashboard/derive.ts";
import { adminQuery, deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase21-e2e-` prefix so
// leftovers are greppable/removable, mirroring tickets-section.spec.ts's /
// entities-rotina-log.spec.ts's established CLI-fixture/sweep-leftovers
// pattern.
//
// playwright.config.ts's workers: 1 / fullyParallel: false makes every test
// in this file run sequentially, in declaration order, in one worker. Each
// `test.describe` block below owns its own fixtures via a LOCAL
// beforeAll/afterAll (rather than one file-wide beforeAll) specifically so
// the "empty state" describe's test executes — and its assertion holds —
// before the "ticket ordering" describe's beforeAll has created any ticket.
// A file-wide `beforeAll` (declared outside every describe) still runs once,
// before the very first test in the file, sweeping any leftover debris from
// a previous aborted run.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase21-e2e-";
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
  // fundos.codigo has no documented length ceiling in the CLI help, but
  // stays short/unique-ish per its own doc comment -- mirrors the short
  // codigo style already used by entities-fundos.spec.ts fixtures.
  return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
}

// Plain-UTC "today" (never a local-timezone read) -- same convention as
// Dashboard.svelte's own `hojeIso`/`todayUtcIso()`.
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Computed at test-run time via the app's own `semanaUtil`, never a
// hardcoded calendar date, so this suite passes whenever it runs.
function computeSemana(): { dias: string[]; sabado: string; domingo: string } {
  return semanaUtil(hojeIso());
}

// Local re-implementation of Dashboard.svelte's own `shiftIso` helper --
// not exported by derive.ts (it is deliberately not one of DASH-06's 7
// named exports), so the week-navigation test below duplicates the same
// plain-UTC calendar-day-stepping logic.
function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    // `group` may be a multi-word CLI subcommand path (e.g. "rotina template").
    apolloCli([...group.split(" "), "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

function sweepTicketLeftovers(): void {
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
}

function sweepTemplateLeftovers(): void {
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDelete("rotina template", record.id);
  }
}

function sweepFundoLeftovers(): void {
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

// Order matters: tickets and templates before fundos -- InstantDB does not
// cascade-delete linked rows.
function sweepLeftovers(): void {
  sweepTicketLeftovers();
  sweepTemplateLeftovers();
  sweepFundoLeftovers();
}

test.beforeAll(() => {
  sweepLeftovers();
});

test.afterAll(() => {
  sweepLeftovers();
});

test.describe("DASH-02: empty ticket queue", () => {
  test("shows the Empty.Root state before any phase21-e2e- ticket exists", async ({ page }) => {
    test.setTimeout(60_000);

    // Redundant with the file-wide beforeAll sweep above, but explicit here
    // per this test's own contract: it must never depend on execution order
    // relative to the "ticket ordering" describe below.
    sweepTicketLeftovers();

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("dash-tickets-empty")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("dash-tickets-empty")).toContainText("Nenhum ticket pendente");
    await expect(page.getByTestId("dash-ticket-card")).toHaveCount(0);
  });
});

test.describe("DASH-01/DASH-02/DASH-07: ticket ordering and navigation", () => {
  let fundoId = "";
  let fundoNome = "";
  let hardTicketId = "";
  let hardTicketTitulo = "";
  let softTicketId = "";
  let softTicketTitulo = "";

  test.beforeAll(() => {
    fundoNome = uniqueName("fundo");
    const fundoCreated = JSON.parse(
      apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("T21")]),
    ) as { id: string };
    fundoId = fundoCreated.id;

    // Hard ticket with an EARLIER dataPrevista.
    hardTicketTitulo = uniqueName("ticket-hard");
    const hardCreated = JSON.parse(
      apolloCli([
        "ticket",
        "criar",
        "--titulo",
        hardTicketTitulo,
        "--corpo",
        "corpo do ticket hard",
        "--remetente",
        "hard@example.com",
        "--data-recebimento",
        "2026-01-01",
        "--tipo-prazo",
        "hard",
        "--status",
        "pendente",
        "--data-prevista",
        "2026-01-05",
        "--fundo-id",
        fundoId,
      ]),
    ) as { id: string };
    hardTicketId = hardCreated.id;

    // Soft ticket with a LATER dataPrevista.
    softTicketTitulo = uniqueName("ticket-soft");
    const softCreated = JSON.parse(
      apolloCli([
        "ticket",
        "criar",
        "--titulo",
        softTicketTitulo,
        "--corpo",
        "corpo do ticket soft",
        "--remetente",
        "soft@example.com",
        "--data-recebimento",
        "2026-01-02",
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        "2026-01-20",
        "--fundo-id",
        fundoId,
      ]),
    ) as { id: string };
    softTicketId = softCreated.id;
  });

  test.afterAll(() => {
    tryDelete("ticket", hardTicketId);
    tryDelete("ticket", softTicketId);
    tryDelete("fundo", fundoId);
  });

  test("hard-first ordering, correct meta line, and working navigation to Tickets", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const hardCard = page.getByTestId("dash-ticket-card").filter({ hasText: hardTicketTitulo });
    const softCard = page.getByTestId("dash-ticket-card").filter({ hasText: softTicketTitulo });
    await expect(hardCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(softCard).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // Hard ticket's card appears before the soft ticket's card in DOM order.
    const firstCard = page.getByTestId("dash-ticket-card").first();
    await expect(firstCard).toHaveAttribute("data-eid", hardTicketId, { timeout: RESYNC_TIMEOUT });

    await expect(hardCard).toContainText(fundoNome);
    await expect(hardCard).toContainText("HARD");
    await expect(softCard).toContainText(fundoNome);
    await expect(softCard).toContainText("SOFT");

    await page.getByTestId("dash-tickets-ver-todos").click();
    await expect(page.getByTestId("nav-tickets")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
  });
});

test.describe("DASH-01: responsive grid order", () => {
  test("desktop viewport: 3-column grid with correct outer track widths", async ({ page }) => {
    test.setTimeout(60_000);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const grid = page.getByTestId("dash-grid");
    await expect(grid).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const gridTemplateColumns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns,
    );
    const tracks = gridTemplateColumns.trim().split(/\s+/);
    expect(tracks).toHaveLength(3);

    const firstPx = Number.parseFloat(tracks[0]);
    const lastPx = Number.parseFloat(tracks[2]);
    expect(firstPx).toBeGreaterThan(200);
    expect(firstPx).toBeLessThan(216);
    expect(lastPx).toBeGreaterThan(248);
    expect(lastPx).toBeLessThan(264);
  });

  test("mobile viewport: single column stacked semana, tickets, rotinas, projetos", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const weekBox = await page.getByTestId("dash-week-slot").boundingBox();
    const ticketsBox = await page.getByTestId("dash-tickets-slot").boundingBox();
    const rotinasBox = await page.getByTestId("dash-placeholder-rotinas").boundingBox();
    const projetosBox = await page.getByTestId("dash-placeholder-projetos").boundingBox();

    expect(weekBox).not.toBeNull();
    expect(ticketsBox).not.toBeNull();
    expect(rotinasBox).not.toBeNull();
    expect(projetosBox).not.toBeNull();

    const ys = [weekBox?.y ?? 0, ticketsBox?.y ?? 0, rotinasBox?.y ?? 0, projetosBox?.y ?? 0];
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[2]).toBeLessThan(ys[3]);
  });
});

test.describe("DASH-07: live instanciasRotina.template.fundo two-hop proof", () => {
  let fundoId = "";
  let templateId = "";
  let instanceId = "";

  test.afterAll(async () => {
    if (instanceId) await deleteInstance(instanceId);
    tryDelete("rotina template", templateId);
    tryDelete("fundo", fundoId);
  });

  test("adminQuery(DASHBOARD_QUERY) resolves instanciasRotina.template.fundo through the exact query object the app ships", async () => {
    test.setTimeout(60_000);

    const fundoNome = uniqueName("fundo-dash07");
    const fundoCreated = JSON.parse(
      apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("D07")]),
    ) as { id: string };
    fundoId = fundoCreated.id;

    const templateNome = uniqueName("template-dash07");
    const templateCreated = JSON.parse(
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
    ) as { id: string };
    templateId = templateCreated.id;

    const dedupeKey = uniqueName("dedupe-dash07");
    instanceId = await seedInstance(
      {
        dedupeKey,
        dataPrevista: "2026-03-01T00:00:00.000Z",
        competencia: "2026-03",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    type TemplateLink = { id: string; fundo?: FundoLink | FundoLink[] };
    type FundoLink = { id: string; nome: string };
    const result = await adminQuery<{
      instanciasRotina: {
        id: string;
        template?: TemplateLink | TemplateLink[];
      }[];
    }>(DASHBOARD_QUERY);

    const seeded = result.instanciasRotina.find((r) => r.id === instanceId);
    expect(seeded).toBeDefined();

    // The admin API (unlike the client SDK's `db.useQuery`) returns every
    // linked entity as an array regardless of `has: "one"` cardinality --
    // the exact same normalization routineJob.ts:622 already applies when
    // reading its own admin-queried `instanciasRotina.template`.
    const template = Array.isArray(seeded?.template) ? seeded?.template[0] : seeded?.template;
    const fundo = Array.isArray(template?.fundo) ? template?.fundo[0] : template?.fundo;

    expect(fundo?.id).toBe(fundoId);
    expect(fundo?.nome).toBe(fundoNome);
  });
});

test.describe("DASH-03: tarefa item rendering", () => {
  let fundoId = "";
  let projetoId = "";
  let etapaId = "";
  let tarefaId = "";
  let tarefaTitulo = "";
  const semana = computeSemana();

  test.afterAll(() => {
    tryDelete("tarefa", tarefaId);
    tryDelete("etapa", etapaId);
    tryDelete("projeto", projetoId);
    tryDelete("fundo", fundoId);
  });

  test("hard tarefa linked through etapa/projeto/fundo renders under Monday with border-foreground", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const fundoNome = uniqueName("fundo-tarefa");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("T03A")]),
      ) as { id: string }
    ).id;

    const projetoNome = uniqueName("projeto-tarefa");
    projetoId = (
      JSON.parse(
        apolloCli([
          "projeto",
          "criar",
          "--nome",
          projetoNome,
          "--status",
          "em andamento",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    const etapaNome = uniqueName("etapa-tarefa");
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
          "em andamento",
          "--projeto-id",
          projetoId,
        ]),
      ) as { id: string }
    ).id;

    tarefaTitulo = uniqueName("tarefa-week");
    tarefaId = (
      JSON.parse(
        apolloCli([
          "tarefa",
          "criar",
          "--titulo",
          tarefaTitulo,
          "--tipo-prazo",
          "hard",
          "--status",
          "pendente",
          "--data-prevista",
          semana.dias[0],
          "--etapa-id",
          etapaId,
        ]),
      ) as { id: string }
    ).id;

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const mondayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[0]}"]`);
    const item = mondayCard.getByTestId("dash-week-item").filter({ hasText: tarefaTitulo });
    await expect(item).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(item).toHaveAttribute("data-tipo", "tarefa");
    await expect(item).toHaveClass(/border-foreground/);
  });
});

test.describe("DASH-03: hard-vs-soft ticket week-band filtering", () => {
  let fundoId = "";
  let hardTicketId = "";
  let hardTicketTitulo = "";
  let softTicketId = "";
  let softTicketTitulo = "";
  const semana = computeSemana();

  test.afterAll(() => {
    tryDelete("ticket", hardTicketId);
    tryDelete("ticket", softTicketId);
    tryDelete("fundo", fundoId);
  });

  test("hard ticket renders under Wednesday; soft ticket never appears as a dash-week-item but still lists in dash-tickets", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const fundoNome = uniqueName("fundo-ticket-filter");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("T03B")]),
      ) as { id: string }
    ).id;

    hardTicketTitulo = uniqueName("ticket-hard-week");
    hardTicketId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          hardTicketTitulo,
          "--corpo",
          "corpo do ticket hard da semana",
          "--remetente",
          "hardweek@example.com",
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

    softTicketTitulo = uniqueName("ticket-soft-week");
    softTicketId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          softTicketTitulo,
          "--corpo",
          "corpo do ticket soft da semana",
          "--remetente",
          "softweek@example.com",
          "--data-recebimento",
          "2026-01-02",
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--data-prevista",
          semana.dias[2],
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const wednesdayCard = page.locator(
      `[data-testid="dash-week-day"][data-eid="${semana.dias[2]}"]`,
    );
    const hardItem = wednesdayCard
      .getByTestId("dash-week-item")
      .filter({ hasText: hardTicketTitulo });
    await expect(hardItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(hardItem).toHaveAttribute("data-tipo", "ticket");
    await expect(hardItem).toHaveClass(/border-destructive/);

    // The soft ticket's id must never appear as any dash-week-item's
    // data-eid anywhere in the band -- proving it was filtered out of
    // agendaPorDia entirely, not merely hidden from Wednesday's card.
    const allWeekItemEids = await page
      .getByTestId("dash-week-item")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-eid")));
    expect(allWeekItemEids).not.toContain(softTicketId);

    // It still appears in the ticket queue -- proving it was never dropped
    // from the underlying data, only excluded from the week band.
    const softCard = page.getByTestId("dash-ticket-card").filter({ hasText: softTicketTitulo });
    await expect(softCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
  });
});

test.describe("DASH-03: live two-hop rotina rendering", () => {
  let fundoId = "";
  let templateId = "";
  let instanceId = "";
  const semana = computeSemana();

  test.afterAll(async () => {
    if (instanceId) await deleteInstance(instanceId);
    tryDelete("rotina template", templateId);
    tryDelete("fundo", fundoId);
  });

  test("instanciasRotina.template.fundo two-hop path renders live as a rotina item under Friday", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const fundoNome = uniqueName("fundo-rotina-week");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("T03C")]),
      ) as { id: string }
    ).id;

    const templateNome = uniqueName("template-rotina-week");
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

    const dedupeKey = uniqueName("dedupe-week");
    instanceId = await seedInstance(
      {
        dedupeKey,
        dataPrevista: `${semana.dias[4]}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const fridayCard = page.locator(`[data-testid="dash-week-day"][data-eid="${semana.dias[4]}"]`);
    const rotinaItem = fridayCard.locator(
      `[data-testid="dash-week-item"][data-eid="${instanceId}"]`,
    );
    await expect(rotinaItem).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(rotinaItem).toHaveAttribute("data-tipo", "rotina");
    await expect(rotinaItem).toHaveClass(/border-muted-foreground/);
  });
});

test.describe("DASH-03: weekend chip", () => {
  let fundoId = "";
  let ticketId = "";
  let ticketTitulo = "";
  const semana = computeSemana();

  test.afterAll(() => {
    tryDelete("ticket", ticketId);
    tryDelete("fundo", fundoId);
  });

  test("chip is absent with zero weekend items, then appears and opens a popover once one exists", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("dash-weekend-chip")).toHaveCount(0);

    const fundoNome = uniqueName("fundo-weekend");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("T03D")]),
      ) as { id: string }
    ).id;

    ticketTitulo = uniqueName("ticket-weekend");
    ticketId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          ticketTitulo,
          "--corpo",
          "corpo do ticket de fim de semana",
          "--remetente",
          "weekend@example.com",
          "--data-recebimento",
          "2026-01-03",
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

    await page.reload();
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const chip = page.getByTestId("dash-weekend-chip");
    await expect(chip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(chip).toContainText("(1)");

    await chip.click();
    const popover = page.getByTestId("dash-weekend-popover");
    await expect(popover).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(
      popover.getByTestId("dash-weekend-popover-item").filter({ hasText: ticketTitulo }),
    ).toBeVisible();
  });
});

test.describe("DASH-03: today highlight", () => {
  test("only today's day header carries bg-muted (or none, when today falls on the weekend)", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const hoje = hojeIso();
    const semana = computeSemana();

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    for (const dia of semana.dias) {
      const header = page.locator(`[data-testid="dash-week-day-header"][data-eid="${dia}"]`);
      if (dia === hoje) {
        await expect(header).toHaveClass(/bg-muted/);
      } else {
        await expect(header).not.toHaveClass(/bg-muted/);
      }
    }
  });
});

test.describe("DASH-03: week navigation", () => {
  test("prev/next shift every day by exactly 7 days; Hoje restores the original week", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const originalEids = await page
      .getByTestId("dash-week-day")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-eid")));
    expect(originalEids).toHaveLength(5);

    await page.getByTestId("dash-week-next").click();
    await expect(async () => {
      const nextEids = await page
        .getByTestId("dash-week-day")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-eid")));
      expect(nextEids).toEqual(originalEids.map((iso) => shiftIso(iso as string, 7)));
    }).toPass({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("dash-week-today").click();
    await expect(async () => {
      const restoredEids = await page
        .getByTestId("dash-week-day")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-eid")));
      expect(restoredEids).toEqual(originalEids);
    }).toPass({ timeout: RESYNC_TIMEOUT });
  });
});
