import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { confirmRowDelete } from "./helpers/delete-confirmation.ts";

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

// A short buffer after a same-session create/edit, before the next
// interaction (in particular before a `page.reload()`) -- mirrors
// entities-ticket-subtarefa.spec.ts's own `waitForSettle`. `submitForm`'s
// click resolves as soon as the click event dispatches, not once
// `handleSubmit`'s async body (its own `await db.queryOnce(...)` parent
// check, then `await db.transact(...)`) has actually reached the server --
// reloading immediately after `submitForm` returns can abort that in-flight
// request before it commits, which looks exactly like a persistence bug
// but is purely a test-timing gap (verified live: without this wait, a
// same-session edit-then-reload reproducibly reverts to the pre-edit row).
async function waitForSettle(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
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

test("NEST-05: scopeWhere isolates ticketA's subtarefas from ticketB's panel", async ({ page }) => {
  test.setTimeout(60_000);
  const subtitulo = uniqueName("sub-isolation");

  await page.goto("/");
  await page.getByTestId("nav-tickets").click();

  const rowA = page.getByTestId("row").filter({ hasText: ticketATitulo });
  await expect(rowA).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await rowA.click();

  const panelA = page.getByTestId("subtarefas-panel");
  await expect(panelA).toBeVisible({ timeout: RESYNC_TIMEOUT });

  await panelA.getByTestId("subtarefa-add-start").click();
  await expect(page.getByTestId("field-titulo")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await page.getByTestId("field-titulo").fill(subtitulo);
  await page.getByTestId("field-ordem").fill("2");
  await submitForm(page);

  const newRowInA = panelA.getByTestId("row").filter({ hasText: subtitulo });
  await expect(newRowInA).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const newId = await newRowInA.getAttribute("data-eid");

  // Switch to ticketB -- {#key selectedTicketId} forces a clean remount, and
  // ticketA's subtarefa must not leak into ticketB's scoped list.
  const rowB = page.getByTestId("row").filter({ hasText: ticketBTitulo });
  await rowB.click();

  const panelB = page.getByTestId("subtarefas-panel");
  await expect(panelB).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(panelB.getByTestId("row").filter({ hasText: subtitulo })).toHaveCount(0);

  tryDelete("subtarefa", newId);
});

test("NEST-05: editing an existing subtarefa through the panel persists -- startEdit needs no fix", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const originalTitulo = uniqueName("sub-edit");
  const editedTitulo = `${originalTitulo}-editado`;

  const created = JSON.parse(
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      originalTitulo,
      "--ordem",
      "3",
      "--nao-concluida",
      "--ticket-id",
      ticketAId,
    ]),
  ) as { id: string };
  const subId = created.id;

  try {
    await page.goto("/");
    await page.getByTestId("nav-tickets").click();

    const rowA = page.getByTestId("row").filter({ hasText: ticketATitulo });
    await expect(rowA).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await rowA.click();

    const panel = page.getByTestId("subtarefas-panel");
    const subRow = panel.getByTestId("row").filter({ hasText: originalTitulo });
    await expect(subRow).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await subRow.getByTestId("row-edit").click();
    await expect(page.getByTestId("field-titulo")).toHaveValue(originalTitulo, {
      timeout: RESYNC_TIMEOUT,
    });
    await page.getByTestId("field-titulo").fill(editedTitulo);
    await page.getByTestId("field-concluida").click();
    await submitForm(page);
    await waitForSettle(page);

    await page.reload();
    await page.getByTestId("nav-tickets").click();
    const rowAAgain = page.getByTestId("row").filter({ hasText: ticketATitulo });
    await expect(rowAAgain).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await rowAAgain.click();

    const panelAgain = page.getByTestId("subtarefas-panel");
    const editedRow = panelAgain.getByTestId("row").filter({ hasText: editedTitulo });
    await expect(editedRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(editedRow).toContainText("sim");
  } finally {
    tryDelete("subtarefa", subId);
  }
});

test("NEST-05: deleting a subtarefa through the panel removes it from the scoped list; closing the panel leaves the tickets table intact", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const titulo = uniqueName("sub-delete");

  const created = JSON.parse(
    apolloCli([
      "subtarefa",
      "criar",
      "--titulo",
      titulo,
      "--ordem",
      "4",
      "--nao-concluida",
      "--ticket-id",
      ticketAId,
    ]),
  ) as { id: string };
  const subId = created.id;

  try {
    await page.goto("/");
    await page.getByTestId("nav-tickets").click();

    const rowA = page.getByTestId("row").filter({ hasText: ticketATitulo });
    await expect(rowA).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await rowA.click();

    const panel = page.getByTestId("subtarefas-panel");
    const subRow = panel.getByTestId("row").filter({ hasText: titulo });
    await expect(subRow).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await confirmRowDelete(page, subRow);
    await expect(panel.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
      timeout: RESYNC_TIMEOUT,
    });

    await panel.getByTestId("subtarefas-panel-close").click();
    await expect(page.getByTestId("subtarefas-panel")).toHaveCount(0);
    await expect(page.getByTestId("tickets-table")).toBeVisible();
    await expect(page.getByTestId("row").filter({ hasText: ticketATitulo })).toBeVisible();
    await expect(page.getByTestId("row").filter({ hasText: ticketBTitulo })).toBeVisible();
  } finally {
    tryDelete("subtarefa", subId);
  }
});
