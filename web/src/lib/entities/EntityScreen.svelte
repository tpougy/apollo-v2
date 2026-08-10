<script lang="ts">
  import { DateFormatter, type DateValue, getLocalTimeZone, parseDate } from "@internationalized/date";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Calendar } from "$lib/components/ui/calendar";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import * as Select from "$lib/components/ui/select";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Textarea } from "$lib/components/ui/textarea";
  import { cn } from "$lib/utils";
  import { toast } from "svelte-sonner";
  import { db, id } from "../db";
  import type { EntityConfig, LinkDef } from "./types";

  const dateFormatter = new DateFormatter("pt-BR", { dateStyle: "long" });

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

  // Column-name allowlist for Badge rendering (ENTTBL-02), value-blind and
  // never per-entity special-cased: any listColumn named "status",
  // "tipoGeracao", or "tipoPrazo", plus any field of kind "boolean".
  const BADGE_COLUMN_NAMES = new Set(["status", "tipoGeracao", "tipoPrazo"]);

  function isBadgeColumn(columnName: string): boolean {
    const field = config.fields.find((f) => f.name === columnName);
    if (!field) return false; // links/xorLink choices are never Badge-worthy
    if (field.kind === "boolean") return true;
    return BADGE_COLUMN_NAMES.has(columnName);
  }

  function badgeVariantFor(columnName: string, row: Row): "secondary" | "outline" {
    const field = config.fields.find((f) => f.name === columnName);
    if (field?.kind === "boolean") return row[field.name] ? "secondary" : "outline";
    if (columnName === "status") return "secondary";
    return "outline";
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
  // Per-field open state for the date-picker Popover, so picking a day in
  // one field's Calendar doesn't affect another field's popover.
  let datePopoverOpen = $state<Record<string, boolean>>({});

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
      toast.error(formError);
      return;
    }

    for (const link of config.links ?? []) {
      if (link.required && !selectedLinks[link.label]) {
        formError = `Campo obrigatório: ${link.label}`;
        toast.error(formError);
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
          toast.error(formError);
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
        toast.error(formError);
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
          toast.error(formError);
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
      const wasCreate = mode === "create";
      mode = null;
      editingId = null;
      toast.success(wasCreate ? "Registro criado." : "Registro atualizado.");
    } catch (err) {
      formError = extractErrorMessage(err);
      toast.error(formError);
    }
  }

  async function handleDelete(row: Row) {
    const confirmed = window.confirm(`Excluir este registro de ${config.titulo}?`);
    if (!confirmed) return;
    formError = null;
    try {
      const tx = db.tx as unknown as Record<string, Record<string, { delete: () => unknown }>>;
      await db.transact(tx[config.etype][row.id].delete() as never);
      toast.success("Registro excluído.");
    } catch (err) {
      formError = extractErrorMessage(err);
      toast.error(formError);
    }
  }
</script>

<section>
  <h2>{config.titulo}</h2>

  {#if formError}
    <Alert variant="destructive">
      <CircleAlert class="size-4" />
      <AlertDescription data-testid="entity-error">{formError}</AlertDescription>
    </Alert>
  {/if}

  {#if query.isLoading}
    <p>carregando...</p>
  {:else if query.error}
    <Alert variant="destructive">
      <CircleAlert class="size-4" />
      <AlertDescription data-testid="entity-error">{query.error.message}</AlertDescription>
    </Alert>
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          {#each config.listColumns as column}
            <TableHead>{column}</TableHead>
          {/each}
          <TableHead>ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if rowsOf().length === 0}
          <TableRow data-testid="empty-state">
            <TableCell colspan={config.listColumns.length + 1}>Nenhum registro.</TableCell>
          </TableRow>
        {:else}
          {#each rowsOf() as row (row.id)}
            <TableRow data-testid="row" data-eid={row.id}>
              {#each config.listColumns as column}
                <TableCell>
                  {#if isBadgeColumn(column)}
                    <Badge variant={badgeVariantFor(column, row)}>
                      {columnValue(row, column)}
                    </Badge>
                  {:else}
                    {columnValue(row, column)}
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                {#if config.capabilities.update}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="row-edit"
                    onclick={() => startEdit(row)}
                  >
                    editar
                  </Button>
                {/if}
                {#if config.capabilities.delete}
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="row-delete"
                    onclick={() => handleDelete(row)}
                  >
                    excluir
                  </Button>
                {/if}
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>

    {#if mode === null && config.capabilities.create}
      <Button type="button" data-testid="entity-create-start" onclick={startCreate}>
        novo
      </Button>
    {/if}

    <Dialog.Root
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) cancelForm();
      }}
    >
      <Dialog.Content class="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title>{mode === "create" ? "Novo" : "Editar"} — {config.titulo}</Dialog.Title>
        </Dialog.Header>
        <form onsubmit={handleSubmit} novalidate>
          {#each editableFields() as f (f.name)}
            <div>
              <Label for={`field-${f.name}`}>{f.label}</Label>
              {#if f.kind === "text"}
                <Input
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
                <Textarea
                  id={`field-${f.name}`}
                  data-testid={`field-${f.name}`}
                  required={f.required}
                  value={formValues[f.name] as string}
                  oninput={(e) => {
                    formValues[f.name] = e.currentTarget.value;
                  }}
                ></Textarea>
              {:else if f.kind === "number"}
                <Input
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
                <Checkbox
                  id={`field-${f.name}`}
                  data-testid={`field-${f.name}`}
                  checked={Boolean(formValues[f.name])}
                  onCheckedChange={(v) => {
                    formValues[f.name] = v === true;
                  }}
                />
              {:else if f.kind === "date"}
                <Popover.Root
                  open={datePopoverOpen[f.name] ?? false}
                  onOpenChange={(open) => {
                    datePopoverOpen[f.name] = open;
                  }}
                >
                  <Popover.Trigger>
                    {#snippet child({ props })}
                      <Button
                        variant="outline"
                        id={`field-${f.name}`}
                        data-testid={`field-${f.name}`}
                        class={cn(
                          "w-full justify-start text-start font-normal",
                          !formValues[f.name] && "text-muted-foreground",
                        )}
                        {...props}
                      >
                        <CalendarIcon class="me-2 size-4" />
                        {formValues[f.name]
                          ? dateFormatter.format(
                              parseDate(formValues[f.name] as string).toDate(getLocalTimeZone()),
                            )
                          : "Selecione..."}
                      </Button>
                    {/snippet}
                  </Popover.Trigger>
                  <Popover.Content class="w-auto p-0">
                    <Calendar
                      type="single"
                      locale="pt-BR"
                      value={
                        formValues[f.name]
                          ? (parseDate(formValues[f.name] as string) as DateValue)
                          : undefined
                      }
                      onValueChange={(v) => {
                        formValues[f.name] = v ? v.toString() : "";
                        datePopoverOpen[f.name] = false;
                      }}
                    />
                  </Popover.Content>
                </Popover.Root>
              {:else if f.kind === "select"}
                <Select.Root
                  type="single"
                  value={formValues[f.name] as string}
                  onValueChange={(v) => {
                    formValues[f.name] = v;
                  }}
                >
                  <Select.Trigger id={`field-${f.name}`} data-testid={`field-${f.name}`} class="w-full">
                    {(formValues[f.name] as string) || "selecione..."}
                  </Select.Trigger>
                  <Select.Content>
                    {#each f.options as opt (opt)}
                      <Select.Item value={opt} label={opt}>{opt}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              {/if}
            </div>
          {/each}

          {#each config.links ?? [] as link (link.label)}
            <div>
              <Label for={`link-${link.label}`}>{link.label}</Label>
              <Select.Root
                type="single"
                value={selectedLinks[link.label] ?? ""}
                onValueChange={(v) => {
                  selectedLinks[link.label] = v;
                }}
              >
                <Select.Trigger id={`link-${link.label}`} data-testid={`link-${link.label}`} class="w-full">
                  {String(
                    linkOptionsFor(link).find((o) => o.id === selectedLinks[link.label])?.[
                      link.targetLabelField
                    ] ?? "—",
                  )}
                </Select.Trigger>
                <Select.Content>
                  {#if !link.required}
                    <Select.Item value="" label="—">—</Select.Item>
                  {/if}
                  {#each linkOptionsFor(link) as opt (opt.id)}
                    <Select.Item value={opt.id} label={String(opt[link.targetLabelField] ?? "")}>
                      {String(opt[link.targetLabelField] ?? "")}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {/each}

          {#if config.xorLink}
            <div>
              <Label for="xor-parent-type">{config.xorLink.label}</Label>
              <Select.Root
                type="single"
                value={xorParentType ?? ""}
                onValueChange={(v) => {
                  xorParentType = v;
                  xorParentId = "";
                }}
              >
                <Select.Trigger id="xor-parent-type" data-testid="xor-parent-type" class="w-full">
                  {xorParentType ?? "selecione..."}
                </Select.Trigger>
                <Select.Content>
                  {#each config.xorLink.choices as choice (choice.label)}
                    <Select.Item value={choice.label} label={choice.label}>{choice.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              {#if xorParentType}
                <Select.Root
                  type="single"
                  value={xorParentId}
                  onValueChange={(v) => {
                    xorParentId = v;
                  }}
                >
                  <Select.Trigger data-testid={`link-${xorParentType}`} class="w-full">
                    {String(
                      (activeXorChoice()
                        ? xorOptionsFor(activeXorChoice() as LinkDef)
                        : []
                      ).find((o) => o.id === xorParentId)?.[
                        (activeXorChoice() as LinkDef).targetLabelField
                      ] ?? "—",
                    )}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="" label="—">—</Select.Item>
                    {#each activeXorChoice() ? xorOptionsFor(activeXorChoice() as LinkDef) : [] as opt (opt.id)}
                      <Select.Item
                        value={opt.id}
                        label={String(opt[(activeXorChoice() as LinkDef).targetLabelField] ?? "")}
                      >
                        {String(opt[(activeXorChoice() as LinkDef).targetLabelField] ?? "")}
                      </Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              {/if}
            </div>
          {/if}

          <Button type="submit" data-testid="entity-submit">salvar</Button>
          <Button type="button" variant="ghost" data-testid="entity-cancel" onclick={cancelForm}>
            cancelar
          </Button>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
</section>
