import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { semanaUtil } from "../src/lib/dashboard/derive.ts";
import { deleteInstance, seedInstance } from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-` prefix so
// leftovers are greppable/removable, mirroring every other Phase 23 spec's
// established CLI-fixture/sweep-leftovers pattern.
//
// This file is Plan 23-05's own complete proof of the Fundo dialog (dialog #5
// of 7) plus the two remaining fundo-targeting click surfaces --
// RoutinesByFundo.svelte's rotinas-fundo-titulo/rotinas-row and
// ProjectStrips.svelte's project-strip-fundo-badge -- with an explicit,
// tested null-fundo no-op guard (spec has no Fundo dialog for "no fundo").

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase23-e2e-";
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

function uniqueCodigo(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
}

function tryDelete(group: string, eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli([...group.split(" "), "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

function sweepLeftovers(): void {
  // Order matters: etapas before projetos before rotina templates before
  // tickets before fundos -- InstantDB does not cascade-delete linked rows
  // (same discipline as focus-dialog-projetos-kanban.spec.ts's own
  // sweepLeftovers).
  const etapas = JSON.parse(apolloCli(["etapa", "listar"])) as { id: string; nome: string }[];
  for (const record of etapas) {
    if (record.nome.startsWith(PREFIX)) tryDelete("etapa", record.id);
  }
  const projetos = JSON.parse(apolloCli(["projeto", "listar"])) as { id: string; nome: string }[];
  for (const record of projetos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("projeto", record.id);
  }
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDelete("rotina template", record.id);
  }
  const tickets = JSON.parse(apolloCli(["ticket", "listar"])) as { id: string; titulo: string }[];
  for (const record of tickets) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("ticket", record.id);
  }
  const fundos = JSON.parse(apolloCli(["fundo", "listar"])) as { id: string; nome: string }[];
  for (const record of fundos) {
    if (record.nome.startsWith(PREFIX)) tryDelete("fundo", record.id);
  }
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeSemana(): { dias: string[]; sabado: string; domingo: string } {
  return semanaUtil(hojeIso());
}

// A date many weeks outside computeSemana()'s own 7-key window -- guaranteed
// distinct from RoutinesByFundo's own week-scoped card, proving the Fundo
// dialog's rotina list is genuinely week-unbounded.
function weeksOutIso(): string {
  const d = new Date(`${hojeIso()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 42);
  return d.toISOString().slice(0, 10);
}

test.beforeAll(() => {
  sweepLeftovers();
});

test.afterAll(() => {
  sweepLeftovers();
});

test.describe("Phase 23 Plan 05: Fundo dialog + fundo-badge/rotinas-fundo-titulo/rotinas-row wiring", () => {
  const semana = computeSemana();

  let fundoId = "";
  let fundoNome = "";

  let projetoId = "";
  let projetoNome = "";
  let etapaId = "";

  let projetoSemFundoId = "";
  let projetoSemFundoNome = "";
  let etapaSemFundoId = "";

  let ticketId = "";
  let ticketTitulo = "";

  let templateId = "";
  let templateNome = "";
  let rotinaInWeekId = "";
  let rotinaWeeksOutId = "";

  let templateSemFundoId = "";
  let rotinaSemFundoId = "";

  const rotinaInWeekDate = semana.dias[0];
  const rotinaWeeksOutDate = weeksOutIso();
  const rotinaSemFundoDate = semana.dias[0];

  test.beforeAll(async () => {
    fundoNome = uniqueName("fundo");
    fundoId = (
      JSON.parse(
        apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P23F")]),
      ) as { id: string }
    ).id;

    projetoNome = uniqueName("projeto");
    projetoId = (
      JSON.parse(
        apolloCli([
          "projeto",
          "criar",
          "--nome",
          projetoNome,
          "--status",
          "ativo",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;
    etapaId = (
      JSON.parse(
        apolloCli([
          "etapa",
          "criar",
          "--nome",
          uniqueName("etapa"),
          "--ordem",
          "1",
          "--status",
          "ativo",
          "--projeto-id",
          projetoId,
        ]),
      ) as { id: string }
    ).id;

    // Second projeto, deliberately with NO --fundo-id -- exercises the
    // null-guard on its own project-strip-fundo-badge (test (c)). Needs its
    // own etapa too, since ProjectStrips.svelte's filtroEmAndamento only
    // renders a strip for a projeto with at least one etapa.
    projetoSemFundoNome = uniqueName("projeto-sem-fundo");
    projetoSemFundoId = (
      JSON.parse(
        apolloCli(["projeto", "criar", "--nome", projetoSemFundoNome, "--status", "ativo"]),
      ) as { id: string }
    ).id;
    etapaSemFundoId = (
      JSON.parse(
        apolloCli([
          "etapa",
          "criar",
          "--nome",
          uniqueName("etapa-sem-fundo"),
          "--ordem",
          "1",
          "--status",
          "ativo",
          "--projeto-id",
          projetoSemFundoId,
        ]),
      ) as { id: string }
    ).id;

    ticketTitulo = uniqueName("ticket");
    ticketId = (
      JSON.parse(
        apolloCli([
          "ticket",
          "criar",
          "--titulo",
          ticketTitulo,
          "--corpo",
          "corpo do ticket vinculado ao fundo",
          "--remetente",
          "fundo@example.com",
          "--data-recebimento",
          "2026-01-01",
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    templateNome = uniqueName("template");
    templateId = (
      JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          templateNome,
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "mes-corrente",
          "--fundo-id",
          fundoId,
        ]),
      ) as { id: string }
    ).id;

    // One rotina instance dated INSIDE this week's own 7-date window --
    // renders RoutinesByFundo's own week-scoped card for this fundo (whose
    // rotinas-fundo-titulo test (a) clicks).
    rotinaInWeekId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-inweek"),
        dataPrevista: `${rotinaInWeekDate}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    // A SECOND instance, same template, dated many weeks OUTSIDE that
    // window -- absent from RoutinesByFundo's own card, but must be present
    // in the Fundo dialog's genuinely week-unbounded rotina list.
    rotinaWeeksOutId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-weeksout"),
        dataPrevista: `${rotinaWeeksOutDate}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateId,
    );

    // A template with NO fundo, plus one in-week instance -- forces
    // RoutinesByFundo's "Sem fundo vinculado" group to exist (test (d)).
    templateSemFundoId = (
      JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("template-sem-fundo"),
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "mes-corrente",
        ]),
      ) as { id: string }
    ).id;
    rotinaSemFundoId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-sem-fundo"),
        dataPrevista: `${rotinaSemFundoDate}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateSemFundoId,
    );
  });

  test.afterAll(async () => {
    if (rotinaInWeekId) await deleteInstance(rotinaInWeekId);
    if (rotinaWeeksOutId) await deleteInstance(rotinaWeeksOutId);
    if (rotinaSemFundoId) await deleteInstance(rotinaSemFundoId);
    tryDelete("rotina template", templateId);
    tryDelete("rotina template", templateSemFundoId);
    tryDelete("ticket", ticketId);
    tryDelete("etapa", etapaId);
    tryDelete("etapa", etapaSemFundoId);
    tryDelete("projeto", projetoId);
    tryDelete("projeto", projetoSemFundoId);
    tryDelete("fundo", fundoId);
  });

  test("(a) rotinas-fundo-titulo opens the Fundo dialog at M width containing both rotina instances (in-week and weeks-out), the linked projeto, and the linked ticket", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-fundo-card"][data-eid="${fundoId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await card.getByTestId("rotinas-fundo-titulo").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(fundoNome);

    const rotinas = dialog.getByTestId("fundo-dialog-rotinas");
    await expect(rotinas).toContainText(rotinaInWeekDate);
    await expect(rotinas).toContainText(rotinaWeeksOutDate);

    await expect(dialog.getByTestId("fundo-dialog-projetos")).toContainText(projetoNome);
    await expect(dialog.getByTestId("fundo-dialog-tickets")).toContainText(ticketTitulo);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(b) project-strip-fundo-badge for the same projeto opens the identical Fundo dialog (same fundo id, same content)", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await strip.getByTestId("project-strip-fundo-badge").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(fundoNome);

    const rotinas = dialog.getByTestId("fundo-dialog-rotinas");
    await expect(rotinas).toContainText(rotinaInWeekDate);
    await expect(rotinas).toContainText(rotinaWeeksOutDate);
    await expect(dialog.getByTestId("fundo-dialog-projetos")).toContainText(projetoNome);
    await expect(dialog.getByTestId("fundo-dialog-tickets")).toContainText(ticketTitulo);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(c) the no-fundo projeto's fundo-badge is a real <button> but clicking it opens no dialog at all", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoSemFundoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const badge = strip.getByTestId("project-strip-fundo-badge");
    await expect(badge).toBeVisible();
    expect(await badge.evaluate((el) => el.tagName)).toBe("BUTTON");

    await badge.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("(d) rotinas-fundo-titulo for the 'Sem fundo vinculado' card is likewise a no-op", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const semFundoCard = page.locator('[data-testid="rotinas-fundo-card"][data-eid=""]');
    await expect(semFundoCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const titulo = semFundoCard.getByTestId("rotinas-fundo-titulo");
    await expect(titulo).toHaveText("Sem fundo vinculado");

    await titulo.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("(e) a rotinas-row click opens the Rotina dialog for that exact instance, and the enclosing Fundo dialog never also opens", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-fundo-card"][data-eid="${fundoId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const row = card.locator(`[data-testid="rotinas-row"][data-eid="${rotinaInWeekId}"]`);
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await row.click();

    // Only one Dialog.Content is ever visible -- proving rotinas-row's
    // stopPropagation prevented the enclosing card's rotinas-fundo-titulo
    // handler from also firing (T-23-13's mitigation).
    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(dialog).not.toHaveClass(/sm:max-w-3xl/);
    await expect(dialog.getByTestId("fundo-dialog-rotinas")).toHaveCount(0);
    await expect(dialog).toContainText(templateNome);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(f) editar drives EntityScreen(fundos)'s real edit form; ver-pagina navigates to nav-fundos", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-fundo-card"][data-eid="${fundoId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await card.getByTestId("rotinas-fundo-titulo").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("focus-dialog-editar").click();
    const fieldNome = page.getByTestId("field-nome");
    await expect(fieldNome).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(fieldNome).toHaveValue(fundoNome);
    await expect(page.getByRole("dialog")).toHaveCount(2);

    await page.getByTestId("entity-cancel").click();
    await expect(fieldNome).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.getByTestId("focus-dialog-ver-pagina").click();
    await expect(page.getByTestId("nav-fundos")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
