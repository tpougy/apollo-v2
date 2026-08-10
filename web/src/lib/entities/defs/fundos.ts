import type { EntityConfig } from "../types";

// SPEC row: fundos | nome, codigo, ativo, owner-id, createdAt (shared/instant.schema.ts).
// The owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
const fundosConfig: EntityConfig = {
  etype: "fundos",
  titulo: "Fundos",
  descricao: "Fundos de investimento geridos pela controladoria.",
  ordem: 1,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    { name: "codigo", label: "Código", required: true, kind: "text" },
    { name: "ativo", label: "Ativo", required: true, kind: "boolean" },
    { name: "createdAt", label: "Criado em", required: true, kind: "date" },
  ],
  listColumns: ["nome", "codigo", "ativo", "createdAt"],
};

export default fundosConfig;
