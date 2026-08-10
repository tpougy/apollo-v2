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
const templatesRotinaConfig: EntityConfig = {
  etype: "templatesRotina",
  titulo: "Templates de rotina",
  descricao: "Modelos que geram instâncias de rotina automaticamente.",
  ordem: 5,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    {
      name: "tipoGeracao",
      label: "Tipo de geração",
      required: true,
      kind: "select",
      options: ["du_fixo", "corrido_fixo", "encadeado"],
    },
    {
      name: "offsetDias",
      label: "Offset (dias)",
      required: false,
      kind: "number",
    },
    {
      name: "regraCompetencia",
      label: "Regra de competência",
      required: true,
      kind: "text",
    },
    {
      name: "propagarAtrasoSoft",
      label: "Propagar atraso soft",
      required: true,
      kind: "boolean",
    },
    { name: "ativo", label: "Ativo", required: true, kind: "boolean" },
  ],
  links: [
    { label: "fundo", targetEtype: "fundos", targetLabelField: "nome", required: false },
    {
      label: "antecessor",
      targetEtype: "templatesRotina",
      targetLabelField: "nome",
      required: false,
      excludeSelf: true,
    },
  ],
  listColumns: ["nome", "tipoGeracao", "offsetDias", "ativo", "fundo", "antecessor"],
};

export default templatesRotinaConfig;
