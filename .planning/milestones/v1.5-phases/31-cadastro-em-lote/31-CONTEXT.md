# Phase 31: Cadastro em lote - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`) — escopo desta
fase especificado em `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md`; decisões de
design abaixo tomadas nesta sessão a partir de leitura direta do código (não é a fase
mais simples da milestone — é a de maior superfície nova — então as decisões são mais
extensas que as fases anteriores).

<domain>
## Phase Boundary

Hoje cadastrar um calendário inteiro de rotinas (18 `fundos` + 84 `templatesRotina`,
como o onboarding real) exige 102 chamadas de CLI (`apollo fundo criar` × 18, `apollo
rotina template criar` × 84), cada uma resolvendo manualmente o `--fundo-id`/
`--antecessor-id` do passo anterior. Um erro no meio do lote (ex. a chamada 60) não
tem como ser retomado sem re-verificar manualmente quais dos 59 anteriores já foram
persistidos, arriscando duplicar `fundos`/`templatesRotina` sem constraint de
unicidade que impeça isso no schema.

Covers requirement BATCH-01 (ver `.planning/REQUIREMENTS.md`).

Esta fase adiciona um comando novo (`apollo import`, decisão 1) e não modifica nenhum
comando CRUD existente (`fundo criar/editar/deletar`, `rotina template
criar/editar/deletar` continuam exatamente como estão — o import é um caminho de
entrada adicional, não uma substituição).

</domain>

<decisions>
## Implementation Decisions

1. **Comando único, cross-entity: `apollo import --from-json <arquivo>`.** Não um
   comando por entidade (`fundo importar`, `rotina template importar` separados) —
   Success Criterion 1 exige referências ENTRE `fundo` e `templates` dentro do MESMO
   arquivo, e Success Criterion 3 exige uma ÚNICA invocação para o lote inteiro
   (18+84 = 102 registros). Dois comandos separados forçariam duas invocações no
   mínimo, quebrando SC3 diretamente.

2. **Formato do arquivo: um objeto JSON top-level com uma chave por tipo de entidade
   suportado** (`fundos`, `templatesRotina` — só esses dois nesta fase, mesmo shape
   do onboarding real; nenhuma outra entidade é coberta por BATCH-01). Cada lista
   contém registros cujos campos espelham EXATAMENTE os `--flag`s já aceitos por
   `apollo fundo criar`/`apollo rotina template criar` (mesmos nomes de campo em
   camelCase — `nome`, `codigo`, `ativo` para fundo; `nome`, `tipoGeracao`,
   `regraCompetencia`, `propagarAtrasoSoft`, `ativo`, `offsetDias`, `diaSemana` para
   template), reutilizando as MESMAS constantes de validação já existentes
   (`REGRAS_COMPETENCIA_SUPORTADAS`, `_TIPO_GERACAO_CHOICES`, `_DIA_SEMANA_CHOICES`)
   — nenhuma regra de validação nova é inventada, só reaplicada num contexto
   declarativo em vez de flags de CLI.

3. **Referências dentro do lote via `_local_id` + convenção `$`-prefixo.** Cada
   registro (em `fundos` e `templatesRotina`) ganha um campo obrigatório
   `_local_id: str` (identificador arbitrário, único DENTRO do arquivo, nunca
   persistido — é só um apelido de resolução). Um campo de referência
   (`templatesRotina[].fundoId`, `templatesRotina[].antecessorId`) aceita DOIS
   formatos: um id real de InstantDB já existente (string sem prefixo — referencia
   um registro fora do lote, já cadastrado antes), OU `"$<local_id>"` (referencia
   outro registro DENTRO do mesmo arquivo, resolvido antes de qualquer escrita).
   `antecessorId` pode referenciar OUTRO template do mesmo lote (encadeado chains) —
   suportar isso é necessário porque o onboarding real tem templates `encadeado`
   referenciando outros templates.

4. **Validação completa ANTES de qualquer escrita (SC1), com coleta de TODOS os
   erros, não fail-fast no primeiro.** Duas passadas puras, nenhuma delas escreve:
   - Passada 1 (forma): cada registro tem todo campo obrigatório presente e de tipo
     certo, todo campo `choice` (tipoGeracao/regraCompetencia/diaSemana) é um valor
     válido — reaproveita as constantes existentes, nunca duplica a lista de valores
     aceitos.
   - Passada 2 (referências): todo `"$<local_id>"` em `fundoId`/`antecessorId`
     resolve para um `_local_id` que de fato existe no arquivo, no tipo de entidade
     certo (`fundoId` só pode apontar para um `_local_id` dentro de `fundos`;
     `antecessorId` só para um `_local_id` dentro de `templatesRotina`); nenhum ciclo
     de `antecessorId` dentro do lote (A→B→A).
   Se QUALQUER erro for encontrado em qualquer registro, em qualquer passada: emitir
   a lista COMPLETA de erros (um por registro problemático, com índice/`_local_id`
   e motivo), exit 2, **zero escrita, mesmo que só 1 de 102 registros tenha erro**.

5. **Idempotência por chave natural, não por `--force`/flag de confirmação (LIFE-01/
   LIFE-02 não se aplicam aqui — isto é sobre CRIAR, não deletar).** Nenhuma das duas
   entidades tem `unique()` no schema (`fundos.codigo` é só `.indexed()`,
   `templatesRotina.nome` nem isso) — então `client.tx[etype][lookup(...)]` (o
   padrão de upsert usado por `instanciasRotina.dedupeKey`) não está disponível aqui
   sem uma migração de schema, que esta fase delibera NÃO fazer (mais simples: query
   primeiro, decide, cria só o que falta — o mesmo idioma já usado por
   `gerar-instancias`, ver decisão 7). Chave natural de dedupe:
   - `fundos`: par `(donoId, codigo)` — dois fundos do mesmo dono com o mesmo
     `codigo` são considerados "o mesmo fundo" para fins de idempotência.
   - `templatesRotina`: par `(donoId, fundoId resolvido, nome)` — dois templates do
     mesmo dono, vinculados ao mesmo fundo (já resolvido via decisão 3), com o mesmo
     `nome`, são considerados "o mesmo template". Um template SEM `fundoId` usa
     `(donoId, None, nome)` como chave (fundoId ausente é um valor de chave válido,
     não um erro).
   Um registro cuja chave natural já existir na base é reportado como `existing` no
   relatório final (decisão 8), **não recriado, não tratado como erro**.

6. **Resolução de id ANTES do transact, cliente atribui ids novos via `new_id()`.**
   Mirrors o padrão já existente em `crud_helpers.create_entity` (`eid = new_id()`
   antes de `client.tx[etype][eid].create(...)`). Para cada `_local_id`: se a chave
   natural já existir na base (query prévia, decisão 5), o `_local_id` resolve para o
   id REAL já existente (registro não entra no transact); senão, resolve para um
   `new_id()` recém-gerado (registro entra no transact como `create`). Isso permite
   que TODA referência (`fundoId: "$f1"`, `antecessorId: "$t3"`) seja resolvida para
   um id real ANTES de montar qualquer chunk de transact — inclusive quando um
   template referencia outro template do mesmo lote que também é novo (nenhuma
   ordenação topológica é necessária: o id do alvo já é conhecido de antemão,
   independente da ordem de leitura do arquivo).

7. **Um único `client.transact(chunks)` atômico para o lote inteiro (fundos +
   templates juntos, só os registros NOVOS — os `existing` nunca entram no
   payload).** InstantDB's `transact()` já aceita uma lista heterogênea de chunks de
   tipos de entidade diferentes num único call atômico — confirmado pelo padrão já
   em produção em `routine_job.py:947-957` (`chunks = [...]; client.transact(chunks)`
   para toda a lista de `instanciasRotina` de uma vez). Isto dá atomicidade real ao
   lote inteiro: ou tudo aplica, ou nada aplica — mais forte que apenas
   "idempotente se re-rodado", que é a garantia mínima pedida por SC2. No caso de
   falha de rede APÓS o envio (resultado ambíguo — igual ao já tratado em
   `routine_job.py:952-966`): re-consultar pelas chaves naturais dos registros
   tentados e reportar como `existing` os que efetivamente aterrissaram, sem re-jogar
   o erro nesse caso; só propagar erro genuíno se a re-consulta confirmar que nada
   foi escrito.

8. **Relatório JSON final espelha o padrão já estabelecido por `gerar-instancias`**
   (`{"created": [...], "existing": [...], "skipped": [...]}` — aqui adaptado para
   duas entidades): `{"fundos": {"created": [...], "existing": [...]}, "templatesRotina":
   {"created": [...], "existing": [...]}}` no caso de sucesso (validação passou);
   `{"errors": [...]}` no caso de falha de validação (decisão 4), sem as chaves
   `fundos`/`templatesRotina` (nada foi processado). `created`/`existing` listam os
   `_local_id`s (não os ids reais do InstantDB) — mais útil para quem escreveu o
   arquivo de lote conferir o que aconteceu com CADA linha que escreveu, mirando o
   padrão de `gerar-instancias`'s `skipped` incluir `nome` (Phase 27/JOB-03) para
   diagnosticabilidade humana em vez de só ids opacos.

9. **`--dry-run` mirando o flag já existente em `gerar-instancias`.** Roda validação
   completa + query de existência + resolução de ids, mas NUNCA chama `transact` —
   retorna o mesmo shape de relatório que uma chamada real produziria, rotulado
   corretamente como o que SERIA criado vs. o que já existe. Mesmo texto de
   `--help` de `gerar-instancias --dry-run` como referência de tom.

10. **Escopo é só `fundos` + `templatesRotina`.** Nenhuma outra entidade
    (`projetos`/`etapas`/`tarefas`/`tickets`/`subtarefas`/`instanciasRotina`) é
    coberta — `instanciasRotina` em particular NUNCA é criada via import (C-06
    continua valendo: só `gerar-instancias` cria instâncias). Se o formato do
    arquivo precisar crescer para outras entidades numa milestone futura, a mesma
    convenção `_local_id`/`$`-prefixo se estende naturalmente — não é preciso
    redesenhar, mas implementar isso agora é fora de escopo (YAGNI — o onboarding
    real só precisou de fundo+template).

</decisions>

<code_context>
## Existing Code Insights

Verificado ao vivo nesta sessão (linhas conferidas diretamente):

- `cli/apollo_cli/crud_helpers.py:164-186` — `create_entity`: `eid = new_id()`
  ANTES do transact, `client.tx[etype][eid].create(payload)`, `.link(links)` se
  houver — o padrão exato de pré-atribuição de id que a decisão 6 generaliza para
  N registros heterogêneos num só transact.
- `cli/apollo_cli/entities/fundo.py:44-57` — `apollo fundo criar`: campos
  `nome`/`codigo`/`ativo`/`createdAt` (createdAt = `now_iso()`, sempre automático,
  nunca vem do arquivo de lote).
- `cli/apollo_cli/entities/rotina.py:213-320` — `apollo rotina template criar`:
  todos os campos/choices que o formato do arquivo de lote espelha (decisão 2),
  incluindo `_resolve_ref`/`_merge_links` para `--fundo-id`/`--antecessor-id` (o
  padrão de link já usado, a resolução de `_local_id` da decisão 3/6 substitui essas
  duas chamadas por ids já resolvidos antes do transact).
- `cli/apollo_cli/routine_job.py:947-966` — o padrão exato de transact heterogêneo +
  recuperação de falha ambígua de rede que a decisão 7 reaproveita
  verbatim (substituindo `dedupeKey` por `codigo`/`(fundoId, nome)` como as chaves
  naturais re-consultadas no `except`).
- `shared/instant.schema.ts:13-19` (`fundos`, `codigo` só `.indexed()`, não
  `.unique()`), `:71-80` (`templatesRotina`, `nome` nem indexed) — confirma que
  nenhuma das duas entidades tem um `lookup()`-compatível unique attribute hoje;
  decisão 5/6 é a razão de não precisar de um (query-then-create, não upsert).

Research/pattern-map deve: confirmar a shape exata da query InstaQL para buscar
`fundos`/`templatesRotina` existentes por lote de `codigo`s/`nome`s (provavelmente
`where: {codigo: {$in: [...]}, donoId: dono_id}`, mas confirmar se `$in` já é usado em
algum lugar deste codebase — RESEARCH.md de fases anteriores mencionou incerteza sobre
`$in: []` vazio, D-27 area, então testar especificamente o caso "lote com 0 fundos
novos, todos já existentes" ao vivo).

</code_context>

<specifics>
## Specific Ideas

- Nome de arquivo de exemplo/fixture de teste sugerido:
  `cli/tests/fixtures/batch-import-example.json` ou inline no teste — planner decide.
- Considerar se `apollo import --from-json <arquivo> --dry-run` deveria também
  aceitar `--help`-documented um exemplo mínimo de shape de arquivo no próprio texto
  de ajuda (mirando como `--offset-dias`/`--dia-semana`'s help já é generoso em
  explicar semântica) — não obrigatório, mas consistente com o padrão de
  documentação já estabelecido nesta CLI.

</specifics>

<deferred>
## Deferred Ideas

- Suporte a outras entidades no import (`projetos`/`etapas`/`tarefas`/etc.) — fora de
  escopo, YAGNI (decisão 10).
- Upsert real via `lookup()` (exigiria `.unique()` em `codigo`/`nome`, uma migração
  de schema) — decisão 5/6 evita isso deliberadamente; se uma fase futura precisar de
  upsert genérico (atualizar campos de um fundo já existente via import, não só
  criar), essa migração pode ser revisitada então.
- Formato alternativo de arquivo (CSV, YAML) — fora de escopo, JSON é suficiente e
  consistente com o resto do contrato JSON desta CLI.
</deferred>
