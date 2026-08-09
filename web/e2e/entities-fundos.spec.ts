import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts — see 04-01). Every generated record uses the
// `phase04-e2e-` prefix so leftovers are greppable/removable, and every test
// cleans up what it created (success path + afterEach guard), per T-04-08.
//
// Post-reload assertions use a generous timeout (RESYNC_TIMEOUT): a reload
// forces the real InstantDB Reactor to re-authenticate and re-sync over the
// network before the reactive query reflects server-confirmed state, and
// that round trip against the live hosted backend can occasionally exceed
// Playwright's 5s default — this is real network variance, not app logic.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `phase04-e2e-${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

// Ids of any CLI-created fundo this file's tests create, for the afterEach
// cleanup guard (belt-and-braces on top of each test's own success-path
// cleanup, in case an assertion fails mid-test, or the row's disappearance
// from the DOM turns out to have been an optimistic-only local update that
// hadn't actually persisted server-side yet). Deleting an already-deleted
// id is harmless — the CLI's not-found guard is swallowed here by design.
const cliCreatedIds: string[] = [];

function sweepLeftovers(): void {
  const listed = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of listed) {
    if (!record.nome.startsWith("phase04-e2e-")) continue;
    try {
      apolloCli(["fundo", "deletar", "--id", record.id]);
    } catch {
      // Already gone — fine.
    }
  }
}

// Guarantee a clean slate before every test, regardless of what a previous
// (possibly flaky, network-dependent) run left behind — makes the suite
// idempotent even if an earlier invocation's cleanup didn't complete.
test.beforeEach(() => {
  sweepLeftovers();
});

test.afterEach(() => {
  while (cliCreatedIds.length > 0) {
    const eid = cliCreatedIds.pop();
    if (!eid) continue;
    try {
      apolloCli(["fundo", "deletar", "--id", eid]);
    } catch {
      // Already deleted by the test's own success-path cleanup — fine.
    }
  }
  sweepLeftovers();
});

test("SC-3: a fundo created by the CLI is visible in the SPA", async ({ page }) => {
  const nome = uniqueName("cli-visible");
  const codigo = uniqueName("cli-visible-cod");

  const createOutput = apolloCli(["fundo", "criar", "--nome", nome, "--codigo", codigo, "--ativo"]);
  const created = JSON.parse(createOutput) as { id: string };
  cliCreatedIds.push(created.id);

  await page.goto("/");
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("row").filter({ hasText: nome })).toBeVisible();

  apolloCli(["fundo", "deletar", "--id", created.id]);

  await page.reload();
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("row").filter({ hasText: nome })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
  // Only stop tracking once a fresh, server-backed reload has confirmed the
  // CLI-issued delete actually persisted (not just an optimistic local view).
  cliCreatedIds.splice(cliCreatedIds.indexOf(created.id), 1);
});

test("WEB-02: full browser CRUD round trip", async ({ page }) => {
  // This test drives multiple live transact()/reload cycles against a real
  // hosted InstantDB app; give it more headroom than the 30s default for
  // occasional real-network reconnect/resync latency (mirrors 04-01's
  // auth.setup.ts precedent for the same reason).
  test.setTimeout(90_000);

  const nome = uniqueName("crud");
  const nomeEditado = `${nome}-editado`;
  const codigo = uniqueName("crud-cod");

  // Registered once, up front, for the whole test — auto-accept every
  // confirm() dialog EntityScreen shows (only "excluir" triggers one here).
  // Attaching this here (rather than right before the delete click) avoids
  // any race between "click" and "listener registration".
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

  await page.goto("/");
  await page.getByTestId("nav-fundos").click();

  // No owner-id field anywhere on the page (WEB/CLI privilege-parity proof).
  await expect(page.locator('[data-testid^="field-dono"]')).toHaveCount(0);

  // (1) Create — assert the row appears WITHOUT a page reload.
  await page.getByTestId("entity-create-start").click();
  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-codigo").fill(codigo);
  await page.getByTestId("field-createdAt").fill("2026-01-15");
  const ativoCheckbox = page.getByTestId("field-ativo");
  if (!(await ativoCheckbox.isChecked())) {
    await ativoCheckbox.check();
  }
  await page.getByTestId("entity-submit").click();

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible();
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();
  if (eid) cliCreatedIds.push(eid);

  // (2) Edit — change nome, assert row text updates and data-eid is unchanged.
  await row.getByTestId("row-edit").click();
  await page.getByTestId("field-nome").fill(nomeEditado);
  await page.getByTestId("entity-submit").click();

  const editedRow = page.getByTestId("row").filter({ hasText: nomeEditado });
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toHaveAttribute("data-eid", eid ?? "");

  // (3) Boolean false round trip — uncheck ativo, reload, assert "não" persists.
  await editedRow.getByTestId("row-edit").click();
  const ativoCheckboxEdit = page.getByTestId("field-ativo");
  if (await ativoCheckboxEdit.isChecked()) {
    await ativoCheckboxEdit.uncheck();
  }
  await page.getByTestId("entity-submit").click();
  // Wait for the transact() call to resolve (form closes on success) before
  // reloading. Note this promise can resolve as soon as InstantDB's client
  // applies the mutation locally/enqueues it for send — not necessarily once
  // the server has actually acknowledged it — so also give the WS message a
  // brief moment to actually flush before forcing a reload, which would
  // otherwise abort an in-flight send and lose the write.
  await expect(page.getByTestId("entity-submit")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByTestId("nav-fundos").click();
  const reloadedRow = page.getByTestId("row").filter({ hasText: nomeEditado });
  await expect(reloadedRow).toContainText("não", { timeout: RESYNC_TIMEOUT });

  // (4) Delete — the page-level dialog listener registered above accepts
  // the confirm() automatically; just click and assert the row is gone.
  await reloadedRow.getByTestId("row-delete").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeEditado })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });

  // Confirm the delete truly persisted server-side (not just an optimistic
  // local removal) by reloading and re-querying live data before relying on
  // it for cleanup bookkeeping or the empty-state assertion below. Give the
  // WS message a brief moment to flush first (see the analogous comment on
  // the boolean-edit reload above).
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("row").filter({ hasText: nomeEditado })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
  if (eid) {
    const idx = cliCreatedIds.indexOf(eid);
    if (idx >= 0) cliCreatedIds.splice(idx, 1);
  }

  // (5) Empty-state: no filter input exists on this generic screen, so —
  // per this plan's own guidance — assert the empty state renders on an
  // entity with zero records rather than forcing one via a filter. This
  // live app has no other fundos data (PROJECT.md: "no real production data
  // exists yet"), and the record this test created was just confirmed
  // deleted above, so the fundos screen itself is the entity-with-no-records
  // case here.
  await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: RESYNC_TIMEOUT });
});
