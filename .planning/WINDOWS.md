---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 3
total_count: 3
last_updated: 2026-08-10T02:47:11.603Z
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
  }
]
````
