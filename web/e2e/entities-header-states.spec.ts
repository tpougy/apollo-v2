import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config.ts";

// Proves ENTTBL-04/05/06/07 explicitly, live against InstantDB, on top of
// Plan 14-01's EntityScreen.svelte restructuring — the page-header row
// (entity-header/entity-description/entity-create-start), the Skeleton
// loading grid (entity-loading), the Empty composition (empty-state/
// empty-state-create) as a true sibling of <Table>, and the Card-bounded
// entity-table-frame across all 9 entities. This spec runs in the `authed`
// project (restores the storageState persisted by auth.setup.ts), mirroring
// entities-table-restyle.spec.ts's one-test-per-capability-class convention
// and shell-nav.spec.ts's `[data-testid^="nav-"]` all-9-entities convention.
//
// Zero live writes anywhere in this file: Tests 1/2/3/5/6 are purely
// structural/behavioral read assertions, and Test 4 only opens then cancels
// the create Dialog (no InstantDB write call of any kind).

const RESYNC_TIMEOUT = 15_000;

test("ENTTBL-04: fundos (full-CRUD) page-header structure, light + dark", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await page.getByTestId("nav-fundos").click();

    const header = page.getByTestId("entity-header");
    await expect(header).toBeVisible();
    const justifyContent = await header.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(justifyContent).toBe("space-between");

    const h2 = header.locator("h2");
    await expect(h2).toHaveCount(1);
    await expect(h2).toHaveText("Fundos");

    const description = page.getByTestId("entity-description");
    await expect(description).not.toHaveText("");

    await expect(page.getByTestId("entity-create-start")).toHaveCount(1);

    const frame = page.getByTestId("entity-table-frame");
    await expect(frame).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const headerBox = await header.boundingBox();
    const frameBox = await frame.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    if (headerBox && frameBox) {
      expect(frameBox.y).toBeGreaterThan(headerBox.y);
    }
  }
});

test("ENTTBL-04: instanciasRotina (restricted) header renders, create action capability-gated off", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-instanciasRotina").click();

  await expect(page.getByTestId("entity-header")).toBeVisible();
  await expect(page.getByTestId("entity-description")).not.toHaveText("");
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
  await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });
});

test("ENTTBL-04: logInferenciaClaude (read-only) header renders, create action capability-gated off", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-logInferenciaClaude").click();

  await expect(page.getByTestId("entity-header")).toBeVisible();
  await expect(page.getByTestId("entity-description")).not.toHaveText("");
  await expect(page.getByTestId("entity-create-start")).toHaveCount(0);
  await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });
});

test("ENTTBL-06: fundos empty state is a sibling of <Table>, CTA reuses the create Dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-fundos").click();

  // This live app's fundos baseline is empty (no real production data
  // exists yet, per PROJECT.md) — the same assumption entities-fundos.spec.ts's
  // WEB-02 test relies on for its own final empty-state assertion.
  const emptyState = page.getByTestId("empty-state");
  await expect(emptyState).toBeVisible({ timeout: RESYNC_TIMEOUT });
  // Empty is a sibling replacement for <Table>, never nested table content —
  // zero <table> element exists anywhere while it is shown.
  await expect(page.getByRole("table")).toHaveCount(0);

  const cta = emptyState.getByTestId("empty-state-create");
  await expect(cta).toBeVisible();
  await cta.click();

  // Opens the same create Dialog entity-create-start opens.
  await expect(page.getByTestId("field-nome")).toBeVisible();

  await page.getByTestId("entity-cancel").click();
  await expect(page.getByTestId("field-nome")).toHaveCount(0);

  // Zero side effects: cancel closed the Dialog without ever writing to
  // InstantDB, so the empty state is still visible afterward.
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("ENTTBL-05: fundos loading state shows the Skeleton grid, never the old plain-text indicator", async ({
  browser,
}) => {
  test.setTimeout(90_000);

  // The `authed` project's persisted storageState restores InstantDB's own
  // IndexedDB-backed local cache (querySubs/syncSubs), which resolves
  // query.isLoading from cache almost instantly regardless of network
  // throttle — the transient loading branch would never be observable. Build
  // a fresh context from the same storageState but with the query-result
  // caches cleared (keeping the "kv" store, which holds the auth session, so
  // the app still mounts already signed in): the first query then has no
  // choice but to genuinely round-trip over the (throttled) network.
  const raw = JSON.parse(await fs.readFile(STORAGE_STATE, "utf-8"));
  for (const origin of raw.origins ?? []) {
    for (const db of origin.indexedDB ?? []) {
      for (const store of db.stores ?? []) {
        if (store.name === "querySubs" || store.name === "syncSubs") {
          store.records = [];
        }
      }
    }
  }

  const context = await browser.newContext({ storageState: raw });
  try {
    const page = await context.newPage();

    // Throttle the network via CDP before navigating. Latency-only (no
    // bandwidth cap) is enough to delay InstantDB's WebSocket handshake/
    // first-query round trip without also stalling the local Vite dev
    // bundle's own many sequential module-fetch requests to the point of
    // starving out this test's own timeout.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 500,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    try {
      // Since Phase 18-01, the default mount route is Dashboard (NAV-03),
      // not fundos (ordem no longer determines the initial route) — a nav
      // click to fundos is now required to trigger this entity's first
      // query round trip. Only wait for navigation "commit" (not the
      // "load" event) — the throttled, unbundled Vite dev ESM import graph
      // can otherwise chain past the "load" event's own timeout even
      // though the app's own script has long since started executing and
      // mounted the loading UI under test.
      await page.goto("/", { waitUntil: "commit", timeout: 60_000 });
      await page.getByTestId("nav-fundos").click();

      const loading = page.getByTestId("entity-loading");
      await expect(loading).toBeVisible({ timeout: 45_000 });
      expect(await loading.locator(".animate-pulse").count()).toBeGreaterThanOrEqual(1);

      // The old plain-text loading indicator this plan's predecessor
      // removed never appears anywhere on the page, at any point.
      await expect(page.getByText(/carregando/i)).toHaveCount(0);
    } finally {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    }

    await expect(page.getByTestId("entity-loading")).toHaveCount(0, { timeout: RESYNC_TIMEOUT });
    await expect(page.getByTestId("entity-table-frame")).toBeVisible({ timeout: RESYNC_TIMEOUT });
    await expect(page.getByText(/carregando/i)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("ENTTBL-07: every one of the 5 entities' content renders inside entity-table-frame", async ({
  page,
}) => {
  await page.goto("/");

  const navButtons = page.locator('[data-testid^="nav-"]:not([data-testid="nav-dashboard"])');
  const count = await navButtons.count();
  expect(count).toBe(5);

  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    await button.click();

    const frame = page.getByTestId("entity-table-frame");
    await expect(frame).toBeVisible({ timeout: RESYNC_TIMEOUT });

    const tableCount = await frame.getByRole("table").count();
    const emptyCount = await frame.getByTestId("empty-state").count();
    expect(tableCount + emptyCount).toBeGreaterThanOrEqual(1);
  }
});
