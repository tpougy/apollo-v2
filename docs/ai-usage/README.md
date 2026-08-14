# Apollo Tasks — organização pessoal via Apollo CLI

Este repositório **não contém código do Apollo**. É o espaço de trabalho
pessoal para organizar fundos, projetos, rotinas e tarefas usando o
[Claude Code](https://claude.com/claude-code) + a CLI `apollo`, instalada
globalmente nesta máquina. Os dados reais vivem no InstantDB — este repo só
guarda processo/instruções, nunca os dados em si.

Repositório do produto (código-fonte, schema, permissões): `apollo-v2`
(https://github.com/tpougy/apollo-v2). Este repo depende só da superfície
pública da CLI (`apollo --help`), nunca do código-fonte diretamente.

## Pré-requisitos

- Windows, fora do WSL (rodar nativamente no host, não em `\\wsl$`)
- [`uv`](https://docs.astral.sh/uv/) — instala e gerencia o Python sozinho,
  não precisa de Python pré-instalado
- Git
- Claude Code instalado e autenticado

## Instalação

### 1. Instalar o `uv` (se ainda não tiver)

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
uv --version
```

### 2. Instalar a CLI `apollo` globalmente

Direto do GitHub — não precisa clonar o monorepo `apollo-v2`:

```powershell
uv tool install "git+https://github.com/tpougy/apollo-v2.git#subdirectory=cli"
```

Confirmar que funcionou, de qualquer diretório:

```powershell
apollo --version
apollo doctor
```

`apollo doctor` deve reportar o `app_id` como **"embedded default"** — é o
esperado aqui, já que este ambiente não tem (e não precisa ter) um
`.env.instantdb`. Nenhum comando da CLI depende de admin token para operar
normalmente.

### 3. Autenticar

```powershell
apollo auth login
```

Fluxo de magic-code por e-mail: informa o e-mail, recebe o código, digita o
código. A sessão fica salva em `~/.config/apollo-cli/session` (no Windows,
`%USERPROFILE%\.config\apollo-cli\session`) — só é preciso refazer login se
`apollo auth whoami` passar a falhar.

### 4. Clonar/criar este repositório

```powershell
git clone <url-deste-repo>
cd apollo-tasks
```

(ou, se ainda não existir remotamente, `git init` numa pasta nova e copiar
para cá o `CLAUDE.md` deste mesmo diretório do monorepo `apollo-v2`,
`docs/ai-usage/CLAUDE.md`.)

### 5. Abrir no Claude Code

Abrir esta pasta diretamente no Claude Code, **nativamente no Windows**
(não via caminho `\\wsl$\...`) — é isso que garante que a CLI `apollo`
instalada no passo 2 esteja no `PATH` da sessão. O Claude Code carrega o
`CLAUDE.md` da raiz automaticamente ao iniciar.

## Estrutura deste repositório

- `CLAUDE.md` — instruções fixas para o Claude Code: modelo de domínio,
  comandos de cada entidade, como conduzir o onboarding e a regra de
  registro de inferências (`log-inferencia`). Precisa estar na raiz.
- Qualquer outro arquivo de apoio (notas, listas de fundos/rotinas a
  cadastrar) fica a seu critério — não é lido automaticamente pelo Claude
  Code a menos que você referencie na conversa.

## Uso do dia a dia (fase atual: onboarding)

Basta conversar com o Claude Code nesta pasta, descrevendo em texto livre
os fundos/projetos/rotinas/tarefas que quer cadastrar (colar e-mails,
listas, o que for). O `CLAUDE.md` já instrui o assistente a:

- pedir os dados que faltarem em vez de inventar;
- criar as entidades na ordem certa (fundo → projeto → etapa → tarefa →
  subtarefa; rotinas por último);
- registrar em `apollo log-inferencia` qualquer valor que ele mesmo tenha
  deduzido em vez de você ter dito explicitamente.

Comandos úteis para você mesmo conferir o que foi cadastrado, sem depender
do assistente:

```powershell
apollo fundo listar
apollo projeto listar
apollo rotina instancia listar --status <algum-status>
apollo log-inferencia listar   # tudo que a IA inferiu até agora
```

`apollo <entidade> <ação> --help` é sempre a fonte de verdade mais
atualizada — mais confiável que qualquer doc, inclusive este README.

## Atualizando/reinstalando a CLI

```powershell
uv tool upgrade apollo-cli
# ou, para forçar reinstalar a partir do HEAD atual do GitHub:
uv tool install --force "git+https://github.com/tpougy/apollo-v2.git#subdirectory=cli"
```

## Desinstalar

```powershell
uv tool uninstall apollo-cli
uv tool list   # confirma que não sobrou nada
```

## Troubleshooting

- **`apollo doctor` mostra admin token ausente** — normal e esperado; essa
  CLI não usa admin token para nenhuma operação normal (login incluso).
- **Erro de autenticação/`app_id`** — não tente criar um `.env.instantdb`
  manualmente aqui para "resolver"; isso está fora do escopo deste repo.
  Reporte o erro exato em vez de contornar.
- **Claude Code não encontra o comando `apollo`** — confirme que está
  rodando nativamente no Windows (não em `\\wsl$\...`) e que o passo 2
  rodou sem erro; `uv tool install` adiciona o binário ao `PATH` do usuário,
  pode ser necessário reabrir o terminal/Claude Code depois da instalação.

## Privacidade

Este repositório trata de controladoria financeira pessoal/profissional —
mesmo não guardando os dados em si (eles ficam no InstantDB), evite commitar
notas com nomes reais de fundos/clientes em texto livre, e mantenha o
repositório privado.
