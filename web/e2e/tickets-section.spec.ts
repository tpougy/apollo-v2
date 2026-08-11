import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase20-e2e-` prefix so
// leftovers are greppable/removable, and cleanup runs in both `beforeAll` and
// `afterAll`, mirroring projetos-section.spec.ts's / entities-ticket-
// subtarefa.spec.ts's established CLI-fixture/sweep-leftovers pattern.
//
// Every server-side assertion about the subtarefa xor parent goes through
// the Phase 3 CLI (`apollo subtarefa listar --ticket-id`/`--tarefa-id`),
// never through a second InstantDB client instantiated inside the test.
//
// No test in this file ever clicks or calls selectByText against
// `xor-parent-type`, `link-ticket`, or `link-tarefa` -- SubtarefasPanel's own
// driven code (Task 1, 20-01-PLAN.md) is the only caller of those three
// testids, which is itself the automated proof of NEST-05's "seletor nunca
// precisa ser tocado pelo usuário" (spec-ui.md §2.4).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase20-e2e-";

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

// Order matters: subtarefas before tickets/tarefas, mirroring
// projetos-section.spec.ts's own sweepLeftovers -- InstantDB does not
// cascade-delete linked rows.
function sweepLeftovers(): void {
  const subtarefas = JSON.parse(apolloCli(["subtarefa", "listar"])) as {
    id: string;
    titulo: string;
  }[];
  for (const record of subtarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("subtarefa", record.id);
  }
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
  const tarefas = JSON.parse(apolloCli(["tarefa", "listar"])) as { id: string; titulo: string }[];
  for (const record of tarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("tarefa", record.id);
  }
}

// Server-side truth for the subtarefa xor parent: `apollo subtarefa listar`
// with no filter never expands the tarefa/ticket sub-relation, so "is this
// subtarefa linked to that specific parent" is answered by filtering on the
// parent's id and checking membership, not by reading a link field back.
function listSubtarefasByTicket(ticketId: string): { id: string; titulo: string }[] {
  return JSON.parse(apolloCli(["subtarefa", "listar", "--ticket-id", ticketId])) as {
    id: string;
    titulo: string;
  }[];
}

function listSubtarefasByTarefa(tarefaId: string): { id: string; titulo: string }[] {
  return JSON.parse(apolloCli(["subtarefa", "listar", "--tarefa-id", tarefaId])) as {
    id: string;
    titulo: string;
  }[];
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

let ticketAId = "";
let ticketATitulo = "";
let ticketBId = "";
let ticketBTitulo = "";
let tarefaId = "";
let tarefaTitulo = "";

test.beforeAll(() => {
  sweepLeftovers();

  ticketATitulo = uniqueName("ticketA");
  const ticketACreated = JSON.parse(
    apolloCli([
      "ticket",
      "criar",
      "--titulo",
      ticketATitulo,
      "--corpo",
      "corpo do ticket A",
      "--remetente",
      "remetente-a@example.com",
      "--data-recebimento",
      "2026-01-01",
      "--tipo-prazo",
      "soft",
      "--status",
      "aberto",
    ]),
  ) as { id: string };
  ticketAId = ticketACreated.id;

  ticketBTitulo = uniqueName("ticketB");
  const ticketBCreated = JSON.parse(
    apolloCli([
      "ticket",
      "criar",
      "--titulo",
      ticketBTitulo,
      "--corpo",
      "corpo do ticket B",
      "--remetente",
      "remetente-b@example.com",
      "--data-recebimento",
      "2026-01-02",
      "--tipo-prazo",
      "soft",
      "--status",
      "aberto",
    ]),
  ) as { id: string };
  ticketBId = ticketBCreated.id;

  // No subtarefa yet on either ticket -- created by individual tests below.
  // Also seeds a tarefa for later reuse by Plan 03/04 (the tarefa-parented
  // path this same SubtarefasPanel serves — not exercised by this plan).
  tarefaTitulo = uniqueName("tarefa");
  const tarefaCreated = JSON.parse(
    apolloCli([
      "tarefa",
      "criar",
      "--titulo",
      tarefaTitulo,
      "--tipo-prazo",
      "soft",
      "--status",
      "pendente",
    ]),
  ) as { id: string };
  tarefaId = tarefaCreated.id;
});

test.afterAll(() => {
  tryDelete("tarefa", tarefaId);
  tryDelete("ticket", ticketAId);
  tryDelete("ticket", ticketBId);
  sweepLeftovers();
});

test("NEST-05: selecting a ticket opens a scoped panel; '+ subtarefa' drives the create dialog's xor parent to that ticket without the test touching xor-parent-type/link-ticket", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const subtitulo = uniqueName("sub-create");

  await page.goto("/");
  await page.getByTestId("nav-tickets").click();

  const rowA = page.getByTestId("row").filter({ hasText: ticketATitulo });
  await expect(rowA).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await rowA.click();

  const panel = page.getByTestId("subtarefas-panel");
  await expect(panel).toBeVisible({ timeout: RESYNC_TIMEOUT });
  // Empty state: no subtarefa exists yet for ticketA.
  await expect(panel.getByTestId("row")).toHaveCount(0);

  await panel.getByTestId("subtarefa-add-start").click();

  // The create dialog is now open (portalled to document.body by bits-ui),
  // driven entirely by SubtarefasPanel's own code -- this test never clicks
  // xor-parent-type/link-ticket itself.
  await expect(page.getByTestId("field-titulo")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(page.getByTestId("xor-parent-type")).toHaveText("ticket", {
    timeout: RESYNC_TIMEOUT,
  });
  await expect(page.getByTestId("link-ticket")).toHaveText(ticketATitulo, {
    timeout: RESYNC_TIMEOUT,
  });

  await page.getByTestId("field-titulo").fill(subtitulo);
  await page.getByTestId("field-ordem").fill("1");
  await submitForm(page);

  const newRow = panel.getByTestId("row").filter({ hasText: subtitulo });
  await expect(newRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const newId = await newRow.getAttribute("data-eid");

  // Server-side truth: linked to ticketA, and NOT to ticketB or the tarefa
  // fixture.
  const byTicketA = listSubtarefasByTicket(ticketAId);
  expect(byTicketA.some((r) => r.id === newId)).toBe(true);
  const byTicketB = listSubtarefasByTicket(ticketBId);
  expect(byTicketB.some((r) => r.id === newId)).toBe(false);
  const byTarefa = listSubtarefasByTarefa(tarefaId);
  expect(byTarefa.some((r) => r.id === newId)).toBe(false);

  tryDelete("subtarefa", newId);
});
