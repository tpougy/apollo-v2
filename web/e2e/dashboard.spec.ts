import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { DASHBOARD_QUERY } from "../src/lib/dashboard/dashboardQuery.ts";
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
