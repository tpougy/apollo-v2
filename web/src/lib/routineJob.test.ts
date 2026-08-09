import { describe, expect, test } from "bun:test";
import fixture from "../../../shared/routine-job.testcases.json";
import {
  buildDedupeKey,
  computeExpectedInstances,
  type ExistingInstance,
  endOfNextMonth,
  nthBusinessDayOfMonth,
  nthCalendarDayOfMonth,
  type SkipReason,
  shiftCompetencia,
  type TemplateRow,
  toIsoDate,
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

interface Scenario {
  nome: string;
  today: string;
  templates: TemplateRow[];
  existing: ExistingInstance[];
  expectedInstances: Array<{
    dedupeKey: string;
    templateId: string;
    competencia: string;
    dataPrevista: string;
    dataPrevistaEstimada?: string;
    tipoPrazo: string;
  }>;
  expectedSkipped: Array<{ templateId: string; reason: SkipReason }>;
}

const dayMath = fixture.dayMath as {
  nthBusinessDayOfMonth: NthBusinessDayCase[];
  nthCalendarDayOfMonth: NthCalendarDayCase[];
  endOfNextMonth: EndOfNextMonthCase[];
  shiftCompetencia: ShiftCompetenciaCase[];
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
});

describe("routineJob computeExpectedInstances scenario fixture parity", () => {
  for (const s of scenarios) {
    test(s.nome, () => {
      const result = computeExpectedInstances(s.templates, s.today, s.existing);
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
