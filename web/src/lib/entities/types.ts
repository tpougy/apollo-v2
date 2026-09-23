// Contract every `defs/*.ts` entity definition module implements.
// LOCKED shape for plans 04-03, 04-04, 04-05 — do not deviate. The owner-id
// field is never expressible here: it is injected exclusively from the
// authenticated session at submit time (see EntityScreen.svelte), never as
// a FieldDef.

export type FieldDef =
  | { name: string; label: string; required: boolean; kind: "text"; help?: string }
  | { name: string; label: string; required: boolean; kind: "textarea"; help?: string }
  | { name: string; label: string; required: boolean; kind: "number"; help?: string }
  | { name: string; label: string; required: boolean; kind: "boolean"; help?: string }
  | { name: string; label: string; required: boolean; kind: "date"; help?: string }
  | {
      name: string;
      label: string;
      required: boolean;
      kind: "select";
      options: readonly string[];
      help?: string;
    };

export interface LinkDef {
  label: string; // link label on THIS entity, e.g. "entidade", "projeto", "antecessor"
  targetEtype: string; // e.g. "entidades"
  targetLabelField: string; // field shown in the option text, e.g. "nome"
  required: boolean;
  excludeSelf?: boolean; // true for templatesRotina.antecessor (self-link)
  // When true, the link is rendered as a display-only table value (via the
  // existing generic listColumns/columnValue/labelForLinkedValue machinery,
  // unchanged) but is NEVER exposed as an editable <select> in the
  // create/edit form — see instanciasRotina.template for the motivating
  // case (a link whose value must never be user-reassignable).
  readOnly?: boolean;
}

export interface XorLinkDef {
  label: string; // UI label for the parent-type chooser
  choices: readonly [LinkDef, LinkDef]; // exactly one must be linked
}

export interface EntityConfig {
  etype: string; // InstantDB entity name, must match shared/instant.schema.ts
  titulo: string; // nav + heading text
  descricao: string; // one-line sub-heading shown under `titulo` in the entity screen's page-header row (ENTTBL-04)
  ordem: number; // nav sort order
  nav?: "primary" | "nested"; // Onde a entidade aparece na navegação. Ausente = 'primary'.
  navTitulo?: string; // Rótulo curto na topbar quando difere de `titulo`.
  capabilities: { create: boolean; update: boolean; delete: boolean };
  updatableFields?: readonly string[]; // when set, edit form exposes ONLY these (instanciasRotina => ["status"])
  fields: readonly FieldDef[];
  links?: readonly LinkDef[];
  xorLink?: XorLinkDef;
  listColumns: readonly string[]; // field names (and link labels) rendered as table columns
}
