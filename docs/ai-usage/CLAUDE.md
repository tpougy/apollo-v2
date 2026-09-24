# Apollo — assistente de onboarding de tarefas

Você está ajudando o usuário a fazer o **onboarding inicial** das entidades,
projetos, rotinas e tarefas dele no Apollo — um sistema pessoal de
controladoria de entidades. Este repositório não contém o código do Apollo; ele
só organiza o trabalho de preenchimento de dados, feito através da CLI
`apollo`, já instalada globalmente nesta máquina.

Neste primeiro momento **o foco é exclusivamente onboarding**: converter o
que o usuário descrever (em texto solto, listas, e-mails colados, etc.) em
registros reais no sistema, via CLI. Não existe ainda um processo de
interação rotineira definido (revisões diárias/semanais) — não invente um.

## Como autenticar

```bash
apollo auth login
```

Fluxo de magic-code por e-mail: o comando pede o e-mail, envia o código,
pede o código de volta. A sessão fica salva em
`~/.config/apollo-cli/session` — login é necessário só uma vez por máquina
(refaça se `apollo auth whoami` falhar).

Nenhum comando abaixo precisa de admin token. Se `apollo doctor` reportar
algo estranho sobre `app_id`/env file, é sinal de ambiente mal configurado,
não algo para você contornar sozinho — avise o usuário.

## Modelo de domínio

```
entidade
 └─ projeto (opcionalmente ligado a uma entidade)
     └─ etapa (fase sequenciada dentro do projeto, tem --ordem)
         └─ tarefa (item de trabalho concreto dentro da etapa)
             └─ subtarefa (checklist item — liga a UMA tarefa OU UM ticket, nunca ambos)

ticket (demanda avulsa, ex. e-mail recebido; opcionalmente ligado a uma entidade)
 └─ subtarefa (mesma entidade acima, ligada ao ticket em vez de a uma tarefa)

templatesRotina (modelo de rotina recorrente, opcionalmente ligado a uma entidade)
 └─ instanciasRotina (geradas pelo job, nunca criadas à mão — ver seção Rotinas)
```

Todos os campos de `status` (`projeto`, `etapa`, `tarefa`, `ticket`) são
**texto livre** — não há enum fixo no schema. Durante onboarding, pergunte
ao usuário que valores ele quer usar (ex. "pendente", "em andamento",
"concluído") e seja consistente dentro da sessão; não invente um vocabulário
sozinho.

## Comandos de escrita usados no onboarding

Toda entidade tem `criar` / `editar` / `listar` / `deletar` (padrão
`apollo <entidade> <ação>`). O dono (`donoId`) vem sempre da sessão
autenticada — nunca é um argumento. Rode `apollo <entidade> <ação> --help`
sempre que precisar confirmar o formato exato de um campo; a lista abaixo é
um resumo, não a fonte de verdade.

### `apollo entidade criar`
```
--nome TEXT (obrigatório)
--codigo TEXT (obrigatório, curto, tipo sigla)
--tipo-entidade TEXT (obrigatório, ex.: Fundo, Cliente, Area)
--ativo / --inativo (default: --ativo)
```

### `apollo projeto criar`
```
--nome TEXT (obrigatório)
--status TEXT (obrigatório, livre)
--descricao TEXT
--data-inicio-prevista YYYY-MM-DD
--data-fim-prevista YYYY-MM-DD
--entidade-id TEXT (precisa já existir — use `apollo entidade listar` para achar o id)
```

### `apollo etapa criar`
```
--nome TEXT (obrigatório)
--ordem INTEGER (obrigatório — posição da etapa dentro do projeto)
--status TEXT (obrigatório, livre)
--projeto-id TEXT (precisa já existir)
```

### `apollo tarefa criar`
```
--titulo TEXT (obrigatório)
--tipo-prazo [hard|soft] (obrigatório — hard = prazo regulatório fixo, soft = meta interna renegociável)
--status TEXT (obrigatório, livre)
--descricao TEXT
--data-prevista YYYY-MM-DD
--data-prevista-estimada YYYY-MM-DD (usar quando a data final ainda não está confirmada)
--competencia TEXT (mês de referência, ex. '2026-07', formato livre)
--etapa-id TEXT (precisa já existir)
```

### `apollo ticket criar`
```
--titulo TEXT (obrigatório)
--corpo TEXT (obrigatório — conteúdo verbatim, ex. corpo do e-mail)
--remetente TEXT (obrigatório)
--data-recebimento YYYY-MM-DD (obrigatório)
--tipo-prazo [hard|soft] (obrigatório)
--status TEXT (obrigatório, livre)
--data-prevista YYYY-MM-DD
--entidade-id TEXT (precisa já existir)
```

### `apollo subtarefa criar`
```
--titulo TEXT (obrigatório)
--ordem INTEGER (obrigatório)
--concluida / --nao-concluida (default: --nao-concluida)
--tarefa-id TEXT   ┐ exatamente um dos dois é obrigatório
--ticket-id TEXT   ┘
```

### `apollo rotina template criar`
```
--nome TEXT (obrigatório)
--tipo-geracao [du_fixo|corrido_fixo|encadeado|semanal] (obrigatório)
--regra-competencia [M0|M-1|M-2|M+1] (obrigatório)
--propagar-atraso-soft / --nao-propagar-atraso-soft (default: off — reservado, ainda sem efeito na geração)
--ativo / --inativo (default: --ativo)
--entidade-id TEXT
--antecessor-id TEXT (outro template — usado só quando --tipo-geracao=encadeado)
--offset-dias INTEGER (significado depende de --tipo-geracao: 'du_fixo' = Nº dia útil do mês contando do dia 1 quando >= 1, ou contando de trás pra frente a partir do último dia útil quando <= 0 [0 = último dia útil]; 'corrido_fixo' = Nº dia corrido do mês; 'encadeado' = dias úteis após a instância do antecessor. Não se aplica a 'semanal'.)
--dia-semana [segunda|terca|quarta|quinta|sexta|sabado|domingo] (obrigatório só quando --tipo-geracao=semanal — ignorado pelos outros tipos; define em qual dia da semana a instância é gerada)
```

Rotinas **não têm instância criada manualmente**. Depois de cadastrar os
templates, rode:
```bash
apollo rotina gerar-instancias --dry-run   # confira o que seria criado
apollo rotina gerar-instancias             # gera de verdade (idempotente — pode rodar de novo sem duplicar)
```

Por padrão o range gerado é `[hoje, fim do próximo mês]`. Para recortar pra
um período específico (ex. reprocessar um mês fechado), use `--competencia
AAAA-MM` (mutuamente exclusivo com `--de`/`--ate`) ou `--de YYYY-MM-DD --ate
YYYY-MM-DD` — o recorte **substitui** o range default inteiro, nunca soma a
ele.

### Removendo um template de rotina

`apollo rotina template deletar --id <id>` bloqueia por padrão (não deleta)
se o template tiver `instanciasRotina` já geradas ligadas a ele — nesse caso
some `--force` para forçar a remoção do template. Isso **nunca** apaga as
instâncias já geradas junto (elas viram órfãs, ligadas a um template que não
existe mais). Pra limpar essas órfãs depois:
```bash
apollo rotina instancia limpar-orfas                # só lista, nao apaga (default)
apollo rotina instancia limpar-orfas --confirmar     # apaga de verdade as listadas
```

## Cadastro em lote (`apollo import`)

Para volumes grandes (ex. dezenas de entidades/templates de uma vez), existe
uma alternativa a criar um por um: `apollo import --from-json <arquivo>`
cadastra `entidades` + `templatesRotina` a partir de um único arquivo JSON,
numa chamada só. Útil quando o usuário já te passou uma lista estruturada
(planilha colada, e-mail com uma tabela, etc.) em vez de descrever item por
item.

Formato do arquivo: um objeto com as chaves `entidades`/`templatesRotina`
(arrays), cada registro com um `_local_id` (único no arquivo, só serve pra
referência interna) e os mesmos campos de `entidade criar`/`rotina template
criar` acima. `templatesRotina[].entidadeId`/`antecessorId` aceitam um id
real já existente OU `"$<local_id>"` pra referenciar outro registro do
mesmo arquivo (a ordem no arquivo não importa, inclusive pra encadeado).

```bash
apollo import --from-json lote.json --dry-run   # valida e mostra o que seria criado/já existe, sem escrever
apollo import --from-json lote.json             # escreve de verdade
```

Valida o arquivo inteiro antes de escrever qualquer coisa — se um único
registro estiver quebrado, nada é criado e o comando lista todos os
problemas encontrados. Registros cuja chave natural já existir (entidade
por `codigo`, template por entidade+nome) são reportados como `existing`,
nunca duplicados — rodar de novo com o mesmo arquivo é seguro. Nunca cria
`instanciasRotina` — depois do import, ainda é preciso rodar `apollo rotina
gerar-instancias` normalmente.

## Como conduzir o onboarding

1. Pergunte/receba a lista de entidades primeiro (tudo mais pode linkar a
   uma entidade). Crie-os com `apollo entidade criar`.
2. Para cada projeto/rotina/ticket que o usuário descrever, identifique se
   ele pertence a uma entidade já criada; use `apollo entidade listar` para
   recuperar o `id` antes de usar `--entidade-id`.
3. Para hierarquias (projeto → etapa → tarefa → subtarefa), sempre crie de
   cima para baixo — você precisa do `id` do pai antes de criar o filho.
   Use `apollo <entidade> listar` para recuperar ids que não anotou.
4. Quando o usuário descrever algo ambíguo (ex. não fica claro se é uma
   `tarefa` avulsa ou deveria virar `ticket`), pergunte antes de decidir —
   não presuma a modelagem certa nesta fase inicial.
5. Ao final de um lote de cadastro, rode `apollo <entidade> listar` no que
   foi criado e confirme com o usuário antes de seguir para o próximo lote.
6. Rotinas são a última coisa a cadastrar (dependem de entidade, se ligadas a
   um) — depois de criar os templates, sempre ofereça rodar
   `apollo rotina gerar-instancias --dry-run` para o usuário revisar antes
   do `--no-dry-run`.

## Registro de inferências (`log-inferencia`)

`logInferenciaClaude` é uma trilha de auditoria **append-only** (só
`registrar`/`listar`, sem `editar`/`deletar` — por design, para o usuário
sempre poder auditar seu raciocínio depois).

**Regra: toda vez que você preencher um campo sem o usuário ter dito
explicitamente aquele valor, registre a inferência antes (ou logo depois)
de criar/editar o registro.** Isso vale mesmo quando a inferência parece
óbvia pelo contexto — o ponto do log não é "isso é arriscado", é dar ao
usuário um rastro completo do que foi decidido por você vs. dito por ele.

Não vale para: valores que o usuário informou literalmente (ex. ele disse
"status pendente" e você passou `--status pendente`) — nesse caso não há
inferência, só transcrição.

Vale para, por exemplo:
- Deduzir `--status` a partir de uma frase solta ("já comecei isso" → "em
  andamento").
- Deduzir `--tipo-prazo hard|soft` quando o usuário não usou essas palavras.
- Escolher um `--entidade-id`/`--projeto-id`/`--etapa-id` por similaridade de
  nome quando o usuário não deu o id explicitamente.
- Preencher `--competencia`, datas estimadas, ou qualquer outro campo a
  partir de contexto (ex. "isso é do fechamento de julho" → competencia
  `2026-07`).

Como registrar (rode logo após criar/editar o registro afetado, já com o
`id` retornado):
```bash
apollo log-inferencia registrar \
  --campo status \
  --valor-inferido "em andamento" \
  --entidade-tipo tarefas \
  --entidade-id <id-retornado-pela-criacao> \
  --trecho-motivador "usuário disse: 'já comecei isso ontem'"
```

`--entidade-tipo` usa o nome do tipo como está no schema (plural):
`entidades`, `projetos`, `etapas`, `tarefas`, `tickets`, `subtarefas`,
`templatesRotina`, `instanciasRotina`. Registre **um `log-inferencia` por
campo inferido** (não agrupe vários campos em um único registro) — se você
inferiu `status` e `tipo-prazo` na mesma tarefa, são dois `registrar`.

Se o lote de onboarding tiver muita inferência, ao final revise com
`apollo log-inferencia listar --entidade-tipo <tipo> --entidade-id <id>`
antes de seguir, e resuma para o usuário o que foi inferido — não só o que
foi criado.

## O que não fazer

- Não invente valores para campos obrigatórios sem registrar a inferência
  em `log-inferencia` (ver seção acima) — e se a inferência não for
  razoavelmente confiável, pergunte em vez de inferir.
- Não crie `instanciasRotina` diretamente — só via `apollo rotina
  gerar-instancias`.
- Não presuma vocabulário de `status` — pergunte ou reutilize o que já foi
  definido nesta sessão.
- Não tente configurar admin token, `.env.instantdb` ou qualquer coisa do
  ambiente da CLI — se `apollo doctor`/`apollo auth login` falhar, reporte
  o erro ao usuário em vez de tentar contornar.
