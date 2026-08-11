import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { confirmRowDelete } from "./helpers/delete-confirmation.ts";
import { openAndReadSelectOptions, pickDate, selectByText } from "./helpers/form-controls.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts — see 04-01). Every generated record uses the
// `phase04-e2e-` prefix so leftovers are greppable/removable, and cleanup
// runs in both `beforeAll` and `afterAll`, per T-04-08 / 04-02's established
// pattern.
//
// Post-reload assertions use a generous timeout (RESYNC_TIMEOUT), copied
// verbatim from 04-02's `entities-fundos.spec.ts` for the same reason: a
// reload forces the real InstantDB Reactor to re-authenticate and re-sync
// over the network before the reactive query reflects server-confirmed
// state, and that round trip against the live hosted backend can
// occasionally exceed Playwright's 5s default.

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

// Click "salvar", tolerating a rare DOM-actionability race observed against
// the live hosted backend: InstantDB's reactive link-target queries can
// re-render the form (new option data) at the exact instant Playwright's
// click actionability check re-verifies "stable", making the click action
// report the target as "detached" even though the underlying submit already
// landed (or is about to, a beat later). If the form is already gone by the
// time the click throws, the submit succeeded — surface any other error.
// After a create's row appears, InstantDB briefly re-settles the reactive
// query as the optimistic local write is reconciled with the server-ack'd
// echo. Entering edit mode (row-edit click) during that brief window has
// been observed to silently reset the just-opened form back to the closed
// state (mode -> null) without ever calling handleSubmit — a live-backend
// timing race, not a `formGone` bug in `submitForm` above. A short buffer
// after a same-session create, before the first `row-edit` click on that
// row, avoids the race entirely (mirrors 04-02's pre-reload WS-flush buffer).
async function waitForCreateSettle(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
}

async function submitForm(page: Page): Promise<void> {
  // Give the last field's oninput/onchange handler (and any in-flight
  // reactive re-render it triggers) a brief moment to settle before the
  // actionability check runs — avoids racing the exact re-render tick that
  // the DOM-detachment issue above is rooted in.
  await page.waitForTimeout(300);
  try {
    await page.getByTestId("entity-submit").click({ timeout: 10_000 });
  } catch (err) {
    const formGone = (await page.locator("form").count()) === 0;
    if (!formGone) throw err;
  }
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli([group, "deletar", "--id", eid]);
  } catch {
    // Already gone — fine.
  }
}

// Sweep every phase04-e2e-* record across the four entities this spec
// touches, regardless of which test (or which previous, possibly
// interrupted, run) created it — makes the suite self-healing rather than
// accumulating flaky leftovers in the live app (mirrors 04-02's
// `sweepLeftovers` pattern, extended across the tarefa -> etapa -> projeto
// -> fundo chain so a parent is never deleted before its children).
function sweepLeftovers(): void {
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

// Chain fixtures shared across tests, created once via the CLI (not through
// the UI — the UI CRUD round trip itself is what each test proves for its
// own entity). `chainProjetoId`/`chainEtapaId` play the role of "the
// projeto/etapa the next entity down the chain links to", independent of
// whichever throwaway records a given test creates and deletes through the
// UI for its own create/edit/delete assertions.
let chainFundoId = "";
let chainFundoNome = "";
let chainProjetoId = "";
let chainProjetoNome = "";
let chainEtapaId = "";
let chainEtapaNome = "";

test.beforeAll(() => {
  sweepLeftovers();

  chainFundoNome = uniqueName("chain-fundo");
  const fundoCreated = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", chainFundoNome, "--codigo", chainFundoNome, "--ativo"]),
  ) as { id: string };
  chainFundoId = fundoCreated.id;

  chainProjetoNome = uniqueName("chain-projeto");
  const projetoCreated = JSON.parse(
    apolloCli(["projeto", "criar", "--nome", chainProjetoNome, "--status", "ativo"]),
  ) as { id: string };
  chainProjetoId = projetoCreated.id;

  chainEtapaNome = uniqueName("chain-etapa");
  const etapaCreated = JSON.parse(
    apolloCli([
      "etapa",
      "criar",
      "--nome",
      chainEtapaNome,
      "--ordem",
      "1",
      "--status",
      "ativo",
      "--projeto-id",
      chainProjetoId,
    ]),
  ) as { id: string };
  chainEtapaId = etapaCreated.id;
});

test.afterAll(() => {
  tryDelete("etapa", chainEtapaId);
  tryDelete("projeto", chainProjetoId);
  tryDelete("fundo", chainFundoId);
  sweepLeftovers();
});

test("WEB-03: projetos full browser CRUD round trip, with and without an optional fundo link", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nomeA = uniqueName("projeto-a");
  const nomeB = uniqueName("projeto-b");

  await page.goto("/");
  await page.getByTestId("nav-projetos").click();

  // (1) Create projeto A: nome + status only, no fundo link. Assert it
  // appears in the master list, correctly grouped under "Sem fundo
  // vinculado" (the master column's grouping default) — proving the
  // optional link is genuinely absent, not silently defaulted.
  await page.getByTestId("project-create-start").click();
  await page.getByTestId("field-nome").fill(nomeA);
  await page.getByTestId("field-status").fill("ativo");
  await submitForm(page);

  const itemA = page.getByTestId("project-item").filter({ hasText: nomeA });
  await expect(itemA).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const eidA = await itemA.getAttribute("data-eid");
  expect(eidA).toBeTruthy();

  const groupA = itemA.locator("xpath=ancestor::*[@data-testid='project-group']");
  await expect(groupA.getByTestId("project-group-heading")).toHaveText("Sem fundo vinculado");

  // (2) Select it; assert the detail header shows "Sem fundo vinculado" and
  // zero etapas/tarefas counts.
  await itemA.click();
  const header = page.getByTestId("project-header");
  await expect(header).toContainText("Sem fundo vinculado");
  await expect(header).toContainText("0 etapas");
  await expect(header).toContainText("0 tarefas");

  // (3) Edit projeto A to set dataInicioPrevista, reload, assert the same
  // data-eid resolves again (update-in-place, not delete+recreate) AND the
  // edited date field actually persisted server-side. ProjetosSection's
  // project-header does not render dataInicioPrevista anywhere in its
  // markup (unlike the old flat EntityScreen table this test replaces,
  // which had a visible column for it) -- confirmed by inspecting
  // ProjetosSection.svelte, not assumed -- so the persisted value is
  // verified via the CLI's own read path instead of a UI assertion,
  // deliberately kept in a "no production runtime code touched" plan.
  await waitForCreateSettle(page);
  await page.getByTestId("project-edit-start").click();
  const dataInicioPrevistaValue = await pickDate(page, "field-dataInicioPrevista");
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByTestId("nav-projetos").click();

  const reloadedItemA = page.getByTestId("project-item").filter({ hasText: nomeA });
  await expect(reloadedItemA).toHaveAttribute("data-eid", eidA ?? "", { timeout: RESYNC_TIMEOUT });
  await expect
    .poll(
      () => {
        const listed = JSON.parse(apolloCli(["projeto", "listar"])) as {
          id: string;
          dataInicioPrevista?: string;
        }[];
        return listed.find((r) => r.id === eidA)?.dataInicioPrevista ?? "";
      },
      { timeout: RESYNC_TIMEOUT },
    )
    .toContain(dataInicioPrevistaValue);

  // (4) Create projeto B WITH a fundo link selected; assert it appears in
  // the master list, correctly grouped under the fundo's own nome (not
  // "Sem fundo vinculado").
  await page.getByTestId("project-create-start").click();
  await page.getByTestId("field-nome").fill(nomeB);
  await page.getByTestId("field-status").fill("ativo");
  await selectByText(page, "link-fundo", chainFundoNome);
  await submitForm(page);

  const itemB = page.getByTestId("project-item").filter({ hasText: nomeB });
  await expect(itemB).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const groupB = itemB.locator("xpath=ancestor::*[@data-testid='project-group']");
  await expect(groupB.getByTestId("project-group-heading")).toHaveText(chainFundoNome);

  // No UI-driven delete step: ProjetosSection has no delete affordance
  // (spec-ui.md §2.2 lists only "editar projeto"/"+ etapa" as header
  // actions). This file's existing sweepLeftovers() (CLI-driven,
  // beforeAll/afterAll) already deletes every lingering phase04-e2e-
  // prefixed projeto regardless of how it was created, so test hygiene is
  // preserved without a UI delete step.
});

test("WEB-04: etapas full browser CRUD round trip, with a numeric ordem and a projeto link", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nome = uniqueName("etapa");

  await gotoNested(page, "etapas");

  // (1) Create an etapa with ordem 10, linked to the chain projeto. Assert
  // the row shows "10" and the projeto's nome.
  await page.getByTestId("entity-create-start").click();
  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-ordem").fill("10");
  await page.getByTestId("field-status").fill("ativo");
  await selectByText(page, "link-projeto", chainProjetoNome);
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();
  await expect(row).toContainText("10");
  await expect(row).toContainText(chainProjetoNome);

  // (2) Edit ordem to 20, reload, assert the cell text is exactly "20" —
  // proves it round-trips as a number (i.number() in the schema), not a
  // quoted string and not blank.
  await waitForCreateSettle(page);
  await row.getByTestId("row-edit").click();
  await page.getByTestId("field-ordem").fill("20");
  await expect(page.getByTestId("field-ordem")).toHaveValue("20");
  await submitForm(page);
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await gotoNested(page, "etapas");

  const reloadedRow = page.getByTestId("row").filter({ hasText: nome });
  await expect(reloadedRow).toHaveAttribute("data-eid", eid ?? "", { timeout: RESYNC_TIMEOUT });
  // Retry-based assertion (not a one-shot textContent() read): the reload
  // forces a real network resync before the reactive query reflects the
  // server-confirmed "ordem: 20" value, exactly like 04-02's boolean-persists
  // assertion.
  await expect(reloadedRow.locator("td").nth(0)).toHaveText("20", { timeout: RESYNC_TIMEOUT });

  // (3) Delete.
  await confirmRowDelete(page, reloadedRow);
  await expect(page.getByTestId("row").filter({ hasText: nome })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-05: tarefas tipoPrazo is a strict hard/soft select, and optional dates round-trip", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const titulo = uniqueName("tarefa");
  const tituloEditado = `${titulo}-editado`;

  await gotoNested(page, "tarefas");
  await page.getByTestId("entity-create-start").click();

  // (0) Assert the tipoPrazo select offers EXACTLY "hard" and "soft" —
  // matching the CLI's click.Choice(_TIPO_PRAZO_CHOICES), no free text.
  const optionValues = await openAndReadSelectOptions(page, "field-tipoPrazo");
  expect(optionValues.sort()).toEqual(["hard", "soft"]);

  // (1) Create a tarefa: tipoPrazo=hard, dataPrevistaEstimada set,
  // dataPrevista left blank, linked to the chain etapa.
  await page.getByTestId("field-titulo").fill(titulo);
  await selectByText(page, "field-tipoPrazo", "hard");
  await page.getByTestId("field-status").fill("ativo");
  await pickDate(page, "field-dataPrevistaEstimada");
  await selectByText(page, "link-etapa", chainEtapaNome);
  await submitForm(page);

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // dataPrevista is listColumns[3] ("titulo", "status", "tipoPrazo",
  // "dataPrevista", "etapa") — assert it renders blank, not "undefined".
  const dataPrevistaCellText = await row.locator("td").nth(3).textContent();
  expect(dataPrevistaCellText?.trim()).toBe("");

  // (2) Edit only the status; assert data-eid is unchanged after the edit
  // (proves update-in-place, not delete+recreate).
  await waitForCreateSettle(page);
  await row.getByTestId("row-edit").click();
  await page.getByTestId("field-titulo").fill(tituloEditado);
  await page.getByTestId("field-status").fill("concluido");
  await expect(page.getByTestId("field-titulo")).toHaveValue(tituloEditado);
  await expect(page.getByTestId("field-status")).toHaveValue("concluido");
  await submitForm(page);

  const editedRow = page.getByTestId("row").filter({ hasText: tituloEditado });
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toHaveAttribute("data-eid", eid ?? "");
  await expect(editedRow).toContainText("concluido");

  // (3) Delete.
  await confirmRowDelete(page, editedRow);
  await expect(page.getByTestId("row").filter({ hasText: tituloEditado })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

test("WEB-04 threat T-04-04: a dangling projeto link is blocked with a visible error, not written", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nomeProjetoVitima = uniqueName("projeto-doomed");
  const nomeEtapa = uniqueName("etapa-dangling");

  const doomed = JSON.parse(
    apolloCli(["projeto", "criar", "--nome", nomeProjetoVitima, "--status", "ativo"]),
  ) as { id: string };

  await gotoNested(page, "etapas");
  await page.getByTestId("entity-create-start").click();
  await page.getByTestId("field-nome").fill(nomeEtapa);
  await page.getByTestId("field-ordem").fill("1");
  await page.getByTestId("field-status").fill("ativo");

  // Select the soon-to-be-deleted projeto BEFORE deleting it — the select
  // list is populated from a live query, but `selectedLinks` retains the id
  // string regardless of subsequent list updates.
  await selectByText(page, "link-projeto", nomeProjetoVitima);

  // Delete the target out from under the in-flight form, between selection
  // and submit — this is exactly the race the `queryOnce` existence check
  // (inherited from EntityScreen.svelte, threat T-04-04) exists to catch.
  apolloCli(["projeto", "deletar", "--id", doomed.id]);

  await page.getByTestId("entity-submit").click();

  await expect(page.getByTestId("entity-error")).toBeVisible({ timeout: RESYNC_TIMEOUT });
  await expect(page.getByTestId("entity-error")).toContainText("parent_not_found");

  // No new etapa row was created.
  await expect(page.getByTestId("row").filter({ hasText: nomeEtapa })).toHaveCount(0);

  // Cleanup: cancel the still-open form and confirm no leftover was written
  // server-side either (not just optimistically absent from the DOM).
  await page.getByTestId("entity-cancel").click();
  const etapasLeftover = JSON.parse(apolloCli(["etapa", "listar"])) as { nome: string }[];
  expect(etapasLeftover.some((r) => r.nome === nomeEtapa)).toBe(false);
});
