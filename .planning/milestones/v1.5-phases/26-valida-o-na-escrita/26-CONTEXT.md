# Phase 26: Validação na escrita - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`) — escopo desta fase foi totalmente especificado e verificado no código durante a sessão que criou a milestone v1.5; nenhuma pergunta em aberto.

<domain>
## Phase Boundary

Um template com `regraCompetencia` inválida é recusado na hora da escrita (`apollo rotina template criar`/`editar`), com mensagem listando os valores aceitos — nunca mais aceito e só revelado, em silêncio, muito depois, dentro de `gerar-instancias`. `propagarAtrasoSoft` deixa de parecer uma funcionalidade ativa (é armazenado mas não lido). Um docstring incorreto sobre `dedupeKey` é corrigido.

Covers requirements VAL-01, VAL-02, VAL-03 (ver `.planning/REQUIREMENTS.md`).

Esta fase **não toca** `routine_job.py`/`routineJob.ts` (o motor de geração) — é puramente validação/documentação no ponto de entrada da CLI. A normalização de `status` (JOB-01) e o offset negativo de `du_fixo` (JOB-02) são Fase 27, deliberadamente sequenciada depois para não colidir edições na mesma janela de arquivos.

</domain>

<decisions>
## Implementation Decisions

Já decididas em `.planning/REQUIREMENTS.md` (seção Context) antes desta fase — não são perguntas em aberto:

1. **VAL-01 — fechar o enum na CLI, não no schema.** `apollo_cli/routine_job.py:86` já define
   `REGRAS_COMPETENCIA_SUPORTADAS = ("M0", "M-1", "M-2", "M+1")`, usado por `shift_competencia`
   (linhas ~151-155, que rejeita sem trim — "Deliberately NOT trimmed"). A CLI
   (`cli/apollo_cli/entities/rotina.py:126-133`) hoje expõe `--regra-competencia` como
   `TEXT` livre, com help text "Free-form... Not enforced/parsed by the CLI" — enquanto
   `--tipo-geracao`, na mesma função, já usa `click.Choice`. Corrigir: `--regra-competencia`
   em `criar` (linha ~126) e `editar` (linha ~211) passam a usar `click.Choice`, importando
   a mesma tupla `REGRAS_COMPETENCIA_SUPORTADAS` de `apollo_cli.routine_job` (não duplicar a
   lista). `click.Choice` já produz uma mensagem de erro com os valores aceitos — não é
   preciso escrever essa mensagem à mão. Atualizar o help text das duas opções e remover a
   frase "Free-form... Not enforced/parsed" (ela deixa de ser verdade).
2. **VAL-01 — documentação a corrigir nos dois lugares que hoje repetem a afirmação errada:**
   `cli/README.md` (se citar o campo) e `docs/ai-usage/CLAUDE.md` (seção "Comandos de escrita
   usados no onboarding" → `apollo rotina template criar`, que hoje diz "obrigatório, livre —
   não parseado pela CLI").
3. **VAL-02 — reservar, não implementar.** `--propagar-atraso-soft/--nao-propagar-atraso-soft`
   (linhas ~134-138 em `criar`, ~212-216 em `editar`) continua existindo, sendo persistido e
   aparecendo em `listar` — só o help text muda, para deixar explícito que o valor é
   armazenado mas **não lido** por `gerar-instancias` (cita `routine_job.py`'s próprio
   docstring, linhas ~46-47: "stored on the template but never read anywhere in this module
   (C-09) — delay propagation is explicitly out of scope"). Implementar a propagação de
   verdade reabriria C-09 (travado) — fora de escopo desta milestone.
4. **VAL-03 — corrigir o docstring de `apollo rotina instancia status`** (`entities/rotina.py`,
   ~linha 324), que hoje chama `dedupeKey` de "hash" — contradiz o docstring canônico de
   `routine_job.py` (linhas 17-23), que é explícito: concatenação simples, deliberadamente NÃO
   um hash (RESEARCH Assumption A5). Ajustar a frase para refletir a linguagem correta.
5. **Escopo é `cli/apollo_cli/entities/rotina.py` + textos de ajuda + os dois arquivos de doc
   citados acima.** Nenhuma mudança em `routine_job.py`/`routineJob.ts`, `bizdays.py`/`.ts`,
   schema ou perms. Nenhuma mudança de comportamento observável para um `regraCompetencia`/
   `propagarAtrasoSoft` já válidos — só a rejeição de valores inválidos passa a acontecer mais
   cedo.
6. **Teste de regressão:** um teste que tenta `apollo rotina template criar --regra-competencia
   <valor-fora-do-enum>` e assevera exit não-zero + nenhum registro criado (hoje o
   comportamento é aceitar e retornar um id) é o critério objetivo de que VAL-01 está
   corrigido — a falha silenciosa vira falha na hora.

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (linhas conferidas na versão instalada, podem ter se movido — reconferir no research):

- `cli/apollo_cli/routine_job.py:84-88` — `TIPO_PRAZO_GERADO`, `STATUS_INICIAL`,
  `REGRAS_COMPETENCIA_SUPORTADAS = ("M0", "M-1", "M-2", "M+1")`.
- `cli/apollo_cli/routine_job.py:151-155` — `shift_competencia`, comentário explícito sobre não
  fazer trim.
- `cli/apollo_cli/routine_job.py:46-47` — docstring do módulo sobre `propagarAtrasoSoft` nunca
  ser lido.
- `cli/apollo_cli/entities/rotina.py:114-199` — `template.criar` (onde `--regra-competencia` e
  `--propagar-atraso-soft` são declarados e gravados, `--tipo-geracao` já usa
  `click.Choice(_TIPO_GERACAO_CHOICES)` como modelo a seguir).
- `cli/apollo_cli/entities/rotina.py:202-279` — `template.editar` (espelha os mesmos campos,
  todos com `default=None` para "deixar inalterado se omitido").
- `cli/apollo_cli/entities/rotina.py:316-330` — `instancia.status`, docstring com a menção
  incorreta a "hash" do `dedupeKey`.
- `docs/ai-usage/CLAUDE.md` (`apollo-v2/docs/ai-usage/`) — seção "`apollo rotina template
  criar`" repete "obrigatório, livre — não parseado pela CLI" para `--regra-competencia`.

Research do plan-phase deve reconfirmar os números de linha exatos antes do planner assumi-los
como corretos.

</code_context>

<specifics>
## Specific Ideas

- `click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)` deve importar a tupla existente de
  `apollo_cli.routine_job`, não redeclarar os 4 valores em `entities/rotina.py` — evita as duas
  listas divergirem no futuro.
- Nenhuma mudança de schema — `regraCompetencia`/`propagarAtrasoSoft` continuam `i.string()`/
  `i.boolean()` em `shared/instant.schema.ts`, a validação é só na CLI.

</specifics>

<deferred>
## Deferred Ideas

- Validar `regraCompetencia` também no lado do job (`routine_job.py`) para blindar contra
  escrita direta via admin API fora da CLI — não pedido pelo achado original (P0-1 é
  especificamente sobre o ponto de entrada da CLI) e sairia do escopo desta fase; se vier a
  importar, é uma fase própria.
- Implementar de fato a propagação de atraso soft (reabriria C-09) — explicitamente fora de
  escopo, ver Implementation Decisions #3.

</deferred>
