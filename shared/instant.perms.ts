// Docs: https://www.instantdb.com/docs/permissions
//
// donoId-scoped permission rules for every Apollo v2 domain entity.
// LOCKED shape: PROJECT.md C-05; SPEC "Autenticação e permissões".
//
// The rule set below is authored exactly once as `donoRules` and referenced
// by every domain entity rather than retyped per entity — a single mistyped
// donoId on one entity would silently open cross-user access (threat
// T-01-03). Do not inline these strings per entity.

import type { InstantRules } from "@instantdb/svelte";

const donoRules = {
  allow: {
    view: "auth.id != null && auth.id == data.donoId",
    create: "auth.id != null && auth.id == newData.donoId",
    update: "auth.id != null && auth.id == data.donoId",
    delete: "auth.id != null && auth.id == data.donoId",
  },
};

const rules = {
  fundos: donoRules,
  projetos: donoRules,
  etapas: donoRules,
  tarefas: donoRules,
  templatesRotina: donoRules,
  instanciasRotina: donoRules,
  tickets: donoRules,
  subtarefas: donoRules,
  logInferenciaClaude: donoRules,
  // Blocks clients from minting new attributes at runtime (threat T-01-04);
  // all schema evolution must go through `instant-cli push`.
  attrs: {
    allow: {
      create: "false",
    },
  },
  // Deliberately no override for the built-in users entity here — its
  // default InstantDB rule (a user can only see their own profile) is
  // exactly what C-05 mandates; an explicit entry risks weakening it.
} satisfies InstantRules;

export default rules;
