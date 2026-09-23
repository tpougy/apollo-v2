import type { EntityConfig } from "../types";

// SPEC row: templatesRotina | nome, tipoGeracao, regraCompetencia,
// propagarAtrasoSoft, ativo, owner-id (shared/instant.schema.ts). The
// owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
// `tipoGeracao` mirrors the CLI's `click.Choice(_TIPO_GERACAO_CHOICES)`
// exactly (cli/apollo_cli/entities/rotina.py) — "du_fixo", "corrido_fixo",
// "encadeado" only, no free text. `regraCompetencia` stays free-form text,
// matching the CLI's plain (non-Choice) option.
//
// The `antecessor` link is the `templateAntecessor` self-link
// (shared/instant.schema.ts) used by the "encadeado" generation type — a
// template may declare another templatesRotina as its predecessor. The
// self-exclusion flag on that link below removes the record currently being
// edited from its own options list so a template can never select itself as
// its own antecessor.
//
// `offsetDias` (Phase 5 addition, NOT in the original SPEC field table
// above — see 05-01-PLAN.md D-05-A) is a single dual-purpose optional number,
// interpreted per `tipoGeracao`: "du_fixo" -> Nth BUSINESS day of the month;
// "corrido_fixo" -> Nth CALENDAR day of the month, clamped to the month's
// last day; "encadeado" -> number of BUSINESS days after the antecessor
// instance's dataPrevista (05-01-PLAN.md D-05-B). `required: false` matches
// the schema's `.optional()` — Phase 3/4 templates have no value and must
// remain editable through this screen.
//
// `diaSemana` (Phase 28/SEM-01 addition) applies only when
// `tipoGeracao === "semanal"` — the weekday anchoring that generation type's
// weekly occurrences. Mirrors the CLI's `--dia-semana` `click.Choice` token
// set exactly (`cli/apollo_cli/entities/rotina.py`'s `_DIA_SEMANA_CHOICES`),
// so a value round-trips unchanged between the SPA and the CLI.
// `required: false` matches the schema's `.optional()` and the fact that
// `diaSemana` is meaningless for `du_fixo`/`corrido_fixo`/`encadeado`
// templates — a required field would make those un-editable through this
// screen.
const templatesRotinaConfig: EntityConfig = {
  etype: "templatesRotina",
  titulo: "Templates de rotina",
  descricao: "Modelos que geram instâncias de rotina automaticamente.",
  ordem: 12,
  nav: "nested",
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    {
      name: "tipoGeracao",
      label: "Tipo de geração",
      required: true,
      kind: "select",
      options: ["du_fixo", "corrido_fixo", "encadeado", "semanal"],
      help: 'Define como a data prevista de cada instância é calculada: "du_fixo" = Nº dia útil do mês (offset ≥ 1 conta a partir do 1º dia; offset ≤ 0 conta a partir do último dia útil do mês, ex.: 0 = último dia útil). "corrido_fixo" = Nº dia corrido do mês (offset sempre ≥ 1). "encadeado" = X dias úteis após a data prevista do template antecessor selecionado. "semanal" = toda ocorrência do dia da semana definido em "Dia da semana", sem usar offset.',
    },
    {
      name: "offsetDias",
      label: "Offset (dias)",
      required: false,
      kind: "number",
      help: 'Opcional; seu significado depende do Tipo de geração: "du_fixo" → Nº dia útil do mês; "corrido_fixo" → Nº dia corrido do mês; "encadeado" → dias úteis após a data prevista do antecessor. Não é utilizado quando o Tipo de geração é "semanal".',
    },
    {
      name: "diaSemana",
      label: "Dia da semana",
      required: false,
      kind: "select",
      options: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
      help: 'Aplicável somente quando Tipo de geração = "semanal": define o dia da semana em que a instância é gerada, toda semana. Não tem efeito para os demais tipos de geração.',
    },
    {
      name: "regraCompetencia",
      label: "Regra de competência",
      required: true,
      kind: "text",
      help: 'Texto livre, mas só 4 valores são reconhecidos pelo job de geração: "M0" (mesmo mês da data prevista), "M-1" (mês anterior), "M-2" (dois meses antes), "M+1" (mês seguinte). Qualquer outro valor faz o template ser ignorado na geração. Para templates "encadeado", este campo não é considerado — a competência é sempre herdada do antecessor.',
    },
    {
      name: "propagarAtrasoSoft",
      label: "Propagar atraso soft",
      required: true,
      kind: "boolean",
      help: 'Campo reservado: hoje não tem nenhum efeito na geração de instâncias. Toda instância gerada recebe automaticamente tipoPrazo "soft", independente do valor marcado aqui — propagação de atraso ainda não foi implementada.',
    },
    {
      name: "ativo",
      label: "Ativo",
      required: true,
      kind: "boolean",
      help: "Somente templates ativos são considerados pelo job de geração de instâncias; templates inativos não geram novas instâncias.",
    },
  ],
  links: [
    { label: "entidade", targetEtype: "entidades", targetLabelField: "nome", required: false },
    {
      label: "antecessor",
      targetEtype: "templatesRotina",
      targetLabelField: "nome",
      required: false,
      excludeSelf: true,
    },
  ],
  listColumns: [
    "nome",
    "tipoGeracao",
    "offsetDias",
    "diaSemana",
    "ativo",
    "entidade",
    "antecessor",
  ],
};

export default templatesRotinaConfig;
