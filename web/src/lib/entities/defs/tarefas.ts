import type { EntityConfig } from "../types";

// SPEC row: tarefas | titulo, descricao, tipoPrazo, dataPrevista,
// dataPrevistaEstimada, competencia, status, owner-id (shared/instant.schema.ts).
// The owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
// `tipoPrazo` mirrors the CLI's `click.Choice(_TIPO_PRAZO_CHOICES)` exactly —
// "hard" and "soft" only, no free text. `--etapa-id` on the CLI is optional
// but validated when supplied, so the `etapa` link here is `required: false`
// to match. `status` and `competencia` stay free-form text, matching the
// CLI's plain (non-Choice) options.
const tarefasConfig: EntityConfig = {
  etype: "tarefas",
  titulo: "Tarefas",
  descricao: "Tarefas vinculadas às etapas dos projetos.",
  ordem: 11,
  nav: "nested",
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "titulo", label: "Título", required: true, kind: "text" },
    { name: "descricao", label: "Descrição", required: false, kind: "textarea" },
    {
      name: "tipoPrazo",
      label: "Tipo de prazo",
      required: true,
      kind: "select",
      options: ["hard", "soft"],
    },
    { name: "dataPrevista", label: "Data prevista", required: false, kind: "date" },
    {
      name: "dataPrevistaEstimada",
      label: "Data prevista estimada",
      required: false,
      kind: "date",
    },
    { name: "competencia", label: "Competência", required: false, kind: "text" },
    { name: "status", label: "Status", required: true, kind: "text" },
  ],
  links: [{ label: "etapa", targetEtype: "etapas", targetLabelField: "nome", required: false }],
  listColumns: ["titulo", "status", "tipoPrazo", "dataPrevista", "etapa"],
};

export default tarefasConfig;
