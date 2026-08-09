// Docs: https://www.instantdb.com/docs/modeling-data
//
// Single TypeScript source of truth for the Apollo v2 domain schema.
// Consumed by web/src/lib/db.ts (typed client) and by `instant-cli push`
// (invoked from web/ with INSTANT_SCHEMA_FILE_PATH pointing here).
// LOCKED shape: PROJECT.md C-01, C-02, C-04; SPEC "Schema do InstantDB".

import { i } from "@instantdb/svelte";

const _schema = i.schema({
  entities: {
    // SPEC row: fundos | nome, codigo, ativo, donoId, createdAt
    fundos: i.entity({
      nome: i.string(),
      codigo: i.string().indexed(),
      ativo: i.boolean(),
      donoId: i.string().indexed(),
      createdAt: i.date(),
    }),
    // SPEC row: projetos | nome, descricao, status, dataInicioPrevista, dataFimPrevista, donoId
    projetos: i.entity({
      nome: i.string(),
      descricao: i.string().optional(),
      status: i.string().indexed(),
      dataInicioPrevista: i.date().optional(),
      dataFimPrevista: i.date().optional(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: etapas | nome, ordem, status, donoId
    etapas: i.entity({
      nome: i.string(),
      ordem: i.number(),
      status: i.string().indexed(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: tarefas | titulo, descricao, tipoPrazo, dataPrevista, dataPrevistaEstimada, competencia, status, donoId
    tarefas: i.entity({
      titulo: i.string(),
      descricao: i.string().optional(),
      tipoPrazo: i.string(),
      dataPrevista: i.date().optional(),
      dataPrevistaEstimada: i.date().optional(),
      competencia: i.string().optional(),
      status: i.string().indexed(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: templatesRotina | nome, tipoGeracao, regraCompetencia, propagarAtrasoSoft, donoId
    // `ativo` is not in the SPEC field table but is required by SPEC
    // §"Job de geração de instâncias de rotina" ("para cada templatesRotina
    // ativo") — added here, flagged in the plan's SUMMARY for review.
    templatesRotina: i.entity({
      nome: i.string(),
      tipoGeracao: i.string(),
      regraCompetencia: i.string(),
      propagarAtrasoSoft: i.boolean(),
      ativo: i.boolean(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: instanciasRotina | dedupeKey (unique+indexed), dataPrevista, dataPrevistaEstimada, competencia, tipoPrazo, status, donoId
    // dedupeKey is the Phase 5 idempotency key
    // (hash(templateId + competencia + dataPrevista)); its uniqueness is
    // what makes the lookup-upsert transact atomic (never duplicates).
    instanciasRotina: i.entity({
      dedupeKey: i.string().unique().indexed(),
      dataPrevista: i.date(),
      dataPrevistaEstimada: i.date().optional(),
      competencia: i.string(),
      tipoPrazo: i.string(),
      status: i.string().indexed(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: tickets | titulo, corpo, remetente, dataRecebimento, tipoPrazo, dataPrevista, status, donoId
    tickets: i.entity({
      titulo: i.string(),
      corpo: i.string(),
      remetente: i.string(),
      dataRecebimento: i.date(),
      tipoPrazo: i.string(),
      dataPrevista: i.date().optional(),
      status: i.string().indexed(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: subtarefas | titulo, concluida, ordem, donoId
    subtarefas: i.entity({
      titulo: i.string(),
      concluida: i.boolean(),
      ordem: i.number(),
      donoId: i.string().indexed(),
    }),
    // SPEC row: logInferenciaClaude | campo, valorInferido, trechoMotivador, entidadeTipo, entidadeId, donoId, createdAt
    logInferenciaClaude: i.entity({
      campo: i.string(),
      valorInferido: i.string(),
      trechoMotivador: i.string().optional(),
      entidadeTipo: i.string(),
      entidadeId: i.string(),
      donoId: i.string().indexed(),
      createdAt: i.date(),
    }),
  },
  links: {
    fundoProjetos: {
      forward: { on: "projetos", has: "one", label: "fundo" },
      reverse: { on: "fundos", has: "many", label: "projetos" },
    },
    fundoTemplatesRotina: {
      forward: { on: "templatesRotina", has: "one", label: "fundo" },
      reverse: { on: "fundos", has: "many", label: "templatesRotina" },
    },
    fundoTickets: {
      forward: { on: "tickets", has: "one", label: "fundo" },
      reverse: { on: "fundos", has: "many", label: "tickets" },
    },
    projetoEtapas: {
      forward: { on: "etapas", has: "one", label: "projeto" },
      reverse: { on: "projetos", has: "many", label: "etapas" },
    },
    etapaTarefas: {
      forward: { on: "tarefas", has: "one", label: "etapa" },
      reverse: { on: "etapas", has: "many", label: "tarefas" },
    },
    tarefaSubtarefas: {
      forward: { on: "subtarefas", has: "one", label: "tarefa" },
      reverse: { on: "tarefas", has: "many", label: "subtarefas" },
    },
    ticketSubtarefas: {
      forward: { on: "subtarefas", has: "one", label: "ticket" },
      reverse: { on: "tickets", has: "many", label: "subtarefas" },
    },
    templateInstancias: {
      forward: { on: "instanciasRotina", has: "one", label: "template" },
      reverse: { on: "templatesRotina", has: "many", label: "instancias" },
    },
    // Self-link: a templatesRotina may declare a predecessor template
    // (regraCompetencia chains, e.g. "encadeado" generation type).
    templateAntecessor: {
      forward: { on: "templatesRotina", has: "one", label: "antecessor" },
      reverse: { on: "templatesRotina", has: "many", label: "sucessores" },
    },
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
