import type { EntityConfig } from "../types";

// SPEC row: etapas | nome, ordem, status, owner-id (shared/instant.schema.ts).
// The owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
// `--projeto-id` on the CLI is optional but validated when supplied, so the
// `projeto` link here is `required: false` to match.
//
// Note: the field named `ordem` (sequence order within a projeto) is a
// distinct key from `EntityConfig.ordem` (nav sort order) below — they live
// on different objects and are never conflated by EntityScreen, which reads
// the field-level value from `config.fields`/row data, not from the config's
// own `ordem`.
const etapasConfig: EntityConfig = {
  etype: "etapas",
  titulo: "Etapas",
  ordem: 3,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    { name: "ordem", label: "Ordem", required: true, kind: "number" },
    { name: "status", label: "Status", required: true, kind: "text" },
  ],
  links: [{ label: "projeto", targetEtype: "projetos", targetLabelField: "nome", required: false }],
  listColumns: ["ordem", "nome", "status", "projeto"],
};

export default etapasConfig;
