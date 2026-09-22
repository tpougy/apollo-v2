# Phase 29: Controle de geração - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`) — escopo desta
fase foi totalmente especificado e verificado no código ao vivo nesta sessão (linhas
conferidas diretamente, não herdadas de relato); nenhuma pergunta em aberto.

<domain>
## Phase Boundary

Hoje `gerar-instancias` sempre calcula o range `[hoje (ou --data-base), fim do
próximo mês]` (`compute_expected_instances`, `routine_job.py:440-441`) e não existe
nenhuma forma de restringir esse range a uma janela menor. Isso cria dois problemas
reais em operação de volume: (1) impossível gerar só uma competência específica sem
"arrastar" o mês seguinte junto; (2) rodando no meio do mês corrente, instâncias já
passadas desse mesmo mês nunca são recuperáveis sem calcular manualmente uma
`--data-base` retroativa (porque `range_start = today`, nunca o início do mês).

Covers requirement RANGE-01 (ver `.planning/REQUIREMENTS.md`).

Esta fase toca só `cli/apollo_cli/routine_job.py`/`web/src/lib/routineJob.ts` (núcleo
puro, acima do `--- I/O boundary ---`) e `cli/apollo_cli/entities/rotina.py` (CLI
flags de `gerar-instancias`). Depende da Fase 28 só por sequenciamento de arquivo
(o recorte precisa cobrir `semanal` também, já que `weekly_occurrences` também lê
`range_start`/`range_end`) — sem dependência funcional real.

</domain>

<decisions>
## Implementation Decisions

1. **O recorte SUBSTITUI o range default, nunca o estreita por cima.** Quando
   `--competencia`/`--de`+`--ate` é passado, o range de geração passa a ser
   exatamente `[recorte_start, recorte_end]` — não uma interseção com
   `[today, end_of_next_month(today)]`. Isso é o que faz o Success Criterion 1
   (gerar só uma competência "sem arrastar o mês seguinte") e o 2 (recuperar
   instâncias já passadas do mês corrente rodando no meio do mês) funcionarem: um
   recorte que apenas *filtrasse* o range default nunca alcançaria datas antes de
   `today` nem excluiria o mês seguinte (que está sempre dentro do default).

2. **`_compute_fixed_instances`'s `candidate_months` deixa de ser derivado de
   `today` e passa a ser derivado de `[range_start, range_end]`.** Hoje
   (`routine_job.py:262-267`) `candidate_months` é sempre exatamente
   `[(today_year, today_month), (next_month_year, next_month)]` — o parâmetro
   `today` da função só serve para isso, não é usado em mais nada dentro dela
   (confirmado por leitura completa do corpo da função nesta sessão). Introduzir
   uma função nova, `months_in_range(range_start: str, range_end: str) ->
   list[tuple[int, int]]` (twin `monthsInRange`), que retorna todo par
   `(year, month)` cujo mês de calendário tem interseção não-vazia com
   `[range_start, range_end]`, em ordem cronológica — e trocar
   `_compute_fixed_instances` para chamar essa função em vez do cálculo inline
   baseado em `today`. **Isto é uma generalização estritamente compatível, não uma
   mudança de comportamento**: por construção,
   `months_in_range(today, end_of_next_month(today))` sempre retorna exatamente
   `[(today_year, today_month), (next_month_year, next_month)]` — o mês de `today`
   sempre intersecta `[today, end_of_next_month(today)]` trivialmente, e o mês
   seguinte também intersecta (já que `end_of_next_month` é por definição o último
   dia desse mês seguinte). O `today` param pode ser removido de
   `_compute_fixed_instances`'s assinatura (não é mais necessário para nada) —
   confirmar durante o planning se algum outro chamador ainda precisa dele.

3. **`weekly_occurrences`/`_compute_semanal_instances` (Phase 28) e o sweep
   `encadeado` já leem `range_start`/`range_end` diretamente (não derivam de
   `today`)** — confirmado por leitura de código nesta sessão
   (`routine_job.py:315-333` para semanal, `routine_job.py:590-600` para o filtro do
   sweep `encadeado`). Essas partes já funcionam corretamente com qualquer
   `range_start`/`range_end` passado — não precisam de nenhuma generalização
   análoga à de `months_in_range`, só precisam continuar recebendo o range
   recortado (que já recebem, por serem parâmetros passados adiante desde
   `compute_expected_instances`).

4. **Superfície CLI: `--competencia AAAA-MM` OU `--de`/`--ate` (mutuamente
   exclusivos entre si; `--de`/`--ate` são um par — um sem o outro é erro).**
   `--competencia AAAA-MM` é açúcar sintático que resolve para
   `de = primeiro dia do mês`, `ate = último dia do mês` — opera no mesmo eixo que
   `--de`/`--ate` (o range de geração, isto é, o `dataPrevista` calculado, não a
   `competencia` resultante do template — que pode divergir por causa de
   `regraCompetencia` M-1/M-2/M+1). Documentar essa nuance explicitamente no
   `--help` de `--competencia`, para não confundir o operador que espera "só
   instâncias com esse valor de competencia" quando na verdade o filtro é sobre o
   range de datas candidatas. Combinar `--competencia` com `--de`/`--ate` na mesma
   chamada é erro de validação, exit 2, nenhuma consulta/escrita executada.
   Fornecer `--de` sem `--ate` (ou vice-versa) também é erro de validação, exit 2.
   Todos os três flags continuam opcionais — omitir todos preserva o comportamento
   exato de hoje (`[today ou --data-base, end_of_next_month]`).

5. **`--de`/`--ate` aceitam `YYYY-MM-DD` (mesmo `validate_iso_date` callback já
   usado por `--data-base`, reutilizar, não duplicar); `de <= ate` é validado na
   CLI (exit 2 se invertido).** `--competencia` aceita `YYYY-MM` — validar formato
   com um novo callback simples (regex `^\d{4}-\d{2}$` + mês em `1..12`), sem
   depender de `date.fromisoformat` (que exige dia).

6. **Idempotência (Success Criterion 3) é uma CONSEQUÊNCIA automática do desenho,
   não uma checagem extra a implementar.** Como o recorte só afeta QUAIS meses
   entram em `candidate_months`/quais datas passam no filtro `range_start <=
   data_prevista <= range_end`, e nunca como `data_prevista`/`dedupeKey` são
   calculados (mesmas funções puras, mesmos argumentos por candidata), rodar com
   recorte cobrindo `[A, B]` e rodar sem recorte (ou com um recorte mais largo)
   filtrando depois para `[A, B]` produzem exatamente o mesmo conjunto de
   `dedupeKey`s — nenhuma lógica de deduplicação nova é necessária além da já
   existente (upsert lookup-keyed por `dedupeKey`, Fase 5). O plano deve PROVAR
   isso com um teste ao vivo real (não só unitário): gerar com `--competencia
   2026-08`, depois gerar de novo sem recorte cobrindo agosto+setembro, e
   confirmar que o conjunto de instâncias de agosto é idêntico nas duas chamadas
   (mesmos dedupeKeys, nenhuma duplicata, nenhum dado diferente).

7. **Escopo é `cli/apollo_cli/routine_job.py`, `web/src/lib/routineJob.ts`,
   `cli/apollo_cli/entities/rotina.py` (só os novos flags de `gerar-instancias` e
   seu `--help`), `shared/routine-job.testcases.json`.** Nenhuma mudança em schema,
   perms, SPA (este comando é CLI-only, não tem superfície SPA — `gerar-instancias`
   não existe como ação na interface web). Nenhuma mudança em
   `du_fixo`/`corrido_fixo`/`encadeado`/`semanal`'s regras de negócio — só em COMO
   o range que alimenta essas regras é determinado.

8. **Paridade TS/Python continua obrigatória (C-06).** `computeExpectedInstances`
   ganha os mesmos parâmetros de recorte opcional que `compute_expected_instances`,
   e `computeFixedInstances`'s candidate-month derivation é generalizada da mesma
   forma via `monthsInRange`, mesmo que a SPA web não exponha essa funcionalidade
   como UI (não expõe — este comando não tem equivalente SPA). O propósito da
   paridade aqui é: (a) o fixture compartilhado `shared/routine-job.testcases.json`
   continua provando que os dois runtimes concordam byte-a-byte, e (b) evitar que
   os dois runtimes divirjam silenciosamente caso uma superfície SPA para isso
   seja adicionada numa milestone futura. Não é necessário adicionar nenhum flag
   de CLI equivalente do lado do `web/` (não existe CLI no `web/`).

9. **Relatório JSON de `gerar-instancias` não precisa de nenhum campo novo.**
   Diferente do JOB-03 (Fase 27), que adicionou `nome` a `skipped` para
   diagnosticar por-template, aqui o recorte não gera uma categoria nova de
   "skip" — ele simplesmente estreita o universo de candidatas computadas desde o
   início (ver decisão 1). Um `dedupeKey` fora do recorte nunca chega a ser
   computado, então não há nada a reportar sobre ele nesta chamada.

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (linhas conferidas diretamente):

- `cli/apollo_cli/routine_job.py:435-441` — `compute_expected_instances(templates,
  today, existing)`; `range_start = today`, `range_end =
  end_of_next_month(today)` — os dois pontos exatos a generalizar para aceitar um
  recorte explícito opcional.
- `cli/apollo_cli/routine_job.py:185-194` — `end_of_next_month(today)`: último dia
  do mês seguinte ao de `today`. Usado para provar a decisão 2 (compatibilidade
  retroativa de `months_in_range`).
- `cli/apollo_cli/routine_job.py:243-289` — `_compute_fixed_instances(template,
  today, range_start, range_end, min_offset_dias, nth_day_fn)`. `today` só é usado
  nas linhas 260-266 para derivar `candidate_months` — confirmado por leitura
  completa do corpo da função, nenhum outro uso de `today` dentro dela. Chamada em
  dois pontos (`du_fixo`, `corrido_fixo` — linha ~509 e vizinha).
- `cli/apollo_cli/routine_job.py:315-333` — `weekly_occurrences` (Fase 28) já
  opera só sobre `range_start`/`range_end`, sem depender de `today` — nenhuma
  mudança necessária aqui além de continuar recebendo o range recortado.
- `cli/apollo_cli/routine_job.py:590-600` — filtro `data_prevista < range_start or
  data_prevista > range_end` dentro do sweep `encadeado` — já opera sobre o range
  passado adiante, sem depender de `today` diretamente.
- `cli/apollo_cli/entities/rotina.py:398-438` — comando `gerar-instancias`; hoje só
  tem `--data-base`/`--dry-run`. `--data-base` usa `validate_iso_date` como
  callback (reutilizar para `--de`/`--ate`).
- `cli/apollo_cli/routine_job.py:800-840` — `run_routine_instance_job` docstring
  completa: query de `existing` é agrupada só por `templateId` (não por data),
  então não precisa de nenhuma mudança para o recorte funcionar corretamente no
  diff/idempotência (decisão 6).

Research/pattern-map deve reconfirmar os números de linha exatos (podem ter se
movido desde esta leitura) e localizar o twin exato em `web/src/lib/routineJob.ts`
(mesma estrutura, já confirmada como twin byte-a-byte nas Fases 27/28).

</code_context>

<specifics>
## Specific Ideas

- Nome de função sugerido: `months_in_range` (Python) / `monthsInRange` (TS) —
  manter o padrão de nomes já estabelecido (`weekly_occurrences`/
  `weeklyOccurrences`, `end_of_next_month`/`endOfNextMonth`).
- Nome de parâmetro sugerido para o recorte explícito em
  `compute_expected_instances`: `range_override: tuple[str, str] | None = None`
  (Python) / `rangeOverride?: [string, string]` (TS) — quando presente, substitui
  inteiramente `[today, end_of_next_month(today)]`. Planner pode escolher outro
  nome/forma desde que documentado e espelhado nos dois runtimes.

</specifics>

<deferred>
## Deferred Ideas

- Recorte por `templateId`/`nome` (gerar só para um template específico) — fora de
  escopo, RANGE-01 é especificamente sobre a dimensão de tempo, não de quais
  templates entram no job.
- Expor o recorte como UI na SPA — não existe superfície SPA para
  `gerar-instancias` hoje (é CLI-only), fora de escopo criar uma.
</deferred>
