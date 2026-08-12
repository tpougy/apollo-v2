import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring dashboard.spec.ts's established
// CLI-fixture/sweep-leftovers pattern.
//
// This file is Plan 23-01's own complete, standalone proof of DLG-01/DLG-03
// against the Ticket dialog specifically -- the tracer plan for the whole
// Phase 23 dialog system. Every later plan adds an equivalent file for its
// own new dialog kind, never re-testing this one.

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

function sweepLeftovers(): void {
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

test.describe("Phase 23 Plan 01: Ticket focus dialog", () => {
  let fundoId = "";
  let fundoNome = "";
  let ticketId = "";
  let ticketTitulo = "";
  let ticketCorpo = "";
  let ticketRemetente = "";
  const dataPrevista = "2026-02-10";
  const dataRecebimento = "2026-02-01";

  test.beforeAll(() => {
    sweepLeftovers();

    fundoNome = uniqueName("fundo");
    const fundoCreated = JSON.parse(
      apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23")]),
    ) as { id: string };
    fundoId = fundoCreated.id;

    ticketTitulo = uniqueName("ticket");
    ticketCorpo = `corpo do ${ticketTitulo}`;
    ticketRemetente = "remetente@example.com";
    const ticketCreated = JSON.parse(
      apolloCli([
        "ticket",
        "criar",
        "--titulo",
        ticketTitulo,
        "--corpo",
        ticketCorpo,
        "--remetente",
        ticketRemetente,
        "--data-recebimento",
        dataRecebimento,
        "--tipo-prazo",
        "hard",
        "--status",
        "pendente",
        "--data-prevista",
        dataPrevista,
        "--fundo-id",
        fundoId,
      ]),
    ) as { id: string };
    ticketId = ticketCreated.id;
  });

  test.afterAll(() => {
    tryDelete("ticket", ticketId);
    tryDelete("fundo", fundoId);
  });

  test("opens a real Dialog.Root at M width showing the ticket's corpo/remetente/dataRecebimento; Esc closes it", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.getByTestId("dash-ticket-card").filter({ hasText: ticketTitulo });
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await card.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog.getByTestId("focus-dialog-editar")).toBeVisible();

    await expect(dialog).toContainText(ticketTitulo);
    await expect(dialog).toContainText(ticketCorpo);
    await expect(dialog).toContainText(ticketRemetente);
    await expect(dialog).toContainText(dataRecebimento);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });
});
