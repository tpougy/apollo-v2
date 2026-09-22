# Phase 30: Ciclo de vida e higiene de dados - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`), com UMA decisão
de escopo revisada com o usuário nesta fase (LIFE-03, ver decisão 6 abaixo) — fora
disso, escopo já especificado em `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md`.

<domain>
## Phase Boundary

Hoje `apollo rotina template deletar` (`cli/apollo_cli/entities/rotina.py:407-412`)
chama `delete_entity` direto, sem checar `instanciasRotina` vinculadas — deletar um
template usado deixa suas instâncias como resíduo permanentemente órfão (o link
`instancia.template` deixa de resolver). Não existe hoje nenhum comando para localizar/
remover essas órfãs. E o onboarding real já encontrou 3 instâncias órfãs mais uma
residual de teste (`phase23-e2e-dedupe-weekday-...`) na base de produção.

Covers requirements LIFE-01, LIFE-02, LIFE-03 (ver `.planning/REQUIREMENTS.md` — LIFE-03
tem uma nota de revisão de escopo lá, decisão 6 abaixo).

Esta fase toca `cli/apollo_cli/entities/rotina.py` (comando `deletar` + comando novo de
limpeza de órfãs), `web/e2e/*.spec.ts` (todo arquivo que chama `rotina template deletar`
em seu `sweepLeftovers`/`tryDelete`/`afterAll`). Sem dependência técnica das Fases 26-29
(sequenciada depois delas só por prioridade, per ROADMAP).

</domain>

<decisions>
## Implementation Decisions

1. **LIFE-01 — bloquear por padrão, com contagem, flag explícita para prosseguir.**
   `deletar` (`rotina.py:407-412`) ganha uma checagem antes de `delete_entity`: contar
   `instanciasRotina` vinculadas ao template (via query InstaQL expandindo o link reverso
   `instancias`, mesmo padrão já usado por `_query_active_templates`'s expansão de
   `antecessor` em `routine_job.py:778-787`). Se count > 0 e a nova flag `--force`
   (nome sugerido, planner pode escolher outro) NÃO foi passada: falhar com exit 2,
   mensagem informando a contagem exata, NENHUMA escrita realizada. Se `--force` foi
   passada: prosseguir com o delete do template exatamente como hoje — **NÃO** deletar
   as instâncias em cascata (fora de escopo; vira uma órfã nova, que passa a ser
   limpável pelo comando de LIFE-02 — é uma decisão consciente, não um bug: cascata
   automática apagaria histórico de instâncias reais sem confirmação explícita por
   instância, o que este projeto já evita deliberadamente em outros lugares, C-06).
   `--force` sem instâncias vinculadas é um no-op silencioso (não é erro passar a flag
   à toa).

2. **LIFE-02 — novo comando dedicado, escopo estritamente de limpeza.** Nome sugerido
   `apollo rotina instancia limpar-orfas` (subcomando do grupo `instancia`, mirando o
   padrão existente `rotina instancia status`/`rotina instancia listar`). Query todas as
   `instanciasRotina` do `donoId` autenticado expandindo o link `template` (mesmo padrão
   InstaQL de decisão 1); uma linha é órfã quando essa expansão retorna vazia/ausente
   (o template vinculado foi deletado). Por padrão, LISTA as órfãs encontradas
   (`--dry-run`-like, sem escrever nada) — remover de fato exige uma flag explícita
   (`--confirmar` ou `--force`, planner decide o nome, mas deve ser consistente com o
   nome escolhido em LIFE-01 se fizer sentido reusar o mesmo). Isto NÃO é uma via
   alternativa de `criar`/`deletar` manual de instância no fluxo normal (C-06 continua
   valendo) — este comando só pode DELETAR uma instância cujo link `template` já não
   resolve; nunca cria, nunca edita, nunca deleta uma instância com template válido.
   Confirmar experimentalmente (research/plan) COMO o link `instancia.template` se
   comporta após o template-alvo ser deletado — hipótese forte, a confirmar: a expansão
   InstaQL do link simplesmente retorna vazia (mesmo padrão observado para `antecessor`
   quando não setado), não um erro nem uma referência pendurada — mas isso deve ser
   PROVADO ao vivo (criar template+instância reais, deletar o template via `--force` de
   LIFE-01, depois consultar a instância e confirmar o shape exato da resposta) antes de
   confiar nisso como a definição operacional de "órfã".

3. **As 3 órfãs + a residual `phase23-e2e-dedupe-weekday-...` já existentes na base real
   devem ser removíveis pelo comando de LIFE-02** (ROADMAP Success Criterion 3) — não é
   preciso um script separado; rodar o comando novo contra a conta real, com a flag de
   confirmação, deve limpá-las. Fazer isso como parte da verificação ao vivo da fase
   (não como um passo manual à parte) — o plano deve incluir rodar
   `limpar-orfas --confirmar` (ou nome equivalente) contra a conta real e confirmar que
   essas 4 linhas especificamente desaparecem, sem afetar nenhuma outra instância.

4. **LIFE-03 (revisado) — NÃO criar um segundo app InstantDB.** Decisão explícita do
   usuário nesta sessão, registrada em `.planning/REQUIREMENTS.md`: usar o MESMO app de
   produção para os testes `live`/e2e, e em vez disso montar um fluxo de limpeza
   confiável pós-teste. O objetivo original de LIFE-03 ("nenhuma escrita de teste
   aparece na listagem de dados de produção") permanece — só o MECANISMO muda.

5. **Causa raiz do resíduo `phase23-e2e-dedupe-weekday-...` identificada nesta sessão:**
   `web/e2e/focus-dialog-dia-rotina.spec.ts`'s `sweepLeftovers()` (e o padrão idêntico
   duplicado em outros specs — `entities-fundos.spec.ts`, `entities-form-restyle.spec.ts`,
   etc.) varre `tarefa`/`ticket`/`rotina template`/`fundo` por prefixo de nome e chama
   `deletar` em cada um — mas `instanciasRotina` NÃO tem campo `nome` (são chaveadas por
   `dedupeKey`), então NUNCA aparecem nessa varredura. Quando o template é deletado pela
   varredura (hoje, sem bloqueio — LIFE-01 muda isso), a instância vira órfã
   permanentemente, porque nada nunca a alcança diretamente. **Isto é exatamente como o
   resíduo real foi criado.** Duas consequências obrigatórias para o plano:
   - a. Assim que LIFE-01 blinda `template deletar`, TODO `sweepLeftovers`/`tryDelete`
     em `web/e2e/*.spec.ts` que chama `rotina template deletar` (ou
     `apolloCli(["rotina", "template", "deletar", ...])`) precisa passar a nova flag de
     LIFE-01 (ex. `--force`) — senão essas varreduras passam a FALHAR (exit 2) assim que
     qualquer template varrido tiver uma instância vinculada, quebrando a suíte e2e
     inteira. Localizar TODOS os call sites (grep `rotina.*template.*deletar` em
     `web/e2e/`) e atualizar cada um.
   - b. Estender (ou centralizar — ver decisão 6) as funções de sweep para também
     varrer `instanciasRotina` diretamente, por prefixo de `dedupeKey` (já que specs
     como `focus-dialog-dia-rotina.spec.ts` já usam `uniqueName(PREFIX)` para construir
     `dedupeKey`s de teste, decisão 5 acima confirma o padrão) — chamando o comando de
     LIFE-02 (`limpar-orfas`) NÃO serve aqui, porque durante a varredura a instância
     ainda pode ter um template vinculado válido (a ordem de deleção varia por spec).
     A varredura de instâncias precisa ser direta: listar `instanciasRotina` do dono,
     filtrar por prefixo de `dedupeKey`, deletar via `rotina instancia deletar` — **se
     esse comando (`instancia deletar` avulso, fora do escopo de `limpar-orfas`) ainda
     não existir na CLI, o plano precisa confirmar se já existe (grep
     `cli/apollo_cli/entities/rotina.py` por um comando `deletar` sob o grupo
     `instancia`) ou se precisa ser adicionado — isto é puramente para limpeza de teste,
     não é a via `criar`/`deletar` manual vedada por C-06 no fluxo de produção (o
     fluxo de produção nunca chama isso).**

6. **Escopo desta fase inclui `web/e2e/*.spec.ts` (múltiplos arquivos), diferente das
   Fases 26-29 que eram só `cli/`+`web/src/lib/`.** Isto é necessário porque a causa raiz
   do resíduo real está nos próprios testes e2e, não no motor de geração. Considerar,
   durante o planning, se vale a pena centralizar a lógica de sweep hoje duplicada em
   vários arquivos `web/e2e/*.spec.ts` num helper compartilhado (ex.
   `web/e2e/helpers/sweep.ts`) em vez de tocar cada arquivo individualmente — decisão de
   engenharia deixada para o planner, mas se fizer essa escolha, documentar
   explicitamente por quê (redução de duplicação vs. risco de tocar muitos arquivos
   nesta fase).

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (linhas conferidas diretamente):

- `cli/apollo_cli/entities/rotina.py:407-412` — comando `deletar` atual, sem nenhuma
  checagem de instâncias vinculadas.
- `cli/apollo_cli/entities/rotina.py:63-64` — `_ETYPE_TEMPLATE = "templatesRotina"`,
  `_ETYPE_INSTANCIA = "instanciasRotina"`.
- `shared/instant.schema.ts:153-154` — link `template`/`instancias`:
  `forward: {on: "instanciasRotina", has: "one", label: "template"}`,
  `reverse: {on: "templatesRotina", has: "many", label: "instancias"}`.
- `cli/apollo_cli/routine_job.py:778-787` — `_query_active_templates`, padrão de query
  InstaQL expandindo um link (`antecessor`) a reaproveitar para expandir `instancias`
  (LIFE-01) e `template` (LIFE-02).
- `cli/apollo_cli/crud_helpers.py:148-220` — `list_entities`/`create_entity`/
  `update_entity`/`delete_entity`, helpers genéricos já usados por todo comando CRUD
  desta CLI — reutilizar, não duplicar.
- `web/e2e/focus-dialog-dia-rotina.spec.ts:18,45-65,104-110` — `PREFIX =
  "phase23-e2e-"`, `sweepLeftovers()` (varre tarefa/ticket/template/fundo por nome,
  NUNCA instanciasRotina), chamado em `beforeAll`/`afterAll`. Este É o mecanismo que
  produziu o resíduo real (decisão 5).
- `web/e2e/entities-fundos.spec.ts:39-49`, `web/e2e/entities-form-restyle.spec.ts:34-44`
  — mesmo padrão `sweepLeftovers` duplicado (varredura só de `fundo`, por nome).

Research/pattern-map deve: (a) confirmar via experimento ao vivo real o shape exato de
`instanciasRotina.template` após o template vinculado ser deletado (decisão 2); (b)
localizar TODOS os call sites em `web/e2e/*.spec.ts` que chamam
`rotina template deletar` (decisão 5a); (c) confirmar se um comando `instancia deletar`
avulso já existe na CLI ou precisa ser criado (decisão 5b).

</code_context>

<specifics>
## Specific Ideas

- Nome de comando sugerido para LIFE-02: `apollo rotina instancia limpar-orfas`.
- Nome de flag sugerido para ambos LIFE-01/LIFE-02: `--force` (LIFE-01, prosseguir com
  delete apesar de instâncias vinculadas) / `--confirmar` (LIFE-02, executar a remoção em
  vez de só listar) — planner pode escolher nomes diferentes desde que documentados e
  consistentes entre si.

</specifics>

<deferred>
## Deferred Ideas

- Cascata automática de delete (deletar template também deleta suas instâncias) —
  explicitamente rejeitada (decisão 1): apagaria histórico real sem confirmação por
  instância.
- App InstantDB de teste dedicado — explicitamente rejeitado pelo usuário nesta sessão
  (decisão 4), substituído por fluxo de limpeza no mesmo app.
- Centralizar TODA a infraestrutura de teste e2e (não só sweep) num helper compartilhado
  — fora de escopo; só a parte de sweep relacionada a este achado é tocada aqui.
</deferred>
