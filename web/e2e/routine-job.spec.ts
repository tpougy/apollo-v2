import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  deleteInstancesByTemplate,
  listInstancesByTemplate,
} from "./fixtures/instancia-admin-fixture.ts";

// This spec runs in the `authed` project (restores the storageState persisted
// by auth.setup.ts) and proves ROADMAP success criteria 1-3 against the REAL
// InstantDB app for ALL THREE generation types: an authenticated SPA load
// generates du_fixo/corrido_fixo/encadeado instances in range, a second load
// produces zero duplicates across the whole set, a manually-set `concluida`
// status survives a subsequent run unchanged, AND the encadeado successor's
// dedupeKey/dataPrevista/competencia never re-key when its antecessor's
// status changes (D-05-F, the executable proof this plan's unit tests cannot
// provide — they never exercise a real InstantDB round trip).
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
    let duFixoId: string | undefined;
    let corridoFixoId: string | undefined;
    let encadeadoId: string | undefined;

    test.beforeAll(() => {
      sweepLeftovers();
    });

    test.afterAll(async () => {
      // Sucessor before antecessor to avoid a dangling self-link reference
      // (same ordering caveat as entities-rotina-log.spec.ts WEB-06).
      if (encadeadoId) {
        await deleteInstancesByTemplate(encadeadoId);
        tryDeleteTemplate(encadeadoId);
      }
      if (duFixoId) {
        await deleteInstancesByTemplate(duFixoId);
        tryDeleteTemplate(duFixoId);
      }
      if (corridoFixoId) {
        await deleteInstancesByTemplate(corridoFixoId);
        tryDeleteTemplate(corridoFixoId);
      }
      sweepLeftovers();
    });

    test("WEB-10: double SPA load is idempotent across all three generation types and preserves a manually-set status", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // Step 1: seed one active template per generation type. Offsets are
      // small enough that each type's target date reliably lands in the
      // current or next month for any day of the month the suite happens to
      // run on (the range always extends to the end of NEXT month).
      const duFixoNome = uniqueName("du-fixo");
      const duFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          duFixoNome,
          "--tipo-geracao",
          "du_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "2",
        ]),
      ) as { id: string };
      duFixoId = duFixoCreated.id;

      const corridoFixoNome = uniqueName("corrido-fixo");
      const corridoFixoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          corridoFixoNome,
          "--tipo-geracao",
          "corrido_fixo",
          "--regra-competencia",
          "M0",
          "--offset-dias",
          "5",
        ]),
      ) as { id: string };
      corridoFixoId = corridoFixoCreated.id;

      const encadeadoNome = uniqueName("encadeado");
      const encadeadoCreated = JSON.parse(
        apolloCli([
          "rotina",
          "template",
          "criar",
          "--nome",
          encadeadoNome,
          "--tipo-geracao",
          "encadeado",
          "--regra-competencia",
          "M0",
          "--antecessor-id",
          duFixoId,
          "--offset-dias",
          "2",
        ]),
      ) as { id: string };
      encadeadoId = encadeadoCreated.id;

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

      // Server-side reads must be polled: InstantDB writes propagate
      // asynchronously and a bare read immediately after data-job-state=done
      // can observe a stale snapshot.
      let duFixoRun1: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            duFixoRun1 = await listInstancesByTemplate(duFixoId as string);
            return duFixoRun1.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected at least one du_fixo instance" },
        )
        .toBeGreaterThan(0);

      let corridoFixoRun1: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            corridoFixoRun1 = await listInstancesByTemplate(corridoFixoId as string);
            return corridoFixoRun1.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected at least one corrido_fixo instance" },
        )
        .toBeGreaterThan(0);

      let encadeadoRun1: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            encadeadoRun1 = await listInstancesByTemplate(encadeadoId as string);
            return encadeadoRun1.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected at least one encadeado instance" },
        )
        .toBeGreaterThan(0);

      const run1 = [...duFixoRun1, ...corridoFixoRun1, ...encadeadoRun1];

      // Each group is known to belong to exactly one template id (queried by
      // that id) — recomputing the expected dedupeKey from the OWN group's
      // template id, rather than trusting a `template` link field the admin
      // query doesn't even select, proves the format contract holds through
      // a real round trip for all three types.
      const runGroups: Array<[Record<string, unknown>[], string]> = [
        [duFixoRun1, duFixoId as string],
        [corridoFixoRun1, corridoFixoId as string],
        [encadeadoRun1, encadeadoId as string],
      ];
      for (const [rows, templateId] of runGroups) {
        for (const row of rows) {
          const dataPrevista = normalizeDate(row.dataPrevista);
          const competencia = row.competencia as string;
          const expectedDedupeKey = `${templateId}:${competencia}:${dataPrevista}`;
          expect(row.dedupeKey).toBe(expectedDedupeKey);
          expect(dataPrevista >= today && dataPrevista <= rangeEnd).toBe(true);
          expect(row.donoId).toBeTruthy();
          expect(row.status).toBe("pendente");
        }
      }

      // D-05-D live proof: every encadeado instance's competencia is one of
      // its du_fixo antecessor's own competencia values.
      const duFixoCompetencias = new Set(duFixoRun1.map((r) => r.competencia as string));
      for (const row of encadeadoRun1) {
        expect(duFixoCompetencias.has(row.competencia as string)).toBe(true);
      }

      // D-05-E live proof: the antecessor's instance is still `pendente` at
      // this point, so every encadeado instance must carry
      // dataPrevistaEstimada.
      for (const row of encadeadoRun1) {
        expect(row.dataPrevistaEstimada).toBeTruthy();
        expect(normalizeDate(row.dataPrevistaEstimada)).toBe(normalizeDate(row.dataPrevista));
      }

      // D-05-B live proof: each encadeado instance is strictly after its
      // antecessor's (business-day offset, never same-day-or-before).
      const earliestAntecessorDataPrevista = duFixoRun1
        .map((r) => normalizeDate(r.dataPrevista))
        .sort()[0] as string;
      for (const row of encadeadoRun1) {
        expect(normalizeDate(row.dataPrevista) > earliestAntecessorDataPrevista).toBe(true);
      }

      const run1Ids = new Set(run1.map((r) => r.id as string));
      const run1DedupeKeys = run1.map((r) => r.dedupeKey as string).sort();
      expect(new Set(run1DedupeKeys).size).toBe(run1DedupeKeys.length);

      // Step 3: manually mark the du_fixo antecessor's instance concluida via
      // the CLI status-only command — this is the mutation the re-run must
      // NOT clobber, and it is also the D-05-F trigger: does a status change
      // on the antecessor re-key its encadeado successor?
      const mutated = duFixoRun1[0];
      const mutatedId = mutated.id as string;
      apolloCli(["rotina", "instancia", "status", "--id", mutatedId, "--status", "concluida"]);

      const encadeadoBefore = encadeadoRun1.map((r) => ({
        id: r.id,
        dedupeKey: r.dedupeKey,
        dataPrevista: normalizeDate(r.dataPrevista),
        competencia: r.competencia,
      }));

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
      let duFixoRun2: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            duFixoRun2 = await listInstancesByTemplate(duFixoId as string);
            return duFixoRun2.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected the same du_fixo instance count" },
        )
        .toBe(duFixoRun1.length);

      let corridoFixoRun2: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            corridoFixoRun2 = await listInstancesByTemplate(corridoFixoId as string);
            return corridoFixoRun2.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected the same corrido_fixo instance count" },
        )
        .toBe(corridoFixoRun1.length);

      let encadeadoRun2: Record<string, unknown>[] = [];
      await expect
        .poll(
          async () => {
            encadeadoRun2 = await listInstancesByTemplate(encadeadoId as string);
            return encadeadoRun2.length;
          },
          { timeout: RESYNC_TIMEOUT, message: "expected the same encadeado instance count" },
        )
        .toBe(encadeadoRun1.length);

      const run2 = [...duFixoRun2, ...corridoFixoRun2, ...encadeadoRun2];

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

      // D-05-F live proof: the encadeado successor's dedupeKey, dataPrevista,
      // and competencia are UNCHANGED after its antecessor was marked
      // concluida. If this ever fails, encadeado idempotency is broken
      // regardless of what the unit tests say — a moving date here would
      // re-key the successor and duplicate it on every future run.
      for (const before of encadeadoBefore) {
        const after = encadeadoRun2.find((r) => r.id === before.id);
        expect(after).toBeTruthy();
        expect(after?.dedupeKey).toBe(before.dedupeKey);
        expect(normalizeDate(after?.dataPrevista)).toBe(before.dataPrevista);
        expect(after?.competencia).toBe(before.competencia);
      }
    });
  });
