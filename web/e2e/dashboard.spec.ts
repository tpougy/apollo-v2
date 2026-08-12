import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase21-e2e-` prefix so
// leftovers are greppable/removable, and cleanup runs in both `beforeAll` and
// `afterAll`, mirroring tickets-section.spec.ts's / entities-rotina-log.spec.ts's
// established CLI-fixture/sweep-leftovers pattern.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase21-e2e-";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli([group, "deletar", "--id", eid]);
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

function sweepFundoLeftovers(): void {
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

function sweepLeftovers(): void {
  // Order matters: tickets before fundos -- InstantDB does not cascade-delete
  // linked rows.
  sweepTicketLeftovers();
  sweepFundoLeftovers();
}

let fundoId = "";
let fundoNome = "";
let hardTicketId = "";
let hardTicketTitulo = "";
let softTicketId = "";
let softTicketTitulo = "";

test.beforeAll(() => {
  sweepLeftovers();

  fundoNome = uniqueName("fundo");
  const fundoCodigo = `T21${Date.now().toString().slice(-6)}`;
  const fundoCreated = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", fundoCodigo]),
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
  sweepLeftovers();
});

test("DASH-01/DASH-02/DASH-07: Dashboard grid mounts TicketQueue with hard-first ordering, correct meta line, and working navigation to Tickets", async ({
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
