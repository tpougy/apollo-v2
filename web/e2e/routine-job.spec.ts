import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  deleteInstancesByTemplate,
  listInstancesByTemplate,
} from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts) and proves ROADMAP success criteria 1-3 against the REAL
// InstantDB app: an authenticated SPA load generates du_fixo instances in
// range, a second load produces zero duplicates, and a manually-set
// `concluida` status survives a subsequent run unchanged.
//
// Every generated record uses a `phase05-e2e-` prefix so leftovers are
// greppable/removable. `instanciasRotina` has no delete path on either the
// SPA or the CLI by design (C-06) — teardown goes through the admin-only
// fixture helpers, exactly like `entities-rotina-log.spec.ts`'s handling of
// `logInferenciaClaude`.

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RESYNC_TIMEOUT = 15_000;
const PREFIX = "phase05-e2e-";

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

// Local, deliberately UTC-only mirror of routineJob.ts's toIsoDate — kept
// independent so a bug in the production normalization can't hide the
// duplication/clobbering bugs this spec exists to catch.
function normalizeDate(value: unknown): string {
  return String(value).slice(0, 10);
}

function todayUtcIsoDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function endOfNextMonthUtc(today: string): string {
  const [yearStr, monthStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(Date.UTC(nextMonthYear, nextMonth, 0)).getUTCDate();
  return `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

test.describe
  .serial("routine job", () => {
    let templateId: string | undefined;

    test.beforeAll(() => {
      sweepLeftovers();
    });

    test.afterAll(async () => {
      if (templateId) {
        await deleteInstancesByTemplate(templateId);
        tryDeleteTemplate(templateId);
      }
      sweepLeftovers();
    });

    test("WEB-10: double SPA load is idempotent and preserves a manually-set status", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // Step 1: seed ONE active du_fixo template with an offset-dias small
      // enough that its target date reliably lands in the current or next
      // month for any day of the month the suite happens to run on.
      const nome = uniqueName("template");
      const created = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          nome,
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "2",
        ]),
      ) as { id: string };
      templateId = created.id;

      const today = todayUtcIsoDate();
      const rangeEnd = endOfNextMonthUtc(today);

      // Step 2: first SPA load — wait for the job to report done.
      await page.goto("/");
      await expect(page.getByTestId("routine-job-state")).toHaveAttribute(
        "data-job-state",
        "done",
        {
          timeout: RESYNC_TIMEOUT,
        },
      );

      // Server-side read must be polled: InstantDB writes propagate
      // asynchronously and a bare read immediately after data-job-state=done
      // can observe a stale snapshot.
      let run1: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            run1 = await listInstancesByTemplate(templateId as string);
            return run1.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected at least one generated instance" },
        )
        .toBeGreaterThan(0);

      for (const row of run1) {
        const dataPrevista = normalizeDate(row.dataPrevista);
        const competencia = row.competencia as string;
        const expectedDedupeKey = `${templateId}:${competencia}:${dataPrevista}`;
        expect(row.dedupeKey).toBe(expectedDedupeKey);
        expect(dataPrevista >= today && dataPrevista <= rangeEnd).toBe(true);
        expect(row.donoId).toBeTruthy();
        expect(row.status).toBe("pendente");
      }

      const run1Ids = new Set(run1.map((r) => r.id as string));
      const run1DedupeKeys = run1.map((r) => r.dedupeKey as string).sort();
      expect(new Set(run1DedupeKeys).size).toBe(run1DedupeKeys.length);

      // Step 3: manually mark one instance concluida via the CLI status-only
      // command — this is the mutation the re-run must NOT clobber.
      const mutated = run1[0];
      const mutatedId = mutated.id as string;
      apolloCli(["rotina", "instancia", "status", "--id", mutatedId, "--status", "concluida"]);

      // Step 4: the idempotency proof — reload and re-run the job.
      await page.reload();
      await expect(page.getByTestId("routine-job-state")).toHaveAttribute(
        "data-job-state",
        "done",
        {
          timeout: RESYNC_TIMEOUT,
        },
      );

      // A record-count check ALONE is insufficient here: a status-clobbering
      // bug (re-writing `status` back to "pendente" for an already-existing
      // dedupeKey) leaves the record count completely unchanged. That is
      // exactly why step 3's mutation and this step's byte-identical
      // re-assertion exist — count alone would not catch it.
      let run2: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            run2 = await listInstancesByTemplate(templateId as string);
            return run2.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected the same instance count as run 1" },
        )
        .toBe(run1.length);

      const run2Ids = new Set(run2.map((r) => r.id as string));
      expect(run2Ids).toEqual(run1Ids);

      const run2DedupeKeys = run2.map((r) => r.dedupeKey as string).sort();
      expect(new Set(run2DedupeKeys).size).toBe(run2DedupeKeys.length);
      expect(run2DedupeKeys).toEqual(run1DedupeKeys);

      const mutatedAfter = run2.find((r) => r.id === mutatedId);
      expect(mutatedAfter).toBeTruthy();
      expect(mutatedAfter?.status).toBe("concluida");
      expect(mutatedAfter?.dedupeKey).toBe(mutated.dedupeKey);
      expect(mutatedAfter?.competencia).toBe(mutated.competencia);
      expect(normalizeDate(mutatedAfter?.dataPrevista)).toBe(normalizeDate(mutated.dataPrevista));
    });
  });
