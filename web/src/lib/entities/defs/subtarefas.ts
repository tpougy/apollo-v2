import type { EntityConfig } from "../types";

// SPEC row: subtarefas | titulo, concluida, ordem, owner-id
// (shared/instant.schema.ts). The owner-id field is deliberately absent from
// `fields` — injected from the authenticated session at submit time (see
// EntityScreen.svelte), never here.
//
// A subtarefa belongs to exactly one parent — a `tarefa` or a `ticket`,
// never both, never neither — mirroring the CLI's `_resolve_parent` in
// `cli/apollo_cli/entities/subtarefa.py`. That XOR is expressed here through
// `xorLink` rather than a plain `links` list, so the shared engine enforces
// "exactly one" before any transact (create) and unlinks the stale choice on
// an edit-time parent-type switch (see the EntityScreen.svelte fix in this
// plan).
const subtarefasConfig: EntityConfig = {
  etype: "subtarefas",
  titulo: "Subtarefas",
  descricao: "Subtarefas vinculadas a uma tarefa ou a um ticket.",
  ordem: 13,
  nav: "nested",
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "titulo", label: "Título", required: true, kind: "text" },
    { name: "concluida", label: "Concluída", required: true, kind: "boolean" },
    { name: "ordem", label: "Ordem", required: true, kind: "number" },
  ],
  xorLink: {
    label: "Pai",
    choices: [
      { label: "tarefa", targetEtype: "tarefas", targetLabelField: "titulo", required: true },
      { label: "ticket", targetEtype: "tickets", targetLabelField: "titulo", required: true },
    ],
  },
  listColumns: ["ordem", "titulo", "concluida", "tarefa", "ticket"],
};

export default subtarefasConfig;
