# Phase 28: Periodicidade semanal - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`) — escopo desta fase foi especificado na sessão que criou a milestone v1.5; decisão de fazer (vs. não fazer) confirmada explicitamente pelo usuário.

<domain>
## Phase Boundary

Um evento recorrente ancorado em dia da semana (não em mês) pode ser representado no Apollo sem aproximação artificial — cobre o caso real "Atualiz Calc RF" (toda sexta-feira), hoje impossível de representar nos três `tipoGeracao` existentes (todos mensais).

Covers requirement SEM-01 (ver `.planning/REQUIREMENTS.md`).

Escopo: novo `tipoGeracao = "semanal"` em `compute_expected_instances`/`computeExpectedInstances`
(`cli/apollo_cli/routine_job.py`/`web/src/lib/routineJob.ts`), CLI (`entities/rotina.py`), e
fixtures compartilhadas. Não toca `du_fixo`/`corrido_fixo`/`encadeado` existentes.

</domain>

<decisions>
## Implementation Decisions

1. **`--dia-semana`, não offset numérico.** O novo tipo recebe um dia da semana
   nomeado (ex. `segunda|terca|quarta|quinta|sexta|sabado|domingo`, ou os
   equivalentes em inglês — decisão de nomenclatura fica com o planner/research,
   desde que documentada) em vez de reaproveitar `--offset-dias` com uma
   codificação nova — mais legível e evita sobrecarregar um campo que já tem
   três significados diferentes (`du_fixo`/`corrido_fixo`/`encadeado`).
2. **Sem consciência de feriado/dia útil.** "Semanal" gera em **todo**
   calendário-dia que cai no dia da semana escolhido, dentro do range de
   geração — não pula feriados nem fins de semana (a própria escolha do dia
   da semana já exclui os outros 6 dias). Isso espelha o precedente de
   `corrido_fixo` (calendário puro, sem `is_business_day`) — decisão minha,
   já que o evento real de origem ("toda sexta-feira") não menciona nenhuma
   exceção de feriado.
3. **Regra de competência: reaproveitar `REGRAS_COMPETENCIA_SUPORTADAS`
   (`M0`/`M-1`/`M-2`/`M+1`) aplicada sobre a `dataPrevista` gerada**, via
   `shift_competencia` já existente — não inventar uma regra de competência
   nova só para o tipo semanal. `--regra-competencia` continua obrigatório e
   validado por `click.Choice` (Fase 26) igual aos outros tipos.
4. **`offsetDias` não se aplica a `semanal`** — deve ficar `None`/omitido para
   esse tipo (igual a como `regraCompetencia` não é usada por `encadeado` para
   sua própria competência, D-05-D). Validar/documentar essa exclusividade no
   `--help`.
5. **`dedupeKey` continua `templateId:competencia:dataPrevista`** — nenhuma
   mudança na fórmula. Cada ocorrência semanal tem uma `dataPrevista` distinta,
   então a idempotência já funciona sem alteração.
6. **Range de geração inalterado nesta fase** — continua `[today, fim do
   próximo mês]` (a Fase 29 trata do recorte de range; não antecipar essa
   mudança aqui). Dentro desse range, o tipo semanal deve enumerar **todas**
   as ocorrências do dia da semana escolhido (tipicamente 8-9 no range de
   ~2 meses), não só uma por mês como os tipos fixos.
7. **Escopo estritamente aditivo** — `du_fixo`, `corrido_fixo`, `encadeado`
   continuam com o dispatch/validação exatamente como estão (a Fase 27 já
   modificou `du_fixo`; esta fase não toca nele de novo).
8. **Paridade TS/Python obrigatória** (C-06) — a nova lógica de enumeração
   semanal precisa de fixtures em `shared/routine-job.testcases.json`
   cobrindo o caso real (sexta-feira, range de agosto/setembro 2026) provadas
   idênticas nos dois runtimes.

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (Fase 27 já reconfirmou estas linhas —
podem ter se movido um pouco após a Fase 27, reconferir no research):

- `cli/apollo_cli/routine_job.py::compute_expected_instances` — dispatch por
  `tipo_geracao` dentro do loop principal (`du_fixo`/`corrido_fixo` no Pass 1
  fixed-offset; `encadeado` no Pass 2 topológico). Um `tipoGeracao`
  desconhecido cai em `skipped: tipo_geracao_desconhecido` — esse é o branch
  que hoje intercepta `"semanal"` e precisa ganhar um branch próprio.
- `_compute_fixed_instances` monta `candidate_months = [(today_year,
  today_month), (next_month_year, next_month)]` e calcula **uma** data por
  mês via `nth_day_fn`. O tipo semanal não cabe nesse helper sem modificação —
  precisa iterar dia a dia (ou usar aritmética de calendário) dentro do range
  `[range_start, range_end]`, não mês a mês.
- `shift_competencia(data_prevista, regra_competencia)` já é genérico o
  suficiente para reaproveitar sem mudança.
- `REGRAS_COMPETENCIA_SUPORTADAS`/`_TIPO_GERACAO_CHOICES` em
  `cli/apollo_cli/entities/rotina.py` — `_TIPO_GERACAO_CHOICES = ("du_fixo",
  "corrido_fixo", "encadeado")` precisa virar 4 valores.
- `shared/routine-job.testcases.json` já tem seções `dayMath`/`scenarios`
  com formato conhecido — nova seção/casos para o tipo semanal seguem o
  mesmo padrão.

Research do plan-phase deve: (1) reconfirmar os números de linha pós-Fase 27;
(2) decidir a forma exata de enumerar "todo dia da semana X entre duas datas"
(iteração dia a dia com `datetime.timedelta`/`date-fns` vs. fórmula fechada) —
ambas são triviais, mas a escolha deve ser a mesma nos dois runtimes; (3)
confirmar que o InstantDB schema (`templatesRotina`) não precisa de nenhum
campo novo — `--dia-semana` pode ser armazenado no campo `offsetDias`
reaproveitado como índice 0-6, OU um novo campo `diaSemana` pode ser
necessário no schema. **Isto é uma decisão de arquitetura real que o research
deve resolver antes do planner desenhar as tasks** — ver `<specifics>`.

</code_context>

<specifics>
## Specific Ideas

**Decisão em aberto que o research/planner deve fechar:** como armazenar o
dia da semana escolhido.

- Opção A: reaproveitar o campo `offsetDias` (já `i.number().optional()` no
  schema) para guardar um índice 0-6 quando `tipoGeracao == "semanal"` — zero
  mudança de schema, mas overload semântico do campo (já significa 3 coisas
  diferentes para os outros tipos).
- Opção B: adicionar um campo novo `diaSemana: i.string().optional()` (ou
  `i.number()`) ao schema `templatesRotina` — mais limpo semanticamente, mas
  é a primeira mudança de schema desde o v1.0 e exige `push` do InstantDB
  schema (nunca feito nesta milestone até agora).

Minha recomendação (não vinculante — o research/planner decide com mais
contexto): **Opção A** (reaproveitar `offsetDias`) é consistente com o
padrão já estabelecido nesta milestone (JOB-02 já mudou o *significado* de
`offsetDias` para `du_fixo` sem mudar o schema) e evita a primeira migração
de schema do projeto por uma feature de escopo pequeno. Documentar bem no
`--help` que, para `--tipo-geracao semanal`, `--offset-dias` na verdade
recebe um índice de dia da semana (ou reutilizar `--offset-dias` seria
confuso — considerar em vez disso mapear `--dia-semana <nome>` para um
inteiro internamente e gravá-lo em `offsetDias`, mantendo a CLI legível
mesmo que o campo de armazenamento seja reaproveitado). Se o research
encontrar um motivo forte para a Opção B, é aceitável mudar de plano — mas
documentar a decisão e o porquê.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — escopo desta fase é só SEM-01, fechado.
</deferred>
