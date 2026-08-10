import type { EntityConfig } from "../types";

// SPEC row: tickets | titulo, corpo, remetente, dataRecebimento, tipoPrazo,
// dataPrevista, status, owner-id (shared/instant.schema.ts).
// The owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
// `tipoPrazo` mirrors the CLI's `click.Choice(_TIPO_PRAZO_CHOICES)` exactly —
// "hard" and "soft" only, no free text. `--fundo-id` on the CLI is optional
// but validated when supplied, so the `fundo` link here is `required: false`
// to match. `status` stays free-form text, matching the CLI's plain
// (non-Choice) `--status` option.
const ticketsConfig: EntityConfig = {
  etype: "tickets",
  titulo: "Tickets",
  descricao: "Tickets recebidos por e-mail e seus prazos de atendimento.",
  ordem: 7,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "titulo", label: "Título", required: true, kind: "text" },
    { name: "corpo", label: "Corpo", required: true, kind: "textarea" },
    { name: "remetente", label: "Remetente", required: true, kind: "text" },
    { name: "dataRecebimento", label: "Data de recebimento", required: true, kind: "date" },
    {
      name: "tipoPrazo",
      label: "Tipo de prazo",
      required: true,
      kind: "select",
      options: ["hard", "soft"],
    },
    { name: "dataPrevista", label: "Data prevista", required: false, kind: "date" },
    { name: "status", label: "Status", required: true, kind: "text" },
  ],
  links: [{ label: "fundo", targetEtype: "fundos", targetLabelField: "nome", required: false }],
  listColumns: ["titulo", "remetente", "status", "tipoPrazo", "dataRecebimento", "fundo"],
};

export default ticketsConfig;
