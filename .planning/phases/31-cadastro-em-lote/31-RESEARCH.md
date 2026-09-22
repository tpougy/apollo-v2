# Phase 31: Cadastro em lote - Research

**Researched:** 2026-09-22
**Domain:** InstaQL query shape for batch existence-checking (idempotency pre-write query), InstantDB Python SDK `transact()` heterogeneity
**Confidence:** HIGH

**Scope note:** This is a targeted addendum, not a full-domain research pass. `31-CONTEXT.md` locked 10 implementation decisions already; this file resolves only the ONE open technical question CONTEXT.md flagged under decisions 5/6/7 — the exact InstaQL query shape for batch idempotency checks, plus live confirmation of heterogeneous `transact()`. CONTEXT.md's other 7 decisions are not re-researched here.

## Summary

All three open questions are now resolved with **live-tested, HIGH-confidence** answers, cross-checked against the read source of the installed `instantdb==1.0.63` Python SDK:

1. **`$in` is supported**, including with an **empty array** — `{"codigo": {"$in": []}}` returns `0` rows with **no exception**, no special-case handling needed.
2. **Compound `(fundoId, nome)` filtering is NOT a single query** — it must be done via the entity's **link path** (`"fundo.id": <resolved_fundo_id>`) combined with `"nome": {"$in": [...]}`, grouped by distinct resolved `fundoId` (one query per group), exactly as CONTEXT.md's own draft guess anticipated. This is live-confirmed to correctly scope matches to the given `fundo` and exclude same-`nome` templates under a different `fundo`.
3. **Heterogeneous `transact()` chunks are genuinely supported** — confirmed both by reading `instantdb`'s `_transact.py` source (the SDK has no per-etype grouping logic; it flattens any list of chunks into one flat `steps` array regardless of `etype`) AND by a live call mixing `fundos` creates and `templatesRotina` creates (one of which also carries a `.link(...)`) in a single `client.transact([...])` invocation, which succeeded atomically.

**Primary recommendation:** Implement decision 5/6's existence-check exactly as follows — query `fundos` once with `codigo: {"$in": [...all codigos in batch...]}, donoId: dono_id` (safe even if the batch is empty — though in practice an empty batch should just skip the query entirely as a cheap optimization, not because `$in: []` is unsafe); query `templatesRotina` once **per distinct resolved `fundoId` group** (including a `None`/absent-`fundo` group, see Open Questions) with `"fundo.id": <fundo_id>, "nome": {"$in": [...nomes in that group...]}, "donoId": dono_id`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Batch existence check (idempotency query) | CLI / Backend (Python `apollo_cli`) | Database (InstantDB InstaQL engine) | Query construction and grouping-by-fundoId logic live in `apollo_cli` (client-side, pure Python); actual `$in`/link-path matching is evaluated server-side by InstantDB — the CLI has zero control over match semantics, only over query shape. |
| Atomic multi-entity write (transact) | CLI / Backend (Python `apollo_cli`) | Database (InstantDB transact engine) | Chunk construction (which records, in what order, with which links) is entirely client-side; atomicity guarantee itself is enforced server-side by InstantDB's `/admin/transact` endpoint. |

## Findings

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (all 10, verbatim — this research only deepens decisions 5/6/7, does not alter them)

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

### Claude's Discretion

None recorded as a separate section in `31-CONTEXT.md` — this research resolves the discretion CONTEXT.md explicitly deferred to research ("Research/pattern-map deve: confirmar a shape exata da query InstaQL...").

### Deferred Ideas (OUT OF SCOPE)

- Suporte a outras entidades no import (`projetos`/`etapas`/`tarefas`/etc.) — fora de
  escopo, YAGNI (decisão 10).
- Upsert real via `lookup()` (exigiria `.unique()` em `codigo`/`nome`, uma migração
  de schema) — decisão 5/6 evita isso deliberadamente; se uma fase futura precisar de
  upsert genérico (atualizar campos de um fundo já existente via import, não só
  criar), essa migração pode ser revisitada então.
- Formato alternativo de arquivo (CSV, YAML) — fora de escopo, JSON é suficiente e
  consistente com o resto do contrato JSON desta CLI.
</user_constraints>

### Question 1 — Is `$in` supported, and what happens with an empty array?

**Answer: Yes, `$in` is supported, and `$in: []` is safe — it returns 0 rows with no exception.** `[VERIFIED: live query against production InstantDB app + read of routine_job.py]`

**Precedent already in this codebase** (not a hypothesis — confirmed by reading the file this session):

`cli/apollo_cli/routine_job.py:816`:
```
"$": {"where": {"template.id": {"$in": instance_lookup_ids}}},
```

`cli/apollo_cli/routine_job.py:840`:
```
result = client.query({"instanciasRotina": {"$": {"where": {"dedupeKey": {"$in": keys}}}}})
```

However, tracing both call sites' callers (`cli/apollo_cli/routine_job.py:909-919` guards `instance_lookup_ids` behind `if not templates: return ...` before it's ever built, and `:928-961` guards `created_keys` behind `if not to_create: return ...` before `_query_by_dedupe_keys` is ever called) shows **neither existing call site is ever exercised with an empty `$in` list** — the empty-array case genuinely had no precedent in this codebase before this session's live test. CONTEXT.md's note pointing at "D-27" turned out to be a red herring: `D-27-A/B/C` in Phase 27's docstring are unrelated decision labels (`_is_concluida`, `du_fixo <= 0` semantics, `nome`-in-`skipped`), not a prior `$in` investigation — `grep -rln "D-27\|\$in" .planning/` confirms no phase before 31 discusses `$in` uncertainty in a RESEARCH.md; this question had no actual prior research to build on.

**Live test performed this session** (throwaway records created via `client.transact`, verified deleted afterward — see Verification below):

```
=== Q1a: $in with populated list (2 codigos) ===
OK: 2 rows returned; codigos=['BATCHQ-<suffix>-1', 'BATCHQ-<suffix>-2']

=== Q1b: $in with EMPTY list ===
OK (no exception): 0 rows returned for empty $in list. Full result: {'fundos': []}

=== Q1c: re-run Q1a's exact query again (simulates '0 new, all existing' re-check) ===
OK: 2 rows returned (expect 2, all pre-existing).
```

**Implication for decision 5/6's idempotency check:** the "batch where 0 records are new, all already exist" case (Q1c above) works exactly as expected — querying `codigo: {"$in": [...all codigos in the batch...]}` returns every matching row regardless of how many of the batch's records already exist, including all of them. The **truly empty-array** case (`$in: []`) would only arise if the code queries with zero candidate values (e.g., a batch containing zero `fundos` records) — this is now confirmed safe to leave unguarded, though skipping the query entirely when the candidate list is empty is a valid (and cheaper) implementation choice, not a required safety measure.

### Question 2 — Exact `where` shape for `templatesRotina` by batch of `(fundoId, nome)` pairs

**Answer: one query per distinct resolved `fundoId`, using the LINK PATH `"fundo.id"` (not a plain attribute) combined with `"nome": {"$in": [...]}`.** `[VERIFIED: live query against production InstantDB app + read of shared/instant.schema.ts:71-80,128-131]`

**Why a link path, not a plain attribute:** `templatesRotina` has **no `fundoId` scalar attribute in the schema** — the fundo relationship is a link, not a stored field. Read `shared/instant.schema.ts:71-80` (the `templatesRotina` entity definition) and `:128-131` (the `fundoTemplatesRotina` link definition):

```typescript
templatesRotina: i.entity({
  nome: i.string(),
  tipoGeracao: i.string(),
  regraCompetencia: i.string(),
  propagarAtrasoSoft: i.boolean(),
  ativo: i.boolean(),
  offsetDias: i.number().optional(),
  diaSemana: i.string().optional(),
  donoId: i.string().indexed(),
}),
```
```typescript
fundoTemplatesRotina: {
  forward: { on: "templatesRotina", has: "one", label: "fundo" },
  reverse: { on: "fundos", has: "many", label: "templatesRotina" },
},
```

There is no `fundoId` key in that entity block — `fundoId` in CONTEXT.md's decisions 3/5/6 refers to the CLI's own input-flag/local-resolution vocabulary (mirroring `--fundo-id`), not a literal InstantDB attribute. The actual server-side field to filter on is the link, addressed via dot-path as `"fundo.id"` — this is the exact same pattern already used for `instanciasRotina`'s `template` link at `routine_job.py:816` (`"template.id": {"$in": instance_lookup_ids}`), confirming dot-path link filtering + `$in` is an established, working pattern in this codebase, not a novel technique.

**Live test performed this session**, using 3 throwaway `templatesRotina` records: `t1`/`t3` linked to `fundo f1` (two different `nome`s), `t2` linked to `fundo f2` with the **same `nome` as `t1`** (the exact duplicate-name-across-different-fundos scenario CONTEXT.md flagged as worth testing against real data):

```
=== Q2: per-fundoId grouped nome $in query (dot-path link filter fundo.id) ===
OK: 2 rows for fundo=<f1 id>: nomes=['Conciliacao BATCHQ <suffix>', 'Fechamento BATCHQ <suffix>']
  Expected exactly [nome_other, nome_shared] (t1,t3), t2 (fundo f2, same nome) must be EXCLUDED.
  t2 excluded correctly: True

=== Q2b: same query for fundo f2 (only t2 should match) ===
OK: 1 rows for fundo=<f2 id>: nomes=['Fechamento BATCHQ <suffix>'] (expect only [nome_shared])
```

The query correctly scopes to only the specified `fundo`, even when another `fundo`'s template shares the exact same `nome` — confirming the grouping strategy is sound: **group the batch's incoming templates by their resolved `fundoId`, then issue one query per group** (`{"fundo.id": <fundo_id>, "nome": {"$in": [...nomes in that group...]}, "donoId": dono_id}`). This is not a single compound-tuple query (InstaQL's `where` has no tuple/OR-of-ANDs primitive for this) — N distinct `fundoId` values in the batch means N queries, consistent with CONTEXT.md's own draft guess in `<code_context>`.

**Open sub-case (not fully tested, flagged for planner):** decision 5 states a template **without** a `fundoId` uses `(donoId, None, nome)` as its natural key. The query shape for that "no `fundo`" group was not live-tested this session (the recommended shape is `"fundo": {"$isNull": true}, "nome": {"$in": [...]}, "donoId": dono_id}` per InstantDB's documented `$isNull` operator for absent links/values, but this specific operator was not exercised live in this session — see Assumptions Log A1).

### Question 3 — Does `client.transact()` genuinely accept heterogeneous chunks in one atomic call?

**Answer: Yes, confirmed both by source and by a live call.** `[VERIFIED: cli/.venv/lib/python3.12/site-packages/instantdb/_transact.py:133-140 + live transact against production InstantDB app]`

**Source confirmation** — `_flatten_chunks`, the function `Instant.transact()` calls before posting (`_sync/client.py:99-107`, `json={"steps": _flatten_chunks(chunks), ...}`), quoted verbatim:

```python
def _flatten_chunks(chunks: _TxChunk | list[_TxChunk]) -> list[Op]:
    """Flatten one or more chunks into a single ops list for the wire."""
    if isinstance(chunks, _TxChunk):
        chunks = [chunks]
    ops: list[Op] = []
    for chunk in chunks:
        ops.extend(chunk._ops)
    return ops
```

Each `_TxChunk` carries its own `etype` embedded in every op tuple it produces (`_TxChunk._append`, `_transact.py:88-92`: `op: Op = [action, self._etype, self._eid, args]`). `_flatten_chunks` performs **no grouping, filtering, or validation by `etype`** — it is a pure `list.extend` loop over whatever chunks it's given, regardless of which entity types they belong to. The single flat `steps` list is POSTed to `/admin/transact` in one HTTP call (`_sync/client.py:99-107`). There is no code path anywhere in the installed `instantdb==1.0.63` SDK that treats a homogeneous list differently from a heterogeneous one — `routine_job.py:947-957`'s homogeneous usage and Phase 31's needed heterogeneous usage go through the **exact same, unbranched code path**.

**Live test performed this session** — one `client.transact([...])` call mixing 2 `fundos` `.create(...)` chunks and 3 `templatesRotina` `.create(...).link(...)` chunks (5 chunks, 2 distinct `etype`s, one of the templates chunks additionally carrying a `.link()` op):

```
=== Q3: heterogeneous transact() (fundos + templatesRotina mixed) ===
OK: heterogeneous transact() succeeded. Result keys: ['tx-id']
```

All 5 records landed atomically (confirmed by the subsequent `$in` queries in Q1/Q2 finding exactly the expected rows), then were cleanly deleted in the same script run (see Verification below).

## Code Examples

Verified patterns from this session's live test, ready to translate into `apollo_cli/import.py` (or wherever decision 1's command lands):

### Batch `fundos` existence check (decision 5)
```python
# Source: live-tested this session; mirrors existing $in precedent at
# routine_job.py:816/840 (dot-path/plain-attribute $in usage).
codigos = [record["codigo"] for record in batch_fundos]  # from the batch file
if codigos:  # optional optimization — $in: [] is safe but querying nothing is cheaper to skip
    result = client.query(
        {"fundos": {"$": {"where": {"codigo": {"$in": codigos}, "donoId": dono_id}}}}
    )
    existing_fundos = result.get("fundos", [])
else:
    existing_fundos = []
```

### Batch `templatesRotina` existence check, grouped by resolved `fundoId` (decision 5/6)
```python
# Source: live-tested this session (Q2/Q2b above) — dot-path link filter
# "fundo.id" mirrors the existing "template.id" pattern at routine_job.py:816.
from collections import defaultdict

groups: dict[str, list[str]] = defaultdict(list)  # resolved_fundo_id -> [nome, ...]
for record in batch_templates:
    groups[record["resolved_fundo_id"]].append(record["nome"])

existing_templates: list[dict] = []
for fundo_id, nomes in groups.items():
    result = client.query(
        {
            "templatesRotina": {
                "$": {
                    "where": {
                        "fundo.id": fundo_id,
                        "nome": {"$in": nomes},
                        "donoId": dono_id,
                    }
                }
            }
        }
    )
    existing_templates.extend(result.get("templatesRotina", []))
# Templates with no fundoId (decision 5's (donoId, None, nome) key) need a
# separate group query — see Open Questions below, not live-tested this session.
```

### Heterogeneous atomic transact (decision 7)
```python
# Source: live-tested this session (Q3 above); structurally identical to
# routine_job.py:948-957's homogeneous usage — no special-casing needed for
# mixed etypes, `_flatten_chunks` treats every chunk identically regardless
# of `etype`.
chunks = [
    client.tx["fundos"][new_fundo_id].create(fundo_fields)
    for new_fundo_id, fundo_fields in fundos_to_create
] + [
    client.tx["templatesRotina"][new_template_id].create(template_fields).link(links)
    for new_template_id, template_fields, links in templates_to_create
]
client.transact(chunks)  # one atomic call, all-or-nothing, mixed etypes confirmed safe
```

## Verification

Live probe script run against the real production InstantDB app (session already authenticated via `apollo auth login`, `donoId` taken from the live session):

1. Created 2 throwaway `fundos` + 3 throwaway `templatesRotina` (codigos/nomes namespaced with a random `BATCHQ-<hex8>` suffix to avoid any collision with real data) in **one heterogeneous `client.transact()` call**.
2. Ran the `$in` queries (populated, empty, and grouped-by-link) described above against those throwaway records.
3. Deleted all 5 throwaway records via `client.transact(client.tx[etype][eid].delete())` calls in the same script run.
4. Re-queried immediately after deletion to confirm cleanup: `Post-cleanup check: 0 fundos remaining, 0 templates remaining (expect 0, 0).` — confirmed no residue left in production data.

No real onboarding data (the 18 real `fundos` / 84 real `templatesRotina` CONTEXT.md references) was read, modified, or deleted by this session's live test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch existence check across two related entities | A generic "diff two sets" utility, or a custom SQL-style JOIN emulation | Two grouped InstaQL queries (this document's Code Examples) | InstaQL's `$in` + link dot-path already does exactly this server-side; a custom diff utility would duplicate matching logic the database already performs correctly and consistently with the rest of the codebase's existing `$in` usage. |
| Multi-entity atomic write | Sequential per-entity `create_entity()` calls with manual rollback-on-failure logic | A single `client.transact(chunks)` call with heterogeneous chunks (this document's Q3) | The SDK already flattens heterogeneous chunks into one atomic server-side transaction — manual sequential calls would reintroduce exactly the "partial batch failure, unclear what landed" problem BATCH-01 exists to solve. |

## Common Pitfalls

### Pitfall 1: Assuming `fundoId` is a queryable plain attribute on `templatesRotina`
**What goes wrong:** A `where: {"fundoId": ...}` clause silently matches nothing (InstantDB does not error on filtering by a non-existent attribute — it just returns zero rows), which would make every `templatesRotina` in the batch look "new" even when a match exists.
**Why it happens:** CONTEXT.md's own decision text uses the words "fundoId resolvido" loosely to mean "the fundo this template is linked to" — but the schema's actual field is a link named `fundo`, not a scalar `fundoId` attribute (confirmed by reading `shared/instant.schema.ts:71-80,128-131` this session).
**How to avoid:** Always filter templatesRotina by the link's dot-path form, `"fundo.id": <id>`, never a bare `"fundoId"` key.
**Warning signs:** An import command that reports every templatesRotina in a re-run as `created` (never `existing`) despite them already being in the database — the smoking gun for a silently-empty-matching `where` clause.

### Pitfall 2: Building one giant `templatesRotina` query instead of grouping by `fundoId`
**What goes wrong:** A single query like `where: {"nome": {"$in": [...all nomes in the whole batch...]}}` (no `fundo.id` filter) would match templates across ALL fundos sharing a name — exactly the collision CONTEXT.md flagged (duplicate `nome`s across different `fundos` exist in the real onboarding data), causing a template that is genuinely new under fundo A to be misreported as `existing` because a same-named template exists under unrelated fundo B.
**Why it happens:** InstaQL's `where` has no compound-tuple/AND-across-lists-of-values primitive — a naive port of "check if `(fundoId, nome)` exists" tries to express both as top-level `$in` lists, which computes a cross-product match, not a paired match.
**How to avoid:** Group the batch's templates by resolved `fundoId` first (Python-side `dict`/`defaultdict`), then issue one query per group with `fundo.id` pinned to a single value and only `nome` using `$in`.
**Warning signs:** A test fixture with two `fundos` each having a template of the same `nome` reports one of them as `existing` when both are actually new.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The query shape for `templatesRotina` records with **no** `fundoId` (decision 5's `(donoId, None, nome)` key) is `"fundo": {"$isNull": true}, "nome": {"$in": [...]}, "donoId": dono_id` | Question 2, "Open sub-case" | Not live-tested this session (out of the 3 questions' explicit scope) — if `$isNull` behaves differently than expected for link fields specifically (vs. scalar attributes), the "no-fundo" existence check could silently under- or over-match. Low overall risk since this is a narrow sub-case of an already-locked decision, and the planner can add a targeted live test for this one shape before relying on it, or fall back to filtering `existing_templates` client-side for the no-`fundo` group (fetch all `donoId`-scoped templates without a `fundo` link and filter by `nome` in Python, avoiding the query-shape question entirely). |

## Sources

### Primary (HIGH confidence)
- Live query/transact/delete calls against the real production InstantDB app this session (throwaway records, cleaned up and verified deleted) — Questions 1, 2, 3.
- `cli/.venv/lib/python3.12/site-packages/instantdb/_transact.py` (installed `instantdb==1.0.63`) — read in full this session, `_flatten_chunks` (lines 133-140) and `_TxChunk._append` (lines 88-92).
- `cli/.venv/lib/python3.12/site-packages/instantdb/_sync/client.py` — read in full this session, `query`/`transact`/`_HTTP.post` passthrough confirmed, no client-side query validation.
- `shared/instant.schema.ts` — read in full this session, `templatesRotina` entity (lines 71-80) and `fundoTemplatesRotina` link (lines 128-131).
- `cli/apollo_cli/routine_job.py` — read lines 778-970 this session; existing `$in` precedent (lines 816, 840) and its call sites (lines 905-970).

### Secondary (MEDIUM confidence)
- None — every claim in this document was either live-verified or confirmed by reading installed source this session.

### Tertiary (LOW confidence)
- InstantDB's public InstaQL docs (`$isNull` operator) were not fetched this session — Assumption A1 relies on training knowledge of InstantDB's documented operator set, not a live test or a docs fetch.

## Metadata

**Confidence breakdown:**
- Q1 ($in + empty array): HIGH — live-tested, reproducible, no exception path
- Q2 (compound-key query shape): HIGH — live-tested with a real duplicate-name-across-fundos scenario
- Q3 (heterogeneous transact): HIGH — both source-read AND live-tested
- A1 ($isNull for no-fundo group): LOW — not tested, flagged for planner

**Research date:** 2026-09-22
**Valid until:** Indefinite for the SDK-source-level claims (Q3, tied to `instantdb==1.0.63`, re-verify if the pinned version changes); ~90 days for live-server-behavior claims (Q1, Q2) since InstaQL's `$in`/link-filtering semantics are stable, documented API surface, not implementation detail likely to change without a major version bump.
