# Phase 27: Robustez do job - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`) — escopo desta fase foi totalmente especificado e verificado no código durante a sessão que criou a milestone v1.5; nenhuma pergunta em aberto.

<domain>
## Phase Boundary

O job de geração para de depender de comparações frágeis (grafia exata de
`"concluida"`) e para de recusar entradas reais do calendário (offset negativo
em `du_fixo`); diagnosticar um `skipped` em lote deixa de exigir cruzar ids
manualmente.

Covers requirements JOB-01, JOB-02, JOB-03 (ver `.planning/REQUIREMENTS.md`).

Esta fase toca o núcleo puro de `routine_job.py`/`routineJob.ts` (acima do
comentário `--- I/O boundary ---`) e a camada de cálculo de datas
`bizdays.py`/`bizdays.ts`. Depende da Fase 26 só por sequenciamento de
arquivo (`entities/rotina.py` também muda aqui, para JOB-02's novo texto de
`--help`), não por dependência funcional.

</domain>

<decisions>
## Implementation Decisions

Já decididas em `.planning/REQUIREMENTS.md` (seção Context) antes desta fase:

1. **JOB-01 — normalizar, não fechar o vocabulário.** `routine_job.py:398`
   (`web` twin: `routineJob.ts:476`) compara
   `record.status != "concluida"` com string literal exata. Trocar por uma
   função central `_is_concluida(status: str) -> bool` (twin
   `isConcluida`) que normaliza antes de comparar: `unicodedata.normalize`
   NFKD + strip de combining marks para remover acento, `.strip().casefold()`
   para espaço/caixa. `"Concluída"`, `"CONCLUIDA"`, `"concluído "` devem
   todas resultar `True`. `status` continua sendo gravado como texto livre
   em `apollo rotina instancia status --status <qualquer coisa>` — não
   introduzir `click.Choice` aqui (isso fecharia o vocabulário, decisão
   explicitamente rejeitada). Só o **uso interno** pelo job muda.
   `apollo rotina instancia status --help` ganha uma frase documentando que
   grafias equivalentes de "concluída" (case/acento-insensível) são
   reconhecidas pela geração de sucessores `encadeado`.
2. **JOB-02 — estender `du_fixo`, não criar tipo novo.**
   `_validate_offset_dias` (`routine_job.py:177-182`) recebe `min_value` por
   parâmetro; hoje `du_fixo`/`corrido_fixo` são chamados com `min_value=1`
   (linhas ~319, ~323). Mudar só `du_fixo` para aceitar `offsetDias <= 0`
   (min_value passa a ser, por exemplo, um valor bem negativo ou remover o
   piso — a validação de limite inferior real vem do próprio calendário
   vendorizado via `CalendarRangeError`, não precisa de um piso arbitrário
   além de "é um int"). Semântica: `0` = último dia útil do mês; negativo =
   N dias úteis antes do último. Implementar via uma nova função em
   `bizdays.py`/`bizdays.ts`, ex. `nth_business_day_from_month_end(year,
   month, n)`, construída sobre `add_business_days` (que já aceita `n`
   negativo, confirmado em `bizdays.py:103-123`) — não duplicar a lógica de
   navegação de calendário. `corrido_fixo` **não muda** (continua exigindo
   `offsetDias >= 1`) — o achado original (Prévia DU-2) é especificamente
   sobre dias úteis, não dias corridos. `--help` de `template criar`/`editar`
   documenta a nova semântica de `--offset-dias` quando `--tipo-geracao
   du_fixo`.
3. **JOB-03 — nome do template no `skipped`.** Todo `skipped.append({...})`
   dentro de `compute_expected_instances` (6 pontos: `antecessor_ausente`,
   `offset_dias_invalido`/`offset_dias_ausente` no fixed-offset loop,
   `tipo_geracao_desconhecido`, `regra_competencia_nao_suportada`,
   `antecessor_sem_instancia`, `antecessor_ciclico`) ganha uma chave `"nome"`
   com `template["nome"]`. Isso exige que `_normalize_template` (linha
   ~515-523) passe a incluir `nome` no dicionário normalizado — hoje só tem
   `id`, `tipoGeracao`, `regraCompetencia`, `offsetDias`, `ativo`,
   `antecessor`. A query em `_query_active_templates` (linha ~497-506) já
   busca todos os campos do template? Verificar no research/plan — se a
   InstantDB query não seleciona `nome` explicitamente, pode retorná-lo por
   padrão (InstaQL retorna todos os atributos por padrão a menos que
   restringido), mas confirmar antes de assumir. Contrato JSON de
   `gerar-instancias` é aditivo (novo campo em objetos já existentes) —
   não requer migração, mas os testes que fazem assert exato no shape do
   `skipped` (`== {"templateId": ..., "reason": ...}`) precisam ser
   atualizados para incluir `"nome"`.
4. **Escopo é `cli/apollo_cli/routine_job.py`, `web/src/lib/routineJob.ts`,
   `cli/apollo_cli/bizdays.py`, `web/src/lib/bizdays.ts`,
   `shared/routine-job.testcases.json`,
   `shared/bizdays.testcases.json`(se a nova função de data precisar de
   fixture própria), e `cli/apollo_cli/entities/rotina.py` (só o texto de
   `--help` do offset e do status).** Nenhuma mudança em schema, perms, ou
   nos demais `tipoGeracao` (`corrido_fixo`, `encadeado` continuam com
   `min_value` inalterado).
5. **Paridade TS/Python é obrigatória e não negociável (C-06/constraint do
   projeto)** — qualquer mudança em `routine_job.py` tem um espelho
   byte-idêntico em comportamento (não necessariamente em sintaxe) em
   `routineJob.ts`, provado pelo fixture compartilhado
   `shared/routine-job.testcases.json`. O mesmo vale para `bizdays.py`/`.ts`
   e `shared/bizdays.testcases.json`.
6. **O `dedupeKey` não muda de forma para nenhum template já existente.**
   JOB-02 introduz uma nova forma de *calcular* `dataPrevista` só quando
   `offsetDias <= 0` — templates existentes com `offsetDias >= 1` continuam
   exatamente com o mesmo cálculo e o mesmo `dedupeKey` de sempre. JOB-01
   (normalização de status) não toca `dedupeKey` nem `dataPrevista` — só a
   decisão de `dataPrevistaEstimada` ser incluída ou não no upsert de
   sucessores `encadeado`.

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (linhas conferidas, podem ter se movido —
reconferir no research/plan):

- `cli/apollo_cli/routine_job.py:84-88` — constantes do módulo.
- `cli/apollo_cli/routine_job.py:177-182` — `_validate_offset_dias(offset_dias,
  min_value)`.
- `cli/apollo_cli/routine_job.py:185-232` — `_compute_fixed_instances`, chamada
  para `du_fixo` (linha ~319, `min_offset_dias=1`, `nth_business_day_of_month`)
  e `corrido_fixo` (linha ~323, `min_offset_dias=1`,
  `nth_calendar_day_of_month`).
- `cli/apollo_cli/routine_job.py:395-398` — comparação `status != "concluida"`
  dentro do sweep de `encadeado` (D-05-E).
- `cli/apollo_cli/routine_job.py:497-523` — `_query_active_templates`/
  `_normalize_template` (ponto de entrada para incluir `nome`).
- `cli/apollo_cli/bizdays.py:103-123` — `add_business_days`, já aceita `n`
  negativo (`step = 1 if n > 0 else -1`), sem asserção de sinal.
- `cli/apollo_cli/bizdays.py:139-142` — `nth_business_day_of_month` (conta a
  partir do dia 1, para frente) — a nova função conta a partir do último dia
  do mês, para trás.
- `web/src/lib/routineJob.ts:70` (`REGRAS_COMPETENCIA_SUPORTADAS`), `:165`
  (comparação), `:476` (`status !== "concluida"`) — twin exato do Python,
  confirmado ao vivo nesta sessão.
- `shared/routine-job.testcases.json` — já tem seções `dayMath`/`scenarios`
  com casos de `nthBusinessDayOfMonth`/`nthCalendarDayOfMonth` — a nova função
  de "a partir do fim do mês" precisa de uma seção irmã com o mesmo formato.

Research do plan-phase deve reconfirmar os números de linha exatos e
verificar se a query InstantDB de templates já retorna `nome` sem seleção
explícita (checar `_query_active_templates`'s where/select shape e o
resultado real de uma chamada live).

</code_context>

<specifics>
## Specific Ideas

- Nome de função sugerido para a normalização de status: `_is_concluida`
  (Python) / `isConcluida` (TS) — mas o planner pode escolher outro nome
  desde que documentado e espelhado nos dois runtimes.
- Nome de função sugerido para o cálculo "a partir do fim do mês":
  `nth_business_day_from_month_end` (Python) — manter simetria de nome com
  `nth_business_day_of_month` já existente.

</specifics>

<deferred>
## Deferred Ideas

- Estender a normalização de "concluída" para outros lugares do sistema
  (ex. `tarefas.status`/`tickets.status`) — fora de escopo, essa milestone
  trata só do motor de rotinas; outras entidades não têm esse acoplamento
  hoje.
- Validar `regraCompetencia`/`offsetDias` também no lado do job como defesa
  em profundidade contra escrita direta via admin API — mesma decisão da
  Fase 26 (fora de escopo, não pedido pelo achado original).
</deferred>
