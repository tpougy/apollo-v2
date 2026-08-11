# Milestone v1.3 Requirements — Navegação reorganizada + Dashboard de acompanhamento

Fonte de verdade: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` (leitura integral obrigatória
antes de planejar qualquer fase). Os ids `1b/1d/4b/5a/6a/7a/7b` citados nas descrições abaixo
são blocos do wireframe `Apollo Wireframes.dc.html`, referência visual apenas — não geram
requisito próprio.

Esta milestone é **UI e organização apenas**. Nenhuma mudança de schema (`shared/instant.schema.ts`),
de `instant.perms.ts`, de CLI ou de `routineJob.ts` está em escopo (spec §0, §10 "Fora de escopo").

## Decisão de implementação registrada (spec §5.3)

A spec deixa deliberadamente aberto como contar "tarefa concluída", dado que `tarefas.status`
é texto livre (nenhum campo booleano/data de conclusão existe em `tarefas` no schema — verificado
em `shared/instant.schema.ts`). Decisão, a ser codificada em `derive.ts` (`progressoEtapa`):

> Uma tarefa conta como **feita** apenas quando ela tem pelo menos uma subtarefa vinculada
> **e** todas as suas `subtarefas.concluida` são `true` (campo booleano real). Tarefas sem
> nenhuma subtarefa nunca contam como feitas — entram no denominador (`total`), nunca no
> numerador (`feitas`). Nunca comparar `tarefas.status === "concluida"` ou qualquer string.

Consequência simétrica para a fila de tickets (§3.2 cita "dataConclusao ausente", campo que
não existe em `tickets` no schema): como não há sinal não-textual de conclusão em `tickets`,
a fila "Tickets a fazer" **não filtra por conclusão** — lista todos os tickets, ordenados por
`tipoPrazo === "hard"` primeiro e depois por data. Isso respeita a restrição de não presumir
vocabulário de status sem inventar um campo booleano inexistente. Ambas as decisões devem ser
citadas no PR final.

`vencido` (atraso, §5.4) é sempre `dataPrevista != null && dataPrevista < hoje && !concluido` —
uma única função pura, reusada por calendário/kanban/rotinas/heatmap.

---

## v1 Requirements

### NAV — Navegação (topbar de 6 seções)

- [x] **NAV-01**: Usuário vê exatamente 6 itens na topbar, nesta ordem: Dashboard, Rotinas, Tickets, Projetos, Fundos, Log.
- [x] **NAV-02**: Usuário não encontra caminho de primeiro nível para Etapas, Templates de rotina, Subtarefas ou Tarefas — só existem aninhados dentro de seus pais.
- [x] **NAV-03**: Ao abrir o app, a rota inicial é o Dashboard (não uma entidade).
- [x] **NAV-04**: `EntityConfig` ganha campos opcionais `nav?: "primary" | "nested"` e `navTitulo?: string`; `registry.ts` ganha o seletor derivado `navConfigs` (sem lista manual de entidades).
- [x] **NAV-05**: `nav-<etype>` dos 5 testids de nav primária hoje existentes não muda; `nav-etapas`, `nav-templatesRotina`, `nav-subtarefas`, `nav-tarefas` deixam de existir e os e2e que os usavam navegam pelo caminho aninhado via helper `gotoNested`.

### NEST — Seções aninhadas

- [x] **NEST-01**: `EntityScreen.svelte` recebe duas props opcionais e aditivas — `scopeWhere` e `presetLinks` — sem nenhum `if (config.etype === ...)`; com ambas `null` o comportamento é byte-a-byte o de hoje, provado pelos e2e existentes sem edição.
- [x] **NEST-02**: Seção Projetos é master-detail: coluna esquerda lista projetos agrupados por fundo (grupo "Sem fundo vinculado" sempre por último) com busca e controle de agrupamento; coluna direita mostra etapas do projeto selecionado como linhas colapsáveis ordenadas por `etapas.ordem`, accordion single, com as tarefas daquela etapa dentro.
- [x] **NEST-03**: Dentro do detalhe de projeto existe alternância "etapas ▾" lista/kanban, e uma aba "Todas as tarefas" (sem `scopeWhere`) com filtro de conveniência "Sem etapa", para que tarefa órfã (sem etapa vinculada) permaneça alcançável.
- [ ] **NEST-04**: Seção Rotinas tem duas abas — Instâncias (default, `capabilities.create`/`.delete` continuam `false`, sem affordance de criar/excluir) e Templates (com parágrafo de contexto).
- [ ] **NEST-05**: Seção Tickets: selecionar uma linha abre painel lateral interno (não Sheet) com as subtarefas daquele ticket via `EntityScreen` de `subtarefas` com `scopeWhere`/`presetLinks` já resolvidos para o pai aberto; o mesmo painel é usado a partir de Tarefas. O seletor `xor-parent-type` continua existindo no form genérico mas nunca precisa ser tocado no fluxo normal.
- [x] **NEST-06**: Seções Fundos e Log permanecem inalteradas (`EntityScreen` direto).

### DASH — Dashboard (tela inicial)

- [ ] **DASH-01**: Novo componente `Dashboard.svelte` (não é `EntityScreen`, não entra no registry), montado pelo `Shell` na rota `dashboard`, com grid de 3 colunas em `lg:` (tickets | semana+kanbans | rotinas+heatmap) e 1 coluna abaixo de `lg`.
- [ ] **DASH-02**: Coluna esquerda lista tickets a fazer (fonte definida na decisão §5.3 acima), ordenados por prazo hard primeiro, card clicável abrindo o dialog de Ticket, com link "ver todos" e estado vazio.
- [ ] **DASH-03**: Faixa central mostra exatamente 5 cards (segunda a sexta); sábado/domingo aparecem só via chip (renderizado apenas quando há itens) que abre popover; cada card de dia mostra até 3 itens + `+N`, com borda esquerda por tipo (tarefa/rotina/ticket-hard) e destaque de hoje via `bg-muted`.
- [ ] **DASH-04**: Coluna direita agrupa rotinas da semana por fundo em cards leves e transparentes (até 4 rotinas por card + `+N`), grupo "Sem fundo vinculado" sempre por último, com controles funcionais de agrupar/ordenar/status; abaixo, heatmap mensal de carga (grade 7×5–6, 5 faixas fixas, só tokens do §6 da spec, fim de semana em `bg-muted/40`, legenda visível).
- [ ] **DASH-05**: Abaixo da faixa central, uma faixa de mini-kanban por projeto em andamento (colunas = etapas por `ordem` asc, cards = tarefas da etapa, até 3 cards por coluna + `+N`, colunas de largura fixa que nunca comprimem, faixa com scroll horizontal e indicador `›` só quando `scrollWidth > clientWidth` medido). Colapso por projeto persiste em `localStorage` (`apollo.dash.collapsed.<projetoId>`).
- [ ] **DASH-06**: Módulo puro `derive.ts` (sem `db`, recebe `hoje` por parâmetro) implementa `semanaUtil`, `agendaPorDia`, `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`, cobertos por testes de unidade (`derive.test.ts`).
- [ ] **DASH-07**: Módulo `dashboardQuery.ts` faz uma única `db.useQuery` (não sete) trazendo `projetos`, `tarefas`, `instanciasRotina` (incluindo `template.fundo`, sem adicionar esses links ao `defs/instanciasRotina.ts`), `tickets`, `fundos` — sem store global, sem cache.

### DLG — Sistema de dialogs

- [ ] **DLG-01**: 7 dialogs de foco (Ticket, Dia, Tarefa, Projeto, Fundo, Etapa, Rotina), três larguras só (S/M/L), todos com título, linha de contexto, corpo em leitura, rodapé "editar" + "ver na página completa →" + fechar; "editar" abre o form do `EntityScreen` correspondente sem duplicar formulário.
- [ ] **DLG-02**: Todo elemento clicável do Dashboard (card, header de dia, chip fim de semana, célula de heatmap, linha de rotina, badge de fundo, cabeçalho de coluna de kanban, card de tarefa) é um `<button>` real, acessível por teclado (`focus-visible`, Enter/Espaço), e abre o dialog correto listado na tabela da spec §4; alvos aninhados usam `stopPropagation`.
- [ ] **DLG-03**: Profundidade máxima de navegação entre dialogs é 2 (ex.: projeto → tarefa, nunca um terceiro nível); Esc/clique-fora/× fecham exceto com escrita em andamento (`escapeKeydownBehavior` igual ao padrão do `EntityScreen`); ação destrutiva continua em `AlertDialog` por cima.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NAV-02 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NAV-03 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NAV-04 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NAV-05 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NEST-01 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NEST-06 | Phase 18: Navigation Foundation & EntityScreen Extension | Complete |
| NEST-02 | Phase 19: Projetos Section (Master-Detail) | Complete |
| NEST-03 | Phase 19: Projetos Section (Master-Detail) | Complete |
| NEST-04 | Phase 20: Rotinas & Tickets Sections | Pending |
| NEST-05 | Phase 20: Rotinas & Tickets Sections | Pending |
| DASH-06 | Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | Pending |
| DASH-07 | Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | Pending |
| DASH-01 | Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | Pending |
| DASH-02 | Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | Pending |
| DASH-03 | Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | Pending |
| DASH-05 | Phase 22: Dashboard Kanbans, Rotinas & Heatmap | Pending |
| DASH-04 | Phase 22: Dashboard Kanbans, Rotinas & Heatmap | Pending |
| DLG-01 | Phase 23: Focus Dialog System | Pending |
| DLG-02 | Phase 23: Focus Dialog System | Pending |
| DLG-03 | Phase 23: Focus Dialog System | Pending |

**Coverage: 21/21 v1 requirements mapped. No orphans, no duplicates.**

## Future Requirements

<!-- Fora do escopo desta milestone, mas mencionados na spec ou adjacentes -->

- Router/URL/deep link para o Dashboard e seções — spec §10 "fora de escopo"; app hoje não tem nenhum dos dois
- Drag-and-drop no kanban de projetos — spec §10 "fora de escopo"
- Edição inline de status fora do dialog nº 7 (Rotina) — spec §10 "fora de escopo"
- Bloco de leitura no detalhe de Fundo (rotinas/projetos/tickets vinculados) — spec §2.5, condicionado à existência futura do dialog de Fundo; nesta milestone o dialog de Fundo (nº 5) já cobre isso, então este item específico do painel de detalhe de Fundos fora do dashboard fica para depois

## Out of Scope

- Qualquer mudança em `shared/instant.schema.ts`, `instant.perms.ts`, CLI (`cli/`) ou `routineJob.ts` — spec §0/§10
- Criação ou exclusão de instância de rotina (`instanciasRotina.capabilities.create/delete` seguem `false`) — spec §10
- Adicionar links de `template`/`fundo` a `defs/instanciasRotina.ts` — quebraria o `dedupeKey` re-parenteando a instância; o Dashboard lê pela sua própria query (spec §5.1)
- Tema customizado, hex arbitrário, cor nova fora dos tokens de `web/src/app.css`, `chart-*` com croma — spec §0/§6
- Qualquer dependência nova fora do registry shadcn-svelte (sem dnd, gráfico, router, virtualização) — spec §0/§7
