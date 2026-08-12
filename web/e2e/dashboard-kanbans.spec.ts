import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts). Every generated record uses the `phase22-e2e-` prefix so
// leftovers are greppable/removable, mirroring projetos-section.spec.ts's own
// execFileSync/apolloCli/uniqueName/tryDelete/sweepLeftovers CLI-fixture
// scaffolding exactly. This spec is additive-only -- a new file, per Plan
// 22-01's own decision (spec-ui.md section 8's file list does not dictate a
// hard split between dashboard.spec.ts and a new file; genuinely new DASH-05
// coverage lives here to keep dashboard.spec.ts's DASH-04 scope untouched).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase22-e2e-";

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
    apolloCli([group, "deletar", "--id", eid]);
  } catch {
    // Already gone -- fine.
  }
}

// Order matters: subtarefas before tarefas before etapas before projetos
// before fundos -- InstantDB does not cascade-delete linked rows.
function sweepLeftovers(): void {
  const subtarefas = JSON.parse(apolloCli(["subtarefa", "listar"])) as {
    id: string;
    titulo: string;
  }[];
  for (const record of subtarefas) {
    if (record.titulo.startsWith(PREFIX)) tryDelete("subtarefa", record.id);
  }
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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Declared BEFORE the fixture-bearing describes below, mirroring
// dashboard.spec.ts's own empty-state-before-fixtures ordering, so this
// test's assertion runs while zero phase22-e2e- projeto exists.
test.describe("DASH-05: empty state", () => {
  test("shows 'Nenhum projeto em andamento' with a working link to Projetos", async ({ page }) => {
    test.setTimeout(60_000);

    sweepLeftovers();

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("dash-projetos-empty")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("dash-projetos-empty")).toContainText(
      "Nenhum projeto em andamento",
    );

    await page.getByTestId("dash-projetos-ver-todos").click();
    await expect(page.getByTestId("nav-projetos")).toHaveAttribute("aria-current", "true", {
      timeout: RESYNC_TIMEOUT,
    });
  });
});

test.describe("DASH-05: project strip rendering", () => {
  let fundoId = "";
  let fundoNome = "";
  let projetoId = "";
  let projetoNome = "";
  let projetoSemEtapaId = "";
  let projetoSemEtapaNome = "";
  let etapaOrdem1Id = "";
  let etapaOrdem1Nome = "";
  let etapaOrdem2Id = "";
  let etapaOrdem2Nome = "";
  let tarefaAtrasadaId = "";
  let tarefaAtrasadaTitulo = "";
  let tarefaFutura1Id = "";
  let tarefaFutura1Titulo = "";
  let tarefaFutura2Id = "";
  let tarefaFutura2Titulo = "";
  let tarefaFutura3Id = "";
  let tarefaFutura3Titulo = "";
  let tarefaOrdem2Id = "";
  let tarefaOrdem2Titulo = "";

  test.beforeAll(() => {
    sweepLeftovers();

    fundoNome = uniqueName("fundo");
    const fundoCreated = JSON.parse(
      apolloCli(["fundo", "criar", "--nome", fundoNome, "--codigo", uniqueCodigo("P22")]),
    ) as { id: string };
    fundoId = fundoCreated.id;

    projetoNome = uniqueName("projeto");
    const projetoCreated = JSON.parse(
      apolloCli([
        "projeto",
        "criar",
        "--nome",
        projetoNome,
        "--status",
        "em andamento",
        "--fundo-id",
        fundoId,
      ]),
    ) as { id: string };
    projetoId = projetoCreated.id;

    projetoSemEtapaNome = uniqueName("projeto-sem-etapa");
    const projetoSemEtapaCreated = JSON.parse(
      apolloCli(["projeto", "criar", "--nome", projetoSemEtapaNome, "--status", "em andamento"]),
    ) as { id: string };
    projetoSemEtapaId = projetoSemEtapaCreated.id;

    etapaOrdem1Nome = uniqueName("etapa-ordem1");
    const etapaOrdem1Created = JSON.parse(
      apolloCli([
        "etapa",
        "criar",
        "--nome",
        etapaOrdem1Nome,
        "--ordem",
        "1",
        "--status",
        "em andamento",
        "--projeto-id",
        projetoId,
      ]),
    ) as { id: string };
    etapaOrdem1Id = etapaOrdem1Created.id;

    etapaOrdem2Nome = uniqueName("etapa-ordem2");
    const etapaOrdem2Created = JSON.parse(
      apolloCli([
        "etapa",
        "criar",
        "--nome",
        etapaOrdem2Nome,
        "--ordem",
        "2",
        "--status",
        "em andamento",
        "--projeto-id",
        projetoId,
      ]),
    ) as { id: string };
    etapaOrdem2Id = etapaOrdem2Created.id;

    const hoje = hojeIso();
    const futuraData = shiftIso(hoje, 7);
    const passadaData = shiftIso(hoje, -7);

    // ordem-1 etapa: 4 tarefas (3 future, 1 past-due with zero subtarefas so
    // it is genuinely vencida per derive.ts's tarefaConcluida/vencido rules).
    // ProjectStrips.svelte renders the FIRST 3 of an etapa's tarefas array
    // "in existing array order, no re-sort" -- InstantDB returns linked rows
    // in creation order (verified live this session via the CLI's own
    // `tarefa listar`), so the vencida tarefa is created FIRST, guaranteeing
    // it lands inside the visible 3-card slice rather than the "+1"
    // overflow row, which is required for this file's destructive-styling
    // assertion below to have anything to assert against.
    tarefaAtrasadaTitulo = uniqueName("tarefa-atrasada");
    const tarefaAtrasadaCreated = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaAtrasadaTitulo,
        "--tipo-prazo",
        "hard",
        "--status",
        "pendente",
        "--data-prevista",
        passadaData,
        "--etapa-id",
        etapaOrdem1Id,
      ]),
    ) as { id: string };
    tarefaAtrasadaId = tarefaAtrasadaCreated.id;

    tarefaFutura1Titulo = uniqueName("tarefa-futura1");
    const tarefaFutura1Created = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaFutura1Titulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        futuraData,
        "--etapa-id",
        etapaOrdem1Id,
      ]),
    ) as { id: string };
    tarefaFutura1Id = tarefaFutura1Created.id;

    tarefaFutura2Titulo = uniqueName("tarefa-futura2");
    const tarefaFutura2Created = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaFutura2Titulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        futuraData,
        "--etapa-id",
        etapaOrdem1Id,
      ]),
    ) as { id: string };
    tarefaFutura2Id = tarefaFutura2Created.id;

    // This one intentionally falls into the "+1 tarefas" overflow row --
    // never asserted on individually, only via the overflow count.
    tarefaFutura3Titulo = uniqueName("tarefa-futura3");
    const tarefaFutura3Created = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaFutura3Titulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        futuraData,
        "--etapa-id",
        etapaOrdem1Id,
      ]),
    ) as { id: string };
    tarefaFutura3Id = tarefaFutura3Created.id;

    // ordem-2 etapa: 1 tarefa (future).
    tarefaOrdem2Titulo = uniqueName("tarefa-ordem2");
    const tarefaOrdem2Created = JSON.parse(
      apolloCli([
        "tarefa",
        "criar",
        "--titulo",
        tarefaOrdem2Titulo,
        "--tipo-prazo",
        "soft",
        "--status",
        "pendente",
        "--data-prevista",
        futuraData,
        "--etapa-id",
        etapaOrdem2Id,
      ]),
    ) as { id: string };
    tarefaOrdem2Id = tarefaOrdem2Created.id;
  });

  test.afterAll(() => {
    tryDelete("tarefa", tarefaFutura1Id);
    tryDelete("tarefa", tarefaFutura2Id);
    tryDelete("tarefa", tarefaFutura3Id);
    tryDelete("tarefa", tarefaAtrasadaId);
    tryDelete("tarefa", tarefaOrdem2Id);
    tryDelete("etapa", etapaOrdem1Id);
    tryDelete("etapa", etapaOrdem2Id);
    tryDelete("projeto", projetoId);
    tryDelete("projeto", projetoSemEtapaId);
    tryDelete("fundo", fundoId);
    sweepLeftovers();
  });

  test("DASH-05: a projeto with zero etapas never gets a strip", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await expect(page.getByTestId("dash-grid")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("project-strip").filter({ hasText: projetoNome })).toBeVisible({
      timeout: RESYNC_TIMEOUT,
    });

    const semEtapaStrip = page.locator(
      `[data-testid="project-strip"][data-eid="${projetoSemEtapaId}"]`,
    );
    await expect(semEtapaStrip).toHaveCount(0);

    const allStripEids = await page
      .getByTestId("project-strip")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-eid")));
    expect(allStripEids).not.toContain(projetoSemEtapaId);
  });

  test("DASH-05: header meta, equal fixed-width AND equal-height columns regardless of card count, 3+1 overflow split", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    const strip = page.getByTestId("project-strip").filter({ hasText: projetoNome });
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    await expect(strip.getByTestId("project-strip-meta")).toHaveText("2 etapas - 5 tarefas");

    const columns = strip.getByTestId("project-strip-column");
    await expect(columns).toHaveCount(2);

    const col1 = strip.locator(`[data-testid="project-strip-column"][data-eid="${etapaOrdem1Id}"]`);
    const col2 = strip.locator(`[data-testid="project-strip-column"][data-eid="${etapaOrdem2Id}"]`);

    await expect(col1.getByTestId("project-strip-card")).toHaveCount(3);
    await expect(col1.getByTestId("project-strip-card-overflow")).toHaveCount(1);
    await expect(col1.getByTestId("project-strip-card-overflow")).toHaveText("+1 tarefas");

    await expect(col2.getByTestId("project-strip-card")).toHaveCount(1);
    await expect(col2.getByTestId("project-strip-card-overflow")).toHaveCount(0);

    // Non-compression: both columns keep an identical fixed width AND an
    // identical shared height despite holding a very different number of
    // cards (4 vs 1) -- mirrors projetos-section.spec.ts's own
    // width-equality assertion, extended with the matching height check.
    const box1 = await col1.boundingBox();
    const box2 = await col2.boundingBox();
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();
    expect(box1?.width).toBe(box2?.width);
    expect(box1?.height).toBe(box2?.height);
  });

  test("DASH-05: every clickable surface inside a strip is a real <button>", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    const strip = page.getByTestId("project-strip").filter({ hasText: projetoNome });
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const nomeTag = await strip
      .getByTestId("project-strip-nome")
      .evaluate((el) => el.tagName.toLowerCase());
    expect(nomeTag).toBe("button");

    const badgeTag = await strip
      .getByTestId("project-strip-fundo-badge")
      .evaluate((el) => el.tagName.toLowerCase());
    expect(badgeTag).toBe("button");

    const headerTag = await strip
      .getByTestId("project-strip-column-header")
      .first()
      .evaluate((el) => el.tagName.toLowerCase());
    expect(headerTag).toBe("button");

    const cardTag = await strip
      .getByTestId("project-strip-card")
      .first()
      .evaluate((el) => el.tagName.toLowerCase());
    expect(cardTag).toBe("button");
  });

  test("DASH-05: a vencido tarefa's card carries destructive styling, a future-dated one does not", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    const strip = page.getByTestId("project-strip").filter({ hasText: projetoNome });
    await expect(strip).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const atrasadaCard = strip
      .getByTestId("project-strip-card")
      .filter({ hasText: tarefaAtrasadaTitulo });
    await expect(atrasadaCard).toHaveClass(/border-destructive/);
    await expect(atrasadaCard.locator("p").nth(1)).toHaveClass(/text-destructive/);

    const futuraCard = strip
      .getByTestId("project-strip-card")
      .filter({ hasText: tarefaFutura1Titulo });
    await expect(futuraCard).not.toHaveClass(/border-destructive/);
    await expect(futuraCard.locator("p").nth(1)).not.toHaveClass(/text-destructive/);
  });
});
