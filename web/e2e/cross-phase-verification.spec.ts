import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";
import { confirmRowDelete } from "./helpers/delete-confirmation.ts";
import { pickDate } from "./helpers/form-controls.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// Phase 17 Plan 02's dedicated cross-phase proof spec. Runs in the `authed`
// project (default persisted-session `page` fixture) alongside every other
// entity spec, with one exception: the Login leg of Task 1's walkthrough and
// Task 2's Login dual-color-scheme test each build their own fresh,
// explicitly empty-storageState `browser.newContext()` — mirroring
// login-composition.spec.ts's exact mocked-magic-code-route technique — so
// this file never depends on a live magic-code email round trip, even though
// every other leg in this file uses the real live InstantDB app via the
// default `authed`-project session.
//
// Every generated record uses the `phase17-e2e-` prefix so leftovers are
// greppable/removable, mirroring entities-fundos.spec.ts's/
// entities-delete-confirmation.spec.ts's own CLI-based sweep convention.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase17-e2e-";
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

function sweepFundosLeftovers(): void {
  const listed = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of listed) {
    if (!record.nome.startsWith(PREFIX)) continue;
    try {
      apolloCli(["fundo", "deletar", "--id", record.id]);
    } catch {
      // Already gone -- fine.
    }
  }
}

function sweepTarefasLeftovers(): void {
  const listed = JSON.parse(apolloCli(["tarefa", "listar"])) as { id: string; titulo: string }[];
  for (const record of listed) {
    if (!record.titulo.startsWith(PREFIX)) continue;
    try {
      apolloCli(["tarefa", "deletar", "--id", record.id]);
    } catch {
      // Already gone -- fine.
    }
  }
}

test.beforeEach(() => {
  sweepFundosLeftovers();
  sweepTarefasLeftovers();
});

test.afterEach(() => {
  sweepFundosLeftovers();
  sweepTarefasLeftovers();
});

function createFundoViaCli(nome: string): string {
  const codigo = uniqueName("cod");
  const created = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", nome, "--codigo", codigo, "--ativo"]),
  ) as { id: string };
  return created.id;
}

function tryDeleteFundo(eid: string): void {
  try {
    apolloCli(["fundo", "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

function createTarefaViaCli(titulo: string): string {
  const created = JSON.parse(
    apolloCli(["tarefa", "criar", "--titulo", titulo, "--tipo-prazo", "hard", "--status", "ativo"]),
  ) as { id: string };
  return created.id;
}

function tryDeleteTarefa(eid: string): void {
  try {
    apolloCli(["tarefa", "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

function throwOnNativeDialog(page: Page): void {
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });
}

/**
 * Pitfall 6's direct, cheap proxy check: `document.activeElement` carries a
 * real focus-visible affordance (a non-"none" outline or box-shadow), and no
 * ancestor between it and `boundaryTestId` (exclusive) clips it via
 * `overflow: hidden`/`overflow-x: hidden`/`overflow-y: hidden`.
 */
async function assertFocusVisibleAndUnclipped(page: Page, boundaryTestId: string): Promise<void> {
  const result = await page.evaluate((boundaryId) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { found: false, hasAffordance: false, clipped: true };
    const style = getComputedStyle(el);
    const hasAffordance = style.outlineStyle !== "none" || style.boxShadow !== "none";
    const boundary = document.querySelector(`[data-testid="${boundaryId}"]`);
    let clipped = false;
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== boundary && node !== document.body) {
      const nodeStyle = getComputedStyle(node);
      if (
        nodeStyle.overflow === "hidden" ||
        nodeStyle.overflowX === "hidden" ||
        nodeStyle.overflowY === "hidden"
      ) {
        clipped = true;
        break;
      }
      node = node.parentElement;
    }
    return { found: true, hasAffordance, clipped };
  }, boundaryTestId);
  expect(result.found).toBe(true);
  expect(result.hasAffordance).toBe(true);
  expect(result.clipped).toBe(false);
}

// ---------------------------------------------------------------------------
// Task 1 (tracer): cross-phase walkthrough with spacing-parity assertions
// ---------------------------------------------------------------------------

test("VERIFY-07/POLISH-04: cross-phase walkthrough -- Login -> Shell -> fundos table/form/delete, spacing scale measured at each stop", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  throwOnNativeDialog(page);

  // ---- Login leg: fresh, empty-storageState context; magic-code send mocked ----
  const loginContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  let loginSpaceY4: string;
  let loginSpaceY2: string;
  try {
    const loginPage = await loginContext.newPage();
    await loginPage.route("**/runtime/auth/send_magic_code", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await loginPage.goto("/");
    await expect(loginPage.getByTestId("login-screen")).toBeVisible();

    loginSpaceY4 = await loginPage
      .getByTestId("login-email-field")
      .evaluate((el) => getComputedStyle(el).marginBlockEnd);
    loginSpaceY2 = await loginPage
      .locator('label[for="login-email"]')
      .evaluate((el) => getComputedStyle(el).marginBlockEnd);

    expect(loginSpaceY4).toBe("16px");
    expect(loginSpaceY2).toBe("8px");
  } finally {
    await loginContext.close();
  }

  // ---- Shell leg: default authed-project page, all 5 entity nav buttons swept ----
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const shellHeader = page.getByTestId("shell-header");
  await expect(shellHeader).toBeVisible();
  const shellGap = await shellHeader.evaluate((el) => getComputedStyle(el).columnGap);
  expect(shellGap).toBe("16px");

  const navButtons = page.locator('[data-testid^="nav-"]:not([data-testid="nav-dashboard"])');
  const navCount = await navButtons.count();
  expect(navCount).toBe(5);

  for (let i = 0; i < navCount; i++) {
    await navButtons.nth(i).click();
    const entityHeader = page.getByTestId("entity-header");
    await expect(entityHeader).toBeVisible();
    await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const entityGap = await entityHeader.evaluate((el) => getComputedStyle(el).columnGap);
    expect(entityGap).toBe(shellGap);
  }

  // ---- fundos leg: full-CRUD representative, same page ----
  await page.getByTestId("nav-fundos").click();
  await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });

  await page.getByTestId("entity-create-start").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const dialogSpaceY4 = await page
    .locator('label[for="field-nome"]')
    .locator("..")
    .evaluate((el) => getComputedStyle(el).marginBlockEnd);
  const dialogSpaceY2 = await page
    .locator('label[for="field-nome"]')
    .evaluate((el) => getComputedStyle(el).marginBlockEnd);

  // Phase 12's (Login) and Phase 15's (Dialog form) space-y-4/space-y-2
  // scales are the literal same computed values -- POLISH-04's "one
  // consistent scale" claim, measured, not assumed.
  expect(dialogSpaceY4).toBe(loginSpaceY4);
  expect(dialogSpaceY2).toBe(loginSpaceY2);

  const nome = uniqueName("walkthrough");
  const codigo = uniqueName("walkthrough-cod");
  await page.getByTestId("field-nome").fill(nome);
  await page.getByTestId("field-codigo").fill(codigo);
  await pickDate(page, "field-createdAt");
  const ativoCheckbox = page.getByTestId("field-ativo");
  if (!(await ativoCheckbox.isChecked())) {
    await ativoCheckbox.check();
  }
  await page.getByTestId("entity-submit").click();

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

  // Phase 16's gap-2 row-action wrapper, recorded for POLISH-04's record.
  const rowActionsGap = await row
    .getByTestId("row-edit")
    .locator("xpath=..")
    .evaluate((el) => getComputedStyle(el).columnGap);
  expect(rowActionsGap).toBe("8px");

  // Delete via the shadcn AlertDialog (not window.confirm() -- the
  // throwOnNativeDialog listener above would fail this test if one fired).
  await confirmRowDelete(page, row);
  await expect(page.getByTestId("row").filter({ hasText: nome })).toHaveCount(0, {
    timeout: RESYNC_TIMEOUT,
  });
});

// ---------------------------------------------------------------------------
// Permanent regression coverage for fb52d85's header-to-content spacing fix
// ---------------------------------------------------------------------------

test("POLISH-04: entity-header to content vertical gap is non-zero and on the space-y-6 scale", async ({
  page,
}) => {
  // Every other spacing assertion in this file measures row-wise gaps
  // (row-actions gap-2) or nav-header gaps (columnGap) -- none of them ever
  // measured the vertical gap between EntityScreen's own page-header and
  // whatever renders below it. This is the exact coverage gap the
  // milestone's integration audit flagged: EntityScreen's root <section>
  // shipped with no spacing class, leaving entity-header flush against the
  // table with a literal 0px gap -- a real POLISH-04 violation. fb52d85
  // fixed it by adding `space-y-6` to that root <section>, matching Shell's
  // own top-level space-y-6 scale (Shell.svelte:82) one level down. This
  // test is a PERMANENT regression guard for that fix (the original proof
  // was a throwaway scratch spec, since deleted).
  //
  // Tailwind's space-y utility applies its gap as `margin-block-end` on
  // every child except the last one -- entity-header is the section's
  // first, non-last child (the table/loading/empty block always follows
  // it), so the fix surfaces directly as `marginBlockEnd` on entity-header
  // itself, the same measurement technique already used above for Login's
  // and the Dialog's space-y-4/space-y-2 scales.
  await page.goto("/");
  await page.getByTestId("nav-fundos").click();
  const entityHeader = page.getByTestId("entity-header");
  await expect(entityHeader).toBeVisible();
  await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });

  const headerToContentGap = await entityHeader.evaluate(
    (el) => getComputedStyle(el).marginBlockEnd,
  );
  expect(headerToContentGap).not.toBe("0px");
  expect(headerToContentGap).toBe("24px"); // space-y-6, the milestone's page-level rhythm scale

  // Corroborate with the actual rendered box gap, not just the CSS property
  // in isolation -- proves the space genuinely renders, not merely that the
  // class is present.
  const headerBox = await entityHeader.boundingBox();
  const contentBox = await page.getByTestId("entity-table-frame").boundingBox();
  if (!headerBox || !contentBox) {
    throw new Error("expected both entity-header and entity-table-frame to report a bounding box");
  }
  const renderedGap = contentBox.y - (headerBox.y + headerBox.height);
  expect(renderedGap).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Task 2: remaining dual-color-scheme coverage
// ---------------------------------------------------------------------------

test("VERIFY-05/POLISH-03: LoginScreen Card/CardHeader legible in both color schemes", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    const backgrounds: string[] = [];
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      const card = page.locator('[data-slot="card"]');
      await expect(page.locator('[data-slot="card-header"]')).toBeVisible();
      await expect(card).toBeVisible();
      backgrounds.push(await card.evaluate((el) => getComputedStyle(el).backgroundColor));
    }
    expect(backgrounds[0]).not.toBe(backgrounds[1]);
  } finally {
    await context.close();
  }
});

test("VERIFY-05/POLISH-03: Shell header and all 6 nav buttons legible in both color schemes", async ({
  page,
}) => {
  const backgrounds: string[] = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    const header = page.getByTestId("shell-header");
    await expect(header).toBeVisible();
    const navButtons = page.locator('[data-testid^="nav-"]');
    await expect(navButtons).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await expect(navButtons.nth(i)).toBeVisible();
    }
    // shell-header itself has no explicit bg-* class (it's transparent,
    // revealing the page surface underneath), so measure the actual
    // rendered surface it sits on -- document.body's bg-background
    // (app.css's `body { @apply bg-background text-foreground; }`) -- the
    // real, legible-or-not color this chrome is displayed against.
    backgrounds.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});

test("VERIFY-05/POLISH-03: tarefas create Dialog legible in both color schemes, zero write", async ({
  page,
}) => {
  const backgrounds: string[] = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await gotoNested(page, "tarefas");
    await page.getByTestId("entity-create-start").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    backgrounds.push(await dialog.evaluate((el) => getComputedStyle(el).backgroundColor));
    await page.getByTestId("entity-cancel").click();
    await expect(dialog).toHaveCount(0);
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});

test("VERIFY-05/POLISH-03: tarefas delete-confirmation AlertDialog legible in both color schemes, zero write", async ({
  page,
}) => {
  test.setTimeout(60_000);
  throwOnNativeDialog(page);

  const titulo = uniqueName("dualscheme");
  const eid = createTarefaViaCli(titulo);
  try {
    const backgrounds: string[] = [];
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await gotoNested(page, "tarefas");
      const row = page.getByTestId("row").filter({ hasText: titulo });
      await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

      await row.getByTestId("row-delete").click();
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      backgrounds.push(await alertDialog.evaluate((el) => getComputedStyle(el).backgroundColor));

      // Cancel directly -- not the cancelRowDelete helper, which re-clicks
      // the now-covered row-delete trigger (see entities-delete-confirmation.spec.ts's
      // file header comment for why that pattern is unsafe mid-dialog).
      await page.getByTestId("delete-cancel").click();
      await expect(alertDialog).toHaveCount(0);
      await expect(row).toBeVisible();
    }
    expect(backgrounds[0]).not.toBe(backgrounds[1]);
  } finally {
    tryDeleteTarefa(eid);
  }
});

// ---------------------------------------------------------------------------
// Task 2: keyboard/focus-visible smoke tests, one per capability class
// ---------------------------------------------------------------------------

test("VERIFY-05: keyboard/focus-visible smoke -- fundos (full-CRUD): Tab reaches row-edit then row-delete, both with a real, unclipped focus-visible affordance", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const nome = uniqueName("kb-fundo");
  const eid = createFundoViaCli(nome);
  try {
    await page.goto("/");
    await page.getByTestId("nav-fundos").click();
    const row = page.getByTestId("row").filter({ hasText: nome });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("entity-create-start").focus();
    await expect(page.getByTestId("entity-create-start")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(row.getByTestId("row-edit")).toBeFocused();
    await assertFocusVisibleAndUnclipped(page, "entity-table-frame");

    await page.keyboard.press("Tab");
    await expect(row.getByTestId("row-delete")).toBeFocused();
    await assertFocusVisibleAndUnclipped(page, "entity-table-frame");
  } finally {
    tryDeleteFundo(eid);
  }
});

test("VERIFY-05: keyboard/focus-visible smoke -- instanciasRotina (restricted, update-only): Tab reaches row-edit (the only row action available) with a real, unclipped focus-visible affordance", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const dedupeKey = uniqueName("dedupe");
  const competencia = uniqueName("competencia");
  const instanceId = await seedInstance(
    {
      dedupeKey,
      dataPrevista: "2026-05-01T00:00:00.000Z",
      competencia,
      tipoPrazo: "hard",
      status: "pendente",
    },
    OWNER_EMAIL,
  );
  try {
    await page.goto("/");
    await page.getByTestId("nav-instanciasRotina").click();
    // This live app's instanciasRotina table is never guaranteed empty
    // (Shell.svelte's routine-instance generation job runs on every
    // authenticated mount and can create real rows independent of this
    // test's own seeded record) -- so, unlike fundos, this test asserts on
    // whichever row-edit Tab reaches, not a specific row filtered by this
    // test's own competencia. The seeded record below only guarantees at
    // least one row exists even on a completely fresh app instance.
    await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("row").first()).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("row-delete")).toHaveCount(0); // capability-gated off, confirms Tab has nothing else to reach

    // instanciasRotina's own nav button is not necessarily the last one in
    // the nav bar (it is not, by ordem) -- Tab forward from it would land on
    // the NEXT nav button, not into the active screen's content, since every
    // nav button precedes <main> in DOM order regardless of which entity is
    // active. Tab through every remaining nav button, then through Plan
    // 18-01's interim `nested-goto` Select trigger (also inside <main>,
    // between <nav> and the active screen's content), plus one more to
    // enter <main>'s active screen, to reach the first focusable element in
    // this capability class's content -- a row-edit button, the only row
    // action available.
    const navButtons = page.locator('[data-testid^="nav-"]');
    const navTestIds = await navButtons.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    const idx = navTestIds.indexOf("nav-instanciasRotina");
    expect(idx).toBeGreaterThanOrEqual(0);
    await navButtons.nth(idx).focus();
    await expect(navButtons.nth(idx)).toBeFocused();

    const tabsToRowEdit = navTestIds.length - idx + 1;
    for (let i = 0; i < tabsToRowEdit; i++) {
      await page.keyboard.press("Tab");
    }
    const focusedTestId = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? null,
    );
    expect(focusedTestId).toBe("row-edit");
    await assertFocusVisibleAndUnclipped(page, "entity-table-frame");
  } finally {
    await deleteInstance(instanceId);
  }
});

test("VERIFY-05: keyboard/focus-visible smoke -- logInferenciaClaude (read-only, zero row actions): Tab reaches the nav control itself with a real, unclipped focus-visible affordance", async ({
  page,
}) => {
  await page.goto("/");

  // logInferenciaClaude has ordem 9, the highest of all 9 entities, so it
  // renders LAST in the nav bar (entityConfigs is sorted ascending by
  // ordem) -- it therefore cannot be the *source* of a forward Tab that
  // "reaches the next nav button" (there is none after it). Instead, Tab
  // from its immediate predecessor in nav order to confirm it IS reachable
  // via Tab, then assert the focus-visible affordance on the nav control
  // itself, since (by design) this capability class renders zero in-table
  // interactive elements for Tab to reach beyond it.
  const navButtons = page.locator('[data-testid^="nav-"]');
  const navTestIds = await navButtons.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-testid")),
  );
  const idx = navTestIds.indexOf("nav-logInferenciaClaude");
  expect(idx).toBeGreaterThan(0);

  await navButtons.nth(idx - 1).focus();
  await expect(navButtons.nth(idx - 1)).toBeFocused();

  await page.keyboard.press("Tab");
  const navLogInferencia = page.getByTestId("nav-logInferenciaClaude");
  await expect(navLogInferencia).toBeFocused();
  await assertFocusVisibleAndUnclipped(page, "shell-content-frame");

  // Structurally inert by design: no create button, no row-edit/row-delete
  // exist anywhere on this read-only screen.
  await navLogInferencia.click();
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
  await expect(page.getByTestId("row-edit")).toHaveCount(0);
  await expect(page.getByTestId("row-delete")).toHaveCount(0);
});
