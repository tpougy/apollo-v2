<script lang="ts">
  import EntityScreen from "../entities/EntityScreen.svelte";
  import { configByEtype } from "../entities/registry";
  import type { EntityConfig } from "../entities/types";
  import SubtarefasPanel from "./SubtarefasPanel.svelte";

  // Never import defs/tickets.ts directly here -- always resolve through the
  // registry so its own default-export validation (registry.ts:21-29) runs
  // first, mirroring ProjetosSection.svelte's requireConfig.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`TicketsSection: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const ticketsConfig = requireConfig("tickets");

  // No separate <h2> is rendered here on purpose: `EntityScreen(ticketsConfig)`
  // below already renders its own unconditional `<h2>{config.titulo}</h2>` --
  // "Tickets" (tickets.ts's `titulo`), which already satisfies
  // shell-nav.spec.ts's `EXPECTED_H2_BY_TESTID["nav-tickets"] = "Tickets"`
  // assertion. Adding a second, identically-worded `<h2>` here (as a literal
  // reading of 20-01-PLAN.md's Task 1 action text suggests, mirroring
  // ProjetosSection.svelte:281) would leave TWO `<h2>Tickets</h2>` elements
  // on the page the instant nav-tickets is clicked -- ProjetosSection's own
  // `<h2>` is necessary there ONLY because `EntityScreen(projetosConfig)` is
  // never visibly mounted (a bespoke master/detail UI replaces it entirely);
  // TicketsSection mounts `EntityScreen(ticketsConfig)` directly and
  // unconditionally, so it already provides the heading. Verified live: a
  // page with two identical `<h2>Tickets</h2>` elements makes
  // `expect(page.locator("h2")).toHaveText("Tickets")` fail with a Playwright
  // strict-mode violation (2 elements resolved), breaking the existing,
  // unmodified `shell-nav.spec.ts` "each nav Button renders its
  // corresponding EntityScreen" test -- a regression directly caused by this
  // task's own change, auto-fixed per Rule 1. Documented as a deviation in
  // 20-01-SUMMARY.md.

  let selectedTicketId = $state<string | null>(null);
  let selectedTicketTitulo = $state("");

  // Plain DOM click-delegation wrapper around EntityScreen's own,
  // unmodified output -- EntityScreen.svelte gains no new prop or callback
  // for this. Clicking a row's own `row-edit`/`row-delete` button also
  // (harmlessly) selects that row, since both live inside the same
  // `[data-testid="row"]` ancestor this handler walks up to.
  function handleTableClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-testid="row"]');
    if (!row) return;
    const eid = row.getAttribute("data-eid");
    if (!eid) return;
    // `tickets.ts`'s `listColumns: ["titulo", ...]` puts titulo first --
    // the row's first <td> is always the titulo cell.
    const firstCell = row.querySelector("td");
    selectedTicketId = eid;
    selectedTicketTitulo = firstCell?.textContent?.trim() ?? "";
  }
</script>

<div class="flex gap-6">
  <div class="flex-1">
    <!-- Plain DOM click-delegation wrapper, not a native interactive
         element -- selection is a pointer-driven convenience shortcut over
         EntityScreen's own already-focusable/keyboard-usable row-edit
         button (which also lands on the same row via handleTableClick's
         closest() walk), so no separate keyboard handler is added here.
         `role="none"` tells assistive tech this wrapper carries no semantic
         meaning of its own (the real, keyboard-usable semantics live on
         EntityScreen's own unmodified row-edit/row-delete buttons inside),
         which also satisfies both a11y/no-static-element-interactions and
         a11y/use-key-with-click-events without adding a fake interactive
         role to a non-interactive delegation container. -->
    <div data-testid="tickets-table" role="none" onclick={handleTableClick}>
      <EntityScreen config={ticketsConfig} />
    </div>
  </div>

  {#if selectedTicketId}
    <!-- Forces a clean remount on every ticket switch, mirroring
         Shell.svelte's own `{#key rota.etype}` pattern -- avoids stale
         internal EntityScreen state (e.g. an open create/edit dialog)
         carrying over from the previously-selected ticket. -->
    {#key selectedTicketId}
      <SubtarefasPanel
        parentType="ticket"
        parentId={selectedTicketId}
        parentLabel={selectedTicketTitulo}
        onClose={() => (selectedTicketId = null)}
      />
    {/key}
  {/if}
</div>
