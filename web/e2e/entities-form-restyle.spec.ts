import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";
import { openAndReadSelectOptions, pickDate, selectByText } from "./helpers/form-controls.ts";

// Proves ENTFRM-01/02 for the fundos (full-CRUD) capability class against the
// restyled shadcn Dialog/Input/Textarea/Checkbox/Popover+Calendar form, live
// against InstantDB. This spec runs in the `authed` project (restores the
// storageState persisted by auth.setup.ts — see 04-01), mirroring
// entities-fundos.spec.ts's CLI-fixture/sweep/cleanup discipline exactly.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase10-e2e-";
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

function sweepLeftovers(): void {
  const listed = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of listed) {
    if (!record.nome.startsWith(PREFIX)) continue;
    try {
      apolloCli(["fundo", "deletar", "--id", record.id]);
    } catch {
      // Already gone — fine.
    }
  }
}

test.beforeEach(() => {
  sweepLeftovers();
});

test.afterEach(() => {
  sweepLeftovers();
});

test("ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const nome = uniqueName("dialog");
  const nomeEditado = `${nome}-editado`;
  const codigo = uniqueName("dialog-cod");

  await page.goto("/");
  await page.getByTestId("nav-fundos").click();

  // (1) Open create — a real shadcn Dialog (role="dialog"), not a bare form.
  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-codigo").fill(codigo);
  const ativoCheckbox = page.getByTestId("field-ativo");
  if (!(await ativoCheckbox.isChecked())) {
    await ativoCheckbox.check();
  }
  const createdAtValue = await pickDate(page, "field-createdAt");

  await page.getByTestId("entity-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // FDBK-01: creating a fundo produces a visible success toast.
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

  // Reload and assert the picked date persisted correctly to live InstantDB
  // (ENTFRM-02) — not just an optimistic local view.
  await page.reload();
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("row").filter({ hasText: nome })).toContainText(createdAtValue, {
    timeout: RESYNC_TIMEOUT,
  });

  // (2) Edit — Dialog reopens, nome field prefilled, resubmit persists change.
  await row.getByTestId("row-edit").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("field-nome")).toHaveValue(nome);
  await page.getByTestId("field-nome").fill(nomeEditado);
  await page.getByTestId("entity-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const editedRow = page.getByTestId("row").filter({ hasText: nomeEditado });
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toHaveAttribute("data-eid", eid ?? "");

  // (3) Delete — accept the native confirm(), assert the row is gone.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await editedRow.getByTestId("row-delete").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeEditado })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });

  // FDBK-01: deleting a fundo produces a second, distinct success toast.
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();
});

// ENTFRM-04 / ROADMAP Phase 10 SC4: submitting with a missing required field
// blocks the transact, renders the error via a shadcn Alert (not
// window.alert), and fires zero native browser dialogs. Alert-assertion
// style mirrors login-flow.spec.ts's own destructive-Alert check.
test("ENTFRM-04: missing required field blocks submission, shows Alert, fires zero native dialogs", async ({
  page,
}) => {
  test.setTimeout(30_000);

  // Any native dialog (window.alert/confirm/prompt) firing during this
  // interaction is itself a test failure — its very absence, proven by this
  // listener never throwing, is the ENTFRM-04 evidence.
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  await page.goto("/");
  await page.getByTestId("nav-fundos").click();
  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // field-nome is required and left blank — submit directly.
  await page.getByTestId("entity-submit").click();

  const errorText = page.getByTestId("entity-error");
  await expect(errorText).toBeVisible();
  await expect(errorText).not.toBeEmpty();

  const alertRoot = page.locator('[data-slot="alert"]').filter({ has: errorText });
  await expect(alertRoot).toHaveCount(1);
  await expect(alertRoot).toHaveClass(/destructive/);

  // FDBK-01: the same validation error also surfaces as an error toast,
  // alongside (not instead of) the Alert.
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();

  // The Dialog stays open — submission was blocked, not just erroring after
  // a successful transact.
  await expect(page.getByTestId("entity-submit")).toBeVisible();

  await page.getByTestId("entity-cancel").click();
});

// FDBK-01 / ROADMAP Phase 10 SC5: instanciasRotina's status-only edit is the
// "restricted capability" class alongside fundos' full-CRUD class above — no
// create affordance exists, the edit Dialog contains exactly one field
// control (a plain Input, since `status` is kind:"text"), and a successful
// status change still produces a success toast.
test("FDBK-01: instanciasRotina status-only edit — single field Dialog, no create affordance, success toast", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const dedupeKey = uniqueName("dedupe");
  const competencia = uniqueName("competencia");
  const novoStatus = uniqueName("status-novo");
  let eid = "";

  try {
    eid = await seedInstance(
      {
        dedupeKey,
        dataPrevista: "2026-04-01T00:00:00.000Z",
        competencia,
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
    );

    await page.goto("/");
    await page.getByTestId("nav-instanciasRotina").click();

    // No create affordance exists anywhere on this screen.
    await expect(page.getByTestId("entity-create-start")).toHaveCount(0);

    const row = page.getByTestId("row").filter({ hasText: competencia });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await row.getByTestId("row-edit").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Exactly one field control renders (status, a plain Input — this
    // entity's date/text fields are all excluded by updatableFields).
    const dialogFieldInputs = page.getByRole("dialog").locator('[data-testid^="field-"]');
    await expect(dialogFieldInputs).toHaveCount(1);
    const statusInput = page.getByTestId("field-status");
    await expect(statusInput).toHaveCount(1);
    await expect(statusInput).toHaveValue("pendente");

    await statusInput.fill(novoStatus);
    await page.getByTestId("entity-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // FDBK-01: a successful status-only edit produces a visible success
    // toast.
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();

    // The new status persists to live InstantDB, not just an optimistic
    // local view.
    await page.reload();
    await page.getByTestId("nav-instanciasRotina").click();
    await expect(page.getByTestId("row").filter({ hasText: competencia })).toContainText(
      novoStatus,
      { timeout: RESYNC_TIMEOUT },
    );
  } finally {
    if (eid) await deleteInstance(eid);
  }
});

// ENTFRM-01/03: templatesRotina smoke test — proves the static-option Select
// (tipoGeracao) AND the relationship-link Select (fundo) both render via
// shadcn Select and persist correctly. Does not duplicate
// entities-rotina-log.spec.ts's own full-CRUD/antecessor-self-exclude
// coverage — that stays exclusively in that pre-existing spec (fixed in this
// phase's own 10-04 plan).
test.describe("templatesRotina — Select field conversion", () => {
  // NOTE: the outer `test.beforeEach`/`afterEach` above (scoped to fundos
  // via the same PREFIX) run for every test in this file, including this
  // nested describe — outer beforeEach fires BEFORE any local hook. If the
  // fundo fixture were created in a `beforeAll` here, it would already exist
  // by the time the outer `beforeEach` sweeps every phase10-e2e-* fundo,
  // deleting the fixture right before the test body runs. Creating it in a
  // local `beforeEach` (which fires AFTER the outer one) avoids that race,
  // and the outer `afterEach`'s sweep is exactly the cleanup this fixture
  // needs afterward — no separate afterAll delete required.
  let fundoNome = "";

  function sweepTemplateLeftovers(): void {
    const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
      id: string;
      nome: string;
    }[];
    for (const record of templates) {
      if (!record.nome.startsWith(PREFIX)) continue;
      try {
        apolloCli(["rotina", "template", "deletar", "--id", record.id]);
      } catch {
        // Already gone — fine.
      }
    }
  }

  test.beforeEach(() => {
    sweepTemplateLeftovers();
    fundoNome = uniqueName("template-fundo");
    apolloCli([
      "fundo",
      "criar",
      "--nome",
      fundoNome,
      "--codigo",
      uniqueName("template-fundo-cod"),
    ]);
  });

  test.afterEach(() => {
    sweepTemplateLeftovers();
  });

  test("ENTFRM-01/03: templatesRotina — static-option Select (tipoGeracao) and relationship-link Select (fundo) render and persist", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const nome = uniqueName("template");

    await page.goto("/");
    await page.getByTestId("nav-templatesRotina").click();
    await page.getByTestId("entity-create-start").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Assert tipoGeracao's Select offers exactly the three static options.
    const tipoGeracaoOptions = await openAndReadSelectOptions(page, "field-tipoGeracao");
    expect(tipoGeracaoOptions.sort()).toEqual(["corrido_fixo", "du_fixo", "encadeado"]);

    await page.getByTestId("field-nome").fill(nome);
    await page.getByTestId("field-regraCompetencia").fill("regra teste");
    await selectByText(page, "field-tipoGeracao", "du_fixo");
    await selectByText(page, "link-fundo", fundoNome);

    await page.getByTestId("entity-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const row = page.getByTestId("row").filter({ hasText: nome });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(row).toContainText(fundoNome);

    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByTestId("row-delete").click();
    await expect(page.getByTestId("row").filter({ hasText: nome })).toHaveCount(0, {
      timeout: RESYNC_TIMEOUT,
    });
  });
});

// ROADMAP Phase 10 SC3: subtarefas' xorLink two-step chooser (parent-type +
// dynamic target picker) still enforces "exactly one of tarefa/ticket" after
// the Select swap, including unlink-on-parent-switch. Server-side truth via
// the CLI, mirroring entities-ticket-subtarefa.spec.ts's own verification
// style (that spec's own .selectOption() call sites are 10-04's job — this
// test proves the EntityScreen.svelte behavior directly, not by fixing that
// file).
test.describe("subtarefas — xorLink two-step Select chooser", () => {
  let chainTarefaId = "";
  let chainTarefaTitulo = "";
  let chainTicketId = "";
  let chainTicketTitulo = "";

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

  function sweepSubtarefaFixtures(): void {
    const subtarefas = JSON.parse(apolloCli(["subtarefa", "listar"])) as {
      id: string;
      titulo: string;
    }[];
    for (const record of subtarefas) {
      if (!record.titulo.startsWith(PREFIX)) continue;
      try {
        apolloCli(["subtarefa", "deletar", "--id", record.id]);
      } catch {
        // Already gone — fine.
      }
    }
  }

  test.beforeAll(() => {
    sweepSubtarefaFixtures();

    chainTarefaTitulo = uniqueName("xor-tarefa");
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

    chainTicketTitulo = uniqueName("xor-ticket");
    const ticketCreated = JSON.parse(
      apolloCli([
        "ticket",
        "criar",
        "--titulo",
        chainTicketTitulo,
        "--corpo",
        "fixture ticket for subtarefa xorLink Select test",
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
    sweepSubtarefaFixtures();
    if (chainTarefaId) {
      try {
        apolloCli(["tarefa", "deletar", "--id", chainTarefaId]);
      } catch {
        // Already gone — fine.
      }
    }
    if (chainTicketId) {
      try {
        apolloCli(["ticket", "deletar", "--id", chainTicketId]);
      } catch {
        // Already gone — fine.
      }
    }
  });

  test("ROADMAP Phase 10 SC3: xor-parent-type and the dynamic link-target picker render as Select; switching parent on edit unlinks the stale parent", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const titulo = uniqueName("subtarefa-xor");

    await page.goto("/");
    await page.getByTestId("nav-subtarefas").click();
    await page.getByTestId("entity-create-start").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByTestId("field-titulo").fill(titulo);
    await page.getByTestId("field-ordem").fill("1");
    await selectByText(page, "xor-parent-type", "tarefa");
    await selectByText(page, "link-tarefa", chainTarefaTitulo);

    await page.getByTestId("entity-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const row = page.getByTestId("row").filter({ hasText: titulo });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const eid = await row.getAttribute("data-eid");
    expect(eid).toBeTruthy();

    // listColumns: ["ordem", "titulo", "concluida", "tarefa", "ticket"].
    const cells = row.locator("td");
    await expect(cells.nth(3)).toHaveText(chainTarefaTitulo);
    await expect(cells.nth(4)).toHaveText("");

    // Server-side truth via the CLI, not just the DOM.
    expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(true);
    expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(false);

    // Edit: switch xor-parent-type from tarefa to ticket via Select — the
    // unchanged onValueChange handler resets xorParentId to "" on switch.
    await row.getByTestId("row-edit").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("xor-parent-type")).toHaveText("tarefa");
    await selectByText(page, "xor-parent-type", "ticket");
    await selectByText(page, "link-ticket", chainTicketTitulo);
    await page.getByTestId("entity-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Server-side truth: the stale tarefa link is GONE, only the ticket link
    // remains — the XOR "exactly one" invariant holds after the Select swap.
    expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(false);
    expect(listSubtarefasByTicket(chainTicketId).some((r) => r.id === eid)).toBe(true);

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByTestId("row").filter({ hasText: titulo }).getByTestId("row-delete").click();
    await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
      timeout: RESYNC_TIMEOUT,
    });
  });
});
