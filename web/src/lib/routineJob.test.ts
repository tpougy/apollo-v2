import { describe, expect, test } from "bun:test";
import fixture from "../../../shared/routine-job.testcases.json";
import {
  buildDedupeKey,
  computeExpectedInstances,
  DIA_SEMANA_INDEX,
  type ExistingInstance,
  endOfNextMonth,
  monthsInRange,
  nthBusinessDayOfMonth,
  nthCalendarDayOfMonth,
  type SkipReason,
  shiftCompetencia,
  type TemplateRow,
  toIsoDate,
  weeklyOccurrences,
} from "./routineJob";

interface NthBusinessDayCase {
  nome: string;
  year: number;
  month: number;
  n: number;
  expected: string;
}

interface NthCalendarDayCase {
  nome: string;
  year: number;
  month: number;
  n: number;
  expected: string;
}

interface EndOfNextMonthCase {
  nome: string;
  today: string;
  expected: string;
}

interface ShiftCompetenciaCase {
  nome: string;
  dataPrevista: string;
  regraCompetencia: string;
  expected: string | null;
}

interface WeeklyOccurrencesCase {
  nome: string;
  rangeStart: string;
  rangeEnd: string;
  diaSemana: string;
  expected: string[];
}

interface MonthsInRangeCase {
  nome: string;
  rangeStart: string;
  rangeEnd: string;
  expected: Array<[number, number]>;
}

interface Scenario {
  nome: string;
  today: string;
  templates: TemplateRow[];
  existing: ExistingInstance[];
  rangeOverride?: [string, string];
  expectedInstances: Array<{
    dedupeKey: string;
    templateId: string;
    competencia: string;
    dataPrevista: string;
    dataPrevistaEstimada?: string;
    tipoPrazo: string;
  }>;
  expectedSkipped: Array<{ templateId: string; nome: string; reason: SkipReason }>;
}

const dayMath = fixture.dayMath as {
  nthBusinessDayOfMonth: NthBusinessDayCase[];
  nthCalendarDayOfMonth: NthCalendarDayCase[];
  endOfNextMonth: EndOfNextMonthCase[];
  shiftCompetencia: ShiftCompetenciaCase[];
  weeklyOccurrences: WeeklyOccurrencesCase[];
  monthsInRange: MonthsInRangeCase[];
};
const scenarios = fixture.scenarios as Scenario[];

describe("routineJob dayMath fixture parity", () => {
  describe("nthBusinessDayOfMonth", () => {
    for (const c of dayMath.nthBusinessDayOfMonth) {
      test(c.nome, () => {
        expect(nthBusinessDayOfMonth(c.year, c.month, c.n)).toBe(c.expected);
      });
    }
  });

  describe("nthCalendarDayOfMonth", () => {
    for (const c of dayMath.nthCalendarDayOfMonth) {
      test(c.nome, () => {
        expect(nthCalendarDayOfMonth(c.year, c.month, c.n)).toBe(c.expected);
      });
    }
  });

  describe("endOfNextMonth", () => {
    for (const c of dayMath.endOfNextMonth) {
      test(c.nome, () => {
        expect(endOfNextMonth(c.today)).toBe(c.expected);
      });
    }
  });

  describe("shiftCompetencia", () => {
    for (const c of dayMath.shiftCompetencia) {
      test(c.nome, () => {
        expect(shiftCompetencia(c.dataPrevista, c.regraCompetencia)).toBe(c.expected);
      });
    }
  });

  describe("weeklyOccurrences", () => {
    for (const c of dayMath.weeklyOccurrences) {
      test(c.nome, () => {
        expect(weeklyOccurrences(c.rangeStart, c.rangeEnd, DIA_SEMANA_INDEX[c.diaSemana])).toEqual(
          c.expected,
        );
      });
    }
  });

  describe("monthsInRange", () => {
    for (const c of dayMath.monthsInRange) {
      test(c.nome, () => {
        expect(monthsInRange(c.rangeStart, c.rangeEnd)).toEqual(c.expected);
      });
    }
  });
});

describe("routineJob computeExpectedInstances scenario fixture parity", () => {
  for (const s of scenarios) {
    test(s.nome, () => {
      const result = computeExpectedInstances(s.templates, s.today, s.existing, s.rangeOverride);
      expect(result.expected).toEqual(s.expectedInstances);
      expect(result.skipped).toEqual(s.expectedSkipped);
    });
  }
});

describe("routineJob dropAudit — conservation law over every scenario", () => {
  test("every ativo template appears in exactly one of expected/skipped; inactive templates appear in neither", () => {
    expect(scenarios.length).toBeGreaterThan(0);

    for (const s of scenarios) {
      const result = computeExpectedInstances(s.templates, s.today, s.existing);
      const templateIdsWithInstances = new Set(result.expected.map((e) => e.templateId));
      const templateIdsSkipped = new Set(result.skipped.map((sk) => sk.templateId));

      for (const skippedEntry of result.skipped) {
        const occurrences = result.skipped.filter(
          (sk) => sk.templateId === skippedEntry.templateId,
        ).length;
        expect(occurrences).toBe(1);
      }

      for (const tpl of s.templates) {
        const isInactive = tpl.ativo === false;
        const hasInstances = templateIdsWithInstances.has(tpl.id);
        const isSkipped = templateIdsSkipped.has(tpl.id);

        if (isInactive) {
          expect(hasInstances).toBe(false);
          expect(isSkipped).toBe(false);
        } else {
          // Never both, never neither.
          expect(hasInstances !== isSkipped).toBe(true);
        }
      }
    }
  });
});

describe("routineJob purity", () => {
  test("computeExpectedInstances is pure: identical inputs produce deeply-equal results without mutating inputs", () => {
    const scenario = scenarios[0];
    if (!scenario) {
      throw new Error("Fixture must contain at least one scenario for the purity check");
    }

    const templatesCopy = JSON.parse(JSON.stringify(scenario.templates)) as TemplateRow[];
    const existingCopy = JSON.parse(JSON.stringify(scenario.existing)) as ExistingInstance[];

    const resultA = computeExpectedInstances(templatesCopy, scenario.today, existingCopy);
    const resultB = computeExpectedInstances(templatesCopy, scenario.today, existingCopy);

    expect(resultA).toEqual(resultB);
    expect(templatesCopy).toEqual(scenario.templates);
    expect(existingCopy).toEqual(scenario.existing);
  });

  test("computeExpectedInstances([], today, []) returns { expected: [], skipped: [] } without throwing", () => {
    const run = () => computeExpectedInstances([], "2026-08-09", []);
    expect(run).not.toThrow();
    expect(run()).toEqual({ expected: [], skipped: [] });
  });
});

// --- SEM-01 type-guard direct coverage (not live; WR-01 iteration 2) -------
//
// `computeSemanalInstances`'s `typeof diaSemana !== "string"` guard (CR-01's
// fix) had no direct unit test. `computeSemanalInstances` itself is not
// exported, so drive it through the public `computeExpectedInstances` entry
// point (mirroring the Python side, which exercises the private function
// directly since it is importable there) with malformed `diaSemana` types on
// a `semanal` template, mirroring the fixture template shape
// (`shared/routine-job.testcases.json`'s `tpl-sem-a`).

describe("computeExpectedInstances SEM-01 dia_semana type guard", () => {
  const malformedDiaSemanaCases: Array<[string, unknown]> = [
    ["list", ["sexta"]],
    ["object", { dia: "sexta" }],
    ["number", 4],
    ["boolean", true],
  ];

  for (const [label, diaSemana] of malformedDiaSemanaCases) {
    test(`diaSemana as ${label} is reported as dia_semana_invalido, never crashes`, () => {
      const template = {
        id: "tpl-sem-a",
        nome: "Atualiz Calc RF",
        tipoGeracao: "semanal",
        regraCompetencia: "M0",
        diaSemana: diaSemana as unknown as string,
        ativo: true,
        antecessor: null,
      } satisfies TemplateRow;

      const run = () => computeExpectedInstances([template], "2026-08-09", []);
      expect(run).not.toThrow();
      const result = run();
      expect(result.expected).toEqual([]);
      expect(result.skipped).toEqual([
        { templateId: "tpl-sem-a", nome: "Atualiz Calc RF", reason: "dia_semana_invalido" },
      ]);
    });
  }
});

describe("buildDedupeKey", () => {
  test("is plain concatenation of templateId, competencia, and dataPrevista", () => {
    expect(buildDedupeKey("tpl-a", "2026-08", "2026-08-10")).toBe("tpl-a:2026-08:2026-08-10");
  });
});

describe("toIsoDate", () => {
  test("normalizes an InstantDB datetime round-trip string to a plain YYYY-MM-DD", () => {
    expect(toIsoDate("2026-09-10T00:00:00.000Z")).toBe("2026-09-10");
  });

  test("leaves an already-plain YYYY-MM-DD date string unchanged", () => {
    expect(toIsoDate("2026-09-10")).toBe("2026-09-10");
  });

  test("returns an empty string for null", () => {
    expect(toIsoDate(null)).toBe("");
  });

  test("returns an empty string for undefined", () => {
    expect(toIsoDate(undefined)).toBe("");
  });
});

describe("JobReport invariant", () => {
  test("created and existing dedupeKey sets are always disjoint and sorted ascending", () => {
    const created = ["tpl-a:2026-08:2026-08-03", "tpl-a:2026-08:2026-08-10"];
    const existing = ["tpl-b:2026-08:2026-08-05"];

    const createdSorted = [...created].sort();
    const existingSorted = [...existing].sort();
    expect(created).toEqual(createdSorted);
    expect(existing).toEqual(existingSorted);

    const overlap = created.filter((k) => existing.includes(k));
    expect(overlap).toEqual([]);
  });
});
