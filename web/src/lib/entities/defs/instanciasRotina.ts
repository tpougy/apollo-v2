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
// The `template` link (schema link `templateInstancias`) is deliberately
// NOT declared here. The shipped EntityScreen.svelte (04-02) renders every
// entry in `links` as an editable `<select>` in the create/edit form
// unconditionally — `updatableFields` only narrows `fields`, it has no
// effect on `links`. Declaring `template` as a link (the only way to pull
// its data into the query/table at all — see EntityScreen.svelte's
// `buildQuery`) would therefore reopen exactly the reassignment hole this
// definition exists to close: a user could silently re-parent an instance to
// a different template via the edit form, desynchronizing it from the
// dedupeKey that was computed against its ORIGINAL template. Since the
// shared component cannot be modified in this plan (owned by 04-02, shared
// with parallel wave-3 plans) and no read-only-link rendering mode exists,
// the owning template's name is intentionally omitted from `listColumns`
// rather than exposing it through an editable selector. See 04-05-SUMMARY.md
// for the full trade-off writeup.
const instanciasRotinaConfig: EntityConfig = {
  etype: "instanciasRotina",
  titulo: "Instâncias de rotina",
  descricao:
    "Instâncias de rotina geradas pelos templates. Apenas o status pode ser atualizado aqui.",
  ordem: 6,
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
  listColumns: ["competencia", "dataPrevista", "status", "tipoPrazo"],
};

export default instanciasRotinaConfig;
