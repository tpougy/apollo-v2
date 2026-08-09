import type { EntityConfig } from "../types";

// SPEC row: logInferenciaClaude | campo, valorInferido, trechoMotivador,
// entidadeTipo, entidadeId, owner-id, createdAt (shared/instant.schema.ts).
// The owner-id field is deliberately absent from `fields` — injected from
// the authenticated session at submit time (see EntityScreen.svelte), never
// here (moot in practice since `capabilities.create` is `false`, but kept
// consistent with every other definition in this package).
//
// This is an append-only audit trail of values Claude inferred while
// operating the CLI, and the text that justified each inference
// (cli/apollo_cli/entities/log_inferencia.py, PROJECT.md threat T-03-26). A
// rewritable audit log cannot serve its purpose of letting the user check
// the AI's reasoning after the fact, so ALL THREE capabilities are `false`
// here — mirroring the CLI, which exposes only `registrar` (create) and
// `listar` (list), with no `editar`/`deletar` command at all. With every
// capability false, the shipped EntityScreen.svelte never renders the
// "novo" button, never renders `row-edit`/`row-delete`, and — because `mode`
// can then never become non-null — never renders the `<form>` element
// either. This screen is therefore a pure read-only table.
const logInferenciaClaudeConfig: EntityConfig = {
  etype: "logInferenciaClaude",
  titulo: "Log de inferências",
  ordem: 9,
  capabilities: { create: false, update: false, delete: false },
  fields: [
    { name: "campo", label: "Campo", required: true, kind: "text" },
    { name: "valorInferido", label: "Valor inferido", required: true, kind: "text" },
    {
      name: "trechoMotivador",
      label: "Trecho motivador",
      required: false,
      kind: "textarea",
    },
    { name: "entidadeTipo", label: "Tipo de entidade", required: true, kind: "text" },
    { name: "entidadeId", label: "Id da entidade", required: true, kind: "text" },
    { name: "createdAt", label: "Criado em", required: true, kind: "date" },
  ],
  listColumns: ["createdAt", "entidadeTipo", "campo", "valorInferido"],
};

export default logInferenciaClaudeConfig;
