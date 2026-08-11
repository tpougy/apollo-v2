import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { gotoNested } from "./helpers/gotoNested.ts";
import { openSubtarefasPanelForTicket } from "./helpers/subtarefasPanel.ts";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

// This spec runs in the `authed` project (picked up automatically by its
// existing testMatch: /.*\.spec\.ts/ — no playwright.config.ts edit needed),
// which auto-runs the `setup` project first (dependencies: ["setup"]),
// producing a fresh live authenticated session for every test in this file.
// playwright.config.ts's workers: 1 / fullyParallel: false makes tests in
// this file run sequentially in declaration order — the Logout test is
// declared last so ending the session cannot affect the earlier two.

const NAV_TESTID_SELECTOR = '[data-testid^="nav-"]';

// Some nav buttons show a short `navTitulo` (e.g. "Rotinas", "Log") that
// differs from the resulting EntityScreen's own `<h2>{config.titulo}</h2>` —
// so the per-button loop below asserts against this table (keyed by
// data-testid) instead of the clicked button's own visible label.
const EXPECTED_H2_BY_TESTID: Record<string, string> = {
  "nav-dashboard": "Dashboard",
  "nav-instanciasRotina": "Instâncias de rotina",
  "nav-tickets": "Tickets",
  "nav-projetos": "Projetos",
  "nav-fundos": "Fundos",
  "nav-logInferenciaClaude": "Log de inferências",
};

test("each nav Button renders its corresponding EntityScreen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();
  expect(count).toBe(6);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    const testid = await button.getAttribute("data-testid");
    await button.click();
    await expect(page.locator("h2")).toHaveText(EXPECTED_H2_BY_TESTID[testid ?? ""]);
  }
});

test("NAV-01/NAV-03: fresh load shows exactly the 6-item topbar in order, defaulting to the Dashboard route", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const testids = await page
    .locator('[data-testid^="nav-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(testids).toEqual([
    "nav-dashboard",
    "nav-instanciasRotina",
    "nav-tickets",
    "nav-projetos",
    "nav-fundos",
    "nav-logInferenciaClaude",
  ]);

  await expect(page.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator("h2")).toHaveText("Dashboard");
  await expect(page.getByTestId("entity-table-frame")).toHaveCount(0);
  await expect(page.getByTestId("entity-header")).toHaveCount(0);
});

test("NAV-02: no first-level nav path for etapas/tarefas/templatesRotina/subtarefas, but each remains reachable via gotoNested", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await expect(
    page.locator(
      '[data-testid="nav-etapas"], [data-testid="nav-templatesRotina"], [data-testid="nav-subtarefas"], [data-testid="nav-tarefas"]',
    ),
  ).toHaveCount(0);

  // The interim Phase 18 "Acesso direto (temporário)" dropdown (nested-goto*
  // testids) was deleted from Shell.svelte in Plan 20-05 -- assert its own
  // testid prefix is fully gone from the page, not merely that its 4 nav-*
  // shortcuts above are absent. This proves the retired access path itself
  // no longer exists, not just that it was never a first-level nav entry.
  await expect(page.locator('[data-testid^="nested-goto"]')).toHaveCount(0);

  // gotoNested(page, "etapas") lands inside a selected projeto's own detail
  // column (Phase 19) — the shared live app is not guaranteed to have a
  // projeto otherwise, so create a throwaway one via the CLI for this test.
  const nome = `phase19-e2e-nav02-${Date.now()}`;
  const created = JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--project",
        "cli",
        "apollo",
        "projeto",
        "criar",
        "--nome",
        nome,
        "--status",
        "ativo",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    ),
  ) as { id: string };

  // subtarefas no longer lands on a raw, unscoped table (Plan 20-04 retired
  // every gotoNested(page, "subtarefas") call site) -- it is proven reachable
  // separately below, via the real SubtarefasPanel, using a throwaway ticket.
  const ticketTitulo = `phase20-e2e-nav02-${Date.now()}`;
  const ticketCreated = JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--project",
        "cli",
        "apollo",
        "ticket",
        "criar",
        "--titulo",
        ticketTitulo,
        "--corpo",
        "corpo do ticket NAV-02",
        "--remetente",
        "nav02@example.com",
        "--data-recebimento",
        "2026-01-01",
        "--tipo-prazo",
        "soft",
        "--status",
        "aberto",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    ),
  ) as { id: string };

  try {
    for (const etype of ["tarefas", "templatesRotina"]) {
      await gotoNested(page, etype);
      await expect(page.getByTestId("entity-table-frame")).toBeVisible();
    }

    await gotoNested(page, "etapas");
    await expect(page.getByTestId("project-etapas-list")).toBeVisible();

    // subtarefas: reachable with no first-level nav entry, nested inside its
    // real ticket-hosted parent (TicketsSection's row-selection -> inline
    // SubtarefasPanel, Plan 20-01), never through the retired dropdown.
    await openSubtarefasPanelForTicket(page, ticketCreated.id);
    await expect(page.getByTestId("subtarefas-panel")).toBeVisible();
  } finally {
    execFileSync(
      "uv",
      ["run", "--project", "cli", "apollo", "ticket", "deletar", "--id", ticketCreated.id],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    execFileSync(
      "uv",
      ["run", "--project", "cli", "apollo", "projeto", "deletar", "--id", created.id],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
  }
});

test("exactly one nav Button shows the active-state indicator at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const navButtons = page.locator(NAV_TESTID_SELECTOR);
  const count = await navButtons.count();

  // `rota` defaults to { section: "dashboard" } on mount, so nav-dashboard
  // is already active before any click.
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    await button.click();

    const active = page.locator('[aria-current="true"]');
    await expect(active).toHaveCount(1);

    const activeTestId = await active.getAttribute("data-testid");
    const clickedTestId = await button.getAttribute("data-testid");
    expect(activeTestId).toBe(clickedTestId);

    // Covers the visual half of SHELLUI-02: the active Button's shadcn
    // `secondary` variant must have a different resting-state background
    // color than an inactive `ghost`-variant nav Button.
    const activeBg = await active.evaluate((el) => getComputedStyle(el).backgroundColor);
    const otherIndex = (i + 1) % count;
    const otherBg = await navButtons
      .nth(otherIndex)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(activeBg).not.toBe(otherBg);
  }
});

test("clicking Logout ends the session and returns to the restyled LoginScreen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await page.getByTestId("logout").click();

  // FDBK-01: logging out produces a visible success toast — asserted before
  // the navigation-away assertion below, since the toast and the auth-state
  // flip can race.
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();

  await expect(page.getByTestId("app-shell")).not.toBeVisible();
  await expect(page.getByTestId("login-screen")).toBeVisible();
});
