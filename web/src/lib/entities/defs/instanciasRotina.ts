import type { EntityConfig } from "../types";

// SPEC row: instanciasRotina | dedupeKey (unique+indexed), dataPrevista,
// dataPrevistaEstimada, competencia, tipoPrazo, status, owner-id
// (shared/instant.schema.ts). The owner-id field is deliberately absent from
// `fields` — injected from the authenticated session at submit time (see
// EntityScreen.svelte), never here.
//
// C-06 rationale (verbatim intent, see cli/apollo_cli/entities/rotina.py's
// module docstring and PROJECT.md C-06): instances are created and dated
// EXCLUSIVELY by Phase 5's `dedupeKey`-keyed generation job (a hash of the
// template id, competencia, and dataPrevista). A hand-created or
// hand-re-dated instance would carry a wrong or absent dedupeKey, and the
// very next job run would then create a duplicate
// alongside it — silently breaking the one idempotency guarantee this
// system promises. That is why `capabilities.create` and
// `capabilities.delete` are both `false` here, with no UI affordance for
// either anywhere on this screen, and why `updatableFields` narrows the edit
// form to `status` only — exactly mirroring the CLI's `rotina instancia
// status` command, which updates ONLY `status` for the identical reason.
//
// The `template` link (schema link `templateInstancias`) IS declared below,
// with `readOnly: true`. EntityScreen.svelte's generic `readOnly` filter
// (added alongside this definition) excludes any such link from the two
// places that would otherwise let a user reassign it — `linkTargetQueries`
// (no selectable option list is even fetched) and the per-link `<Select>`
// loop in the create/edit form — while still resolving it into the table
// via the existing generic `listColumns`/`columnValue`/`labelForLinkedValue`
// machinery (unchanged, already generic over any link). This closes the
// display gap (an operator previously had no way to see which template
// produced a given instance) without reopening the reassignment hole this
// definition previously avoided by omitting the link entirely: no control
// ever renders for a `readOnly` link, so `selectedLinks[label]` is only ever
// seeded from the row's current server value (`startEdit`) and resubmitted
// unchanged (`handleSubmit`'s relink loop) — never user-alterable.
const instanciasRotinaConfig: EntityConfig = {
  etype: "instanciasRotina",
  titulo: "Instâncias de rotina",
  descricao:
    "Instâncias de rotina geradas pelos templates. Apenas o status pode ser atualizado aqui.",
  ordem: 1,
  navTitulo: "Rotinas",
  capabilities: { create: false, update: true, delete: false },
  updatableFields: ["status"],
  fields: [
    { name: "dedupeKey", label: "Chave de deduplicação", required: true, kind: "text" },
    { name: "dataPrevista", label: "Data prevista", required: true, kind: "date" },
    {
      name: "dataPrevistaEstimada",
      label: "Data prevista estimada",
      required: false,
      kind: "date",
    },
    { name: "competencia", label: "Competência", required: true, kind: "text" },
    { name: "tipoPrazo", label: "Tipo de prazo", required: true, kind: "text" },
    { name: "status", label: "Status", required: true, kind: "text" },
  ],
  links: [
    {
      label: "template",
      targetEtype: "templatesRotina",
      targetLabelField: "nome",
      required: false,
      readOnly: true,
    },
  ],
  listColumns: ["template", "competencia", "dataPrevista", "status", "tipoPrazo"],
};

export default instanciasRotinaConfig;
