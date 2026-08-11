import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  deleteAdminRecord,
  deleteInstance,
  seedInstance,
} from "./fixtures/instancia-admin-fixture.ts";
import { confirmRowDelete } from "./helpers/delete-confirmation.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// Dedicated, live Playwright coverage for ENTTBL-08 (row-action alignment/
// spacing) and DELCONF-01 (AlertDialog keyboard confirm/cancel, focus
// handling, busy-gated dismissal, zero native dialogs, cross-capability-class
// safety), on top of Plan 16-01's AlertDialog conversion. This spec runs in
// the `authed` project (restores the storageState persisted by
// auth.setup.ts) and uses `tarefas` (full-CRUD) as its primary subject —
// deliberately NOT `fundos`, which 16-01's own WEB-02 test already exercises,
// so this file proves the requirements independently on a different entity.
//
// Every generated `tarefas` record uses the `phase16-e2e-` prefix so
// leftovers are greppable/removable; `beforeEach`/`afterEach` sweep them,
// mirroring `entities-projeto-etapa-tarefa.spec.ts`'s exact sweep shape.
//
// Tests B/C/D each open the AlertDialog via a direct `row-delete` click and
// then need to inspect focus/disabled state *between* open and close — the
// shared `confirmRowDelete`/`cancelRowDelete` helpers open-and-resolve the
// dialog in one atomic call, which cannot pause mid-sequence for those
// assertions. Re-clicking `row-delete` while the AlertDialog's Overlay is
// already open would also race Playwright's actionability check (the
// Overlay, not the covered trigger, would receive the pointer event) — so
// those tests reuse the *same open-step shape* the helpers use
// (`row.getByTestId("row-delete").click()` + `expect(alertdialog).toBeVisible()`)
// inline, then drive the keyboard-specific paths directly via
// `page.keyboard.press(...)`, never reinventing the confirm/cancel semantics
// themselves. `confirmRowDelete` (a plain, uninterrupted mouse round trip) is
// reused verbatim for Test A's cleanup, where no mid-dialog inspection is
// needed.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase16-e2e-";
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

function sweepTarefasLeftovers(): void {
  const listed = JSON.parse(apolloCli(["tarefa", "listar"])) as { id: string; titulo: string }[];
  for (const record of listed) {
    if (!record.titulo.startsWith(PREFIX)) continue;
    try {
      apolloCli(["tarefa", "deletar", "--id", record.id]);
    } catch {
      // Already gone — fine.
    }
  }
}

function createTarefa(titulo: string): string {
  const created = JSON.parse(
    apolloCli(["tarefa", "criar", "--titulo", titulo, "--tipo-prazo", "hard", "--status", "ativo"]),
  ) as { id: string };
  return created.id;
}

function tryDeleteTarefa(eid: string): void {
  try {
    apolloCli(["tarefa", "deletar", "--id", eid]);
  } catch {
    // Already gone — fine.
  }
}

test.beforeEach(() => {
  sweepTarefasLeftovers();
});

test.afterEach(() => {
  sweepTarefasLeftovers();
});

test("ENTTBL-08: row-edit/row-delete render with a real, positive, CSS-verified gap and a right-aligned actions column", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const titulo = uniqueName("align");
  const eid = createTarefa(titulo);

  await gotoNested(page, "tarefas");

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

  const rowEdit = row.getByTestId("row-edit");
  const rowDelete = row.getByTestId("row-delete");
  await expect(rowEdit).toBeVisible();
  await expect(rowDelete).toBeVisible();

  // Shared wrapper <div> (the immediate parent of row-delete) — real applied
  // CSS, not markup class-name string matching.
  const wrapper = rowDelete.locator("xpath=..");
  await expect(wrapper).toHaveCSS("column-gap", "8px");
  await expect(wrapper).toHaveCSS("justify-content", "flex-end");

  // Enclosing <td> — the ações column cell.
  const cell = rowDelete.locator("xpath=ancestor::td[1]");
  await expect(cell).toHaveCSS("text-align", "right");

  // Real, non-overlapping horizontal gap between the two buttons.
  const editBox = await rowEdit.boundingBox();
  const deleteBox = await rowDelete.boundingBox();
  if (!editBox || !deleteBox) throw new Error("row-edit/row-delete boxes unavailable");
  expect(deleteBox.x).toBeGreaterThan(editBox.x + editBox.width);

  // Cleanup via the shared mouse-driven confirm helper — a plain,
  // uninterrupted open+confirm round trip, safe since no dialog is open at
  // this point (no mid-sequence inspection needed, unlike Tests B-E below).
  await confirmRowDelete(page, row);
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
  // Belt-and-braces: tolerate the CLI cleanup call finding the record
  // already gone (the confirmRowDelete round trip above already deleted it).
  tryDeleteTarefa(eid);
});

test("DELCONF-01: row-delete opens a shadcn AlertDialog, not window.confirm — Cancel is focused by default", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const titulo = uniqueName("focus-default");
  const eid = createTarefa(titulo);

  try {
    await gotoNested(page, "tarefas");

    const row = page.getByTestId("row").filter({ hasText: titulo });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await row.getByTestId("row-delete").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // The deliberate onOpenAutoFocus override (16-01) — bits-ui's
    // un-configured default focuses the Content container itself, never
    // Cancel — checked empirically against real document.activeElement.
    await expect(page.getByTestId("delete-cancel")).toBeFocused();

    // Close via the safe action — not `cancelRowDelete` (which would
    // re-click the now-covered `row-delete` trigger; see file header
    // comment). Record is retained; cleaned up via the CLI below.
    await page.getByTestId("delete-cancel").click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(row).toBeVisible();
  } finally {
    tryDeleteTarefa(eid);
  }
});

test("DELCONF-01: keyboard cancel — Escape closes the AlertDialog, row retained, focus returns to row-delete", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const titulo = uniqueName("kb-cancel");
  const eid = createTarefa(titulo);

  try {
    await gotoNested(page, "tarefas");

    const row = page.getByTestId("row").filter({ hasText: titulo });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await row.getByTestId("row-delete").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("row-delete")).toBeFocused();
  } finally {
    tryDeleteTarefa(eid);
  }
});

test("DELCONF-01: keyboard confirm — Tab then Enter on the destructive Action deletes the record, focus lands on entity-create-start", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const titulo = uniqueName("kb-confirm");
  createTarefa(titulo);

  await gotoNested(page, "tarefas");

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

  await row.getByTestId("row-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();

  // Re-proves Test B's default-focus finding independently on this entity,
  // and establishes the correct starting point for the Tab-to-Action
  // keyboard sequence below.
  await expect(page.getByTestId("delete-cancel")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByTestId("delete-confirm")).toBeFocused();

  await page.keyboard.press("Enter");

  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
  await expect(page.getByTestId("entity-create-start")).toBeFocused();
  // No CLI cleanup needed — the record was genuinely deleted through the UI;
  // afterEach's sweep is a no-op belt-and-braces guard.
});

test("DELCONF-01: the AlertDialog cannot be dismissed while the delete is in flight", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const titulo = uniqueName("busy-gate");
  createTarefa(titulo);

  await gotoNested(page, "tarefas");

  const row = page.getByTestId("row").filter({ hasText: titulo });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

  await row.getByTestId("row-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();

  // Throttle the network via CDP before clicking — db.transact()'s returned
  // promise resolves only once the server acks the mutation over the
  // WebSocket (Reactor.js's pushOps/_sendMutation), not purely optimistically
  // locally; against the live app's real low-latency connection that round
  // trip can resolve in well under a Playwright assertion round trip,
  // closing the busy window before both disabled-state checks land. Latency
  // (not bandwidth) delays that ack long enough to observe the window
  // reliably, mirroring 14-02's CDP-throttle technique for the same class of
  // "genuinely transient, too-fast-on-a-real-network" state.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 800,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  try {
    // Deliberately a mouse click, not page.keyboard.press("Enter") — races
    // the immediately-following disabled-state assertions against the real,
    // unresolved db.transact promise, mirroring Phase 15's ENTFRM-07
    // technique.
    await page.getByTestId("delete-confirm").click();

    // Auto-retrying assertions, fired concurrently so both start polling
    // from the same instant — proves the busy state is genuinely observable
    // during the in-flight InstantDB write round trip, not just structurally
    // wired but invisible.
    await Promise.all([
      expect(page.getByTestId("delete-confirm")).toBeDisabled(),
      expect(page.getByTestId("delete-cancel")).toBeDisabled(),
    ]);

    // Ignored while busy — the dialog must not close.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible();
  } finally {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }

  // Once the write actually resolves, the dialog closes and the row is gone.
  await expect(page.getByTestId("row").filter({ hasText: titulo })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
  // No CLI cleanup needed — the record was genuinely deleted through the UI;
  // afterEach's sweep is a no-op belt-and-braces guard.
});

test("ENTTBL-08/DELCONF-01 capability safety: restricted and read-only entities gain no new delete affordance", async ({
  page,
}) => {
  test.setTimeout(60_000);

  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  const dedupeKey = uniqueName("dedupe");
  const dataPrevista = "2026-04-01T00:00:00.000Z";
  const competencia = uniqueName("competencia");
  const campo = uniqueName("campo");
  const valorInferido = uniqueName("valor");

  const instanciaEid = await seedInstance(
    { dedupeKey, dataPrevista, competencia, tipoPrazo: "hard", status: "pendente" },
    OWNER_EMAIL,
  );
  const logCreated = JSON.parse(
    apolloCli([
      "log-inferencia",
      "registrar",
      "--campo",
      campo,
      "--valor-inferido",
      valorInferido,
      "--entidade-tipo",
      "tarefas",
      "--entidade-id",
      `${PREFIX}fixture-entidade`,
    ]),
  ) as { id: string };

  try {
    await page.goto("/");
    await page.getByTestId("nav-instanciasRotina").click();
    const instanciaRow = page.getByTestId("row").filter({ hasText: competencia });
    await expect(instanciaRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("row-delete")).toHaveCount(0);

    await page.getByTestId("nav-logInferenciaClaude").click();
    const logRow = page.getByTestId("row").filter({ hasText: campo });
    await expect(logRow).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("row-edit")).toHaveCount(0);
    await expect(page.getByTestId("row-delete")).toHaveCount(0);
  } finally {
    await deleteInstance(instanciaEid);
    await deleteAdminRecord("logInferenciaClaude", logCreated.id);
  }
});
