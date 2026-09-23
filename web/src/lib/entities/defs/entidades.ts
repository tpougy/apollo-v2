import type { EntityConfig } from "../types";

// Generic replacement for the old fixed `fundos` entity (quick task
// 260922-vbt, CONTEXT.md D1-D7): `tipoEntidade` is a free-text discriminator
// (e.g. "Fundo", "Cliente", "Area") with no closed vocabulary/catalog entity.
// The owner-id field is deliberately absent from `fields` — injected from the
// authenticated session at submit time (see EntityScreen.svelte), never here.
const entidadesConfig: EntityConfig = {
  etype: "entidades",
  titulo: "Entidades",
  descricao: "Entidades geridas pela controladoria (fundos, clientes, areas, etc.).",
  ordem: 4,
  capabilities: { create: true, update: true, delete: true },
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    { name: "codigo", label: "Código", required: true, kind: "text" },
    { name: "tipoEntidade", label: "Tipo", required: true, kind: "text" },
    { name: "ativo", label: "Ativo", required: true, kind: "boolean" },
    { name: "createdAt", label: "Criado em", required: true, kind: "date" },
  ],
  listColumns: ["nome", "codigo", "tipoEntidade", "ativo", "createdAt"],
};

export default entidadesConfig;
