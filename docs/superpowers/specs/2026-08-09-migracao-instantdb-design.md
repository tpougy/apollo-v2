# Migração Apollo → InstantDB + Svelte SPA + CLI Python

**Data:** 2026-08-09
**Status:** Aprovado para planejamento de implementação

## Contexto e motivação

O projeto Apollo (repo `apollo`, `~/pessoal/apollo`) foi planejado e parcialmente implementado sobre Python 3.12 + Litestar + litestar-vite + SvelteKit + AdvancedAlchemy + SQLite + `cofin/litestar-mcp`. O código gerado é funcional, mas complexo o suficiente para dificultar iteração pelo usuário (profissional de controladoria, único operador do sistema).

Este spec define uma reescrita de arquitetura em um novo repositório (`apollo-v2`), substituindo:
- Backend Python/Litestar/SQLite → **InstantDB** como único backend de dados (realtime, sync nativo).
- SvelteKit → **Svelte 5 SPA puro** (Vite, sem SvelteKit), publicável como site estático no Cloudflare Pages.
- MCP server (`litestar-mcp`) → **CLI Python** documentada, usando o SDK do InstantDB, para uso por IA (Claude Code local) com paridade total com a UI.
- Cálculo de dias úteis via `bizdays` (Python, calendário ANBIMA) → mantido na CLI, e replicado no client via uma camada fina em TypeScript, ambos lendo a mesma tabela de feriados vendorizada.

O valor central do Apollo não muda: **paridade total entre UI e canal operado por IA** — nada que existe em um fica fora do alcance do outro. A migração troca *como* essa paridade é garantida (antes: mesma camada de Application Service por trás de Controllers HTTP e MCP tools; agora: mesmo backend InstantDB e mesmas regras de permissão consumidas por dois clientes distintos).

Referência de implementação usada como base de boas práticas: `~/pessoal/ultima-missao` (Svelte 5 + Vite + `@instantdb/svelte`, sem SvelteKit, deploy Cloudflare Pages).

## Decisão de escopo

- **Novo repositório:** `~/pessoal/apollo-v2`, independente do `apollo` atual (que fica intacto como referência/arquivo até a migração ser validada).
- **v1 do apollo-v2:** schema completo do InstantDB e CRUD completo das 8 entidades do domínio implementados de uma vez (sem slice intermediário) — reaproveitando o desenho de domínio já validado no `apollo` (Fundos, Projetos, Etapas, Tarefas, Templates de Rotina, Instâncias, Tickets, Log de Inferência).

## Estrutura do repositório

```
apollo-v2/
├── shared/
│   ├── instant.schema.ts       # fonte única do domínio (entities + links)
│   ├── instant.perms.ts        # regras de permissão, compartilhadas conceitualmente
│   ├── anbima-calendar.json    # tabela oficial de feriados ANBIMA vendorizada (2000-2078)
│   └── scripts/
│       └── update_calendar.py  # atualização manual anual do JSON a partir da fonte oficial
├── web/                         # Svelte 5 SPA (Vite puro, sem SvelteKit)
│   └── src/lib/bizdays.ts       # isBusinessDay / addBusinessDays / nextBusinessDay sobre o JSON
├── cli/                         # pacote Python (uv), entrypoint `apollo`
│   └── apollo_cli/bizdays.py    # wrapper fino sobre `bizdays` apontando pro mesmo JSON
└── .env.instantdb               # APP_ID (client + CLI); sem admin token necessário para operação normal
```

Monorepo é a escolha deliberada: como o requisito central é paridade entre os dois canais, manter `instant.schema.ts` e `anbima-calendar.json` num único lugar compartilhado evita que client e CLI divirjam silenciosamente — qualquer mudança de domínio ou de calendário toca os dois lados na mesma PR.

## Cálculo de dias úteis (ANBIMA)

Pesquisa concluída antes deste spec: o calendário ANBIMA usado por `bizdays` **não é um algoritmo, é uma tabela estática** de ~948 datas (2000–2078), federal-only (a própria ANBIMA documenta que não considera feriados estaduais/municipais). Nenhum pacote JS que calcula feriados algoritmicamente (`date-holidays`, `febraban-bank-holidays`) tem garantia de bater 100% com essa tabela oficial em casos futuros de divergência de regra.

**Decisão:** vendorizar a tabela oficial da ANBIMA (fonte: `github.com/ianliu/feriados-anbima`, espelha o arquivo publicado pela própria ANBIMA) como `shared/anbima-calendar.json`, e usá-la como **única fonte de feriados** em ambos os lados:
- **Client** (`web/src/lib/bizdays.ts`): camada fina de matemática de dias úteis (`isBusinessDay`, `addBusinessDays`, `nextBusinessDay`), inspirada na API do `febraban-bank-holidays`, mas alimentada pelo JSON vendorizado — nunca pelo cálculo algorítmico próprio da lib.
- **CLI** (`cli/apollo_cli/bizdays.py`): `bizdays` (Python) configurado com um calendário customizado apontando para o mesmo JSON, em vez do calendário `ANBIMA` embutido na lib.
- **Atualização:** `shared/scripts/update_calendar.py`, rodado manualmente uma vez por ano — nunca em runtime, nunca calculado dinamicamente.

Isso preserva a garantia equivalente ao antigo RNF-01 ("única fonte de verdade para DU"), adaptada para dois runtimes.

## Schema do InstantDB

| Entidade | Campos principais | Links |
|---|---|---|
| `fundos` | nome, codigo, ativo, donoId, createdAt | → projetos, templatesRotina, tickets |
| `projetos` | nome, descricao, status, dataInicioPrevista, dataFimPrevista, donoId | fundo (1) → etapas |
| `etapas` | nome, ordem, status, donoId | projeto (1) → tarefas |
| `tarefas` | titulo, descricao, tipoPrazo, dataPrevista, dataPrevistaEstimada, competencia, status, donoId | etapa (1) → subtarefas |
| `templatesRotina` | nome, tipoGeracao (`du_fixo`/`corrido_fixo`/`encadeado`), regraCompetencia (`M0`/`M-1`/`M-2`/`M+1`/`manual`), propagarAtrasoSoft, donoId | fundo (1), antecessor (self-link opcional) → instanciasRotina |
| `instanciasRotina` | **dedupeKey** (string, unique+indexed — chave de idempotência), dataPrevista, dataPrevistaEstimada, competencia, tipoPrazo, status, donoId | template (1) |
| `tickets` | titulo, corpo, remetente, dataRecebimento, tipoPrazo, dataPrevista, status, donoId | fundo (1) → subtarefas |
| `subtarefas` | titulo, concluida, ordem, donoId | tarefa (opcional, 1) **ou** ticket (opcional, 1) |
| `logInferenciaClaude` | campo, valorInferido, trechoMotivador, entidadeTipo, entidadeId, donoId, createdAt | — (log plano) |

Subtarefas viram entidade própria vinculada (não mais JSON embutido como no `apollo` original — decisão explícita desta migração, aproveitando que relacionamentos no InstantDB são triviais).

`donoId` (referência ao id do `$users` dono) é **denormalizado em toda entidade** — mais simples de checar em regras de permissão do que percorrer cadeias `fundo→projeto→etapa→tarefa`, e como o sistema é single-user o custo de duplicar o campo é nulo na prática.

## Autenticação e permissões

**Modelo de auth: igual para os dois canais.** Tanto o client (browser) quanto a CLI se autenticam no InstantDB via **magic code enviado por e-mail**, cada um guardando sua própria sessão de usuário localmente (browser: localStorage via SDK; CLI: `~/.config/apollo-cli/session`, criada por `apollo auth login`, rodado uma vez). Não há uso de admin token no fluxo normal de operação — client e CLI operam sob a **mesma identidade de usuário real** e as **mesmas regras de `instant.perms.ts`**. Isso é a garantia de paridade adaptada ao InstantDB: não é mais "mesma camada de serviço por trás de dois adapters", é "mesmo backend, mesmas regras, duas interfaces autenticadas da mesma forma".

**Regras em `shared/instant.perms.ts`** — idênticas para todas as entidades do domínio:
```
view/update/delete: "auth.id != null && auth.id == data.donoId"
create:              "auth.id != null && auth.id == newData.donoId"
```
`$users` mantém a regra padrão do InstantDB (cada usuário só vê o próprio perfil).

Efeito colateral positivo: se no futuro outra pessoa precisar de acesso, basta logar com o próprio e-mail — os dados ficam isolados por `donoId` automaticamente, sem mudança de schema ou de regras.

## Job de geração de instâncias de rotina

Sem backend, o job (antes disparado no startup do processo Python) passa a rodar **no client, ao carregar a SPA autenticada**:

1. Para cada `templatesRotina` ativo, calcula quais `instanciasRotina` deveriam existir no range padrão (hoje → último dia do mês seguinte), usando `bizdays.ts` para resolver os três tipos de geração (`du_fixo`, `corrido_fixo`, `encadeado`).
2. Para cada instância esperada, computa `dedupeKey = hash(templateId + competencia + dataPrevista)` e executa um `transact` de upsert via **lookup por atributo único** (`db.tx.instanciasRotina[lookup('dedupeKey', key)].update({...})`) — operação atômica do InstantDB: cria se não existe, não duplica se já existe.
3. Nunca apaga instâncias existentes — preserva a garantia original de idempotência (nunca duplica, nunca apaga).

Como cada `transact` é atômico e independente, fechar o navegador no meio da checagem não deixa estado inconsistente: na próxima abertura, o mesmo cálculo reconfirma o que já existe e completa o que falta.

## Estrutura da CLI Python

Pacote `cli/` (gerenciado com `uv`), entrypoint `apollo`, subcomandos organizados por entidade + ação (espelhando os nomes que a IA já usava via MCP tools: `criar_fundo`, `editar_fundo`, etc.):

```
apollo auth login                     # magic code, guarda sessão local de usuário
apollo fundo criar|editar|deletar|listar
apollo projeto criar|editar|deletar|listar
apollo tarefa criar|editar|deletar|listar
apollo ticket criar|editar|deletar|listar
apollo rotina template criar|editar|deletar
apollo rotina gerar-instancias        # mesma lógica idempotente do client, via bizdays nativo
apollo log-inferencia registrar       # LogInferenciaClaude
```

Implementada com `click`, cada subcomando com `--help` rico (descrição, exemplos, campos obrigatórios) — essa superfície documentada é o que substitui o MCP server para uso por Claude Code local.

## Qualidade e tooling

**Python (`cli/`):** tipagem 100% obrigatória em todo arquivo `.py` — toda função, parâmetro, retorno e variável onde aplicável. Um arquivo Python só é considerado finalizado quando **ambos** rodam sem nenhum erro nem warning:
- `ruff` — conjunto de regras razoável e deliberadamente curado (não o ruleset completo/`ALL`); cobre lint + formatação.
- `ty` (verificador de tipos da Astral) — precisa fechar limpo contra a tipagem 100% dos arquivos.

Isso vale para todo o pacote `cli/`, incluindo `cli/apollo_cli/bizdays.py` e os scripts em `shared/scripts/` (ex. `update_calendar.py`).

**JS/TS (`web/`):** `bun` é o executor único (dev, build, scripts) — mesmo padrão já usado no `apollo` atual e no `ultima-missao`. Lógica de frontend é **sempre** escrita em arquivos `.ts` — nunca `.js` puro, sem exceção, em 100% dos casos (`instant.schema.ts`, `instant.perms.ts`, `bizdays.ts`, componentes `.svelte` com `<script lang="ts">`). O projeto usa sempre um formatter (Prettier ou Biome, a definir na fase de implementação) e um verificador de lint/tipos (ESLint ou Biome + `svelte-check`) rodando limpo antes de considerar um arquivo finalizado.

## Fora de escopo desta migração

- Portar dados existentes do SQLite do `apollo` atual — o domínio ainda não tinha dados reais em produção (scaffold implementado, mas sem uso real registrado no `PROJECT.md` do projeto atual).
- Painéis de UI (5 painéis fixos, ordenação, drag-and-drop de `.eml`) — esta migração cobre schema + CRUD completo (client e CLI); o desenho de UI/UX dos painéis é um spec separado, a ser feito depois que a base de dados e a CLI estiverem validadas ponta a ponta.
- Regras avançadas de v2 do `apollo` original (realocação automática de soft deadlines, propagação de atraso encadeado) — permanecem fora de escopo, como já eram no `apollo` original.
