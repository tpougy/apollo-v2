import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { sweepInstancesByDedupeKeyPrefix } from "./fixtures/instancia-admin-fixture.ts";
import { gotoNested } from "./helpers/gotoNested.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase04-e2e-` prefix so
// leftovers are greppable/removable, and every test cleans up what it
// created (success path + afterEach guard), mirroring
// entities-rotina-log.spec.ts's established shape.
//
// Task 1 (TOOLTIP-01) creates no templatesRotina record — a tooltip is pure
// client-side render inside the still-open create dialog — but the
// apolloCli/uniqueName/sweepLeftovers harness is scaffolded now so Tasks 2/3
// (TOOLTIP-02, CLEAR-01) can add tests without re-plumbing it.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const PREFIX = "phase04-e2e-";
const OWNER_EMAIL = "tp@rbrasset.com.br";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

// Exported (not merely module-local) so Task 1's own `bun run check` doesn't
// flag it as an unused local: TOOLTIP-01 (this task) doesn't need it, but
// it's scaffolded now — mirroring entities-rotina-log.spec.ts's shape — so
// Tasks 2/3's TOOLTIP-02/CLEAR-01 tests can use it without re-plumbing.
export function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function tryDeleteTemplate(eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli(["rotina", "template", "deletar", "--id", eid, "--force"]);
  } catch {
    // Already gone — fine.
  }
}

async function sweepLeftovers(): Promise<void> {
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDeleteTemplate(record.id);
  }
  await sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL);
}

test.beforeEach(async () => {
  await sweepLeftovers();
});

test.afterEach(async () => {
  await sweepLeftovers();
});

test("TOOLTIP-01: ativo's help tooltip appears on hover and on keyboard focus", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await gotoNested(page, "templatesRotina");
  await page.getByTestId("entity-create-start").click();

  const helpTrigger = page.getByTestId("field-help-ativo");
  const tooltipContent = page.locator('[data-slot="tooltip-content"]');

  // Hover trigger mode.
  await helpTrigger.hover();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("job de geração");
  await page.keyboard.press("Escape");
  await expect(tooltipContent).toBeHidden();

  // Keyboard-focus trigger mode — no mouse action at all.
  await helpTrigger.focus();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("job de geração");

  await page.getByTestId("entity-cancel").click();
});

test("TOOLTIP-02: propagarAtrasoSoft's help tooltip appears on hover and keyboard focus, and honestly states its no-op status", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await gotoNested(page, "templatesRotina");
  await page.getByTestId("entity-create-start").click();

  const helpTrigger = page.getByTestId("field-help-propagarAtrasoSoft");
  const tooltipContent = page.locator('[data-slot="tooltip-content"]');

  // Hover trigger mode.
  await helpTrigger.hover();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("reservado");
  await expect(tooltipContent).toContainText("soft");
  await page.keyboard.press("Escape");
  await expect(tooltipContent).toBeHidden();

  // Keyboard-focus trigger mode — no mouse action at all.
  await helpTrigger.focus();
  await expect(tooltipContent).toBeVisible();
  await expect(tooltipContent).toContainText("reservado");
  await expect(tooltipContent).toContainText("soft");

  await page.getByTestId("entity-cancel").click();
});
