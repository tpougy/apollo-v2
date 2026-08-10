import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// Proves ENTFRM-01/02 for the fundos (full-CRUD) capability class against the
// restyled shadcn Dialog/Input/Textarea/Checkbox/Popover+Calendar form, live
// against InstantDB. This spec runs in the `authed` project (restores the
// storageState persisted by auth.setup.ts — see 04-01), mirroring
// entities-fundos.spec.ts's CLI-fixture/sweep/cleanup discipline exactly.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase10-e2e-";

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
  // Date-picker interaction is added in Task 2 — plain fill for now since the
  // native date input still exists at this point in the task sequence.
  await page.getByTestId("field-createdAt").fill("2026-01-15");

  await page.getByTestId("entity-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const row = page.getByTestId("row").filter({ hasText: nome });
  await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
  const eid = await row.getAttribute("data-eid");
  expect(eid).toBeTruthy();

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
});
