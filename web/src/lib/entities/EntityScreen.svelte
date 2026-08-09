<script lang="ts">
  import { db, id } from "../db";
  import type { EntityConfig, LinkDef } from "./types";

  let { config: configProp }: { config: EntityConfig } = $props();

  // EntityScreen is always mounted keyed on etype (see Shell.svelte's
  // `{#key ativo}`), so config is fixed for the component's lifetime.
  // Snapshotting it once avoids Svelte's "state referenced locally" warning
  // that would otherwise fire on every non-reactive read of the prop below.
  const config = configProp;

  // Generic record shape for query results — the schema is dynamic per
  // config, so it cannot be expressed as a literal InstaQL type here.
  type Row = { id: string } & Record<string, unknown>;
  type LinkedRow = { id: string } & Record<string, unknown>;

  function isoToDateInputValue(iso: string): string {
    return iso.slice(0, 10);
  }

  function dateInputValueToIso(value: string): string {
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }

  function extractErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "body" in err) {
      const body = (err as { body?: { message?: string } }).body;
      if (body?.message) return body.message;
    }
    if (err instanceof Error) return err.message;
    return "Erro desconhecido ao salvar.";
  }

  function buildQuery(cfg: EntityConfig): Record<string, unknown> {
    const sub: Record<string, Record<string, never>> = {};
    for (const link of cfg.links ?? []) sub[link.label] = {};
    if (cfg.xorLink) {
      for (const choice of cfg.xorLink.choices) sub[choice.label] = {};
    }
    return { [cfg.etype]: { $: {}, ...sub } };
  }

  // Cast at the InstaQL boundary: config.etype is a runtime string, not a
  // literal from the generated schema union, so the strongly-typed query
  // surface cannot express it structurally. This is the one place the
  // generic engine trades static query typing for config-driven reuse.
  const query = db.useQuery(() => buildQuery(config) as never);

  const linkTargetQueries = (config.links ?? []).map((link) => ({
    link,
    result: db.useQuery(() => ({ [link.targetEtype]: {} }) as never),
  }));

  const xorTargetQueries = config.xorLink
    ? config.xorLink.choices.map((choice) => ({
        choice,
        result: db.useQuery(() => ({ [choice.targetEtype]: {} }) as never),
      }))
    : [];

  const auth = db.useAuth();

  function linkOptionsFor(link: LinkDef): LinkedRow[] {
    const entry = linkTargetQueries.find((t) => t.link.label === link.label);
    const data = entry?.result.data as Record<string, LinkedRow[]> | undefined;
    const rows = (data?.[link.targetEtype] ?? []) as LinkedRow[];
    if (link.excludeSelf && editingId) {
      return rows.filter((row) => row.id !== editingId);
    }
    return rows;
  }

  function xorOptionsFor(choice: LinkDef): LinkedRow[] {
    const entry = xorTargetQueries.find((t) => t.choice.label === choice.label);
    const data = entry?.result.data as Record<string, LinkedRow[]> | undefined;
    return (data?.[choice.targetEtype] ?? []) as LinkedRow[];
  }

  function activeXorChoice(): LinkDef | undefined {
    return config.xorLink?.choices.find((choice) => choice.label === xorParentType);
  }

  function rowsOf(): Row[] {
    const data = query.data as Record<string, Row[]> | undefined;
    return (data?.[config.etype] ?? []) as Row[];
  }

  function editableFields() {
    if (mode === "edit" && config.updatableFields) {
      return config.fields.filter((f) => config.updatableFields?.includes(f.name));
    }
    return config.fields;
  }

  function labelForLinkedValue(row: Row, columnName: string, targetLabelField: string): string {
    const linked = row[columnName] as LinkedRow | LinkedRow[] | undefined;
    const one = Array.isArray(linked) ? linked[0] : linked;
    return one ? String(one[targetLabelField] ?? "") : "";
  }

  function columnValue(row: Row, columnName: string): string {
    const field = config.fields.find((f) => f.name === columnName);
    if (field) {
      const raw = row[field.name];
      if (field.kind === "boolean") return raw ? "sim" : "não";
      if (field.kind === "date") return typeof raw === "string" ? isoToDateInputValue(raw) : "";
      return raw === undefined || raw === null ? "" : String(raw);
    }
    const link = (config.links ?? []).find((l) => l.label === columnName);
    if (link) return labelForLinkedValue(row, columnName, link.targetLabelField);
    const choice = config.xorLink?.choices.find((c) => c.label === columnName);
    if (choice) return labelForLinkedValue(row, columnName, choice.targetLabelField);
    return "";
  }

  type FormValues = Record<string, string | number | boolean>;

  let mode = $state<"create" | "edit" | null>(null);
  let editingId = $state<string | null>(null);
  let formValues = $state<FormValues>({});
  let selectedLinks = $state<Record<string, string>>({});
  let xorParentType = $state<string | null>(null);
  let xorParentId = $state<string>("");
  // Snapshot of the xorLink parent as it existed on the server when edit
  // started. Used at submit time to detect a parent-type switch and unlink
  // the stale choice — the shipped edit path only ever added the new link,
  // which could leave a record with both a tarefa and a ticket link after
  // switching. See EntityScreen.svelte fix in 04-04.
  let originalXorParentType = $state<string | null>(null);
  let originalXorParentId = $state<string>("");
  let formError = $state<string | null>(null);

  function startCreate() {
    formError = null;
    mode = "create";
    editingId = null;
    const values: FormValues = {};
    for (const f of config.fields) {
      values[f.name] = f.kind === "boolean" ? false : "";
    }
    formValues = values;
    const links: Record<string, string> = {};
    for (const link of config.links ?? []) links[link.label] = "";
    selectedLinks = links;
    xorParentType = config.xorLink ? config.xorLink.choices[0].label : null;
    xorParentId = "";
    originalXorParentType = null;
    originalXorParentId = "";
  }

  function startEdit(row: Row) {
    formError = null;
    mode = "edit";
    editingId = row.id;
    const values: FormValues = {};
    for (const f of editableFields()) {
      const raw = row[f.name];
      if (f.kind === "date") {
        values[f.name] = typeof raw === "string" ? isoToDateInputValue(raw) : "";
      } else if (f.kind === "boolean") {
        values[f.name] = Boolean(raw);
      } else if (f.kind === "number") {
        values[f.name] = typeof raw === "number" ? raw : "";
      } else {
        values[f.name] = typeof raw === "string" ? raw : "";
      }
    }
    formValues = values;
    const links: Record<string, string> = {};
    for (const link of config.links ?? []) {
      const linked = row[link.label] as LinkedRow | LinkedRow[] | undefined;
      const one = Array.isArray(linked) ? linked[0] : linked;
      links[link.label] = one?.id ?? "";
    }
    selectedLinks = links;
    xorParentType = null;
    xorParentId = "";
    originalXorParentType = null;
    originalXorParentId = "";
    if (config.xorLink) {
      for (const choice of config.xorLink.choices) {
        const linked = row[choice.label] as LinkedRow | LinkedRow[] | undefined;
        const one = Array.isArray(linked) ? linked[0] : linked;
        if (one?.id) {
          xorParentType = choice.label;
          xorParentId = one.id;
          originalXorParentType = choice.label;
          originalXorParentId = one.id;
        }
      }
    }
  }

  function cancelForm() {
    mode = null;
    editingId = null;
    formError = null;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;

    if (config.xorLink && (!xorParentType || !xorParentId)) {
      formError = `Selecione exatamente um vínculo para "${config.xorLink.label}".`;
      return;
    }

    for (const link of config.links ?? []) {
      if (link.required && !selectedLinks[link.label]) {
        formError = `Campo obrigatório: ${link.label}`;
        return;
      }
    }

    const visible = editableFields();
    const payload: Record<string, string | number | boolean> = {};
    for (const f of visible) {
      const raw = formValues[f.name];
      if (raw === undefined || raw === "") {
        if (f.required) {
          formError = `Campo obrigatório: ${f.label}`;
          return;
        }
        continue;
      }
      if (f.kind === "date") {
        payload[f.name] = dateInputValueToIso(raw as string);
      } else if (f.kind === "number") {
        payload[f.name] = Number(raw);
      } else {
        payload[f.name] = raw;
      }
    }

    const linkPayload: Record<string, string> = {};
    const linkTargets: Record<string, string> = {};
    for (const link of config.links ?? []) {
      const targetId = selectedLinks[link.label];
      if (targetId) {
        linkPayload[link.label] = targetId;
        linkTargets[link.label] = link.targetEtype;
      }
    }
    if (config.xorLink && xorParentType && xorParentId) {
      linkPayload[xorParentType] = xorParentId;
      const choice = activeXorChoice();
      if (choice) linkTargets[xorParentType] = choice.targetEtype;
    }

    // On edit, if the xorLink parent type was switched away from the
    // originally-loaded choice, unlink the stale parent so the record never
    // ends up linked to both choices at once (the XOR invariant).
    const unlinkPayload: Record<string, string> = {};
    if (
      mode === "edit" &&
      config.xorLink &&
      originalXorParentType &&
      originalXorParentType !== xorParentType
    ) {
      unlinkPayload[originalXorParentType] = originalXorParentId;
    }

    for (const [label, targetId] of Object.entries(linkPayload)) {
      const targetEtype = linkTargets[label];
      const result = await db.queryOnce({
        [targetEtype]: { $: { where: { id: targetId } } },
      } as never);
      const rows = (result.data as Record<string, unknown[]>)[targetEtype] ?? [];
      if (rows.length === 0) {
        formError = `parent_not_found: ${label}`;
        return;
      }
    }

    try {
      type TxLinkChunk = {
        link: (links: Record<string, string>) => TxLinkChunk;
        unlink: (links: Record<string, string>) => TxLinkChunk;
      };
      const tx = db.tx as unknown as Record<
        string,
        Record<
          string,
          {
            update: (fields: Record<string, unknown>) => TxLinkChunk;
          }
        >
      >;

      if (mode === "create") {
        const donoId = auth.user?.id;
        if (!donoId) {
          formError = "Sessão não autenticada.";
          return;
        }
        const newId = id();
        const chunk = tx[config.etype][newId].update({ ...payload, donoId });
        const finalChunk =
          Object.keys(linkPayload).length > 0 ? chunk.link(linkPayload) : chunk;
        await db.transact(finalChunk as never);
      } else if (mode === "edit" && editingId) {
        const chunk = tx[config.etype][editingId].update(payload);
        const linked =
          Object.keys(linkPayload).length > 0 ? chunk.link(linkPayload) : chunk;
        const finalChunk =
          Object.keys(unlinkPayload).length > 0 ? linked.unlink(unlinkPayload) : linked;
        await db.transact(finalChunk as never);
      }
      mode = null;
      editingId = null;
    } catch (err) {
      formError = extractErrorMessage(err);
    }
  }

  async function handleDelete(row: Row) {
    const confirmed = window.confirm(`Excluir este registro de ${config.titulo}?`);
    if (!confirmed) return;
    formError = null;
    try {
      const tx = db.tx as unknown as Record<string, Record<string, { delete: () => unknown }>>;
      await db.transact(tx[config.etype][row.id].delete() as never);
    } catch (err) {
      formError = extractErrorMessage(err);
    }
  }
</script>

<section>
  <h2>{config.titulo}</h2>

  {#if formError}
    <p data-testid="entity-error">{formError}</p>
  {/if}

  {#if query.isLoading}
    <p>carregando...</p>
  {:else if query.error}
    <p data-testid="entity-error">{query.error.message}</p>
  {:else}
    <table>
      <thead>
        <tr>
          {#each config.listColumns as column}
            <th>{column}</th>
          {/each}
          <th>ações</th>
        </tr>
      </thead>
      <tbody>
        {#if rowsOf().length === 0}
          <tr data-testid="empty-state">
            <td colspan={config.listColumns.length + 1}>Nenhum registro.</td>
          </tr>
        {:else}
          {#each rowsOf() as row (row.id)}
            <tr data-testid="row" data-eid={row.id}>
              {#each config.listColumns as column}
                <td>{columnValue(row, column)}</td>
              {/each}
              <td>
                {#if config.capabilities.update}
                  <button type="button" data-testid="row-edit" onclick={() => startEdit(row)}>
                    editar
                  </button>
                {/if}
                {#if config.capabilities.delete}
                  <button
                    type="button"
                    data-testid="row-delete"
                    onclick={() => handleDelete(row)}
                  >
                    excluir
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>

    {#if mode === null && config.capabilities.create}
      <button type="button" data-testid="entity-create-start" onclick={startCreate}>
        novo
      </button>
    {/if}

    {#if mode !== null}
      <form onsubmit={handleSubmit}>
        {#each editableFields() as f (f.name)}
          <div>
            <label for={`field-${f.name}`}>{f.label}</label>
            {#if f.kind === "text"}
              <input
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                type="text"
                required={f.required}
                value={formValues[f.name] as string}
                oninput={(e) => {
                  formValues[f.name] = e.currentTarget.value;
                }}
              />
            {:else if f.kind === "textarea"}
              <textarea
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                required={f.required}
                value={formValues[f.name] as string}
                oninput={(e) => {
                  formValues[f.name] = e.currentTarget.value;
                }}
              ></textarea>
            {:else if f.kind === "number"}
              <input
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                type="number"
                required={f.required}
                value={formValues[f.name] as number | string}
                oninput={(e) => {
                  const v = e.currentTarget.value;
                  formValues[f.name] = v === "" ? "" : e.currentTarget.valueAsNumber;
                }}
              />
            {:else if f.kind === "boolean"}
              <input
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                type="checkbox"
                checked={Boolean(formValues[f.name])}
                onchange={(e) => {
                  formValues[f.name] = e.currentTarget.checked;
                }}
              />
            {:else if f.kind === "date"}
              <input
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                type="date"
                required={f.required}
                value={formValues[f.name] as string}
                oninput={(e) => {
                  formValues[f.name] = e.currentTarget.value;
                }}
              />
            {:else if f.kind === "select"}
              <select
                id={`field-${f.name}`}
                data-testid={`field-${f.name}`}
                required={f.required}
                value={formValues[f.name] as string}
                onchange={(e) => {
                  formValues[f.name] = e.currentTarget.value;
                }}
              >
                <option value="" disabled>selecione...</option>
                {#each f.options as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/each}

        {#each config.links ?? [] as link (link.label)}
          <div>
            <label for={`link-${link.label}`}>{link.label}</label>
            <select
              id={`link-${link.label}`}
              data-testid={`link-${link.label}`}
              required={link.required}
              value={selectedLinks[link.label] ?? ""}
              onchange={(e) => {
                selectedLinks[link.label] = e.currentTarget.value;
              }}
            >
              {#if !link.required}
                <option value="">—</option>
              {/if}
              {#each linkOptionsFor(link) as opt (opt.id)}
                <option value={opt.id}>{String(opt[link.targetLabelField] ?? "")}</option>
              {/each}
            </select>
          </div>
        {/each}

        {#if config.xorLink}
          <div>
            <label for="xor-parent-type">{config.xorLink.label}</label>
            <select
              id="xor-parent-type"
              data-testid="xor-parent-type"
              value={xorParentType ?? ""}
              onchange={(e) => {
                xorParentType = e.currentTarget.value;
                xorParentId = "";
              }}
            >
              {#each config.xorLink.choices as choice (choice.label)}
                <option value={choice.label}>{choice.label}</option>
              {/each}
            </select>
            {#if xorParentType}
              <select
                data-testid={`link-${xorParentType}`}
                value={xorParentId}
                onchange={(e) => {
                  xorParentId = e.currentTarget.value;
                }}
              >
                <option value="">—</option>
                {#each activeXorChoice() ? xorOptionsFor(activeXorChoice() as LinkDef) : [] as opt (opt.id)}
                  <option value={opt.id}>
                    {String(opt[(activeXorChoice() as LinkDef).targetLabelField] ?? "")}
                  </option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}

        <button type="submit" data-testid="entity-submit">salvar</button>
        <button type="button" data-testid="entity-cancel" onclick={cancelForm}>cancelar</button>
      </form>
    {/if}
  {/if}
</section>
