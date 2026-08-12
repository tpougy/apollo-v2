import { describe, expect, test } from "bun:test";
import calendar from "../../../../shared/anbima-calendar.json";
import {
  cargaDoMes,
  faixaHeatmap,
  progressoEtapa,
  semanaUtil,
  tarefaConcluida,
  vencido,
} from "./derive";

describe("tarefaConcluida", () => {
  test("no subtarefas -> never counts as done", () => {
    expect(tarefaConcluida({ subtarefas: [] })).toBe(false);
  });

  test("all subtarefas concluida -> true", () => {
    expect(tarefaConcluida({ subtarefas: [{ concluida: true }] })).toBe(true);
  });

  test("mixed subtarefas -> false (ALL must be true)", () => {
    expect(tarefaConcluida({ subtarefas: [{ concluida: true }, { concluida: false }] })).toBe(
      false,
    );
  });

  test("subtarefas absent entirely (undefined) -> false", () => {
    expect(tarefaConcluida({})).toBe(false);
  });
});

describe("progressoEtapa", () => {
  test("mix of done/not-done tarefas -> feitas counts only fully-concluded ones", () => {
    const etapa = {
      tarefas: [
        { subtarefas: [{ concluida: true }] },
        { subtarefas: [{ concluida: true }, { concluida: false }] },
        { subtarefas: [{ concluida: false }] },
      ],
    };
    expect(progressoEtapa(etapa)).toEqual({ feitas: 1, total: 3 });
  });

  test("no tarefas -> { feitas: 0, total: 0 }", () => {
    expect(progressoEtapa({ tarefas: [] })).toEqual({ feitas: 0, total: 0 });
  });

  test("tarefas with subtarefas absent land in total, never feitas", () => {
    const etapa = {
      tarefas: [
        { subtarefas: [{ concluida: true }] }, // feita
        {}, // no subtarefas field at all -> total only
        { subtarefas: [] }, // empty subtarefas array -> total only
      ],
    };
    expect(progressoEtapa(etapa)).toEqual({ feitas: 1, total: 3 });
  });
});

describe("vencido", () => {
  test("past dataPrevista, not concluido -> true", () => {
    expect(vencido("2020-01-01T00:00:00.000Z", false, new Date("2026-01-01"))).toBe(true);
  });

  test("past dataPrevista, concluido -> false (already concluded is never vencido)", () => {
    expect(vencido("2020-01-01T00:00:00.000Z", true, new Date("2026-01-01"))).toBe(false);
  });

  test("no dataPrevista -> false", () => {
    expect(vencido(undefined, false, new Date())).toBe(false);
  });

  test("null dataPrevista -> false", () => {
    expect(vencido(null, false, new Date())).toBe(false);
  });

  test("future dataPrevista, not concluido -> false", () => {
    expect(vencido("2030-01-01T00:00:00.000Z", false, new Date("2026-01-01"))).toBe(false);
  });
});

describe("semanaUtil", () => {
  test("Tuesday hoje -> Monday-Friday of the same calendar week, plus sabado/domingo", () => {
    expect(semanaUtil("2026-08-11")).toEqual({
      dias: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
      sabado: "2026-08-15",
      domingo: "2026-08-16",
    });
  });

  test("Monday hoje -> dias[0] equals that same date", () => {
    const semana = semanaUtil("2026-08-10");
    expect(semana.dias[0]).toBe("2026-08-10");
    expect(semana.dias).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  test("Sunday hoje -> preceding Monday-Friday, sabado the day before, domingo the input date", () => {
    // 2026-08-16 is a Sunday (same week as the Tuesday case above).
    expect(semanaUtil("2026-08-16")).toEqual({
      dias: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
      sabado: "2026-08-15",
      domingo: "2026-08-16",
    });
  });

  test("a week containing a real ANBIMA holiday still returns plain Monday-Friday dates, unaffected", () => {
    // 2026-04-21 (Tiradentes) is a Tuesday and a real holiday in
    // shared/anbima-calendar.json's holidays array — proving semanaUtil
    // never delegates to bizdays.ts's business-day steppers.
    expect(calendar.holidays).toContain("2026-04-21");
    expect(semanaUtil("2026-04-21")).toEqual({
      dias: ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"],
      sabado: "2026-04-25",
      domingo: "2026-04-26",
    });
  });
});

describe("faixaHeatmap", () => {
  test("0 -> 0", () => {
    expect(faixaHeatmap(0)).toBe(0);
  });

  test("1 and 2 -> 1", () => {
    expect(faixaHeatmap(1)).toBe(1);
    expect(faixaHeatmap(2)).toBe(1);
  });

  test("3 and 4 -> 2", () => {
    expect(faixaHeatmap(3)).toBe(2);
    expect(faixaHeatmap(4)).toBe(2);
  });

  test("5 and 7 -> 3", () => {
    expect(faixaHeatmap(5)).toBe(3);
    expect(faixaHeatmap(7)).toBe(3);
  });

  test("8 and 100 -> 4", () => {
    expect(faixaHeatmap(8)).toBe(4);
    expect(faixaHeatmap(100)).toBe(4);
  });
});

describe("cargaDoMes", () => {
  test("counts tarefas/instanciasRotina/tickets inside the target month, zero elsewhere, no entry outside the month", () => {
    const dados = {
      tarefas: [
        { dataPrevista: "2026-08-05" },
        { dataPrevista: "2026-08-05T00:00:00.000Z" }, // same day, timestamp form
        { dataPrevista: "2026-07-31" }, // outside target month
        { dataPrevista: null },
      ],
      instanciasRotina: [{ dataPrevista: "2026-08-10" }],
      tickets: [{ dataPrevista: "2026-08-31" }, { dataPrevista: undefined }],
    };

    const result = cargaDoMes(dados, 2026, 8);

    // August 2026 has 31 days -> 31 entries.
    expect(result.size).toBe(31);
    expect(result.get("2026-08-01")).toBe(0);
    expect(result.get("2026-08-05")).toBe(2);
    expect(result.get("2026-08-10")).toBe(1);
    expect(result.get("2026-08-31")).toBe(1);
    expect(result.get("2026-07-31")).toBeUndefined();
    expect(result.get("2026-09-01")).toBeUndefined();
  });

  test("month with no items -> every day seeded to 0", () => {
    const result = cargaDoMes(
      { tarefas: [], instanciasRotina: [], tickets: [] },
      2026,
      2, // February 2026, 28 days (not a leap year)
    );
    expect(result.size).toBe(28);
    for (const count of result.values()) {
      expect(count).toBe(0);
    }
  });
});
