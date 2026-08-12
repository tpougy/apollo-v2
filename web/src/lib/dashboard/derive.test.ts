import { describe, expect, test } from "bun:test";
import calendar from "../../../../shared/anbima-calendar.json";
import {
  agendaPorDia,
  cargaDoMes,
  faixaHeatmap,
  progressoEtapa,
  rotinasPorFundo,
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

// Fixture week for agendaPorDia/rotinasPorFundo: semanaUtil("2026-08-11")
// (a Tuesday) -> Monday 2026-08-10 .. Friday 2026-08-14, sabado 2026-08-15,
// domingo 2026-08-16. `hoje` is fixed to 2026-08-11 for every vencido check.
const SEMANA = semanaUtil("2026-08-11");
const HOJE = new Date("2026-08-11T12:00:00.000Z");

describe("agendaPorDia", () => {
  test("resolves a tarefa's fundoId by cross-referencing dados.projetos (matched+fundo, no etapa, unmatched projeto, matched projeto with no fundo)", () => {
    const dados = {
      projetos: [
        { id: "proj-1", fundo: { id: "fundo-A" } },
        { id: "proj-2", fundo: null },
      ],
      tarefas: [
        {
          id: "t-matched",
          titulo: "Matched",
          tipoPrazo: "soft",
          dataPrevista: "2026-08-12",
          etapa: { projeto: { id: "proj-1" } },
        },
        {
          id: "t-no-etapa",
          titulo: "No etapa",
          tipoPrazo: "soft",
          dataPrevista: "2026-08-12",
          etapa: null,
        },
        {
          id: "t-unmatched-projeto",
          titulo: "Unmatched projeto",
          tipoPrazo: "soft",
          dataPrevista: "2026-08-12",
          etapa: { projeto: { id: "proj-999" } },
        },
        {
          id: "t-projeto-no-fundo",
          titulo: "Projeto no fundo",
          tipoPrazo: "soft",
          dataPrevista: "2026-08-12",
          etapa: { projeto: { id: "proj-2" } },
        },
      ],
      instanciasRotina: [],
      tickets: [],
    };

    const result = agendaPorDia(dados, SEMANA, HOJE);
    const items = result.get("2026-08-12") ?? [];
    const byId = new Map(items.map((i) => [i.id, i]));

    expect(byId.get("t-matched")?.fundoId).toBe("fundo-A");
    expect(byId.get("t-no-etapa")?.fundoId).toBeNull();
    expect(byId.get("t-unmatched-projeto")?.fundoId).toBeNull();
    expect(byId.get("t-projeto-no-fundo")?.fundoId).toBeNull();
  });

  test("a tarefa's vencido flag matches vencido(dataPrevista, tarefaConcluida(tarefa), hoje) exactly", () => {
    const dados = {
      projetos: [],
      tarefas: [
        {
          id: "t-overdue",
          titulo: "Overdue",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-10",
          subtarefas: [],
          etapa: null,
        },
        {
          id: "t-overdue-but-done",
          titulo: "Overdue but done",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-10",
          subtarefas: [{ concluida: true }],
          etapa: null,
        },
        {
          id: "t-future",
          titulo: "Future",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-14",
          subtarefas: [],
          etapa: null,
        },
      ],
      instanciasRotina: [],
      tickets: [],
    };

    const result = agendaPorDia(dados, SEMANA, HOJE);
    const byId = new Map(
      [...result.values()].flat().map((i) => [i.id, i]),
    );

    expect(byId.get("t-overdue")?.vencido).toBe(true);
    expect(byId.get("t-overdue-but-done")?.vencido).toBe(false);
    expect(byId.get("t-future")?.vencido).toBe(false);
  });

  test("every instanciaRotina in the 7-day window becomes a rotina Item regardless of tipoPrazo, fundoId from template.fundo.id or null, vencido always concluido=false", () => {
    const dados = {
      projetos: [],
      tarefas: [],
      instanciasRotina: [
        {
          id: "r-soft-past",
          dataPrevista: "2026-08-10",
          tipoPrazo: "soft",
          template: { fundo: { id: "fundo-B", nome: "Fundo B" } },
        },
        {
          id: "r-no-template",
          dataPrevista: "2026-08-15", // sabado -- still inside the 7-day window
          tipoPrazo: "hard",
          template: null,
        },
        {
          id: "r-outside-window",
          dataPrevista: "2026-08-20",
          tipoPrazo: "hard",
          template: { fundo: { id: "fundo-B", nome: "Fundo B" } },
        },
      ],
      tickets: [],
    };

    const result = agendaPorDia(dados, SEMANA, HOJE);
    const allItems = [...result.values()].flat();
    const byId = new Map(allItems.map((i) => [i.id, i]));

    expect(byId.get("r-soft-past")?.tipo).toBe("rotina");
    expect(byId.get("r-soft-past")?.fundoId).toBe("fundo-B");
    // Past dataPrevista + hard-coded concluido=false -> vencido true, even
    // though the instancia's own tipoPrazo is "soft".
    expect(byId.get("r-soft-past")?.vencido).toBe(true);

    expect(byId.get("r-no-template")?.tipo).toBe("rotina");
    expect(byId.get("r-no-template")?.fundoId).toBeNull();
    // 2026-08-15 is after hoje (2026-08-11) -> not vencido.
    expect(byId.get("r-no-template")?.vencido).toBe(false);

    expect(byId.has("r-outside-window")).toBe(false);
  });

  test("a ticket appears only when tipoPrazo is hard AND dataPrevista is in window; fundoId from ticket.fundo.id; vencido always concluido=false", () => {
    const dados = {
      projetos: [],
      tarefas: [],
      instanciasRotina: [],
      tickets: [
        {
          id: "tk-hard-in-window",
          titulo: "Hard in window",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-10",
          fundo: { id: "fundo-A" },
        },
        {
          id: "tk-soft-in-window",
          titulo: "Soft in window",
          tipoPrazo: "soft",
          dataPrevista: "2026-08-10",
          fundo: { id: "fundo-A" },
        },
        {
          id: "tk-hard-no-date",
          titulo: "Hard no date",
          tipoPrazo: "hard",
          dataPrevista: null,
          fundo: null,
        },
        {
          id: "tk-hard-outside-window",
          titulo: "Hard outside window",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-20",
          fundo: null,
        },
      ],
    };

    const result = agendaPorDia(dados, SEMANA, HOJE);
    const allItems = [...result.values()].flat();
    const byId = new Map(allItems.map((i) => [i.id, i]));

    expect(byId.get("tk-hard-in-window")?.tipo).toBe("ticket");
    expect(byId.get("tk-hard-in-window")?.fundoId).toBe("fundo-A");
    expect(byId.get("tk-hard-in-window")?.vencido).toBe(true); // past + concluido=false

    expect(byId.has("tk-soft-in-window")).toBe(false);
    expect(byId.has("tk-hard-no-date")).toBe(false);
    expect(byId.has("tk-hard-outside-window")).toBe(false);
  });

  test("returned Map has exactly 7 keys (5 weekdays + sabado + domingo), each day sorted hard-first / tipo-order / titulo-ascending, deterministic regardless of input order", () => {
    const dados = {
      projetos: [],
      tarefas: [
        {
          id: "t-hard",
          titulo: "Zeta tarefa",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-10",
          etapa: null,
        },
      ],
      instanciasRotina: [
        {
          id: "r-soft",
          dataPrevista: "2026-08-10",
          tipoPrazo: "soft",
          template: null,
        },
      ],
      tickets: [
        {
          id: "tk-hard",
          titulo: "Alfa ticket",
          tipoPrazo: "hard",
          dataPrevista: "2026-08-10",
          fundo: null,
        },
      ],
    };

    // Deliberately fed in reverse-of-expected order to prove the sort is
    // input-order-independent.
    const result = agendaPorDia(dados, SEMANA, HOJE);

    expect([...result.keys()]).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);

    const day = result.get("2026-08-10") ?? [];
    // Hard-deadline items first (t-hard tarefa, tk-hard ticket -- both
    // _hard), then by fixed tipo order tarefa < rotina < ticket among the
    // hard group, then the one non-hard rotina item last.
    expect(day.map((i) => i.id)).toEqual(["t-hard", "tk-hard", "r-soft"]);
  });
});

describe("rotinasPorFundo", () => {
  test("groups by template.fundo.id, fundoNome from template.fundo.nome, null-fundo group forced last regardless of alphabetical position", () => {
    const instancias = [
      { id: "r1", dataPrevista: "2026-08-10", tipoPrazo: "soft", template: { fundo: { id: "fundo-z", nome: "Zulu" } } },
      { id: "r2", dataPrevista: "2026-08-11", tipoPrazo: "soft", template: null },
      { id: "r3", dataPrevista: "2026-08-12", tipoPrazo: "soft", template: { fundo: { id: "fundo-a", nome: "Alfa" } } },
    ];

    const groups = rotinasPorFundo(instancias, SEMANA);

    expect(groups.map((g) => g.fundoId)).toEqual(["fundo-a", "fundo-z", null]);
    expect(groups.map((g) => g.fundoNome)).toEqual(["Alfa", "Zulu", null]);
  });

  test("within a group, instancias sort by dataPrevista ascending then id", () => {
    const instancias = [
      { id: "r-b", dataPrevista: "2026-08-12", tipoPrazo: "soft", template: { fundo: { id: "fundo-a", nome: "Alfa" } } },
      { id: "r-a-later-id", dataPrevista: "2026-08-10", tipoPrazo: "soft", template: { fundo: { id: "fundo-a", nome: "Alfa" } } },
      { id: "r-a-earlier-id", dataPrevista: "2026-08-10", tipoPrazo: "soft", template: { fundo: { id: "fundo-a", nome: "Alfa" } } },
    ];

    const groups = rotinasPorFundo(instancias, SEMANA);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.instancias.map((i) => i.id)).toEqual([
      "r-a-earlier-id",
      "r-a-later-id",
      "r-b",
    ]);
  });

  test("filters to the same 7-date window as agendaPorDia", () => {
    const instancias = [
      { id: "in-window", dataPrevista: "2026-08-15", tipoPrazo: "soft", template: null },
      { id: "outside-window", dataPrevista: "2026-08-20", tipoPrazo: "soft", template: null },
    ];

    const groups = rotinasPorFundo(instancias, SEMANA);
    const allIds = groups.flatMap((g) => g.instancias.map((i) => i.id));
    expect(allIds).toEqual(["in-window"]);
  });
});
