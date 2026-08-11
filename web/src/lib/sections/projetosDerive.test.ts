import { describe, expect, test } from "bun:test";
import { progressoEtapa, tarefaConcluida, vencido } from "./projetosDerive";

describe("tarefaConcluida", () => {
  test("no subtarefas -> never counts as done", () => {
    expect(tarefaConcluida({ subtarefas: [] })).toBe(false);
  });

  test("all subtarefas concluida -> true", () => {
    expect(tarefaConcluida({ subtarefas: [{ concluida: true }] })).toBe(true);
  });

  test("mixed subtarefas -> false (ALL must be true)", () => {
    expect(
      tarefaConcluida({ subtarefas: [{ concluida: true }, { concluida: false }] }),
    ).toBe(false);
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
    expect(
      vencido("2020-01-01T00:00:00.000Z", false, new Date("2026-01-01")),
    ).toBe(true);
  });

  test("past dataPrevista, concluido -> false (already concluded is never vencido)", () => {
    expect(
      vencido("2020-01-01T00:00:00.000Z", true, new Date("2026-01-01")),
    ).toBe(false);
  });

  test("no dataPrevista -> false", () => {
    expect(vencido(undefined, false, new Date())).toBe(false);
  });

  test("null dataPrevista -> false", () => {
    expect(vencido(null, false, new Date())).toBe(false);
  });

  test("future dataPrevista, not concluido -> false", () => {
    expect(
      vencido("2030-01-01T00:00:00.000Z", false, new Date("2026-01-01")),
    ).toBe(false);
  });
});
