---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 3
total_count: 12
last_updated: 2026-08-11T16:49:59.027Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 10 | deviation | web/e2e/entities-rotina-log.spec.ts |  | Date-fill (.fill on field-tipoGeracao's dataPrevista-style fields) and .selectOption() call sites break against 10-01's Dialog/Checkbox/Calendar restyle; select-option breakage requires 10-02's Select conversion before this file can go green again — expected transient state, not a regression introduced outside plan scope. | fixed |  | 2026-08-10T00:59:46.512Z | 2026-08-10T02:47:11.449Z |
| 2 | 10 | deviation | web/e2e/entities-projeto-etapa-tarefa.spec.ts |  | Date-fill (.fill on dataInicioPrevista/dataPrevistaEstimada) and .selectOption() (link-fundo/link-projeto/link-etapa) call sites break against 10-01's Dialog/Checkbox/Calendar restyle; requires 10-02's Select conversion before this file can go green again — expected transient state within this phase's multi-plan sequence. | fixed |  | 2026-08-10T00:59:53.894Z | 2026-08-10T02:47:11.528Z |
| 3 | 10 | deviation | web/e2e/entities-ticket-subtarefa.spec.ts |  | Date-fill (.fill on field-dataRecebimento) and .selectOption()/xor-parent-type call sites break against 10-01's Dialog/Checkbox/Calendar restyle; requires 10-02's Select conversion before this file can go green again — expected transient state within this phase's multi-plan sequence. | fixed |  | 2026-08-10T00:59:53.972Z | 2026-08-10T02:47:11.603Z |
| 4 | 18 | deviation | web/e2e/cross-phase-verification.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.424Z |  |
| 5 | 18 | deviation | web/e2e/entities-delete-confirmation.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.499Z |  |
| 6 | 18 | deviation | web/e2e/entities-form-dialog-composition.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.574Z |  |
| 7 | 18 | deviation | web/e2e/entities-form-restyle.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.646Z |  |
| 8 | 18 | deviation | web/e2e/entities-header-states.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.725Z |  |
| 9 | 18 | deviation | web/e2e/entities-projeto-etapa-tarefa.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.802Z |  |
| 10 | 18 | deviation | web/e2e/entities-rotina-log.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.877Z |  |
| 11 | 18 | deviation | web/e2e/entities-ticket-subtarefa.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:58.951Z |  |
| 12 | 18 | deviation | web/e2e/shell-chrome.spec.ts |  | References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff. | open |  | 2026-08-11T16:49:59.027Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "10",
    "file": "web/e2e/entities-rotina-log.spec.ts",
    "line": null,
    "description": "Date-fill (.fill on field-tipoGeracao's dataPrevista-style fields) and .selectOption() call sites break against 10-01's Dialog/Checkbox/Calendar restyle; select-option breakage requires 10-02's Select conversion before this file can go green again — expected transient state, not a regression introduced outside plan scope.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T00:59:46.512Z",
    "resolved_at": "2026-08-10T02:47:11.449Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "10",
    "file": "web/e2e/entities-projeto-etapa-tarefa.spec.ts",
    "line": null,
    "description": "Date-fill (.fill on dataInicioPrevista/dataPrevistaEstimada) and .selectOption() (link-fundo/link-projeto/link-etapa) call sites break against 10-01's Dialog/Checkbox/Calendar restyle; requires 10-02's Select conversion before this file can go green again — expected transient state within this phase's multi-plan sequence.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T00:59:53.894Z",
    "resolved_at": "2026-08-10T02:47:11.528Z"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "10",
    "file": "web/e2e/entities-ticket-subtarefa.spec.ts",
    "line": null,
    "description": "Date-fill (.fill on field-dataRecebimento) and .selectOption()/xor-parent-type call sites break against 10-01's Dialog/Checkbox/Calendar restyle; requires 10-02's Select conversion before this file can go green again — expected transient state within this phase's multi-plan sequence.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T00:59:53.972Z",
    "resolved_at": "2026-08-10T02:47:11.603Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/cross-phase-verification.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.424Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-delete-confirmation.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.499Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-form-dialog-composition.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.574Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-form-restyle.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.646Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-header-states.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.725Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-projeto-etapa-tarefa.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.802Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-rotina-log.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.877Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/entities-ticket-subtarefa.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:58.951Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "18",
    "file": "web/e2e/shell-chrome.spec.ts",
    "line": null,
    "description": "References dead nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids (removed by 18-01's NAV-02 topbar restructuring) and/or hardcoded 9-entity counts; requires 18-03's NAV-05 gotoNested e2e migration before this file passes again -- expected transient state within this phase's multi-plan sequence, empirically confirmed via 18-02's A/B verification run, not a regression introduced by 18-02's EntityScreen.svelte diff.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T16:49:59.027Z",
    "resolved_at": null
  }
]
````
