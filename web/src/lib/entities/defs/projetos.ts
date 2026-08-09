import type { EntityConfig } from "../types";

// SPEC row: projetos | nome, descricao, status, dataInicioPrevista, dataFimPrevista, owner-id
// (shared/instant.schema.ts). The owner-id field is deliberately absent from
// `fields` — injected from the authenticated session at submit time (see
// EntityScreen.svelte), never here. `--fundo-id` on the CLI is optional, so
// the `fundo` link here is `required: false` to match.
const projetosConfig: EntityConfig = {
  etype: "projetos",
  titulo: "Projetos",
  ordem: 2,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    { name: "descricao", label: "Descrição", required: false, kind: "textarea" },
    { name: "status", label: "Status", required: true, kind: "text" },
    {
      name: "dataInicioPrevista",
      label: "Data início prevista",
      required: false,
      kind: "date",
    },
    { name: "dataFimPrevista", label: "Data fim prevista", required: false, kind: "date" },
  ],
  links: [{ label: "fundo", targetEtype: "fundos", targetLabelField: "nome", required: false }],
  listColumns: ["nome", "status", "fundo", "dataInicioPrevista", "dataFimPrevista"],
};

export default projetosConfig;
