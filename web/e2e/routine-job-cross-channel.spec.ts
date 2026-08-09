import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  deleteInstancesByTemplate,
  listInstancesByTemplate,
} from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts) and proves ROADMAP success criterion 4: records one
// channel writes are correctly RECOGNIZED by the other, in both directions —
// not merely that record counts happen to match afterward.
//
// Direction A (CLI generates, then a second CLI-side read confirms the
// record set) is proven in `cli/tests/test_routine_job_parity.py` — this
// file owns BOTH crossings end to end, because only Playwright can shell out
// to the CLI (via the `apolloCli` helper, reused unchanged from
// `routine-job.spec.ts`/`entities-rotina-log.spec.ts`) AND drive the browser
// in the same test.
//
// Test 2's assertion on the CLI's own `existing` array is the load-bearing
// one: it proves the CLI RECOGNIZED the SPA's records by dedupeKey, rather
// than merely failing to write for some unrelated reason. A test that only
// compared record counts would pass even if the CLI had silently errored out
// before reaching the write step.
//
// Every generated record uses a `phase05-x-` prefix so leftovers are
// greppable/removable (same convention `cli/tests/test_routine_job_parity.py`
// uses for its own Direction A templates).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase05-x-";

function apolloCli(args: string[]): string {
  return execFileSync("uv", ["run", "--project", "cli", "apollo", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function uniqueName(prefix: string): string {
  return `${PREFIX}${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function tryDeleteTemplate(eid: string | null | undefined): void {
  if (!eid) return;
  try {
    apolloCli(["rotina", "template", "deletar", "--id", eid]);
  } catch {
    // Already gone — fine.
  }
}

function sweepLeftovers(): void {
  const templates = JSON.parse(apolloCli(["rotina", "template", "listar"])) as {
    id: string;
    nome: string;
  }[];
  for (const record of templates) {
    if (record.nome.startsWith(PREFIX)) tryDeleteTemplate(record.id);
  }
}

interface GerarInstanciasReport {
  created: string[];
  existing: string[];
  skipped: { templateId: string; reason: string }[];
}

function runGerarInstancias(): GerarInstanciasReport {
  return JSON.parse(apolloCli(["rotina", "gerar-instancias"])) as GerarInstanciasReport;
}

test.describe
  .serial("cross-channel", () => {
    const createdTemplateIds: string[] = [];

    test.beforeAll(() => {
      sweepLeftovers();
    });

    test.afterAll(async () => {
      // Reverse creation order so an encadeado successor is always deleted
      // before its antecessor (same ordering caveat as routine-job.spec.ts).
      for (const templateId of [...createdTemplateIds].reverse()) {
        await deleteInstancesByTemplate(templateId);
        tryDeleteTemplate(templateId);
      }
      sweepLeftovers();
    });

    test("Test 1: CLI generates, then a subsequent SPA load recognizes the records (zero duplicates)", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // Step 1: seed one template per generation type via the CLI, the
      // encadeado one linked to the du_fixo one.
      const duFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("t1-du-fixo"),
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "2",
        ]),
      ) as { id: string };
      const duFixoId = duFixoCreated.id;
      createdTemplateIds.push(duFixoId);

      const corridoFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("t1-corrido-fixo"),
          "--tipo-geracao",
          "corrido_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "7",
        ]),
      ) as { id: string };
      const corridoFixoId = corridoFixoCreated.id;
      createdTemplateIds.push(corridoFixoId);

      const encadeadoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("t1-encadeado"),
          "--tipo-geracao",
          "encadeado",
          "--regra-competencia",
          "M0",
          "--antecessor-id",
          duFixoId,
          "--offset-dias",
          "1",
        ]),
      ) as { id: string };
      const encadeadoId = encadeadoCreated.id;
      createdTemplateIds.push(encadeadoId);

      const templateIds = [duFixoId, corridoFixoId, encadeadoId];

      // Step 2: run the CLI job — the CLI channel generates every expected
      // instance for this fresh template set.
      const cliReport = runGerarInstancias();
      expect(cliReport.created.length).toBeGreaterThan(0);
      expect(cliReport.existing).toEqual([]);

      // Step 3: snapshot the server record set produced by the CLI, via the
      // admin-only fixture (bypassing the SPA's reactive query layer so a
      // stale read can never mask a bug).
      let cliRows: Record<string, unknown>[] = [];
      for (const templateId of templateIds) {
        const rows = await listInstancesByTemplate(templateId);
        cliRows = cliRows.concat(rows);
      }
      expect(cliRows.length).toBeGreaterThan(0);
      const cliIds = new Set(cliRows.map((r) => r.id as string));
      const cliDedupeKeys = new Set(cliRows.map((r) => r.dedupeKey as string));
      expect(cliDedupeKeys.size).toBe(cliRows.length);

      // Step 4: an authenticated SPA load — the second channel — must
      // recognize these CLI-generated records rather than duplicate them.
      await page.goto("/");
      await expect(page.getByTestId("routine-job-state")).toHaveAttribute(
        "data-job-state",
        "done",
        { timeout: RESYNC_TIMEOUT },
      );

      // Step 5: re-read the server set (polled — InstantDB writes propagate
      // asynchronously) and assert: identical count, identical id set, zero
      // duplicate dedupeKeys.
      let spaRows: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            spaRows = [];
            for (const templateId of templateIds) {
              const rows = await listInstancesByTemplate(templateId);
              spaRows = spaRows.concat(rows);
            }
            return spaRows.length;
          },
          {
            timeout: RESYNC_TIMEOUT,
            message: "expected the SPA load to leave the CLI-generated record count unchanged",
          },
        )
        .toBe(cliRows.length);

      const spaIds = new Set(spaRows.map((r) => r.id as string));
      expect(spaIds).toEqual(cliIds);

      const spaDedupeKeys = spaRows.map((r) => r.dedupeKey as string);
      expect(new Set(spaDedupeKeys).size).toBe(spaDedupeKeys.length);
      expect(new Set(spaDedupeKeys)).toEqual(cliDedupeKeys);
    });

    test("Test 2: SPA generates, then a subsequent CLI run recognizes the records under `existing` (zero duplicates)", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // Step 1: seed a fresh template set.
      const duFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("t2-du-fixo"),
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "3",
        ]),
      ) as { id: string };
      const duFixoId = duFixoCreated.id;
      createdTemplateIds.push(duFixoId);

      const corridoFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          uniqueName("t2-corrido-fixo"),
          "--tipo-geracao",
          "corrido_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "11",
        ]),
      ) as { id: string };
      const corridoFixoId = corridoFixoCreated.id;
      createdTemplateIds.push(corridoFixoId);

      const templateIds = [duFixoId, corridoFixoId];

      // Step 2: an authenticated SPA load — the FIRST channel this time —
      // generates every expected instance for this fresh template set.
      await page.goto("/");
      await expect(page.getByTestId("routine-job-state")).toHaveAttribute(
        "data-job-state",
        "done",
        { timeout: RESYNC_TIMEOUT },
      );

      let spaRows: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            spaRows = [];
            for (const templateId of templateIds) {
              const rows = await listInstancesByTemplate(templateId);
              spaRows = spaRows.concat(rows);
            }
            return spaRows.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected the SPA load to generate instances" },
        )
        .toBeGreaterThan(0);

      // Step 3: snapshot the server record set produced by the SPA.
      const spaIds = new Set(spaRows.map((r) => r.id as string));
      const spaDedupeKeys = new Set(spaRows.map((r) => r.dedupeKey as string));
      expect(spaDedupeKeys.size).toBe(spaRows.length);

      // Step 4: run the CLI job — the SECOND channel. The load-bearing
      // assertion: `created` must be EMPTY and `existing` must contain EVERY
      // one of the SPA's dedupeKeys, proving the CLI recognized the SPA's
      // records by dedupeKey rather than merely failing to write for some
      // other reason. A test that only compared record counts would pass
      // even if the CLI had silently errored out before reaching the write
      // step. `existing` is a superset, not an exact set, because Test 1's
      // templates are still active (afterAll runs once, after both tests)
      // and legitimately contribute their own already-existing keys too.
      const cliReport = runGerarInstancias();
      expect(cliReport.created).toEqual([]);
      const existingKeySet = new Set(cliReport.existing);
      for (const key of spaDedupeKeys) {
        expect(existingKeySet.has(key)).toBe(true);
      }

      // Step 5: re-read the server set and assert it is byte-identical.
      let finalRows: Record<string, unknown>[] = [];
      for (const templateId of templateIds) {
        const rows = await listInstancesByTemplate(templateId);
        finalRows = finalRows.concat(rows);
      }
      expect(finalRows.length).toBe(spaRows.length);
      const finalIds = new Set(finalRows.map((r) => r.id as string));
      expect(finalIds).toEqual(spaIds);
      const finalDedupeKeys = finalRows.map((r) => r.dedupeKey as string);
      expect(new Set(finalDedupeKeys).size).toBe(finalDedupeKeys.length);
      expect(new Set(finalDedupeKeys)).toEqual(spaDedupeKeys);
    });
  });
