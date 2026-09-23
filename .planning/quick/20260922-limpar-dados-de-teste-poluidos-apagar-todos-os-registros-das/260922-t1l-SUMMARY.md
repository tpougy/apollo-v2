---
quick_id: 260922-t1l
status: complete
one_liner: Deleted 262 templatesRotina + 957 instanciasRotina test rows from production via a transient admin-token script; 7 other entities untouched.
key-files:
  created: []
  modified: []
  deleted:
    - cli/scripts/cleanup_rotina_test_data.py
commits:
  - 17a86b6: "feat(260922-t1l): add transient admin cleanup script for rotina test data"
  - cfdef03: "chore(260922-t1l): delete production test-onboarding rotina pollution"
metrics:
  duration: ~10min
  tasks: 2
  completed: 2026-09-22
---

# Quick Task 260922-t1l: Limpar dados de teste poluídos Summary

Permanently deleted every `templatesRotina` and `instanciasRotina` record in
the production InstantDB app using a transient admin-client script, then
removed the script — leaving no permanent addition to the repo and 0 rows
remaining in both target entities.

## What Happened

**Task 1 — Write the admin cleanup script and capture live before-counts (dry run only)**

Created `cli/scripts/cleanup_rotina_test_data.py`, deliberately outside the
`apollo_cli` package (so `cli/tests/test_auth_rejection.py`'s admin-token
confinement AST gate, which walks only `cli/apollo_cli/**/*.py`, never sees
its `login_client()` call). The script imports `login_client()` from
`apollo_cli.instant_client` — the sole sanctioned admin-token constructor —
and never reads `INSTANT_APP_ADMIN_TOKEN` itself.

Default (no `--confirmar`): queries all 9 entities in one admin `client.query`
call, prints `{"before": {...9 counts...}, "confirmado": false}`, and returns
without ever calling `client.transact`. Two consecutive dry runs against
production returned byte-identical JSON:

```json
{"before": {"etapas": 0, "fundos": 58, "instanciasRotina": 957, "logInferenciaClaude": 0, "projetos": 0, "subtarefas": 0, "tarefas": 1, "templatesRotina": 262, "tickets": 0}, "confirmado": false}
```

Note: live counts (templatesRotina=262, instanciasRotina=957, fundos=58) were
higher than STATE.md's originally documented v1.5 onboarding figures
(18 fundos / 84 templatesRotina / 168 instanciasRotina) — confirming the plan's
framing that pollution "accumulated since" that run (additional live-test
activity in Phases 29-31 and v1.5 close). This does not change scope: the
task is "delete ALL templatesRotina/instanciasRotina rows, regardless of
count," which was satisfied either way.

**Task 2 — Run the real deletion, verify independently, remove the transient script**

Ran `cleanup_rotina_test_data.py --confirmar` against production. It deleted
all `templatesRotina` and `instanciasRotina` rows in batches of up to 200 ids
per `client.transact` call, then re-queried and asserted live:

```json
{"after": {"etapas": 0, "fundos": 58, "instanciasRotina": 0, "logInferenciaClaude": 0, "projetos": 0, "subtarefas": 0, "tarefas": 1, "templatesRotina": 0, "tickets": 0}}
```

Both target entities were 0 and all 7 canary entities (`fundos`, `projetos`,
`etapas`, `tarefas`, `tickets`, `subtarefas`, `logInferenciaClaude`) were
byte-identical to their before-counts. The script exited 0 (internal
assertions passed), then was deleted from the working tree
(`rm cli/scripts/cleanup_rotina_test_data.py`).

An independent post-removal admin query — a fresh `python -c` one-liner using
`login_client()` directly, not the now-deleted script — confirmed:

```
0 0
```

for `templatesRotina` / `instanciasRotina` respectively.

## Before/After Counts (production, live)

| Entity | Before | After | Changed? |
|---|---|---|---|
| templatesRotina | 262 | 0 | Yes (deleted) |
| instanciasRotina | 957 | 0 | Yes (deleted) |
| fundos | 58 | 58 | No |
| projetos | 0 | 0 | No |
| etapas | 0 | 0 | No |
| tarefas | 1 | 1 | No |
| tickets | 0 | 0 | No |
| subtarefas | 0 | 0 | No |
| logInferenciaClaude | 0 | 0 | No |

## Deviations from Plan

None — plan executed exactly as written. Only deviation-adjacent note: actual
live counts were higher than the numbers cited in the plan's objective text
(262/957 vs. the historically-documented 84/168), which the plan itself
anticipated ("plus whatever accumulated since") and does not affect scope or
correctness.

## Verification

All three `<verification>` items from the plan confirmed:

1. `git status --porcelain cli/scripts/` — empty (script created and removed
   within this plan, directory itself no longer exists).
2. Independent admin query (ad-hoc `python -c`, `login_client()`) —
   `templatesRotina`/`instanciasRotina` both 0.
3. Optional CLI-surface check — skipped (no `apollo auth login` session
   active in this environment); not required per plan's own wording.

## Self-Check: PASSED

- `cli/scripts/cleanup_rotina_test_data.py` — MISSING (expected; deleted by design).
- Commit `17a86b6` — FOUND in `git log`.
- Commit `cfdef03` — FOUND in `git log`.
- Live production query — confirmed 0/0 for `templatesRotina`/`instanciasRotina`, independently re-verified a third time after both commits.
