import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  deleteAdminRecord,
  deleteInstance,
  seedInstance,
} from "./fixtures/instancia-admin-fixture.ts";

// Proves ENTTBL-01/02/03 across one entity per capability class, live
// against InstantDB, post-restyle (Phase 9, Task 2). This spec runs in the
// `authed` project (restores the storageState persisted by auth.setup.ts —
// see 04-01). Every generated record uses the `phase09-e2e-` prefix so
// leftovers are greppable/removable, and every test cleans up what it
// created (success path + afterEach guard), mirroring
// entities-fundos.spec.ts / entities-rotina-log.spec.ts's discipline.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase09-e2e-";
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
      // Already gone — fine.
    }
  }
}

async function sweepLogLeftovers(): Promise<void> {
  const records = JSON.parse(apolloCli(["log-inferencia", "listar"])) as {
    id: string;
    campo: string;
  }[];
  for (const record of records) {
    if (record.campo.startsWith(PREFIX)) {
      await deleteAdminRecord("logInferenciaClaude", record.id);
    }
  }
}

test.beforeEach(async () => {
  sweepFundosLeftovers();
  await sweepLogLeftovers();
});

test.afterEach(async () => {
  sweepFundosLeftovers();
  await sweepLogLeftovers();
});

test("ENTTBL: fundos (full-CRUD) — Table role, Badge on ativo, row count matches query", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const nomeAtivo = uniqueName("ativo");
  const codigoAtivo = uniqueName("ativo-cod");
  const nomeInativo = uniqueName("inativo");
  const codigoInativo = uniqueName("inativo-cod");

  const createdAtivo = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", nomeAtivo, "--codigo", codigoAtivo, "--ativo"]),
  ) as { id: string };
  const createdInativo = JSON.parse(
    apolloCli(["fundo", "criar", "--nome", nomeInativo, "--codigo", codigoInativo, "--inativo"]),
  ) as { id: string };

  try {
    await page.goto("/");
    await page.getByTestId("nav-fundos").click();

    // Native <table> (rendered by shadcn Table) carries an implicit ARIA
    // role of "table" with zero markup change needed for this assertion.
    await expect(page.getByRole("table")).toBeVisible();

    const rowAtivo = page.getByTestId("row").filter({ hasText: nomeAtivo });
    const rowInativo = page.getByTestId("row").filter({ hasText: nomeInativo });
    await expect(rowAtivo).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(rowInativo).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // Two distinct Badge values simultaneously visible in the same table —
    // ENTTBL-02's "at least one entity with multiple distinct status values
    // visible at once".
    await expect(rowAtivo.locator('[data-slot="badge"]')).toHaveText("sim");
    await expect(rowInativo.locator('[data-slot="badge"]')).toHaveText("não");

    // Row count matches the live query result (ENTTBL-01) — at least the two
    // rows this test just seeded.
    expect(await page.getByTestId("row").count()).toBeGreaterThanOrEqual(2);
  } finally {
    apolloCli(["fundo", "deletar", "--id", createdAtivo.id]);
    apolloCli(["fundo", "deletar", "--id", createdInativo.id]);
  }
});

test("ENTTBL: instanciasRotina (restricted) — status Badge, zero create/delete, status-only edit", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const dedupeKey = uniqueName("dedupe");
  const dataPrevista = "2026-04-01T00:00:00.000Z";
  const competencia = uniqueName("competencia");
  const eid = await seedInstance(
    {
      dedupeKey,
      dataPrevista,
      competencia,
      tipoPrazo: "hard",
      status: "pendente",
    },
    OWNER_EMAIL,
  );

  try {
    await page.goto("/");
    await page.getByTestId("nav-instanciasRotina").click();

    await expect(page.getByRole("table")).toBeVisible();

    const row = page.getByTestId("row").filter({ hasText: competencia });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // status column renders as a Badge (tipoPrazo also name-matches the
    // Badge allowlist here per 09-PATTERNS.md, so at least one — not
    // necessarily exactly one — Badge is expected on this row).
    expect(await row.locator('[data-slot="badge"]').count()).toBeGreaterThanOrEqual(1);

    // No create action anywhere on the screen (ENTTBL-03).
    await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
    // No delete action anywhere on the screen.
    await expect(page.getByTestId("row-delete")).toHaveCount(0);
    // Exactly one status-narrowed edit action on the seeded row.
    await expect(row.getByTestId("row-edit")).toHaveCount(1);
  } finally {
    await deleteInstance(eid);
  }
});

test("ENTTBL: logInferenciaClaude (read-only) — zero Badges, zero row actions of any kind", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const campo = uniqueName("campo");
  const valorInferido = uniqueName("valor");

  const created = JSON.parse(
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
      "phase09-e2e-fixture-entidade",
    ]),
  ) as { id: string };

  try {
    await page.goto("/");
    await page.getByTestId("nav-logInferenciaClaude").click();

    await expect(page.getByRole("table")).toBeVisible();

    const row = page.getByTestId("row").filter({ hasText: campo });
    await expect(row).toBeVisible({ timeout: RESYNC_TIMEOUT });

    // None of logInferenciaClaude's listColumns (createdAt/entidadeTipo/
    // campo/valorInferido) match the Badge allowlist or a boolean kind.
    await expect(page.locator('[data-slot="badge"]')).toHaveCount(0);

    // Zero row actions of any kind, anywhere on the screen.
    await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
    await expect(page.getByTestId("row-edit")).toHaveCount(0);
    await expect(page.getByTestId("row-delete")).toHaveCount(0);
  } finally {
    // No `deletar` command exists for this append-only entity — delete via
    // the admin-only test fixture, mirroring entities-rotina-log.spec.ts's
    // WEB-09 precedent.
    await deleteAdminRecord("logInferenciaClaude", created.id);
  }
});
