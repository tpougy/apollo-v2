import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { semanaUtil } from "../src/lib/dashboard/derive.ts";
import {
  deleteInstance,
  seedInstance,
  sweepInstancesByDedupeKeyPrefix,
} from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase23-e2e-fundo-`
// prefix so leftovers are greppable/removable, mirroring every other Phase 23
// spec's established CLI-fixture/sweep-leftovers pattern.
//
// WR-02 (Phase 30 code review): this file's own PREFIX is deliberately
// file-unique, NOT the bare `phase23-e2e-` shared by focus-dialog-projeto.spec.ts
// et al. This file calls `sweepInstancesByDedupeKeyPrefix`, which matches
// purely on dedupeKey-prefix + owner with no other discriminator -- a shared
// literal prefix across files that all call it would let one file's sweep
// delete another file's in-flight instanciasRotina rows if the suite's
// `workers: 1`/`fullyParallel: false` (playwright.config.ts) were ever
// relaxed. Keep this suffix unique among focus-dialog-entidade.spec.ts,
// focus-dialog-dia-rotina.spec.ts, and focus-dialog-button-inventory.spec.ts
// (the three files that call the sweep) if you ever rename it.
//
// This file is Plan 23-05's own complete proof of the Entidade dialog
// (dialog #5 of 7, formerly the "Fundo" dialog -- quick task 260922-vbt
// generalized `fundos` to `entidades`) plus the two remaining
// entidade-targeting click surfaces -- RoutinesByEntidade.svelte's
// rotinas-entidade-titulo/rotinas-row and ProjectStrips.svelte's
// project-strip-entidade-badge -- with an explicit, tested null-entidade
// no-op guard (spec has no Entidade dialog for "no entidade").

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase23-e2e-fundo-";
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
    const args = [...group.split(" "), "deletar", "--id", eid];
    if (group === "rotina template") args.push("--force");
    apolloCli(args);
  } catch {
    // Already gone -- fine.
  }
}

async function sweepLeftovers(): Promise<void> {
  // Order matters: etapas before projetos before rotina templates before
  // tickets before entidades -- InstantDB does not cascade-delete linked rows
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
  const entidades = JSON.parse(apolloCli(["entidade", "listar"])) as { id: string; nome: string }[];
  for (const record of entidades) {
    if (record.nome.startsWith(PREFIX)) tryDelete("entidade", record.id);
  }
  await sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL);
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeSemana(): { dias: string[]; sabado: string; domingo: string } {
  return semanaUtil(hojeIso());
}

// A date many weeks outside computeSemana()'s own 7-key window -- guaranteed
// distinct from RoutinesByEntidade's own week-scoped card, proving the
// Entidade dialog's rotina list is genuinely week-unbounded.
function weeksOutIso(): string {
  const d = new Date(`${hojeIso()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 42);
  return d.toISOString().slice(0, 10);
}

test.beforeAll(async () => {
  await sweepLeftovers();
});

test.afterAll(async () => {
  await sweepLeftovers();
});

test.describe("Phase 23 Plan 05: Entidade dialog + entidade-badge/rotinas-entidade-titulo/rotinas-row wiring", () => {
  const semana = computeSemana();

  let entidadeId = "";
  let entidadeNome = "";

  let projetoId = "";
  let projetoNome = "";
  let etapaId = "";

  let projetoSemEntidadeId = "";
  let projetoSemEntidadeNome = "";
  let etapaSemEntidadeId = "";

  let ticketId = "";
  let ticketTitulo = "";

  let templateId = "";
  let templateNome = "";
  let rotinaInWeekId = "";
  let rotinaWeeksOutId = "";

  let templateSemEntidadeId = "";
  let rotinaSemEntidadeId = "";

  const rotinaInWeekDate = semana.dias[0];
  const rotinaWeeksOutDate = weeksOutIso();
  const rotinaSemEntidadeDate = semana.dias[0];

  test.beforeAll(async () => {
    entidadeNome = uniqueName("fundo");
    entidadeId = (
      JSON.parse(
        apolloCli([
          "entidade",
          "criar",
          "--nome",
          entidadeNome,
          "--codigo",
          uniqueCodigo("P23F"),
          "--tipo-entidade",
          "Fundo",
        ]),
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
          "--entidade-id",
          entidadeId,
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

    // Second projeto, deliberately with NO --entidade-id -- exercises the
    // null-guard on its own project-strip-entidade-badge (test (c)). Needs
    // its own etapa too, since ProjectStrips.svelte's filtroEmAndamento only
    // renders a strip for a projeto with at least one etapa.
    projetoSemEntidadeNome = uniqueName("projeto-sem-fundo");
    projetoSemEntidadeId = (
      JSON.parse(
        apolloCli(["projeto", "criar", "--nome", projetoSemEntidadeNome, "--status", "ativo"]),
      ) as { id: string }
    ).id;
    etapaSemEntidadeId = (
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
          projetoSemEntidadeId,
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
          "corpo do ticket vinculado a entidade",
          "--remetente",
          "fundo@example.com",
          "--data-recebimento",
          "2026-01-01",
          "--tipo-prazo",
          "soft",
          "--status",
          "pendente",
          "--entidade-id",
          entidadeId,
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
          "M0",
          "--entidade-id",
          entidadeId,
        ]),
      ) as { id: string }
    ).id;

    // One rotina instance dated INSIDE this week's own 7-date window --
    // renders RoutinesByEntidade's own week-scoped card for this entidade
    // (whose rotinas-entidade-titulo test (a) clicks).
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
    // window -- absent from RoutinesByEntidade's own card, but must be
    // present in the Entidade dialog's genuinely week-unbounded rotina list.
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

    // A template with NO entidade, plus one in-week instance -- forces
    // RoutinesByEntidade's "Sem entidade vinculada" group to exist (test (d)).
    templateSemEntidadeId = (
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
          "M0",
        ]),
      ) as { id: string }
    ).id;
    rotinaSemEntidadeId = await seedInstance(
      {
        dedupeKey: uniqueName("dedupe-sem-fundo"),
        dataPrevista: `${rotinaSemEntidadeDate}T00:00:00.000Z`,
        competencia: "2026-08",
        tipoPrazo: "hard",
        status: "pendente",
      },
      OWNER_EMAIL,
      templateSemEntidadeId,
    );
  });

  test.afterAll(async () => {
    if (rotinaInWeekId) await deleteInstance(rotinaInWeekId);
    if (rotinaWeeksOutId) await deleteInstance(rotinaWeeksOutId);
    if (rotinaSemEntidadeId) await deleteInstance(rotinaSemEntidadeId);
    tryDelete("rotina template", templateId);
    tryDelete("rotina template", templateSemEntidadeId);
    tryDelete("ticket", ticketId);
    tryDelete("etapa", etapaId);
    tryDelete("etapa", etapaSemEntidadeId);
    tryDelete("projeto", projetoId);
    tryDelete("projeto", projetoSemEntidadeId);
    tryDelete("entidade", entidadeId);
  });

  test("(a) rotinas-entidade-titulo opens the Entidade dialog at M width containing both rotina instances (in-week and weeks-out), the linked projeto, and the linked ticket", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-entidade-card"][data-eid="${entidadeId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await card.getByTestId("rotinas-entidade-titulo").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(entidadeNome);

    const rotinas = dialog.getByTestId("entidade-dialog-rotinas");
    await expect(rotinas).toContainText(rotinaInWeekDate);
    await expect(rotinas).toContainText(rotinaWeeksOutDate);

    await expect(dialog.getByTestId("entidade-dialog-projetos")).toContainText(projetoNome);
    await expect(dialog.getByTestId("entidade-dialog-tickets")).toContainText(ticketTitulo);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(b) project-strip-entidade-badge for the same projeto opens the identical Entidade dialog (same entidade id, same content)", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await strip.getByTestId("project-strip-entidade-badge").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(dialog).toHaveClass(/sm:max-w-3xl/);
    await expect(dialog).toContainText(entidadeNome);

    const rotinas = dialog.getByTestId("entidade-dialog-rotinas");
    await expect(rotinas).toContainText(rotinaInWeekDate);
    await expect(rotinas).toContainText(rotinaWeeksOutDate);
    await expect(dialog.getByTestId("entidade-dialog-projetos")).toContainText(projetoNome);
    await expect(dialog.getByTestId("entidade-dialog-tickets")).toContainText(ticketTitulo);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(c) the no-entidade projeto's entidade-badge is a real <button> but clicking it opens no dialog at all", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const strip = page.locator(`[data-testid="project-strip"][data-eid="${projetoSemEntidadeId}"]`);
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const badge = strip.getByTestId("project-strip-entidade-badge");
    await expect(badge).toBeVisible();
    expect(await badge.evaluate((el) => el.tagName)).toBe("BUTTON");

    await badge.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("(d) rotinas-entidade-titulo for the 'Sem entidade vinculada' card is likewise a no-op", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const semEntidadeCard = page.locator('[data-testid="rotinas-entidade-card"][data-eid=""]');
    await expect(semEntidadeCard).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const titulo = semEntidadeCard.getByTestId("rotinas-entidade-titulo");
    await expect(titulo).toHaveText("Sem entidade vinculada");

    await titulo.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("(e) a rotinas-row click opens the Rotina dialog for that exact instance, and the enclosing Entidade dialog never also opens", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-entidade-card"][data-eid="${entidadeId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    const row = card.locator(`[data-testid="rotinas-row"][data-eid="${rotinaInWeekId}"]`);
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await row.click();

    // Only one Dialog.Content is ever visible -- proving rotinas-row's
    // stopPropagation prevented the enclosing card's rotinas-entidade-titulo
    // handler from also firing (T-23-13's mitigation).
    await expect(page.getByRole("dialog")).toHaveCount(1, { timeout: RESYNC_TIMEOUT });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveClass(/sm:max-w-md/);
    await expect(dialog).not.toHaveClass(/sm:max-w-3xl/);
    await expect(dialog.getByTestId("entidade-dialog-rotinas")).toHaveCount(0);
    await expect(dialog).toContainText(templateNome);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
  });

  test("(f) editar drives EntityScreen(entidades)'s real edit form; ver-pagina navigates to nav-entidades", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const card = page.locator(`[data-testid="rotinas-entidade-card"][data-eid="${entidadeId}"]`);
    await expect(card).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await card.getByTestId("rotinas-entidade-titulo").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await page.getByTestId("focus-dialog-editar").click();
    const fieldNome = page.getByTestId("field-nome");
    await expect(fieldNome).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(fieldNome).toHaveValue(entidadeNome);
    await expect(page.getByRole("dialog")).toHaveCount(2);

    await page.getByTestId("entity-cancel").click();
    await expect(fieldNome).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.getByTestId("focus-dialog-ver-pagina").click();
    await expect(page.getByTestId("nav-entidades")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
