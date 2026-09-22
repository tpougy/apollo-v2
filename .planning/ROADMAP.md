# Roadmap: Apollo v2

## Milestones

- 🔄 **v1.5 Correções descobertas no onboarding real do calendário de rotinas (RBR)** — Phases 26-31 (in progress)
- ✅ **v1.4 CLI instalável via uv tool, login sem admin token** — Phases 24-25 (shipped 2026-08-12)
- ✅ **v1.3 Navegação reorganizada + Dashboard de acompanhamento** — Phases 18-23 (shipped 2026-08-12)
- ✅ **v1.2 Lapidação de UI (SaaS-grade polish)** — Phases 12-17 (shipped 2026-08-10)
- ✅ **v1.1 UI bonita com Tailwind + shadcn-svelte** — Phases 7-11 (shipped 2026-08-10)
- ✅ **v1.0 Apollo v2 MVP** — Phases 1-6 (shipped 2026-08-09)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. Phase numbering is
continuous across milestones — v1.1 continued from v1.0's Phase 6, starting at Phase 7; v1.2
continued from v1.1's Phase 11, starting at Phase 12; v1.3 continued from v1.2's Phase 17,
starting at Phase 18; v1.4 continued from v1.3's Phase 23, starting at Phase 24; v1.5
continues from v1.4's Phase 25, starting at Phase 26. The next milestone continues from
Phase 32.

## v1.5 Correções descobertas no onboarding real do calendário de rotinas (RBR)

Nascida de um relatório de uso real (onboarding de 18 fundos/84 templates/168 instâncias
via `apollo` CLI), não de uma ideia de produto. Ver `.planning/REQUIREMENTS.md` para o
contexto completo e a evidência de código de cada achado.

- [x] **Phase 26: Validação na escrita** (completed 2026-08-14)
- [x] **Phase 27: Robustez do job** (completed 2026-08-14)
- [x] **Phase 28: Periodicidade semanal** (completed 2026-09-22)
- [x] **Phase 29: Controle de geração** (completed 2026-09-22)
- [x] **Phase 30: Ciclo de vida e higiene de dados** (completed 2026-09-22)
- [ ] **Phase 31: Cadastro em lote**

### Phase 26: Validação na escrita

**Goal**: Um template com `regraCompetencia` inválida é recusado na hora da escrita, com
mensagem listando os valores aceitos — nunca mais aceito e só revelado, em silêncio,
dentro de `gerar-instancias`. `propagarAtrasoSoft` deixa de parecer uma funcionalidade
ativa.
**Depends on**: Nothing (first phase of v1.5; builds on the existing `cli/rotina.py` from
v1.0/Phase 5)
**Requirements**: VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):

  1. `apollo rotina template criar --regra-competencia <valor-invalido>` falha
     imediatamente (exit não-zero, sem gravar registro), com mensagem listando `M0`,
     `M-1`, `M-2`, `M+1` (VAL-01).

  2. `apollo rotina template editar --regra-competencia <valor-invalido>` tem o mesmo
     comportamento (VAL-01).

  3. `apollo rotina template criar/editar --help` e `docs/ai-usage/CLAUDE.md` não
     descrevem mais `--regra-competencia` como livre/não parseado (VAL-01).

  4. `apollo rotina template criar/editar --help` deixa explícito que
     `--propagar-atraso-soft` é armazenado mas não lido por `gerar-instancias` (VAL-02).

  5. `apollo rotina instancia status --help` não descreve mais `dedupeKey` como hash
     (VAL-03).
**Plans**: 1 plan

Plans:

- [x] 26-01-PLAN.md — `--regra-competencia` click.Choice enforcement (criar/editar), fixture
  repair for existing CLI/e2e tests, and `--propagar-atraso-soft`/`dedupeKey` doc corrections

### Phase 27: Robustez do job

**Goal**: O job de geração para de depender de comparações frágeis (grafia exata de
"concluida") e para de recusar entradas reais do calendário (offset negativo em
`du_fixo`); diagnosticar um `skipped` em lote deixa de exigir cruzar ids manualmente.
**Depends on**: Phase 26 (mesma área de código; sequenciado depois para não conflitar
edições em `entities/rotina.py`/`routine_job.py` na mesma janela)
**Requirements**: JOB-01, JOB-02, JOB-03
**Success Criteria** (what must be TRUE):

  1. Um sucessor `encadeado` cuja instância-antecessora tem `status` gravado como
     `"Concluída"`, `"CONCLUIDA"` ou `"concluído"` é tratado como concluída para fins de
     `dataPrevistaEstimada` — não só a grafia exata `"concluida"` (JOB-01), com o mesmo
     resultado nos dois runtimes (fixture compartilhada).

  2. `apollo rotina template criar --tipo-geracao du_fixo --offset-dias -2` é aceito e
     `gerar-instancias` produz a data 2 dias úteis antes do último dia útil do mês —
     verificado contra o caso real da Prévia DU-2 de agosto/26 (27/08) (JOB-02).

  3. `apollo rotina template criar --tipo-geracao du_fixo --offset-dias 0` produz o
     último dia útil do mês (JOB-02).

  4. `apollo rotina gerar-instancias`'s relatório `skipped` inclui `nome` do template em
     toda entrada, nos dois runtimes (JOB-03).

  5. `shared/routine-job.testcases.json` ganha casos novos cobrindo status normalizado e
     offset negativo, consumidos por ambos os conjuntos de teste (CLI/web).
**Plans**: 2 plans

Plans:

- [x] 27-01-PLAN.md — `du_fixo` aceita `offsetDias <= 0` (nova `nth_business_day_from_month_end`
  em `bizdays.py`/`.ts`, dispatch por sinal, `--help` corrigido, caso real Prévia DU-2 provado
  ao vivo) (JOB-02)

- [x] 27-02-PLAN.md — status "concluída" reconhecido de forma normalizada (`_is_concluida`) e
  `nome` do template em todo `skipped`, nos dois runtimes, com retrofit completo do fixture
  compartilhado (JOB-01, JOB-03)

### Phase 28: Periodicidade semanal

**Goal**: Um evento recorrente ancorado em dia da semana (não em mês) pode ser
representado no Apollo sem aproximação artificial.
**Depends on**: Phase 27 (estende o mesmo dispatch de `tipoGeracao` em
`compute_expected_instances`/`computeExpectedInstances`)
**Requirements**: SEM-01
**Success Criteria** (what must be TRUE):

  1. `apollo rotina template criar --tipo-geracao semanal --dia-semana sexta` é aceito e
     `gerar-instancias` produz uma instância em cada sexta-feira dentro do range de
     geração.

  2. O caso real "Atualiz Calc RF" (toda sexta) é representável e gera as datas
     corretas para agosto/setembro de 2026.

  3. `shared/routine-job.testcases.json` ganha casos novos para o tipo semanal,
     idênticos nos dois runtimes.
**Plans**: 3 plans

Plans:

- [x] 28-01-PLAN.md — `[BLOCKING]` adiciona `templatesRotina.diaSemana` (schema) e faz o push
  ao vivo contra a InstantDB real, antes de qualquer código de CLI/compute tocar o campo
- [x] 28-02-PLAN.md — `--dia-semana` na CLI, `_compute_semanal_instances`/`computeSemanalInstances`
  em ambos os runtimes, prova ao vivo do caso real "Atualiz Calc RF" (7 sextas, ago/set 2026) e
  fixture cross-runtime compartilhada (SEM-01)
- [x] 28-03-PLAN.md — paridade SPA: `tipoGeracao=semanal` e `diaSemana` no formulário de
  templatesRotina, reparo dos dois specs e2e que travavam o conjunto antigo de 3 opções

### Phase 29: Controle de geração

**Goal**: Operar `gerar-instancias` em volume não obriga arrastar meses indesejados nem
perder instâncias do início do mês corrente por engano.
**Depends on**: Phase 28 (o recorte precisa cobrir o novo tipo semanal também)
**Requirements**: RANGE-01
**Success Criteria** (what must be TRUE):

  1. É possível gerar instâncias de exatamente uma competência (ex. `2026-08`) sem
     arrastar o mês seguinte junto.

  2. Rodando no meio do mês corrente, é possível recuperar as instâncias já passadas
     desse mês sem precisar calcular manualmente uma `--data-base` retroativa.

  3. Rodar `gerar-instancias` com e sem o novo recorte, cobrindo o mesmo intervalo
     final, produz o mesmo conjunto de instâncias (idempotência/C-06 preservada).

  4. Nenhuma instância gerada com o recorte tem uma `dataPrevista`/`dedupeKey`
     diferente da que teria sem o recorte.
**Plans**: 1 plan

Plans:

- [x] 29-01-PLAN.md — `--competencia`/`--de`/`--ate` em `gerar-instancias`,
  `months_in_range`/`monthsInRange` como generalização compatível de `candidate_months`,
  prova ao vivo dos 3 critérios de sucesso (recorte substitui o range default, recupera
  datas já passadas do mês corrente, idempotência com/sem recorte) e paridade cross-runtime
  (RANGE-01)

### Phase 30: Ciclo de vida e higiene de dados

**Goal**: Deletar um template tem consequência explícita sobre suas instâncias; resíduo
de teste não alcança mais a base usada para dados reais; órfãs já existentes podem ser
limpas.
**Depends on**: Nothing new (independente das fases anteriores; sequenciada depois delas
por prioridade, não por dependência técnica)
**Requirements**: LIFE-01, LIFE-02, LIFE-03
**Success Criteria** (what must be TRUE):

  1. `apollo rotina template deletar` de um template com instâncias vinculadas informa a
     contagem de instâncias afetadas e não deleta por padrão; uma flag explícita permite
     prosseguir.

  2. Existe um comando que lista/remove instâncias cujo `template` vinculado não resolve
     mais, sem introduzir `criar`/`deletar` livre para `instanciasRotina` no fluxo normal.

  3. As 3 instâncias órfãs e a instância residual de teste (`phase23-e2e-dedupe-...`)
     encontradas no onboarding real são removíveis por esse comando.

  4. Os testes `live` (pytest) e a suíte `web/e2e` continuam rodando contra o MESMO `app_id`
     de produção (escopo revisado nesta fase — decisão explícita do usuário registrada em
     `.planning/REQUIREMENTS.md`/`30-CONTEXT.md` decisão 4 — não um `app_id` de teste
     distinto), mas nenhuma escrita de teste aparece mais na listagem de dados de produção:
     todo `sweepLeftovers`/`tryDelete` que chama `rotina template deletar` passa a nova flag
     `--force` (LIFE-01) e passa a varrer `instanciasRotina` diretamente por prefixo de
     `dedupeKey`, eliminando o vetor que produziu o resíduo `phase23-e2e-dedupe-weekday-...`.
**Plans**: 2 plans

Plans:

- [x] 30-01-PLAN.md — `apollo rotina template deletar` bloqueia por padrão com contagem
  exata de instâncias vinculadas e passa a aceitar `--force`; novo comando
  `apollo rotina instancia limpar-orfas` (lista por padrão, `--confirmar` remove) limpa
  órfãs sem reabrir `criar`/`deletar` livre; inclui a limpeza ao vivo das órfãs/resíduo
  reais já existentes na conta de produção (LIFE-01, LIFE-02)
- [x] 30-02-PLAN.md — todo `web/e2e/*.spec.ts` que chama `rotina template deletar` passa a
  usar `--force`; os specs que semeiam `instanciasRotina` com `dedupeKey` prefixado por
  `PREFIX` passam a varrê-las diretamente (novo `sweepInstancesByDedupeKeyPrefix` no
  fixture admin de testes), fechando o mecanismo que produziu o resíduo real (LIFE-03)

### Phase 31: Cadastro em lote

**Goal**: Cadastrar um calendário inteiro de rotinas não exige uma chamada de CLI por
registro nem perde progresso parcial num erro no meio do lote.
**Depends on**: Nothing new (independente; última por ser a de maior escopo/menor
urgência relativa entre as seis)
**Requirements**: BATCH-01
**Success Criteria** (what must be TRUE):

  1. É possível descrever um lote de registros (com referências entre si, ex. um `fundo`
     e os `templates` que o citam) em um único arquivo e validá-lo por completo antes de
     qualquer escrita.

  2. Uma falha no meio de um lote não deixa o cadastro num estado que duplique registros
     ao ser retomado.

  3. Um lote equivalente ao onboarding real (18 fundos + 84 templates) completa em uma
     única invocação, não 102.
**Plans**: 2 plans

Plans:

- [x] 31-01-PLAN.md — `apollo import --from-json <arquivo> [--dry-run]`: parse, two-pass
  validation (collect-all-errors), natural-key existence check, id pre-assignment, one atomic
  heterogeneous transact + ambiguous-failure recovery, live-proven at meaningful scale
  (encadeado chain + both reference forms) (BATCH-01)
- [ ] 31-02-PLAN.md — full 18-fundo/84-template onboarding-scale proof in one invocation
  (Success Criterion 3), same-scale re-run + partial-batch-already-landed resume proofs
  (Success Criterion 2), whole-cli/-package gate sweep (BATCH-01)

<details>
<summary>✅ v1.0 Apollo v2 MVP (Phases 1-6) — SHIPPED 2026-08-09</summary>

- [x] Phase 1: Repo Scaffold & Live Schema (3/3 plans) — completed 2026-08-09
- [x] Phase 2: Shared ANBIMA Calendar (3/3 plans) — completed 2026-08-09
- [x] Phase 3: CLI Auth & CRUD (6/6 plans) — completed 2026-08-09
- [x] Phase 4: Web SPA Auth & CRUD Smoke UI (6/6 plans) — completed 2026-08-09
- [x] Phase 5: Idempotent Routine-Instance Job (6/6 plans) — completed 2026-08-09
- [x] Phase 6: End-to-End Verification (3/3 plans) — completed 2026-08-09

Full detail archived at `.planning/milestones/v1.0-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.1 UI bonita com Tailwind + shadcn-svelte (Phases 7-11) — SHIPPED 2026-08-10</summary>

- [x] Phase 7: Design System Setup (1/1 plans) — completed 2026-08-09
- [x] Phase 8: Auth & Shell Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 9: Entity Table Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 10: Entity Form Restyle & Feedback (4/4 plans) — completed 2026-08-10
- [x] Phase 11: Full Verification & Quality Gates (1/1 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.1-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.2 Lapidação de UI (SaaS-grade polish) (Phases 12-17) — SHIPPED 2026-08-10</summary>

- [x] Phase 12: Login Screen Polish (1/1 plans) — completed 2026-08-10
- [x] Phase 13: Shell Chrome — Header, Nav & Content Frame (1/1 plans) — completed 2026-08-10
- [x] Phase 14: Entity Screen — Header, Loading & Empty States (2/2 plans) — completed 2026-08-10
- [x] Phase 15: Entity Screen — Form & Dialog Composition (1/1 plans) — completed 2026-08-10
- [x] Phase 16: Entity Screen — Row Actions & Delete Confirmation (2/2 plans) — completed 2026-08-10
- [x] Phase 17: Cross-Phase Verification & Quality Gates (2/2 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.2-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.3 Navegação reorganizada + Dashboard de acompanhamento (Phases 18-23) — SHIPPED 2026-08-12</summary>

- [x] Phase 18: Navigation Foundation & EntityScreen Extension (3/3 plans) — completed 2026-08-11
- [x] Phase 19: Projetos Section (Master-Detail) (4/4 plans) — completed 2026-08-11
- [x] Phase 20: Rotinas & Tickets Sections (5/5 plans) — completed 2026-08-11
- [x] Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue (3/3 plans) — completed 2026-08-11
- [x] Phase 22: Dashboard Kanbans, Rotinas & Heatmap (2/2 plans) — completed 2026-08-12
- [x] Phase 23: Focus Dialog System (7/7 plans) — completed 2026-08-12

Full detail archived at `.planning/milestones/v1.3-ROADMAP.md`; closing audit at
`.planning/milestones/v1.3-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.4 CLI instalável via uv tool, login sem admin token (Phases 24-25) — SHIPPED 2026-08-12</summary>

- [x] Phase 24: Packaging & Installability (2/2 plans) — completed 2026-08-12
- [x] Phase 25: Public Auth Login (2/2 plans) — completed 2026-08-12

Full detail archived at `.planning/milestones/v1.4-ROADMAP.md`; closing audit at
`.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.5 Correções descobertas no onboarding real do calendário de rotinas (RBR) | 26-31 | TBD | In progress | - |
| v1.0 Apollo v2 MVP | 1-6 | 27 | Complete | 2026-08-09 |
| v1.1 UI bonita com Tailwind + shadcn-svelte | 7-11 | 8 | Complete | 2026-08-10 |
| v1.2 Lapidação de UI (SaaS-grade polish) | 12-17 | 9 | Complete | 2026-08-10 |
| v1.3 Navegação reorganizada + Dashboard de acompanhamento | 18-23 | 24 | Complete | 2026-08-12 |
| v1.4 CLI instalável via uv tool, login sem admin token | 24-25 | 4 | Complete | 2026-08-12 |
