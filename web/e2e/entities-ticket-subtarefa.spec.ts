import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { confirmRowDelete } from "./helpers/delete-confirmation.ts";
import { openAndReadSelectOptions, pickDate, selectByText } from "./helpers/form-controls.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts — see 04-01). Every generated record uses the
// `phase04-e2e-` prefix so leftovers are greppable/removable, and cleanup
// runs in both `beforeAll` and `afterAll`, mirroring 04-02/04-03's
// established pattern.
//
// Every server-side assertion about the subtarefa XOR parent goes through the
// Phase 3 CLI (`apollo subtarefa listar --tarefa-id`/`--ticket-id`), never
// through a second InstantDB client instantiated inside the test — the base
// `listar` query does not expand linked sub-relations, so filtering by the
// parent's id is how "is this record linked to that specific parent" is
// proven server-side, doubling as SC-3 evidence for these entities.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase04-e2e-";

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
    // Already gone — fine.
  }
}

// Sweep every phase04-e2e-* record across the three entities this spec
// touches, children before parents (a subtarefa always outlives neither of
// its possible parents), so re-runs are idempotent regardless of what a
// previous, possibly interrupted, run left behind.
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

// Server-side truth for the subtarefa XOR parent: `apollo subtarefa listar`
// with no filter never expands the tarefa/ticket sub-relation, so "is this
// subtarefa linked to that specific parent" is answered by filtering on the
// parent's id and checking membership, not by reading a link field back.
function listSubtarefasByTarefa(tarefaId: string): { id: string }[] {
  return JSON.parse(apolloCli(["subtarefa", "listar", "--tarefa-id", tarefaId])) as {
    id: string;
  }[];
}

function listSubtarefasByTicket(ticketId: string): { id: string }[] {
  return JSON.parse(apolloCli(["subtarefa", "listar", "--ticket-id", ticketId])) as {
    id: string;
  }[];
}

// Click "salvar", tolerating the same rare DOM-actionability race documented
// in 04-03's `entities-projeto-etapa-tarefa.spec.ts`: InstantDB's reactive
// link-target queries can re-render the form at the exact instant
// Playwright's click actionability check re-verifies "stable". If the form
// is already gone by the time the click throws, the submit succeeded.
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
// interaction on that row — avoids the same-session reactive-resettle race
// documented alongside `submitForm` above.
async function waitForSettle(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
}

let chainTarefaId = "";
let chainTarefaTitulo = "";
let chainTicketId = "";
let chainTicketTitulo = "";

test.beforeAll(() => {
  sweepLeftovers();

  chainTarefaTitulo = uniqueName("chain-tarefa");
  const tarefaCreated = JSON.parse(
    apolloCli([
      "tarefa",
      "criar",
      "--titulo",
      chainTarefaTitulo,
      "--tipo-prazo",
      "hard",
      "--status",
      "ativo",
    ]),
  ) as { id: string };
  chainTarefaId = tarefaCreated.id;

  chainTicketTitulo = uniqueName("chain-ticket");
  const ticketCreated = JSON.parse(
    apolloCli([
      "ticket",
      "criar",
      "--titulo",
      chainTicketTitulo,
      "--corpo",
      "fixture ticket for subtarefa parent tests",
      "--remetente",
      "fixture@example.com",
      "--data-recebimento",
      "2026-01-01",
      "--tipo-prazo",
      "hard",
      "--status",
      "ativo",
    ]),
  ) as { id: string };
  chainTicketId = ticketCreated.id;
});

test.afterAll(() => {
  sweepLeftovers();
});

test("WEB-08: tickets full browser CRUD round trip, including a long multi-line corpo", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("ticket");
  const remetente = uniqueName("remetente");
  const corpo = [
    "Prezados,",
    "",
    "Segue o resumo da demanda recebida por e-mail, com todos os detalhes necessários para o correto tratamento e priorização deste chamado pela equipe de controladoria, incluindo o histórico completo da solicitação original.",
    "Favor confirmar o recebimento e indicar o prazo estimado de resposta, bem como qualquer documentação adicional necessária para dar prosseguimento ao atendimento.",
    "",
    "Atenciosamente,",
    "Remetente fixture.",
  ].join("\n");
  expect(corpo.length).toBeGreaterThan(300);

  await page.goto("/");
  await page.getByTestId("nav-tickets").click();
  await page.getByTestId("entity-create-start").click();

  // Assert the tipoPrazo select offers EXACTLY "hard" and "soft" — matching
  // the CLI's click.Choice(_TIPO_PRAZO_CHOICES), no free text.
  const optionValues = await openAndReadSelectOptions(page, "field-tipoPrazo");
  expect(optionValues.sort()).toEqual(["hard", "soft"]);

  // (1) Create: dataRecebimento set, dataPrevista left blank, no fundo link.
  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-corpo").fill(corpo);
  await page.getByTestId("field-remetente").fill(remetente);
  await pickDate(page, "field-dataRecebimento");
  await selectByText(page, "field-tipoPrazo", "hard");
  await page.getByTestId("field-status").fill("novo");
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // (2) Reload, open the edit form, assert the corpo textarea round-trips
  // the exact string — proves no truncation and no newline mangling.
  await waitForSettle(page);
  await page.reload();
  await page.getByTestId("nav-tickets").click();
  const reloadedRow = page.getByTestId("row").filter({ hasText: titulo });
  await expect(reloadedRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await reloadedRow.getByTestId("row-edit").click();
  await expect(page.getByTestId("field-corpo")).toHaveValue(corpo);

  // (3) Edit the status; assert data-eid unchanged.
  await page.getByTestId("field-status").fill("em-andamento");
  await submitForm(page);
  const editedRow = page.getByTestId("row").filter({ hasText: titulo });
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toHaveAttribute("data-eid", eid ?? "");
  await expect(editedRow).toContainText("em-andamento");

  // (4) Delete.
  await confirmRowDelete(page, editedRow);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-08: subtarefa created with a tarefa parent shows the tarefa column and an empty ticket column", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("subtarefa-tarefa");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("1");
  await selectByText(page, "xor-parent-type", "tarefa");
  await selectByText(page, "link-tarefa", chainTarefaTitulo);
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // listColumns: ["ordem", "titulo", "concluida", "tarefa", "ticket"].
  const cells = row.locator("td");
  await expect(cells.nth(3)).toHaveText(chainTarefaTitulo);
  await expect(cells.nth(4)).toHaveText("");

  // Server-side truth via the CLI, not just the DOM.
  expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(true);
  expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(false);

  await confirmRowDelete(page, row);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-08: subtarefa created with a ticket parent shows the ticket column and an empty tarefa column", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("subtarefa-ticket");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("2");
  await selectByText(page, "xor-parent-type", "ticket");
  await selectByText(page, "link-ticket", chainTicketTitulo);
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  const cells = row.locator("td");
  await expect(cells.nth(4)).toHaveText(chainTicketTitulo);
  await expect(cells.nth(3)).toHaveText("");

  expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(true);
  expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(false);

  await confirmRowDelete(page, row);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-08 T-04-04: subtarefa submitted with no parent selected is blocked, nothing written", async ({
  page,
}) => {
  const titulo = uniqueName("subtarefa-no-parent");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("1");
  // A parent TYPE is pre-selected by `startCreate` (defaults to the first
  // xorLink choice), but no parent ID has been picked — the form must still
  // block on the missing id.
  await page.getByTestId("entity-submit").click();

  await expect(page.getByTestId("entity-error")).toBeVisible();
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0);

  const all = JSON.parse(apolloCli(["subtarefa", "listar"])) as { titulo: string }[];
  expect(all.some((r) => r.titulo === titulo)).toBe(false);

  await page.getByTestId("entity-cancel").click();
});

test("WEB-08 T-04-11: switching parent type before submit links only the final choice", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("subtarefa-switch-before-submit");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("1");

  await selectByText(page, "xor-parent-type", "tarefa");
  await selectByText(page, "link-tarefa", chainTarefaTitulo);

  // Switch the parent type before submitting.
  await selectByText(page, "xor-parent-type", "ticket");
  await selectByText(page, "link-ticket", chainTicketTitulo);

  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // Exactly one link was written: the ticket, not the tarefa.
  expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(true);
  expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(false);

  await confirmRowDelete(page, row);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-08 T-04-11: editing a subtarefa's parent type unlinks the old parent, leaving exactly one link", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("subtarefa-switch-on-edit");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("1");
  await selectByText(page, "xor-parent-type", "tarefa");
  await selectByText(page, "link-tarefa", chainTarefaTitulo);
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // Confirm the pre-edit state really is tarefa-only before switching.
  expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(true);
  expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(false);

  await waitForSettle(page);
  await row.getByTestId("row-edit").click();
  await expect(page.getByTestId("xor-parent-type")).toHaveText("tarefa");
  await selectByText(page, "xor-parent-type", "ticket");
  await selectByText(page, "link-ticket", chainTicketTitulo);
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await waitForSettle(page);

  // Server-side truth: the old tarefa link is GONE, only the ticket link
  // remains — this is the EntityScreen.svelte fix committed in this plan.
  expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(false);
  expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(true);

  await gotoNested(page, "subtarefas");
  const reloadedRow = page.getByTestId("row").filter({ hasText: titulo });
  await expect(reloadedRow.locator("td").nth(3)).toHaveText("", { timeout: RESYNC_TIMEOUT });
  await expect(reloadedRow.locator("td").nth(4)).toHaveText(chainTicketTitulo, {
    timeout: RESYNC_TIMEOUT,
  });

  await confirmRowDelete(page, reloadedRow);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-08: subtarefa concluida boolean round-trips both true and false across reload", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("subtarefa-boolean");

  await gotoNested(page, "subtarefas");
  await page.getByTestId("entity-create-start").click();

  await page.getByTestId("field-titulo").fill(titulo);
  await page.getByTestId("field-ordem").fill("1");
  await selectByText(page, "xor-parent-type", "tarefa");
  await selectByText(page, "link-tarefa", chainTarefaTitulo);
  const concluidaCheckbox = page.getByTestId("field-concluida");
  if (await concluidaCheckbox.isChecked()) await concluidaCheckbox.uncheck();
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // (1) Toggle to true, reload, assert "sim" persists.
  await waitForSettle(page);
  await row.getByTestId("row-edit").click();
  await page.getByTestId("field-concluida").check();
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await waitForSettle(page);
  await gotoNested(page, "subtarefas");
  let reloadedRow = page.getByTestId("row").filter({ hasText: titulo });
  await expect(reloadedRow.locator("td").nth(2)).toHaveText("sim", { timeout: RESYNC_TIMEOUT });

  // (2) Toggle back to false, reload, assert "não" persists.
  await reloadedRow.getByTestId("row-edit").click();
  await page.getByTestId("field-concluida").uncheck();
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await waitForSettle(page);
  await gotoNested(page, "subtarefas");
  reloadedRow = page.getByTestId("row").filter({ hasText: titulo });
  await expect(reloadedRow.locator("td").nth(2)).toHaveText("não", { timeout: RESYNC_TIMEOUT });

  await confirmRowDelete(page, reloadedRow);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});
